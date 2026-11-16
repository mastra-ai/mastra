import { useState } from 'react';
import type { DrilldownScope } from '../drilldown';
import { useMetricsScope } from '../hooks/use-metrics-scope';
import { useSpanAggregateGate } from '../hooks/use-metrics-span-aggregate';
import { useTraceAggregateGate } from '../hooks/use-metrics-trace-aggregate';
import type { BreakdownTab } from '../lib/breakdown';
import { BREAKDOWN_TITLE } from './breakdown/breakdown-frame';
import { BreakdownProjectsFirst } from './breakdown/breakdown-projects-first';
import { BreakdownTabBody } from './breakdown/breakdown-tab-body';
import { ChartCard } from './chart-card';
import { MetricsCard } from '@/ds/components/MetricsCard';

const PROJECT_TABS: BreakdownTab[] = ['projects', 'agents', 'workflows', 'tools', 'models', 'threads', 'environments'];
const TABS: BreakdownTab[] = PROJECT_TABS.filter(t => t !== 'projects');

export type BreakdownCardProps = {
  /**
   * Called with the clicked row as a drilldown scope: `span` for an agent, workflow or tool (its
   * runs, nested ones included), `projectId` for a project, `environment` for an environment.
   * Rows of an organization-wide page also carry their `projectId`.
   */
  onRowClick?: (scope: DrilldownScope) => void;
};

/**
 * One table for "where is the volume, the failures, the latency and the spend": per project
 * (organization pages only), agent, workflow, tool, model, thread or environment. Columns sort;
 * the strip and the Share column always show the share of runs or traces, whatever the sort.
 */
export function BreakdownCard({ onRowClick }: BreakdownCardProps) {
  const byProject = useMetricsScope().projectLabel !== undefined;
  const traceGate = useTraceAggregateGate();
  const spanGate = useSpanAggregateGate();
  const [chosen, setChosen] = useState<BreakdownTab>();

  if (traceGate.status === 'unavailable' || spanGate.status === 'unavailable') return null;
  if (traceGate.status === 'loading' || spanGate.status === 'loading') {
    return (
      <ChartCard title={BREAKDOWN_TITLE} bodyHeight="fit">
        <MetricsCard.Loading />
      </ChartCard>
    );
  }

  const frame = { tabs: byProject ? PROJECT_TABS : TABS, onTabChange: setChosen, onRowClick, byProject };
  if (byProject && traceGate.status === 'ready') {
    return <BreakdownProjectsFirst {...frame} chosen={chosen} traceScope={traceGate.scope} spanGate={spanGate} />;
  }
  return <BreakdownTabBody {...frame} tab={chosen ?? 'agents'} traceGate={traceGate} spanGate={spanGate} />;
}
