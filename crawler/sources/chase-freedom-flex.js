/**
 * Chase Freedom Flex — 5% rotating categories
 * Source: https://www.chase.com/personal/credit-cards/freedom/flex
 */
const { upsertRotatingBenefit } = require('../db');
const { parseBenefits } = require('../parse');

const URL = 'https://www.chase.com/personal/credit-cards/freedom/flex';
const CARD_NAME = 'Chase Freedom Flex';
const RATE = 5;
const SPEND_CAP = 1500;
const CAP_PERIOD = 'quarter';

// Category normalization (same as Discover)
const CATEGORY_MAP = {
  'grocery': 'Groceries',
  'wholesale': 'Wholesale Clubs',
  'streaming': 'Streaming Services',
  'dining': 'Dining & Restaurants',
  'restaurant': 'Dining & Restaurants',
  'home improvement': 'Home Improvement',
  'gas': 'Gas & EV Charging',
  'amazon': 'Amazon',
  'paypal': 'PayPal',
  'fitness': 'Fitness Clubs',
  'drugstore': 'Drugstores & Pharmacy',
  'drug store': 'Drugstores & Pharmacy',
  'department store': 'Department Stores',
  'norwegian cruise': 'Travel',
  'select hotels': 'Hotels',
  'ev charging': 'Gas & EV Charging',
  'travel': 'Travel',
};

function normalizeCategory(raw) {
  const lower = raw.toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return raw.replace(/\b\w/g, c => c.toUpperCase());
}

// Parse Chase page text.
// Key pattern: "Activate now and earn 5% cash back from January 1, 2026 through March 31, 2026 on up to $1,500..."
// Then category lines follow
function parseText(text) {
  const results = [];

  // Extract the active quarter date range
  const datePattern = /earn 5% cash back from (\w+ \d+, \d{4}) through (\w+ \d+, \d{4})/i;
  const dateMatch = text.match(datePattern);
  if (!dateMatch) return results;

  const validFrom = new Date(dateMatch[1]).toISOString().split('T')[0];
  const validUntil = new Date(dateMatch[2]).toISOString().split('T')[0];

  // Categories appear as short lines right after "Activate Now"
  // ending at the first "Get 5%" descriptive line
  const blockMatch = text.match(/Activate Now\r?\n([\s\S]+?)(?:Get 5%|HERE'S HOW|JUST A FEW MORE)/i);
  if (!blockMatch) return results;

  const block = blockMatch[1];
  const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // UI/junk lines to skip
  const SKIP = /footnote|opens overlay|see details|what you need|get 5%|this category|purchases made|activate|earn|enjoy|redeem|rewards|here'?s how|just a few|things about|freedom|credit card|apply|sign in|for freedom|remind you|retroactively|simple\.|heart association/i;

  for (const line of lines) {
    if (line.length > 50) continue;       // skip long descriptive lines
    if (line.length < 3) continue;        // skip noise
    if (/^\d+$/.test(line)) continue;     // skip numbers
    if (/^[,\s]/.test(line)) continue;    // skip lines starting with comma/space
    if (SKIP.test(line)) continue;

    const category = normalizeCategory(line.replace(/[®™]/g, '').trim());
    if (category) {
      results.push({ category, validFrom, validUntil, notes: `Chase Freedom Flex 5% rotating: ${line}` });
    }
  }

  return results;
}

async function crawl(page) {
  console.log(`\n📋 Crawling Chase Freedom Flex rotating categories...`);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const rawText = await page.evaluate(() => document.body.innerText);
  let benefits = parseText(rawText);

  if (benefits.length === 0) {
    console.log('  DOM parsing found nothing, trying LLM...');
    const parsed = await parseBenefits(rawText, 'Chase Freedom Flex 5% rotating quarterly bonus categories');
    if (parsed && parsed.length > 0) benefits = parsed;
    else {
      console.warn('  ⚠️  Could not extract Chase Freedom Flex categories.');
      return 0;
    }
  }

  const seen = new Set();
  let count = 0;
  for (const b of benefits) {
    const key = `${b.category}|${b.validFrom}`;
    if (seen.has(key)) continue;
    seen.add(key);

    upsertRotatingBenefit({
      cardName: CARD_NAME,
      categoryName: b.category,
      rate: RATE,
      validFrom: b.validFrom,
      validUntil: b.validUntil,
      notes: b.notes,
      requiresActivation: true,
      spendCap: SPEND_CAP,
      capPeriod: CAP_PERIOD,
    });
    count++;
  }

  console.log(`  → ${count} Chase Freedom Flex benefits updated`);
  return count;
}

module.exports = { crawl };
