import { Badge } from '@mastra/playground-ui/components/Badge';
import { Notice } from '@mastra/playground-ui/components/Notice';
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
import { FactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { KnowledgeGraph } from '../domains/factory/components/knowledge/KnowledgeGraph';
import { KnowledgeFlyout } from '../domains/factory/components/knowledge/KnowledgeFlyout';
import { KnowledgeSearch } from '../domains/factory/components/knowledge/KnowledgeSearch';
import type { Arrivals, DiffBaseline } from '../domains/factory/components/knowledge/graphDiff';
import { computeArrivals } from '../domains/factory/components/knowledge/graphDiff';
import type {
  KnowledgeActivityEvent,
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
 * sessions); thread-scoped knowledge is reached only by drilling into a
 * knowledge record's "captured in session" link, which switches to the thread view with
 * an org → project → thread breadcrumb (Amendment A2). Thread state lives in
 * the `?thread=` search param so the view is linkable and back-button safe.
 */
export function KnowledgePage() {
  return (
    <FactoryPageShell>
      {project => <KnowledgeContent key={project.id} factoryProjectId={project.id} />}
    </FactoryPageShell>
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
    <nav aria-label="Knowledge scope" className="text-icon3 mt-1 flex flex-wrap items-center gap-1 text-xs">
      <button type="button" className="hover:text-icon5" onClick={onProjectClick}>
        org
      </button>
      <ChevronRight size={11} />
      <button type="button" className="hover:text-icon5" onClick={onProjectClick}>
        project
      </button>
      {threadId ? (
        <>
          <ChevronRight size={11} />
          <span className="max-w-52 truncate text-purple-300" title={threadId}>
            session {threadId.slice(0, 8)}
          </span>
        </>
      ) : null}
      {trail.map((entry, index) => (
        <span key={`${entry.nodeId}-${index}`} className="flex items-center gap-1">
          <ChevronRight size={11} />
          {index === trail.length - 1 ? (
            <span className="text-icon5 max-w-44 truncate" title={entry.name}>
              {entry.name}
            </span>
          ) : (
            <button
              type="button"
              className="hover:text-icon5 max-w-44 truncate"
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
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate">{name}</span>
        <Badge variant="neutral" emphasis="muted" size="xs">
          {kind}
        </Badge>
      </span>
      {memberCount !== undefined ? (
        <span className="text-icon3">
          {memberCount}
          {memberCountTruncated ? '+' : ''} inside
        </span>
      ) : null}
    </span>
  );
}

function ScopeTree({
  factoryProjectId,
  threadId,
  scopes,
  selection,
  onSelect,
  onNodesLoaded,
}: {
  factoryProjectId: string | undefined;
  threadId?: string;
  scopes: KnowledgeScopeTreePayload | undefined;
  selection: KnowledgeSelection | undefined;
  onSelect: (selection: KnowledgeSelection) => void;
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
    const page = await scopePage.mutateAsync({ ...(parentId ? { parentId } : {}), ...(cursor ? { cursor } : {}) });
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
    const kind = marker ? identityKind(marker) : (node.kind ?? 'scope');
    const pressed = selection?.scopeNodeId === node.id || (marker !== undefined && selection?.scopeLevel === marker);
    const children = byParent.get(node.id) ?? [];
    const expanded =
      (depth === 0 && !collapsedRootIds.has(node.id)) || expandedIds.has(node.id) || selectedAncestors.has(node.id);
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
              className="hover:text-icon6 flex size-5 shrink-0 items-center justify-center"
              onClick={() => {
                if (expanded) {
                  if (depth === 0) setCollapsedRootIds(current => new Set(current).add(node.id));
                  else
                    setExpandedIds(current => {
                      const next = new Set(current);
                      next.delete(node.id);
                      return next;
                    });
                  return;
                }
                if (children.length === 0) void loadPage(node.id, undefined);
                if (depth === 0)
                  setCollapsedRootIds(current => {
                    const next = new Set(current);
                    next.delete(node.id);
                    return next;
                  });
                else setExpandedIds(current => new Set(current).add(node.id));
              }}
            >
              <ChevronRight className={cn('size-3 transition-transform', expanded && 'rotate-90')} />
            </button>
          ) : (
            <span className="size-5 shrink-0" />
          )}
          <button
            type="button"
            aria-pressed={pressed}
            className={cn(
              'hover:text-icon6 min-w-0 flex-1 rounded-md px-1 py-1 text-left',
              pressed && 'bg-surface4 text-icon6 font-medium',
            )}
            title={node.description ?? node.name}
            onClick={() => onSelect(marker ? { scopeNodeId: node.id, scopeLevel: marker } : { scopeNodeId: node.id })}
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
            className="text-icon3 hover:text-icon5 py-1 text-left"
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
      className="border-surface5 bg-surface2 w-56 shrink-0 overflow-y-auto rounded-lg border p-3"
    >
      <Txt as="h2" variant="ui-sm" className="text-icon5 mb-2 font-semibold">
        Scopes
      </Txt>
      <div className="text-icon4 flex flex-col gap-1 text-xs">
        {treeRoots.map(node => renderScopeNode(node, 0, new Set()))}
        {rootCursor ? (
          <button
            type="button"
            className="text-icon3 hover:text-icon5 px-2 py-1 text-left"
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
              'hover:text-icon6 w-full rounded-md px-2 py-1 text-left',
              selection?.scopeLevel === root.level && !selection?.scopeNodeId && 'bg-surface4 text-icon6 font-medium',
            )}
            onClick={() => onSelect({ scopeLevel: root.level })}
          >
            <ScopeLabel name={root.id.slice(0, 8)} kind={identityKind(root.level)} />
          </button>
        ))}
        {scopePage.isError ? <span className="px-2 text-red-400">Unable to load more scopes.</span> : null}
      </div>
    </aside>
  );
}

function ActivityPanel({
  factoryProjectId,
  selection,
  threadId,
  onSelect,
}: {
  factoryProjectId?: string;
  selection: KnowledgeSelection | undefined;
  threadId?: string;
  onSelect: (event: KnowledgeActivityEvent) => void;
}) {
  const activity = useKnowledgeActivity(factoryProjectId, selection, threadId);
  if (!selection) {
    return (
      <Txt as="p" variant="ui-md" className="text-icon3">
        Select a scope to view its recent activity.
      </Txt>
    );
  }
  if (activity.isPending) return <SkeletonRows label="Loading knowledge activity" rows={6} />;
  if (activity.isError) {
    const message = activity.error instanceof Error ? activity.error.message : 'Unable to load knowledge activity.';
    return <Notice variant="destructive">{message}</Notice>;
  }
  if (activity.data.events.length === 0) {
    return (
      <Txt as="p" variant="ui-md" className="text-icon3">
        No knowledge activity yet.
      </Txt>
    );
  }
  return (
    <ol aria-label="Knowledge activity" className="divide-surface5 divide-y">
      {activity.data.events.map(event => (
        <li key={event.id} className="flex items-start justify-between gap-4 py-3 text-sm">
          <div>
            <span className="text-icon5">{event.action.replaceAll('-', ' ')}</span>
            <span className="text-icon3"> · {event.recordType} · </span>
            <button
              type="button"
              className="text-icon6 font-medium hover:text-purple-300 hover:underline"
              onClick={() => onSelect(event)}
            >
              {event.node.name}
            </button>
            <div className="text-icon3 mt-1 text-xs">{event.scope.join(' → ')}</div>
          </div>
          <time className="text-icon3 shrink-0 text-xs" dateTime={event.createdAt}>
            {new Date(event.createdAt).toLocaleString()}
          </time>
        </li>
      ))}
    </ol>
  );
}

function KnowledgeContent({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const threadId = searchParams.get('thread') ?? undefined;
  const requestedScope = searchParams.get('scope');
  // `?scope=` is an identity rung (org/resource/thread) or a reconciled
  // structural scope node id from the scope tree.
  const selection: KnowledgeSelection | undefined =
    requestedScope === 'org' || requestedScope === 'resource' || (requestedScope === 'thread' && threadId)
      ? { scopeLevel: requestedScope }
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
  const activeView = searchParams.get('view') === 'activity' ? 'activity' : 'explore';
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
  const visibleTrail = trail.length > 0 ? trail : deepLinkedSelection ? [deepLinkedSelection] : [];
  const detailScopeLevel = selected?.rung ?? scopeLevel;
  const setSelected = (entry: TrailEntry | null) => {
    setTrail(entry ? [entry] : []);
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      writeNodeSelection(copy, entry);
      return copy;
    });
  };
  const pushSelected = (entry: TrailEntry) => {
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
  const selectScope = (next: KnowledgeSelection) => {
    const nextScope = next.scopeNodeId ? allScopeNodes.find(scopeNode => scopeNode.id === next.scopeNodeId) : undefined;
    const nextRung =
      next.scopeLevel ?? scopesQuery.data?.roots.find(root => root.scopeNodeId === next.scopeNodeId)?.level;
    const nextEntry = nextScope ? { nodeId: nextScope.id, name: nextScope.name, rung: nextRung } : null;
    setSearchedScope(undefined);
    setTrail(nextEntry ? [nextEntry] : []);
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      writeNodeSelection(copy, nextEntry);
      // A scope-node selection changes the lens and opens the same node's
      // detail surface. The URL carries both states so the result is linkable.
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
        childScopeCount: 0,
      });
    } else {
      setSearchedScope(undefined);
    }
    setTrail([entry]);
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      writeNodeSelection(copy, entry);
      if (result.threadId) copy.set('thread', result.threadId);
      else copy.delete('thread');
      copy.set('scope', result.type === 'scope' ? result.id : (result.rung ?? 'resource'));
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
    setTrail([entry]);
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      writeNodeSelection(copy, entry);
      copy.delete('view');
      copy.set('scope', event.node.rung);
      if (event.node.threadId) copy.set('thread', event.node.threadId);
      else copy.delete('thread');
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
        <Txt as="p" variant="ui-md" className="text-icon4">
          This session's knowledge is no longer available.
        </Txt>
        <button type="button" className="text-sm text-purple-300 hover:underline" onClick={backToProject}>
          Back to the project view
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
      <Txt as="p" variant="ui-md" className="text-icon3">
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
      <Txt as="p" variant="ui-md" className="text-icon3">
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
    body = (
      <div
        className="relative min-h-0 flex-1"
        data-testid="knowledge-graph-container"
        onPointerDownCapture={onActivity}
        onPointerMoveCapture={onActivity}
        onWheelCapture={onActivity}
      >
        <KnowledgeGraph
          payload={graphQuery.data}
          arrivals={arrivals}
          focusedId={selected?.nodeId ?? null}
          focusedRecordId={selected?.recordId ?? null}
          // A structural member listing carries no edges — label every member
          // so the lens reads as a directory, not a field of dots.
          labelAll={Boolean(selection.scopeNodeId)}
          onFocusChange={id => {
            // A graph click starts a fresh trail; a pane click clears it.
            if (!id) return setSelected(null);
            const node = graphQuery.data?.nodes.find(entry => entry.id === id);
            setSelected({ nodeId: id, name: node?.name ?? id, rung: node?.rung });
          }}
          onNodeClick={node => {
            if (node.isScope) {
              // Scope selection is identical in the tree and canvas: switch
              // the lens and open that scope's detail surface in one action.
              selectScope({ scopeNodeId: node.id });
              return;
            }
            setSelected({ nodeId: node.id, name: node.name, rung: node.rung });
          }}
          onEdgeClick={edge => {
            // Selecting an edge selects AND expands the supporting knowledge record (A7).
            const node = graphQuery.data?.nodes.find(entry => entry.id === edge.source);
            setSelected({
              nodeId: edge.source,
              name: node?.name ?? edge.source,
              recordId: edge.recordId,
              rung: node?.rung,
            });
          }}
        />
        {selectedScope && factoryProjectId ? (
          <KnowledgeScopeFlyout
            factoryProjectId={factoryProjectId}
            selection={selection}
            scope={selectedScope}
            childScopeCount={childScopeCount}
            contentNodeCount={contentNodeCount}
            threadId={threadId}
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
              setTrail([entry]);
              setSearchParams(params => {
                const copy = new URLSearchParams(params);
                writeNodeSelection(copy, entry);
                copy.set('scope', outside.rung);
                const targetThread = outside.scope.find(address => address.startsWith('thread:'))?.slice(7);
                if (outside.rung === 'thread' && targetThread) copy.set('thread', targetThread);
                else copy.delete('thread');
                return copy;
              });
            }}
          />
        ) : null}
      </div>
    );
  }

  const setView = (view: 'explore' | 'activity') => {
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      if (view === 'activity') copy.set('view', 'activity');
      else copy.delete('view');
      return copy;
    });
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 pt-2" aria-label="Knowledge graph">
      <header className="shrink-0">
        <Txt as="h1" variant="header-md" className="text-icon6 font-semibold">
          Knowledge
        </Txt>
        <Txt as="p" variant="ui-md" className="text-icon3 mt-1">
          Explore captured knowledge and review how it changes over time.
        </Txt>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="flex gap-1" role="tablist" aria-label="Knowledge views">
            {(['explore', 'activity'] as const).map(view => (
              <button
                key={view}
                type="button"
                role="tab"
                aria-selected={activeView === view}
                className={`rounded-md px-3 py-1.5 text-sm capitalize ${
                  activeView === view ? 'bg-surface4 text-icon6' : 'text-icon3 hover:text-icon5'
                }`}
                onClick={() => setView(view)}
              >
                {view}
              </button>
            ))}
          </div>
          <KnowledgeSearch factoryProjectId={factoryProjectId} threadId={threadId} onSelect={selectSearchResult} />
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
      <div className="flex min-h-0 flex-1 gap-4">
        <ScopeTree
          key={`${factoryProjectId}:${threadId ?? 'project'}`}
          factoryProjectId={factoryProjectId}
          threadId={threadId}
          scopes={scopesQuery.data}
          selection={selection}
          onSelect={selectScope}
          onNodesLoaded={nodes =>
            setLoadedScopeNodesByView(current => ({
              ...current,
              [scopePageKey]: [...(current[scopePageKey] ?? []), ...nodes],
            }))
          }
        />
        {/* Flex column so the graph container's `min-h-0 flex-1` chain connects
            to a sized parent; as a block wrapper it collapses to zero height. */}
        <div className="flex min-w-0 flex-1 flex-col">
          {activeView === 'activity' ? (
            <ActivityPanel
              factoryProjectId={factoryProjectId}
              selection={selection}
              threadId={threadId}
              onSelect={selectActivityEvent}
            />
          ) : (
            body
          )}
        </div>
      </div>
    </section>
  );
}
