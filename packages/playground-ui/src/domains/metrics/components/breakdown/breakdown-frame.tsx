import type { ReactNode } from 'react';
import type { DrilldownScope } from '../../drilldown';
import type { BreakdownTab } from '../../lib/breakdown';
import { ChartCard } from '../chart-card';

export const BREAKDOWN_TITLE = 'Breakdown';

const TAB_TITLE: Record<BreakdownTab, string> = {
  projects: 'Breakdown by project',
  agents: 'Breakdown by agent',
  workflows: 'Breakdown by workflow',
  tools: 'Breakdown by tool',
  models: 'Breakdown by model',
  threads: 'Breakdown by thread',
  environments: 'Breakdown by environment',
};

/** What every tab passes down: the tab list, and what a tab change or row click does. */
export type BreakdownFrameProps = {
  tabs: BreakdownTab[];
  onTabChange: (tab: BreakdownTab) => void;
  onRowClick?: (scope: DrilldownScope) => void;
  byProject: boolean;
};

/** The card shell around every tab's state, so loading, errors and rows share one layout. */
export function BreakdownFrame({
  tab,
  tabs,
  onTabChange,
  isUpdating,
  children,
}: BreakdownFrameProps & { tab: BreakdownTab; isUpdating?: boolean; children: ReactNode }) {
  return (
    <ChartCard
      title={TAB_TITLE[tab]}
      titleMenu={
        tabs.length > 1
          ? {
              value: tab,
              onValueChange: v => onTabChange(v as BreakdownTab),
              options: tabs.map(t => ({ value: t, label: TAB_TITLE[t] })),
            }
          : undefined
      }
      isUpdating={isUpdating}
      bodyHeight="fit"
    >
      {children}
    </ChartCard>
  );
}
