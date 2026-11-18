import type { GetScorerResponse } from '@mastra/client-js';
import { useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import type { TraceSpanRecord } from '../types';
import { SpanScoring } from '@/domains/scores/components/span-scoring';
import type { TriggerScorerArgs } from '@/domains/scores/components/span-scoring';
import { TraceDataPanelView } from '@/domains/traces/components/trace-data-panel-view';
import type { TraceDataPanelSpan, TraceSideView } from '@/domains/traces/components/trace-data-panel-view';
import { getSignalLabel, getSpanSignal } from '@/domains/traces/utils/span-signal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ds/components/Dialog';

export type TraceDataPanelProps = Omit<
  ComponentProps<typeof TraceDataPanelView>,
  'sideView' | 'onSideViewChange' | 'onEvaluateTrace'
> & {
  /**
   * Every span of the trace with its payload (`getTrace`). Light spans carry no input or attributes;
   * the full ones tell which agent runs a signal started, so their rows can say so.
   */
  traceSpans?: TraceSpanRecord[];
  /** The scorers "Score trace" offers (`listScorers`). */
  scorers?: Record<string, GetScorerResponse>;
  isLoadingScorers?: boolean;
  /** Starts a scorer on the trace's root span; "Score trace" only shows when it is set. */
  onTriggerScorer?: (args: TriggerScorerArgs) => Promise<unknown>;
};

/** The signal that started each agent run, by span id, read from the full spans. */
function getSignalLabels(traceSpans: TraceSpanRecord[] | undefined): Map<string, string> {
  const labels = new Map<string, string>();
  for (const span of traceSpans ?? []) {
    const signal = getSpanSignal(span);
    const label = signal && getSignalLabel(signal);
    if (label) labels.set(span.spanId, label);
  }
  return labels;
}

function withSignalLabels(
  spans: TraceDataPanelSpan[] | undefined,
  labels: Map<string, string>,
): TraceDataPanelSpan[] | undefined {
  if (labels.size === 0) return spans;
  return spans?.map(span => {
    const signalLabel = labels.get(span.spanId);
    return signalLabel ? { ...span, signalLabel } : span;
  });
}

/**
 * Owns the trace panel's side column view so scoring can land on "Scores". Mount it with a `key` on the
 * trace (and anchor span) so a view picked on a previous trace never leaks into the next one. Never
 * fetches: the scorers, the full trace and the scorer run all come from the host.
 */
export function TraceDataPanel({
  traceSpans,
  scorers,
  isLoadingScorers,
  onTriggerScorer,
  ...props
}: TraceDataPanelProps) {
  const [sideView, setSideView] = useState<TraceSideView>();
  const [isScoringOpen, setIsScoringOpen] = useState(false);
  // Kept stable: the panel re-expands its tree whenever the spans it is given change identity.
  const spans = useMemo(() => withSignalLabels(props.spans, getSignalLabels(traceSpans)), [props.spans, traceSpans]);
  const rootSpan = props.anchorSpanId
    ? props.spans?.find(span => span.spanId === props.anchorSpanId)
    : props.spans?.find(span => span.parentSpanId == null);

  return (
    <>
      <TraceDataPanelView
        {...props}
        spans={spans}
        onEvaluateTrace={onTriggerScorer ? () => setIsScoringOpen(true) : undefined}
        sideView={sideView}
        onSideViewChange={setSideView}
      />
      {onTriggerScorer && (
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
                onTriggerScorer={onTriggerScorer}
                onSuccess={() => {
                  setIsScoringOpen(false);
                  setSideView('scores');
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
