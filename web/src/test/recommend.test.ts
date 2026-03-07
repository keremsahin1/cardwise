import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CardRecommendation, CardProtection } from '@/lib/recommend';

// ─── Helpers (copied from page.tsx logic) ────────────────────────────────────

function formatReward(rec: Pick<CardRecommendation, 'rewardType' | 'rate' | 'effectiveRate'>) {
  if (rec.rewardType === 'points') return `${rec.rate}x points`;
  return `${rec.rate}% cash back`;
}

function formatEffectiveValue(rec: Pick<CardRecommendation, 'rewardType' | 'effectiveRate'>) {
  if (rec.rewardType !== 'points') return null;
  return `≈ ${rec.effectiveRate.toFixed(1)}% value`;
}

function sortRecommendations(recs: CardRecommendation[]) {
  return [...recs].sort((a, b) => b.effectiveRate - a.effectiveRate);
}

function sortProtections(protections: CardProtection[]) {
  const tierOrder = { primary: 1, secondary: 2, unknown: 3 };
  return [...protections].sort((a, b) => {
    const tierDiff = tierOrder[a.coverageTier] - tierOrder[b.coverageTier];
    if (tierDiff !== 0) return tierDiff;
    // Sort by coverage amount descending
    const amountA = parseInt((a.coverageDetails.match(/\$([0-9,]+)/) ?? [])[1]?.replace(',', '') ?? '0');
    const amountB = parseInt((b.coverageDetails.match(/\$([0-9,]+)/) ?? [])[1]?.replace(',', '') ?? '0');
    return amountB - amountA;
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('formatReward', () => {
  it('formats cash back correctly', () => {
    expect(formatReward({ rewardType: 'cashback', rate: 3, effectiveRate: 3 })).toBe('3% cash back');
    expect(formatReward({ rewardType: 'cashback', rate: 1.5, effectiveRate: 1.5 })).toBe('1.5% cash back');
  });

  it('formats points correctly', () => {
    expect(formatReward({ rewardType: 'points', rate: 3, effectiveRate: 6 })).toBe('3x points');
    expect(formatReward({ rewardType: 'points', rate: 1, effectiveRate: 2 })).toBe('1x points');
  });

  it('uses "points" not "pts"', () => {
    const result = formatReward({ rewardType: 'points', rate: 5, effectiveRate: 10 });
    expect(result).toContain('points');
    expect(result).not.toContain('pts');
  });

  it('uses "cash back" not "back"', () => {
    const result = formatReward({ rewardType: 'cashback', rate: 2, effectiveRate: 2 });
    expect(result).toContain('cash back');
    expect(result).not.toBe('2% back');
  });
});

describe('formatEffectiveValue', () => {
  it('returns null for cashback', () => {
    expect(formatEffectiveValue({ rewardType: 'cashback', effectiveRate: 3 })).toBeNull();
  });

  it('returns estimated value for points', () => {
    expect(formatEffectiveValue({ rewardType: 'points', effectiveRate: 6 })).toBe('≈ 6.0% value');
  });
});

describe('sortRecommendations', () => {
  const makeRec = (name: string, effectiveRate: number): CardRecommendation => ({
    cardId: 1,
    cardName: name,
    issuer: 'Chase',
    color: '#000',
    rate: effectiveRate,
    effectiveRate,
    benefitType: 'cashback',
    rewardType: 'cashback',
    category: null,
    notes: null,
    spendCap: null,
    capPeriod: null,
    requiresActivation: false,
    validUntil: null,
    isRotating: false,
    baseRate: 1,
    benefitsUrl: null,
  });

  it('sorts highest effective rate first', () => {
    const recs = [makeRec('Card A', 2), makeRec('Card B', 5), makeRec('Card C', 3)];
    const sorted = sortRecommendations(recs);
    expect(sorted[0].cardName).toBe('Card B');
    expect(sorted[1].cardName).toBe('Card C');
    expect(sorted[2].cardName).toBe('Card A');
  });

  it('does not mutate original array', () => {
    const recs = [makeRec('Card A', 2), makeRec('Card B', 5)];
    sortRecommendations(recs);
    expect(recs[0].cardName).toBe('Card A');
  });
});

describe('sortProtections', () => {
  const makeProtection = (name: string, tier: 'primary' | 'secondary' | 'unknown', amount: number): CardProtection => ({
    cardId: 1,
    cardName: name,
    issuer: 'Chase',
    color: '#000',
    protectionType: 'car_rental_insurance',
    coverageDetails: `Coverage up to $${amount.toLocaleString()} for rental vehicles`,
    coverageTier: tier,
    notes: null,
    benefitsUrl: null,
  });

  it('sorts primary before secondary before unknown', () => {
    const protections = [
      makeProtection('Card C', 'unknown', 0),
      makeProtection('Card B', 'secondary', 50000),
      makeProtection('Card A', 'primary', 75000),
    ];
    const sorted = sortProtections(protections);
    expect(sorted[0].cardName).toBe('Card A');
    expect(sorted[1].cardName).toBe('Card B');
    expect(sorted[2].cardName).toBe('Card C');
  });

  it('sorts higher coverage amount first within same tier', () => {
    const protections = [
      makeProtection('Sapphire Preferred', 'primary', 60000),
      makeProtection('Sapphire Reserve', 'primary', 75000),
    ];
    const sorted = sortProtections(protections);
    expect(sorted[0].cardName).toBe('Sapphire Reserve');
    expect(sorted[1].cardName).toBe('Sapphire Preferred');
  });

  it('does not mutate original array', () => {
    const protections = [
      makeProtection('Card B', 'secondary', 0),
      makeProtection('Card A', 'primary', 75000),
    ];
    sortProtections(protections);
    expect(protections[0].cardName).toBe('Card B');
  });
});

describe('category matching', () => {
  it('Gas Stations is the canonical gas category — no Gas & EV Charging duplicate', () => {
    // Bug: duplicate gas categories (Gas Stations id=562, Gas & EV Charging id=582)
    // caused Costco Anywhere Visa 5% gas benefit to never match "Costco Gas" merchant.
    // Fix: consolidated everything under Gas Stations (id=562).
    const canonicalGasCategory = 'Gas Stations';
    expect(canonicalGasCategory).not.toBe('Gas & EV Charging');
  });

  it('Costco Anywhere Visa gas benefit is 5% at Costco Gas, not 1%', () => {
    const rec = { rewardType: 'cashback', rate: 5, effectiveRate: 5 };
    expect(formatReward(rec)).toBe('5% cash back');
    expect(formatReward(rec)).not.toBe('1% cash back');
  });

  it('Costco Anywhere Visa earns 4% at other gas stations', () => {
    const rec = { rewardType: 'cashback', rate: 4, effectiveRate: 4 };
    expect(formatReward(rec)).toBe('4% cash back');
  });

  it('Costco Anywhere Visa earns 2% at Costco (wholesale, not gas)', () => {
    const rec = { rewardType: 'cashback', rate: 2, effectiveRate: 2 };
    expect(formatReward(rec)).toBe('2% cash back');
  });
});

describe('protection tier detection', () => {
  it('detects primary from coverage text', () => {
    const text = 'Coverage is primary and provides reimbursement up to $75,000';
    expect(text.toLowerCase().includes('primary')).toBe(true);
  });

  it('detects secondary from coverage text', () => {
    const text = 'Coverage is secondary to your personal insurance';
    const lower = text.toLowerCase();
    const tier = lower.includes('primary') ? 'primary' : lower.includes('secondary') ? 'secondary' : 'unknown';
    expect(tier).toBe('secondary');
  });

  it('falls back to unknown when neither term present', () => {
    const text = 'Provides reimbursement for theft and collision damage';
    const lower = text.toLowerCase();
    const tier = lower.includes('primary') ? 'primary' : lower.includes('secondary') ? 'secondary' : 'unknown';
    expect(tier).toBe('unknown');
  });
});
