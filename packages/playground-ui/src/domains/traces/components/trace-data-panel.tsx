import { useScorers } from '@mastra/react/hooks/scores';
import { useTraceSpans } from '@mastra/react/hooks/traces';
import { useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import { SpanScoring } from '@/domains/scores';
import { TraceDataPanelView } from '@/domains/traces/components/trace-data-panel-view';
import type { TraceSideView } from '@/domains/traces/components/trace-data-panel-view';
import { getSignalLabel, getSpanSignal } from '@/domains/traces/utils/span-signal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ds/components/Dialog';

type TraceDataPanelProps = Omit<
  ComponentProps<typeof TraceDataPanelView>,
  'sideView' | 'onSideViewChange' | 'onEvaluateTrace'
>;

/**
 * Owns the trace panel's side column view so scoring can land on "Scores". Mount it with a
 * `key` on the trace (and anchor span) so a view picked on a previous trace never leaks into the next one.
 */
export function TraceDataPanel(props: TraceDataPanelProps) {
  const [sideView, setSideView] = useState<TraceSideView>();
  const [isScoringOpen, setIsScoringOpen] = useState(false);
  const { data: scorers, isLoading: isLoadingScorers } = useScorers();
  // Light spans carry no input or attributes; the full trace (shared with the Messages view) tells
  // which agent runs a signal started, so their rows can say so.
  const { data: fullTrace } = useTraceSpans({
    traceId: props.traceId,
    passive: true,
    queryOptions: { enabled: !!props.traceId },
  });
  const spans = useMemo(() => {
    const labels = new Map<string, string>();
    for (const span of fullTrace?.spans ?? []) {
      const signal = getSpanSignal(span);
      const label = signal && getSignalLabel(signal);
      if (label) labels.set(span.spanId, label);
    }
    if (labels.size === 0) return props.spans;
    return props.spans?.map(span =>
      labels.has(span.spanId) ? { ...span, signalLabel: labels.get(span.spanId) } : span,
    );
  }, [fullTrace, props.spans]);
  const rootSpan = props.anchorSpanId
    ? props.spans?.find(span => span.spanId === props.anchorSpanId)
    : props.spans?.find(span => span.parentSpanId == null);

  return (
    <>
      <TraceDataPanelView
        {...props}
        spans={spans}
        onEvaluateTrace={() => setIsScoringOpen(true)}
        sideView={sideView}
        onSideViewChange={setSideView}
      />
      <Dialog open={isScoringOpen} onOpenChange={setIsScoringOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Score trace</DialogTitle>
          </DialogHeader>

          {isScoringOpen && rootSpan && (
            <SpanScoring
              traceId={props.traceId}
              spanId={rootSpan.spanId}
              entityType={rootSpan.entityType === 'agent' ? 'Agent' : 'Workflow'}
              isTopLevelSpan={!rootSpan.parentSpanId}
              scorers={scorers}
              isLoadingScorers={isLoadingScorers}
              onSuccess={() => {
                setIsScoringOpen(false);
                setSideView('scores');
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
