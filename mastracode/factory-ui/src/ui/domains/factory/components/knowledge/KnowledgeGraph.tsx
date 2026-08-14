/**
 * The force-directed knowledge graph: React Flow renders DOM nodes/edges while
 * d3-force computes positions (synchronously, deterministic). Entities are
 * nodes sized by edge degree (Amendment A3), wikilink relationships are edges,
 * pinned knowledge carries a distinct accent, and hovering a node or edge
 * shows a summary card. Dragging a node re-pins it (the layout keeps it put).
 */

import { Background, BackgroundVariant, BaseEdge, Controls, Handle, MiniMap, Position, ReactFlow, ReactFlowProvider, useInternalNode, useReactFlow, EdgeLabelRenderer } from '@xyflow/react';
import type { EdgeProps, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Boxes, Globe, Pin } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { KnowledgeGraphNode, KnowledgeGraphPayload, KnowledgeRung } from '../../services/knowledge';
import type { EntityFlowNode, KnowledgeFlowEdge, KnowledgeGraphFilters, MemoryFlowNode } from './graphModel';
import {
  deriveMemoryElements,
  egoGraph,
  filterGraph,
  memoryPairEdges,
  NO_FILTERS,
  shouldShowLabel,
  toFlowGraph,
  toMemoryFlow,
} from './graphModel';
import type { Arrivals } from './graphDiff';
import { runLayout } from './layout';

const RUNG_LABELS: Record<KnowledgeRung, string> = { org: 'Org', resource: 'Project', thread: 'Session' };

const RUNG_RING: Record<KnowledgeRung, string> = {
  org: 'border-purple-300/70',
  resource: 'border-purple-500/60',
  thread: 'border-cyan-400/60',
};

function EntityNodeComponent({ data, selected }: NodeProps<EntityFlowNode>) {
  const { entity, size, degree, focused } = data;
  const labeled = focused || shouldShowLabel(degree);
  const large = size >= 88;
  const nameSize = Math.max(10, Math.min(16, Math.round(size / 9)));
  const glow = Math.round(10 + size / 5);
  return (
    // Outer wrapper is unclipped so the pin badge can straddle the rim;
    // only the inner circle clips (it must, to keep the label inside).
    <div data-testid="knowledge-node" data-entity-id={entity.id} className="relative" style={{ width: size, height: size }}>
      {/* A11: entities never carry pin visuals — pins belong to their memory
          markers (dot / line / junction). */}
      <div
        className={[
          'flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-full border-2 text-center transition-shadow duration-200',
          RUNG_RING[entity.rung],
          selected ? 'ring-2 ring-purple-300' : '',
        ].join(' ')}
        style={{
          background: 'radial-gradient(circle at 50% 32%, rgba(124,92,255,0.22), rgba(13,13,22,0.97) 72%)',
          boxShadow: `0 0 ${glow}px rgba(139,92,246,0.35)`,
        }}
      >
        {labeled ? (
          <span
            className="pointer-events-none line-clamp-3 max-w-[78%] leading-tight font-medium break-words text-icon6"
            style={{ fontSize: nameSize }}
            title={entity.name}
          >
            {entity.name}
          </span>
        ) : null}
        {labeled && large ? (
          <span className="mt-0.5 text-[9px] font-medium tracking-widest text-purple-300/70 uppercase">
            {entity.kind.slice(0, 12)}
          </span>
        ) : null}
      </div>
      <Handle type="target" position={Position.Top} className="!invisible" />
      <Handle type="source" position={Position.Bottom} className="!invisible" />
    </div>
  );
}
const EntityNode = memo(EntityNodeComponent);

