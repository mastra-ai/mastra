import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useKnowledgeGraph } from '../../hooks/useKnowledgeGraph';
import { SkeletonRows } from '../ui/SkeletonRows';
import { FactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { KnowledgeGraph } from '../domains/factory/components/knowledge/KnowledgeGraph';
import { KnowledgeFlyout } from '../domains/factory/components/knowledge/KnowledgeFlyout';
import type { Arrivals, DiffBaseline } from '../domains/factory/components/knowledge/graphDiff';
import { computeArrivals } from '../domains/factory/components/knowledge/graphDiff';
import { RequestError } from '../domains/factory/services/request';
import { useInteractionIdle } from '../domains/factory/components/knowledge/useInteractionIdle';

/**
 * The Knowledge page: a live force-directed graph of the project's knowledge —
 * entities as nodes, wikilink relationships as edges. The default view is
 * project scope (org + project records, the memories that carry across
 * sessions); thread-scoped knowledge is reached only by drilling into a
 * memory's "captured in session" link, which switches to the thread view with
 * an org → project → thread breadcrumb (Amendment A2). Thread state lives in
 * the `?thread=` search param so the view is linkable and back-button safe.
 */
export function KnowledgePage() {
  return <FactoryPageShell>{project => <KnowledgeContent factoryProjectId={project.id} />}</FactoryPageShell>;
}

/** One hop in the entity trail (A7): the nodes visited via clicks/wikilinks. */
export interface TrailEntry {
  entityId: string;
  name: string;
  factId?: string;
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
        <span key={`${entry.entityId}-${index}`} className="flex items-center gap-1">
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

function KnowledgeContent({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const threadId = searchParams.get('thread') ?? undefined;
  // The entity trail (A7): the flyout shows the LAST entry; earlier entries
  // are clickable breadcrumbs back through the hops.
  const [trail, setTrail] = useState<TrailEntry[]>([]);
  const selected = trail.at(-1) ?? null;
  const setSelected = (entry: TrailEntry | null) => setTrail(entry ? [entry] : []);

  // Live updates hold while the user is exploring (moving, clicking,
  // zooming) and resume after 10s of stillness — the layout never shifts
  // under someone mid-interaction.
  const { idle, onActivity } = useInteractionIdle(10_000);
  const graphQuery = useKnowledgeGraph(factoryProjectId, threadId, { paused: !idle });

  // Arrival diffing: baseline per view; a view switch resets it (no mass
  // arrival animation on switch), same-view polls diff by id sets.
  const baseline = useRef<DiffBaseline | null>(null);
  const nextBaseline = useMemo<DiffBaseline | undefined>(() => {
    if (!graphQuery.data) return undefined;
    return {
      viewKey: threadId ? `thread:${threadId}` : 'project',
      version: graphQuery.data.version,
      nodeIds: new Set(graphQuery.data.nodes.map(node => node.id)),
      edgeIds: new Set(graphQuery.data.edges.map(edge => edge.id)),
    };
  }, [graphQuery.data, threadId]);
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
      return copy;
    });
  };
  const backToProject = () => {
    setSelected(null);
    setSearchParams(params => {
      const copy = new URLSearchParams(params);
      copy.delete('thread');
      return copy;
    });
  };

  let body: React.ReactNode;
  if (graphQuery.isError) {
    if (threadId && graphQuery.error instanceof RequestError && graphQuery.error.status === 404) {
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
          focusedId={selected?.entityId ?? null}
          focusedFactId={selected?.factId ?? null}
          onFocusChange={id => {
            // A graph click starts a fresh trail; a pane click clears it.
            if (!id) return setTrail([]);
            const node = graphQuery.data?.nodes.find(entry => entry.id === id);
            setTrail([{ entityId: id, name: node?.name ?? id }]);
          }}
          onNodeClick={entity => setSelected({ entityId: entity.id, name: entity.name })}
          onEdgeClick={edge => {
            // Selecting an edge selects AND expands the supporting memory (A7).
            const node = graphQuery.data?.nodes.find(entry => entry.id === edge.source);
            setSelected({ entityId: edge.source, name: node?.name ?? edge.source, factId: edge.factId });
          }}
        />
        {selected && factoryProjectId ? (
          <KnowledgeFlyout
            factoryProjectId={factoryProjectId}
            entityId={selected.entityId}
            threadId={threadId}
            focusFactId={selected.factId}
            onSelectMemory={factId =>
              // Bidirectional selection: expanding a card selects the memory
              // page-wide, so the graph lights its marker/edge up too.
              setTrail(current =>
                current.length === 0
                  ? current
                  : [...current.slice(0, -1), { ...current[current.length - 1]!, factId: factId ?? undefined }],
              )
            }
            onClose={() => setTrail([])}
            onOpenThread={openThread}
            onEntityRef={name => {
              // A clicked [[wikilink]] gets the full node-click treatment (A7):
              // ego focus + cluster zoom + flyout swap, PUSHED onto the trail.
              const target = graphQuery.data?.nodes.find(node => node.name.toLowerCase() === name.toLowerCase());
              if (target && target.id !== selected.entityId)
                setTrail(current => [...current, { entityId: target.id, name: target.name }]);
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 pt-2" aria-label="Knowledge graph">
      <header className="shrink-0">
        <Txt as="h1" variant="header-md" className="text-icon6 font-semibold">
          Knowledge Graph
        </Txt>
        <Txt as="p" variant="ui-md" className="text-icon3 mt-1">
          Explore entities and the relationships captured by the agent over time.
        </Txt>
        <Breadcrumb
          threadId={threadId}
          trail={trail}
          onProjectClick={backToProject}
          onTrailClick={index => setTrail(current => current.slice(0, index + 1))}
        />
      </header>
      {body}
    </section>
  );
}
