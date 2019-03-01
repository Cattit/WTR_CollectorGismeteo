let getData = require("./data/gismeteo.js");
let dal = require("wtr-dal");

async function startDataСollection() {
    let url = "weather-kirensk-4743"
    const dataForecast = await getData.getforecast(url);
    // console.log(dataForecast)
    const id_forecast = await dal.saveForecast(dataForecast[0].source, dataForecast[0].date.now);
    const id_location = await dal.getIdLocationByUrl(url)
    await dataForecast.map(forecast => dal.saveForecastData(forecast, id_forecast, id_location));
}

startDataСollection();
