import {
  TraceDataPanelView,
  type TraceDataPanelTab,
} from '@mastra/playground-ui/domains/traces/components/trace-data-panel-view';
import { useState, type ComponentProps } from 'react';

type TraceDataPanelProps = ComponentProps<typeof TraceDataPanelView>;

/**
 * Owns the trace panel's active tab unless `activeTab` is provided. Mount it with a `key` on
 * the trace (and anchor span) so a tab selected on a previous trace never leaks into the next one.
 */
export function TraceDataPanel({ activeTab, onTabChange, ...props }: TraceDataPanelProps) {
  const [uncontrolledTab, setUncontrolledTab] = useState<TraceDataPanelTab>('details');
  const tab = activeTab ?? uncontrolledTab;
  const setTab = (next: TraceDataPanelTab) => {
    setUncontrolledTab(next);
    onTabChange?.(next);
  };

  return <TraceDataPanelView {...props} activeTab={tab} onTabChange={setTab} />;
}
