import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import {
  useKnowledgeActivity,
  useKnowledgeApprovalsCount,
  useKnowledgeGraph,
  useKnowledgeScopes,
} from '../../hooks/useKnowledgeGraph';
import { SkeletonRows } from '../ui/SkeletonRows';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useSidebarHeaderSlots } from '../domains/chat/components/useSidebarHeaderSlots';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';
import { KnowledgeGraph } from '../domains/factory/components/knowledge/KnowledgeGraph';
import { KnowledgeFlyout } from '../domains/factory/components/knowledge/KnowledgeFlyout';
import { KnowledgeApprovals } from '../domains/factory/components/knowledge/KnowledgeApprovals';
import { KnowledgeImports } from '../domains/factory/components/knowledge/KnowledgeImports';
import { KnowledgeList } from '../domains/factory/components/knowledge/KnowledgeList';
import { KnowledgeScopeFlyout } from '../domains/factory/components/knowledge/KnowledgeScopeFlyout';
import { KnowledgeSearch } from '../domains/factory/components/knowledge/KnowledgeSearch';
import type { Arrivals, DiffBaseline } from '../domains/factory/components/knowledge/graphDiff';
import { computeArrivals } from '../domains/factory/components/knowledge/graphDiff';
import type {
  KnowledgeGraphNode,
  KnowledgeGraphPayload,
  KnowledgeRung,
  KnowledgeScopeTreePayload,
  KnowledgeSearchResult,
} from '../domains/factory/services/knowledge';
import { RequestError } from '../domains/factory/services/request';
import { useInteractionIdle } from '../domains/factory/components/knowledge/useInteractionIdle';

/**
 * A live, access-filtered view of the project's knowledge. Selected scope and
 * session state live in search params so views remain linkable and back-button safe.
 */
export function KnowledgePage() {
  const factory = useActiveFactory();
  const slots = useSidebarHeaderSlots();
  return (
    <PageLayout variant="fit" {...slots}>
      <div className="flex min-h-0 flex-col p-4">
        <KnowledgeContent key={factory.id} factoryProjectId={factory.id} />
      </div>
    </PageLayout>
  );
}

/** One hop in the node trail (A7): the nodes visited via clicks/wikilinks. */
export interface TrailEntry {
  nodeId: string;
  name: string;
  recordId?: string;
  /** Node rung — lets the flyout open for content members of a structural lens (no identity rung selected). */
  rung?: KnowledgeRung | null;
}

