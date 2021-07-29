#!/usr/bin/env node
const puppeteer = require('puppeteer');

const path = require('path');
const fs = require('fs');

const dir = path.dirname(fs.realpathSync(__filename));
const url = 'file://' + dir + '/index.html';

console.log(`Rendering <${url}> ...`);

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({width: 1067, height: 600, deviceScaleFactor: 2});
  await page.goto(url, {waitUntil: 'networkidle2'});
  await new Promise(resolve => setTimeout(resolve, 5000));

  await page.screenshot({path: 'tweet.png'});

  await browser.close();
})();

console.log('Done');
