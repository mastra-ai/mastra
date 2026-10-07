import type { LatencyMetricsData, LatencyPoint } from '@mastra/react/hooks/metrics';
import { MetricsCard } from '../../../../ds/components/MetricsCard/metrics-card';
import { MetricsLineChart } from '../../../../ds/components/MetricsLineChart/metrics-line-chart';
import { MetricsLineChartLegend } from '../../../../ds/components/MetricsLineChart/metrics-line-chart-legend';
import { TabContent } from '../../../../ds/components/Tabs/tabs-content';
import { TabList } from '../../../../ds/components/Tabs/tabs-list';
import { Tabs } from '../../../../ds/components/Tabs/tabs-root';
import { Tab } from '../../../../ds/components/Tabs/tabs-tab';
import { CHART_COLORS } from '../metrics-utils';
import { averageLatency, isDrillablePoint, isLatencyTab } from './latency-card.utils';
import type { LatencyTab } from './latency-card.utils';

const latencySeries = [
  {
    dataKey: 'p50',
    label: 'p50',
    color: CHART_COLORS.blue,
    aggregate: (data: Record<string, unknown>[]) => ({ value: averageLatency(data, 'p50'), suffix: 'avg ms' }),
  },
  {
    dataKey: 'p95',
    label: 'p95',
    color: CHART_COLORS.amber,
    aggregate: (data: Record<string, unknown>[]) => ({ value: averageLatency(data, 'p95'), suffix: 'avg ms' }),
  },
];

export interface LatencyCardContentProps {
  data: LatencyMetricsData;
  /** Active tab; must be a tab that has data. */
  activeTab: LatencyTab;
  onTabChange: (tab: LatencyTab) => void;
  /** No handler means chart nodes are not clickable. */
  onBucketClick?: (tab: LatencyTab, point: LatencyPoint) => void;
}

export function LatencyCardContent({ data, activeTab, onTabChange, onBucketClick }: LatencyCardContentProps) {
  const byTab: Record<LatencyTab, LatencyPoint[]> = {
    agents: data.agentData,
    workflows: data.workflowData,
    tools: data.toolData,
  };

  if (byTab.agents.length === 0 && byTab.workflows.length === 0 && byTab.tools.length === 0) {
    return <MetricsCard.NoData message="No latency data yet" />;
  }

  const chartFor = (tab: LatencyTab) => (
    <MetricsLineChart
      data={byTab[tab]}
      series={latencySeries}
      showLegend={false}
      onPointClick={
        onBucketClick ? point => (isDrillablePoint(point) ? onBucketClick(tab, point) : undefined) : undefined
      }
    />
  );

  return (
    <MetricsCard.Content>
      <Tabs
        value={activeTab}
        onValueChange={value => {
          if (isLatencyTab(value) && byTab[value].length > 0) onTabChange(value);
        }}
        defaultTab={activeTab}
        className="overflow-visible"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 [&>:first-child]:w-auto">
          <TabList>
            <Tab
              value="agents"
              disabled={byTab.agents.length === 0}
              disabledTooltip="No agent latency data for this period"
            >
              Agents
            </Tab>
            <Tab
              value="workflows"
              disabled={byTab.workflows.length === 0}
              disabledTooltip="No workflow latency data for this period"
            >
              Workflows
            </Tab>
            <Tab
              value="tools"
              disabled={byTab.tools.length === 0}
              disabledTooltip="No tool latency data for this period"
            >
              Tools
            </Tab>
          </TabList>
          <MetricsLineChartLegend data={byTab[activeTab]} series={latencySeries} />
        </div>
        <TabContent value="agents" className="pt-3">
          {chartFor('agents')}
        </TabContent>
        <TabContent value="workflows" className="pt-3">
          {chartFor('workflows')}
        </TabContent>
        <TabContent value="tools" className="pt-3">
          {chartFor('tools')}
        </TabContent>
      </Tabs>
    </MetricsCard.Content>
  );
}
