/**
 * Discover it Cash Back — 5% rotating categories
 * Source: https://www.discover.com/credit-cards/cash-back/cashback-calendar.html
 */
const { upsertRotatingBenefit } = require('../db');
const { parseBenefits } = require('../parse');

const URL = 'https://www.discover.com/credit-cards/cash-back/cashback-calendar.html';
const CARD_NAME = 'Discover it Cash Back';
const RATE = 5;
const SPEND_CAP = 1500;
const CAP_PERIOD = 'quarter';

// Parse Discover's calendar from page text.
// Format on page:
//   "January to March 2026\nJan-Mar\nGrocery Stores, Wholesale Clubs...\n"
function parseText(text) {
  const results = [];

  // Match quarter blocks: "Month to Month YEAR\n...\nCategory text\n"
  const quarterPattern = /(January|April|July|October) to (March|June|September|December) (\d{4})\n[A-Za-z-]+\n([^\n]+)\n/g;
  let match;

  const monthToDate = {
    January:   { start: '01-01', end: '03-31' },
    April:     { start: '04-01', end: '06-30' },
    July:      { start: '07-01', end: '09-30' },
    October:   { start: '10-01', end: '12-31' },
  };

  while ((match = quarterPattern.exec(text)) !== null) {
    const startMonth = match[1];
    const year = match[3];
    const categoryLine = match[4].trim();

    // Skip "Coming Soon" entries
    if (categoryLine.toLowerCase().includes('coming soon') || categoryLine.toLowerCase().includes('announcing')) continue;

    const dates = monthToDate[startMonth];
    if (!dates) continue;

    // Split compound categories like "Grocery Stores, Wholesale Clubs, and Select Streaming Services"
    const categories = splitCategories(categoryLine);
    for (const category of categories) {
      results.push({
        category,
        validFrom: `${year}-${dates.start}`,
        validUntil: `${year}-${dates.end}`,
        notes: `Discover 5% rotating: ${categoryLine}`,
      });
    }
  }

  return results;
}

// Split "Grocery Stores, Wholesale Clubs, and Select Streaming Services" into normalized categories
function splitCategories(raw) {
  // Split on commas and " and "
  return raw
    .split(/,\s*(?:and\s+)?|\s+and\s+/)
    .map(s => normalizeCategory(s.trim()))
    .filter(Boolean);
}

// Map Discover's verbose names to our DB category names
const CATEGORY_MAP = {
  'grocery stores': 'Groceries',
  'groceries': 'Groceries',
  'wholesale clubs': 'Wholesale Clubs',
  'select streaming services': 'Streaming Services',
  'streaming services': 'Streaming Services',
  'restaurants': 'Dining & Restaurants',
  'home improvement stores': 'Home Improvement',
  'home improvement': 'Home Improvement',
  'gas stations': 'Gas & EV Charging',
  'gas': 'Gas & EV Charging',
  'amazon': 'Amazon',
  'amazon.com': 'Amazon',
  'paypal': 'PayPal',
  'target': 'Online Shopping',
  'walmart': 'Groceries',
  'fitness clubs': 'Fitness Clubs',
  'gym memberships': 'Fitness Clubs',
  'drugstores': 'Drugstores & Pharmacy',
  'department stores': 'Department Stores',
};

function normalizeCategory(raw) {
  const lower = raw.toLowerCase().replace(/^select\s+/, '');
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  // Return title-cased original if no match (will auto-create in DB)
  return raw.replace(/\b\w/g, c => c.toUpperCase());
}

async function crawl(page) {
  console.log(`\n📋 Crawling Discover 5% Calendar...`);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const rawText = await page.evaluate(() => document.body.innerText);
  let benefits = parseText(rawText);

  // Fall back to LLM if DOM parsing got nothing
  if (benefits.length === 0) {
    console.log('  DOM parsing found nothing, trying LLM...');
    const parsed = await parseBenefits(rawText, 'Discover it Cash Back 5% rotating cashback calendar');
    if (parsed && parsed.length > 0) benefits = parsed;
    else {
      console.warn('  ⚠️  Could not extract Discover categories.');
      return 0;
    }
  }

  // Deduplicate by category+quarter
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

  console.log(`  → ${count} Discover benefits updated`);
  return count;
}

module.exports = { crawl };
