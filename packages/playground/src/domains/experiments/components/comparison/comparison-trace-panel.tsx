import { TraceScoresTab } from '@mastra/playground-ui/domains/scores';
import { SpanFeedbackTab } from '@mastra/playground-ui/domains/traces/components/span-feedback-tab';
import { TraceFeedbackTab } from '@mastra/playground-ui/domains/traces/components/trace-feedback-tab';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useExperimentTrace } from '@mastra/react/hooks/experiments';
import { useTraceSpanScores } from '@mastra/react/hooks/scores';
import { useSpanFeedback, useTraceFeedback } from '@mastra/react/hooks/traces';
import { useState } from 'react';
import { TraceSpanPanel } from '@/domains/traces/components/trace-span-panel';
import { traceScoreLink } from '@/lib/app-routing';

export interface ComparisonTracePanelProps {
  /** Trace to show. The panel stays closed while undefined. */
  traceId: string | undefined;
  onClose: () => void;
  /** Full-thread view through the trace-query API; `false` falls back to `listTracesLight`. */
  withQueryTrace: boolean;
  /** Shows the Feedback tabs and fetches their feedback. */
  withFeedback: boolean;
}

/** Trace drawer of one comparison cell, with the same tabs as the experiment result's trace drawer. */
export function ComparisonTracePanel({ traceId, onClose, withQueryTrace, withFeedback }: ComparisonTracePanelProps) {
  const { navigate } = useLinkComponent();
  const [selectedSpanId, setSelectedSpanId] = useState<string | undefined>();

  const { data: traceData, isLoading } = useExperimentTrace({
    traceId,
    queryOptions: { enabled: Boolean(traceId) },
  });
  const spans = traceData?.spans;
  const anchorSpan = spans?.find(span => !span.parentSpanId);
  const { data: traceFeedback } = useTraceFeedback({
    traceId,
    queryOptions: { enabled: withFeedback && Boolean(traceId) },
  });
  const { data: spanFeedback } = useSpanFeedback({
    traceId,
    spanId: selectedSpanId,
    queryOptions: { enabled: withFeedback && Boolean(traceId) && Boolean(selectedSpanId) },
  });
  const { data: anchorSpanScores } = useTraceSpanScores({
    traceId,
    spanId: anchorSpan?.spanId,
    page: 0,
    queryOptions: { enabled: Boolean(traceId) && Boolean(anchorSpan?.spanId) },
  });

  const close = () => {
    setSelectedSpanId(undefined);
    onClose();
  };

  return (
    <TraceSpanPanel
      size="wide"
      traceId={traceId}
      spans={spans}
      isLoadingSpans={isLoading}
      selectedSpanId={selectedSpanId ?? null}
      onClose={close}
      onSpanSelect={setSelectedSpanId}
      showUnavailableFeaturesMsg={false}
      traceHref={traceId ? `/traces?traceId=${encodeURIComponent(traceId)}` : undefined}
      anchorSpanId={anchorSpan?.spanId}
      withQueryTrace={withQueryTrace}
      withFeedback={withFeedback}
      onOpenScore={(id, scoreId) => navigate(traceScoreLink(id, scoreId))}
      feedbackTabBadge={withFeedback ? (traceFeedback?.pagination?.total ?? undefined) : undefined}
      feedbackTabSlot={withFeedback ? ({ traceId: id }) => <TraceFeedbackTab traceId={id} /> : undefined}
      scoresTabBadge={anchorSpanScores?.pagination?.total ?? undefined}
      scoresTabSlot={({ traceId: id, rootSpanId }) =>
        rootSpanId ? (
          <TraceScoresTab
            traceId={id}
            spanId={rootSpanId}
            onScoreSelect={scoreId => navigate(traceScoreLink(id, scoreId))}
          />
        ) : null
      }
      spanFeedbackTabBadge={withFeedback ? (spanFeedback?.pagination?.total ?? undefined) : undefined}
      spanFeedbackTabSlot={
        withFeedback
          ? ({ traceId: id, spanId }) =>
              id && spanId ? <SpanFeedbackTab key={`${id}:${spanId}`} traceId={id} spanId={spanId} /> : null
          : undefined
      }
    />
  );
}
