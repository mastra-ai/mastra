import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { SpanScoring } from '@mastra/playground-ui/domains/scores';
import {
  TraceDataPanelView,
  type TraceSideView,
} from '@mastra/playground-ui/domains/traces/components/trace-data-panel-view';
import { useState, type ComponentProps } from 'react';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

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
  const rootSpan = props.anchorSpanId
    ? props.spans?.find(span => span.spanId === props.anchorSpanId)
    : props.spans?.find(span => span.parentSpanId == null);

  return (
    <>
      <TraceDataPanelView
        {...props}
        onEvaluateTrace={() => setIsScoringOpen(true)}
        sideView={sideView}
        onSideViewChange={setSideView}
      />
      <Dialog variant="new" open={isScoringOpen} onOpenChange={setIsScoringOpen}>
        <DialogContent className="max-w-xl">
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
