import type { Recommendation, Protection } from './types';

export function sortRecommendations(recs: Recommendation[]): Recommendation[] {
  return [...recs].sort((a, b) => b.effectiveRate - a.effectiveRate);
}

const TIER_ORDER: Record<Protection['coverageTier'], number> = {
  primary: 1,
  secondary: 2,
  unknown: 3,
};

function extractCoverageAmount(details: string): number {
  const match = details.match(/\$([0-9,]+)/);
  return match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
}

export function sortProtections(protections: Protection[]): Protection[] {
  return [...protections].sort((a, b) => {
    const tierDiff = TIER_ORDER[a.coverageTier] - TIER_ORDER[b.coverageTier];
    if (tierDiff !== 0) return tierDiff;
    return extractCoverageAmount(b.coverageDetails) - extractCoverageAmount(a.coverageDetails);
  });
}

export function detectCoverageTier(coverageDetails: string): Protection['coverageTier'] {
  const lower = coverageDetails.toLowerCase();
  if (lower.includes('primary')) return 'primary';
  if (lower.includes('secondary')) return 'secondary';
  return 'unknown';
}
