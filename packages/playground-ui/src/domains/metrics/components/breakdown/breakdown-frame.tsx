import type { ReactNode } from 'react';
import type { DrilldownScope } from '../../drilldown';
import type { BreakdownTab } from '../../lib/breakdown';
import { ChartCard } from '../chart-card';
import { MetricsCard } from '@/ds/components/MetricsCard';

export const BREAKDOWN_TITLE = 'Breakdown';

const TAB_LABEL: Record<BreakdownTab, string> = {
  projects: 'Projects',
  agents: 'Agents',
  workflows: 'Workflows',
  tools: 'Tools',
  models: 'Models',
  threads: 'Threads',
  environments: 'Environments',
};

const DESCRIPTION: Record<BreakdownTab, string> = {
  projects: 'Traces, errors, latency and spend per project.',
  agents: 'Every agent run, nested ones included, with errors, latency and spend.',
  workflows: 'Every workflow run, nested ones included, with errors and latency.',
  tools: 'Every tool call, MCP tools included, with errors and latency.',
  models: 'Tokens and spend per model.',
  threads: 'Traces, errors, latency and spend per thread.',
  environments: 'Traces, errors, latency and spend per environment.',
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
      title={BREAKDOWN_TITLE}
      description={DESCRIPTION[tab]}
      isUpdating={isUpdating}
      bodyHeight="fit"
      toolbar={
        <MetricsCard.Toolbar>
          <MetricsCard.Tabs<BreakdownTab> value={tab} onValueChange={onTabChange}>
            {tabs.map(t => (
              <MetricsCard.Tab key={t} value={t}>
                {TAB_LABEL[t]}
              </MetricsCard.Tab>
            ))}
          </MetricsCard.Tabs>
        </MetricsCard.Toolbar>
      }
    >
      {children}
    </ChartCard>
  );
}
