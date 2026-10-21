import type { ClientScoreRowData } from '@mastra/client-js';

import { TraceFeedbackTab } from '@mastra/playground-ui/domains/traces/components/trace-feedback-tab';
import { TraceSpanPanel } from '@mastra/playground-ui/domains/traces/components/trace-span-panel';
import { useExperimentTrace } from '@mastra/react/hooks/experiments';
import { ExperimentResultPanel } from '@/domains/experiments/components/experiment-result-panel';
import type { ExperimentResultPanelProps } from '@/domains/experiments/components/experiment-result-panel';
import { ExperimentScorePanel } from '@/domains/experiments/components/experiment-score-panel';
import { useExperimentResultDetailState } from '@/domains/experiments/hooks/use-experiment-result-detail-state';
import type { ExperimentResultDetailState } from '@/domains/experiments/hooks/use-experiment-result-detail-state';
import { StudioTracePanelHost } from '@/domains/traces/components/studio-trace-panel-host';

export type ExperimentResultDetailProps = Omit<
  ExperimentResultPanelProps,
  'scores' | 'onShowTrace' | 'onScoreClick' | 'featuredScoreId' | 'collapsed' | 'feedbackTabSlot'
> & {
  scores?: ClientScoreRowData[];
  /** Optional controlled state, for callers that need to read it. Create it with `useExperimentResultDetailState`. */
  state?: ExperimentResultDetailState;
  /** Trace drawer's full-thread view: lists through the trace-query API; `false` falls back to `listTracesLight`. */
  withQueryTrace: boolean;
  /** Shows the Feedback tabs and fetches their feedback. */
  withFeedback: boolean;
};

/**
 * Shared "result + score + trace" panel stack used by the experiment item page
 * and the review queues, so the Trace / score interactions behave identically.
 * The result is a drawer, or an inline card with `variant="inline"`. Score and trace
 * are sibling drawers rendered after the result so they stack on top.
 */
export function ExperimentResultDetail({
  result,
  scores,
  state,
  withQueryTrace,
  withFeedback,
  ...panelProps
}: ExperimentResultDetailProps) {
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

  const { data: traceData, isLoading: isTraceLoading } = useExperimentTrace({
    traceId: featuredTraceId,
    queryOptions: { enabled: !!featuredTraceId },
  });
  const traceSpans = traceData?.spans;
  const anchorSpan = traceSpans?.find(span => !span.parentSpanId);

  return (
    <>
      <ExperimentResultPanel
        {...panelProps}
        result={result}
        scores={scores}
        onScoreClick={handleScoreClick}
        featuredScoreId={featuredScoreId}
        onShowTrace={result?.traceId ? () => showTrace(result.traceId) : undefined}
        feedbackTabSlot={
          withFeedback ? ({ traceId }) => <TraceFeedbackTab key={traceId} traceId={traceId} /> : undefined
        }
      />

      <ExperimentScorePanel
        score={featuredScore ?? undefined}
        onNext={toNextScore()}
        onPrevious={toPreviousScore()}
        onClose={() => setFeaturedScoreId(null)}
        onShowTrace={featuredScore ? () => showTrace(featuredScore.traceId) : undefined}
      />

      <StudioTracePanelHost>
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
          withQueryTrace={withQueryTrace}
          withFeedback={withFeedback}
          onScoreSelect={scoreId => {
            if (scores?.some(score => score.id === scoreId)) {
              setFeaturedTraceId(null);
              setFeaturedSpanId(undefined);
              setFeaturedScoreId(scoreId);
            }
          }}
        />
      </StudioTracePanelHost>
    </>
  );
}
