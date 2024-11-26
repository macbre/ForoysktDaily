#!/usr/bin/env node
import { createWriteStream } from 'fs';
import { setTimeout } from 'timers/promises';

import log from 'npmlog';
import puppeteer, {Page} from 'puppeteer';

const DOMAIN = 'https://nitter.poast.org';
// const url = `${DOMAIN}/ForoysktDaily`;
const url = `${DOMAIN}/ForoysktDaily/with_replies`;

log.info('Rendering', `<${url}> ...`);

/**
 * 
 * @param {Page} page 
 * @returns 
 */
async function getTweets(page) {
  log.info(`Querying for tweets on <${page.url()}> ...`);
  const tweets = (await page.evaluate(DOMAIN => {
    const nodes = Array.from(document.body.querySelectorAll('.timeline-item'));

    return nodes.map(node => {
      // skip the "Load newest" button timeline item
      if (node.classList.contains('show-more')) {
        return null;
      }

      const link = node.querySelector('.tweet-date a');

      // something is wrong ...
      if (!link) {
        console.error('Missing date link', node.outerHTML);
        return null;
      }

      const hasImage = !! node.querySelector('.still-image');

      return {
        link: DOMAIN + link.getAttribute('href'),
        date: link.getAttribute('title'), // e.g. Aug 13, 2024 · 10:28 PM UTC
        content: node.querySelector('.media-body').innerText,
        image: hasImage ? DOMAIN + node.querySelector('.still-image img')?.getAttribute('src') : undefined,
        image_large: hasImage ? DOMAIN + node.querySelector('.still-image')?.getAttribute('href') : undefined,
      };
    });
  }, DOMAIN)).filter(value => value);

  log.info(`Found ${tweets.length} tweet(s)`);
  return tweets;
}

(async () => {
  // we need to use headful mode
  // it will first load the page with HTTP 503 response, wait a bit and redirect to 200
  const browser = await puppeteer.launch({headless: false});
  const page = await browser.newPage();
  await page.setViewport({
    width: 640,
    height: 800,
  });

  page.on('requestfinished', (req) => {
    const url = req.url();
    if (!url.startsWith('data:')) {
      log.info('Response', `<${url}>`);
    }
  });

  page.on('console', msg => log.info('console.log', msg.text()));

  // https://pptr.dev/api/puppeteer.page.goto
  // first request is 503, but it verifies the client
  // subsequent request will give us 200
  await page.goto(url);
  await setTimeout(750);

  // load all subpages
  let all_tweets = [];

  const then = Date.now();
  await page.goto(url, {waitUntil: 'networkidle0'});
  const took = Date.now() - then;
  log.info(`Page loaded`, `in ${took} ms`);

  while(true) {
    const tweets = await getTweets(page);
    log.info('Page parsed', `found ${tweets.length} tweets`);

    // append tweets from the current page to the list all of that profile
    all_tweets = [...all_tweets, ...tweets];

    // no more tweets
    if (tweets.length < 1) {
      break;
    }

    // find the next page
    // https://pptr.dev/api/puppeteer.page._
    // e.g. <div class="show-more"><a href="?cursor=DAABCgABGc8Zjhs__-gKAAIYHyMxmpbRVwgAAwAAAAIAAA">Load more</a></div>
    // get the last node, on subpages we have buttons for newer and older posts
    const node = (await page.$$('.show-more a')).at(-1);

    if (!node) {
      log.info('Next page?', 'No');
      break;
    }

    await node.click();
    await page.waitForNavigation();
    await page.waitForNetworkIdle();
  }

  // store the all tweets
  log.info(`Saving ${all_tweets.length} tweets ...`);
  const file = createWriteStream('tweets.json');
  file.write(JSON.stringify(all_tweets, null, 2));
  file.end();

  await browser.close();
  log.info('Done');
})();
