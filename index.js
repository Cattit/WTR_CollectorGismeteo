const getData = require("./data/gismeteo.js");
const dal = require("wtr-dal");
// const source = "gismeteo"
const id_source = 1
const dateNow = new Date()
dateNow.setHours(0, 0, 0, 000)

async function startDataСollection() {
    const id_forecast = await dal.saveForecast(id_source, dateNow);
    const masLocation = await dal.getAllLocationUrlId()
    const url_api = await dal.getUrlApi(id_source)
    for (var i = 0; i < masLocation.length; i++) {
        let url_location = masLocation[i].url_gismeteo
        let id_location = masLocation[i].id
        const dataForecast = await getData.getforecast(url_api, url_location, id_source)
        await dataForecast.map(forecast => dal.saveForecastData(forecast, id_forecast, id_location));
    }
}

startDataСollection();
