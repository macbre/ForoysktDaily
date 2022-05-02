#!/usr/bin/env node
const puppeteer = require('puppeteer');

const path = require('path');
const fs = require('fs');
const log = require('npmlog');

const dir = path.dirname(fs.realpathSync(__filename));
const url = 'file://' + dir + '/index.html';

log.info('Rendering', `<${url}> ...`);

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('requestfinished', (req) => {
    log.info('Response', `<${req.url()}>`);
  });

  await page.setViewport({width: 1067, height: 600, deviceScaleFactor: 2});

  const then = Date.now();
  await page.goto(url, {waitUntil: 'networkidle0'});
  const took = Date.now() - then;

  log.info(`Page loaded`, `in ${took} ms`);
  // await new Promise(resolve => setTimeout(resolve, 5000));

  log.info('Taking a screenshot');
  await page.screenshot({path: 'tweet.png'});

  await browser.close();
  log.info('Done');
})();
