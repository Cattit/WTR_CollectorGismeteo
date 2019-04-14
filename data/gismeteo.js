const puppeteer = require('puppeteer');
const dal = require("wtr-dal");
const urlDop = [null, "/tomorrow/", null, "/4-day/", null, "/6-day/"]
const dateNow = new Date()
dateNow.setHours(0, 0, 0, 000)

function plusminus(mas) {
  const regexp = /^(([\u002D\u00AD\u058A\u05BE\u1400\u1806\u2010\u2011\u2012\u2013\u2014\u2015\u2E17\u2E1A\u2E3A\u2E3B\u2E40\u301C\u3030\u30A0\uFE31\uFE32\uFE58\uFE63\uFF0D\u2212\-])|([\+\uFF0B\u002B\u2795]))?\s*(\d*(?:[.,]\d*)?)\s*(\u2103|\u00B0?[СC]|\u2109|\u00B0?F|\u212A|\u00B0?[KК]|\u00B0)?$/mi
  return mas.map(m => {
    const match = m.match(regexp)
    if (match[2]) {
      return Number("-" + match[4])
    }
    return Number(match[4])
  })
}

function dateDay(amount_day) {
  return {
    now: dateNow,
    date_start: new Date(dateNow.getFullYear(), dateNow.getMonth(), dateNow.getDate() + amount_day, 12),
    date_end: new Date(dateNow.getFullYear(), dateNow.getMonth(), dateNow.getDate() + amount_day, 23, 59, 59, 999),
    type_day: "day"
  }
}

function dateNight(amount_day) {
  return {
    now: dateNow,
    date_start: new Date(dateNow.getFullYear(), dateNow.getMonth(), dateNow.getDate() + amount_day, 00),
    date_end: new Date(dateNow.getFullYear(), dateNow.getMonth(), dateNow.getDate() + amount_day, 11, 59, 59, 999),
    type_day: "night"
  }
}

function fun_rainfall(rainfallLength, weather, wind, temperature, amount_rainfall) {
  let type = new Object();
  type.snow = 0;
  type.rain = 0;
  type.sand = null;
  type.squall = null;
  type.mis = null;
  type.storm = 0;
  type.drizzle = null;
  type.rainsnow = 0;
  type.grad = null;
  type.hard_wind = wind >= 15 ? 1 : 0
  type.hard_heat = (dateNow.getMonth() >= 3 && dateNow.getMonth() <= 8 && temperature >= 40) ? 1 : 0
  type.hard_frost = ((dateNow.getMonth() >= 9 || dateNow.getMonth() <= 2) && temperature <= -35) ? 1 : 0
  if (rainfallLength !== 0) {
    weather.map(w => {
      if (w.indexOf("дождь") !== -1)
        type.rain = 1;
      if (w.indexOf("снег") !== -1)
        type.snow = 1;
      if (w.indexOf("осадки") !== -1)
        type.rainsnow = 1;
      if (w.indexOf("гроза") !== -1)
        type.storm = 1;
    })
  }
  type.hard_rainfall = ((type.snow === 1 && type.rainsnow === 0 && type.rain === 0 && amount_rainfall >= 7) || amount_rainfall >= 15) ? 1 : 0 // если снега не менее 7 мм или осадков не менее 15 мм

  return type
}


