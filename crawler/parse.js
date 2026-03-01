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

module.exports = { parseBenefits };
