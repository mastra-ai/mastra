import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ComponentType, ReactNode } from 'react';
import { useState } from 'react';
import { studioAreas } from '../studio-areas';
import type { StudioAreaId } from '../studio-areas';
import { StudioAreaLinkGate, StudioAreaLinks } from './studio-area-links';
import { ContextualSidebarHeader } from '@/components/ui/contextual-sidebar-header';
import { ContextualSidebarLayout } from '@/components/ui/contextual-sidebar-layout';
import { ContextualSidebarSection } from '@/components/ui/contextual-sidebar-section';
import { SidebarSearchInput } from '@/components/ui/sidebar-search-input';
import { AgentHeaderCreateAction } from '@/domains/agents/agent-header-actions';
import { AgentsMetricsCard } from '@/domains/agents/components/agents-metrics-card';
import { AgentsSidebarList } from '@/domains/agents/components/agents-sidebar-list';
import { DatasetHeaderCreateAction } from '@/domains/datasets/components/dataset-header-create-action';
import { DatasetsSidebarList } from '@/domains/datasets/components/datasets-sidebar-list';
import { ReviewQueueCount } from '@/domains/review/components/review-queue-count';

interface ListedCollection {
  url: string;
  noun: string;
  summary?: { url: string; card: ReactNode };
  createAction: ReactNode;
  trailingByUrl: Record<string, ReactNode>;
  List: ComponentType<{ search: string }>;
}

const listedCollections: Partial<Record<StudioAreaId, ListedCollection>> = {
  agents: {
    url: '/agents',
    noun: 'agents',
    createAction: <AgentHeaderCreateAction />,
    summary: { url: '/agents', card: <AgentsMetricsCard /> },
    trailingByUrl: {},
    List: AgentsSidebarList,
  },
  evaluate: {
    url: '/datasets',
    noun: 'datasets',
    createAction: <DatasetHeaderCreateAction />,
    trailingByUrl: { '/experiments/review-queue': <ReviewQueueCount /> },
    List: DatasetsSidebarList,
  },
};

export function StudioAreaNavigation({ areaId }: { areaId: StudioAreaId }) {
  const area = studioAreas.find(area => area.id === areaId);
  const collection = listedCollections[areaId];
  const summary = collection?.summary;
  const [search, setSearch] = useState('');
  if (!area) return null;
  return (
    <ContextualSidebarLayout
      label={`${area.name} navigation`}
      header={
        <ContextualSidebarHeader>
          <Txt variant="subheading" className="px-3">
            {area.name}
          </Txt>
          {collection && <div className="ml-auto flex items-center gap-1">{collection.createAction}</div>}
        </ContextualSidebarHeader>
      }
    >
      {summary && <StudioAreaLinkGate url={summary.url}>{summary.card}</StudioAreaLinkGate>}
      <ContextualSidebarSection>
        <StudioAreaLinks
          areaId={areaId}
          omitUrls={[collection?.url, summary?.url]}
          trailingByUrl={collection?.trailingByUrl}
        />
      </ContextualSidebarSection>
      {collection && (
        <>
          <div className="sticky top-0 z-10 border-t border-surface-rim bg-card">
            <SidebarSearchInput
              label={`Search ${collection.noun}`}
              placeholder={`Search ${collection.noun}…`}
              value={search}
              onValueChange={setSearch}
            />
          </div>
          <collection.List search={search} />
        </>
      )}
    </ContextualSidebarLayout>
  );
}
