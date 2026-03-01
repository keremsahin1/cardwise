/**
 * American Express Cards Crawler
 * Uses headless: false — Amex blocks headless browsers even with stealth.
 * Discovers all cards from americanexpress.com/us/credit-cards/all/
 * then extracts fixed benefits from each card page.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const { neon } = require('../node_modules/@neondatabase/serverless');
const { parseFixedBenefits } = require('../parse');

const INDEX_URL = 'https://www.americanexpress.com/us/credit-cards/all/';
const sql = neon(process.env.DATABASE_URL);

async function discoverCards(page) {
  console.log('  🔍 Discovering Amex cards...');
  await page.goto(INDEX_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const links = await page.locator('a[href*="/us/credit-cards/card/"]').all();
  const seen = new Set();
  const cards = [];
  for (const l of links) {
    const href = (await l.getAttribute('href').catch(() => null))?.split('?')[0];
    const text = (await l.innerText().catch(() => '')).replace(/[®℠™\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (href && !seen.has(href)) {
      seen.add(href);
      const full = href.startsWith('http') ? href : 'https://www.americanexpress.com' + href;
      cards.push({ name: text, url: full });
    }
  }
  console.log(`  Found ${cards.length} Amex cards`);
  return cards;
}

async function syncUrls(discovered) {
  for (const { name, url } of discovered) {
    // Match by URL first, then try name
    const byUrl = await sql`SELECT id FROM cards WHERE benefits_url = ${url}`;
    if (byUrl.length > 0) continue;
    // Try fuzzy name match — strip special chars
    const slug = url.split('/card/')[1]?.replace(/\/$/, '') ?? '';
    await sql`UPDATE cards SET benefits_url = ${url} WHERE benefits_url IS NULL AND issuer = 'American Express' AND LOWER(REPLACE(name,' ','-')) LIKE ${'%' + slug.slice(0,10) + '%'}`;
  }
}

async function extractAllBenefits(page) {
  const cards = await sql`
    SELECT id, name, benefits_url FROM cards
    WHERE issuer = 'American Express' AND benefits_url IS NOT NULL
    ORDER BY name
  `;

  let total = 0;
  for (const card of cards) {
    console.log(`\n  📄 ${card.name}`);
    try {
      await page.goto(card.benefits_url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      const rawText = await page.locator('body').innerText().catch(() => '');
      if (rawText.length < 500) { console.log(`    ⚠️  Page too short (${rawText.length}), skipping`); continue; }

      const benefits = await parseFixedBenefits(rawText, `American Express credit card: ${card.name}`);
      if (!benefits.length) { console.log(`    ℹ️  No benefits extracted`); continue; }

      await sql`DELETE FROM card_benefits WHERE card_id = ${card.id} AND valid_from IS NULL AND valid_until IS NULL`;

      for (const b of benefits) {
        if (!b.category || b.rate == null) continue;
        await sql`INSERT INTO categories (name, icon) VALUES (${b.category}, '🏷️') ON CONFLICT (name) DO NOTHING`;
        const cats = await sql`SELECT id FROM categories WHERE name = ${b.category}`;
        if (!cats.length) continue;
        await sql`INSERT INTO card_benefits (card_id, category_id, rate, benefit_type, notes) VALUES (${card.id}, ${cats[0].id}, ${b.rate}, ${b.type ?? 'points'}, ${b.notes ?? null})`;
        console.log(`    ✓ ${b.category} @ ${b.rate}${b.type === 'cashback' ? '%' : 'x'}`);
        total++;
      }
    } catch (e) {
      console.log(`    ❌ ${e.message.slice(0, 80)}`);
    }
  }
  return total;
}

async function crawl(page) {
  console.log(`\n📋 Crawling all Amex cards (non-headless required)...`);
  const discovered = await discoverCards(page);
  await syncUrls(discovered);
  const total = await extractAllBenefits(page);
  console.log(`\n  → ${total} fixed benefits updated across all Amex cards`);
  return total;
}

module.exports = { crawl };
