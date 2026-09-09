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
import { cn } from '@/lib/utils';

export type ExperimentResultDetailProps = Omit<
  ExperimentResultPanelProps,
  'scores' | 'onShowTrace' | 'onScoreClick' | 'featuredScoreId' | 'collapsed' | 'scorePanelSlot' | 'feedbackTabSlot'
> & {
  scores?: ClientScoreRowData[];
  /**
   * Optional controlled state, for callers that need to read it (e.g. to
   * widen the surrounding overlay). Create it with `useExperimentResultDetailState`.
   */
  state?: ExperimentResultDetailState;
};

/**
 * Shared "result + score + trace" detail stack used by the experiment item page
 * and the review queues, so the Trace / score interactions behave identically.
 */
export function ExperimentResultDetail({
  result,
  scores,
  state,
  className,
  ...panelProps
}: ExperimentResultDetailProps) {
  const internalState = useExperimentResultDetailState(scores);
  const {
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
    // One-shot: collapse Result so the freshly opened trace has room.
    setResultCollapsed(true);
    setTraceCollapsed(false);
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
  const anchorSpanEntityType =
    anchorSpan?.entityType === 'agent' ? 'Agent' : anchorSpan?.entityType === 'workflow_run' ? 'Workflow' : undefined;
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

  // Row stack: Result (with score split inside) → shared Trace/Span panel.
  const gridRows = (() => {
    const rows: string[] = [];
    rows.push(resultCollapsed ? 'auto' : featuredTraceId ? '2fr' : '1fr');
    if (featuredTraceId) rows.push(traceCollapsed ? 'auto' : '3fr');
    return rows.join(' ');
  })();

  return (
    <div
      className={cn(
        '[&>section]:bg-surface3 grid h-full min-h-0 content-start gap-4 [&>section]:rounded-lg [&>section]:shadow-lg',
        className,
      )}
      style={{ gridTemplateRows: gridRows }}
    >
      <ExperimentResultPanel
        {...panelProps}
        result={result}
        scores={scores}
        onScoreClick={handleScoreClick}
        featuredScoreId={featuredScoreId}
        onShowTrace={() => showTrace(result.traceId)}
        feedbackTabSlot={({ traceId }) => <TraceFeedbackTab key={traceId} traceId={traceId} />}
        collapsed={resultCollapsed}
        scorePanelSlot={
          featuredScore ? (
            <ExperimentScorePanel
              score={featuredScore}
              onNext={toNextScore()}
              onPrevious={toPreviousScore()}
              onClose={() => setFeaturedScoreId(null)}
              onShowTrace={() => showTrace(featuredScore.traceId)}
              className="rounded-none border-0 bg-transparent"
            />
          ) : null
        }
      />

      {featuredTraceId && (
        <TraceSpanPanel
          traceId={featuredTraceId}
          spans={traceSpans}
          isLoadingSpans={isTraceLoading}
          selectedSpanId={featuredSpanId ?? null}
          onClose={() => {
            setFeaturedTraceId(null);
            setFeaturedSpanId(undefined);
            setResultCollapsed(false);
          }}
          onSpanSelect={setFeaturedSpanId}
          showUnavailableFeaturesMsg={false}
          collapsed={traceCollapsed}
          onCollapsedChange={setTraceCollapsed}
          traceHref={`/traces?traceId=${encodeURIComponent(featuredTraceId)}`}
          anchorSpanId={anchorSpan?.spanId}
          feedbackTabBadge={<NeedsReviewDot feedback={traceFeedback?.feedback} />}
          feedbackTabSlot={({ traceId }) => <TraceFeedbackTab traceId={traceId} />}
          scoresTabBadge={anchorSpanScores?.pagination?.total ?? undefined}
          scoresTabSlot={({ traceId, rootSpanId }) =>
            rootSpanId ? (
              <TraceScoresTab
                traceId={traceId}
                spanId={rootSpanId}
                isTopLevelSpan={!anchorSpan?.parentSpanId}
                entityType={anchorSpanEntityType}
                onScoreSelect={scoreId => {
                  if (scores?.some(score => score.id === scoreId)) {
                    setFeaturedScoreId(scoreId);
                    setResultCollapsed(false);
                  }
                }}
              />
            ) : null
          }
          spanFeedbackTabBadge={<NeedsReviewDot feedback={spanFeedback?.feedback} />}
          spanFeedbackTabSlot={({ traceId, spanId }) =>
            traceId && spanId ? (
              <SpanFeedbackTab key={`${traceId}:${spanId}`} traceId={traceId} spanId={spanId} />
            ) : null
          }
          spanPanelClassName="rounded-none border-0 bg-transparent"
        />
      )}
    </div>
  );
}
