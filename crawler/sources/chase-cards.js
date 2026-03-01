/**
 * Chase Cards Crawler
 * 1. Discovers all Chase cards + URLs from the official index page
 * 2. Syncs URLs to DB
 * 3. Visits each card page and extracts fixed benefits via LLM
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const { neon } = require('../node_modules/@neondatabase/serverless');
const { parseFixedBenefits } = require('../parse');

const INDEX_URL = 'https://creditcards.chase.com/all-credit-cards';
const sql = neon(process.env.DATABASE_URL);

/**
 * Step 1: Scrape index page → { name, url }[]
 */
async function discoverCards(page) {
  console.log('  🔍 Discovering Chase cards from index...');
  await page.goto(INDEX_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  return await page.evaluate(() => {
    const results = [];
    const seen = new Set();
    document.querySelectorAll('a[href]').forEach(a => {
      const url = a.href.split('?')[0];
      const name = a.innerText?.trim().replace(/[®℠™\n]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!name || name.length < 5 || name.length > 100) return;
      if (seen.has(url)) return;
      if (!url.includes('creditcards.chase.com')) return;
      const parts = new URL(url).pathname.split('/').filter(Boolean);
      if (parts.length < 2) return;
      if (/check-for|refer|sitemap|card-finder|compare|#/.test(url)) return;
      // Skip category/listing pages (exactly 1 segment like /cash-back-credit-cards)
      const categoryPrefixes = ['all-credit', 'newest', 'no-annual', 'airline', 'hotel', 'dining', '0-intro', 'visa-credit', 'mastercard', 'new-to', 'no-foreign', 'emv', 'balance-transfer'];
      if (parts.length === 1 && categoryPrefixes.some(p => parts[0].startsWith(p))) return;
      if (/^(Links to product page|Opens|Compare|Check|Refer|Skip|Close)/.test(name)) return;
      seen.add(url);
      results.push({ name, url });
    });
    return results;
  });
}

/**
 * Step 2: Match discovered cards to DB entries by URL and update
 */
async function syncUrls(discovered) {
  let synced = 0;
  for (const { url } of discovered) {
    const rows = await sql`SELECT id FROM cards WHERE benefits_url = ${url}`;
    if (rows.length === 0) {
      // Try to match by name similarity
    } else {
      synced++;
    }
  }
  return synced;
}

/**
 * Step 3: For all Chase cards in DB with a benefits_url, extract fixed benefits
 */
async function extractAllBenefits(page) {
  const cards = await sql`
    SELECT id, name, benefits_url FROM cards
    WHERE issuer = 'Chase' AND benefits_url IS NOT NULL
    ORDER BY name
  `;

  let total = 0;
  for (const card of cards) {
    // Skip rotating-category cards — handled by discover.js / chase-freedom-flex.js
    if (/Freedom Flex/i.test(card.name)) {
      console.log(`  ⏭️  ${card.name} — skipping (rotating, handled separately)`);
      continue;
    }

    console.log(`\n  📄 ${card.name}`);
    try {
      await page.goto(card.benefits_url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      const rawText = await page.evaluate(() => document.body.innerText);

      const benefits = await parseFixedBenefits(rawText, `Chase credit card: ${card.name}`);
      if (!benefits.length) { console.log(`    ℹ️  No benefits extracted`); continue; }

      // Clear old fixed benefits for this card before reinserting
      await sql`DELETE FROM card_benefits WHERE card_id = ${card.id} AND valid_from IS NULL AND valid_until IS NULL`;

      for (const b of benefits) {
        if (!b.category || b.rate == null) continue;
        await sql`INSERT INTO categories (name, icon) VALUES (${b.category}, '🏷️') ON CONFLICT (name) DO NOTHING`;
        const cats = await sql`SELECT id FROM categories WHERE name = ${b.category}`;
        if (!cats.length) continue;
        await sql`
          INSERT INTO card_benefits (card_id, category_id, rate, benefit_type, notes)
          VALUES (${card.id}, ${cats[0].id}, ${b.rate}, ${b.type ?? 'points'}, ${b.notes ?? null})
        `;
        console.log(`    ✓ ${b.category} @ ${b.rate}${b.type === 'cashback' ? '%' : 'x'}`);
        total++;
      }
    } catch (e) {
      console.log(`    ❌ Failed: ${e.message.slice(0, 80)}`);
    }
  }
  return total;
}

async function crawl(page) {
  console.log(`\n📋 Crawling all Chase cards...`);

  // Step 1: Discover from index
  const discovered = await discoverCards(page);
  console.log(`  Found ${discovered.length} cards on Chase index`);

  // Step 2: Update any URL changes
  await syncUrls(discovered);

  // Step 3: Extract benefits for all Chase cards in DB
  const benefitsUpdated = await extractAllBenefits(page);
  console.log(`\n  → ${benefitsUpdated} fixed benefits updated across all Chase cards`);
  return benefitsUpdated;
}

module.exports = { crawl };
