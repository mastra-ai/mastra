/**
 * The force-directed knowledge graph: React Flow renders DOM nodes/edges while
 * d3-force computes positions (synchronously, deterministic). Knowledge nodes are
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
  EdgeLabelRenderer,
} from '@xyflow/react';
import type { EdgeProps, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Boxes, Globe, Pin } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { KnowledgeGraphNode, KnowledgeGraphPayload, KnowledgeRung } from '../../services/knowledge';
import type { NodeFlowNode, KnowledgeFlowEdge, KnowledgeGraphFilters, RecordFlowNode } from './graphModel';
import {
  deriveRecordElements,
  egoGraph,
  filterGraph,
  recordPairEdges,
  NO_FILTERS,
  shouldShowLabel,
  toFlowGraph,
  toRecordFlow,
} from './graphModel';
import type { Arrivals } from './graphDiff';
import { runLayout } from './layout';

const RUNG_LABELS: Record<KnowledgeRung, string> = { org: 'Org', resource: 'Project', thread: 'Session' };

const RUNG_RING: Record<KnowledgeRung, string> = {
  org: 'border-purple-300/70',
  resource: 'border-purple-500/60',
  thread: 'border-cyan-400/60',
};

function NodeNodeComponent({ data, selected }: NodeProps<NodeFlowNode>) {
  const { node, size, degree, focused } = data;
  const labeled = focused || shouldShowLabel(degree);
  const large = size >= 88;
  const nameSize = Math.max(10, Math.min(16, Math.round(size / 9)));
  const glow = Math.round(10 + size / 5);
  return (
    // Outer wrapper is unclipped so the pin badge can straddle the rim;
    // only the inner circle clips (it must, to keep the label inside).
    <div data-testid="knowledge-node" data-node-id={node.id} className="relative" style={{ width: size, height: size }}>
      {/* A11: nodes never carry pin visuals — pins belong to their record
          markers (dot / line / junction). */}
      <div
        className={[
          'flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-full border-2 text-center transition-shadow duration-200',
          RUNG_RING[node.rung],
          selected ? 'ring-2 ring-purple-300' : '',
        ].join(' ')}
        style={{
          background: 'radial-gradient(circle at 50% 32%, rgba(124,92,255,0.22), rgba(13,13,22,0.97) 72%)',
          boxShadow: `0 0 ${glow}px rgba(139,92,246,0.35)`,
        }}
      >
        {labeled ? (
          <span
            className="text-icon6 pointer-events-none line-clamp-3 max-w-[78%] leading-tight font-medium break-words"
            style={{ fontSize: nameSize }}
            title={node.name}
          >
            {node.name}
          </span>
        ) : null}
        {labeled && large ? (
          <span className="mt-0.5 text-[9px] font-medium tracking-widest text-purple-300/70 uppercase">
            {node.kind.slice(0, 12)}
          </span>
        ) : null}
      </div>
      <Handle type="target" position={Position.Top} className="!invisible" />
      <Handle type="source" position={Position.Bottom} className="!invisible" />
    </div>
  );
}
const NodeNode = memo(NodeNodeComponent);

