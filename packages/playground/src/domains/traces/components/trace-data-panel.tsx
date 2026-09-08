import {
  TraceDataPanelView,
  type TraceDataPanelTab,
} from '@mastra/playground-ui/domains/traces/components/trace-data-panel-view';
import { useState, type ComponentProps } from 'react';

type TraceDataPanelProps = Omit<
  ComponentProps<typeof TraceDataPanelView>,
  'activeTab' | 'onTabChange' | 'onEvaluateTrace'
>;

/**
 * Owns the trace panel's active tab. Mount it with a `key` on the trace (and anchor span)
 * so a tab selected on a previous trace never leaks into the next one.
 */
export function TraceDataPanel(props: TraceDataPanelProps) {
  const [activeTab, setActiveTab] = useState<TraceDataPanelTab>('details');

  return (
    <TraceDataPanelView
      {...props}
      // "Evaluate Trace" surfaces the scores it produces, so it switches to the Scores tab.
      onEvaluateTrace={() => setActiveTab('scores')}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    />
  );
}
