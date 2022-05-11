#!/usr/bin/env node
import puppeteer from 'puppeteer';

import path from 'path';
import fs from 'fs/promises';
import log from 'npmlog';

import imagemin from 'imagemin';
import imageminPngquant from 'imagemin-pngquant';

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

  await page.setViewport({width: 1067, height: 600, deviceScaleFactor: 2});

  const then = Date.now();
  await page.goto(url, {waitUntil: 'networkidle0'});
  const took = Date.now() - then;

  log.info(`Page loaded`, `in ${took} ms`);
  // await new Promise(resolve => setTimeout(resolve, 5000));

  log.info('Taking a screenshot');
  await page.screenshot({path: 'tweet.png'});

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