function KnowledgeLinkComponent({ id, source, target, data }: EdgeProps<KnowledgeFlowEdge>) {
  // Floating edge: anchor both ends on the circle rims along the angle between
  // the node centers, rather than at fixed handles.
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;
  const sourceSize = (sourceNode.data as NodeFlowNode['data']).size;
  const targetSize = (targetNode.data as NodeFlowNode['data']).size;
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
          // A9: a pinned record marks the RELATIONSHIP — the amber accent
          // rides the edge, with a pin chip at the arc's midpoint. Edges
          // touching a knowledge record marker are white, echoing the Mastra logo.
          // A selected record (open in the flyout) lights its edge up.
          data?.focused
            ? {
                stroke: pinned ? 'rgba(251,191,36,1)' : 'rgba(255,255,255,0.95)',
                strokeWidth: 2.5,
                filter: `drop-shadow(0 0 4px ${pinned ? 'rgba(251,191,36,0.8)' : 'rgba(255,255,255,0.7)'})`,
              }
            : pinned
              ? { stroke: 'rgba(251,191,36,0.75)', strokeWidth: 2 }
              : source.startsWith('record:') || target.startsWith('record:')
                ? { stroke: 'rgba(255,255,255,0.45)', strokeWidth: 1.2 }
                : { stroke: 'rgba(139,92,246,0.4)', strokeWidth: 1.4 }
        }
      />
      {pinned && !source.startsWith('record:') && !target.startsWith('record:') ? (
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
 * A11: a knowledge record rendered as its own tiny marker — a dot beside its node or
 * a junction where a multi-node record splits. Pinned records render as
 * the amber pin chip itself (the marker being a layout node is what keeps
 * the chip collision-clear of nodes).
 */
function RecordNodeComponent({ data }: NodeProps<RecordFlowNode>) {
  const { record, size, focused } = data;
  return (
    <div
      data-testid="knowledge-record-node"
      data-record-id={record.id}
      data-focused={focused || undefined}
      className={[
        'flex items-center justify-center rounded-full border transition-shadow',
        // White markers mimic the Mastra logo's nodes-and-edges M — records
        // read as knowledge points, distinct from nodes (purple) and pins
        // (amber).
        record.pinned
          ? 'border-amber-300/80 bg-amber-400 text-[#1a1305] shadow-md shadow-amber-500/40'
          : 'border-white/70 bg-white/90 shadow-[0_0_6px_rgba(255,255,255,0.45)]',
        // The selected record (open in the flyout) glows hard.
        focused
          ? record.pinned
            ? 'ring-2 ring-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.9)]'
            : 'ring-2 ring-white shadow-[0_0_14px_rgba(255,255,255,0.9)]'
          : '',
      ].join(' ')}
      style={{ width: size, height: size }}
    >
      <Handle type="target" position={Position.Top} className="!invisible" />
      <Handle type="source" position={Position.Bottom} className="!invisible" />
      {record.pinned ? <Pin size={11} aria-label="Pinned record" /> : null}
    </div>
  );
}
const RecordNode = memo(RecordNodeComponent);

const nodeTypes = { knowledgeNode: NodeNode, knowledgeRecord: RecordNode };
const edgeTypes = { knowledgeLink: KnowledgeLink };

interface HoverCard {
  kind: 'node' | 'edge' | 'record';
  x: number;
  y: number;
  node?: NodeFlowNode;
  edge?: KnowledgeFlowEdge;
  record?: RecordFlowNode;
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
  /** The record selected in the flyout — its edge and marker light up. */
  focusedRecordId?: string | null;
  onNodeClick?: (node: KnowledgeGraphNode) => void;
  onEdgeClick?: (edge: { source: string; target: string; recordId: string }) => void;
}

function TruncationBanner({ payload }: { payload: KnowledgeGraphPayload }) {
  const parts: string[] = [];
  if (payload.truncated) parts.push(`showing the newest ${payload.nodes.length} nodes`);
  if (payload.outOfWindow.length > 0) parts.push(`${payload.outOfWindow.length} linked nodes outside the window`);
  if (payload.unresolvedCapped.count > 0) parts.push(`${payload.unresolvedCapped.count} links unresolved (capped)`);
  if (parts.length === 0) return null;
  return (
    <div
      data-testid="knowledge-truncation-banner"
      className="border-surface5 bg-surface3/90 text-icon4 pointer-events-none absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-md border px-3 py-1 text-xs"
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
  focusedRecordId,
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
  // Last settled CENTERS of the PROJECT view: warm-start for re-layouts so
  // live arrivals don't jolt the whole graph, the spawn anchor for new nodes,
  // and the layout the graph returns to when focus clears. Ego runs never
  // write here.
  const lastCenters = useRef(new Map<string, { x: number; y: number }>());
  // Ego-view scratch positions. The focused node is forced to max size, so a
  // cluster has to re-settle around it or the growth swallows its neighbours;
  // those positions are meaningless outside the cluster, so they live here and
  // are thrown away whenever focus changes.
  const focusCenters = useRef(new Map<string, { x: number; y: number }>());
  const lastFocusId = useRef<string | null>(null);
  /** Signature of the payload's node + record/edge id sets — detects real data changes. */
  const lastSignature = useRef('');
  const [dragVersion, setDragVersion] = useState(0);
  const reactFlow = useReactFlow();

  // Amendment A6: selecting a node glides the camera to its cluster (the ego
  // view IS the cluster, so fitting the visible set centers the clicked
  // node); clearing focus fits back to the full graph.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void reactFlow.fitView({ padding: focusedId ? 0.3 : 0.1, duration: 500 });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusedId, reactFlow]);

  const { nodes, edges } = useMemo(() => {
    // A11: records are the connection source of truth when the payload
    // carries them; logical owner→target pairs drive filters/ego/sizing.
    const records = payload.records ?? [];
    // Position capture policy: new data re-simulates WARM (nodes start
    // from their settled spots — new inbound edges change node sizes, so the
    // layout must re-settle); unchanged data freezes positions hard so
    // polls, filter toggles, and re-renders never rearrange the graph.
    const signature = [
      payload.nodes
        .map(node => node.id)
        .sort()
        .join(','),
      records.length > 0
        ? records
            .map(record => record.id)
            .sort()
            .join(',')
        : payload.edges
            .map(edge => edge.id)
            .sort()
            .join(','),
    ].join('|');
    const dataChanged = signature !== lastSignature.current;
    lastSignature.current = signature;
    // Entering or switching focus re-simulates the cluster (the focused node
    // grows to max size and needs room). Leaving focus does NOT: the project
    // view restores the positions it was captured at, untouched by any ego run.
    const viewChanged = (focusedId ?? null) !== lastFocusId.current;
    if (viewChanged) focusCenters.current = new Map();
    lastFocusId.current = focusedId ?? null;
    const centers = focusedId ? focusCenters.current : lastCenters.current;
    const resimulate = dataChanged || (viewChanged && focusedId !== undefined && focusedId !== null);
    // Warm start: an ego run begins from wherever the nodes already sit in the
    // project view, so the cluster expands out of its current shape.
    const warmStart = (id: string) => centers.get(id) ?? lastCenters.current.get(id);
    const pairEdges = records.length > 0 ? recordPairEdges(records) : payload.edges;
    let filtered = filterGraph(payload.nodes, pairEdges, filters);
    if (focusedId) {
      const focused = egoGraph(filtered.nodes, filtered.edges, focusedId, records);
      // A stale focus id (filtered away or gone from the payload) falls back
      // to the full view rather than an empty canvas.
      if (focused.nodes.some(node => node.id === focusedId)) filtered = focused;
    }
    const { recordNodes, recordEdges } = deriveRecordElements(filtered.nodes, records);
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
          // Unchanged data → frozen at the settled spot. New data → the
          // settled spot becomes the warm START and the simulation re-settles
          // (brand-new nodes spawn near their first neighbor instead of at
          // the spiral seed). Drag pins always win.
          fixed: pinnedPositions.current.get(node.id) ?? (resimulate ? undefined : centers.get(node.id)),
          initial: warmStart(node.id) ?? (arrivals?.nodes.has(node.id) ? neighborOf(node.id) : undefined),
        })),
        // Record markers: tiny padding so they nestle into their cluster,
        // spawned beside their first node so they never fly in from origin.
        ...recordNodes.map(marker => {
          const anchor = warmStart(marker.record.nodeIds[0] ?? '');
          return {
            id: marker.id,
            size: marker.size,
            padding: 6,
            // Same policy as nodes: frozen on unchanged data, warm-started
            // on new data.
            fixed: pinnedPositions.current.get(marker.id) ?? (resimulate ? undefined : centers.get(marker.id)),
            initial: warmStart(marker.id) ?? (anchor ? { x: anchor.x + 30, y: anchor.y + 30 } : undefined),
          };
        }),
      ],
      records.length > 0
        ? recordEdges.map(edge => ({
            source: edge.source,
            target: edge.target,
            // Stubs/spokes hug; node↔node record lines keep normal length.
            hug: edge.source.startsWith('record:') || edge.target.startsWith('record:'),
          }))
        : filtered.edges,
    );
    // MERGE into the active cache, never replace it: a filter subset run must
    // not wipe the settled positions of currently-hidden nodes, or leaving the
    // filter would rearrange everything again. While focused this writes to the
    // scratch cache, so the project layout survives the visit untouched.
    for (const [id, center] of positions) centers.set(id, center);
    const nodeFlow = toFlowGraph(filtered.nodes, filtered.edges, positions, focusedId);
    if (records.length === 0) return nodeFlow; // pre-A11 payload fallback
    const recordFlow = toRecordFlow(recordNodes, recordEdges, positions);
    return { nodes: [...nodeFlow.nodes, ...recordFlow.nodes], edges: recordFlow.edges };
    // dragVersion re-runs the layout after a drag pin.
  }, [payload, filters, focusedId, dragVersion, arrivals]);

  // Arrival animation: newly-polled nodes/edges fade-scale in with a pulse.
  // Selection: the flyout's open record lights its marker and edge(s) up.
  const displayNodes = useMemo(() => {
    let mapped = nodes;
    if (arrivals && arrivals.nodes.size > 0)
      mapped = mapped.map(node => (arrivals.nodes.has(node.id) ? { ...node, className: 'knowledge-arrive' } : node));
    if (focusedRecordId)
      mapped = mapped.map(node =>
        node.type === 'knowledgeRecord' && (node as RecordFlowNode).data.record.id === focusedRecordId
          ? ({ ...node, data: { ...node.data, focused: true } } as RecordFlowNode)
          : node,
      );
    return mapped;
  }, [nodes, arrivals, focusedRecordId]);
  const displayEdges = useMemo(() => {
    let mapped = edges;
    if (arrivals && arrivals.edges.size > 0)
      mapped = mapped.map(edge => (arrivals.edges.has(edge.id) ? { ...edge, className: 'knowledge-arrive' } : edge));
    if (focusedRecordId)
      mapped = mapped.map(edge =>
        edge.data?.recordId === focusedRecordId ? { ...edge, data: { ...edge.data, focused: true } } : edge,
      );
    return mapped;
  }, [edges, arrivals, focusedRecordId]);

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
      className="border-surface5 relative h-full w-full overflow-hidden rounded-xl border"
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
          // A11: a knowledge record marker click IS a knowledge record click — same behavior as
          // clicking its edge (dot and stub are one unit).
          if (node.type === 'knowledgeRecord') {
            const record = (node as RecordFlowNode).data.record;
            const [first = '', second] = record.nodeIds;
            onEdgeClick?.({ source: first, target: second ?? first, recordId: record.id });
            return;
          }
          setFocusedId(node.id);
          onNodeClick?.((node as NodeFlowNode).data.node);
        }}
        onPaneClick={() => setFocusedId(null)}
        onEdgeClick={(_, edge) => {
          const flowEdge = edge as KnowledgeFlowEdge;
          // Stub/spoke edges have a `record:` marker on one end — the flyout
          // needs the knowledge-node end, never the synthetic record node id.
          const nodeEnd = !flowEdge.source.startsWith('record:')
            ? flowEdge.source
            : !flowEdge.target.startsWith('record:')
              ? flowEdge.target
              : null;
          if (!nodeEnd) return;
          onEdgeClick?.({ source: nodeEnd, target: flowEdge.target, recordId: flowEdge.data?.recordId ?? '' });
        }}
        onNodeMouseEnter={(event, node) =>
          node.type === 'knowledgeRecord'
            ? setHover({ kind: 'record', x: event.clientX, y: event.clientY, record: node as RecordFlowNode })
            : setHover({ kind: 'node', x: event.clientX, y: event.clientY, node: node as NodeFlowNode })
        }
        onNodeMouseLeave={() => setHover(null)}
        onEdgeMouseEnter={(event, edge) =>
          setHover({ kind: 'edge', x: event.clientX, y: event.clientY, edge: edge as KnowledgeFlowEdge })
        }
        onEdgeMouseLeave={() => setHover(null)}
        onNodeDragStop={(_, node) => {
          // The layout pins CENTERS; node.position is the top-left corner.
          const size = (node as NodeFlowNode).data.size;
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
            new Map(nodes.flatMap(node => (node.type === 'knowledgeNode' ? [[node.id, node as NodeFlowNode]] : [])))
          }
        />
      ) : null}
    </div>
  );
}

