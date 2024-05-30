/*jshint esversion: 8 */

const https = require('https');

const mins_per_day = 60 * 24;


function noaa_time_to_utc_datetime(noaa_time) {
    /**
    * Handy function to convert times from the NOAA format
    * NOAA times are days since year 0 (not 1900, legit year 0)
    * So 738931.25 is Feb 14th, 2024, at 6:00 AM (738,931 full days and .25 days = 6 hours)
    * @param  {float} noaa_time The days since year 0 including fractions
    * @return {string} Returns a string representing the time
    */
    const result = new Date(Date.UTC(0, 0, 0, 0, 0, 0));
    result.setFullYear(0);
    // Note: Subtract 1 from noaa time in days because otherwise we double count Jan 1, 0000
    result.setDate(result.getDate() + Math.floor(noaa_time - 1));
    // Convert the fraction of a day into hours/minutes
    const day_frac = noaa_time - Math.floor(noaa_time);
    const minutes_elapsed_in_day = day_frac * mins_per_day;
    const hours_elapsed_in_day = Math.floor(minutes_elapsed_in_day / 60);
    const minutes_remainder = minutes_elapsed_in_day - hours_elapsed_in_day * 60;
    result.setHours(hours_elapsed_in_day);
    result.setMinutes(minutes_remainder);
    return result.toLocaleString();
}

function get_result_metadata(gfs_response) {
    /**
    * The times/lat/lon/lev included are appended to the end, start at the end and work up until we hit a double new line
    * Gets the metadata mappings for the GFS response. At the end of the response is an explanation of the fields, i.e.:
    *         time, [3]
    *         738931.125, 738931.25, 738931.375
    *         lat, [5]
    *         41.0, 41.5, 42.0, 42.5, 43.0
    *         lon, [3]
    *         286.0, 286.5, 287.0
    *
    * This will return each of these fields as an array, as well as mark where they ended.
    * @param  {string} gfs_response The raw response data from GFS
    * @return {object} Returns an object with the following fields: lat, lon, time, lev, last_row, where last_row represents the end of the data section.
    */
    const metadata = {
        'lat': [],
        'lon': [],
        'time': [],
        'lev': [],
        'last_row': -1
    };
    const response_split = gfs_response.split('\n');
    for (let i = response_split.length - 2; i >= 0; i--) {
        if(response_split[i] === '' && response_split[i+1] === '') {
            metadata.last_row = i;
            break;
        }
        if(response_split[i].startsWith('lat')) metadata.lat = response_split[i+1].split(', ').map((each) => parseFloat(each));
        if(response_split[i].startsWith('lon')) metadata.lon = response_split[i+1].split(', ').map((each) => parseFloat(each));
        if(response_split[i].startsWith('time')) metadata.time = response_split[i+1].split(', ').map((each) => parseFloat(each));
        if(response_split[i].startsWith('lev')) metadata.lev = response_split[i+1].split(', ').map((each) => parseFloat(each));
    }
    return metadata;
}

