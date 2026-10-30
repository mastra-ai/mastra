import type { Edge, EdgeProps, NodeProps } from '@xyflow/react';
import {
  Background,
  BaseEdge,
  BackgroundVariant,
  ControlButton,
  Controls,
  getViewportForBounds,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Maximize, Pin } from 'lucide-react';
import { Fragment, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';

import type { PageFlowEdge, PageFlowNode } from '../lib/pageGraph';
import { pageGraphEdges, pageNeighbourIds, toPageFlow } from '../lib/pageGraph';
import { layoutPageGraph } from '../lib/pageLayout';
import type { PageLayout } from '../lib/pageLayout';
import type { KnowledgePageEdge, KnowledgePagePayload } from '../pageTypes';

import { Txt } from '@/ds/components/Txt';

import './knowledge.css';

// knowledge.css draws the border and the selection ring from this colour.
type CircleStyle = CSSProperties & { '--knowledge-color': string };
const SCOPE_STYLE: CircleStyle = {
  '--knowledge-color': 'var(--chart-blue)',
  background: 'color-mix(in oklab, var(--chart-blue) 16%, var(--card))',
};
const PAGE_STYLE: CircleStyle = { '--knowledge-color': 'var(--border-strong)' };

const PARENT_EDGE_STYLE = {
  stroke: 'var(--foreground)',
  strokeOpacity: 0.45,
  strokeDasharray: '4 4',
  strokeWidth: 1.25,
};
const MENTION_EDGE_COLOR = 'var(--chart-blue)';
// An open chevron in the dashed line's muted tone, at the child end: distinct from a mention's filled blue head.
const PARENT_ARROW_COLOR = 'var(--muted-foreground)';
const PARENT_ARROW = { type: MarkerType.Arrow, color: PARENT_ARROW_COLOR, width: 12, height: 12, strokeWidth: 1.5 };

/**
 * The pin badge sits on the circle's rim at its top-right (45°).
 */
function pinBadgeStyle(size: number) {
  const badge = 20;
  const offset = (size / 2) * (1 - Math.SQRT1_2);
  return {
    badge,
    style: { width: badge, height: badge, top: offset, right: offset, transform: 'translate(50%, -50%)' },
  };
}

type PageNodeData = PageFlowNode['data'] & { pinned: boolean; dimmed: boolean };

/** A scope or page: its kind on top, its name below, both inside the circle. */
function PageNodeComponent({ data }: NodeProps<PageFlowNode & { data: PageNodeData }>) {
  const { page, size, selected, pinned, dimmed } = data;
  const kind = page.isScope ? (page.displayLabel ?? 'Scope') : 'Page';
  return (
    <div
      data-testid="knowledge-page-node"
      data-page-id={page.id}
      data-page-type={page.isScope ? 'scope' : 'page'}
      className="relative cursor-pointer transition-opacity"
      style={{ width: size, height: size, opacity: dimmed ? 0.35 : 1 }}
      title={page.isScope && page.address ? `${kind} · ${page.address}` : page.name}
    >
      <div
        className="knowledge-circle flex size-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-full border-2 px-3 text-center shadow-raised"
        data-selected={selected || undefined}
        style={page.isScope ? SCOPE_STYLE : PAGE_STYLE}
      >
        <Txt
          as="span"
          variant="meta"
          tone={page.isScope ? undefined : 'muted'}
          className="pointer-events-none line-clamp-2 max-w-full tracking-wide uppercase"
          style={page.isScope ? { color: 'var(--chart-blue)' } : undefined}
          data-testid={page.isScope ? 'knowledge-scope-caption' : 'knowledge-page-caption'}
        >
          {kind}
        </Txt>
        <Txt as="span" variant="label" tone="ink" className="pointer-events-none line-clamp-3 max-w-full break-words">
          {page.isScope && page.address ? <BreakAtColons text={page.address} /> : page.name}
        </Txt>
      </div>
      {pinned ? <PinBadge size={size} /> : null}
      <Handle type="target" position={Position.Top} className="!invisible" />
      <Handle type="source" position={Position.Bottom} className="!invisible" />
    </div>
  );
}

/** Lets a scope address like `role:acme:admin` wrap after a colon instead of mid-word. */
function BreakAtColons({ text }: { text: string }) {
  const parts = text.split(':');
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {part}
          {index < parts.length - 1 ? (
            <>
              :<wbr />
            </>
          ) : null}
        </Fragment>
      ))}
    </>
  );
}

