#!/usr/bin/env node
// Keeps tweets.json up to date using the RSS feed provided by keep.md
import { readFile, writeFile } from 'fs/promises';

import log from 'npmlog';
import { XMLParser } from 'fast-xml-parser';

const FEED_URL = 'https://keep.md/api/x-rss/ForoysktDaily.xml?content=posts';
const TWEETS_FILE = new URL('./tweets.json', import.meta.url);

/**
 * Tweets are told apart by the last part of their link, i.e. the status ID.
 *
 * e.g. https://x.com/ForoysktDaily/status/2116228326910263800 -> 2116228326910263800
 *      https://nitter.poast.org/ForoysktDaily/status/1523668857990545408#m -> 1523668857990545408
 *
 * @param {string} link
 * @returns {string}
 */
function getTweetId(link) {
  return new URL(link).pathname.split('/').filter(Boolean).at(-1);
}

/**
 * Formats the date the way nitter did, e.g. "Jul 2, 2026 · 7:35 PM UTC"
 *
 * @param {string} pubDate e.g. "Thu, 02 Jul 2026 19:35:19 GMT"
 * @returns {string}
 */
function formatDate(pubDate) {
  const date = new Date(pubDate);
  const day = date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
  const time = date.toLocaleTimeString('en-US', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time} UTC`;
}

/**
 * @param {object} item RSS feed item
 * @returns {{link: string, date: string, content: string, image?: string, image_large?: string}}
 */
function itemToTweet(item) {
  const tweet = {
    link: item.link,
    date: formatDate(item.pubDate),
    content: String(item.description ?? '').trim(),
  };

  // e.g. <img src="https://pbs.twimg.com/media/HV5aTNpWoAAqqA8.png?name=orig" alt="">
  const image = String(item['content:encoded'] ?? '').match(/<img [^>]*src="([^"]+)"/)?.[1];

  if (image) {
    const url = new URL(image);
    url.searchParams.set('name', 'small');
    tweet.image = url.toString();

    url.searchParams.set('name', 'orig');
    tweet.image_large = url.toString();
  }

  return tweet;
}

async function fetchFeed() {
  log.info('Fetching', `<${FEED_URL}> ...`);
  const resp = await fetch(FEED_URL);

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} ${resp.statusText} when fetching ${FEED_URL}`);
  }

  const parser = new XMLParser({
    // keep "#123" and alike as strings
    parseTagValue: false,
    isArray: (name) => name === 'item',
  });

  const items = parser.parse(await resp.text()).rss?.channel?.item ?? [];
  log.info('Feed parsed', `found ${items.length} item(s)`);

  return items.map(itemToTweet);
}

(async () => {
  const tweets = JSON.parse(await readFile(TWEETS_FILE, 'utf-8'));
  log.info('Tweets', `${tweets.length} tweet(s) stored in tweets.json`);

  const knownIds = new Set(tweets.map(tweet => getTweetId(tweet.link)));
  const newTweets = (await fetchFeed()).filter(tweet => !knownIds.has(getTweetId(tweet.link)));

  if (newTweets.length === 0) {
    log.info('Done', 'No new tweets');
    return;
  }

  newTweets.forEach(tweet => log.info('New tweet', `[${tweet.date}] ${tweet.content.substring(0, 64)} ...`));

  // the feed lists the newest tweets first - put them on top of the already stored ones
  const allTweets = [...newTweets, ...tweets];

  log.info(`Saving ${allTweets.length} tweets ...`);
  await writeFile(TWEETS_FILE, JSON.stringify(allTweets, null, 2));
  log.info('Done', `${newTweets.length} new tweet(s) added`);
})().catch(err => {
  log.error('Failed', err.message);
  process.exitCode = 1;
});
