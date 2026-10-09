import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useKnowledgeGraph } from '../../../../../hooks/useKnowledgeGraph';
import { KnowledgeGraph } from './KnowledgeGraph';
import { KnowledgeFlyout } from './KnowledgeFlyout';
import { KnowledgeDetailsSurface } from './KnowledgeDetailsSurface';
import { getKnowledgeMotionDuration } from './knowledgeViewport';
import type { Arrivals, DiffBaseline } from './graphDiff';
import { computeArrivals } from './graphDiff';
import { KnowledgeGraphState } from './KnowledgeGraphState';
import { useInteractionIdle } from './useInteractionIdle';
import { KnowledgeBreadcrumb as Breadcrumb } from './KnowledgeBreadcrumb';
import type { TrailEntry } from './KnowledgeBreadcrumb';
export function KnowledgeContent({ factoryProjectId }: { factoryProjectId: string | undefined }) {
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
      (surface ? getKnowledgeMotionDuration(surface) : 480) + 100,
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
