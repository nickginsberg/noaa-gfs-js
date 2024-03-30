# noaa-gfs-js
A lightweight library for pulling GFS (Global Forecasting System) weather data from NOAA, without any major 3rd party depencies.


## Installing

Installation is simple with npm:

`npm i noaa-gfs-js --save`

## About

This library is loosely inspired by the Python library [getgfs](https://github.com/jagoosw/getgfs/). As with the getgfs package, the goal was to build a lightweight library to pull GFS data without the need for 3rd party software (such as ECMWF's `ecCodes`).

All available fields from NOAA's grib files are available here, using [OpenDAP](https://nomads.ncep.noaa.gov/) instead of the grib2 binaries.

NOTE: This library is independently maintained and is not officially supported or endorsed by NOAA.
 
## Usage

The goal of the library is to be simple to use. The get_gfs_data function takes straightforward parameters, and returns lat/long/time dimensions with the given data in both an array and object format.

```javascript
import * as noaa_gfs from 'noaa-gfs-js';

noaa_gfs.get_gfs_data(
    '0p25', // Options are 0p25, 0p50, or 1p00
    new Date(Date.now() - 86400000).toISOString().split('T')[0].replaceAll('-',''), // YYYMMDD format date
    '00', // Every 6 hours. 00, 06, 12, or 18
    [40.5, 40.5], // Lat range
    [-74,-74], // Lon range
    5,  // Number of 8 hour  fwd increments to include in addition to the forecast time
    'rh2m', // The requested data item
    true // Whether or not to convert the times into dates or keep as NOAA formatted times (see below for more details)
).then((res) => console.log(res));

``` 

The resulting object will have the weather data in two formats: object and array.

Array format:
```javascript
[                                                        
  {
    time: '2/22/2024, 6:00:00 AM',
    lat: 40.5, lon: -74,
    value: 93.3
  }, 
  {                                                                    
    time: '2/22/2024, 6:00:00 AM',                                     
    lat: 40.5,                                                         
    lon: -73.75,                                                       
    value: 91.6                                                        
  },                                                                   
  {                                                                    
    time: '2/22/2024, 6:00:00 AM',                                     
    lat: 40.5,                                                         
    lon: -73.5,                                                        
    value: 90.3                                                        
  },                                                                   
  {                                                                    
    time: '2/22/2024, 6:00:00 AM',                                     
    lat: 40.5,                                                         
    lon: -73.25,                                                       
    value: 89.6                                                        
  }
]                                                              
```

Object format is an object with keys time, lat, lng:
```javascript
{
    '2/22/2024, 6:00:00 AM': {
      '41': {'-73.25': 89.6},
      '42': {'-73.5': 90.3},
      '40.5': {'-74': 91.6},
      '40.75': {'-73.75': 93.3}
    }
}
```

## Explanation of Indexing Concepts

When making NOMADS API requests, we do not simply give the desired time/lat/lons. Rather, we have to give the INDEX of our desired points.


Per the [docs](https://nomads.ncep.noaa.gov/dods/gfs_0p25/) (choose a folder, then choose the .info file for more):

* Longitude: 0.00000000000°E to 359.75000000000°E (1440 points, avg. res. 0.25°)
* Latitude: -90.00000000000°N to 90.00000000000°N (721 points, avg. res. 0.25°)
* Altitude:  1000.00000000000 to 0.01000000000 (41 points, avg. res. 25.0)
* Time: 	 12Z24FEB2024 to 12Z24FEB2024 (1 points) 

Thus, we have to convert from our lat/lon to a scale of 0-360 for longitude with 1440 stops, -90 to 90 for latitude with 721 stops, etc.

Then get the min/max so we are consistent with where our square starts.

For example, if we're in resolution 0p25 (increments of 0.25), and our start coord is 5.9 degrees:

* We start at 0.0 degrees as point 0.
* Working our way up in increments of 0.25, we see that 5.75 is the 23rd index and 6.0 is the 24th.
* So we want to use index 23 as our start. If it were the end bound, we'd use 24 as the end index.

Our resulting URL, therefore, will look something like this: <https://nomads.ncep.noaa.gov/dods/gfs_0p25/gfs20240223/gfs_0p25_06z.ascii?rh2m[0:5][522:530][1144:1148]> , where the indexes requested are in the brackets. Note the date may need to be updated in the URL as data is only available for a few weeks.

## Available Data Fields
* absvprs ** (1000 975 950 925 900.. 10 7 4 2 1) absolute vorticity [1/s]
* no4lftxsfc ** surface best (4 layer) lifted index [k]
* capesfc ** surface convective available potential energy [j/kg]
* cape180_0mb ** 180-0 mb above ground convective available potential energy [j/kg]
* cinsfc ** surface convective inhibition [j/kg]
* cin180_0mb ** 180-0 mb above ground convective inhibition [j/kg]
* clwmrprs ** (1000 975 950 925 900.. 250 200 150 100 50) cloud mixing ratio [kg/kg]
* clwmrhy1 ** 1 hybrid level cloud mixing ratio [kg/kg]
* cwatclm ** entire atmosphere (considered as a single layer) cloud water [kg/m^2]
* dzdtprs ** (1000 975 950 925 900.. 10 7 4 2 1) vertical velocity (geometric) [m/s]
* grleprs ** (1000 975 950 925 900.. 250 200 150 100 50) graupel [kg/kg]
* grlehy1 ** 1 hybrid level graupel [kg/kg]
* hgtsfc ** surface geopotential height [gpm]
* hgtprs ** (1000 975 950 925 900.. 10 7 4 2 1) geopotential height [gpm]
* hgt2pv ** pv=2e-06 (km^2/kg/s) surface geopotential height [gpm]
* hgtneg2pv ** pv=-2e-06 (km^2/kg/s) surface geopotential height [gpm]
* hgttop0c ** highest tropospheric freezing level geopotential height [gpm]
* hgt0c ** 0c isotherm geopotential height [gpm]
* hgtmwl ** max wind geopotential height [gpm]
* hgttrop ** tropopause geopotential height [gpm]
* icahtmwl ** max wind icao standard atmosphere reference height [m]
* icahttrop ** tropopause icao standard atmosphere reference height [m]
* icetmpsfc ** surface ice temperature [k]
* icmrprs ** (1000 975 950 925 900.. 250 200 150 100 50) ice water mixing ratio [kg/kg]
* icmrhy1 ** 1 hybrid level ice water mixing ratio [kg/kg]
* lftxsfc ** surface surface lifted index [k]
* msletmsl ** mean sea level mslp (eta model reduction) [pa]
* o3mrprs ** (1000 975 950 925 900.. 10 7 4 2 1) ozone mixing ratio [kg/kg]
* potsig995 ** 0.995 sigma level potential temperature [k]
* pratesfc ** surface precipitation rate [kg/m^2/s]
* pressfc ** surface pressure [pa]
* pres2pv ** pv=2e-06 (km^2/kg/s) surface pressure [pa]
* presneg2pv ** pv=-2e-06 (km^2/kg/s) surface pressure [pa]
* presmwl ** max wind pressure [pa]
* prestrop ** tropopause pressure [pa]
* prmslmsl ** mean sea level pressure reduced to msl [pa]
* pwatclm ** entire atmosphere (considered as a single layer) precipitable water [kg/m^2]
* rhprs ** (1000 975 950 925 900.. 10 7 4 2 1) relative humidity [%]
* rhsg330_1000 ** 0.33-1 sigma layer relative humidity [%]
* rhsg440_1000 ** 0.44-1 sigma layer relative humidity [%]
* rhsg720_940 ** 0.72-0.94 sigma layer relative humidity [%]
* rhsg440_720 ** 0.44-0.72 sigma layer relative humidity [%]
* rhsig995 ** 0.995 sigma level relative humidity [%]
* rh30_0mb ** 30-0 mb above ground relative humidity [%]
* rhclm ** entire atmosphere (considered as a single layer) relative humidity [%]
* rhtop0c ** highest tropospheric freezing level relative humidity [%]
* rh0c ** 0c isotherm relative humidity [%]
* rwmrprs ** (1000 975 950 925 900.. 250 200 150 100 50) rain mixing ratio [kg/kg]
* rwmrhy1 ** 1 hybrid level rain mixing ratio [kg/kg]
* snmrprs ** (1000 975 950 925 900.. 250 200 150 100 50) snow mixing ratio [kg/kg]
* snmrhy1 ** 1 hybrid level snow mixing ratio [kg/kg]
* sotypsfc ** surface soil type [-]
* spfhprs ** (1000 975 950 925 900.. 10 7 4 2 1) specific humidity [kg/kg]
* spfh30_0mb ** 30-0 mb above ground specific humidity [kg/kg]
* tmpprs ** (1000 975 950 925 900.. 10 7 4 2 1) temperature [k]
* tmp_1829m ** 1829 m above mean sea level temperature [k]
* tmp_2743m ** 2743 m above mean sea level temperature [k]
* tmp_3658m ** 3658 m above mean sea level temperature [k]
* tmp80m ** 80 m above ground temperature [k]
* tmp100m ** 100 m above ground temperature [k]
* tmpsig995 ** 0.995 sigma level temperature [k]
* tmp30_0mb ** 30-0 mb above ground temperature [k]
* tmp2pv ** pv=2e-06 (km^2/kg/s) surface temperature [k]
* tmpneg2pv ** pv=-2e-06 (km^2/kg/s) surface temperature [k]
* tmpmwl ** max wind temperature [k]
* tmptrop ** tropopause temperature [k]
* tozneclm ** entire atmosphere (considered as a single layer) total ozone [du]
* ugrdprs ** (1000 975 950 925 900.. 10 7 4 2 1) u-component of wind [m/s]
* ugrd_1829m ** 1829 m above mean sea level u-component of wind [m/s]
* ugrd_2743m ** 2743 m above mean sea level u-component of wind [m/s]
* ugrd_3658m ** 3658 m above mean sea level u-component of wind [m/s]
* ugrd20m ** 20 m above ground u-component of wind [m/s]
* ugrd30m ** 30 m above ground u-component of wind [m/s]
* ugrd40m ** 40 m above ground u-component of wind [m/s]
* ugrd50m ** 50 m above ground u-component of wind [m/s]
* ugrd80m ** 80 m above ground u-component of wind [m/s]
* ugrd100m ** 100 m above ground u-component of wind [m/s]
* ugrdsig995 ** 0.995 sigma level u-component of wind [m/s]
* ugrd30_0mb ** 30-0 mb above ground u-component of wind [m/s]
* ugrd2pv ** pv=2e-06 (km^2/kg/s) surface u-component of wind [m/s]
* ugrdneg2pv ** pv=-2e-06 (km^2/kg/s) surface u-component of wind [m/s]
* ugrdmwl ** max wind u-component of wind [m/s]
* ugrdtrop ** tropopause u-component of wind [m/s]
* vegsfc ** surface vegetation [%]
* vgrdprs ** (1000 975 950 925 900.. 10 7 4 2 1) v-component of wind [m/s]
* vgrd_1829m ** 1829 m above mean sea level v-component of wind [m/s]
* vgrd_2743m ** 2743 m above mean sea level v-component of wind [m/s]
* vgrd_3658m ** 3658 m above mean sea level v-component of wind [m/s]
* vgrd20m ** 20 m above ground v-component of wind [m/s]
* vgrd30m ** 30 m above ground v-component of wind [m/s]
* vgrd40m ** 40 m above ground v-component of wind [m/s]
* vgrd50m ** 50 m above ground v-component of wind [m/s]
* vgrd80m ** 80 m above ground v-component of wind [m/s]
* vgrd100m ** 100 m above ground v-component of wind [m/s]
* vgrdsig995 ** 0.995 sigma level v-component of wind [m/s]
* vgrd30_0mb ** 30-0 mb above ground v-component of wind [m/s]
* vgrd2pv ** pv=2e-06 (km^2/kg/s) surface v-component of wind [m/s]
* vgrdneg2pv ** pv=-2e-06 (km^2/kg/s) surface v-component of wind [m/s]
* vgrdmwl ** max wind v-component of wind [m/s]
* vgrdtrop ** tropopause v-component of wind [m/s]
* vvelprs ** (1000 975 950 925 900.. 10 7 4 2 1) vertical velocity (pressure) [pa/s]
* vvelsig995 ** 0.995 sigma level vertical velocity (pressure) [pa/s]
* vwsh2pv ** pv=2e-06 (km^2/kg/s) surface vertical speed shear [1/s]
* vwshneg2pv ** pv=-2e-06 (km^2/kg/s) surface vertical speed shear [1/s]
* vwshtrop ** tropopause vertical speed shear [1/s]

## Explanation of Date & Time Handling
The time field, as returned by the NOMADS, is represented by days since year 0. The time is represented by the decimal fraction of the day--i.e. .25 would be 1/4 through the day, or 6am.

So 738931.25 is Feb 14th, 2024, at 6:00 AM (738,931 full days and .25 days = 6 hours). This library returns times as they were by default, but the noaa_time_to_utc_datetime can be used to convert to a friendlier string.

## Todo
- Allow for processing of altitude fields (currently only supports index 1 only for fields with a lev parameter)
- Support for multiple fields at the same time