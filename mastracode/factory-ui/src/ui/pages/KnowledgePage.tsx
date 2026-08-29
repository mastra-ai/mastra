import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useKnowledgeActivity, useKnowledgeGraph, useKnowledgeScopes } from '../../hooks/useKnowledgeGraph';
import { SkeletonRows } from '../ui/SkeletonRows';
import { FactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { KnowledgeGraph } from '../domains/factory/components/knowledge/KnowledgeGraph';
import { KnowledgeFlyout } from '../domains/factory/components/knowledge/KnowledgeFlyout';
import type { Arrivals, DiffBaseline } from '../domains/factory/components/knowledge/graphDiff';
import { computeArrivals } from '../domains/factory/components/knowledge/graphDiff';
import type { KnowledgeScopeTreePayload } from '../domains/factory/services/knowledge';
import { RequestError } from '../domains/factory/services/request';
import { useInteractionIdle } from '../domains/factory/components/knowledge/useInteractionIdle';

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
  return <FactoryPageShell>{project => <KnowledgeContent factoryProjectId={project.id} />}</FactoryPageShell>;
}

/** One hop in the node trail (A7): the nodes visited via clicks/wikilinks. */
export interface TrailEntry {
  nodeId: string;
  name: string;
  recordId?: string;
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
              className="text-icon6 truncate pl-3 text-left font-medium"
              onClick={() => onSelectScope(tree.scope.id)}
            >
              {tree.scope.name}
            </button>
            {tree.children.map(scope => (
              <button
                key={scope.id}
                type="button"
                className="hover:text-icon6 truncate pl-6 text-left"
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

function ActivityPanel({ factoryProjectId, threadId }: { factoryProjectId?: string; threadId?: string }) {
  const activity = useKnowledgeActivity(factoryProjectId, threadId);
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
            <span className="text-icon5 font-medium">{event.action}</span>
            <span className="text-icon3 ml-2">{event.targetType}</span>
          </div>
          <time className="text-icon3 shrink-0 text-xs" dateTime={event.createdAt}>
            {new Date(event.createdAt).toLocaleString()}
          </time>
        </li>
      ))}
    </ol>
  );
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
  const activeView = searchParams.get('view') === 'activity' ? 'activity' : 'explore';
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

  const openThread = (nextThreadId: string) => {
    setSelected(null);
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      copy.set('thread', nextThreadId);
      copy.delete('scope');
      return copy;
    });
  };
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
    body = (
      <Txt as="p" variant="ui-md" className="text-icon3">
        No knowledge captured yet — the graph fills in as factory sessions work.
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
            onOpenThread={openThread}
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
        <div className="mt-3 flex gap-1" role="tablist" aria-label="Knowledge views">
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
        <div className="min-w-0 flex-1">
          {activeView === 'activity' ? <ActivityPanel factoryProjectId={factoryProjectId} threadId={threadId} /> : body}
        </div>
      </div>
    </section>
  );
}
