import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import {
  useKnowledgeActivity,
  useKnowledgeGraph,
  useKnowledgeScopePage,
  useKnowledgeScopes,
} from '../../hooks/useKnowledgeGraph';
import { SkeletonRows } from '../ui/SkeletonRows';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useSidebarHeaderSlots } from '../domains/chat/components/useSidebarHeaderSlots';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';
import { KnowledgeGraph } from '../domains/factory/components/knowledge/KnowledgeGraph';
import { KnowledgeFlyout } from '../domains/factory/components/knowledge/KnowledgeFlyout';
import { KnowledgeList } from '../domains/factory/components/knowledge/KnowledgeList';
import { KnowledgeImports } from '../domains/factory/components/knowledge/KnowledgeImports';
import {
  knowledgeActivityLabel,
  KNOWLEDGE_ACTIVITY_TRUNCATED,
} from '../domains/factory/components/knowledge/activityLabel';
import { KnowledgeSearch } from '../domains/factory/components/knowledge/KnowledgeSearch';
import type { Arrivals, DiffBaseline } from '../domains/factory/components/knowledge/graphDiff';
import { computeArrivals } from '../domains/factory/components/knowledge/graphDiff';
import type {
  KnowledgeActivityEvent,
  KnowledgeGraphNode,
  KnowledgeRung,
  KnowledgeSearchResult,
  KnowledgeScopeNode,
  KnowledgeScopeTreePayload,
  KnowledgeSelection,
} from '../domains/factory/services/knowledge';
import { RequestError } from '../domains/factory/services/request';
import { useInteractionIdle } from '../domains/factory/components/knowledge/useInteractionIdle';
import { KnowledgeScopeFlyout } from '../domains/factory/components/knowledge/KnowledgeScopeFlyout';

