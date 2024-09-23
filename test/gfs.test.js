/*jshint esversion: 8 */

const noaa_gfs = require('../index');

test('convert a NOAA GFS style date to a UTC date', () => {
  expect(noaa_gfs.noaa_time_to_utc_datetime(738931.25).toUTCString()).toBe(new Date("2024-02-15T06:00:00.000Z").toUTCString());
  expect(noaa_gfs.noaa_time_to_utc_datetime(739099.5).toUTCString()).toBe(new Date("2024-08-01T12:00:00.000Z").toUTCString());
  expect(noaa_gfs.noaa_time_to_utc_datetime(739099.875).toUTCString()).toBe(new Date("2024-08-01T21:00:00.000Z").toUTCString());
});


test('get the metadata (lat, lon, time, lev) from a resposne', () => {
  const input = `gustsfc, [3][5][3]
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
`;

    expect(noaa_gfs.get_result_metadata(input)).toEqual({
      "last_row": 18,
      "lat": [41, 41.5, 42, 42.5, 43],
      "lon": [286, 286.5, 287],
      "time": [738931.125, 738931.25, 738931.375],
      "lev": [],
    });

    const input_with_lev = `ugrdprs, [6][1][1][1]
[0][0][0], 14.75332


[1][0][0], 16.159197


[2][0][0], 14.124465


[3][0][0], 12.463874


[4][0][0], 10.394353


[5][0][0], 10.046526



time, [6]
738933.25, 738933.375, 738933.5, 738933.625, 738933.75, 738933.875
lev, [1]
975.0
lat, [1]
40.5
lon, [1]
286.0
`;
     expect(noaa_gfs.get_result_metadata(input_with_lev)).toEqual({
       "last_row": 18,
       "lat": [40.5],
       "lev": [975.0],
       "lon": [286.0],
       "time": [738933.25, 738933.375, 738933.5, 738933.625, 738933.75, 738933.875]
     });
});


test('get GFS data', () => {
  const result = noaa_gfs.get_gfs_data(
      '0p25',
      new Date(Date.now() - 86400000).toISOString().split('T')[0].replaceAll('-',''),
      '06',
      [40.5, 40.5],
      [-74,-74],
      5,
      'rh2m',
  ).then((res) => {
    expect(res.url).toContain('https://nomads.ncep.noaa.gov/dods/gfs_0p25/gfs');
    expect(res.url).toContain('/gfs_0p25_06z.ascii?rh2m[0:5][522:522][1144:1144]');
    expect(res.array_format.length).toEqual(6);
    expect(res.array_format[0].value).toBeGreaterThan(0);
    expect(res.array_format[0].value).toBeLessThan(100);
    expect(res.array_format[1].lat).toBe(40.5);
    expect(res.array_format[1].lon).toBe(-74);
    expect(res.obj_format[res.times[3]]['40.5']['-74']).toBeGreaterThan(0);
    expect(res.obj_format[res.times[3]]['40.5']['-74']).toBeLessThan(100);
    expect(Object.keys(res.obj_format)).toEqual(res.times.map((each) => each.toUTCString()));
    expect(parseFloat(Object.keys(res.obj_format[res.times[3]]))).toEqual(res.lats[0]);
    expect(parseFloat(Object.keys(res.obj_format[res.times[3]][res.lats[0]]))).toEqual(res.lons[0]);
  });

});