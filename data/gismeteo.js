const puppeteer = require('puppeteer');
let dal = require("wtr-dal");
const source = "gismeteo"
const urlDop = [null, "/tomorrow/", null, "/4-day/", null, "/6-day/"]
const dateNow = new Date()

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

function fun_rainfall(weather) {
  let type = new Object();
  type.snow = 0;
  type.rain = 0;
  type.sand = 0;
  type.squall = 0;
  type.mist = 0;
  type.storm = 0;
  type.drizzle = 0;
  type.rainsnow = 0;

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

  return type
}


async function getforecast(urlNew) {
  let dataAll = [];
  const browser = await puppeteer.launch();   //запуск браузера хром
  const page = await browser.newPage();   //переход на новую стр
  const gismeteo = "https://www.gismeteo.ru/"
  for (let dd = 1, i = 0; dd < 6; dd += 2, i++) {

    await page.goto(gismeteo + urlNew + urlDop[dd]); // переход по ссылке

    //выполнение скрипта как в консоли Gismeteo
    let temperature = await page.evaluate(() => {   // температура
      const tempTags = document.querySelectorAll('span.unit_temperature_c');
      const data = Array.from(tempTags).map(temp => temp.innerText.trim());
      return data
    });
    temperature = plusminus(temperature)

    const wind_speed = await page.evaluate(() => {  // скорость ветра и порывов
      const windTags = document.querySelectorAll('span.unit_wind_m_s');
      const data = Array.from(windTags).map(wind => Number(wind.innerText));
      return data
    });

    const amount_rainfall = await page.evaluate(() => {  // кол-во осадков
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

    dataAll.push(
      {
        source,
        url: urlNew,
        depth_forecast: dd,
        date: dateDay(dd),
        temperature: Math.max(temperature[10], temperature[11], temperature[12], temperature[13]),
        wind_speed: {
          from: Math.min(wind_speed[14], wind_speed[15], wind_speed[16], wind_speed[17]),
          to: Math.max(wind_speed[14], wind_speed[15], wind_speed[16], wind_speed[17])
        },
        wind_gust: Math.max(wind_speed[22], wind_speed[23], wind_speed[24], wind_speed[25]),
        rainfall: fun_rainfall([rainfall[4], rainfall[5], rainfall[6], rainfall[7]]),
        amount_rainfall: amount_rainfall.length === 0 ? 0 : (amount_rainfall[4] + amount_rainfall[5] + amount_rainfall[6] + amount_rainfall[7])
      })

    dataAll.push(
      {
        source,
        url: urlNew,
        depth_forecast: dd,
        date: dateNight(dd),
        temperature: Math.min(temperature[6], temperature[7], temperature[8], temperature[9]),
        wind_speed: {
          from: Math.min(wind_speed[10], wind_speed[11], wind_speed[12], wind_speed[13]),
          to: Math.max(wind_speed[10], wind_speed[11], wind_speed[12], wind_speed[13])
        },
        wind_gust: Math.max(wind_speed[18], wind_speed[19], wind_speed[20], wind_speed[21]),
        rainfall: fun_rainfall([rainfall[0], rainfall[1], rainfall[2], rainfall[3]]),
        amount_rainfall: amount_rainfall.length === 0 ? 0 : (amount_rainfall[0] + amount_rainfall[1] + amount_rainfall[2] + amount_rainfall[3])
      })

  }

  await browser.close();// закрыть браузер
  // console.log(dataAll)
  return dataAll
}

module.exports.getforecast = getforecast;