function GraphHoverCard({ hover, nodesById }: { hover: HoverCard; nodesById: Map<string, NodeFlowNode> }) {
  const style = { left: hover.x + 14, top: hover.y + 14 } as const;
  if (hover.kind === 'node' && hover.node) {
    const { node, degree } = hover.node.data;
    return (
      <div
        data-testid="knowledge-hover-card"
        className="border-surface5 bg-surface3 pointer-events-none fixed z-50 min-w-48 rounded-lg border p-3 text-xs shadow-xl"
        style={style}
      >
        <div className="mb-1 flex items-center gap-1.5">
          <span className="text-icon6 font-semibold">{node.name}</span>
        </div>
        {node.description?.trim() ? (
          <p
            data-testid="knowledge-hover-description"
            className="text-icon5 mb-2 line-clamp-3 max-w-72 leading-relaxed break-words"
          >
            {node.description}
          </p>
        ) : null}
        <dl className="text-icon4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <dt>Kind</dt>
          <dd>{node.kind}</dd>
          <dt>Scope</dt>
          <dd>{RUNG_LABELS[node.rung]}</dd>
          <dt>Knowledge records</dt>
          <dd>{node.recordCount}</dd>
          <dt>Links</dt>
          <dd>
            {degree.incoming} in · {degree.outgoing} out
          </dd>
          <dt>Updated</dt>
          <dd>{new Date(node.updatedAt).toLocaleString()}</dd>
        </dl>
      </div>
    );
  }
  if (hover.kind === 'record' && hover.record) {
    const { record } = hover.record.data;
    return (
      <div
        data-testid="knowledge-hover-card"
        className="border-surface5 bg-surface3 pointer-events-none fixed z-50 max-w-72 rounded-lg border p-3 text-xs shadow-xl"
        style={style}
      >
        <div className="text-icon6 mb-1 flex items-center gap-1.5">
          Record
          {record.pinned ? <Pin size={11} className="text-amber-400" aria-label="Pinned" /> : null}
        </div>
        <div className="text-icon4 leading-relaxed">{record.text}</div>
      </div>
    );
  }
  if (hover.kind === 'edge' && hover.edge) {
    const resolve = (id: string) => nodesById.get(id)?.data.node.name;
    const source = resolve(hover.edge.source);
    const target = resolve(hover.edge.target);
    return (
      <div
        data-testid="knowledge-hover-card"
        className="border-surface5 bg-surface3 pointer-events-none fixed z-50 max-w-72 rounded-lg border p-3 text-xs shadow-xl"
        style={style}
      >
        <div className="text-icon6">{source && target ? `${source} → ${target}` : 'Record'}</div>
        <div className="text-icon4 mt-0.5 leading-relaxed">
          {hover.edge.data?.text ?? 'Mentioned in a knowledge record'}
        </div>
      </div>
    );
  }
  return null;
}
