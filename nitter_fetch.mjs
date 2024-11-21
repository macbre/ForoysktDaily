#!/usr/bin/env node
import puppeteer from 'puppeteer';
import log from 'npmlog';

import { setTimeout } from 'timers/promises';

const url = 'https://nitter.poast.org/ForoysktDaily';

log.info('Rendering', `<${url}> ...`);

(async () => {
  // we need to use headful mode
  // it will first load the page with HTTP 503 response, wait a bit and redirect to 200
  const browser = await puppeteer.launch({headless: false});
  const page = await browser.newPage();

  page.on('requestfinished', (req) => {
    const url = req.url();
    if (!url.startsWith('data:')) {
      log.info('Response', `<${url}>`);
    }
  });

  page.on('console', msg => log.info('log: ', msg.text()));

  // https://pptr.dev/api/puppeteer.page.goto
  const then = Date.now();

  // first request is 503, but it verifies the client
  await page.goto(url);
  await setTimeout(750);

  // now we get HTTP 200
  await page.goto(url, {waitUntil: 'networkidle0'});
  const took = Date.now() - then;

  log.info(`Page loaded`, `in ${took} ms`);
  // await new Promise(resolve => setTimeout(resolve, 5000));

  log.info('Taking a screenshot ...');
  await page.setViewport({width: 1024, height: 8000, deviceScaleFactor: 2});
  await page.screenshot({path: 'nitter.jpg', quality: 92});

  await browser.close();
  log.info('Done');
})();
