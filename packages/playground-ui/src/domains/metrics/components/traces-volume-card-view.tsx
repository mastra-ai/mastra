import { useState, type ReactNode } from 'react';
import { HorizontalBars } from '../../../ds/components/HorizontalBars';
import { MetricsCard } from '../../../ds/components/MetricsCard';
import { Tab, TabContent, TabList, Tabs } from '../../../ds/components/Tabs';
import type { VolumeRow } from '../hooks/use-trace-volume-metrics';
import { CHART_COLORS, formatCompact } from './metrics-utils';

export type VolumeTab = 'agents' | 'workflows' | 'tools';

function VolumeBars({
  data,
  rowHrefs,
  errorHrefs,
}: {
  data: VolumeRow[];
  rowHrefs?: (row: VolumeRow) => string | undefined;
  errorHrefs?: (row: VolumeRow) => string | undefined;
}) {
  return (
    <HorizontalBars
      data={data.map(d => {
        const errorHref = errorHrefs?.(d);
        const hasErrorHref = !!errorHref;
        return {
          name: d.name,
          values: [d.completed, d.errors],
          href: rowHrefs?.(d),
          ...(hasErrorHref ? { hrefs: [undefined, errorHref] } : {}),
        };
      })}
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
  /** Optional drilldown: returns href for clicking a whole bar row. */
  getRowHref?: (tab: VolumeTab, row: VolumeRow) => string | undefined;
  /** Optional drilldown: returns href for clicking the "Errors" segment of a bar. */
  getErrorSegmentHref?: (tab: VolumeTab, row: VolumeRow) => string | undefined;
  /**
   * Optional slot for top-bar action buttons.
   * Pass a function to receive the active tab so actions can scope themselves to the current entity type.
   */
  actions?: ReactNode | ((tab: VolumeTab) => ReactNode);
}

export function TracesVolumeCardView({
  data,
  isLoading,
  isError,
  getRowHref,
  getErrorSegmentHref,
  actions,
}: TracesVolumeCardViewProps) {
  const [activeTab, setActiveTab] = useState<VolumeTab>('agents');
  const renderedActions = typeof actions === 'function' ? actions(activeTab) : actions;
  const hasData = !!data && (data.agentData.length > 0 || data.workflowData.length > 0 || data.toolData.length > 0);
  const total = data
    ? [...data.agentData, ...data.workflowData, ...data.toolData].reduce((s, d) => s + d.completed + d.errors, 0)
    : 0;

  const tabRowHrefs = (tab: VolumeTab) => (getRowHref ? (row: VolumeRow) => getRowHref(tab, row) : undefined);
  const tabErrorHrefs = (tab: VolumeTab) =>
    getErrorSegmentHref ? (row: VolumeRow) => getErrorSegmentHref(tab, row) : undefined;

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Trace Volume" description="Runs and call counts." />
        {hasData && <MetricsCard.Summary value={formatCompact(total)} label="Total runs" />}
        {hasData && renderedActions ? <MetricsCard.Actions>{renderedActions}</MetricsCard.Actions> : null}
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
              value={activeTab}
              onValueChange={setActiveTab}
              defaultTab="agents"
              className="grid grid-rows-[auto_1fr] overflow-y-auto h-full"
            >
              <TabList>
                <Tab value="agents">Agents</Tab>
                <Tab value="workflows">Workflows</Tab>
                <Tab value="tools">Tools</Tab>
              </TabList>
              <TabContent value="agents">
                {data.agentData.length > 0 ? (
                  <VolumeBars
                    data={data.agentData}
                    rowHrefs={tabRowHrefs('agents')}
                    errorHrefs={tabErrorHrefs('agents')}
                  />
                ) : (
                  <MetricsCard.NoData message="No agent data yet" />
                )}
              </TabContent>
              <TabContent value="workflows">
                {data.workflowData.length > 0 ? (
                  <VolumeBars
                    data={data.workflowData}
                    rowHrefs={tabRowHrefs('workflows')}
                    errorHrefs={tabErrorHrefs('workflows')}
                  />
                ) : (
                  <MetricsCard.NoData message="No workflow data yet" />
                )}
              </TabContent>
              <TabContent value="tools">
                {data.toolData.length > 0 ? (
                  <VolumeBars
                    data={data.toolData}
                    rowHrefs={tabRowHrefs('tools')}
                    errorHrefs={tabErrorHrefs('tools')}
                  />
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