function Breadcrumb({
  threadId,
  trail,
  onProjectClick,
  onTrailClick,
}: {
  threadId?: string;
  trail: TrailEntry[];
  onProjectClick: () => void;
  onTrailClick: (index: number) => void;
}) {
  return (
    <nav aria-label="Knowledge scope" className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1 text-xs">
      <button type="button" className="hover:text-foreground" onClick={onProjectClick}>
        org
      </button>
      <ChevronRight size={11} />
      <button type="button" className="hover:text-foreground" onClick={onProjectClick}>
        project
      </button>
      {threadId ? (
        <>
          <ChevronRight size={11} />
          <span className="text-badge-purple-indicator max-w-52 truncate" title={threadId}>
            session {threadId.slice(0, 8)}
          </span>
        </>
      ) : null}
      {trail.map((entry, index) => (
        <span key={`${entry.nodeId}-${index}`} className="flex items-center gap-1">
          <ChevronRight size={11} />
          {index === trail.length - 1 ? (
            <span className="text-foreground max-w-44 truncate" title={entry.name}>
              {entry.name}
            </span>
          ) : (
            <button
              type="button"
              className="hover:text-foreground max-w-44 truncate"
              title={entry.name}
              onClick={() => onTrailClick(index)}
            >
              {entry.name}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}

function ScopeTree({
  tree,
  selectedScopeId,
  onSelectScope,
  onProjectClick,
  hasMore,
  loadingMore,
  loadMoreFailed,
  onLoadMore,
  className,
}: {
  className?: string;
  tree: KnowledgeScopeTreePayload | undefined;
  selectedScopeId: string | undefined;
  onSelectScope: (scopeId: string) => void;
  onProjectClick: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreFailed: boolean;
  onLoadMore: () => void;
}) {
  return (
    <aside
      aria-label="Knowledge scopes"
      className={cn('border-border bg-card shrink-0 overflow-y-auto rounded-lg border p-3', className)}
    >
      <Txt as="h2" variant="caption" className="text-foreground mb-2 font-semibold">
        Scopes
      </Txt>
      <div className="text-muted-foreground flex flex-col gap-1 text-xs">
        <button type="button" className="hover:text-foreground text-left" onClick={onProjectClick}>
          Project scope
        </button>
        {tree ? (
          <>
            <button
              type="button"
              aria-current={tree.scope.id === selectedScopeId ? 'page' : undefined}
              className={cn(
                'hover:text-foreground flex w-full items-center justify-between gap-1 rounded-md px-2 py-1 text-left',
                tree.scope.id === selectedScopeId && 'bg-fill text-foreground font-medium',
              )}
              onClick={() => onSelectScope(tree.scope.id)}
            >
              <span className="truncate">{tree.scope.name}</span>
              {(tree.scope.memberCount ?? 0) > 0 ? (
                <span className="text-muted-foreground shrink-0">
                  {tree.scope.memberCount}
                  {tree.scope.memberCountTruncated ? '+' : ''}
                </span>
              ) : null}
            </button>
            {tree.children.map(scope => (
              <button
                key={scope.id}
                type="button"
                aria-current={scope.id === selectedScopeId ? 'page' : undefined}
                className={cn(
                  'hover:text-foreground flex w-full items-center justify-between gap-1 rounded-md px-2 py-1 pl-5 text-left',
                  scope.id === selectedScopeId && 'bg-fill text-foreground font-medium',
                )}
                onClick={() => onSelectScope(scope.id)}
              >
                <span className="truncate">{scope.name}</span>
                {(scope.memberCount ?? 0) > 0 ? (
                  <span className="text-muted-foreground shrink-0">
                    {scope.memberCount}
                    {scope.memberCountTruncated ? '+' : ''}
                  </span>
                ) : null}
              </button>
            ))}
            {loadMoreFailed ? (
              <Txt as="p" variant="caption" tone="muted" className="pl-5">
                Unable to load more scopes.
              </Txt>
            ) : null}
            {hasMore ? (
              <Button variant="ghost" size="sm" className="ml-3 self-start" disabled={loadingMore} onClick={onLoadMore}>
                {loadingMore ? 'Loading scopes…' : 'Load more scopes'}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </aside>
  );
}

function ImportRunLink({
  importerId,
  runId,
  onOpen,
}: {
  importerId: string;
  runId: string;
  onOpen: (importerId: string, runId: string) => void;
}) {
  return (
    <Button variant="ghost" size="sm" className="ml-1" onClick={() => onOpen(importerId, runId)}>
      {importerId}
    </Button>
  );
}

function ActivityPanel({
  factoryProjectId,
  scopeId,
  threadId,
  onOpenRun,
}: {
  factoryProjectId?: string;
  scopeId?: string;
  threadId?: string;
  onOpenRun: (importerId: string, runId: string) => void;
}) {
  const [action, setAction] = useState('all');
  const [sourceType, setSourceType] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const activity = useKnowledgeActivity(factoryProjectId, scopeId, threadId, {
    action: action === 'all' ? undefined : action,
    sourceType: sourceType === 'importer' || sourceType === 'system' ? sourceType : undefined,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
  });
  if (activity.isPending) return <SkeletonRows label="Loading knowledge activity" rows={6} />;
  if (activity.isError) {
    const message = activity.error instanceof Error ? activity.error.message : 'Unable to load knowledge activity.';
    return <Notice variant="destructive">{message}</Notice>;
  }
  const events = activity.data.pages.flatMap(page => page.events);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" aria-label="Knowledge activity filters">
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger size="sm" aria-label="Activity operation" className="w-36">
            {action === 'all' ? 'All operations' : action}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All operations</SelectItem>
            {[
              'create',
              'edit',
              'delete',
              'restore',
              'move',
              'merge',
              'promote',
              'demote',
              'stamp',
              'rebind',
              'propose',
              'approve',
              'reject',
              'conflict',
            ].map(value => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceType} onValueChange={setSourceType}>
          <SelectTrigger size="sm" aria-label="Activity source" className="w-36">
            {sourceType === 'all' ? 'All sources' : sourceType}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="importer">Importer</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
        <Input
          aria-label="Activity from date"
          type="date"
          value={from}
          onChange={event => setFrom(event.target.value)}
        />
        <Input
          aria-label="Activity through date"
          type="date"
          value={to}
          onChange={event => setTo(event.target.value)}
        />
      </div>
      {events.length === 0 ? (
        <Txt as="p" variant="body" className="text-muted-foreground">
          No knowledge activity matches these filters.
        </Txt>
      ) : (
        <ol aria-label="Knowledge activity" className="divide-border divide-y">
          {events.map(event => (
            <li key={event.id} className="flex items-start justify-between gap-4 py-3 text-sm">
              <div>
                <span className="text-foreground font-medium">{event.action}</span>
                <span className="text-muted-foreground ml-2">{event.targetType}</span>
                {event.sourceId && event.importRunId ? (
                  <ImportRunLink importerId={event.sourceId} runId={event.importRunId} onOpen={onOpenRun} />
                ) : (
                  <span className="text-muted-foreground ml-2">{event.sourceType}</span>
                )}
              </div>
              <time className="text-muted-foreground shrink-0 text-xs" dateTime={event.createdAt}>
                {new Date(event.createdAt).toLocaleString()}
              </time>
            </li>
          ))}
          {activity.hasNextPage ? (
            <li className="flex justify-center py-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={activity.isFetchingNextPage}
                onClick={() => void activity.fetchNextPage()}
              >
                {activity.isFetchingNextPage ? 'Loading activity…' : 'Load more activity'}
              </Button>
            </li>
          ) : null}
        </ol>
      )}
    </div>
  );
}

function ActiveKnowledgeView({
  view,
  factoryProjectId,
  scopeId,
  threadId,
  importerId,
  runId,
  proposalId,
  onSelectProposal,
  onOpenRun,
  onOpenNode,
  explore,
}: {
  view: 'explore' | 'activity' | 'approvals' | 'imports';
  factoryProjectId?: string;
  scopeId?: string;
  threadId?: string;
  importerId?: string;
  runId?: string;
  proposalId?: string;
  onSelectProposal: (proposalId: string | undefined) => void;
  onOpenRun: (importerId: string, runId: string) => void;
  onOpenNode: (nodeId: string, name: string) => void;
  explore: React.ReactNode;
}) {
  if (view === 'activity') {
    return (
      <ActivityPanel factoryProjectId={factoryProjectId} scopeId={scopeId} threadId={threadId} onOpenRun={onOpenRun} />
    );
  }
  if (view === 'approvals') {
    return factoryProjectId ? (
      <KnowledgeApprovals
        factoryProjectId={factoryProjectId}
        threadId={threadId}
        proposalId={proposalId}
        onSelectProposal={onSelectProposal}
        onOpenNode={onOpenNode}
      />
    ) : null;
  }
  if (view === 'imports') {
    return (
      <KnowledgeImports
        factoryProjectId={factoryProjectId}
        threadId={threadId}
        initialImporterId={importerId}
        initialRunId={runId}
      />
    );
  }
  return explore;
}

function ThreadGone({ onBack }: { onBack: () => void }) {
  return (
    <div data-testid="knowledge-thread-gone" className="flex flex-col items-start gap-2 py-8">
      <Txt as="p" variant="body" className="text-muted-foreground">
        This session's knowledge is no longer available.
      </Txt>
      <button type="button" className="text-badge-purple-indicator text-sm hover:underline" onClick={onBack}>
        Back to the project view
      </button>
    </div>
  );
}

function KnowledgeScopeMap({
  lenses,
  omittedScopes,
  onOpen,
}: {
  lenses: KnowledgeGraphPayload[];
  omittedScopes: string[];
  onOpen: (scopeId: string) => void;
}) {
  return (
    <div
      aria-label="Scope map"
      className="bg-card absolute inset-0 z-[5] flex flex-wrap content-start gap-4 overflow-auto p-16"
    >
      {lenses.map(lens => (
        <button
          key={lens.scope.id}
          type="button"
          className="border-border bg-card hover:border-border-focus min-h-40 min-w-64 rounded-[40%] border-2 border-dashed p-6 text-left transition-colors"
          onClick={() => onOpen(lens.scope.id)}
        >
          <Txt as="span" variant="body" className="text-foreground block font-medium">
            {lens.scope.name}
          </Txt>
          <Txt as="span" variant="meta" className="text-muted-foreground mt-1 block">
            {lens.nodes.length} visible nodes
          </Txt>
          <span className="mt-4 flex max-w-72 flex-wrap gap-1" aria-label={`${lens.scope.name} members`}>
            {lens.nodes.slice(0, 12).map(node => (
              <span key={node.id} className="bg-fill text-foreground rounded-full px-2 py-1 text-xs">
                {node.name}
              </span>
            ))}
          </span>
        </button>
      ))}
      {omittedScopes.length > 0 ? (
        <Notice variant="info">
          {omittedScopes.length} scope{omittedScopes.length === 1 ? '' : 's'} omitted by canvas bounds; open the lens to
          load it completely.
        </Notice>
      ) : null}
    </div>
  );
}

type KnowledgeLayout = 'graph' | 'list';

function KnowledgeContent({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const threadId = searchParams.get('thread') ?? undefined;
  const requestedScopeId = searchParams.get('scope') ?? undefined;
  const requestedView = searchParams.get('view');
  const activeView =
    requestedView === 'activity' || requestedView === 'approvals' || requestedView === 'imports'
      ? requestedView
      : 'explore';
  const importerId = searchParams.get('importer') ?? undefined;
  const runId = searchParams.get('run') ?? undefined;
  const proposalId = searchParams.get('proposal') ?? undefined;
  // Small screens read the lens as a tappable list; `?layout=` keeps an explicit choice linkable.
  const [defaultLayout] = useState<KnowledgeLayout>(() =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 767px)').matches
      ? 'list'
      : 'graph',
  );
  const requestedLayout = searchParams.get('layout');
  const layout: KnowledgeLayout =
    requestedLayout === 'list' || requestedLayout === 'graph' ? requestedLayout : defaultLayout;
  const setLayout = (next: KnowledgeLayout) =>
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      copy.set('layout', next);
      return copy;
    });
  // `?scope=` is an identity rung ('org', 'resource', or 'thread' alongside
  // ?thread=) or a scope-tree node id; without it the view resolves the
  // project scope (or the session scope inside a thread).
  const selection:
    | { scopeLevel: 'org' | 'resource' | 'thread'; scopeNodeId?: never }
    | { scopeNodeId: string; scopeLevel?: never } =
    requestedScopeId === 'org' || requestedScopeId === 'resource' || (requestedScopeId === 'thread' && threadId)
      ? { scopeLevel: requestedScopeId }
      : requestedScopeId
        ? { scopeNodeId: requestedScopeId }
        : threadId
          ? { scopeLevel: 'thread' }
          : { scopeLevel: 'resource' };
  // The node trail (A7): the flyout shows the LAST entry; earlier entries
  // are clickable breadcrumbs back through the hops.
  // `?node=` deep-links the trail head; a stale or hidden handle renders the
  // flyout's calm not-available state.
  const [trail, setTrail] = useState<TrailEntry[]>(() => {
    const nodeId = searchParams.get('node');
    return nodeId ? [{ nodeId, name: searchParams.get('nodeName') ?? nodeId }] : [];
  });
  const [visitedLenses, setVisitedLenses] = useState<KnowledgeGraphPayload[]>([]);
  const [omittedScopes, setOmittedScopes] = useState<Array<{ id: string; name: string }>>([]);
  const [canvasMode, setCanvasMode] = useState<'lens' | 'map'>('lens');
  const selected = trail.at(-1) ?? null;
  // Selecting highlights; details open only on an explicit action (the Details button, a second
  // tap on the selected node, a search result, or a deep link), so exploring never covers the canvas.
  const [detailsOpen, setDetailsOpen] = useState(() => searchParams.has('node'));
  const setSelected = (entry: TrailEntry | null, { open = false }: { open?: boolean } = {}) => {
    setDetailsOpen(Boolean(entry) && open);
    setTrail(entry ? [entry] : []);
  };
  useEffect(() => {
    setSearchParams(
      params => {
        if ((params.get('node') ?? undefined) === selected?.nodeId) return params;
        const copy = new URLSearchParams(params);
        if (selected) {
          // Opening a node replaces the scope's detail surface.
          copy.delete('details');
          copy.set('node', selected.nodeId);
          copy.set('nodeName', selected.name);
        } else {
          copy.delete('node');
          copy.delete('nodeName');
        }
        return copy;
      },
      { replace: true },
    );
  }, [selected?.nodeId, selected?.name, setSearchParams]);

  // Live updates hold while the user is exploring (moving, clicking,
  // zooming) and resume after 10s of stillness — the layout never shifts
  // under someone mid-interaction.
  const { idle, onActivity } = useInteractionIdle(10_000);
  const scopeQuery = useKnowledgeScopes(factoryProjectId, requestedScopeId, threadId);
  const approvalsCount = useKnowledgeApprovalsCount(factoryProjectId, threadId);
  const selectedScopeId = requestedScopeId;
  const scopeTree = scopeQuery.data;
  const graphQuery = useKnowledgeGraph(factoryProjectId, selectedScopeId, threadId, { paused: !idle });
  const graph = graphQuery.data;

  // Arrival diffing: baseline per view; a view switch resets it (no mass
  // arrival animation on switch), same-view polls diff by id sets.
  const baseline = useRef<DiffBaseline | null>(null);
  const nextBaseline: DiffBaseline | undefined = graph
    ? {
        viewKey: `${threadId ? `thread:${threadId}` : 'project'}:scope:${selectedScopeId ?? 'pending'}`,
        version: graph.version ?? null,
        nodeIds: new Set(graph.nodes.map(node => node.id)),
        edgeIds: new Set(graph.edges.map(edge => edge.id)),
      }
    : undefined;
  const arrivals: Arrivals | undefined = nextBaseline ? computeArrivals(baseline.current, nextBaseline) : undefined;
  // Advance the baseline in an effect so a StrictMode double render or a
  // discarded concurrent render never diffs a payload against itself.
  useEffect(() => {
    if (nextBaseline) baseline.current = nextBaseline;
  }, [nextBaseline]);

  const backToProject = () => {
    setSelected(null);
    setCanvasMode('lens');
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      copy.delete('thread');
      copy.delete('scope');
      copy.delete('details');
      return copy;
    });
  };
  const selectScope = (scopeId: string, { open = false }: { open?: boolean } = {}) => {
    setSelected(null);
    setCanvasMode('lens');
    if (graph && graph.scope.id !== scopeId) {
      if (graph.page.truncated || graph.page.terminalBounds.length > 0) {
        setOmittedScopes(scopes =>
          scopes.some(scope => scope.id === graph.scope.id)
            ? scopes
            : [...scopes, { id: graph.scope.id, name: graph.scope.name }],
        );
      } else {
        setVisitedLenses(lenses => [...lenses.filter(lens => lens.scope.id !== graph.scope.id), graph]);
      }
    }
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      copy.set('scope', scopeId);
      // Selecting a scope changes the lens; its detail surface opens on request.
      // The URL carries both so the result is linkable.
      if (open) copy.set('details', 'scope');
      else copy.delete('details');
      return copy;
    });
  };
  const openScopeDetails = () =>
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      copy.set('details', 'scope');
      return copy;
    });
  const closeScopeDetails = () =>
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      copy.delete('details');
      return copy;
    });
  const lensScope =
    selection.scopeNodeId && scopeQuery.data?.scope.id === selection.scopeNodeId ? scopeQuery.data.scope : undefined;
  const scopeDetailsOpen = searchParams.get('details') === 'scope';
  const selectSearchResult = (result: KnowledgeSearchResult) => {
    if (result.type === 'scope') {
      selectScope(result.id, { open: true });
      return;
    }
    setSelected({ nodeId: result.id, name: result.name, rung: result.rung }, { open: true });
    setView('explore');
  };

  const completeLenses = new Map(visitedLenses.map(lens => [lens.scope.id, lens]));
  const graphIsBounded = Boolean(graph && (graph.page.truncated || graph.page.terminalBounds.length > 0));
  if (graph && !graphIsBounded) completeLenses.set(graph.scope.id, graph);
  const incompleteScopes = new Map(omittedScopes.map(scope => [scope.id, scope.name]));
  if (graph && graphIsBounded) incompleteScopes.set(graph.scope.id, graph.scope.name);
  for (const scopeId of completeLenses.keys()) incompleteScopes.delete(scopeId);

  let body: React.ReactNode;
  // A failed "load more" keeps the loaded tree; the tree reports it inline.
  if (scopeQuery.isError && !scopeQuery.isFetchNextPageError) {
    if (threadId && scopeQuery.error instanceof RequestError && scopeQuery.error.status === 404) {
      body = <ThreadGone onBack={backToProject} />;
    } else {
      const message = scopeQuery.error instanceof Error ? scopeQuery.error.message : 'Unable to load knowledge scopes.';
      body = <Notice variant="destructive">{message}</Notice>;
    }
  } else if (!selectedScopeId) {
    body = (
      <div className="border-border bg-card flex min-h-80 items-center justify-center rounded-lg border">
        <Txt as="p" variant="body" className="text-muted-foreground max-w-80 text-center">
          Select a scope to open its bounded knowledge lens.
        </Txt>
      </div>
    );
  } else if (graphQuery.isError) {
    if (threadId && graphQuery.error instanceof RequestError && graphQuery.error.status === 404) {
      // Stale deep link or a session whose knowledge was since deleted —
      // calm state with a way back, never an error toast.
      body = <ThreadGone onBack={backToProject} />;
    } else {
      const message =
        graphQuery.error instanceof Error ? graphQuery.error.message : 'Unable to load the knowledge graph.';
      body = <Notice variant="destructive">{message}</Notice>;
    }
  } else if (graphQuery.isPending || !graph) {
    body = <SkeletonRows label="Loading knowledge graph" rows={6} />;
  } else if (graph.nodes.length === 0) {
    // Identity rungs use exact-scope visibility (v2 has no downward
    // inheritance), so an empty org/project view usually means knowledge only
    // exists at a narrower rung — explain that instead of reading as broken.
    const emptyMessage = selection.scopeNodeId
      ? 'No knowledge in this scope yet.'
      : selection.scopeLevel === 'org'
        ? 'No knowledge captured at organization scope yet — knowledge captured in projects and sessions does not roll up here.'
        : selection.scopeLevel === 'resource'
          ? 'No knowledge captured at project scope yet — knowledge captured in sessions does not roll up here.'
          : 'No knowledge captured in this session yet — the graph fills in as factory sessions work.';
    body = (
      <Txt as="p" variant="body" className="text-muted-foreground">
        {emptyMessage}
      </Txt>
    );
  } else {
    const graphPayload = graphQuery.data;
    const clickNode = (node: KnowledgeGraphNode) => {
      if (node.boundary) {
        // A boundary node lives in another scope: open that scope's lens.
        selectScope(node.boundary.scope.id);
        return;
      }
      if (node.isScope) {
        // Scope selection is identical in the tree and canvas: switch the lens; tapping the
        // already-selected scope again opens its detail surface.
        selectScope(node.id, { open: node.id === selectedScopeId });
        return;
      }
      // First tap selects and highlights; tapping the selected node again opens its details.
      setSelected({ nodeId: node.id, name: node.name }, { open: selected?.nodeId === node.id });
    };
    const toolbarTarget =
      selected && !detailsOpen
        ? { name: selected.name, open: () => setDetailsOpen(true) }
        : !selected && lensScope && !scopeDetailsOpen
          ? { name: lensScope.name, open: openScopeDetails }
          : undefined;
    body = (
      // Details sit beside the canvas on desktop (never over it) and as a bottom sheet below md.
      <div className="flex min-h-0 flex-1">
        <div
          className="relative min-h-0 min-w-0 flex-1"
          data-testid="knowledge-graph-container"
          onPointerDownCapture={onActivity}
          onPointerMoveCapture={onActivity}
          onWheelCapture={onActivity}
        >
          {layout === 'graph' ? (
            <div
              data-testid="knowledge-scope-overlay"
              className="border-border bg-card/90 absolute top-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 rounded-md border px-3 py-2"
            >
              <Txt as="span" variant="meta" className="text-muted-foreground">
                Lens
              </Txt>
              <Txt as="span" variant="caption" className="text-foreground font-medium">
                {graphPayload.scope.name}
              </Txt>
              {Array.from(
                new Map(
                  graphPayload.nodes.flatMap(node =>
                    node.boundary ? [[node.boundary.scope.id, node.boundary.scope] as const] : [],
                  ),
                ).values(),
              ).map(scope => (
                <Button key={scope.id} variant="ghost" size="sm" onClick={() => selectScope(scope.id)}>
                  Open {scope.name}
                </Button>
              ))}
              <Button
                variant="default"
                size="sm"
                onClick={() => setCanvasMode(mode => (mode === 'lens' ? 'map' : 'lens'))}
              >
                {canvasMode === 'lens' ? 'Scope map' : 'Return to lens'}
              </Button>
            </div>
          ) : null}
          {layout === 'graph' && canvasMode === 'map' ? (
            <KnowledgeScopeMap
              lenses={[...completeLenses.values()]}
              omittedScopes={[...incompleteScopes.values()]}
              onOpen={selectScope}
            />
          ) : layout === 'list' ? (
            <KnowledgeList
              payload={graphPayload}
              rootScopeId={selectedScopeId}
              selectedNodeId={selected?.nodeId}
              selectedRecordId={selected?.recordId}
              onNodeClick={clickNode}
              onRecordClick={(node, recordId) =>
                // Tapping a record is an explicit request to read it.
                setSelected({ nodeId: node.id, name: node.name, recordId }, { open: true })
              }
            />
          ) : (
            <KnowledgeGraph
              payload={graphPayload}
              arrivals={arrivals}
              focusedId={selected?.nodeId ?? null}
              focusedRecordId={selected?.recordId ?? null}
              // A structural member listing carries no edges — label every member
              // so the lens reads as a directory, not a field of dots.
              labelAll={Boolean(selection.scopeNodeId)}
              onFocusChange={id => {
                // A pane click clears the selection; node clicks are handled by onNodeClick.
                if (!id) setSelected(null);
              }}
              onNodeClick={clickNode}
              onEdgeClick={edge => {
                // Selecting an edge selects its source node and the supporting knowledge record (A7),
                // which the details panel expands once opened.
                const node = graphPayload.nodes.find(entry => entry.id === edge.source);
                setSelected({ nodeId: edge.source, name: node?.name ?? edge.source, recordId: edge.recordId });
              }}
            />
          )}
          <div className="absolute bottom-3 left-1/2 z-10 flex max-w-[90%] -translate-x-1/2 flex-col items-center gap-2">
            {graphQuery.hasNextPage ? (
              <Button
                variant="default"
                size="sm"
                disabled={graphQuery.isFetchingNextPage}
                onClick={() => void graphQuery.fetchNextPage()}
              >
                {graphQuery.isFetchingNextPage ? 'Loading lens…' : 'Load more in this lens'}
              </Button>
            ) : null}
            {toolbarTarget ? (
              <div
                role="toolbar"
                aria-label="Selected knowledge"
                className="border-border bg-card shadow-overlay flex max-w-full items-center gap-2 rounded-full border py-1 pr-1 pl-3"
              >
                <Txt as="span" variant="caption" className="text-foreground truncate">
                  {toolbarTarget.name}
                </Txt>
                <Button type="button" size="sm" variant="ghost" onClick={toolbarTarget.open}>
                  Details
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        {selected && detailsOpen && factoryProjectId && selectedScopeId ? (
          <KnowledgeFlyout
            factoryProjectId={factoryProjectId}
            nodeId={selected.nodeId}
            scopeId={selectedScopeId}
            threadId={threadId}
            focusRecordId={selected.recordId}
            onSelectRecord={recordId =>
              // Bidirectional selection: expanding a card selects the knowledge record
              // page-wide, so the graph lights its marker/edge up too.
              setTrail(current =>
                current.length === 0
                  ? current
                  : [...current.slice(0, -1), { ...current[current.length - 1]!, recordId: recordId ?? undefined }],
              )
            }
            onClose={() => setSelected(null)}
            onNodeRef={name => {
              // A clicked [[wikilink]] gets the full node-click treatment (A7):
              // ego focus + cluster zoom + flyout swap, PUSHED onto the trail.
              const target = graphPayload.nodes.find(node => node.name.toLowerCase() === name.toLowerCase());
              if (target && target.id !== selected.nodeId)
                setTrail(current => [...current, { nodeId: target.id, name: target.name }]);
            }}
          />
        ) : !selected && scopeDetailsOpen && lensScope && factoryProjectId ? (
          <KnowledgeScopeFlyout
            factoryProjectId={factoryProjectId}
            scope={lensScope}
            threadId={threadId}
            onOpenActivity={() => setView('activity')}
            onClose={closeScopeDetails}
          />
        ) : null}
      </div>
    );
  }

  const setView = (view: 'explore' | 'activity' | 'approvals' | 'imports') => {
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      if (view === 'explore') copy.delete('view');
      else copy.set('view', view);
      copy.delete('importer');
      copy.delete('run');
      if (view !== 'approvals') copy.delete('proposal');
      return copy;
    });
  };
  const openImportRun = (selectedImporterId: string, selectedRunId: string) => {
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      copy.set('view', 'imports');
      copy.set('importer', selectedImporterId);
      copy.set('run', selectedRunId);
      return copy;
    });
  };
  const selectProposal = (selectedProposalId: string | undefined) => {
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      copy.set('view', 'approvals');
      if (selectedProposalId) copy.set('proposal', selectedProposalId);
      else copy.delete('proposal');
      return copy;
    });
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 pt-2" aria-label="Knowledge graph">
      <header className="shrink-0">
        <Txt as="h1" variant="heading" className="text-foreground font-semibold">
          Knowledge
        </Txt>
        <Txt as="p" variant="body" className="text-muted-foreground mt-1">
          Explore captured knowledge and review how it changes over time.
        </Txt>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="flex gap-1" role="tablist" aria-label="Knowledge views">
            {(['explore', 'activity', 'approvals', 'imports'] as const).map(view => (
              <button
                key={view}
                type="button"
                role="tab"
                aria-selected={activeView === view}
                className={`rounded-md px-3 py-1.5 text-sm capitalize ${
                  activeView === view ? 'bg-fill text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setView(view)}
              >
                {view}
                {view === 'approvals' && approvalsCount.data && approvalsCount.data.pending > 0 ? (
                  <span
                    className="bg-fill text-foreground ml-1.5 rounded-full px-1.5 text-xs tabular-nums"
                    aria-hidden="true"
                    data-testid="knowledge-approvals-count"
                  >
                    {approvalsCount.data.pending}
                    {approvalsCount.data.capped ? '+' : ''}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="flex w-full max-w-sm items-start gap-2">
            {activeView === 'explore' ? (
              <div className="flex gap-1" role="group" aria-label="Knowledge layout">
                {(['graph', 'list'] as const).map(option => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={layout === option}
                    className={`rounded-md px-3 py-1.5 text-sm capitalize ${
                      layout === option ? 'bg-fill text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setLayout(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <KnowledgeSearch factoryProjectId={factoryProjectId} threadId={threadId} onSelect={selectSearchResult} />
            </div>
          </div>
        </div>
        <Breadcrumb
          threadId={threadId}
          trail={trail}
          onProjectClick={backToProject}
          onTrailClick={index => setTrail(current => current.slice(0, index + 1))}
        />
      </header>
      <div className={cn('flex min-h-0 flex-1 gap-4', layout === 'list' && 'flex-col')}>
        <ScopeTree
          className={layout === 'list' ? 'max-h-48 w-full' : 'w-48'}
          tree={scopeQuery.data}
          selectedScopeId={selectedScopeId}
          // Same as the canvas: the first tap switches the lens, a second tap opens its details.
          onSelectScope={scopeId => selectScope(scopeId, { open: scopeId === selectedScopeId })}
          onProjectClick={backToProject}
          hasMore={scopeQuery.hasNextPage}
          loadingMore={scopeQuery.isFetchingNextPage}
          loadMoreFailed={scopeQuery.isFetchNextPageError}
          onLoadMore={() => void scopeQuery.fetchNextPage()}
        />
        {/* Flex column so the graph container's `min-h-0 flex-1` chain connects
            to a sized parent; as a block wrapper it collapses to zero height. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <ActiveKnowledgeView
            view={activeView}
            factoryProjectId={factoryProjectId}
            scopeId={selectedScopeId}
            threadId={threadId}
            importerId={importerId}
            runId={runId}
            proposalId={proposalId}
            onSelectProposal={selectProposal}
            onOpenRun={openImportRun}
            onOpenNode={(nodeId, name) => {
              setSelected({ nodeId, name }, { open: true });
              setView('explore');
            }}
            explore={body}
          />
        </div>
      </div>
    </section>
  );
}
