import { useState } from 'react';
import type { ReactNode } from 'react';
import { MetricsCard } from '../../../ds/components/MetricsCard/metrics-card';
import { MetricsLineChart } from '../../../ds/components/MetricsLineChart/metrics-line-chart';
import { MetricsLineChartLegend } from '../../../ds/components/MetricsLineChart/metrics-line-chart-legend';
import { TabContent } from '../../../ds/components/Tabs/tabs-content';
import { TabList } from '../../../ds/components/Tabs/tabs-list';
import { Tabs } from '../../../ds/components/Tabs/tabs-root';
import { Tab } from '../../../ds/components/Tabs/tabs-tab';
import type { LatencyPoint } from '../hooks/use-latency-metrics';
import type { MetricsInterval } from '../metrics-interval';
import { averageLatency, isDrillablePoint, isLatencyTab } from './latency-card-view.utils';
import type { LatencyTab } from './latency-card-view.utils';
import { CHART_COLORS } from './metrics-utils';

const latencySeries = [
  {
    dataKey: 'p50',
    label: 'p50',
    color: CHART_COLORS.blue,
    aggregate: (data: Record<string, unknown>[]) => ({
      value: averageLatency(data, 'p50'),
      suffix: 'avg ms',
    }),
  },
  {
    dataKey: 'p95',
    label: 'p95',
    color: CHART_COLORS.yellow,
    aggregate: (data: Record<string, unknown>[]) => ({
      value: averageLatency(data, 'p95'),
      suffix: 'avg ms',
    }),
  },
];

export type { LatencyTab };

function LatencyChart({ data, onPointClick }: { data: LatencyPoint[]; onPointClick?: (point: LatencyPoint) => void }) {
  if (data.length === 0) {
    return <MetricsCard.NoData message="No latency data yet" />;
  }
  return (
    <MetricsLineChart
      data={data}
      series={latencySeries}
      showLegend={false}
      onPointClick={onPointClick ? point => (isDrillablePoint(point) ? onPointClick(point) : undefined) : undefined}
    />
  );
}

export interface LatencyCardViewProps {
  data:
    | {
        agentData: LatencyPoint[];
        workflowData: LatencyPoint[];
        toolData: LatencyPoint[];
        /** Bucket size of the points. Defaults to `'1h'`. */
        interval?: MetricsInterval;
      }
    | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Optional drilldown: invoked when a chart node is clicked. Container provides the navigation. */
  onPointClick?: (tab: LatencyTab, point: LatencyPoint, interval: MetricsInterval) => void;
  /**
   * Optional slot for top-bar action buttons (e.g. "View in Traces").
   * Pass a function to receive the active tab so the action can scope itself to the current entity type.
   */
  actions?: ReactNode | ((tab: LatencyTab) => ReactNode);
}

export function LatencyCardView({ data, isLoading, isError, onPointClick, actions }: LatencyCardViewProps) {
  const agentsHasData = (data?.agentData.length ?? 0) > 0;
  const workflowsHasData = (data?.workflowData.length ?? 0) > 0;
  const toolsHasData = (data?.toolData.length ?? 0) > 0;
  const tabHasData = {
    agents: agentsHasData,
    workflows: workflowsHasData,
    tools: toolsHasData,
  } as const;
  const initialTab: LatencyTab = agentsHasData
    ? 'agents'
    : workflowsHasData
      ? 'workflows'
      : toolsHasData
        ? 'tools'
        : 'agents';
  const [selectedTab, setSelectedTab] = useState<LatencyTab>('agents');
  const activeTab = tabHasData[selectedTab] ? selectedTab : initialTab;
  const renderedActions = typeof actions === 'function' ? actions(activeTab) : actions;
  const interval = data?.interval ?? '1h';
  const hasData = !!data && (data.agentData.length > 0 || data.workflowData.length > 0 || data.toolData.length > 0);
  const activeData = data
    ? { agents: data.agentData, workflows: data.workflowData, tools: data.toolData }[activeTab]
    : [];

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription
          title="Latency"
          description={interval === '1h' ? 'Hourly p50 and p95 latency.' : 'Daily p50 and p95 latency.'}
        />
        {renderedActions ? <MetricsCard.Actions>{renderedActions}</MetricsCard.Actions> : null}
      </MetricsCard.TopBar>
      {isLoading ? (
        <MetricsCard.Loading />
      ) : isError ? (
        <MetricsCard.Error message="Couldn’t load latency" />
      ) : (
        <MetricsCard.Content>
          {!hasData ? (
            <MetricsCard.NoData message="No latency data yet" />
          ) : (
            <Tabs
              value={activeTab}
              onValueChange={value => {
                if (isLatencyTab(value) && tabHasData[value]) {
                  setSelectedTab(value);
                }
              }}
              defaultTab={initialTab}
              className="overflow-visible"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 [&>:first-child]:w-auto">
                <TabList>
                  <Tab value="agents" disabled={!agentsHasData} disabledTooltip="No agent latency data for this period">
                    Agents
                  </Tab>
                  <Tab
                    value="workflows"
                    disabled={!workflowsHasData}
                    disabledTooltip="No workflow latency data for this period"
                  >
                    Workflows
                  </Tab>
                  <Tab value="tools" disabled={!toolsHasData} disabledTooltip="No tool latency data for this period">
                    Tools
                  </Tab>
                </TabList>
                {activeData.length > 0 && <MetricsLineChartLegend data={activeData} series={latencySeries} />}
              </div>
              <TabContent value="agents" className="pt-3">
                <LatencyChart
                  data={data.agentData}
                  onPointClick={onPointClick ? p => onPointClick('agents', p, interval) : undefined}
                />
              </TabContent>
              <TabContent value="workflows" className="pt-3">
                <LatencyChart
                  data={data.workflowData}
                  onPointClick={onPointClick ? p => onPointClick('workflows', p, interval) : undefined}
                />
              </TabContent>
              <TabContent value="tools" className="pt-3">
                <LatencyChart
                  data={data.toolData}
                  onPointClick={onPointClick ? p => onPointClick('tools', p, interval) : undefined}
                />
              </TabContent>
            </Tabs>
          )}
        </MetricsCard.Content>
      )}
    </MetricsCard>
  );
}