async function getforecast(url_api, url_location, id_source) { // url_api = "https://www.gismeteo.ru/"
  let dataAll = [];
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });   //запуск браузера хром
  const page = await browser.newPage();   //переход на новую стр

  for (let dd = 1, i = 0; dd < 6; dd += 2, i++) {

    await page.goto(url_api + url_location + urlDop[dd], { waitUntil: 'load', timeout: 0 }); // переход по ссылке

    //выполнение скрипта как в консоли Gismeteo
    let temperatureAll = await page.evaluate(() => {   // температура
      const tempTags = document.querySelectorAll('span.unit_temperature_c');
      const data = Array.from(tempTags).map(temp => temp.innerText.trim());
      return data
    });
    temperatureAll = plusminus(temperatureAll)

    const wind_speedAll = await page.evaluate(() => {  // скорость ветра и порывов
      const windTags = document.querySelectorAll('span.unit_wind_m_s');
      const data = Array.from(windTags).map(wind => Number(wind.innerText));
      return data
    });

    const amount_rainfallAll = await page.evaluate(() => {  // кол-во осадков
      const rainfallTags = document.querySelectorAll('div.w_prec');
      let data = Array.from(rainfallTags).map(rainfall => rainfall.innerText);
      data = data.map(d => Number(d.replace(/,/, ".")))
      return data
    });

    const rainfall = await page.evaluate(() => {  // вид осадков
      const rainfallTags = document.querySelectorAll('span.tooltip');
      let data = Array.from(rainfallTags).map(rainfall => rainfall.dataset.text);
      data = data.map(m => m.toLowerCase())
      return data
    });
    // .match(/^[а-я]+/ig) слово в начале текста: только вид облачности

    let temperature = Math.max(temperatureAll[10], temperatureAll[11], temperatureAll[12], temperatureAll[13]),
      wind_speed_from = Math.min(wind_speedAll[14], wind_speedAll[15], wind_speedAll[16], wind_speedAll[17]),
      wind_speed_to = Math.max(wind_speedAll[14], wind_speedAll[15], wind_speedAll[16], wind_speedAll[17]),
      wind_gust = Math.max(wind_speedAll[22], wind_speedAll[23], wind_speedAll[24], wind_speedAll[25]),
      amount_rainfall = amount_rainfallAll.length === 0 ? 0 : (amount_rainfallAll[4] + amount_rainfallAll[5] + amount_rainfallAll[6] + amount_rainfallAll[7]).toFixed(1) // если не округлять иногда считает неправильно

    dataAll.push(
      {
        id_source,
        url: url_location,
        depth_forecast: dd,
        date: dateDay(dd),
        temperature: temperature,
        wind_speed: {
          from: wind_speed_from,
          to: wind_speed_to
        },
        wind_gust: wind_gust,
        amount_rainfall: amount_rainfall,
        rainfall: fun_rainfall(rainfall.length, [rainfall[4], rainfall[5], rainfall[6], rainfall[7]], Math.max(wind_speed_from, wind_speed_to, wind_gust), temperature, amount_rainfall),
      })

    temperature = Math.min(temperatureAll[6], temperatureAll[7], temperatureAll[8], temperatureAll[9])
    wind_speed_from = Math.min(wind_speedAll[10], wind_speedAll[11], wind_speedAll[12], wind_speedAll[13])
    wind_speed_to = Math.max(wind_speedAll[10], wind_speedAll[11], wind_speedAll[12], wind_speedAll[13])
    wind_gust = Math.max(wind_speedAll[18], wind_speedAll[19], wind_speedAll[20], wind_speedAll[21])
    amount_rainfall = amount_rainfallAll.length === 0 ? 0 : (amount_rainfallAll[0] + amount_rainfallAll[1] + amount_rainfallAll[2] + amount_rainfallAll[3]).toFixed(1)

    dataAll.push(
      {
        id_source,
        url: url_location,
        depth_forecast: dd,
        date: dateNight(dd),
        temperature: temperature,
        wind_speed: {
          from: wind_speed_from,
          to: wind_speed_to
        },
        wind_gust: wind_gust,
        amount_rainfall: amount_rainfall,
        rainfall: fun_rainfall(rainfall.length, [rainfall[0], rainfall[1], rainfall[2], rainfall[3]], Math.max(wind_speed_from, wind_speed_to, wind_gust), temperature, amount_rainfall)
      })

  }

  await browser.close();// закрыть браузер
  return dataAll
}

module.exports.getforecast = getforecast;
