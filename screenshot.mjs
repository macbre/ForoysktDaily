#!/usr/bin/env node
import puppeteer from 'puppeteer';

import path from 'path';
import fs from 'fs/promises';
import log from 'npmlog';

import imagemin from 'imagemin';
import imageminPngquant from 'imagemin-pngquant';

import {setTimeout} from "timers/promises";

// get this directory
import {fileURLToPath} from 'url';
const __filename = fileURLToPath(import.meta.url);

const dir = path.dirname(await fs.realpath(__filename));
const url = 'file://' + dir + '/index.html';

log.info('Rendering', `<${url}> ...`);

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('requestfinished', (req) => {
    log.info('Response', `<${req.url()}>`);
  });

  const then = Date.now();
  await page.goto(url, {waitUntil: 'networkidle0'});
  const took = Date.now() - then;

  log.info(`Page loaded`, `in ${took} ms`);
  // await new Promise(resolve => setTimeout(resolve, 5000));

  const topic = await page.evaluate(() => {
    return document.querySelector('em').textContent;
  });
  log.info('This tweet is about:', topic);

  log.info('Taking a screenshot for Twitter');
  await page.setViewport({width: 1067, height: 600, deviceScaleFactor: 2});
  await page.screenshot({path: 'tweet.png'});

  // ~~ Instagram landscape photo: 1080 x 608 px (1.91:1 ratio) ~~
  // At a standard width of 1080 pixels, Instagram keeps your photo its original size
  log.info('Taking a screenshot for Instagram');
  await page.evaluate(() => {
    document.body.classList.add('instagram');
    document.body.querySelector('article').classList.remove('up');
  });
  await page.setViewport({width: 1080, height: 1080, deviceScaleFactor: 2});
  await setTimeout(1000); // give some non-Latin fonts a chance to load
  await page.screenshot({path: 'instagram.jpg'});

  // optimize the PNG file
  log.info('imagemin', 'Optimizing tweet.png ...');

  await imagemin(['tweet.png'], {
      destination: 'build/',
      plugins: [
          imageminPngquant({
              quality: [0.6, 0.8]
          })
      ]
  });

  await fs.rm('tweet.png');
  await fs.rename('build/tweet.png', 'tweet.png');

  await browser.close();
  log.info('Done');
})();