function PinBadge({ size }: { size: number }) {
  const { badge, style } = pinBadgeStyle(size);
  return (
    <span
      data-testid="knowledge-pin-badge"
      className="absolute flex items-center justify-center rounded-full bg-badge-amber-strong text-badge-amber-foreground shadow-raised"
      style={style}
      aria-label="Pinned"
    >
      <Pin size={Math.round(badge * 0.6)} aria-hidden />
    </span>
  );
}

type RimEdgeData = PageFlowEdge['data'] & { from: Circle; to: Circle; dimmed: boolean };
interface Circle {
  x: number;
  y: number;
  r: number;
}

/** A straight line from one circle's rim to the other's, so lines never loop or hide behind circles. */
function rimToRim(from: Circle, to: Circle, gap = 3) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  return {
    x1: from.x + ux * (from.r + gap),
    y1: from.y + uy * (from.r + gap),
    x2: to.x - ux * (to.r + gap),
    y2: to.y - uy * (to.r + gap),
  };
}

function RimEdgeComponent({ id, data, style, markerEnd }: EdgeProps<Edge<RimEdgeData>>) {
  if (!data) return null;
  const { x1, y1, x2, y2 } = rimToRim(data.from, data.to);
  const mention = data.kind === 'mention';
  return (
    <BaseEdge
      id={id}
      path={`M ${x1} ${y1} L ${x2} ${y2}`}
      style={{ ...style, opacity: data.dimmed ? 0.2 : 1 }}
      markerEnd={markerEnd}
      interactionWidth={mention ? 20 : 0}
    />
  );
}

const edgeTypes = { rim: RimEdgeComponent };

const nodeTypes = { page: memo(PageNodeComponent) };

