import type { ClientScoreRowData } from '@mastra/client-js';

import { ExperimentResultPanel } from '@/domains/experiments/components/experiment-result-panel';
import type { ExperimentResultPanelProps } from '@/domains/experiments/components/experiment-result-panel';
import { ExperimentScorePanel } from '@/domains/experiments/components/experiment-score-panel';
import { useExperimentResultDetailState } from '@/domains/experiments/hooks/use-experiment-result-detail-state';
import type { ExperimentResultDetailState } from '@/domains/experiments/hooks/use-experiment-result-detail-state';
import { useExperimentTrace } from '@/domains/experiments/hooks/use-experiment-trace';
import { useTraceSpanScores } from '@/domains/scores/hooks/use-trace-span-scores';
import { NeedsReviewDot } from '@/domains/traces/components/needs-review-dot';
import { SpanFeedbackTab } from '@/domains/traces/components/span-feedback-tab';
import { TraceFeedbackTab } from '@/domains/traces/components/trace-feedback-tab';
import { TraceScoresTab } from '@/domains/traces/components/trace-scores-tab';
import { TraceSpanPanel } from '@/domains/traces/components/trace-span-panel';
import { useSpanFeedback } from '@/domains/traces/hooks/use-span-feedback';
import { useTraceFeedback } from '@/domains/traces/hooks/use-trace-feedback';

export type ExperimentResultDetailProps = Omit<
  ExperimentResultPanelProps,
  'scores' | 'onShowTrace' | 'onScoreClick' | 'featuredScoreId' | 'collapsed' | 'feedbackTabSlot'
> & {
  scores?: ClientScoreRowData[];
  /** Optional controlled state, for callers that need to read it. Create it with `useExperimentResultDetailState`. */
  state?: ExperimentResultDetailState;
};

/**
 * Shared "result + score + trace" drawer stack used by the experiment item page
 * and the review queues, so the Trace / score interactions behave identically.
 * Score and trace are sibling drawers rendered after the result so they stack on top.
 */
export function ExperimentResultDetail({ result, scores, state, ...panelProps }: ExperimentResultDetailProps) {
  const internalState = useExperimentResultDetailState(scores, result?.id);
  const {
    featuredTraceId,
    setFeaturedTraceId,
    featuredSpanId,
    setFeaturedSpanId,
    featuredScoreId,
    setFeaturedScoreId,
    featuredScore,
  } = state ?? internalState;

  const handleScoreClick = (scoreId: string) => {
    setFeaturedScoreId(prev => (scoreId === prev ? null : scoreId));
    setFeaturedTraceId(null);
    setFeaturedSpanId(undefined);
  };

  const showTrace = (traceId: string | null | undefined) => {
    if (!traceId) return;
    setFeaturedTraceId(traceId);
    setFeaturedSpanId(undefined);
    setFeaturedScoreId(null);
  };

  const toNextScore = (): (() => void) | undefined => {
    if (!featuredScoreId || !scores) return undefined;
    const currentIndex = scores.findIndex(s => s.id === featuredScoreId);
    if (currentIndex >= 0 && currentIndex < scores.length - 1) {
      return () => setFeaturedScoreId(scores[currentIndex + 1].id);
    }
    return undefined;
  };

  const toPreviousScore = (): (() => void) | undefined => {
    if (!featuredScoreId || !scores) return undefined;
    const currentIndex = scores.findIndex(s => s.id === featuredScoreId);
    if (currentIndex > 0) {
      return () => setFeaturedScoreId(scores[currentIndex - 1].id);
    }
    return undefined;
  };

  const { data: traceData, isLoading: isTraceLoading } = useExperimentTrace(featuredTraceId);
  const traceSpans = traceData?.spans;
  const anchorSpan = traceSpans?.find(span => !span.parentSpanId);
  const { data: traceFeedback } = useTraceFeedback({ traceId: featuredTraceId ?? undefined });
  const { data: spanFeedback } = useSpanFeedback({
    traceId: featuredTraceId ?? undefined,
    spanId: featuredSpanId,
  });
  const { data: anchorSpanScores } = useTraceSpanScores({
    traceId: featuredTraceId ?? undefined,
    spanId: anchorSpan?.spanId,
    page: 0,
  });

  return (
    <>
      <ExperimentResultPanel
        {...panelProps}
        result={result}
        scores={scores}
        onScoreClick={handleScoreClick}
        featuredScoreId={featuredScoreId}
        onShowTrace={result?.traceId ? () => showTrace(result.traceId) : undefined}
        feedbackTabSlot={({ traceId }) => <TraceFeedbackTab key={traceId} traceId={traceId} />}
      />

      <ExperimentScorePanel
        score={featuredScore ?? undefined}
        onNext={toNextScore()}
        onPrevious={toPreviousScore()}
        onClose={() => setFeaturedScoreId(null)}
        onShowTrace={featuredScore ? () => showTrace(featuredScore.traceId) : undefined}
      />

      <TraceSpanPanel
        size="wide"
        depth={2}
        traceId={featuredTraceId ?? undefined}
        spans={traceSpans}
        isLoadingSpans={isTraceLoading}
        selectedSpanId={featuredSpanId ?? null}
        onClose={() => {
          setFeaturedTraceId(null);
          setFeaturedSpanId(undefined);
        }}
        onSpanSelect={setFeaturedSpanId}
        showUnavailableFeaturesMsg={false}
        traceHref={featuredTraceId ? `/traces?traceId=${encodeURIComponent(featuredTraceId)}` : undefined}
        anchorSpanId={anchorSpan?.spanId}
        feedbackTabBadge={<NeedsReviewDot feedback={traceFeedback?.feedback} />}
        feedbackTabSlot={({ traceId }) => <TraceFeedbackTab traceId={traceId} />}
        scoresTabBadge={anchorSpanScores?.pagination?.total ?? undefined}
        scoresTabSlot={({ traceId, rootSpanId }) =>
          rootSpanId ? (
            <TraceScoresTab
              traceId={traceId}
              spanId={rootSpanId}
              onScoreSelect={scoreId => {
                if (scores?.some(score => score.id === scoreId)) {
                  setFeaturedTraceId(null);
                  setFeaturedSpanId(undefined);
                  setFeaturedScoreId(scoreId);
                }
              }}
            />
          ) : null
        }
        spanFeedbackTabBadge={<NeedsReviewDot feedback={spanFeedback?.feedback} />}
        spanFeedbackTabSlot={({ traceId, spanId }) =>
          traceId && spanId ? <SpanFeedbackTab key={`${traceId}:${spanId}`} traceId={traceId} spanId={spanId} /> : null
        }
      />
    </>
  );
}
