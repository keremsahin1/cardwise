import { describe, it, expect } from 'vitest';
import { sortRecommendations, sortProtections, detectCoverageTier } from './sort';
import type { Recommendation, Protection } from './types';

function makeRec(name: string, effectiveRate: number): Recommendation {
  return {
    cardId: 1, cardName: name, issuer: 'Chase', color: '#000',
    rate: effectiveRate, effectiveRate,
    benefitType: 'cashback', rewardType: 'cashback',
    category: null, notes: null, spendCap: null, capPeriod: null,
    requiresActivation: false, validUntil: null, isRotating: false,
    baseRate: 1, benefitsUrl: null,
  };
}

function makeProtection(name: string, tier: Protection['coverageTier'], amount: number): Protection {
  return {
    cardId: 1, cardName: name, issuer: 'Chase', color: '#000',
    protectionType: 'car_rental_insurance',
    coverageDetails: `Coverage is primary and provides reimbursement up to $${amount.toLocaleString()} for rental vehicles`,
    coverageTier: tier,
    notes: null, benefitsUrl: null,
  };
}

describe('sortRecommendations', () => {
  it('sorts highest effective rate first', () => {
    const sorted = sortRecommendations([makeRec('A', 2), makeRec('B', 5), makeRec('C', 3)]);
    expect(sorted.map(r => r.cardName)).toEqual(['B', 'C', 'A']);
  });

  it('does not mutate original array', () => {
    const recs = [makeRec('A', 2), makeRec('B', 5)];
    sortRecommendations(recs);
    expect(recs[0].cardName).toBe('A');
  });

  it('handles single item', () => {
    expect(sortRecommendations([makeRec('A', 3)])).toHaveLength(1);
  });

  it('handles empty array', () => {
    expect(sortRecommendations([])).toEqual([]);
  });
});

describe('sortProtections', () => {
  it('sorts primary before secondary before unknown', () => {
    const sorted = sortProtections([
      makeProtection('C', 'unknown', 0),
      makeProtection('B', 'secondary', 50000),
      makeProtection('A', 'primary', 75000),
    ]);
    expect(sorted.map(p => p.cardName)).toEqual(['A', 'B', 'C']);
  });

  it('sorts higher coverage amount first within same tier', () => {
    const sorted = sortProtections([
      makeProtection('Sapphire Preferred', 'primary', 60000),
      makeProtection('Sapphire Reserve', 'primary', 75000),
    ]);
    expect(sorted[0].cardName).toBe('Sapphire Reserve');
    expect(sorted[1].cardName).toBe('Sapphire Preferred');
  });

  it('does not mutate original array', () => {
    const protections = [
      makeProtection('B', 'secondary', 0),
      makeProtection('A', 'primary', 75000),
    ];
    sortProtections(protections);
    expect(protections[0].cardName).toBe('B');
  });

  it('handles empty array', () => {
    expect(sortProtections([])).toEqual([]);
  });
});

describe('detectCoverageTier', () => {
  it('detects primary', () => {
    expect(detectCoverageTier('Coverage is primary and provides reimbursement up to $75,000')).toBe('primary');
  });

  it('detects secondary', () => {
    expect(detectCoverageTier('Coverage is secondary to your personal insurance')).toBe('secondary');
  });

  it('returns unknown when neither', () => {
    expect(detectCoverageTier('Provides reimbursement for theft and collision damage')).toBe('unknown');
  });

  it('is case insensitive', () => {
    expect(detectCoverageTier('Coverage is PRIMARY')).toBe('primary');
    expect(detectCoverageTier('SECONDARY coverage applies')).toBe('secondary');
  });
});
