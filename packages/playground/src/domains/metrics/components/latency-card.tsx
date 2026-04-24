import { EntityType } from '@mastra/core/observability';
import { MetricsCard, MetricsLineChart, Tabs, TabList, Tab, TabContent } from '@mastra/playground-ui';
import { useNavigate } from 'react-router';
import { useDrilldown } from '../hooks/use-drilldown';
import { useLatencyMetrics } from '../hooks/use-latency-metrics';
import type { LatencyPoint } from '../hooks/use-latency-metrics';
import { OpenInTracesButton } from './card-action-buttons';
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

/** Map active Latency tab to the root entity type used by the traces filter. */
const TAB_TO_ROOT_ENTITY: Record<string, EntityType> = {
  agents: EntityType.AGENT,
  workflows: EntityType.WORKFLOW_RUN,
  tools: EntityType.TOOL,
};

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

export function LatencyCard() {
  const { data, isLoading, isError } = useLatencyMetrics();
  const { getTracesHref, getBucketTracesHref } = useDrilldown();
  const navigate = useNavigate();

  const hasData = !!data && (data.agentData.length > 0 || data.workflowData.length > 0 || data.toolData.length > 0);
  const avgP50 =
    data && data.agentData.length > 0
      ? `${Math.round(data.agentData.reduce((s, d) => s + d.p50, 0) / data.agentData.length)}ms`
      : '—';

  // Per-tab point-click handlers: narrow to the 1h bucket the node represents
  // and carry the tab's root entity type so the drilldown scope is precise.
  const handlePointClick = (rootEntityType: EntityType) => (point: LatencyPoint) => {
    const tsMs = new Date(String(point.rawTimestamp)).getTime();
    void navigate(getBucketTracesHref({ rootEntityType }, tsMs, '1h'));
  };

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Latency" description="Hourly p50 and p95 latency." />
        {hasData && <MetricsCard.Summary value={avgP50} label="Avg p50" />}
        {hasData && (
          <MetricsCard.Actions>
            <OpenInTracesButton href={getTracesHref({ rootEntityType: TAB_TO_ROOT_ENTITY.agents })} />
          </MetricsCard.Actions>
        )}
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
            <Tabs defaultTab="agents" className="overflow-visible">
              <TabList>
                <Tab value="agents">Agents</Tab>
                <Tab value="workflows">Workflows</Tab>
                <Tab value="tools">Tools</Tab>
              </TabList>
              <TabContent value="agents">
                <LatencyChart data={data.agentData} onPointClick={handlePointClick(TAB_TO_ROOT_ENTITY.agents)} />
              </TabContent>
              <TabContent value="workflows">
                <LatencyChart data={data.workflowData} onPointClick={handlePointClick(TAB_TO_ROOT_ENTITY.workflows)} />
              </TabContent>
              <TabContent value="tools">
                <LatencyChart data={data.toolData} onPointClick={handlePointClick(TAB_TO_ROOT_ENTITY.tools)} />
              </TabContent>
            </Tabs>
          )}
        </MetricsCard.Content>
      )}
    </MetricsCard>
  );
}
