#!/usr/bin/env node
/**
 * CardWise Benefit Crawler
 * Scrapes card issuer pages and updates the benefits database.
 *
 * Usage:
 *   node crawler/crawl.js              # crawl all sources
 *   node crawler/crawl.js discover     # crawl specific source
 *   OPENAI_API_KEY=sk-... node crawler/crawl.js  # with LLM parsing
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const { chromium } = require('./node_modules/playwright-extra');
const StealthPlugin = require('./node_modules/puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const sources = {
  discover: require('./sources/discover'),
  'chase-cards': require('./sources/chase-cards'),
  'amex-cards': require('./sources/amex-cards'),       // requires headless:false
  'capitalone-cards': require('./sources/capitalone-cards'),
  'citi-cards': require('./sources/citi-cards'),
  'citi-custom-cash': require('./sources/citi-custom-cash'),
  'usbank-cash-plus': require('./sources/usbank-cash-plus'),
  'bofa-customized-cash': require('./sources/bofa-customized-cash'),
};

const LOG_FILE = require('path').join(__dirname, '..', 'crawler.log');
const fs = require('fs');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

async function run() {
  const target = process.argv[2]; // optional: run only one source
  const toRun = target ? { [target]: sources[target] } : sources;

  if (target && !sources[target]) {
    console.error(`Unknown source: ${target}. Available: ${Object.keys(sources).join(', ')}`);
    process.exit(1);
  }

  log(`Starting crawler (sources: ${Object.keys(toRun).join(', ')})`);

  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  let totalUpdated = 0;

  // Separate headful sources (Amex blocks headless) from headless ones
  const headfulSources = ['amex-cards'];
  const headlessSources = Object.entries(toRun).filter(([n]) => !headfulSources.includes(n));
  const headfulOnly = Object.entries(toRun).filter(([n]) => headfulSources.includes(n));

  async function runSources(entries, headless) {
    if (!entries.length) return;
    const browser = await chromium.launch({ headless, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    if (!headless) log('⚠️  Running in visible browser mode (required for Amex)');
    try {
      const context = await browser.newContext({ userAgent: UA });
      const page = await context.newPage();
      for (const [name, source] of entries) {
        try {
          log(`Running source: ${name}`);
          const count = await source.crawl(page);
          totalUpdated += count;
          log(`${name}: ${count} benefits updated`);
        } catch (err) {
          log(`❌ ${name} failed: ${err.message}`);
        }
        await page.waitForTimeout(1000);
      }
    } finally {
      await browser.close();
    }
  }

  await runSources(headlessSources, true);
  await runSources(headfulOnly, false);

  log(`✅ Crawler done. ${totalUpdated} benefits updated total.`);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
