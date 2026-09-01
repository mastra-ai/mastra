import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useKnowledgeActivity, useKnowledgeGraph, useKnowledgeScopes } from '../../hooks/useKnowledgeGraph';
import { SkeletonRows } from '../ui/SkeletonRows';
import { FactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { KnowledgeGraph } from '../domains/factory/components/knowledge/KnowledgeGraph';
import { KnowledgeFlyout } from '../domains/factory/components/knowledge/KnowledgeFlyout';
import { KnowledgeApprovals } from '../domains/factory/components/knowledge/KnowledgeApprovals';
import { KnowledgeImports } from '../domains/factory/components/knowledge/KnowledgeImports';
import type { Arrivals, DiffBaseline } from '../domains/factory/components/knowledge/graphDiff';
import { computeArrivals } from '../domains/factory/components/knowledge/graphDiff';
import type { KnowledgeScopeTreePayload } from '../domains/factory/services/knowledge';
import { RequestError } from '../domains/factory/services/request';
import { useInteractionIdle } from '../domains/factory/components/knowledge/useInteractionIdle';

/**
 * A live, access-filtered view of the project's knowledge. Selected scope and
 * session state live in search params so views remain linkable and back-button safe.
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

function ScopeTree({
  tree,
  selectedScopeId,
  onSelectScope,
  onProjectClick,
}: {
  tree: KnowledgeScopeTreePayload | undefined;
  selectedScopeId: string | undefined;
  onSelectScope: (scopeId: string) => void;
  onProjectClick: () => void;
}) {
  return (
    <aside aria-label="Knowledge scopes" className="border-surface5 bg-surface2 w-48 shrink-0 rounded-lg border p-3">
      <Txt as="h2" variant="ui-sm" className="text-icon5 mb-2 font-semibold">
        Scopes
      </Txt>
      <div className="text-icon4 flex flex-col gap-1 text-xs">
        <button type="button" className="hover:text-icon6 text-left" onClick={onProjectClick}>
          Project scope
        </button>
        {tree ? (
          <>
            <button
              type="button"
              aria-current={tree.scope.id === selectedScopeId ? 'page' : undefined}
              className={cn(
                'hover:text-icon6 w-full truncate rounded-md px-2 py-1 text-left',
                tree.scope.id === selectedScopeId && 'bg-surface4 text-icon6 font-medium',
              )}
              onClick={() => onSelectScope(tree.scope.id)}
            >
              {tree.scope.name}
            </button>
            {tree.children.map(scope => (
              <button
                key={scope.id}
                type="button"
                aria-current={scope.id === selectedScopeId ? 'page' : undefined}
                className={cn(
                  'hover:text-icon6 w-full truncate rounded-md px-2 py-1 pl-5 text-left',
                  scope.id === selectedScopeId && 'bg-surface4 text-icon6 font-medium',
                )}
                onClick={() => onSelectScope(scope.id)}
              >
                {scope.name}
              </button>
            ))}
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
    <Button variant="ghost" size="xs" className="ml-1" onClick={() => onOpen(importerId, runId)}>
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
  const events = activity.data.events;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" aria-label="Knowledge activity filters">
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
      {events.length === 0 ? (
        <Txt as="p" variant="ui-md" className="text-icon3">
          No knowledge activity matches these filters.
        </Txt>
      ) : (
        <ol aria-label="Knowledge activity" className="divide-surface5 divide-y">
          {events.map(event => (
            <li key={event.id} className="flex items-start justify-between gap-4 py-3 text-sm">
              <div>
                <span className="text-icon5 font-medium">{event.action}</span>
                <span className="text-icon3 ml-2">{event.targetType}</span>
                {event.sourceId && event.importRunId ? (
                  <ImportRunLink importerId={event.sourceId} runId={event.importRunId} onOpen={onOpenRun} />
                ) : (
                  <span className="text-icon3 ml-2">{event.sourceType}</span>
                )}
              </div>
              <time className="text-icon3 shrink-0 text-xs" dateTime={event.createdAt}>
                {new Date(event.createdAt).toLocaleString()}
              </time>
            </li>
          ))}
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
    return factoryProjectId ? <KnowledgeApprovals factoryProjectId={factoryProjectId} onOpenNode={onOpenNode} /> : null;
  }
  if (view === 'imports') {
    return <KnowledgeImports factoryProjectId={factoryProjectId} initialImporterId={importerId} initialRunId={runId} />;
  }
  return explore;
}

function ThreadGone({ onBack }: { onBack: () => void }) {
  return (
    <div data-testid="knowledge-thread-gone" className="flex flex-col items-start gap-2 py-8">
      <Txt as="p" variant="ui-md" className="text-icon4">
        This session's knowledge is no longer available.
      </Txt>
      <button type="button" className="text-sm text-purple-300 hover:underline" onClick={onBack}>
        Back to the project view
      </button>
    </div>
  );
}

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
  // The node trail (A7): the flyout shows the LAST entry; earlier entries
  // are clickable breadcrumbs back through the hops.
  const [trail, setTrail] = useState<TrailEntry[]>([]);
  const selected = trail.at(-1) ?? null;
  const setSelected = (entry: TrailEntry | null) => setTrail(entry ? [entry] : []);

  // Live updates hold while the user is exploring (moving, clicking,
  // zooming) and resume after 10s of stillness — the layout never shifts
  // under someone mid-interaction.
  const { idle, onActivity } = useInteractionIdle(10_000);
  const scopeQuery = useKnowledgeScopes(factoryProjectId, requestedScopeId, threadId);
  const selectedScopeId = requestedScopeId ?? scopeQuery.data?.scope.id;
  const graphQuery = useKnowledgeGraph(factoryProjectId, selectedScopeId, threadId, { paused: !idle });

  // Arrival diffing: baseline per view; a view switch resets it (no mass
  // arrival animation on switch), same-view polls diff by id sets.
  const baseline = useRef<DiffBaseline | null>(null);
  const nextBaseline = useMemo<DiffBaseline | undefined>(() => {
    if (!graphQuery.data) return undefined;
    return {
      viewKey: `${threadId ? `thread:${threadId}` : 'project'}:scope:${selectedScopeId ?? 'pending'}`,
      version: graphQuery.data.version,
      nodeIds: new Set(graphQuery.data.nodes.map(node => node.id)),
      edgeIds: new Set(graphQuery.data.edges.map(edge => edge.id)),
    };
  }, [graphQuery.data, selectedScopeId, threadId]);
  const arrivals = useMemo<Arrivals | undefined>(
    () => (nextBaseline ? computeArrivals(baseline.current, nextBaseline) : undefined),
    [nextBaseline],
  );
  // Advance the baseline in an effect so a StrictMode double render or a
  // discarded concurrent render never diffs a payload against itself.
  useEffect(() => {
    if (nextBaseline) baseline.current = nextBaseline;
  }, [nextBaseline]);

  const backToProject = () => {
    setSelected(null);
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      copy.delete('thread');
      copy.delete('scope');
      return copy;
    });
  };
  const selectScope = (scopeId: string) => {
    setSelected(null);
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      copy.set('scope', scopeId);
      return copy;
    });
  };

  let body: React.ReactNode;
  if (scopeQuery.isError) {
    if (threadId && scopeQuery.error instanceof RequestError && scopeQuery.error.status === 404) {
      body = <ThreadGone onBack={backToProject} />;
    } else {
      const message = scopeQuery.error instanceof Error ? scopeQuery.error.message : 'Unable to load knowledge scopes.';
      body = <Notice variant="destructive">{message}</Notice>;
    }
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
            if (!id) return setTrail([]);
            const node = graphQuery.data?.nodes.find(entry => entry.id === id);
            setTrail([{ nodeId: id, name: node?.name ?? id }]);
          }}
          onNodeClick={node => setSelected({ nodeId: node.id, name: node.name })}
          onEdgeClick={edge => {
            // Selecting an edge selects AND expands the supporting knowledge record (A7).
            const node = graphQuery.data?.nodes.find(entry => entry.id === edge.source);
            setSelected({ nodeId: edge.source, name: node?.name ?? edge.source, recordId: edge.recordId });
          }}
        />
        {selected && factoryProjectId && selectedScopeId ? (
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
            onClose={() => setTrail([])}
            onNodeRef={name => {
              // A clicked [[wikilink]] gets the full node-click treatment (A7):
              // ego focus + cluster zoom + flyout swap, PUSHED onto the trail.
              const target = graphQuery.data?.nodes.find(node => node.name.toLowerCase() === name.toLowerCase());
              if (target && target.id !== selected.nodeId)
                setTrail(current => [...current, { nodeId: target.id, name: target.name }]);
            }}
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

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 pt-2" aria-label="Knowledge graph">
      <header className="shrink-0">
        <Txt as="h1" variant="header-md" className="text-icon6 font-semibold">
          Knowledge
        </Txt>
        <Txt as="p" variant="ui-md" className="text-icon3 mt-1">
          Explore captured knowledge and review how it changes over time.
        </Txt>
        <div className="mt-3 flex gap-1" role="tablist" aria-label="Knowledge views">
          {(['explore', 'activity', 'approvals', 'imports'] as const).map(view => (
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
        <Breadcrumb
          threadId={threadId}
          trail={trail}
          onProjectClick={backToProject}
          onTrailClick={index => setTrail(current => current.slice(0, index + 1))}
        />
      </header>
      <div className="flex min-h-0 flex-1 gap-4">
        <ScopeTree
          tree={scopeQuery.data}
          selectedScopeId={selectedScopeId}
          onSelectScope={selectScope}
          onProjectClick={backToProject}
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
            onOpenRun={openImportRun}
            onOpenNode={(nodeId, name) => {
              setTrail([{ nodeId, name }]);
              setView('explore');
            }}
            explore={body}
          />
        </div>
      </div>
    </section>
  );
}
