import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { MetricsCard } from '../../../ds/components/MetricsCard';
import { MetricsLineChart } from '../../../ds/components/MetricsLineChart';
import { Tab, TabContent, TabList, Tabs } from '../../../ds/components/Tabs';
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
              if (typeof p?.rawTimestamp === 'string') onPointClick(p);
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
  const initialTab: LatencyTab = !data
    ? 'agents'
    : data.agentData.length > 0
      ? 'agents'
      : data.workflowData.length > 0
        ? 'workflows'
        : data.toolData.length > 0
          ? 'tools'
          : 'agents';
  const [activeTab, setActiveTab] = useState<LatencyTab>(initialTab);
  // Resync to a non-empty tab when async data finishes loading. Without this,
  // a card that mounts before data arrives stays stuck on `agents` even when
  // only workflow/tool data exists.
  useEffect(() => {
    if (!data) return;
    const tabHasData = {
      agents: data.agentData.length > 0,
      workflows: data.workflowData.length > 0,
      tools: data.toolData.length > 0,
    } as const;
    if (!tabHasData[activeTab] && tabHasData[initialTab]) {
      setActiveTab(initialTab);
    }
  }, [data, activeTab, initialTab]);
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
            <Tabs value={activeTab} onValueChange={setActiveTab} defaultTab={initialTab} className="overflow-visible">
              <TabList>
                <Tab value="agents">Agents</Tab>
                <Tab value="workflows">Workflows</Tab>
                <Tab value="tools">Tools</Tab>
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
