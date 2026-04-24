import { HorizontalBars } from '../../../ds/components/HorizontalBars';
import { MetricsCard } from '../../../ds/components/MetricsCard';
import { Tab, TabContent, TabList, Tabs } from '../../../ds/components/Tabs';
import type { VolumeRow } from '../hooks/use-trace-volume-metrics';
import { CHART_COLORS, formatCompact } from './metrics-utils';

function VolumeBars({ data }: { data: VolumeRow[] }) {
  return (
    <HorizontalBars
      data={data.map(d => ({ name: d.name, values: [d.completed, d.errors] }))}
      segments={[
        { label: 'Completed', color: CHART_COLORS.blueDark },
        { label: 'Errors', color: CHART_COLORS.pink },
      ]}
      maxVal={Math.max(...data.map(d => d.completed + d.errors))}
      fmt={formatCompact}
    />
  );
}

export interface TracesVolumeCardViewProps {
  data: { agentData: VolumeRow[]; workflowData: VolumeRow[]; toolData: VolumeRow[] } | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function TracesVolumeCardView({ data, isLoading, isError }: TracesVolumeCardViewProps) {
  const hasData = !!data && (data.agentData.length > 0 || data.workflowData.length > 0 || data.toolData.length > 0);
  const total = data
    ? [...data.agentData, ...data.workflowData, ...data.toolData].reduce((s, d) => s + d.completed + d.errors, 0)
    : 0;

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Trace Volume" description="Runs and call counts." />
        {hasData && <MetricsCard.Summary value={formatCompact(total)} label="Total runs" />}
      </MetricsCard.TopBar>
      {isLoading ? (
        <MetricsCard.Loading />
      ) : isError ? (
        <MetricsCard.Error message="Failed to load trace volume data" />
      ) : (
        <MetricsCard.Content>
          {!hasData ? (
            <MetricsCard.NoData message="No trace volume data yet" />
          ) : (
            <Tabs defaultTab="agents" className="grid grid-rows-[auto_1fr] overflow-y-auto h-full">
              <TabList>
                <Tab value="agents">Agents</Tab>
                <Tab value="workflows">Workflows</Tab>
                <Tab value="tools">Tools</Tab>
              </TabList>
              <TabContent value="agents">
                {data.agentData.length > 0 ? (
                  <VolumeBars data={data.agentData} />
                ) : (
                  <MetricsCard.NoData message="No agent data yet" />
                )}
              </TabContent>
              <TabContent value="workflows">
                {data.workflowData.length > 0 ? (
                  <VolumeBars data={data.workflowData} />
                ) : (
                  <MetricsCard.NoData message="No workflow data yet" />
                )}
              </TabContent>
              <TabContent value="tools">
                {data.toolData.length > 0 ? (
                  <VolumeBars data={data.toolData} />
                ) : (
                  <MetricsCard.NoData message="No tool data yet" />
                )}
              </TabContent>
            </Tabs>
          )}
        </MetricsCard.Content>
      )}
    </MetricsCard>
  );
}
