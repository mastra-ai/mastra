import type { ExperimentReviewCounts } from '@mastra/client-js';

export type ReviewSummary = { counts: ExperimentReviewCounts[] } | undefined | null;

export type ReviewByExperiment = Map<string, { needsReview: number; complete: number; total: number }>;

export function buildReviewByExperimentMap(reviewSummary: ReviewSummary): ReviewByExperiment {
  const map: ReviewByExperiment = new Map();
  if (!reviewSummary?.counts) return map;
  for (const c of reviewSummary.counts) {
    map.set(c.experimentId, { needsReview: c.needsReview, complete: c.complete, total: c.total });
  }
  return map;
}
