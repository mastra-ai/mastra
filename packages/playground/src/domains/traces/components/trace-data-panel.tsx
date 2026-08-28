import {
  TraceDataPanelView,
  type TraceDataPanelTab,
} from '@mastra/playground-ui/domains/traces/components/trace-data-panel-view';
import { useState, type ComponentProps, type ReactNode } from 'react';

type TraceDataPanelProps = Omit<ComponentProps<typeof TraceDataPanelView>, 'activeTab' | 'headerActionSlot'> & {
  /**
   * Header action. Gets `showTab` so an action can hand the user over to the tab
   * that shows its result (e.g. scoring reveals the Scorers tab).
   */
  headerActionSlot?: (args: { showTab: (tab: TraceDataPanelTab) => void }) => ReactNode;
};

/**
 * Owns the trace panel's active tab. Mount it with a `key` on the trace (and anchor span)
 * so a tab selected on a previous trace never leaks into the next one.
 */
export function TraceDataPanel({ onTabChange, headerActionSlot, ...props }: TraceDataPanelProps) {
  const [activeTab, setActiveTab] = useState<TraceDataPanelTab>('details');

  const showTab = (tab: TraceDataPanelTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  return (
    <TraceDataPanelView
      {...props}
      activeTab={activeTab}
      onTabChange={showTab}
      headerActionSlot={headerActionSlot?.({ showTab })}
    />
  );
}
