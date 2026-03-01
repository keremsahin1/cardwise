/**
 * Crawler DB helpers — read/write card benefits into data.db
 */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data.db');

let db;
function getDb() {
  if (!db) db = new Database(DB_PATH);
  return db;
}

function getCardId(name) {
  const row = getDb().prepare('SELECT id FROM cards WHERE name = ?').get(name);
  return row?.id ?? null;
}

function getCategoryId(name) {
  const row = getDb().prepare('SELECT id FROM categories WHERE name = ?').get(name);
  return row?.id ?? null;
}

/**
 * Upsert a rotating benefit.
 * Deactivates old records for the same card+category quarter before inserting.
 */
function upsertRotatingBenefit({ cardName, categoryName, rate, validFrom, validUntil, notes, requiresActivation, spendCap, capPeriod }) {
  const db = getDb();
  const cardId = getCardId(cardName);
  const categoryId = getCategoryId(categoryName);

  if (!cardId) { console.warn(`  ⚠️  Card not found: ${cardName}`); return; }
  if (!categoryId) {
    // Auto-create unknown categories
    db.prepare('INSERT OR IGNORE INTO categories (name, icon) VALUES (?, ?)').run(categoryName, '🏷️');
    const newCat = db.prepare('SELECT id FROM categories WHERE name = ?').get(categoryName);
    if (!newCat) { console.warn(`  ⚠️  Could not create category: ${categoryName}`); return; }
  }

  const catId = getCategoryId(categoryName);

  // Remove old rotating benefit for same card+category+period to avoid duplicates
  db.prepare(`
    DELETE FROM card_benefits
    WHERE card_id = ? AND category_id = ? AND valid_from = ? AND valid_until = ?
  `).run(cardId, catId, validFrom, validUntil);

  db.prepare(`
    INSERT INTO card_benefits
      (card_id, category_id, rate, benefit_type, spend_cap, cap_period, notes, valid_from, valid_until, requires_activation)
    VALUES (?, ?, ?, 'cashback', ?, ?, ?, ?, ?, ?)
  `).run(cardId, catId, rate, spendCap ?? null, capPeriod ?? null, notes ?? null, validFrom ?? null, validUntil ?? null, requiresActivation ? 1 : 0);

  console.log(`  ✓ ${cardName} → ${categoryName} @ ${rate}% (${validFrom} – ${validUntil})`);
}

module.exports = { getDb, getCardId, getCategoryId, upsertRotatingBenefit };
