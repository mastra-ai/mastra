/**
 * The force-directed knowledge graph: React Flow renders DOM nodes/edges while
 * d3-force computes positions (synchronously, deterministic). Entities are
 * nodes sized by edge degree (Amendment A3), wikilink relationships are edges,
 * pinned knowledge carries a distinct accent, and hovering a node or edge
 * shows a summary card. Dragging a node re-pins it (the layout keeps it put).
 */

import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useInternalNode,
  useReactFlow,
} from '@xyflow/react';
import type { EdgeProps, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Boxes, Globe, Pin } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { KnowledgeGraphNode, KnowledgeGraphPayload, KnowledgeRung } from '../../services/knowledge';
import type { EntityFlowNode, KnowledgeFlowEdge, KnowledgeGraphFilters } from './graphModel';
import { egoGraph, filterGraph, NO_FILTERS, shouldShowLabel, toFlowGraph } from './graphModel';
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
      <div
        className={[
          'flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-full border-2 text-center transition-shadow duration-200',
          entity.pinned ? 'border-amber-400/80' : RUNG_RING[entity.rung],
          selected ? 'ring-2 ring-purple-300' : '',
        ].join(' ')}
        style={{
          background: 'radial-gradient(circle at 50% 32%, rgba(124,92,255,0.22), rgba(13,13,22,0.97) 72%)',
          boxShadow: entity.pinned
            ? `0 0 ${glow}px rgba(251,191,36,0.35)`
            : `0 0 ${glow}px rgba(139,92,246,0.35)`,
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
      {entity.pinned ? <PinBadge size={size} /> : null}
    </div>
  );
}
const EntityNode = memo(EntityNodeComponent);

function PinBadge({ size }: { size: number }) {
  // Center the badge ON the rim at the circle's 45° top-left point
  // (0.1464 × size from each edge); the unclipped wrapper lets it overhang.
  const BADGE_HALF = 10;
  const offset = Math.round(size * 0.1464) - BADGE_HALF;
  return (
    <span
      className="absolute z-10 rounded-full bg-amber-400 p-1 text-[#1a1305] shadow-md shadow-amber-500/40"
      style={{ top: offset, left: offset }}
    >
      <Pin size={11} aria-label="Pinned" />
    </span>
  );
}

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
  return (
    <BaseEdge
      id={id}
      path={path}
      style={{
        stroke: 'rgba(139,92,246,0.4)',
        strokeWidth: 1.4,
      }}
    />
  );
}
const KnowledgeLink = memo(KnowledgeLinkComponent);

const nodeTypes = { knowledgeEntity: EntityNode };
const edgeTypes = { knowledgeLink: KnowledgeLink };

interface HoverCard {
  kind: 'node' | 'edge';
  x: number;
  y: number;
  node?: EntityFlowNode;
  edge?: KnowledgeFlowEdge;
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
    let filtered = filterGraph(payload.nodes, payload.edges, filters);
    if (focusedId) {
      const focused = egoGraph(filtered.nodes, filtered.edges, focusedId);
      // A stale focus id (filtered away or gone from the payload) falls back
      // to the full view rather than an empty canvas.
      if (focused.nodes.some(node => node.id === focusedId)) filtered = focused;
    }
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
      mapped.nodes.map(node => ({
        id: node.id,
        size: node.data.size,
        fixed: pinnedPositions.current.get(node.id),
        // Warm start: existing nodes keep their settled spot; a brand-new node
        // spawns near its first neighbor instead of at the spiral seed.
        initial: lastCenters.current.get(node.id) ?? (arrivals?.nodes.has(node.id) ? neighborOf(node.id) : undefined),
      })),
      filtered.edges,
    );
    lastCenters.current = positions;
    return toFlowGraph(filtered.nodes, filtered.edges, positions, focusedId);
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
          setFocusedId(node.id);
          onNodeClick?.((node as EntityFlowNode).data.entity);
        }}
        onPaneClick={() => setFocusedId(null)}
        onEdgeClick={(_, edge) => {
          const flowEdge = edge as KnowledgeFlowEdge;
          onEdgeClick?.({ source: flowEdge.source, target: flowEdge.target, factId: flowEdge.data?.factId ?? '' });
        }}
        onNodeMouseEnter={(event, node) =>
          setHover({ kind: 'node', x: event.clientX, y: event.clientY, node: node as EntityFlowNode })
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

      {hover ? <GraphHoverCard hover={hover} nodesById={new Map(nodes.map(node => [node.id, node]))} /> : null}
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
          {entity.pinned ? <Pin size={11} className="text-amber-400" aria-label="Pinned" /> : null}
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
  if (hover.kind === 'edge' && hover.edge) {
    const source = nodesById.get(hover.edge.source)?.data.entity.name ?? hover.edge.source;
    const target = nodesById.get(hover.edge.target)?.data.entity.name ?? hover.edge.target;
    return (
      <div
        data-testid="knowledge-hover-card"
        className="pointer-events-none fixed z-50 rounded-lg border border-surface5 bg-surface3 p-3 text-xs shadow-xl"
        style={style}
      >
        <div className="text-icon6">
          {source} → {target}
        </div>
        <div className="mt-0.5 text-icon4">
          Mentioned in a memory
        </div>
      </div>
    );
  }
  return null;
}
