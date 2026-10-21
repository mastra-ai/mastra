import { TraceSpanPanel } from '@mastra/playground-ui/domains/traces/components/trace-span-panel';
import { useExperimentTrace } from '@mastra/react/hooks/experiments';
import { useState } from 'react';

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
  const [selectedSpanId, setSelectedSpanId] = useState<string | undefined>();

  const { data: traceData, isLoading } = useExperimentTrace({
    traceId,
    queryOptions: { enabled: Boolean(traceId) },
  });
  const spans = traceData?.spans;
  const anchorSpan = spans?.find(span => !span.parentSpanId);

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
    />
  );
}
