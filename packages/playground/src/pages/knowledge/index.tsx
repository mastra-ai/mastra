import type { KnowledgeGraphResponse } from '@mastra/client-js';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { KnowledgePageExplorer } from '@mastra/playground-ui/domains/knowledge/components/KnowledgePageExplorer';
import type {
  KnowledgeExplorerSource,
  KnowledgeExplorerView,
} from '@mastra/playground-ui/domains/knowledge/components/KnowledgePageExplorer';
import { is401UnauthorizedError, is403ForbiddenError, is404NotFoundError } from '@mastra/playground-ui/utils/errors';
import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import {
  useKnowledgeActivity,
  useKnowledgeInstances,
  useKnowledgeLiveUpdates,
  useKnowledgePage,
  useKnowledgePageGraph,
  useKnowledgeSearch,
  useKnowledgeTreeLevels,
} from '@/domains/knowledge/use-studio-knowledge';
import { navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/knowledge')];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <h1 className="sr-only">Knowledge</h1>
      {children}
    </PageLayout>
  );
}

function Explorer({
  knowledgeKey,
  live,
  graph,
}: {
  knowledgeKey: string;
  live: boolean;
  graph: KnowledgeGraphResponse;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedPageId = searchParams.get('page');
  const requestedView = searchParams.get('view');
  // A `?page=` link without a view opens the page.
  const view: KnowledgeExplorerView =
    requestedView === 'graph' || requestedView === 'page' || requestedView === 'tree'
      ? requestedView
      : selectedPageId
        ? 'page'
        : 'tree';
  const source = useMemo<KnowledgeExplorerSource>(
    () => ({
      usePage: (pageId, noteCursor) => useKnowledgePage(knowledgeKey, live, pageId, noteCursor),
      useSearch: query => useKnowledgeSearch(knowledgeKey, query),
      useTreeLevels: requests => useKnowledgeTreeLevels(knowledgeKey, live, requests),
      useActivity: pageId => useKnowledgeActivity(knowledgeKey, live, pageId),
    }),
    [knowledgeKey, live],
  );
  // Opening a page sets `page` then `view` in one tick. react-router builds each update from the params of
  // the last render, so the changes are merged here until the URL catches up.
  const pending = useRef<URLSearchParams | null>(null);
  useEffect(() => {
    pending.current = null;
  }, [searchParams]);
  // A null value drops the param: an empty-canvas click clears `page`.
  const update = (name: string, value: string | null) => {
    const next = new URLSearchParams(pending.current ?? searchParams);
    if (value === null) next.delete(name);
    else next.set(name, value);
    pending.current = next;
    setSearchParams(next);
  };
  return (
    <KnowledgePageExplorer
      graph={graph}
      source={source}
      selectedPageId={selectedPageId}
      onSelect={pageId => update('page', pageId)}
      view={view}
      onViewChange={next => update('view', next)}
    />
  );
}

export default function KnowledgePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const instances = useKnowledgeInstances();
  const knowledgeKey = searchParams.get('instance') ?? instances.data?.[0]?.key;
  const live = useKnowledgeLiveUpdates(knowledgeKey);
  const graph = useKnowledgePageGraph(knowledgeKey, live);

  const error = instances.error ?? graph.error;
  if (error && is401UnauthorizedError(error)) {
    return (
      <Shell>
        <SessionExpired variant="fill" />
      </Shell>
    );
  }
  if (error && is403ForbiddenError(error)) {
    return (
      <Shell>
        <PermissionDenied variant="fill" resource="knowledge" />
      </Shell>
    );
  }
  // The Knowledge routes are opt-in, so a server that has not registered them 404s.
  if (instances.error && is404NotFoundError(instances.error)) {
    return (
      <Shell>
        <EmptyState
          variant="fill"
          titleSlot="Knowledge browsing is not enabled"
          descriptionSlot="This server does not register the Knowledge routes. Add KNOWLEDGE_ROUTES from @mastra/server/server-adapter to server.apiRoutes, then reload."
        />
      </Shell>
    );
  }
  if (instances.error) {
    return (
      <Shell>
        <EmptyState
          tone="error"
          variant="fill"
          titleSlot="Failed to load Knowledge"
          descriptionSlot={instances.error.message}
        />
      </Shell>
    );
  }
  if (instances.data && instances.data.length === 0) {
    return (
      <Shell>
        <EmptyState
          variant="fill"
          titleSlot="No Knowledge instances"
          descriptionSlot="Register one on your Mastra instance with the knowledge option to browse it here."
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
        {instances.data && instances.data.length > 1 ? (
          <select
            aria-label="Knowledge instance"
            className="text-ui-md h-8 w-fit rounded border border-border bg-card px-2"
            value={knowledgeKey}
            onChange={event => setSearchParams(new URLSearchParams({ instance: event.target.value }))}
          >
            {instances.data.map(instance => (
              <option key={instance.key} value={instance.key}>
                {instance.key}
              </option>
            ))}
          </select>
        ) : null}
        {!knowledgeKey || graph.isPending ? (
          <p className="text-ui-md p-4 text-muted-foreground">Loading knowledge…</p>
        ) : !graph.data ? (
          <EmptyState
            tone="error"
            variant="fill"
            titleSlot="Failed to load Knowledge"
            descriptionSlot={graph.error?.message}
          />
        ) : graph.data.pages.length === 0 ? (
          <EmptyState
            variant="fill"
            titleSlot="No pages yet"
            descriptionSlot="Agents add pages and notes to Knowledge as they run. They will appear here."
          />
        ) : (
          <Explorer knowledgeKey={knowledgeKey} live={live} graph={graph.data} />
        )}
      </div>
    </Shell>
  );
}
