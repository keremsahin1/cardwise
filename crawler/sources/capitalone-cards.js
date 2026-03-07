/**
 * Capital One Cards Crawler
 * Individual card pages load fine headlessly.
 * Extracts fixed benefits from all Capital One cards in DB.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const { neon } = require('../node_modules/@neondatabase/serverless');
const { parseFixedBenefits, parseProtections } = require('../parse');
const { upsertProtection } = require('../db');

const INDEX_URL = 'https://www.capitalone.com/credit-cards/';
const sql = neon(process.env.DATABASE_URL);

async function discoverCards(page) {
  console.log('  🔍 Discovering Capital One cards...');
  // Capital One catalog is JS-heavy, so we rely on our seeded URL list
  // but check the main page for any new cards via link scanning
  await page.goto(INDEX_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  for (let i = 0; i < 5; i++) { await page.keyboard.press('End'); await page.waitForTimeout(500); }
  await page.waitForTimeout(2000);

  const links = await page.locator('a[href]').all();
  const seen = new Set();
  const cards = [];
  const SKIP = /compare|preapprove|get-my-card|benefits|faq|fair-and-building|cash-back\/?$|travel-and-miles\/?$|students\/?$/;

  for (const l of links) {
    let href = (await l.getAttribute('href').catch(() => null));
    if (!href) continue;
    if (!href.startsWith('http')) href = 'https://www.capitalone.com' + href;
    href = href.split('?')[0];
    try {
      const url = new URL(href);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length === 2 && parts[0] === 'credit-cards' && !seen.has(href) && !SKIP.test(href)) {
        seen.add(href);
        const text = (await l.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
        cards.push({ name: text, url: href });
      }
    } catch (e) {}
  }

  console.log(`  Found ${cards.length} cards on index (plus ${(await sql`SELECT COUNT(*) as n FROM cards WHERE issuer = 'Capital One'`)[0].n} in DB)`);
  return cards;
}

async function extractAllBenefits(page) {
  const cards = await sql`
    SELECT id, name, benefits_url FROM cards
    WHERE issuer = 'Capital One' AND benefits_url IS NOT NULL
    ORDER BY name
  `;

  let total = 0;
  for (const card of cards) {
    console.log(`\n  📄 ${card.name}`);
    try {
      await page.goto(card.benefits_url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);
      const rawText = await page.locator('body').innerText().catch(() => '');
      if (rawText.length < 1000) { console.log(`    ⚠️  Page too short (${rawText.length}), skipping`); continue; }

      const benefits = await parseFixedBenefits(rawText, `Capital One credit card: ${card.name}`);
      if (!benefits.length) { console.log(`    ℹ️  No benefits extracted`); continue; }

      await sql`DELETE FROM card_benefits WHERE card_id = ${card.id} AND valid_from IS NULL AND valid_until IS NULL`;

      for (const b of benefits) {
        if (!b.category || b.rate == null) continue;
        await sql`INSERT INTO categories (name, icon) VALUES (${b.category}, '🏷️') ON CONFLICT (name) DO NOTHING`;
        const cats = await sql`SELECT id FROM categories WHERE name = ${b.category}`;
        if (!cats.length) continue;
        await sql`INSERT INTO card_benefits (card_id, category_id, rate, benefit_type, notes) VALUES (${card.id}, ${cats[0].id}, ${b.rate}, ${b.type ?? 'cashback'}, ${b.notes ?? null})`;
        console.log(`    ✓ ${b.category} @ ${b.rate}${b.type === 'cashback' ? '%' : 'x'}`);
        total++;
      }

      // Extract protections
      const protections = await parseProtections(rawText, `Capital One credit card: ${card.name}`);
      for (const p of protections) {
        if (!p.protectionType || !p.coverageDetails) continue;
        await upsertProtection({ cardId: card.id, protectionType: p.protectionType, coverageDetails: p.coverageDetails, notes: p.notes });
      }
    } catch (e) {
      console.log(`    ❌ ${e.message.slice(0, 80)}`);
    }
  }
  return total;
}

async function crawl(page) {
  console.log(`\n📋 Crawling all Capital One cards...`);
  await discoverCards(page);
  const total = await extractAllBenefits(page);
  console.log(`\n  → ${total} fixed benefits updated across all Capital One cards`);
  return total;
}

module.exports = { crawl };
