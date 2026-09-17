import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import {
  TraceDataPanelView,
  type TraceDataPanelTab,
} from '@mastra/playground-ui/domains/traces/components/trace-data-panel-view';
import { useState, type ComponentProps } from 'react';
import { SpanScoring } from './span-scoring';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

type TraceDataPanelProps = Omit<
  ComponentProps<typeof TraceDataPanelView>,
  'activeTab' | 'onTabChange' | 'onEvaluateTrace'
> & {
  /** Notified after the active tab changes (user click or post-scoring switch). */
  onTabChange?: (tab: TraceDataPanelTab) => void;
};

/**
 * Owns the trace panel's active tab. Mount it with a `key` on the trace (and anchor span)
 * so a tab selected on a previous trace never leaks into the next one.
 */
export function TraceDataPanel({ onTabChange, ...props }: TraceDataPanelProps) {
  const [activeTab, setActiveTabState] = useState<TraceDataPanelTab>('details');
  const setActiveTab = (tab: TraceDataPanelTab) => {
    setActiveTabState(tab);
    onTabChange?.(tab);
  };
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
        activeTab={activeTab}
        onTabChange={setActiveTab}
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
                setActiveTab('scores');
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
