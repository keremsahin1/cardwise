import type { Recommendation } from './types';

export function formatReward(rec: Pick<Recommendation, 'rewardType' | 'rate'>): string {
  if (rec.rewardType === 'points') return `${rec.rate}x points`;
  return `${rec.rate}% cash back`;
}

export function formatEffectiveValue(rec: Pick<Recommendation, 'rewardType' | 'effectiveRate'>): string | null {
  if (rec.rewardType !== 'points') return null;
  return `≈ ${rec.effectiveRate.toFixed(1)}% value`;
}