function get_gfs_data(
    resolution='1p00',
    forecast_date=new Date(Date.now() - 86400000).toISOString().split('T')[0].replaceAll('-',''),
    forecast_time='00', // Every 6 hours. 00, 06, 12, or 18
    lat_range=[42,43],
    lon_range=[-73, -74],
    forward_times_included=0, // Number of 8 hour  fwd increments to include in addition to the forecast time
    field='gustsfc',
    convert_times=true
) {
    /**
     * The primary driver function for pulling GFS data and parsing the results into usable formats.
     * @param  {string} resolution Options are 1p00, 0p50 or 0p25
     * @param  {string} forecast_date Date for data in the format YYYMMDD
     * @param  {string} forecast_time Time for forecast. Every 6 hours. 00, 06, 12, or 18
     * @param  {number[]} lat_range Range of latitudes for the forecast results. Set to the same number for a single point.
     * @param  {number[]} lon_range Range of longitudes for the forecast results. Set to the same number for a single point.
     * @param  {number[]} forward_times_included Range of times to include starting with the given forecast time and progressing every 6 hours
     * @param  {string} field The data field
     * @param  {convert_times} field Whether or not to convert the date to a datetime string
     * @return {object} Returns an object with the following fields: array_format, object_format, lats, lons, times, levs, url. See docs for more.
     */
    const lat_start_input = lat_range[0];
    const lat_end_input = lat_range[1];
    const lon_start_input = lon_range[0];
    const lon_end_input = lon_range[1];
    // Per the docs:
    // Longitude:    0.00000000000°E to 359.00000000000°E (360 points, avg. res. 1.0°)
    // Latitude:	 -90.00000000000°N to 90.00000000000°N (181 points, avg. res. 1.0°)
    // Thus, we have to convert from our lat/lon to a scale of 0-360 for longitude and -90 to 90 for latitude
    // Then get the min/max so we are consistent with where our square starts
    // For example, if we're in resolution 0p25 (increments of 0.25), and our start coord is 5.9 degrees
    // We start at 0.0 degrees as point 0
    // Working our way up in increments of 0.25, we see that 5.75 is the 23rd index and 6.0 is the 24th
    // So we want to use index 23 as our start. If it were the end bound, we'd use 24 as the end index.
    const lat_start = Math.min(lat_start_input + 90, lat_end_input + 90);
    const lat_end = Math.max(lat_start_input + 90, lat_end_input + 90);
    const lon_start = Math.min((lon_start_input + 360) % 360, (lon_end_input + 360) % 360);
    const lon_end = Math.max((lon_start_input + 360) % 360, (lon_end_input + 360) % 360);

    // Map each to their respective increments, this will be useful when we figure out proper indexes
    const RESOLUTION_INCREMENTS = {
        "1p00": 1,
        "0p50": 0.5,
        "0p25": 0.25
    };
    // Compute the indexes for lat/lon to start/end
    const lat_start_index = Math.floor((lat_start) / RESOLUTION_INCREMENTS[resolution]);
    const lat_end_index = Math.ceil((lat_end) / RESOLUTION_INCREMENTS[resolution]);
    const lon_start_index = Math.floor((lon_start) / RESOLUTION_INCREMENTS[resolution]);
    const lon_end_index = Math.ceil((lon_end) / RESOLUTION_INCREMENTS[resolution]);

    let altitude = '';
    // Only these fields have an altitude component. Set it to [1], which is roughly surface level.
    // Future improvement to allow this to be customized as well.
    const FIELDS_WITH_ALTITUDE = new Set([
        'absvprs', 'clwmrprs', 'dzdtprs', 'grleprs', 'hgtprs', 'icmrprs', 'o3mrprs', 'rhprs',
        'rwmrprs', 'snmrprs', 'spfhprs', 'tmpprs', 'ugrdprs', 'vgrdprs', 'vvelprs',
    ]);
    if (FIELDS_WITH_ALTITUDE.has(field)) altitude = '[1]';

    // Get the NOAA URL
    url = `https://nomads.ncep.noaa.gov/dods/gfs_${resolution}/gfs${forecast_date}/gfs_${resolution}_${forecast_time}z.ascii?${field}[0:${forward_times_included}]${altitude}[${lat_start_index}:${lat_end_index}][${lon_start_index}:${lon_end_index}]`;
    console.log(url);

    return (async () => {
        const response = await fetch(url);
        const noaa_res = await response.text();
        /*
        The response will look like this:
        gustsfc, [3][5][3]
        [0][0], 9.750155, 11.150156, 12.450156
        [0][1], 6.5501556, 2.7501557, 11.550156
        [0][2], 2.4501557, 1.2501557, 12.750155
        [0][3], 10.350156, 6.6501555, 11.550156
        [0][4], 9.850156, 4.1501555, 9.250155

        [1][0], 11.936633, 13.5366335, 14.0366335
        [1][1], 12.5366335, 12.336634, 13.5366335
        [1][2], 11.636634, 4.036633, 10.236633
        [1][3], 14.736633, 11.836634, 10.5366335
        [1][4], 12.636634, 10.336634, 10.336634

        [2][0], 11.822627, 15.622626, 15.322626
        [2][1], 13.522626, 14.722626, 13.222626
        [2][2], 12.322627, 13.922626, 15.622626
        [2][3], 13.722626, 13.222626, 14.122626
        [2][4], 11.822627, 10.9226265, 10.722627


        time, [3]
        738931.125, 738931.25, 738931.375
        lat, [5]
        41.0, 41.5, 42.0, 42.5, 43.0
        lon, [3]
        286.0, 286.5, 287.0

        */

        const metadata = get_result_metadata(noaa_res);

        // We care about things on a line by line basis. First, let's get our time/lat/lon values
        const noaa_res_split = noaa_res.split('\n');

        // Now get the middle data. We don't care about the first row
        const data = noaa_res_split.slice(1, metadata.last_row);
        // We combine it back, with the original newlines
        const data_str = data.join('\n');
        // Each time block is separated by a double newline, while each lat/lon within the time block is separated by
        // only a single newline. First split by double newlines, then by single newlines, then parse the line into floats
        // This creates a 3d array, with time/lat/lon as the three dimensions
        const time_data_blocks = data_str.split('\n\n').map((each) => each.split('\n').filter((each) => each).map((each) => each.split(', ').slice(1,)));

        // Now we have three arrays: One of the times, one of the lats, and one of the lons
        // Loop through each, knowing their indices are already nicely ordered following the arrays from the bottom summary
        // Then get their values from the time_data_blocks 3d array
        const res_arr = [];
        const res_obj = {};
        metadata.time.forEach((time, time_idx) => {
            metadata.lat.forEach((lat, lat_idx) => {
                metadata.lon.forEach((lon, lon_idx) => {
                    const time_adj = convert_times ? noaa_time_to_utc_datetime(time) : time;
                    const value_parsed = parseFloat(time_data_blocks[time_idx][lat_idx][lon_idx]);
                    const lon_adj = lon - 360; // Convert it back
                    res_arr.push({
                        time: time_adj,
                        lat,
                        lon: lon_adj,
                        value: value_parsed
                    });
                    if(!res_obj[time_adj]) res_obj[time_adj] = {};
                    if(!res_obj[time_adj][lat]) res_obj[time_adj][lat] = {};
                    res_obj[time_adj][lat][lon_adj] = value_parsed;
               });
            });
        });
        return ({
                array_format: res_arr,
                obj_format: res_obj,
                times: metadata.time.map((each) => convert_times ? noaa_time_to_utc_datetime(each) : each),
                lats: metadata.lat,
                lons: metadata.lon.map((each) => each - 360),
                levs: metadata.lev,
                url: url,
            });
    })();
}

module.exports = {
    get_gfs_data,
    get_result_metadata,
    noaa_time_to_utc_datetime
};