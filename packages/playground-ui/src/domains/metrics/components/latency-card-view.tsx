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

function LatencyChart({ data }: { data: LatencyPoint[] }) {
  if (data.length === 0) {
    return <MetricsCard.NoData message="No latency data yet" />;
  }
  return <MetricsLineChart data={data} series={latencySeries} />;
}

export interface LatencyCardViewProps {
  data: { agentData: LatencyPoint[]; workflowData: LatencyPoint[]; toolData: LatencyPoint[] } | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function LatencyCardView({ data, isLoading, isError }: LatencyCardViewProps) {
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
              defaultTab={
                data.agentData.length > 0
                  ? 'agents'
                  : data.workflowData.length > 0
                    ? 'workflows'
                    : data.toolData.length > 0
                      ? 'tools'
                      : 'agents'
              }
              className="overflow-visible"
            >
              <TabList>
                <Tab value="agents">Agents</Tab>
                <Tab value="workflows">Workflows</Tab>
                <Tab value="tools">Tools</Tab>
              </TabList>
              <TabContent value="agents">
                <LatencyChart data={data.agentData} />
              </TabContent>
              <TabContent value="workflows">
                <LatencyChart data={data.workflowData} />
              </TabContent>
              <TabContent value="tools">
                <LatencyChart data={data.toolData} />
              </TabContent>
            </Tabs>
          )}
        </MetricsCard.Content>
      )}
    </MetricsCard>
  );
}
