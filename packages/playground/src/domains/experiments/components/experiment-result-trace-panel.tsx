import type { ClientScoreRowData } from '@mastra/client-js';
import type { ExperimentResultDetailState } from '@mastra/playground-ui/domains/experiments';
import { TraceScoresList } from '@mastra/playground-ui/domains/scores';
import { SpanFeedbackTab } from '@mastra/playground-ui/domains/traces/components/span-feedback-tab';
import { TraceFeedbackTab } from '@mastra/playground-ui/domains/traces/components/trace-feedback-tab';
import { useExperimentTrace } from '@mastra/react/hooks/experiments';
import { useTraceSpanScores } from '@mastra/react/hooks/scores';
import { useSpanFeedback, useTraceFeedback } from '@mastra/react/hooks/traces';
import { TraceSpanPanel } from '@/domains/traces/components/trace-span-panel';

export interface ExperimentResultTracePanelProps {
  state: ExperimentResultDetailState;
  scores?: ClientScoreRowData[];
  /** Shows the Feedback tabs and fetches their feedback. */
  withFeedback: boolean;
}

/** Trace of an experiment result, for `ExperimentResultDetail`'s `tracePanel` slot. */
export function ExperimentResultTracePanel({ state, scores, withFeedback }: ExperimentResultTracePanelProps) {
  const { featuredTraceId, setFeaturedTraceId, featuredSpanId, setFeaturedSpanId, setFeaturedScoreId } = state;

  const { data: traceData, isLoading: isTraceLoading } = useExperimentTrace({
    traceId: featuredTraceId,
    queryOptions: { enabled: !!featuredTraceId },
  });
  const traceSpans = traceData?.spans;
  const anchorSpan = traceSpans?.find(span => !span.parentSpanId);
  const { data: traceFeedback } = useTraceFeedback({
    traceId: featuredTraceId ?? undefined,
    queryOptions: { enabled: withFeedback && !!featuredTraceId },
  });
  const { data: spanFeedback } = useSpanFeedback({
    traceId: featuredTraceId ?? undefined,
    spanId: featuredSpanId,
    queryOptions: { enabled: withFeedback && !!featuredTraceId && !!featuredSpanId },
  });
  const { data: anchorSpanScores } = useTraceSpanScores({
    traceId: featuredTraceId ?? undefined,
    spanId: anchorSpan?.spanId,
    page: 0,
    queryOptions: { enabled: !!featuredTraceId && !!anchorSpan?.spanId },
  });

  return (
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
      feedbackTabBadge={withFeedback ? (traceFeedback?.pagination?.total ?? undefined) : undefined}
      feedbackTabSlot={withFeedback ? ({ traceId }) => <TraceFeedbackTab traceId={traceId} /> : undefined}
      scoresTabBadge={anchorSpanScores?.pagination?.total ?? undefined}
      scoresTabSlot={({ traceId, rootSpanId }) =>
        rootSpanId ? (
          <TraceScoresList
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
      spanFeedbackTabBadge={withFeedback ? (spanFeedback?.pagination?.total ?? undefined) : undefined}
      spanFeedbackTabSlot={
        withFeedback
          ? ({ traceId, spanId }) =>
              traceId && spanId ? (
                <SpanFeedbackTab key={`${traceId}:${spanId}`} traceId={traceId} spanId={spanId} />
              ) : null
          : undefined
      }
    />
  );
}
