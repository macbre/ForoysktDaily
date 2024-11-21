#!/usr/bin/env node
import { createWriteStream } from 'fs';
import { setTimeout } from 'timers/promises';

import log from 'npmlog';
import puppeteer, {Page} from 'puppeteer';

const DOMAIN = 'https://nitter.poast.org';
const url = `${DOMAIN}/ForoysktDaily`;

log.info('Rendering', `<${url}> ...`);

/**
 * 
 * @param {Page} page 
 * @returns 
 */
async function getTweets(page) {
  log.info(`Querying for tweets on <${page.url()}> ...`);
  const bodyHandle = await page.$('body');
  const tweets = await page.evaluate((body, DOMAIN) => {
    const nodes = Array.from(document.body.querySelectorAll('.timeline-item'));

    return nodes.map(node => {
      const link = node.querySelector('.tweet-date a');

      return {
        link: DOMAIN + link.getAttribute('href'),
        date: link.getAttribute('title'), // e.g. Aug 13, 2024 · 10:28 PM UTC
        content: node.querySelector('.media-body').innerText,
        image: DOMAIN + node.querySelector('.still-image img')?.getAttribute('src'),
        image_large: DOMAIN + node.querySelector('.still-image')?.getAttribute('href'),
      };
    });
  }, bodyHandle, DOMAIN);
  await bodyHandle.dispose();

  log.info(`Found ${tweets.length} tweet(s)`);
  return tweets;
}

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
  // TODO: load next subpages
  await page.goto(url, {waitUntil: 'networkidle0'});
  const took = Date.now() - then;

  log.info(`Page loaded`, `in ${took} ms`);
  // await new Promise(resolve => setTimeout(resolve, 5000));
  const tweets = await getTweets(page);
  console.log(tweets);

  // store the tweets
  log.info(`Saving ${tweets.length} tweets ...`);
  const file = createWriteStream('tweets.json');
  file.write(JSON.stringify(tweets, null, 2));
  file.end();

  //log.info('Taking a screenshot ...');
  //await page.setViewport({width: 1024, height: 8000, deviceScaleFactor: 2});
  //await page.screenshot({path: 'nitter.webp', quality: 90});

  await browser.close();
  log.info('Done');
})();
