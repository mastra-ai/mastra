import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useKnowledgeGraph } from '../../hooks/useKnowledgeGraph';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useSidebarHeaderSlots } from '../domains/chat/components/useSidebarHeaderSlots';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';
import { KnowledgeGraph } from '../domains/factory/components/knowledge/KnowledgeGraph';
import { KnowledgeFlyout } from '../domains/factory/components/knowledge/KnowledgeFlyout';
import { KnowledgeDetailsSurface } from '../domains/factory/components/knowledge/KnowledgeDetailsSurface';
import { getKnowledgeMotionDuration } from '../domains/factory/components/knowledge/knowledgeViewport';
import type { Arrivals, DiffBaseline } from '../domains/factory/components/knowledge/graphDiff';
import { computeArrivals } from '../domains/factory/components/knowledge/graphDiff';
import { KnowledgeGraphState } from '../domains/factory/components/knowledge/KnowledgeGraphState';
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
  const factory = useActiveFactory();
  const slots = useSidebarHeaderSlots();
  return (
    <PageLayout variant="fit" {...slots}>
      <div className="flex min-h-0 flex-col">
        <KnowledgeContent factoryProjectId={factory.id} />
      </div>
    </PageLayout>
  );
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
    <nav
      aria-label="Knowledge scope"
      className="text-muted-foreground mt-1 flex h-5 items-center gap-1 overflow-hidden whitespace-nowrap"
    >
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
        <span key={`${entry.nodeId}-${index}`} className="flex min-w-0 items-center gap-1">
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

function KnowledgeContent({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const threadId = searchParams.get('thread') ?? undefined;
  // The node trail (A7): the flyout shows the LAST entry; earlier entries
  // are clickable breadcrumbs back through the hops.
  const [trail, setTrail] = useState<TrailEntry[]>([]);
  const [closing, setClosing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const selected = trail.at(-1) ?? null;
  const cancelClose = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = undefined;
    setClosing(false);
  };
  const setSelected = (entry: TrailEntry | null) => {
    cancelClose();
    setTrail(entry ? [entry] : []);
  };
  const closeDetails = () => {
    if (!selected) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSelected(null);
      return;
    }
    setClosing(true);
    const surface = containerRef.current?.querySelector<HTMLElement>('.knowledge-details');
    // A close before the first paint, or a changed motion preference, may not
    // dispatch transitionend. Retire the retained details in those cases too.
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(
      () => setSelected(null),
      (surface ? getKnowledgeMotionDuration(surface) : 720) + 100,
    );
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);

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

  return (
    <section className="relative flex min-h-0 flex-1 flex-col" aria-label="Knowledge graph">
      <KnowledgeGraphState query={graphQuery} threadId={threadId} onBackToProject={backToProject}>
        {payload => (
          <div
            ref={containerRef}
            className="relative h-full min-h-0 flex-1"
            data-testid="knowledge-graph-container"
            onPointerDownCapture={onActivity}
            onPointerMoveCapture={onActivity}
            onWheelCapture={onActivity}
          >
            <KnowledgeGraph
              key={`${factoryProjectId}:${threadId ?? 'project'}`}
              payload={payload}
              arrivals={arrivals}
              focusedId={closing ? undefined : selected?.nodeId}
              focusedRecordId={closing ? undefined : selected?.recordId}
              onClearFocus={closeDetails}
              onNodeClick={node => setSelected({ nodeId: node.id, name: node.name })}
              onEdgeClick={edge => {
                // Selecting an edge selects AND expands the supporting knowledge record (A7).
                const node = graphQuery.data?.nodes.find(entry => entry.id === edge.source);
                setSelected({ nodeId: edge.source, name: node?.name ?? edge.source, recordId: edge.recordId });
              }}
            >
              <Breadcrumb
                threadId={threadId}
                trail={trail}
                onProjectClick={backToProject}
                onTrailClick={index => {
                  cancelClose();
                  setTrail(current => current.slice(0, index + 1));
                }}
              />
            </KnowledgeGraph>
            {selected && factoryProjectId ? (
              <KnowledgeDetailsSurface closing={closing} onExited={() => setSelected(null)}>
                <KnowledgeFlyout
                  factoryProjectId={factoryProjectId}
                  nodeId={selected.nodeId}
                  nodeName={selected.name}
                  threadId={threadId}
                  focusRecordId={selected.recordId}
                  onSelectRecord={recordId =>
                    // Bidirectional selection: expanding a card selects the knowledge record
                    // page-wide, so the graph lights its marker/edge up too.
                    setTrail(current =>
                      current.length === 0
                        ? current
                        : [
                            ...current.slice(0, -1),
                            { ...current[current.length - 1]!, recordId: recordId ?? undefined },
                          ],
                    )
                  }
                  onClose={closeDetails}
                  onOpenThread={openThread}
                  onNodeRef={name => {
                    // A clicked [[wikilink]] gets the full node-click treatment (A7):
                    // ego focus + cluster zoom + flyout swap, PUSHED onto the trail.
                    const target = graphQuery.data?.nodes.find(node => node.name.toLowerCase() === name.toLowerCase());
                    if (target && target.id !== selected.nodeId)
                      setTrail(current => [...current, { nodeId: target.id, name: target.name }]);
                  }}
                />
              </KnowledgeDetailsSurface>
            ) : null}
          </div>
        )}
      </KnowledgeGraphState>
    </section>
  );
}
