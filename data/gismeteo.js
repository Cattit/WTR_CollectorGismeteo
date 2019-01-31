const puppeteer = require('puppeteer');
const source = "gismeteo"
const urlDop = [null, "tomorrow/", null, "4-day/", null, "6-day/"]

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
  let date = new Object()
  date.now = new Date();
  date.date_start = new Date();
  date.date_start.setDate(date.date_start.getDate() + amount_day);
  date.date_start.setHours(12, 00, 00, 000);
  date.date_end = new Date();
  date.date_end.setDate(date.date_end.getDate() + amount_day);
  date.date_end.setHours(23, 59, 59, 999);
  date.type = "day"

  return date
}

function dateNight(amount_day) {
  let date = new Object()
  date.now = new Date();
  date.date_start = new Date();
  date.date_start.setDate(date.date_start.getDate() + amount_day);
  date.date_start.setHours(00, 00, 00, 000);
  date.date_end = new Date();
  date.date_end.setDate(date.date_end.getDate() + amount_day);
  date.date_end.setHours(11, 59, 59, 999);
  date.type = "night"

  return date
}

function fun_rainfall(weather) {
  let type = new Object();
  type.snow = 0;
  type.rain = 0;
  type.sand = 0;
  type.squalls = 0;
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
  for (let dd = 1, i = 0; dd < 6; dd += 2, i++) {

    const browser = await puppeteer.launch();   //запуск браузера хром
    const page = await browser.newPage();   //переход на новую стр
    const gismeteo = "https://www.gismeteo.ru/"
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

    let dataDay = new Object();
    dataDay.source = source;
    dataDay.city = urlNew;
    dataDay.depth_forecast = dd;
    dataDay.date = dateDay(dataDay.depth_forecast)
    dataDay.temperature = Math.max(temperature[10], temperature[11], temperature[12], temperature[13])
    dataDay.wind_speed = new Object();
    dataDay.wind_speed.from = Math.min(wind_speed[14], wind_speed[15], wind_speed[16], wind_speed[17]);
    dataDay.wind_speed.to = Math.max(wind_speed[14], wind_speed[15], wind_speed[16], wind_speed[17]);
    dataDay.wind_gust = Math.max(wind_speed[22], wind_speed[23], wind_speed[24], wind_speed[25]);
    dataDay.rainfall = fun_rainfall([rainfall[4], rainfall[5], rainfall[6], rainfall[7]]);
    if (amount_rainfall.length === 0)
      dataDay.amount_rainfall = 0
    else
      dataDay.amount_rainfall = amount_rainfall[4] + amount_rainfall[5] + amount_rainfall[6] + amount_rainfall[7];

    dataAll[i] = dataDay;
    i++;

    let dataNight = new Object();
    dataNight.source = source;
    dataDay.city = urlNew;
    dataNight.depth_forecast = dd;
    dataNight.date = dateNight(dataNight.depth_forecast)
    dataNight.temperature = Math.min(temperature[6], temperature[7], temperature[8], temperature[9])
    dataNight.wind_speed = new Object();
    dataNight.wind_speed.from = Math.min(wind_speed[10], wind_speed[11], wind_speed[12], wind_speed[13]);
    dataNight.wind_speed.to = Math.max(wind_speed[10], wind_speed[11], wind_speed[12], wind_speed[13]);
    dataNight.wind_gust = Math.max(wind_speed[18], wind_speed[19], wind_speed[20], wind_speed[21]);
    dataNight.rainfall = fun_rainfall([rainfall[0], rainfall[1], rainfall[2], rainfall[3]]);
    if (amount_rainfall.length === 0)
      dataNight.amount_rainfall = 0
    else
      dataNight.amount_rainfall = amount_rainfall[0] + amount_rainfall[1] + amount_rainfall[2] + amount_rainfall[3];

    dataAll[i] = dataNight;

    await browser.close();// закрыть браузер
  }

  console.log(dataAll)






  // let request = require("request"),
  //   cheerio = require("cheerio"),
  //   url = urlNew;

  // request(url, function (error, response, body) {
  //   if (!error) {
  //     let $ = cheerio.load(body)
  //     let temperature = $(".unit_temperature_c").html();
  //     let num;

  //     if (temperature.indexOf("&#x2212;") != -1)
  //       num = -1 * parseInt(temperature.replace(/&#x2212;/, "-").replace(/\D+/g, ""));
  //     else num = parseInt(temperature.replace(/\D+/g, ""));

  //     console.log("Температура " + num + " градусов по Цельсию."); //Math.round(num/10)
  //   } else {
  //     console.log("Произошла ошибка: " + error);
  //   }
  // });
}

module.exports.getforecast = getforecast;
