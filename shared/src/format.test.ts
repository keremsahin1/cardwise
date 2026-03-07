import { describe, it, expect } from 'vitest';
import { formatReward, formatEffectiveValue } from './format';

describe('formatReward', () => {
  it('formats cash back correctly', () => {
    expect(formatReward({ rewardType: 'cashback', rate: 3 })).toBe('3% cash back');
    expect(formatReward({ rewardType: 'cashback', rate: 1.5 })).toBe('1.5% cash back');
  });

  it('formats points correctly', () => {
    expect(formatReward({ rewardType: 'points', rate: 3 })).toBe('3x points');
    expect(formatReward({ rewardType: 'points', rate: 1 })).toBe('1x points');
  });

  it('uses "points" not "pts"', () => {
    expect(formatReward({ rewardType: 'points', rate: 5 })).toContain('points');
    expect(formatReward({ rewardType: 'points', rate: 5 })).not.toContain('pts');
  });

  it('uses "cash back" not just "back"', () => {
    expect(formatReward({ rewardType: 'cashback', rate: 2 })).toContain('cash back');
    expect(formatReward({ rewardType: 'cashback', rate: 2 })).not.toBe('2% back');
  });
});

describe('formatEffectiveValue', () => {
  it('returns null for cashback', () => {
    expect(formatEffectiveValue({ rewardType: 'cashback', effectiveRate: 3 })).toBeNull();
  });

  it('returns estimated value string for points', () => {
    expect(formatEffectiveValue({ rewardType: 'points', effectiveRate: 6 })).toBe('≈ 6.0% value');
    expect(formatEffectiveValue({ rewardType: 'points', effectiveRate: 2.5 })).toBe('≈ 2.5% value');
  });
});
