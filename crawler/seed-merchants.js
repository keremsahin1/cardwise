/**
 * Seed a comprehensive merchant list using GPT-4o-mini.
 * Generates ~300 popular US merchants with correct category mappings.
 * Run: node crawler/seed-merchants.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { neon } = require('./node_modules/@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

// Canonical categories (must match what's in DB)
const CATEGORIES = [
  'Dining & Restaurants',
  'Groceries',
  'Gas & EV Charging',
  'Travel',
  'Hotels',
  'Online Shopping',
  'Streaming Services',
  'Transit',
  'Wholesale Clubs',
  'Drugstores & Pharmacy',
  'Home Improvement',
  'Department Stores',
  'Fitness & Gym',
  'Entertainment',
  'General / Everything Else',
];

async function askGPT(prompt) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await resp.json();
  return data.choices[0].message.content.trim();
}

// Split into two batches to avoid token cutoff
const BATCH1 = ['Dining & Restaurants', 'Groceries', 'Gas & EV Charging', 'Wholesale Clubs', 'Drugstores & Pharmacy', 'Home Improvement', 'Department Stores'];
const BATCH2 = ['Travel', 'Hotels', 'Online Shopping', 'Streaming Services', 'Transit', 'Fitness & Gym', 'Entertainment', 'General / Everything Else'];

async function generateMerchants() {
  const all = [];
  for (const [i, batch] of [[1, BATCH1], [2, BATCH2]]) {
    console.log(`🤖 Batch ${i}/2...`);
    const raw = await askGPT(`List the 20-25 most popular US merchants/brands for each of these categories.
Categories: ${batch.join(', ')}
Rules:
- Well-known US chains, stores, apps, services only
- For Transit: Uber, Lyft, parking/toll apps
- For Entertainment: cinemas, theme parks, ticketing
- For Fitness & Gym: gym chains, fitness apps, sporting goods
- Return ONLY valid JSON array, no markdown:
[{"name":"Starbucks","category":"Dining & Restaurants"},...]`);

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    console.log(`  Got ${parsed.length} merchants`);
    all.push(...parsed);
  }
  return all;
}

async function seedMerchants(merchants) {
  // Get category map
  const cats = await sql`SELECT id, name FROM categories`;
  const catMap = Object.fromEntries(cats.map(c => [c.name, c.id]));

  // Get existing merchant names
  const existing = await sql`SELECT LOWER(name) as name FROM merchants`;
  const existingSet = new Set(existing.map(r => r.name));

  let added = 0, skipped = 0, badCat = 0;

  for (const m of merchants) {
    if (!m.name || !m.category) { skipped++; continue; }
    if (existingSet.has(m.name.toLowerCase())) { skipped++; continue; }

    const catId = catMap[m.category];
    if (!catId) { console.log(`  ⚠️  Unknown category: ${m.category} (${m.name})`); badCat++; continue; }

    await sql`INSERT INTO merchants (name, category_id) SELECT ${m.name}, ${catId} WHERE NOT EXISTS (SELECT 1 FROM merchants WHERE LOWER(name) = LOWER(${m.name}))`;
    existingSet.add(m.name.toLowerCase());
    added++;
  }

  return { added, skipped, badCat };
}

(async () => {
  const merchants = await generateMerchants();
  console.log('\n📦 Seeding into DB...');
  const { added, skipped, badCat } = await seedMerchants(merchants);
  console.log(`✅ Done: ${added} added, ${skipped} already existed, ${badCat} bad categories`);

  // Print summary
  const summary = await sql`
    SELECT c.name, COUNT(m.id) as n
    FROM categories c LEFT JOIN merchants m ON m.category_id = c.id
    GROUP BY c.name ORDER BY n DESC
  `;
  console.log('\nMerchants per category:');
  summary.forEach(r => console.log(`  ${r.name}: ${r.n}`));
  const total = await sql`SELECT COUNT(*) as n FROM merchants`;
  console.log(`\nTotal: ${total[0].n} merchants`);
})().catch(e => { console.error(e.message); process.exit(1); });
