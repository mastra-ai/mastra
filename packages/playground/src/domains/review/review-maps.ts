import type { ExperimentReviewCounts } from '@mastra/client-js';

export type ReviewSummary = { counts: ExperimentReviewCounts[] } | undefined | null;

export type ReviewByExperiment = Map<string, { needsReview: number; complete: number; total: number }>;

export interface ReviewTotals {
  needsReview: number;
  complete: number;
  inPipeline: number;
}

export function buildReviewByExperimentMap(reviewSummary: ReviewSummary): ReviewByExperiment {
  const map: ReviewByExperiment = new Map();
  if (!reviewSummary?.counts) return map;
  for (const c of reviewSummary.counts) {
    map.set(c.experimentId, { needsReview: c.needsReview, complete: c.complete, total: c.total });
  }
  return map;
}

export function computeReviewTotals(reviewSummary: ReviewSummary): ReviewTotals {
  if (!reviewSummary?.counts) return { needsReview: 0, complete: 0, inPipeline: 0 };
  return reviewSummary.counts.reduce<ReviewTotals>(
    (acc, c) => ({
      needsReview: acc.needsReview + c.needsReview,
      complete: acc.complete + c.complete,
      inPipeline: acc.inPipeline + c.needsReview + c.complete,
    }),
    { needsReview: 0, complete: 0, inPipeline: 0 },
  );
}
