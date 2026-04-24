import { EntityType } from '@mastra/core/observability';
import { HorizontalBars, MetricsCard, Tabs, TabList, Tab, TabContent } from '@mastra/playground-ui';
import { useState } from 'react';
import { useDrilldown } from '../hooks/use-drilldown';
import { useTraceVolumeMetrics } from '../hooks/use-trace-volume-metrics';
import type { VolumeRow } from '../hooks/use-trace-volume-metrics';
import { OpenErrorsInLogsButton, OpenInTracesButton } from './card-action-buttons';
import { CHART_COLORS, formatCompact } from './metrics-utils';

type VolumeTab = 'agents' | 'workflows' | 'tools';

const ROOT_ENTITY_TYPE_BY_TAB: Record<VolumeTab, EntityType> = {
  agents: EntityType.AGENT,
  workflows: EntityType.WORKFLOW_RUN,
  tools: EntityType.TOOL,
};

function VolumeBars({ data, rootEntityType }: { data: VolumeRow[]; rootEntityType: EntityType }) {
  const { getTracesHref } = useDrilldown();
  return (
    <HorizontalBars
      data={data.map(d => ({
        name: d.name,
        values: [d.completed, d.errors],
        href: getTracesHref({ rootEntityType, entityName: d.name }),
        hrefs: [
          // Completed segment reuses the row's href — no extra filter needed.
          undefined,
          // Errors segment drills into traces scoped to this entity *and* status=error.
          getTracesHref({ rootEntityType, entityName: d.name, status: 'error' }),
        ],
      }))}
      segments={[
        { label: 'Completed', color: CHART_COLORS.blueDark },
        { label: 'Errors', color: CHART_COLORS.pink },
      ]}
      maxVal={Math.max(...data.map(d => d.completed + d.errors))}
      fmt={formatCompact}
    />
  );
}

export function TracesVolumeCard() {
  const [activeTab, setActiveTab] = useState<VolumeTab>('agents');
  const { data, isLoading, isError } = useTraceVolumeMetrics();
  const { getTracesHref, getLogsHref } = useDrilldown();

  const hasData = !!data && (data.agentData.length > 0 || data.workflowData.length > 0 || data.toolData.length > 0);
  const total = data
    ? [...data.agentData, ...data.workflowData, ...data.toolData].reduce((s, d) => s + d.completed + d.errors, 0)
    : 0;

  const activeRootEntityType = ROOT_ENTITY_TYPE_BY_TAB[activeTab];

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Trace Volume" description="Runs and call counts." />
        {hasData && <MetricsCard.Summary value={formatCompact(total)} label="Total runs" />}
        <MetricsCard.Actions>
          <OpenInTracesButton href={getTracesHref({ rootEntityType: activeRootEntityType })} />
          <OpenErrorsInLogsButton href={getLogsHref({ rootEntityType: activeRootEntityType, status: 'error' })} />
        </MetricsCard.Actions>
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
            <Tabs
              defaultTab="agents"
              value={activeTab}
              onValueChange={v => setActiveTab(v as VolumeTab)}
              className="grid grid-rows-[auto_1fr] overflow-y-auto h-full"
            >
              <TabList>
                <Tab value="agents">Agents</Tab>
                <Tab value="workflows">Workflows</Tab>
                <Tab value="tools">Tools</Tab>
              </TabList>
              <TabContent value="agents">
                {data.agentData.length > 0 ? (
                  <VolumeBars data={data.agentData} rootEntityType={EntityType.AGENT} />
                ) : (
                  <MetricsCard.NoData message="No agent data yet" />
                )}
              </TabContent>
              <TabContent value="workflows">
                {data.workflowData.length > 0 ? (
                  <VolumeBars data={data.workflowData} rootEntityType={EntityType.WORKFLOW_RUN} />
                ) : (
                  <MetricsCard.NoData message="No workflow data yet" />
                )}
              </TabContent>
              <TabContent value="tools">
                {data.toolData.length > 0 ? (
                  <VolumeBars data={data.toolData} rootEntityType={EntityType.TOOL} />
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
