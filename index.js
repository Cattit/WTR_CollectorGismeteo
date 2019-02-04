let getData = require("./data/gismeteo.js");
let dal = require("wtr-dal");

// getData.getforecast("weather-alzamay-145180")
//     .then(dataAll => {
//         dal.saveForecast(dataAll[0].source, dataAll[0].date.now)
//             .then(forecastId => {
//                 console.log(forecastId);
// Promise.all(dataAll.map(forecast => dal.saveMeteoData(forecast, forecastId)))
// }
// )
// .then(() => console.log("Successfully sent data from Gismeteo"))
// .catch(error => console.log("Error sending data from Gismeteo"))
// })
async function test() {
    let url = "weather-alzamay-145180"
    const dataAll = await getData.getforecast(url);
    const forecastId = await dal.saveForecast(dataAll[0].source, dataAll[0].date.now);
    const locationId = await dal.searchLocationByUrl(url)
    // console.log("GHK")
    // console.log(forecastId)
    // console.log(locationId)
    await dataAll.map(forecast => dal.saveForecastData(forecast, forecastId, locationId));
}

test();
