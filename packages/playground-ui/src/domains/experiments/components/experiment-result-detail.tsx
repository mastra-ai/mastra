'use client';

import type { ClientScoreRowData } from '@mastra/client-js';
import type { ReactNode } from 'react';
import { useExperimentResultDetailState } from '../hooks/use-experiment-result-detail-state';
import type { ExperimentResultDetailState } from '../hooks/use-experiment-result-detail-state';
import { ExperimentResultPanel } from './experiment-result-panel';
import type { ExperimentResultPanelProps } from './experiment-result-panel';
import { ExperimentScorePanel } from './experiment-score-panel';

export type ExperimentResultDetailProps = Omit<
  ExperimentResultPanelProps,
  'scores' | 'onShowTrace' | 'onScoreClick' | 'featuredScoreId'
> & {
  scores?: ClientScoreRowData[];
  /** Optional controlled state, for callers that need to read it. Create it with `useExperimentResultDetailState`. */
  state?: ExperimentResultDetailState;
  /**
   * Renders the trace of `state.featuredTraceId` (open it from the result or a score). It is rendered
   * after the score panel so it stacks on top. Omit it and the result offers no trace link.
   */
  tracePanel?: (state: ExperimentResultDetailState) => ReactNode;
};

/**
 * The "result + score + trace" panel stack of an experiment item, so the trace and score
 * interactions behave the same wherever a result is reviewed. The result is a drawer, or an inline
 * card with `variant="inline"`; the score and trace panels are sibling drawers stacked on top.
 */
export function ExperimentResultDetail({
  result,
  scores,
  state,
  tracePanel,
  ...panelProps
}: ExperimentResultDetailProps) {
  const internalState = useExperimentResultDetailState(scores, result?.id);
  const detailState = state ?? internalState;
  const { setFeaturedTraceId, setFeaturedSpanId, featuredScoreId, setFeaturedScoreId, featuredScore } = detailState;

  const handleScoreClick = (scoreId: string) => {
    setFeaturedScoreId(prev => (scoreId === prev ? null : scoreId));
    setFeaturedTraceId(null);
    setFeaturedSpanId(undefined);
  };

  const showTrace = (traceId: string | null | undefined) => {
    if (!traceId || !tracePanel) return;
    setFeaturedTraceId(traceId);
    setFeaturedSpanId(undefined);
    setFeaturedScoreId(null);
  };

  const scoreIndex = featuredScoreId && scores ? scores.findIndex(s => s.id === featuredScoreId) : -1;
  const previousScore = scoreIndex > 0 ? scores?.[scoreIndex - 1] : undefined;
  const nextScore = scoreIndex >= 0 ? scores?.[scoreIndex + 1] : undefined;

  return (
    <>
      <ExperimentResultPanel
        {...panelProps}
        result={result}
        scores={scores}
        onScoreClick={handleScoreClick}
        featuredScoreId={featuredScoreId}
        onShowTrace={tracePanel && result?.traceId ? () => showTrace(result.traceId) : undefined}
      />

      <ExperimentScorePanel
        score={featuredScore ?? undefined}
        onNext={nextScore ? () => setFeaturedScoreId(nextScore.id) : undefined}
        onPrevious={previousScore ? () => setFeaturedScoreId(previousScore.id) : undefined}
        onClose={() => setFeaturedScoreId(null)}
        onShowTrace={tracePanel && featuredScore ? () => showTrace(featuredScore.traceId) : undefined}
      />

      {tracePanel?.(detailState)}
    </>
  );
}
