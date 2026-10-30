import { Notice } from '@mastra/playground-ui/components/Notice';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { KnowledgePageExplorer } from '@mastra/playground-ui/domains/knowledge/components/KnowledgePageExplorer';
import type {
  KnowledgeExplorerSource,
  KnowledgeExplorerView,
} from '@mastra/playground-ui/domains/knowledge/components/KnowledgePageExplorer';
import { useInteractionIdle } from '@mastra/playground-ui/domains/knowledge/hooks/useInteractionIdle';
import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';

import {
  useKnowledgeActivity,
  useKnowledgeGraph,
  useKnowledgeLiveUpdates,
  useKnowledgePage,
  useKnowledgeSearch,
  useKnowledgeTreeLevels,
} from '../../hooks/useKnowledgeGraph';
import { useSidebarHeaderSlots } from '../domains/chat/components/useSidebarHeaderSlots';
import { KnowledgeLoadingSkeleton } from '../domains/factory/components/knowledge/KnowledgeLoadingSkeleton';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';

/**
 * The Knowledge page: the project's Knowledge as a page tree beside either the graph or a page,
 * using the explorer Studio shares. The server reads as the project's org and project scopes, so a
 * member sees org and project pages but never another project's or a session's. `?page=` and `?view=`
 * keep the selection linkable and back-button safe.
 */
export function KnowledgePage() {
  const factory = useActiveFactory();
  const slots = useSidebarHeaderSlots();
  return (
    <PageLayout variant="fit" {...slots}>
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <KnowledgeContent key={factory.id} factoryProjectId={factory.id} />
      </div>
    </PageLayout>
  );
}

function KnowledgeContent({ factoryProjectId }: { factoryProjectId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  // Polling pauses while the user works the graph so new pages never shift it mid-exploration.
  const { idle, onActivity } = useInteractionIdle(10_000);
  const live = useKnowledgeLiveUpdates(factoryProjectId);
  const graph = useKnowledgeGraph(factoryProjectId, !idle, live);
  const selectedPageId = searchParams.get('page');
  const requestedView = searchParams.get('view');
  const view: KnowledgeExplorerView =
    requestedView === 'graph' || requestedView === 'page' || requestedView === 'tree'
      ? requestedView
      : selectedPageId
        ? 'page'
        : 'tree';

  const source = useMemo<KnowledgeExplorerSource>(
    () => ({
      usePage: (pageId, noteCursor) => useKnowledgePage(factoryProjectId, pageId, noteCursor, live),
      useSearch: query => useKnowledgeSearch(factoryProjectId, query),
      useTreeLevels: requests => useKnowledgeTreeLevels(factoryProjectId, requests, live),
      useActivity: pageId => useKnowledgeActivity(factoryProjectId, pageId, live),
    }),
    [factoryProjectId, live],
  );

  // Opening a page sets `page` then `view` in one tick. react-router hands each updater the params of the
  // last render, so the changes are merged here until the URL catches up.
  const pending = useRef<URLSearchParams | null>(null);
  useEffect(() => {
    pending.current = null;
  }, [searchParams]);
  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(pending.current ?? searchParams);
    for (const [name, value] of Object.entries(changes)) next.set(name, value);
    pending.current = next;
    setSearchParams(next);
  };

  if (graph.isPending) return <KnowledgeLoadingSkeleton label="Loading knowledge" layout="graph" />;
  if (graph.isError) return <Notice variant="destructive">{graph.error.message}</Notice>;
  if (graph.data.pages.length === 0) {
    return (
      <Txt tone="muted" as="p" variant="body">
        No knowledge in this project yet. Pages appear here as factory sessions write them.
      </Txt>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col" onPointerDownCapture={onActivity} onWheelCapture={onActivity}>
      <KnowledgePageExplorer
        graph={graph.data}
        source={source}
        selectedPageId={selectedPageId}
        onSelect={pageId => update({ page: pageId })}
        view={view}
        onViewChange={next => update({ view: next })}
      />
    </div>
  );
}