/** The box around laid-out circles, in graph coordinates; `null` when there are none. */
function graphBounds(nodes: Array<{ position: { x: number; y: number }; width?: number; height?: number }>) {
  if (nodes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + (node.width ?? 0));
    maxY = Math.max(maxY, node.position.y + (node.height ?? 0));
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

const LEGEND_SWATCH = 'knowledge-circle inline-block size-3 shrink-0 rounded-full border-2';

/** What the circles, lines and badge mean. */
function GraphLegend() {
  return (
    <ul
      aria-label="Legend"
      className="pointer-events-none absolute top-2 left-2 z-10 flex flex-col gap-1 rounded-md border border-border bg-card/90 px-2 py-1.5 shadow-raised"
    >
      <li className="flex items-center gap-2">
        <span className={LEGEND_SWATCH} style={{ ...SCOPE_STYLE }} aria-hidden />
        <Txt as="span" variant="meta" tone="muted">
          Scope
        </Txt>
      </li>
      <li className="flex items-center gap-2">
        <span className={LEGEND_SWATCH} style={{ ...PAGE_STYLE }} aria-hidden />
        <Txt as="span" variant="meta" tone="muted">
          Page
        </Txt>
      </li>
      <li className="flex items-center gap-2">
        <svg width="12" height="4" aria-hidden className="shrink-0">
          <line x1="0" y1="2" x2="12" y2="2" stroke={MENTION_EDGE_COLOR} strokeWidth="2" />
        </svg>
        <Txt as="span" variant="meta" tone="muted">
          Mentioned in notes
        </Txt>
      </li>
      <li className="flex items-center gap-2">
        <svg width="16" height="8" aria-hidden className="shrink-0" data-testid="knowledge-legend-parent-arrow">
          <line x1="0" y1="4" x2="14" y2="4" {...PARENT_EDGE_STYLE} strokeDasharray="3 2" />
          <polyline
            points="10,1 14,4 10,7"
            fill="none"
            stroke={PARENT_ARROW_COLOR}
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <Txt as="span" variant="meta" tone="muted">
          Parent → child
        </Txt>
      </li>
      <li className="flex items-center gap-2">
        <span
          className="flex size-3 shrink-0 items-center justify-center rounded-full bg-badge-amber-strong text-badge-amber-foreground"
          aria-hidden
        >
          <Pin size={8} />
        </span>
        <Txt as="span" variant="meta" tone="muted">
          Pinned
        </Txt>
      </li>
    </ul>
  );
}

export interface KnowledgePageGraphProps {
  pages: KnowledgePagePayload[];
  /** Mention edges between pages; parent edges are derived from `pages`. */
  edges: KnowledgePageEdge[];
  pinnedIds?: readonly string[];
  selectedPageId?: string | null;
  /** A page that wasn't selected was clicked, tapped, or activated with Enter or Space: select it. */
  onSelect: (page: KnowledgePagePayload) => void;
  /** The already-selected page was clicked, tapped, or activated again: open it. Without it, that only reselects. */
  onOpen?: (page: KnowledgePagePayload) => void;
  /** A mention line was clicked: notes on `source` mention `target`. `point` is where, in the graph's own box. */
  onMentionSelect?: (mention: {
    source: KnowledgePagePayload;
    target: KnowledgePagePayload;
    point: { x: number; y: number };
    /** The graph's own size, so a popup can open on whichever side of `point` has room. */
    pane: { width: number; height: number };
  }) => void;
}

/**
 * The schema-4 Knowledge page graph: scopes and pages as circles sized by how often they are mentioned,
 * parent links as faint edges and mentions as solid ones. The first layout is deterministic for the same pages; later updates start from where pages already sit.
 */
export function KnowledgePageGraph(props: KnowledgePageGraphProps) {
  return (
    <ReactFlowProvider>
      <KnowledgePageGraphInner {...props} />
    </ReactFlowProvider>
  );
}

function KnowledgePageGraphInner({
  pages,
  edges,
  pinnedIds = [],
  selectedPageId,
  onSelect,
  onOpen,
  onMentionSelect,
}: KnowledgePageGraphProps) {
  const allEdges = useMemo(() => pageGraphEdges(pages, edges), [pages, edges]);
  // The last layout: a refetch or live update starts from it, so placed pages stay put.
  const lastLayout = useRef<PageLayout | undefined>(undefined);
  const laidOut = useMemo(() => {
    const flow = toPageFlow(pages, allEdges);
    const layout = layoutPageGraph(
      lastLayout.current,
      flow.nodes.map(node => ({ id: node.id, size: node.data.size })),
      flow.edges.map(edge => ({ source: edge.source, target: edge.target })),
    );
    lastLayout.current = layout;
    return { nodes: flow.nodes, edges: flow.edges, positions: layout.positions };
  }, [pages, allEdges]);

  const pinned = useMemo(() => new Set(pinnedIds), [pinnedIds]);
  // With a page selected, everything more than one line away fades so its neighbourhood reads at a glance.
  const neighbours = useMemo(
    () => (selectedPageId && laidOut.positions.has(selectedPageId) ? pageNeighbourIds(selectedPageId, allEdges) : null),
    [selectedPageId, laidOut, allEdges],
  );
  // Each circle's size is known from the layout, so hand it to React Flow as the node's fixed size. Left to
  // React Flow's own DOM measurement, a production Studio sometimes never got one and every node stayed
  // `visibility: hidden`.
  const nodes = useMemo(
    () =>
      laidOut.nodes.map(node => {
        const center = laidOut.positions.get(node.id) ?? { x: 0, y: 0 };
        return {
          ...node,
          width: node.data.size,
          height: node.data.size,
          // Declared handles (where the hidden ones sit in PageNodeComponent) let lines draw without React
          // Flow measuring the node in the DOM, for the same reason as the fixed size above.
          handles: [
            { type: 'target' as const, position: Position.Top, x: node.data.size / 2, y: 0, width: 1, height: 1 },
            {
              type: 'source' as const,
              position: Position.Bottom,
              x: node.data.size / 2,
              y: node.data.size,
              width: 1,
              height: 1,
            },
          ],
          position: { x: center.x - node.data.size / 2, y: center.y - node.data.size / 2 },
          data: {
            ...node.data,
            selected: node.id === selectedPageId,
            pinned: pinned.has(node.id),
            dimmed: !!neighbours && !neighbours.has(node.id),
          },
        };
      }),
    [laidOut, selectedPageId, pinned, neighbours],
  );
  const flowEdges = useMemo(() => {
    const sizes = new Map(laidOut.nodes.map(node => [node.id, node.data.size]));
    const circle = (id: string): Circle => {
      const center = laidOut.positions.get(id) ?? { x: 0, y: 0 };
      return { ...center, r: (sizes.get(id) ?? 0) / 2 };
    };
    return laidOut.edges.map((edge): Edge<RimEdgeData> => {
      const mention = edge.data?.kind === 'mention';
      const dimmed = !!neighbours && !(neighbours.has(edge.source) && neighbours.has(edge.target));
      return {
        ...edge,
        type: 'rim',
        data: {
          kind: edge.data?.kind ?? 'parent',
          count: edge.data?.count ?? 1,
          from: circle(edge.source),
          to: circle(edge.target),
          dimmed,
        },
        ...(mention && onMentionSelect ? { className: 'cursor-pointer' } : {}),
        style: mention
          ? { stroke: MENTION_EDGE_COLOR, strokeWidth: Math.min(1.5 + (edge.data?.count ?? 1) * 0.5, 4) }
          : PARENT_EDGE_STYLE,
        markerEnd: mention
          ? { type: MarkerType.ArrowClosed, color: MENTION_EDGE_COLOR, width: 14, height: 14 }
          : PARENT_ARROW,
      };
    });
  }, [laidOut, onMentionSelect, neighbours]);
  const pagesById = useMemo(() => new Map(pages.map(page => [page.id, page])), [pages]);
  const reactFlow = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const hasNodes = nodes.length > 0;

  // The view frames the selected page and its neighbours, or every page when nothing is selected. It is
  // computed from the layout's own positions and sizes rather than React Flow's `fitView`, which only
  // counts nodes it has measured in the DOM: in a production Studio it measured none, so the view never
  // moved. State is read through a ref so a refetch with the same selection never moves the view.
  const fitState = useRef({ nodes, allEdges, selectedPageId, reactFlow });
  fitState.current = { nodes, allEdges, selectedPageId, reactFlow };
  // Set when a fit found the pane 0×0, so the next non-zero size fits even if it matches the last one seen.
  const fitPending = useRef(false);
  const fit = useCallback((focusSelection: boolean, duration?: number) => {
    const container = containerRef.current;
    const width = container?.clientWidth ?? 0;
    const height = container?.clientHeight ?? 0;
    if (width === 0 || height === 0) {
      fitPending.current = true;
      return;
    }
    fitPending.current = false;
    const { nodes: current, allEdges: edgesNow, selectedPageId: selected, reactFlow: flow } = fitState.current;
    const focus = focusSelection && selected ? pageNeighbourIds(selected, edgesNow) : null;
    const targets = focus ? current.filter(node => focus.has(node.id)) : current;
    const bounds = graphBounds(targets);
    if (!bounds) return;
    const viewport = getViewportForBounds(bounds, width, height, 0.1, focus ? 1.5 : 2, focus ? 0.3 : 0.1);
    void flow.setViewport(viewport, duration ? { duration } : undefined);
  }, []);

  // A host that hides the graph behind a Tree/Graph toggle gives it zero size at first, so fit again
  // whenever the container gets a new non-zero size (shown, or the window resized), at most once a frame.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    let last = { width: container.clientWidth, height: container.clientHeight };
    let frame: number | undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const changed = width !== last.width || height !== last.height;
      last = { width, height };
      if ((!changed && !fitPending.current) || width === 0 || height === 0) return;
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = undefined;
        fit(true);
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [hasNodes, fit]);

  // A selection made outside the graph (tree, search, a link) brings that page and its neighbours into
  // view. A click on the graph itself leaves the view where the user put it.
  const selectedHere = useRef<string | null>(null);
  const selectedIsLoaded = !!selectedPageId && pagesById.has(selectedPageId);
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current || !selectedIsLoaded || !selectedPageId) return;
    const fromGraph = selectedHere.current === selectedPageId;
    selectedHere.current = null;
    if (fromGraph) return;
    fit(true, 300);
  }, [selectedPageId, selectedIsLoaded, fit]);

  // First click selects; a click on the page that is already selected opens it. A double-click is the two.
  const activate = (page: KnowledgePagePayload) => {
    if (page.id === selectedPageId && onOpen) return onOpen(page);
    selectedHere.current = page.id;
    onSelect(page);
  };
  // React Flow focuses nodes but only toggles its own selection on Enter or Space; route them like a click.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const id = (event.target as HTMLElement).closest<HTMLElement>('.react-flow__node')?.dataset.id;
    const page = id ? pagesById.get(id) : undefined;
    if (!page) return;
    event.preventDefault();
    activate(page);
  };

  if (!hasNodes) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Txt variant="body" tone="muted">
          No pages yet.
        </Txt>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative size-full" data-testid="knowledge-page-graph" onKeyDown={onKeyDown}>
      <GraphLegend />
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={() => {
          initialized.current = true;
          fit(true);
        }}
        minZoom={0.1}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        nodesDraggable={false}
        onNodeClick={(_: unknown, node: PageFlowNode) => activate(node.data.page)}
        onEdgeClick={(event: React.MouseEvent, edge: Edge<RimEdgeData>) => {
          if (edge.data?.kind !== 'mention' || !onMentionSelect) return;
          const source = pagesById.get(edge.source);
          const target = pagesById.get(edge.target);
          if (!source || !target) return;
          const box = containerRef.current?.getBoundingClientRect();
          onMentionSelect({
            source,
            target,
            point: { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) },
            pane: { width: box?.width ?? 0, height: box?.height ?? 0 },
          });
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.4} color="var(--border-strong)" />
        <Controls showInteractive={false} showFitView={false}>
          <ControlButton onClick={() => fit(false, 300)} title="Fit view" aria-label="Fit view">
            <Maximize aria-hidden />
          </ControlButton>
        </Controls>
      </ReactFlow>
    </div>
  );
}
