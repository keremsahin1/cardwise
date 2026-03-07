/**
 * Benefit parser — LLM-based if OPENAI_API_KEY is set, DOM-based fallback otherwise.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Parse raw page text into structured rotating benefits.
 * Returns array of: { category, validFrom, validUntil, notes }
 */
async function parseBenefits(rawText, context) {
  if (OPENAI_API_KEY) {
    return parseBenefitsLLM(rawText, context);
  }
  console.log('  ℹ️  No OPENAI_API_KEY — using DOM extraction (set key for smarter parsing)');
  return null; // caller falls back to DOM extraction
}

/**
 * Parse raw page text into structured FIXED (non-rotating) benefits.
 * Returns array of: { category, rate, type, notes }
 */
async function parseFixedBenefits(rawText, context) {
  if (!OPENAI_API_KEY) {
    console.log('  ℹ️  No OPENAI_API_KEY — skipping fixed benefit extraction');
    return [];
  }

  const prompt = `You are extracting credit card reward rates from an official card product page.

Context: ${context}

Page content:
${rawText.slice(0, 6000)}

Extract all FIXED (non-rotating, always-on) reward rates per spend category.
Do NOT include rotating/quarterly bonus categories or sign-up bonuses.

For each benefit, return JSON with:
- category: one of: "Groceries", "Dining & Restaurants", "Gas & EV Charging", "Online Shopping", "Travel", "Hotels", "Streaming Services", "Drugstores & Pharmacy", "Wholesale Clubs", "Home Improvement", "Amazon", "General / Everything Else"
- rate: number (e.g. 3 for 3x points or 3% cashback)
- type: "cashback" or "points"
- notes: string or null

Return ONLY a JSON array, no explanation. Example:
[{"category":"Dining & Restaurants","rate":3,"type":"points","notes":"3x on dining worldwide"},{"category":"General / Everything Else","rate":1,"type":"points","notes":null}]`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0 }),
  });

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '[]';
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    console.warn('  ⚠️  LLM returned unparseable JSON');
    return [];
  }
}

async function parseBenefitsLLM(rawText, context) {
  const prompt = `You are extracting credit card rotating cashback benefit data from a webpage.

Context: ${context}

Page content (may be partial):
${rawText.slice(0, 6000)}

Extract all rotating cashback categories. For each, return JSON with:
- category: string (e.g. "Groceries", "Gas & EV Charging", "Online Shopping", "Restaurants")
- validFrom: "YYYY-MM-DD" (quarter start date)
- validUntil: "YYYY-MM-DD" (quarter end date)
- notes: string or null (any extra context)

Return ONLY a JSON array, no explanation. Example:
[{"category":"Groceries","validFrom":"2025-01-01","validUntil":"2025-03-31","notes":null}]`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    }),
  });

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '[]';
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    console.warn('  ⚠️  LLM returned unparseable JSON:', text.slice(0, 200));
    return [];
  }
}

/**
 * Parse raw page text to extract card protection benefits.
 * Returns array of: { protectionType, coverageDetails, notes }
 */
async function parseProtections(rawText, context) {
  if (!OPENAI_API_KEY) {
    console.log('  ℹ️  No OPENAI_API_KEY — skipping protection extraction');
    return [];
  }

  const prompt = `You are extracting card protection benefits from an official credit card product page.

Context: ${context}

Page content:
${rawText.slice(0, 12000)}

Extract ONLY these two protection types if present:
1. Car rental insurance / auto rental collision damage waiver (CDW)
2. Extended warranty protection

For each protection found, return JSON with:
- protectionType: "car_rental_insurance" or "extended_warranty"
- coverageDetails: string describing the coverage. IMPORTANT: always start with "Primary coverage" or "Secondary coverage" based on the text. If the page says coverage applies without needing your own personal auto insurance first, it's primary. If it says coverage kicks in after your own insurance, it's secondary. If the page doesn't specify, use context clues (premium travel cards like Sapphire Reserve are typically primary). Always include coverage limits if mentioned (e.g. "Primary coverage up to $75,000").
- notes: string with any important conditions/caveats, or null (e.g. "Must decline rental company CDW", "Original warranty must be 3 years or less")

Return ONLY a JSON array, no explanation. If neither protection is found, return [].
Example:
[{"protectionType":"car_rental_insurance","coverageDetails":"Primary coverage up to $75,000","notes":"Must decline the rental company's collision damage waiver"},{"protectionType":"extended_warranty","coverageDetails":"Extends manufacturer warranty by 1 additional year","notes":"Original warranty must be 3 years or less. Max $10,000 per claim."}]`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0 }),
  });

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '[]';
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    console.warn('  ⚠️  LLM returned unparseable JSON for protections');
    return [];
  }
}

module.exports = { parseBenefits, parseFixedBenefits, parseProtections };