function KnowledgeLinkComponent({ id, source, target, data }: EdgeProps<KnowledgeFlowEdge>) {
  // Floating edge: anchor both ends on the circle rims along the angle between
  // the node centers, rather than at fixed handles.
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;
  const sourceSize = (sourceNode.data as EntityFlowNode['data']).size;
  const targetSize = (targetNode.data as EntityFlowNode['data']).size;
  const sx = sourceNode.internals.positionAbsolute.x + sourceSize / 2;
  const sy = sourceNode.internals.positionAbsolute.y + sourceSize / 2;
  const tx = targetNode.internals.positionAbsolute.x + targetSize / 2;
  const ty = targetNode.internals.positionAbsolute.y + targetSize / 2;
  const dx = tx - sx;
  const dy = ty - sy;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const startX = sx + ux * (sourceSize / 2);
  const startY = sy + uy * (sourceSize / 2);
  const endX = tx - ux * (targetSize / 2);
  const endY = ty - uy * (targetSize / 2);
  // Organic arc: bow perpendicular to the line, direction keyed to the edge id
  // so parallel edges don't stack. Gentle: capped so long edges never rainbow.
  const side = id.charCodeAt(id.length - 1) % 2 === 0 ? 1 : -1;
  const bow = side * Math.min(22, length * 0.07);
  const controlX = (startX + endX) / 2 + -uy * bow;
  const controlY = (startY + endY) / 2 + ux * bow;
  const path = `M ${startX},${startY} Q ${controlX},${controlY} ${endX},${endY}`;
  const pinned = data?.pinned ?? false;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={
          // A9: a pinned fact marks the RELATIONSHIP — the amber accent
          // rides the edge, with a pin chip at the arc's midpoint.
          pinned
            ? { stroke: 'rgba(251,191,36,0.75)', strokeWidth: 2 }
            : { stroke: 'rgba(139,92,246,0.4)', strokeWidth: 1.4 }
        }
      />
      {pinned && !source.startsWith('mem:') && !target.startsWith('mem:') ? (
        <EdgeLabelRenderer>
          <span
            // Nodes always render above lines and their badges — no z lift.
            className="absolute rounded-full bg-amber-400 p-1 text-[#1a1305] shadow-md shadow-amber-500/40"
            style={{
              zIndex: 0,
              // Quadratic bezier midpoint: B(0.5) = 0.25·start + 0.5·control + 0.25·end
              transform: `translate(-50%, -50%) translate(${0.25 * startX + 0.5 * controlX + 0.25 * endX}px, ${0.25 * startY + 0.5 * controlY + 0.25 * endY}px)`,
            }}
          >
            <Pin size={11} aria-label="Pinned relationship" />
          </span>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
const KnowledgeLink = memo(KnowledgeLinkComponent);

/**
 * A11: a memory rendered as its own tiny marker — a dot beside its entity or
 * a junction where a multi-entity memory splits. Pinned memories render as
 * the amber pin chip itself (the marker being a layout node is what keeps
 * the chip collision-clear of entities).
 */
function MemoryNodeComponent({ data }: NodeProps<MemoryFlowNode>) {
  const { memory, size } = data;
  return (
    <div
      data-testid="knowledge-memory-node"
      data-fact-id={memory.id}
      className={[
        'flex items-center justify-center rounded-full border transition-shadow',
        // Memories speak the theme's third color — cyan — so dots read as
        // knowledge points, not tiny entities (purple) or pins (amber).
        memory.pinned
          ? 'border-amber-300/80 bg-amber-400 text-[#1a1305] shadow-md shadow-amber-500/40'
          : 'border-cyan-300/60 bg-cyan-400/80 shadow-[0_0_6px_rgba(34,211,238,0.55)]',
      ].join(' ')}
      style={{ width: size, height: size }}
    >
      <Handle type="target" position={Position.Top} className="!invisible" />
      <Handle type="source" position={Position.Bottom} className="!invisible" />
      {memory.pinned ? <Pin size={11} aria-label="Pinned memory" /> : null}
    </div>
  );
}
const MemoryNode = memo(MemoryNodeComponent);

const nodeTypes = { knowledgeEntity: EntityNode, knowledgeMemory: MemoryNode };
const edgeTypes = { knowledgeLink: KnowledgeLink };

interface HoverCard {
  kind: 'node' | 'edge' | 'memory';
  x: number;
  y: number;
  node?: EntityFlowNode;
  edge?: KnowledgeFlowEdge;
  memory?: MemoryFlowNode;
}

export interface KnowledgeGraphProps {
  payload: KnowledgeGraphPayload;
  /** Ids that newly appeared since the previous poll (arrival animation). */
  arrivals?: Arrivals;
  /**
   * Controlled ego focus (A7): when provided, the page owns focus so wikilink
   * hops in the flyout get the same focus + cluster-zoom as a node click.
   */
  focusedId?: string | null;
  onFocusChange?: (id: string | null) => void;
  onNodeClick?: (entity: KnowledgeGraphNode) => void;
  onEdgeClick?: (edge: { source: string; target: string; factId: string }) => void;
}

function TruncationBanner({ payload }: { payload: KnowledgeGraphPayload }) {
  const parts: string[] = [];
  if (payload.truncated) parts.push(`showing the newest ${payload.nodes.length} entities`);
  if (payload.outOfWindow.length > 0) parts.push(`${payload.outOfWindow.length} linked entities outside the window`);
  if (payload.unresolvedCapped.count > 0) parts.push(`${payload.unresolvedCapped.count} links unresolved (capped)`);
  if (parts.length === 0) return null;
  return (
    <div
      data-testid="knowledge-truncation-banner"
      className="pointer-events-none absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-md border border-surface5 bg-surface3/90 px-3 py-1 text-xs text-icon4"
    >
      Partial view — {parts.join(' · ')}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  accent,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  accent?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
        active
          ? accent
            ? 'border-amber-400/70 bg-amber-400/15 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.15)]'
            : 'border-purple-400/70 bg-purple-500/20 text-purple-200 shadow-[0_0_12px_rgba(139,92,246,0.2)]'
          : 'border-surface5 bg-surface3/60 text-icon3 hover:text-icon5',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  );
}

export function KnowledgeGraph(props: KnowledgeGraphProps) {
  return (
    <ReactFlowProvider>
      <KnowledgeGraphInner {...props} />
    </ReactFlowProvider>
  );
}

function KnowledgeGraphInner({
  payload,
  arrivals,
  focusedId: controlledFocusId,
  onFocusChange,
  onNodeClick,
  onEdgeClick,
}: KnowledgeGraphProps) {
  const [filters, setFilters] = useState<KnowledgeGraphFilters>(NO_FILTERS);
  const [hover, setHover] = useState<HoverCard | null>(null);
  /**
   * Ego focus (Amendment A5): show only the clicked node and its neighbors.
   * Controlled by the page when `focusedId` is passed (A7 — flyout wikilink
   * hops focus the graph); falls back to internal state otherwise.
   */
  const [internalFocusId, setInternalFocusId] = useState<string | null>(null);
  const focusedId = controlledFocusId !== undefined ? controlledFocusId : internalFocusId;
  const setFocusedId = useCallback(
    (id: string | null) => {
      setInternalFocusId(id);
      onFocusChange?.(id);
    },
    [onFocusChange],
  );
  // User-dragged positions survive re-layouts (the drag re-pins the node).
  const pinnedPositions = useRef(new Map<string, { x: number; y: number }>());
  // Last settled CENTERS: warm-start for re-layouts so live arrivals don't
  // jolt the whole graph, and the spawn anchor for new nodes.
  const lastCenters = useRef(new Map<string, { x: number; y: number }>());
  const [dragVersion, setDragVersion] = useState(0);
  const reactFlow = useReactFlow();

  // Amendment A6: selecting a node glides the camera to its cluster (the ego
  // view IS the cluster, so fitting the visible set centers the clicked
  // entity); clearing focus fits back to the full graph.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void reactFlow.fitView({ padding: focusedId ? 0.3 : 0.1, duration: 500 });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusedId, reactFlow]);

  const { nodes, edges } = useMemo(() => {
    // A11: memories are the connection source of truth when the payload
    // carries them; logical owner→target pairs drive filters/ego/sizing.
    const memories = payload.memories ?? [];
    const pairEdges = memories.length > 0 ? memoryPairEdges(memories) : payload.edges;
    let filtered = filterGraph(payload.nodes, pairEdges, filters);
    if (focusedId) {
      const focused = egoGraph(filtered.nodes, filtered.edges, focusedId);
      // A stale focus id (filtered away or gone from the payload) falls back
      // to the full view rather than an empty canvas.
      if (focused.nodes.some(node => node.id === focusedId)) filtered = focused;
    }
    const { memoryNodes, memoryEdges } = deriveMemoryElements(filtered.nodes, memories);
    const mapped = toFlowGraph(filtered.nodes, filtered.edges, undefined, focusedId);
    const neighborOf = (id: string): { x: number; y: number } | undefined => {
      for (const edge of filtered.edges) {
        const other = edge.source === id ? edge.target : edge.target === id ? edge.source : null;
        if (other) {
          const center = lastCenters.current.get(other);
          if (center) return { x: center.x + 40, y: center.y + 40 };
        }
      }
      return undefined;
    };
    const positions = runLayout(
      [
        ...mapped.nodes.map(node => ({
          id: node.id,
          size: node.data.size,
          fixed: pinnedPositions.current.get(node.id),
          // Warm start: existing nodes keep their settled spot; a brand-new
          // node spawns near its first neighbor instead of at the spiral seed.
          initial:
            lastCenters.current.get(node.id) ?? (arrivals?.nodes.has(node.id) ? neighborOf(node.id) : undefined),
        })),
        // Memory markers: tiny padding so they nestle into their cluster,
        // spawned beside their first entity so they never fly in from origin.
        ...memoryNodes.map(marker => {
          const anchor = lastCenters.current.get(marker.memory.entityIds[0] ?? '');
          return {
            id: marker.id,
            size: marker.size,
            padding: 6,
            fixed: pinnedPositions.current.get(marker.id),
            initial:
              lastCenters.current.get(marker.id) ?? (anchor ? { x: anchor.x + 30, y: anchor.y + 30 } : undefined),
          };
        }),
      ],
      memories.length > 0
        ? memoryEdges.map(edge => ({
            source: edge.source,
            target: edge.target,
            // Stubs/spokes hug; entity↔entity memory lines keep normal length.
            hug: edge.source.startsWith('mem:') || edge.target.startsWith('mem:'),
          }))
        : filtered.edges,
    );
    lastCenters.current = positions;
    const entityFlow = toFlowGraph(filtered.nodes, filtered.edges, positions, focusedId);
    if (memories.length === 0) return entityFlow; // pre-A11 payload fallback
    const memoryFlow = toMemoryFlow(memoryNodes, memoryEdges, positions);
    return { nodes: [...entityFlow.nodes, ...memoryFlow.nodes], edges: memoryFlow.edges };
    // dragVersion re-runs the layout after a drag pin.
  }, [payload, filters, focusedId, dragVersion, arrivals]);

  // Arrival animation: newly-polled nodes/edges fade-scale in with a pulse.
  const displayNodes = useMemo(
    () =>
      arrivals && arrivals.nodes.size > 0
        ? nodes.map(node => (arrivals.nodes.has(node.id) ? { ...node, className: 'knowledge-arrive' } : node))
        : nodes,
    [nodes, arrivals],
  );
  const displayEdges = useMemo(
    () =>
      arrivals && arrivals.edges.size > 0
        ? edges.map(edge => (arrivals.edges.has(edge.id) ? { ...edge, className: 'knowledge-arrive' } : edge))
        : edges,
    [edges, arrivals],
  );

  const toggleRung = useCallback((rung: KnowledgeRung) => {
    setFilters(current => {
      const rungs = new Set(current.rungs);
      if (rungs.has(rung)) rungs.delete(rung);
      else rungs.add(rung);
      return { ...current, rungs };
    });
  }, []);

  const availableRungs = useMemo(() => {
    const present = new Set<KnowledgeRung>();
    for (const node of payload.nodes) present.add(node.rung);
    return (['org', 'resource', 'thread'] as const).filter(rung => present.has(rung));
  }, [payload.nodes]);

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-xl border border-surface5"
      style={{ background: '#0b0b12' }}
      data-testid="knowledge-graph"
    >
      <style>{`
        @keyframes knowledgeArrive {
          0% { opacity: 0; transform: scale(0.4); }
          60% { opacity: 1; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
        .knowledge-arrive [data-testid='knowledge-node'] {
          animation: knowledgeArrive 0.9s ease-out;
          box-shadow: 0 0 32px rgba(167, 139, 250, 0.7) !important;
        }
        .react-flow__edge.knowledge-arrive path {
          animation: knowledgeArrive 0.9s ease-out;
          stroke: rgba(196, 181, 253, 0.9) !important;
        }
      `}</style>
      <TruncationBanner payload={payload} />
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        {availableRungs.map(rung => (
          <FilterChip
            key={rung}
            label={RUNG_LABELS[rung]}
            icon={rung === 'org' ? <Globe size={13} /> : <Boxes size={13} />}
            active={filters.rungs.size === 0 || filters.rungs.has(rung)}
            onClick={() => toggleRung(rung)}
          />
        ))}
        <FilterChip
          label="Pinned"
          accent
          icon={<Pin size={13} />}
          active={filters.pinnedOnly}
          onClick={() => setFilters(current => ({ ...current, pinnedOnly: !current.pinnedOnly }))}
        />
      </div>

      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.1}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        onNodeClick={(_, node) => {
          // A11: a memory marker click IS a memory click — same behavior as
          // clicking its edge (dot and stub are one unit).
          if (node.type === 'knowledgeMemory') {
            const memory = (node as MemoryFlowNode).data.memory;
            const [first = '', second] = memory.entityIds;
            onEdgeClick?.({ source: first, target: second ?? first, factId: memory.id });
            return;
          }
          setFocusedId(node.id);
          onNodeClick?.((node as EntityFlowNode).data.entity);
        }}
        onPaneClick={() => setFocusedId(null)}
        onEdgeClick={(_, edge) => {
          const flowEdge = edge as KnowledgeFlowEdge;
          onEdgeClick?.({ source: flowEdge.source, target: flowEdge.target, factId: flowEdge.data?.factId ?? '' });
        }}
        onNodeMouseEnter={(event, node) =>
          node.type === 'knowledgeMemory'
            ? setHover({ kind: 'memory', x: event.clientX, y: event.clientY, memory: node as MemoryFlowNode })
            : setHover({ kind: 'node', x: event.clientX, y: event.clientY, node: node as EntityFlowNode })
        }
        onNodeMouseLeave={() => setHover(null)}
        onEdgeMouseEnter={(event, edge) =>
          setHover({ kind: 'edge', x: event.clientX, y: event.clientY, edge: edge as KnowledgeFlowEdge })
        }
        onEdgeMouseLeave={() => setHover(null)}
        onNodeDragStop={(_, node) => {
          // The layout pins CENTERS; node.position is the top-left corner.
          const size = (node as EntityFlowNode).data.size;
          pinnedPositions.current.set(node.id, { x: node.position.x + size / 2, y: node.position.y + size / 2 });
          setDragVersion(version => version + 1);
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.4} color="#26263a" />
        <MiniMap
          position="bottom-left"
          pannable
          zoomable
          style={{ background: '#111119', border: '1px solid #26263a', borderRadius: 8 }}
          nodeColor="#8b5cf6"
          nodeStrokeColor="#a78bfa"
          nodeStrokeWidth={3}
          nodeBorderRadius={999}
          maskColor="rgba(10,10,18,0.55)"
        />
        <Controls position="bottom-right" showInteractive={false} />
      </ReactFlow>

      {hover ? (
        <GraphHoverCard
          hover={hover}
          nodesById={
            new Map(
              nodes.flatMap(node => (node.type === 'knowledgeEntity' ? [[node.id, node as EntityFlowNode]] : [])),
            )
          }
        />
      ) : null}
    </div>
  );
}

function GraphHoverCard({ hover, nodesById }: { hover: HoverCard; nodesById: Map<string, EntityFlowNode> }) {
  const style = { left: hover.x + 14, top: hover.y + 14 } as const;
  if (hover.kind === 'node' && hover.node) {
    const { entity, degree } = hover.node.data;
    return (
      <div
        data-testid="knowledge-hover-card"
        className="pointer-events-none fixed z-50 min-w-48 rounded-lg border border-surface5 bg-surface3 p-3 text-xs shadow-xl"
        style={style}
      >
        <div className="mb-1 flex items-center gap-1.5">
          <span className="font-semibold text-icon6">{entity.name}</span>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-icon4">
          <dt>Kind</dt>
          <dd>{entity.kind}</dd>
          <dt>Scope</dt>
          <dd>{RUNG_LABELS[entity.rung]}</dd>
          <dt>Facts</dt>
          <dd>{entity.factCount}</dd>
          <dt>Links</dt>
          <dd>
            {degree.incoming} in · {degree.outgoing} out
          </dd>
          <dt>Updated</dt>
          <dd>{new Date(entity.updatedAt).toLocaleString()}</dd>
        </dl>
      </div>
    );
  }
  if (hover.kind === 'memory' && hover.memory) {
    const { memory } = hover.memory.data;
    return (
      <div
        data-testid="knowledge-hover-card"
        className="pointer-events-none fixed z-50 max-w-72 rounded-lg border border-surface5 bg-surface3 p-3 text-xs shadow-xl"
        style={style}
      >
        <div className="mb-1 flex items-center gap-1.5 text-icon6">
          Memory
          {memory.pinned ? <Pin size={11} className="text-amber-400" aria-label="Pinned" /> : null}
        </div>
        <div className="leading-relaxed text-icon4">{memory.text}</div>
      </div>
    );
  }
  if (hover.kind === 'edge' && hover.edge) {
    const resolve = (id: string) => nodesById.get(id)?.data.entity.name;
    const source = resolve(hover.edge.source);
    const target = resolve(hover.edge.target);
    return (
      <div
        data-testid="knowledge-hover-card"
        className="pointer-events-none fixed z-50 max-w-72 rounded-lg border border-surface5 bg-surface3 p-3 text-xs shadow-xl"
        style={style}
      >
        <div className="text-icon6">{source && target ? `${source} → ${target}` : 'Memory'}</div>
        <div className="mt-0.5 leading-relaxed text-icon4">{hover.edge.data?.text ?? 'Mentioned in a memory'}</div>
      </div>
    );
  }
  return null;
}
