import type { ReactNode } from 'react';
import type { DrilldownScope } from '../../drilldown';
import type { BreakdownTab } from '../../lib/breakdown';
import { ChartCard } from '../chart-card';

export const BREAKDOWN_TITLE = 'Breakdown';

/** Each tab's name under the card title, as the Breakdown widget shortens its views' labels ("Breakdown by agent"). */
const TAB_LABEL: Record<BreakdownTab, string> = {
  projects: 'Projects',
  agents: 'Agents',
  workflows: 'Workflows',
  tools: 'Tools',
  models: 'Models',
  threads: 'Threads',
  environments: 'Environments',
};

/** What every tab's body gets: what a row click does, and whether rows are per project. */
export type BreakdownBodyProps = {
  onRowClick?: (scope: DrilldownScope) => void;
  byProject: boolean;
};

/** What the card passes down: the tab list and what a tab change does, and the bodies' props. */
export type BreakdownFrameProps = BreakdownBodyProps & {
  tabs: BreakdownTab[];
  onTabChange: (tab: BreakdownTab) => void;
};

/**
 * The card shell, with the tab list, around every tab's body (loading, errors and rows). It stays
 * mounted while the bodies swap, so the tabs keep their place, focus and sliding pill, as on the
 * other cards. Each body dims its own rows while they reload (`ChartArea`'s `isUpdating`).
 */
export function BreakdownFrame({
  tab,
  tabs,
  onTabChange,
  children,
}: Pick<BreakdownFrameProps, 'tabs' | 'onTabChange'> & { tab: BreakdownTab; children: ReactNode }) {
  return (
    <ChartCard
      title={BREAKDOWN_TITLE}
      tabs={
        tabs.length > 1
          ? {
              value: tab,
              onValueChange: onTabChange,
              options: tabs.map(t => ({ value: t, label: TAB_LABEL[t] })),
            }
          : undefined
      }
      bodyHeight="fit"
    >
      {children}
    </ChartCard>
  );
}
