import { useState } from 'react';
import { TabContent } from '../../../../ds/components/Tabs/tabs-content';
import { TabList } from '../../../../ds/components/Tabs/tabs-list';
import { Tabs } from '../../../../ds/components/Tabs/tabs-root';
import { Tab } from '../../../../ds/components/Tabs/tabs-tab';
import type { DrilldownScope } from '../../drilldown';
import { MemoryCardLayout } from './memory-card-layout';
import { isMemoryTab } from './memory-card.utils';
import type { MemoryTab } from './memory-card.utils';
import { MemoryResourcesPanel } from './memory-resources-panel';
import { MemoryResourcesSummary } from './memory-resources-summary';
import { MemoryThreadsPanel } from './memory-threads-panel';
import { MemoryThreadsSummary } from './memory-threads-summary';

export interface MemoryCardProps {
  /** Opens traces for a clicked thread. No handler, rows are not clickable. */
  onThreadClick?: (scope: DrilldownScope) => void;
  /** Opens traces for a clicked resource. No handler, rows are not clickable. */
  onResourceClick?: (scope: DrilldownScope) => void;
}

/** Threads and resources come from two independent queries, so each tab owns its own loading state. */
export function MemoryCard({ onThreadClick, onResourceClick }: MemoryCardProps) {
  const [activeTab, setActiveTab] = useState<MemoryTab>('threads');

  return (
    <MemoryCardLayout summary={activeTab === 'threads' ? <MemoryThreadsSummary /> : <MemoryResourcesSummary />}>
      <Tabs
        defaultTab="threads"
        value={activeTab}
        onValueChange={value => {
          if (isMemoryTab(value)) setActiveTab(value);
        }}
        className="grid h-full grid-rows-[auto_1fr] overflow-y-auto"
      >
        <TabList>
          <Tab value="threads">Threads</Tab>
          <Tab value="resources">Resources</Tab>
        </TabList>
        <TabContent value="threads" className="pt-3">
          <MemoryThreadsPanel onThreadClick={onThreadClick} />
        </TabContent>
        <TabContent value="resources" className="pt-3">
          <MemoryResourcesPanel onResourceClick={onResourceClick} />
        </TabContent>
      </Tabs>
    </MemoryCardLayout>
  );
}
