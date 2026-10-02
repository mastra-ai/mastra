import type { ClientScoreRowData } from '@mastra/client-js';
import { useState } from 'react';

export type ExperimentResultDetailState = ReturnType<typeof useExperimentResultDetailState>;

/**
 * Trace / score / span selection for `ExperimentResultDetail`.
 * Selection resets whenever `resultId` changes, so the always-mounted drawer never leaks state between results.
 */
export function useExperimentResultDetailState(scores?: ClientScoreRowData[], resultId?: string) {
  const [featuredTraceId, setFeaturedTraceId] = useState<string | null>(null);
  const [featuredSpanId, setFeaturedSpanId] = useState<string | undefined>(undefined);
  const [featuredScoreId, setFeaturedScoreId] = useState<string | null>(null);
  const [prevResultId, setPrevResultId] = useState(resultId);
  if (resultId !== prevResultId) {
    setPrevResultId(resultId);
    setFeaturedTraceId(null);
    setFeaturedSpanId(undefined);
    setFeaturedScoreId(null);
  }

  const featuredScore = scores?.find(s => s.id === featuredScoreId) ?? null;

  return {
    featuredTraceId,
    setFeaturedTraceId,
    featuredSpanId,
    setFeaturedSpanId,
    featuredScoreId,
    setFeaturedScoreId,
    featuredScore,
  };
}
