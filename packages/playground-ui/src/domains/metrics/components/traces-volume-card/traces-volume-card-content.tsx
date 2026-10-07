import type { TraceVolumeData, VolumeRow } from '@mastra/react/hooks/metrics';
import { MetricsCard } from '../../../../ds/components/MetricsCard/metrics-card';
import { TabContent } from '../../../../ds/components/Tabs/tabs-content';
import { TabList } from '../../../../ds/components/Tabs/tabs-list';
import { Tabs } from '../../../../ds/components/Tabs/tabs-root';
import { Tab } from '../../../../ds/components/Tabs/tabs-tab';
import { TracesVolumeBars } from './traces-volume-bars';
import { isVolumeTab } from './traces-volume-card.utils';
import type { VolumeTab } from './traces-volume-card.utils';

export interface TracesVolumeCardContentProps {
  data: TraceVolumeData;
  activeTab: VolumeTab;
  onTabChange: (tab: VolumeTab) => void;
  onRowClick?: (tab: VolumeTab, row: VolumeRow) => void;
  onErrorSegmentClick?: (tab: VolumeTab, row: VolumeRow) => void;
}

export function TracesVolumeCardContent({
  data,
  activeTab,
  onTabChange,
  onRowClick,
  onErrorSegmentClick,
}: TracesVolumeCardContentProps) {
  if (data.agentData.length === 0 && data.workflowData.length === 0 && data.toolData.length === 0) {
    return <MetricsCard.NoData message="No trace volume data yet" />;
  }

  const rowClick = (tab: VolumeTab) => (onRowClick ? (row: VolumeRow) => onRowClick(tab, row) : undefined);
  const errorClick = (tab: VolumeTab) =>
    onErrorSegmentClick ? (row: VolumeRow) => onErrorSegmentClick(tab, row) : undefined;

  return (
    <Tabs
      value={activeTab}
      onValueChange={value => {
        if (isVolumeTab(value)) onTabChange(value);
      }}
      defaultTab="agents"
      className="grid h-full grid-rows-[auto_1fr] overflow-y-auto"
    >
      <TabList>
        <Tab value="agents">Agents</Tab>
        <Tab value="workflows">Workflows</Tab>
        <Tab value="tools">Tools</Tab>
      </TabList>
      <TabContent value="agents" className="pt-3">
        <TracesVolumeBars
          rows={data.agentData}
          emptyMessage="No agent data yet"
          onRowClick={rowClick('agents')}
          onErrorSegmentClick={errorClick('agents')}
        />
      </TabContent>
      <TabContent value="workflows" className="pt-3">
        <TracesVolumeBars
          rows={data.workflowData}
          emptyMessage="No workflow data yet"
          onRowClick={rowClick('workflows')}
          onErrorSegmentClick={errorClick('workflows')}
        />
      </TabContent>
      <TabContent value="tools" className="pt-3">
        <TracesVolumeBars
          rows={data.toolData}
          emptyMessage="No tool data yet"
          onRowClick={rowClick('tools')}
          onErrorSegmentClick={errorClick('tools')}
        />
      </TabContent>
    </Tabs>
  );
}