/**
 * The Knowledge page: a live force-directed graph of the project's knowledge —
 * nodes as nodes, wikilink relationships as edges. The default view is
 * project scope (org + project records, the knowledge records that carry across
 * sessions); thread-scoped knowledge is reached by opening a session listed under
 * the project in the scope tree, or a knowledge record's "captured in session" link.
 * Either switches to the thread view with an org → project → thread breadcrumb
 * (Amendment A2). Thread state lives in
 * the `?thread=` search param so the view is linkable and back-button safe.
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

function writeNodeSelection(params: URLSearchParams, entry: TrailEntry | null): void {
  if (!entry) {
    params.delete('node');
    params.delete('nodeName');
    params.delete('nodeRung');
    params.delete('record');
    return;
  }
  params.set('node', entry.nodeId);
  params.set('nodeName', entry.name);
  if (entry.rung) params.set('nodeRung', entry.rung);
  else params.delete('nodeRung');
  if (entry.recordId) params.set('record', entry.recordId);
  else params.delete('record');
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
    <nav aria-label="Knowledge scope" className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1">
      <button type="button" className="hover:text-foreground" onClick={onProjectClick}>
        <Txt as="span" variant="caption" className="block">
          org
        </Txt>
      </button>
      <ChevronRight size={11} />
      <button type="button" className="hover:text-foreground" onClick={onProjectClick}>
        <Txt as="span" variant="caption" className="block">
          project
        </Txt>
      </button>
      {threadId ? (
        <>
          <ChevronRight size={11} />
          <Txt as="span" variant="caption" title={threadId} className="text-badge-purple-indicator max-w-52 truncate">
            session {threadId.slice(0, 8)}
          </Txt>
        </>
      ) : null}
      {trail.map((entry, index) => (
        <span key={`${entry.nodeId}-${index}`} className="flex items-center gap-1">
          <ChevronRight size={11} />
          {index === trail.length - 1 ? (
            <Txt as="span" variant="caption" tone="ink" title={entry.name} className="max-w-44 truncate">
              {entry.name}
            </Txt>
          ) : (
            <button
              type="button"
              className="hover:text-foreground max-w-44 truncate"
              title={entry.name}
              onClick={() => onTrailClick(index)}
            >
              <Txt as="span" variant="caption" className="block">
                {entry.name}
              </Txt>
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}

function ScopeLabel({
  name,
  kind,
  memberCount,
  memberCountTruncated,
}: {
  name: string;
  kind: string;
  memberCount?: number;
  memberCountTruncated?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate">{name}</span>{' '}
      <Badge variant="neutral" emphasis="subtle" size="xs">
        {kind}
      </Badge>
      {memberCount !== undefined && memberCount > 0 ? ' ' : null}
      {memberCount !== undefined && memberCount > 0 ? (
        <span className="text-muted-foreground shrink-0">
          {memberCount}
          {memberCountTruncated ? '+' : ''}
        </span>
      ) : null}
    </span>
  );
}

type KnowledgeLayout = 'graph' | 'list';

function ScopeTree({
  factoryProjectId,
  threadId,
  scopes,
  selection,
  onSelect,
  onOpenSession,
  onNodesLoaded,
  className,
}: {
  className?: string;
  factoryProjectId: string | undefined;
  threadId?: string;
  scopes: KnowledgeScopeTreePayload | undefined;
  selection: KnowledgeSelection | undefined;
  onSelect: (selection: KnowledgeSelection) => void;
  /** A listed session (`resource:<project>:thread:<id>` scope) opens the thread view rather than a lens. */
  onOpenSession: (threadId: string) => void;
  onNodesLoaded: (nodes: KnowledgeScopeNode[]) => void;
}) {
  const scopePage = useKnowledgeScopePage(factoryProjectId, threadId);
  const [pages, setPages] = useState<KnowledgeScopeTreePayload[]>([]);
  const [nextCursorByParent, setNextCursorByParent] = useState<Record<string, string | null>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [collapsedRootIds, setCollapsedRootIds] = useState<Set<string>>(new Set());

  // ONE DAG built from lazily loaded scope-node pages. The host-vouched
  // identity chain is represented by the same nodes and merged by exact
  // canonical address on the server. A path-local visited set prevents cycles
  // without suppressing legitimate multi-parent appearances.
  const roots = scopes?.roots ?? [];
  const scopeNodes = [...(scopes?.scopeNodes ?? []), ...pages.flatMap(page => page.scopeNodes ?? [])].filter(
    (node, index, all) => all.findIndex(candidate => candidate.id === node.id) === index,
  );
  const markerByNodeId = new Map(
    roots.flatMap(root => (root.scopeNodeId ? [[root.scopeNodeId, root.level] as const] : [])),
  );
  const known = new Set(scopeNodes.map(node => node.id));
  const byParent = new Map<string, KnowledgeScopeNode[]>();
  const treeRoots: KnowledgeScopeNode[] = [];
  for (const node of scopeNodes) {
    const parents = node.parentIds.filter(id => known.has(id));
    if (parents.length === 0) {
      treeRoots.push(node);
      continue;
    }
    for (const parentId of parents) {
      const siblings = byParent.get(parentId);
      if (siblings) siblings.push(node);
      else byParent.set(parentId, [node]);
    }
  }
  const selectedAncestors = new Set<string>();
  const addAncestors = (nodeId: string): void => {
    const node = scopeNodes.find(candidate => candidate.id === nodeId);
    for (const parentId of node?.parentIds ?? []) {
      if (selectedAncestors.has(parentId)) continue;
      selectedAncestors.add(parentId);
      addAncestors(parentId);
    }
  };
  if (selection?.scopeNodeId) addAncestors(selection.scopeNodeId);

  const loadPage = async (parentId: string | undefined, cursor: string | undefined) => {
    let page: Awaited<ReturnType<typeof scopePage.mutateAsync>>;
    try {
      page = await scopePage.mutateAsync({ ...(parentId ? { parentId } : {}), ...(cursor ? { cursor } : {}) });
    } catch {
      // The tree renders scopePage.isError; nothing else to do here.
      return;
    }
    setPages(current => [...current, page]);
    setNextCursorByParent(current => ({ ...current, [parentId ?? 'roots']: page.nextCursor ?? null }));
    onNodesLoaded(page.scopeNodes ?? []);
  };
  const identityKind = (level: (typeof roots)[number]['level']) =>
    level === 'resource' ? 'project' : level === 'thread' ? 'session' : 'org';
  const renderScopeNode = (node: KnowledgeScopeNode, depth: number, path: Set<string>): React.ReactNode => {
    if (path.has(node.id)) return null;
    const nextPath = new Set(path).add(node.id);
    const marker = markerByNodeId.get(node.id);
    const sessionPrefix = `resource:${factoryProjectId}:thread:`;
    const sessionId =
      !marker && factoryProjectId && node.address.startsWith(sessionPrefix)
        ? node.address.slice(sessionPrefix.length)
        : undefined;
    const kind = marker ? identityKind(marker) : sessionId ? 'session' : (node.kind ?? 'scope');
    const pressed = selection?.scopeNodeId === node.id || (marker !== undefined && selection?.scopeLevel === marker);
    const children = byParent.get(node.id) ?? [];
    // Roots and the viewed project start open, so the project's sessions are listed without a click.
    const openByDefault = depth === 0 || marker === 'resource';
    const expanded =
      (openByDefault && !collapsedRootIds.has(node.id)) || expandedIds.has(node.id) || selectedAncestors.has(node.id);
    const canExpand = node.childScopeCount > 0;
    const hasCursorOverride = Object.hasOwn(nextCursorByParent, node.id);
    const childCursor = hasCursorOverride ? nextCursorByParent[node.id] : scopes?.childCursors?.[node.id];
    const canLoadMore = childCursor !== null && children.length < node.childScopeCount;
    return (
      <div key={`${[...path].join(':')}:${node.id}`}>
        <div className="flex items-center" style={{ paddingLeft: `${depth * 12}px` }}>
          {canExpand ? (
            <button
              type="button"
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.name}`}
              aria-expanded={expanded}
              className="hover:text-foreground flex size-5 shrink-0 items-center justify-center"
              onClick={() => {
                if (expanded) {
                  if (openByDefault) setCollapsedRootIds(current => new Set(current).add(node.id));
                  else
                    setExpandedIds(current => {
                      const next = new Set(current);
                      next.delete(node.id);
                      return next;
                    });
                  return;
                }
                if (children.length === 0) void loadPage(node.id, undefined);
                if (openByDefault)
                  setCollapsedRootIds(current => {
                    const next = new Set(current);
                    next.delete(node.id);
                    return next;
                  });
                else setExpandedIds(current => new Set(current).add(node.id));
              }}
            >
              <DisclosureChevron direction="right" className="size-3" />
            </button>
          ) : (
            <span className="size-5 shrink-0" />
          )}
          <button
            type="button"
            aria-pressed={pressed}
            className={cn(
              'hover:text-foreground min-w-0 flex-1 rounded-md px-1 py-1 text-left',
              pressed && 'bg-fill text-foreground font-medium',
            )}
            title={node.description ?? node.name}
            onClick={() =>
              sessionId
                ? onOpenSession(sessionId)
                : onSelect(marker ? { scopeNodeId: node.id, scopeLevel: marker } : { scopeNodeId: node.id })
            }
          >
            <ScopeLabel
              name={node.name}
              kind={kind}
              memberCount={node.memberCount}
              memberCountTruncated={node.memberCountTruncated}
            />
          </button>
        </div>
        {expanded ? children.map(child => renderScopeNode(child, depth + 1, nextPath)) : null}
        {expanded && canLoadMore ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground py-1 text-left"
            style={{ paddingLeft: `${20 + (depth + 1) * 12}px` }}
            disabled={scopePage.isPending}
            onClick={() => void loadPage(node.id, childCursor ?? undefined)}
          >
            Load more
          </button>
        ) : null}
      </div>
    );
  };
  const fallbackRungs = roots.filter(root => !root.scopeNodeId);
  const rootCursor = Object.hasOwn(nextCursorByParent, 'roots') ? nextCursorByParent.roots : scopes?.nextCursor;
  return (
    <aside
      aria-label="Knowledge scopes"
      className={cn('border-border bg-card shrink-0 overflow-y-auto rounded-lg border p-3', className)}
    >
      <Txt as="h2" variant="caption" className="text-foreground mb-2 font-semibold">
        Scopes
      </Txt>
      <div className="text-muted-foreground flex flex-col gap-1 text-xs">
        {treeRoots.map(node => renderScopeNode(node, 0, new Set()))}
        {rootCursor ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground px-2 py-1 text-left"
            disabled={scopePage.isPending}
            onClick={() => void loadPage(undefined, rootCursor)}
          >
            Load more scopes
          </button>
        ) : null}
        {fallbackRungs.map(root => (
          <button
            key={root.level}
            type="button"
            aria-pressed={selection?.scopeLevel === root.level && !selection?.scopeNodeId}
            className={cn(
              'hover:text-foreground w-full rounded-md px-2 py-1 text-left',
              selection?.scopeLevel === root.level && !selection?.scopeNodeId && 'bg-fill text-foreground font-medium',
            )}
            onClick={() => onSelect({ scopeLevel: root.level })}
          >
            <ScopeLabel name={root.id.slice(0, 8)} kind={identityKind(root.level)} />
          </button>
        ))}
        {scopePage.isError ? <span className="px-2 text-red-400">Unable to load more scopes.</span> : null}
        {scopes?.truncated ? (
          <span className="px-2">This org has more scopes than can be listed; some are not shown.</span>
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
    <Button variant="ghost" size="xs" className="ml-1" onClick={() => onOpen(importerId, runId)}>
      {importerId}
    </Button>
  );
}

function ActivityPanel({
  factoryProjectId,
  selection,
  threadId,
  onSelect,
  onOpenRun,
}: {
  factoryProjectId?: string;
  selection: KnowledgeSelection | undefined;
  threadId?: string;
  onSelect: (event: KnowledgeActivityEvent) => void;
  onOpenRun: (importerId: string, runId: string) => void;
}) {
  const [action, setAction] = useState('all');
  const [sourceType, setSourceType] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const activity = useKnowledgeActivity(factoryProjectId, selection, threadId);
  if (!selection) {
    return (
      <Txt as="p" variant="body" className="text-muted-foreground">
        Select a scope to view its recent activity.
      </Txt>
    );
  }
  if (activity.isPending) return <SkeletonRows label="Loading knowledge activity" rows={6} />;
  if (activity.isError) {
    const message = activity.error instanceof Error ? activity.error.message : 'Unable to load knowledge activity.';
    return <Notice variant="destructive">{message}</Notice>;
  }
  const events = activity.data.pages
    .flatMap(page => page.events)
    .filter((event, index, all) => all.findIndex(candidate => candidate.id === event.id) === index)
    .filter(event => action === 'all' || event.action === action)
    .filter(event => sourceType === 'all' || event.sourceType === sourceType)
    .filter(event => !from || event.createdAt >= new Date(`${from}T00:00:00`).toISOString())
    .filter(event => !to || event.createdAt <= new Date(`${to}T23:59:59.999`).toISOString());
  const truncatedNotice = activity.data.pages.some(page => page.truncated) ? (
    <Notice variant="info">{KNOWLEDGE_ACTIVITY_TRUNCATED}</Notice>
  ) : null;
  if (events.length === 0) {
    return (
      <>
        {truncatedNotice}
        <Txt as="p" variant="body" className="text-muted-foreground">
          No knowledge activity yet.
        </Txt>
      </>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-2">
      {truncatedNotice}
      <div className="mb-3 flex flex-wrap gap-2" aria-label="Knowledge activity filters">
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger size="sm" aria-label="Activity operation" className="w-36">
            {action === 'all' ? 'All operations' : action}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All operations</SelectItem>
            {['create', 'edit', 'delete', 'restore', 'move', 'merge', 'promote', 'demote', 'stamp', 'rebind'].map(
              value => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ),
            )}
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
      <ol aria-label="Knowledge activity" className="divide-border divide-y">
        {events.map(event => (
          <li key={event.id} className="flex items-start justify-between gap-4 py-3 text-sm">
            <div>
              <span className="text-foreground">{knowledgeActivityLabel(event)}</span>
              <span className="text-muted-foreground"> · </span>
              <button
                type="button"
                className="text-foreground hover:text-badge-purple-indicator font-medium hover:underline"
                onClick={() => onSelect(event)}
              >
                {event.node.name}
              </button>
              {event.sourceId && event.importRunId ? (
                <ImportRunLink importerId={event.sourceId} runId={event.importRunId} onOpen={onOpenRun} />
              ) : event.sourceType ? (
                <span className="text-icon3 ml-2">{event.sourceType}</span>
              ) : null}
              <div className="text-icon3 mt-1 text-xs">{event.scope.join(' → ')}</div>
            </div>
            <time className="text-muted-foreground shrink-0 text-xs" dateTime={event.createdAt}>
              {new Date(event.createdAt).toLocaleString()}
            </time>
          </li>
        ))}
      </ol>
      {activity.hasNextPage ? (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground mt-2 px-2 py-1 text-sm"
          disabled={activity.isFetchingNextPage}
          onClick={() => void activity.fetchNextPage()}
        >
          {activity.isFetchingNextPage ? 'Loading older activity…' : 'Load older activity'}
        </button>
      ) : null}
    </div>
  );
}

/** Writes a rung lens to the URL; a thread rung is only written with its thread id. */
function writeRungScope(params: URLSearchParams, rung: KnowledgeRung, threadId: string | undefined) {
  if (rung === 'thread' && threadId) {
    params.set('scope', 'thread');
    params.set('thread', threadId);
    return;
  }
  params.set('scope', rung === 'thread' ? 'resource' : rung);
  params.delete('thread');
}

function KnowledgeContent({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const threadId = searchParams.get('thread') ?? undefined;
  const requestedScope = searchParams.get('scope');
  // `?scope=` is an identity rung (org/resource/thread) or a reconciled
  // structural scope node id from the scope tree. Rung names are never node
  // ids; a thread rung without a thread id falls back to the project view.
  const selection: KnowledgeSelection | undefined =
    requestedScope === 'org' || requestedScope === 'resource'
      ? { scopeLevel: requestedScope }
      : requestedScope === 'thread'
        ? { scopeLevel: threadId ? 'thread' : 'resource' }
        : requestedScope
          ? { scopeNodeId: requestedScope }
          : threadId
            ? { scopeLevel: 'thread' }
            : undefined;
  const scopesQuery = useKnowledgeScopes(factoryProjectId, threadId);
  const scopePageKey = threadId ?? 'project';
  const [loadedScopeNodesByView, setLoadedScopeNodesByView] = useState<Record<string, KnowledgeScopeNode[]>>({});
  const [searchedScope, setSearchedScope] = useState<KnowledgeScopeNode>();
  const loadedScopeNodes = loadedScopeNodesByView[scopePageKey] ?? [];
  const allScopeNodes = [...(scopesQuery.data?.scopeNodes ?? []), ...loadedScopeNodes].filter(
    (node, index, all) => all.findIndex(candidate => candidate.id === node.id) === index,
  );
  // A merged entry's rung survives the `?scope=<uuid>` deep link through the
  // scopes payload: the root whose scopeNodeId matches supplies the rung for
  // activity/flyout context.
  const markerRung = selection?.scopeNodeId
    ? scopesQuery.data?.roots.find(root => root.scopeNodeId === selection.scopeNodeId)?.level
    : undefined;
  const scopeLevel = selection?.scopeLevel ?? markerRung;
  const requestedView = searchParams.get('view');
  const activeView = requestedView === 'activity' || requestedView === 'imports' ? requestedView : 'explore';
  const importerId = searchParams.get('importer') ?? undefined;
  const runId = searchParams.get('run') ?? undefined;
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
  // The node trail (A7): the flyout shows the LAST entry; earlier entries
  // are clickable breadcrumbs back through the hops.
  const [trail, setTrail] = useState<TrailEntry[]>([]);
  const deepLinkedNodeId = searchParams.get('node');
  const deepLinkedRung = searchParams.get('nodeRung');
  const deepLinkedSelection: TrailEntry | null = deepLinkedNodeId
    ? {
        nodeId: deepLinkedNodeId,
        name: searchParams.get('nodeName') ?? deepLinkedNodeId,
        recordId: searchParams.get('record') ?? undefined,
        rung:
          deepLinkedRung === 'org' || deepLinkedRung === 'resource' || deepLinkedRung === 'thread'
            ? deepLinkedRung
            : undefined,
      }
    : null;
  const selected = trail.at(-1) ?? deepLinkedSelection;
  // Selecting highlights; details open only on an explicit action (the Details button, a second
  // tap on the selected node, a search result, or a deep link), so exploring never covers the canvas.
  const [detailsOpen, setDetailsOpen] = useState(() => searchParams.has('node'));
  const visibleTrail = trail.length > 0 ? trail : deepLinkedSelection ? [deepLinkedSelection] : [];
  const detailScopeLevel = selected?.rung ?? scopeLevel;
  const setSelected = (entry: TrailEntry | null, { open = false }: { open?: boolean } = {}) => {
    setDetailsOpen(Boolean(entry) && open);
    setTrail(entry ? [entry] : []);
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      writeNodeSelection(copy, entry);
      return copy;
    });
  };
  const pushSelected = (entry: TrailEntry) => {
    setDetailsOpen(true);
    setTrail(current => [...current, entry]);
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      writeNodeSelection(copy, entry);
      return copy;
    });
  };

  // Live updates hold while the user is exploring (moving, clicking,
  // zooming) and resume after 10s of stillness — the layout never shifts
  // under someone mid-interaction.
  const { idle, onActivity } = useInteractionIdle(10_000);
  const graphQuery = useKnowledgeGraph(scopesQuery.data ? factoryProjectId : undefined, selection, threadId, {
    paused: !idle,
  });

  // Arrival diffing: baseline per view; a view switch resets it (no mass
  // arrival animation on switch), same-view polls diff by id sets.
  const selectionKey = selection?.scopeNodeId ?? selection?.scopeLevel;
  const baseline = useRef<DiffBaseline | null>(null);
  const nextBaseline = useMemo<DiffBaseline | undefined>(() => {
    if (!graphQuery.data) return undefined;
    return {
      viewKey: `${selectionKey}:${threadId ?? 'project'}`,
      version: graphQuery.data.version,
      nodeIds: new Set(graphQuery.data.nodes.map(node => node.id)),
      edgeIds: new Set(graphQuery.data.edges.map(edge => edge.id)),
    };
  }, [graphQuery.data, selectionKey, threadId]);
  const arrivals = useMemo<Arrivals | undefined>(
    () => (nextBaseline ? computeArrivals(baseline.current, nextBaseline) : undefined),
    [nextBaseline],
  );
  // Advance the baseline in an effect so a StrictMode double render or a
  // discarded concurrent render never diffs a payload against itself.
  useEffect(() => {
    if (nextBaseline) baseline.current = nextBaseline;
  }, [nextBaseline]);

  const openThread = (nextThreadId: string) => {
    setTrail([]);
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      writeNodeSelection(copy, null);
      copy.set('thread', nextThreadId);
      copy.set('scope', 'thread');
      return copy;
    });
  };
  const backToProject = () => {
    setTrail([]);
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      writeNodeSelection(copy, null);
      copy.delete('thread');
      copy.set('scope', 'resource');
      return copy;
    });
  };
  /** `fallback` describes a scope the tree has not loaded, such as a lens member clicked on the canvas. */
  const selectScope = (
    next: KnowledgeSelection,
    fallback?: KnowledgeScopeNode,
    { open = false }: { open?: boolean } = {},
  ) => {
    const loadedScope = next.scopeNodeId
      ? allScopeNodes.find(scopeNode => scopeNode.id === next.scopeNodeId)
      : undefined;
    const fallbackScope = !loadedScope && fallback?.id === next.scopeNodeId ? fallback : undefined;
    const nextScope = loadedScope ?? fallbackScope;
    const nextRung =
      next.scopeLevel ?? scopesQuery.data?.roots.find(root => root.scopeNodeId === next.scopeNodeId)?.level;
    const nextEntry = nextScope ? { nodeId: nextScope.id, name: nextScope.name, rung: nextRung } : null;
    setSearchedScope(fallbackScope);
    setDetailsOpen(Boolean(nextEntry) && open);
    setTrail(nextEntry ? [nextEntry] : []);
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      writeNodeSelection(copy, nextEntry);
      // A scope-node selection changes the lens and selects the same node; its
      // details open on request. The URL carries both states so the result is linkable.
      copy.set('scope', next.scopeNodeId ?? next.scopeLevel);
      return copy;
    });
  };
  const selectSearchResult = (result: KnowledgeSearchResult) => {
    const entry: TrailEntry = { nodeId: result.id, name: result.name, rung: result.rung ?? undefined };
    if (result.type === 'scope') {
      setSearchedScope({
        id: result.id,
        address: result.address ?? result.name,
        name: result.name,
        kind: result.kind,
        ...(result.description ? { description: result.description } : {}),
        parentIds: [],
        memberCount: 0,
        memberCountTruncated: false,
        contentNodeCount: 0,
        childScopeCount: 0,
      });
    } else {
      setSearchedScope(undefined);
    }
    setDetailsOpen(true);
    setTrail([entry]);
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      writeNodeSelection(copy, entry);
      if (result.type === 'scope') {
        if (result.threadId) copy.set('thread', result.threadId);
        else copy.delete('thread');
        copy.set('scope', result.id);
      } else {
        writeRungScope(copy, result.rung ?? 'resource', result.threadId);
      }
      return copy;
    });
  };

  const selectActivityEvent = (event: KnowledgeActivityEvent) => {
    const entry: TrailEntry = {
      nodeId: event.node.id,
      name: event.node.name,
      rung: event.node.rung,
      ...(event.recordId ? { recordId: event.recordId } : {}),
    };
    setSearchedScope(undefined);
    setDetailsOpen(true);
    setTrail([entry]);
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      writeNodeSelection(copy, entry);
      copy.delete('view');
      writeRungScope(copy, event.node.rung, event.node.threadId);
      return copy;
    });
  };

  const threadGone = Boolean(
    threadId &&
    ((scopesQuery.error instanceof RequestError && scopesQuery.error.status === 404) ||
      (graphQuery.error instanceof RequestError && graphQuery.error.status === 404)),
  );
  let body: React.ReactNode;
  if (threadGone) {
    // Stale deep link or a session whose knowledge was since deleted —
    // calm state with a way back, never an error toast.
    body = (
      <div data-testid="knowledge-thread-gone" className="flex flex-col items-start gap-2 py-8">
        <Txt tone="muted" as="p" variant="body">
          This session's knowledge is no longer available.
        </Txt>
        <button type="button" className="text-badge-purple-indicator hover:underline" onClick={backToProject}>
          <Txt as="span" variant="body" className="block">
            Back to the project view
          </Txt>
        </button>
      </div>
    );
  } else if (scopesQuery.isError) {
    const message = scopesQuery.error instanceof Error ? scopesQuery.error.message : 'Unable to load knowledge scopes.';
    body = <Notice variant="destructive">{message}</Notice>;
  } else if (scopesQuery.isPending) {
    body = <SkeletonRows label="Loading knowledge scopes" rows={3} />;
  } else if (!selection) {
    body = (
      <Txt tone="muted" as="p" variant="body">
        Select a scope to explore its knowledge.
      </Txt>
    );
  } else if (graphQuery.isError) {
    const message =
      graphQuery.error instanceof Error ? graphQuery.error.message : 'Unable to load the knowledge graph.';
    body = <Notice variant="destructive">{message}</Notice>;
  } else if (graphQuery.isPending) {
    body = <SkeletonRows label="Loading knowledge graph" rows={6} />;
  } else if (graphQuery.data.nodes.length === 0) {
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
      <Txt tone="muted" as="p" variant="body">
        {emptyMessage}
      </Txt>
    );
  } else {
    const selectedNodeId = selected?.nodeId;
    const selectedScope =
      selectedNodeId && selectedNodeId === selection.scopeNodeId
        ? (allScopeNodes.find(scopeNode => scopeNode.id === selectedNodeId) ??
          (searchedScope?.id === selectedNodeId ? searchedScope : undefined))
        : undefined;
    const selectedScopeMemberIds = new Set(
      selectedScope
        ? graphQuery.data.edges
            .filter(edge => edge.type === 'contains' && edge.source === selectedScope.id)
            .map(edge => edge.target)
        : [],
    );
    const selectedScopeMembers = graphQuery.data.nodes.filter(node => selectedScopeMemberIds.has(node.id));
    const childScopeCount = selectedScopeMembers.filter(node => node.isScope).length;
    const contentNodeCount = selectedScopeMembers.length - childScopeCount;
    const clickNode = (node: KnowledgeGraphNode) => {
      // First tap selects and highlights; tapping the selected node again opens its details.
      const open = selected?.nodeId === node.id;
      if (node.isScope) {
        // Scope selection is identical in the tree and canvas: switch the lens
        // and select that scope; a second tap opens its detail surface.
        selectScope(
          { scopeNodeId: node.id },
          {
            id: node.id,
            address: node.name,
            name: node.name,
            ...(node.kind ? { kind: node.kind } : {}),
            ...(node.description ? { description: node.description } : {}),
            parentIds: [],
            memberCount: node.memberCount ?? 0,
            memberCountTruncated: node.memberCountTruncated ?? false,
            contentNodeCount: node.contentNodeCount ?? 0,
            childScopeCount: node.childScopeCount ?? 0,
          },
          { open },
        );
        return;
      }
      setSelected({ nodeId: node.id, name: node.name, rung: node.rung }, { open });
    };
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
          {layout === 'list' ? (
            <KnowledgeList
              payload={graphQuery.data}
              rootScopeId={selection.scopeNodeId}
              selectedNodeId={selected?.nodeId}
              selectedRecordId={selected?.recordId}
              onNodeClick={clickNode}
              onRecordClick={(node, recordId) =>
                // Tapping a record is an explicit request to read it.
                setSelected({ nodeId: node.id, name: node.name, rung: node.rung, recordId }, { open: true })
              }
            />
          ) : (
            <KnowledgeGraph
              payload={graphQuery.data}
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
                const node = graphQuery.data?.nodes.find(entry => entry.id === edge.source);
                setSelected({
                  nodeId: edge.source,
                  name: node?.name ?? edge.source,
                  recordId: edge.recordId,
                  rung: node?.rung,
                });
              }}
            />
          )}
          {selected && !detailsOpen ? (
            <div
              role="toolbar"
              aria-label="Selected knowledge"
              className="border-border bg-card shadow-overlay absolute bottom-3 left-1/2 z-10 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-full border py-1 pr-1 pl-3"
            >
              <Txt as="span" variant="caption" className="text-foreground truncate">
                {selected.name}
              </Txt>
              <Button type="button" size="sm" variant="ghost" onClick={() => setDetailsOpen(true)}>
                Details
              </Button>
            </div>
          ) : null}
        </div>
        {!detailsOpen ? null : selectedScope && factoryProjectId ? (
          <KnowledgeScopeFlyout
            factoryProjectId={factoryProjectId}
            selection={selection}
            scope={selectedScope}
            childScopeCount={childScopeCount}
            contentNodeCount={contentNodeCount}
            countsTruncated={graphQuery.data.truncated || selectedScope.memberCountTruncated}
            threadId={threadId}
            onSelectActivity={selectActivityEvent}
            onClose={() => setSelected(null)}
          />
        ) : selected && factoryProjectId && detailScopeLevel ? (
          <KnowledgeFlyout
            factoryProjectId={factoryProjectId}
            nodeId={selected.nodeId}
            // Content surfaced through a structural lens is read at its own
            // identity rung, not the rung of the scope used to reach it.
            scopeLevel={detailScopeLevel}
            threadId={threadId}
            focusRecordId={selected.recordId}
            onSelectRecord={recordId => {
              // Bidirectional selection: expanding a card selects the knowledge record
              // page-wide, so the graph lights its marker/edge up too.
              const entry = { ...selected, recordId: recordId ?? undefined };
              setTrail(current => (current.length === 0 ? [entry] : [...current.slice(0, -1), entry]));
              setSearchParams(params => {
                const copy = new URLSearchParams(params);
                writeNodeSelection(copy, entry);
                return copy;
              });
            }}
            onClose={() => setSelected(null)}
            onOpenThread={openThread}
            onNodeRef={name => {
              // A clicked [[wikilink]] gets the full node-click treatment (A7):
              // ego focus + cluster zoom + flyout swap, PUSHED onto the trail.
              const lowerName = name.toLowerCase();
              const target = graphQuery.data?.nodes.find(node => node.name.toLowerCase() === lowerName);
              if (target && target.id !== selected.nodeId) {
                pushSelected({ nodeId: target.id, name: target.name, rung: target.rung });
                return;
              }
              const outside = graphQuery.data?.outOfWindow.find(node => node.name.toLowerCase() === lowerName);
              if (!outside || outside.id === selected.nodeId) return;

              const entry = { nodeId: outside.id, name: outside.name, rung: outside.rung };
              setDetailsOpen(true);
              setTrail([entry]);
              setSearchParams(params => {
                const copy = new URLSearchParams(params);
                writeNodeSelection(copy, entry);
                const targetThread = outside.scope.find(address => address.startsWith('thread:'))?.slice(7);
                writeRungScope(copy, outside.rung, targetThread);
                return copy;
              });
            }}
          />
        ) : null}
      </div>
    );
  }

  const setView = (view: 'explore' | 'activity' | 'imports') => {
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      if (view === 'explore') copy.delete('view');
      else copy.set('view', view);
      copy.delete('importer');
      copy.delete('run');
      return copy;
    });
  };

  const openImportRun = (nextImporterId: string, nextRunId: string) => {
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      copy.set('view', 'imports');
      copy.set('importer', nextImporterId);
      copy.set('run', nextRunId);
      return copy;
    });
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 pt-2" aria-label="Knowledge graph">
      <header className="shrink-0">
        <Txt tone="ink" as="h1" variant="heading">
          Knowledge
        </Txt>
        <Txt tone="muted" as="p" variant="body" className="mt-1">
          Explore captured knowledge and review how it changes over time.
        </Txt>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="flex gap-1" role="tablist" aria-label="Knowledge views">
            {(['explore', 'activity', 'imports'] as const).map(view => (
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
              </button>
            ))}
          </div>
          <div className="flex items-start gap-2">
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
            <KnowledgeSearch factoryProjectId={factoryProjectId} threadId={threadId} onSelect={selectSearchResult} />
          </div>
        </div>
        <Breadcrumb
          threadId={threadId}
          trail={visibleTrail}
          onProjectClick={backToProject}
          onTrailClick={index => {
            const next = visibleTrail.slice(0, index + 1);
            setTrail(next);
            setSearchParams(params => {
              const copy = new URLSearchParams(params);
              writeNodeSelection(copy, next.at(-1) ?? null);
              return copy;
            });
          }}
        />
      </header>
      <div className={cn('flex min-h-0 flex-1 gap-4', layout === 'list' && 'flex-col')}>
        <ScopeTree
          className={layout === 'list' ? 'max-h-48 w-full' : 'w-56'}
          key={`${factoryProjectId}:${threadId ?? 'project'}`}
          factoryProjectId={factoryProjectId}
          threadId={threadId}
          scopes={scopesQuery.data}
          selection={selection}
          onSelect={selectScope}
          onOpenSession={openThread}
          onNodesLoaded={nodes =>
            setLoadedScopeNodesByView(current => ({
              ...current,
              [scopePageKey]: [...(current[scopePageKey] ?? []), ...nodes],
            }))
          }
        />
        {/* Flex column so the graph container's `min-h-0 flex-1` chain connects
            to a sized parent; as a block wrapper it collapses to zero height. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {activeView === 'activity' ? (
            <ActivityPanel
              factoryProjectId={factoryProjectId}
              selection={selection}
              threadId={threadId}
              onSelect={selectActivityEvent}
              onOpenRun={openImportRun}
            />
          ) : activeView === 'imports' ? (
            <KnowledgeImports factoryProjectId={factoryProjectId} initialImporterId={importerId} initialRunId={runId} />
          ) : (
            body
          )}
        </div>
      </div>
    </section>
  );
}
