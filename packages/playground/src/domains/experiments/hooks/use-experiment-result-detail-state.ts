import type { ClientScoreRowData } from '@mastra/client-js';
import { useState } from 'react';

export type ExperimentResultDetailState = ReturnType<typeof useExperimentResultDetailState>;

/** Trace / score / span selection for `ExperimentResultDetail`, plus the derived `wide` flag. */
export function useExperimentResultDetailState(scores?: ClientScoreRowData[]) {
  const [featuredTraceId, setFeaturedTraceId] = useState<string | null>(null);
  const [featuredSpanId, setFeaturedSpanId] = useState<string | undefined>(undefined);
  const [featuredScoreId, setFeaturedScoreId] = useState<string | null>(null);
  const [resultCollapsed, setResultCollapsed] = useState(false);
  const [traceCollapsed, setTraceCollapsed] = useState(false);

  const featuredScore = scores?.find(s => s.id === featuredScoreId) ?? null;
  const wide = !!featuredSpanId || (!!featuredScore && !resultCollapsed);

  return {
    featuredTraceId,
    setFeaturedTraceId,
    featuredSpanId,
    setFeaturedSpanId,
    featuredScoreId,
    setFeaturedScoreId,
    resultCollapsed,
    setResultCollapsed,
    traceCollapsed,
    setTraceCollapsed,
    featuredScore,
    wide,
  };
}
