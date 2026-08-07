import { useState } from 'react';
import type { ReactNode } from 'react';
import { MetricsCard } from '../../../ds/components/MetricsCard/metrics-card';
import { MetricsLineChart } from '../../../ds/components/MetricsLineChart/metrics-line-chart';
import { TabContent } from '../../../ds/components/Tabs/tabs-content';
import { TabList } from '../../../ds/components/Tabs/tabs-list';
import { Tabs } from '../../../ds/components/Tabs/tabs-root';
import { Tab } from '../../../ds/components/Tabs/tabs-tab';
import type { LatencyPoint } from '../hooks/use-latency-metrics';
import { CHART_COLORS } from './metrics-utils';

const latencySeries = [
  {
    dataKey: 'p50',
    label: 'p50',
    color: CHART_COLORS.blue,
    aggregate: (data: Record<string, unknown>[]) => ({
      value: data.length > 0 ? `${Math.round(data.reduce((s, d) => s + (d.p50 as number), 0) / data.length)}` : '0',
      suffix: 'avg ms',
    }),
  },
  {
    dataKey: 'p95',
    label: 'p95',
    color: CHART_COLORS.yellow,
    aggregate: (data: Record<string, unknown>[]) => ({
      value: data.length > 0 ? `${Math.round(data.reduce((s, d) => s + (d.p95 as number), 0) / data.length)}` : '0',
      suffix: 'avg ms',
    }),
  },
];

export type LatencyTab = 'agents' | 'workflows' | 'tools';

function isLatencyTab(value: string): value is LatencyTab {
  return value === 'agents' || value === 'workflows' || value === 'tools';
}

function LatencyChart({ data, onPointClick }: { data: LatencyPoint[]; onPointClick?: (point: LatencyPoint) => void }) {
  if (data.length === 0) {
    return <MetricsCard.NoData message="No latency data yet" />;
  }
  return (
    <MetricsLineChart
      data={data}
      series={latencySeries}
      onPointClick={
        onPointClick
          ? point => {
              const p = point as LatencyPoint;
              if (typeof p?.tsMs === 'number' && Number.isFinite(p.tsMs)) onPointClick(p);
            }
          : undefined
      }
    />
  );
}

export interface LatencyCardViewProps {
  data: { agentData: LatencyPoint[]; workflowData: LatencyPoint[]; toolData: LatencyPoint[] } | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Optional drilldown: invoked when a chart node is clicked. Container provides the navigation. */
  onPointClick?: (tab: LatencyTab, point: LatencyPoint) => void;
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
  const hasData = !!data && (data.agentData.length > 0 || data.workflowData.length > 0 || data.toolData.length > 0);
  const p50Values = data
    ? Object.values(data)
        .filter(Array.isArray)
        .flat()
        .map(d => d.p50)
        .filter((v): v is number => typeof v === 'number')
    : [];
  const avgP50 =
    p50Values.length > 0 ? `${Math.round(p50Values.reduce((s, v) => s + v, 0) / p50Values.length)}ms` : '—';

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Latency" description="Hourly p50 and p95 latency." />
        {hasData && <MetricsCard.Summary value={avgP50} label="Avg p50" />}
        {renderedActions ? <MetricsCard.Actions>{renderedActions}</MetricsCard.Actions> : null}
      </MetricsCard.TopBar>
      {isLoading ? (
        <MetricsCard.Loading />
      ) : isError ? (
        <MetricsCard.Error message="Failed to load latency data" />
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
              <TabContent value="agents">
                <LatencyChart
                  data={data.agentData}
                  onPointClick={onPointClick ? p => onPointClick('agents', p) : undefined}
                />
              </TabContent>
              <TabContent value="workflows">
                <LatencyChart
                  data={data.workflowData}
                  onPointClick={onPointClick ? p => onPointClick('workflows', p) : undefined}
                />
              </TabContent>
              <TabContent value="tools">
                <LatencyChart
                  data={data.toolData}
                  onPointClick={onPointClick ? p => onPointClick('tools', p) : undefined}
                />
              </TabContent>
            </Tabs>
          )}
        </MetricsCard.Content>
      )}
    </MetricsCard>
  );
}
