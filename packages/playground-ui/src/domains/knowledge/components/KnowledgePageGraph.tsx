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
  useStore,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowUpToLine, Layers, Maximize, Pin } from 'lucide-react';
import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { fitWords } from '../lib/circleText';
import {
  KNOWLEDGE_COUNTED_DOT_SIZE,
  KNOWLEDGE_DOT_HIT_MARGIN,
  KNOWLEDGE_DOT_SIZE,
  READABLE_MIN_ZOOM,
  branchColors,
  graphShape,
  crowdScale,
  isChildPlaceholder,
  isRestCircle,
  isScopeGroup,
  radialLayout,
} from '../lib/graphShape';
import type { GraphLevel, GraphNodeForm } from '../lib/graphShape';
import { runLayout } from '../lib/layout';
import type { PageFlowEdge, PageFlowNode } from '../lib/pageGraph';
import { KNOWLEDGE_PAGE_SIZE, grantGraph, pageGraphEdges, pageNeighbourIds, toPageFlow } from '../lib/pageGraph';
import { childCountLabel } from '../lib/pageTree';
import { chooseTooltipSide } from '../lib/tooltipSide';
import type { Box, TooltipPlacementInput, TooltipSide } from '../lib/tooltipSide';
import { prefersMotion, useLeavingNodes } from '../lib/useLeavingNodes';
import type { KnowledgePageEdge, KnowledgePagePayload, KnowledgeScopeGrantPayload } from '../pageTypes';

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
// The line from the focused page's parent: solid cyan with a closed head, apart from every child's dashed grey one.
const UP_EDGE_COLOR = 'var(--chart-cyan)';
const UP_EDGE_STYLE = { stroke: UP_EDGE_COLOR, strokeWidth: 2.25 };
const UP_ARROW = { type: MarkerType.ArrowClosed, color: UP_EDGE_COLOR, width: 14, height: 14 };
const MENTION_EDGE_COLOR = 'var(--chart-blue)';
// An open chevron in the dashed line's muted tone, at the child end: distinct from a mention's filled blue head.
const PARENT_ARROW_COLOR = 'var(--muted-foreground)';
const PARENT_ARROW = { type: MarkerType.Arrow, color: PARENT_ARROW_COLOR, width: 12, height: 12, strokeWidth: 1.5 };
// Grants: purple dash-dot from the principal scope to the scope it reaches, so neither colour nor pattern
// alone tells it apart from a parent or mention line.
const GRANT_EDGE_COLOR = 'var(--chart-purple)';
const GRANT_EDGE_STYLE = { stroke: GRANT_EDGE_COLOR, strokeWidth: 1.75, strokeDasharray: '8 3 2 3' };
const GRANT_ARROW = { type: MarkerType.ArrowClosed, color: GRANT_EDGE_COLOR, width: 13, height: 13 };
// A declared principal with no scope page yet: same size as a scope, dashed outline, nothing to open.
// Body links: a thin green line with a filled head, so a link written in a page reads apart from a note's
// mention (blue, weighted by count) and from the dashed parent line.
const LINK_EDGE_COLOR = 'var(--chart-green)';
const LINK_EDGE_STYLE = { stroke: LINK_EDGE_COLOR, strokeWidth: 1.25 };
const LINK_ARROW = { type: MarkerType.ArrowClosed, color: LINK_EDGE_COLOR, width: 12, height: 12 };
// Links of the selected page, by direction: green out of it, orange and dashed into it.
const DIRECTION_EDGE_STYLE = {
  out: { stroke: LINK_EDGE_COLOR },
  in: { stroke: 'var(--chart-orange)', strokeDasharray: '6 3' },
} as const;
const DIRECTION_ARROW = {
  out: LINK_ARROW,
  in: { type: MarkerType.ArrowClosed, color: 'var(--chart-orange)', width: 12, height: 12 },
};
// A parent line out to a dot: thin and faint, with no head, so rings of dots don't turn into a thicket.
const DOT_PARENT_EDGE_STYLE = { stroke: 'var(--foreground)', strokeOpacity: 0.2, strokeWidth: 1 };
const PLACEHOLDER_STYLE = {
  background: 'var(--card)',
  borderColor: 'var(--chart-purple)',
  borderStyle: 'dashed',
};

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

type PageNodeData = PageFlowNode['data'] & {
  pinned: boolean;
  form: GraphNodeForm;
  /** A dot's colour: its branch around the focus. */
  color?: string;
  /** Child count on a page whose children aren't drawn yet, e.g. `281` or `1000+`. */
  badge?: string;
  /** Where the page sits, from its root scope down, for a dot's tooltip. */
  path: string;
  /** Links into and out of the page that aren't drawn. */
  hiddenLinks?: { in: number; out: number };
  /** Where a page is addressed, e.g. `org:acme#policies/refunds`, for a dot's tooltip. */
  ref?: string;
  /** All links into and out of the page, drawn or not, for a dot's tooltip. */
  links?: { in: number; out: number };
  /** Write the dot's links in and out inside it. */
  showCount?: boolean;
  /** A scope or an ancestor of the focus: a circle that says it sits above other pages. */
  level?: GraphLevel;
  /** The focused page's parent: its circle says so. */
  isParent?: boolean;
};

/** `4 links in, 14 links out`: what the arrows in a link badge say, for its label and a dot's tooltip. */
function linkCountsText(links: { in: number; out: number }): string {
  const noun = (count: number) => (count === 1 ? 'link' : 'links');
  return `${links.in} ${noun(links.in)} in, ${links.out} ${noun(links.out)} out`;
}

/** How long a focus change loads before the graph says so. */
const LOADING_HINT_DELAY_MS = 150;
/** How long it holds the old layout for pages that never arrive before drawing what it has. */
const LOADING_RELEASE_MS = 4000;

/** Most a tooltip is enlarged to offset a zoomed-out graph. */
const TOOLTIP_MAX_SCALE = 3;

/** Screen-space box of an element. */
function boxOf(el: Element): Box {
  const { left, top, right, bottom } = el.getBoundingClientRect();
  return { left, top, right, bottom };
}

/** The highlighted lines of the graph as screen-space segments, where the browser can measure them. */
function drawnLines(root: Element): TooltipPlacementInput['lines'] {
  const lines: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> = [];
  for (const path of root.querySelectorAll<SVGPathElement>('.react-flow__edge-path')) {
    if (typeof path.getTotalLength !== 'function' || typeof path.getScreenCTM !== 'function') continue;
    const matrix = path.getScreenCTM();
    if (!matrix) continue;
    const length = path.getTotalLength();
    const start = path.getPointAtLength(0);
    const end = path.getPointAtLength(length);
    lines.push({
      from: {
        x: matrix.a * start.x + matrix.c * start.y + matrix.e,
        y: matrix.b * start.x + matrix.d * start.y + matrix.f,
      },
      to: { x: matrix.a * end.x + matrix.c * end.y + matrix.e, y: matrix.b * end.x + matrix.d * end.y + matrix.f },
    });
  }
  return lines;
}

/** Where a tooltip sits against its dot, and which way it grows from it. */
const TOOLTIP_PLACEMENT: Record<TooltipSide, { tip: string; transform: string; origin: string; tail: string }> = {
  top: {
    tip: 'bottom-full left-1/2 mb-2',
    transform: 'translateX(-50%)',
    origin: 'bottom center',
    tail: 'top-full left-1/2 -translate-x-1/2 -translate-y-1/2 border-r border-b',
  },
  bottom: {
    tip: 'top-full left-1/2 mt-2',
    transform: 'translateX(-50%)',
    origin: 'top center',
    tail: 'bottom-full left-1/2 -translate-x-1/2 translate-y-1/2 border-l border-t',
  },
  right: {
    tip: 'left-full top-1/2 ml-2',
    transform: 'translateY(-50%)',
    origin: 'center left',
    tail: 'right-full top-1/2 translate-x-1/2 -translate-y-1/2 border-l border-b',
  },
  left: {
    tip: 'right-full top-1/2 mr-2',
    transform: 'translateY(-50%)',
    origin: 'center right',
    tail: 'left-full top-1/2 -translate-x-1/2 -translate-y-1/2 border-r border-t',
  },
};

/** The mark on a circle for a page that sits above others: layers for a scope, an up arrow for an ancestor page. */
function LevelIcon({ level }: { level: GraphLevel }) {
  const Icon = level === 'scope' ? Layers : ArrowUpToLine;
  return (
    <Icon
      aria-hidden
      data-testid={`knowledge-level-icon-${level}`}
      className="mr-1 inline-block size-3 align-text-bottom"
    />
  );
}

/** A page far from the focus: a small coloured dot that names itself on hover. */
function DotNode({ data }: { data: PageNodeData }) {
  const { page, size, color, path, ref, links } = data;
  const [hover, setHover] = useState(false);
  const dotRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState<TooltipSide>('top');
  // The graph is often zoomed far out; the tooltip is scaled back up so it stays as readable as the page.
  const zoom = useStore(state => state.transform[2]);
  const tipScale = Math.min(Math.max(1 / zoom, 1), TOOLTIP_MAX_SCALE);
  const standIn = isChildPlaceholder(page);
  const group = isScopeGroup(page);
  // A group's count is already in its name; what it needs to say is how to see its members.
  const hint = standIn ? 'Hover or click to load them' : group ? 'Click to show them' : null;
  const children =
    !hint && page.childCount ? `${childCountLabel(page)} ${page.childCount === 1 ? 'child' : 'children'}` : null;
  const kind = page.isScope ? (page.displayLabel ?? 'Scope') : 'Page';
  const linkText = links && (links.in > 0 || links.out > 0) ? linkCountsText(links) : null;
  const label = [page.name, hint ?? path, children, linkText].filter(Boolean).join(' · ');
  // Pick the side that covers the least: not another page or dot, not the highlighted lines, not the legend or Back.
  useLayoutEffect(() => {
    const dot = dotRef.current;
    const tip = tipRef.current;
    const graph = dot?.closest('.knowledge-graph');
    if (!hover || !dot || !tip || !graph) return;
    const dotBox = boxOf(dot);
    const tipBox = boxOf(tip);
    const scaledWidth = tip.offsetWidth * tipScale;
    const scaledHeight = tip.offsetHeight * tipScale;
    if (!scaledWidth || !scaledHeight) return;
    const obstacles = [
      ...graph.querySelectorAll('[data-testid="knowledge-page-node"], [data-testid="knowledge-page-dot"]'),
      ...(graph.parentElement ?? graph).querySelectorAll(
        '[aria-label="Legend"], [data-testid="knowledge-graph-back"], .react-flow__controls',
      ),
    ]
      .map(boxOf)
      .filter(
        box =>
          box.right > box.left &&
          !(box.left === tipBox.left && box.top === tipBox.top) &&
          !(box.left === dotBox.left && box.top === dotBox.top),
      );
    setSide(
      chooseTooltipSide({
        dot: dotBox,
        tip: { width: scaledWidth, height: scaledHeight },
        gap: 8,
        bounds: boxOf(graph),
        obstacles,
        lines: drawnLines(graph),
      }),
    );
  }, [hover, tipScale]);
  const placement = TOOLTIP_PLACEMENT[side];
  return (
    <div
      ref={dotRef}
      data-testid="knowledge-page-dot"
      data-page-id={page.id}
      data-page-type={standIn ? 'stand-in' : group ? 'group' : page.isScope ? 'scope' : 'page'}
      aria-label={label}
      className="relative cursor-pointer transition-opacity"
      style={{ width: size, height: size, opacity: standIn ? 0.5 : undefined }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      {/* A larger target than the dot itself, so a small dot is easy to hit; it is part of the dot, so hover and click land here too. */}
      <span
        aria-hidden
        data-testid="knowledge-dot-hit-area"
        className="absolute rounded-full"
        style={{ inset: -KNOWLEDGE_DOT_HIT_MARGIN }}
      />
      <div
        className="size-full rounded-full border"
        style={{
          background: standIn ? 'transparent' : (color ?? 'var(--muted-foreground)'),
          borderColor: color ?? 'var(--muted-foreground)',
          borderStyle: standIn ? 'dashed' : 'solid',
        }}
      >
        {data.showCount && !standIn && !group && links && links.in + links.out > 0 ? (
          <Txt
            as="span"
            variant="meta"
            data-testid="knowledge-dot-count"
            className="flex size-full items-center justify-center"
            style={{ color: 'var(--background)' }}
          >
            {links.in + links.out}
          </Txt>
        ) : null}
      </div>
      {hover ? (
        <div
          role="tooltip"
          ref={tipRef}
          data-side={side}
          className={`pointer-events-none absolute ${placement.tip} flex w-max max-w-72 flex-col rounded-md border border-border bg-card px-2 py-1 shadow-overlay`}
          style={{ transform: `${placement.transform} scale(${tipScale})`, transformOrigin: placement.origin }}
        >
          <span
            data-testid="knowledge-tooltip-tail"
            aria-hidden
            className={`absolute size-2 rotate-45 border-border bg-card ${placement.tail}`}
          />
          <Txt as="span" variant="label" tone="ink">
            {page.name}
          </Txt>
          {hint ? (
            <Txt as="span" variant="meta" tone="muted">
              {group ? `${path} · ${hint}` : hint}
            </Txt>
          ) : (
            <>
              <Txt as="span" variant="meta" tone="muted">
                {ref ? `${kind} · ${ref}` : kind}
              </Txt>
              {path ? (
                <Txt as="span" variant="meta" tone="muted">
                  {path}
                </Txt>
              ) : null}
              {children ? (
                <Txt as="span" variant="meta" tone="muted">
                  {children}
                </Txt>
              ) : null}
              {linkText ? (
                <Txt as="span" variant="meta" tone="muted">
                  {linkText}
                </Txt>
              ) : null}
            </>
          )}
        </div>
      ) : null}
      <Handle type="target" position={Position.Top} className="!invisible" />
      <Handle type="source" position={Position.Bottom} className="!invisible" />
    </div>
  );
}

/** Below this a circle uses the small type and two lines of name. */
const COMPACT_CIRCLE_SIZE = 96;
/** The share of a circle's width its text may use; a circle is narrower toward the top and bottom. */
const CIRCLE_TEXT_SHARE = 0.74;

/** A scope or page: its kind on top, its name below, both inside the circle; far pages draw as dots. */
function PageNodeComponent({ data }: NodeProps<PageFlowNode & { data: PageNodeData }>) {
  if (data.form === 'dot') return <DotNode data={data} />;
  const { page, size, selected, pinned, badge } = data;
  const group = isScopeGroup(page);
  const kind = page.isScope ? (page.displayLabel ?? 'Scope') : 'Page';
  const placeholder = isPlaceholder(page);
  const rest = isRestCircle(page);
  // A smaller circle gets smaller type and fewer lines, and the text keeps to the width of the circle's middle.
  const compact = size < COMPACT_CIRCLE_SIZE;
  const fit = Math.max(4, Math.floor((size * CIRCLE_TEXT_SHARE) / (compact ? 6.5 : 7.5)));
  return (
    <div
      data-testid="knowledge-page-node"
      data-page-id={page.id}
      data-page-type={placeholder ? 'placeholder' : rest ? 'rest' : group ? 'group' : page.isScope ? 'scope' : 'page'}
      className={`relative transition-opacity ${placeholder || rest ? 'cursor-default' : 'cursor-pointer'}`}
      style={{ width: size, height: size }}
      title={
        placeholder
          ? `${kind} · ${page.address} · nothing written to it yet`
          : rest
            ? `${page.name} pages not drawn. Open the tree to see them all.`
            : group
              ? `${page.name}: click to show them`
              : page.isScope && page.address
                ? `${kind} · ${page.address}`
                : page.name
      }
    >
      <div
        className="knowledge-circle flex size-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-full border-2 text-center shadow-raised"
        data-selected={selected || undefined}
        style={{
          ...(placeholder || rest ? PLACEHOLDER_STYLE : page.isScope ? SCOPE_STYLE : PAGE_STYLE),
          paddingInline: size * ((1 - CIRCLE_TEXT_SHARE) / 2),
        }}
      >
        <Txt
          as="span"
          variant="meta"
          tone={page.isScope ? undefined : 'muted'}
          className="pointer-events-none inline-flex max-w-full items-center justify-center gap-1 whitespace-nowrap uppercase"
          style={page.isScope ? { color: 'var(--chart-blue)' } : undefined}
          data-testid={page.isScope ? 'knowledge-scope-caption' : 'knowledge-page-caption'}
        >
          {data.level ? <LevelIcon level={data.level} /> : null}
          <span className="truncate">{rest ? 'More' : data.isParent ? 'Parent' : kind}</span>
        </Txt>
        <Txt
          as="span"
          variant={compact ? 'meta' : 'label'}
          tone="ink"
          className={`pointer-events-none max-w-full overflow-hidden [overflow-wrap:normal] ${compact ? 'line-clamp-2' : 'line-clamp-3'}`}
          data-testid="knowledge-circle-name"
        >
          {page.isScope && page.address && !group ? (
            <BreakAtColons text={fitWords(page.address, fit)} />
          ) : (
            fitWords(page.name, fit)
          )}
        </Txt>
      </div>
      {pinned ? <PinBadge size={size} /> : null}
      {data.hiddenLinks && (data.hiddenLinks.in > 0 || data.hiddenLinks.out > 0) ? (
        <span
          data-testid="knowledge-hidden-links"
          title={linkCountsText(data.hiddenLinks)}
          aria-label={linkCountsText(data.hiddenLinks)}
          className="absolute bottom-full left-1/2 -mb-1 flex -translate-x-1/2 gap-1 rounded-full border border-border bg-card px-1.5 shadow-raised"
        >
          {data.hiddenLinks.in > 0 ? (
            <Txt as="span" variant="meta" style={{ color: 'var(--chart-orange)' }}>
              →{data.hiddenLinks.in}
            </Txt>
          ) : null}
          {data.hiddenLinks.out > 0 ? (
            <Txt as="span" variant="meta" style={{ color: LINK_EDGE_COLOR }}>
              {data.hiddenLinks.out}→
            </Txt>
          ) : null}
        </span>
      ) : null}
      {badge ? (
        <span
          data-testid="knowledge-child-count-badge"
          aria-label={`${badge} children, not all drawn`}
          className="absolute top-full left-1/2 -mt-1 -translate-x-1/2 rounded-full border border-border bg-card px-1.5 shadow-raised"
        >
          <Txt as="span" variant="meta" tone="ink">
            {badge}
          </Txt>
        </span>
      ) : null}
      <Handle type="target" position={Position.Top} className="!invisible" />
      <Handle type="source" position={Position.Bottom} className="!invisible" />
    </div>
  );
}

/** The page's place from its root scope down, through the pages the graph holds. */
function pagePath(page: KnowledgePagePayload, byId: ReadonlyMap<string, KnowledgePagePayload>): string {
  const names: string[] = [];
  const seen = new Set<string>();
  for (let up = page.parentId ? byId.get(page.parentId) : undefined; up && !seen.has(up.id);) {
    seen.add(up.id);
    names.unshift(up.isScope && up.address ? up.address : up.name);
    up = up.parentId ? byId.get(up.parentId) : undefined;
  }
  return names.join(' › ');
}

/** How the page is addressed: its scope's address, then the keys down to it. Scopes are just their address. */
function pageRef(page: KnowledgePagePayload, byId: ReadonlyMap<string, KnowledgePagePayload>): string | undefined {
  if (page.isScope) return page.address;
  const keys: string[] = [];
  const seen = new Set<string>();
  for (
    let at: KnowledgePagePayload | undefined = page;
    at && !seen.has(at.id);
    at = at.parentId ? byId.get(at.parentId) : undefined
  ) {
    seen.add(at.id);
    if (at.isScope) return at.address ? `${at.address}#${keys.reverse().join('/')}` : undefined;
    if (!at.key) return undefined;
    keys.push(at.key);
  }
  return undefined;
}

function isPlaceholder(page: KnowledgePagePayload): boolean {
  return page.id.startsWith('unplaced:');
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

type RimEdgeData = PageFlowEdge['data'] & { from: Circle; to: Circle };
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
  const path = `M ${x1} ${y1} L ${x2} ${y2}`;
  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} interactionWidth={mention ? 20 : 0} />
      {data.kind === 'grant' && data.role ? (
        // A wide invisible path over the line, so hovering it names the access level.
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={14}
          data-testid="knowledge-grant-edge"
          data-role={data.role}
          aria-label={`Grants ${data.role}`}
        >
          <title>{`Grants ${data.role}`}</title>
        </path>
      ) : null}
    </>
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

/** The line styles the graph draws, which its legend names. */
type EdgeStyleKey = 'out' | 'in' | 'mention' | 'link' | 'grant' | 'dot-parent' | 'parent' | 'up';

/** What the circles, lines and badge mean. */
function GraphLegend({
  drawn,
  counts,
  dots,
  focused,
  levels,
  branches,
}: {
  /** The line styles on screen right now; the legend explains those and only those. */
  drawn: ReadonlySet<EdgeStyleKey>;
  /** Some circle carries an in/out link badge. */
  counts: boolean;
  dots: boolean;
  /** A page is focused, drawn larger and ringed at the centre. */
  focused: boolean;
  /** Which kinds of higher-level circle are drawn, to explain their icons. */
  levels: GraphLevel[];
  /** The branches dots are coloured by, each named for the circle it hangs under. */
  branches: Array<{ id: string; name: string; color: string }>;
}) {
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
      {levels.includes('scope') ? (
        <li className="flex items-center gap-2" data-testid="knowledge-legend-level-scope">
          <Layers aria-hidden className="size-3 shrink-0 text-muted-foreground" />
          <Txt as="span" variant="meta" tone="muted">
            Scope, above its pages
          </Txt>
        </li>
      ) : null}
      {levels.includes('ancestor') ? (
        <li className="flex items-center gap-2" data-testid="knowledge-legend-level-ancestor">
          <ArrowUpToLine aria-hidden className="size-3 shrink-0 text-muted-foreground" />
          <Txt as="span" variant="meta" tone="muted">
            Page above the focus
          </Txt>
        </li>
      ) : null}
      <li className="flex items-center gap-2">
        <span className={LEGEND_SWATCH} style={{ ...PAGE_STYLE }} aria-hidden />
        <Txt as="span" variant="meta" tone="muted">
          Page
        </Txt>
      </li>
      {focused ? (
        <li className="flex items-center gap-2" data-testid="knowledge-legend-focused">
          <span
            className={LEGEND_SWATCH}
            style={{ ...PAGE_STYLE, outline: '2px solid var(--knowledge-color)', outlineOffset: 2, borderWidth: 3 }}
            aria-hidden
          />
          <Txt as="span" variant="meta" tone="muted">
            Focused page
          </Txt>
        </li>
      ) : null}
      {dots ? (
        <li className="flex items-center gap-2" data-testid="knowledge-legend-dot">
          <span className="inline-block size-2 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
          <Txt as="span" variant="meta" tone="muted">
            Farther page (hover to name it)
          </Txt>
        </li>
      ) : null}
      {branches.slice(0, LEGEND_BRANCH_CAP).map(branch => (
        <li key={branch.id} className="flex items-center gap-2 pl-0.5" data-testid="knowledge-legend-branch">
          <span
            className="inline-block size-2 shrink-0 rounded-full"
            style={{ background: branch.color }}
            aria-hidden
          />
          <Txt as="span" variant="meta" tone="muted" className="max-w-40 truncate">
            Under {branch.name}
          </Txt>
        </li>
      ))}
      {branches.length > LEGEND_BRANCH_CAP ? (
        <li className="pl-0.5">
          <Txt as="span" variant="meta" tone="muted">
            +{branches.length - LEGEND_BRANCH_CAP} more branches
          </Txt>
        </li>
      ) : null}
      {drawn.has('out') || drawn.has('in') ? (
        <>
          {drawn.has('out') ? (
            <li className="flex items-center gap-2" data-testid="knowledge-legend-out">
              <svg width="16" height="8" aria-hidden className="shrink-0">
                <line x1="0" y1="4" x2="12" y2="4" stroke={LINK_EDGE_COLOR} strokeWidth="1.5" />
                <polygon points="11,1 16,4 11,7" fill={LINK_EDGE_COLOR} />
              </svg>
              <Txt as="span" variant="meta" tone="muted">
                Links out of the selected page
              </Txt>
            </li>
          ) : null}
          {drawn.has('in') ? (
            <li className="flex items-center gap-2" data-testid="knowledge-legend-in">
              <svg width="16" height="8" aria-hidden className="shrink-0">
                <line
                  x1="0"
                  y1="4"
                  x2="12"
                  y2="4"
                  stroke="var(--chart-orange)"
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                />
                <polygon points="11,1 16,4 11,7" fill="var(--chart-orange)" />
              </svg>
              <Txt as="span" variant="meta" tone="muted">
                Links into it
              </Txt>
            </li>
          ) : null}
        </>
      ) : null}
      {drawn.has('mention') ? (
        <li className="flex items-center gap-2" data-testid="knowledge-legend-mention">
          <svg width="12" height="4" aria-hidden className="shrink-0">
            <line x1="0" y1="2" x2="12" y2="2" stroke={MENTION_EDGE_COLOR} strokeWidth="2" />
          </svg>
          <Txt as="span" variant="meta" tone="muted">
            Mentioned in notes
          </Txt>
        </li>
      ) : null}
      {drawn.has('link') ? (
        <li className="flex items-center gap-2">
          <svg width="16" height="8" aria-hidden className="shrink-0" data-testid="knowledge-legend-link">
            <line x1="0" y1="4" x2="12" y2="4" {...LINK_EDGE_STYLE} />
            <polygon points="11,1 16,4 11,7" fill={LINK_EDGE_COLOR} />
          </svg>
          <Txt as="span" variant="meta" tone="muted">
            Linked in page body
          </Txt>
        </li>
      ) : null}
      {drawn.has('dot-parent') ? (
        <li className="flex items-center gap-2" data-testid="knowledge-legend-dot-parent">
          <svg width="16" height="4" aria-hidden className="shrink-0">
            <line x1="0" y1="2" x2="16" y2="2" {...DOT_PARENT_EDGE_STYLE} strokeOpacity={0.5} />
          </svg>
          <Txt as="span" variant="meta" tone="muted">
            Child page (dot)
          </Txt>
        </li>
      ) : null}
      {drawn.has('up') ? (
        <li className="flex items-center gap-2" data-testid="knowledge-legend-up">
          <svg width="16" height="8" aria-hidden className="shrink-0">
            <line x1="0" y1="4" x2="12" y2="4" {...UP_EDGE_STYLE} />
            <polygon points="9,1 15,4 9,7" fill={UP_EDGE_COLOR} />
          </svg>
          <Txt as="span" variant="meta" tone="muted">
            Parent of the focused page
          </Txt>
        </li>
      ) : null}
      {drawn.has('parent') ? (
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
      ) : null}
      {counts ? (
        <li className="flex items-center gap-2" data-testid="knowledge-legend-link-counts">
          <Txt as="span" variant="meta" style={{ color: 'var(--chart-orange)' }}>
            →4
          </Txt>
          <Txt as="span" variant="meta" style={{ color: LINK_EDGE_COLOR }}>
            14→
          </Txt>
          <Txt as="span" variant="meta" tone="muted">
            Links in, links out (not drawn)
          </Txt>
        </li>
      ) : null}
      {drawn.has('grant') ? (
        <li className="flex items-center gap-2">
          <svg width="16" height="8" aria-hidden className="shrink-0" data-testid="knowledge-legend-grant">
            <line x1="0" y1="4" x2="12" y2="4" {...GRANT_EDGE_STYLE} strokeDasharray="4 2 1 2" strokeWidth="1.5" />
            <polygon points="11,1 16,4 11,7" fill={GRANT_EDGE_COLOR} />
          </svg>
          <Txt as="span" variant="meta" tone="muted">
            Grants access (hover for role)
          </Txt>
        </li>
      ) : null}
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

/** How far the pointer may move between press and release and still count as a click, not a pan. */
const CLICK_SLOP_PX = 4;
/** Marks the nodes and lines that stay lit while the rest of the graph fades (see knowledge.css). */
const NEIGHBOUR_CLASS = 'knowledge-neighbour';

/**
 * The same edge objects while their content is unchanged. Pointing at a page changes the style of the
 * few lines touching it; handing React Flow fresh objects for every line would redraw them all.
 */
function useStableEdges<E extends Edge>(edges: E[]): E[] {
  const seen = useRef(new Map<string, { sig: string; edge: E }>());
  return useMemo(() => {
    const next = new Map<string, { sig: string; edge: E }>();
    const result = edges.map(edge => {
      const sig = JSON.stringify(edge);
      const before = seen.current.get(edge.id);
      const entry = before && before.sig === sig ? before : { sig, edge };
      next.set(edge.id, entry);
      return entry.edge;
    });
    seen.current = next;
    return result;
  }, [edges]);
}

/** The focused page's circle is this much larger than its neighbours'. */
const FOCUSED_SCALE = 1.2;
/** Most branch colours the legend names; the rest are counted. */
const LEGEND_BRANCH_CAP = 4;
/** Most links a hovered page draws that aren't drawn already. */
const HOVER_LINK_CAP = 40;

export interface KnowledgePageGraphProps {
  pages: KnowledgePagePayload[];
  /** Mention and body-link edges between pages; parent edges are derived from `pages`. */
  edges: KnowledgePageEdge[];
  pinnedIds?: readonly string[];
  /** Access grants between scopes, drawn from each principal scope to the scope it reaches. */
  grants?: readonly KnowledgeScopeGrantPayload[];
  selectedPageId?: string | null;
  /** The page the layout centres on when none is selected, drawn like a focused page without the ring. */
  centerId?: string | null;
  /** Per page, links into and out of it that the graph doesn't draw; shown as `→in out→` on full circles. */
  hiddenLinks?: ReadonlyMap<string, { in: number; out: number }>;
  /** Every link between pages, drawn or not: hovering a page draws its own, and tooltips count them. */
  knownLinks?: readonly KnowledgePageEdge[];
  /** Pages the focus links to or from that the hierarchy doesn't reach: drawn close around the focus. */
  nearIds?: ReadonlySet<string>;
  /** False while the pages the selected page needs are loading: the graph keeps its last layout until they are in. */
  settled?: boolean;
  /** Write each dot's total of links in and out inside it. */
  showCounts?: boolean;
  /** The pointer rests on a dot or stand-in: a host can load what it stands for. */
  onPreview?: (page: KnowledgePagePayload) => void;
  /** A page that wasn't selected was clicked, tapped, or activated with Enter or Space: select it. */
  onSelect: (page: KnowledgePagePayload) => void;
  /** The already-selected page was clicked, tapped, or activated again: open it. Without it, that only reselects. */
  onOpen?: (page: KnowledgePagePayload) => void;
  /** Empty canvas was clicked without moving the pointer (a pan doesn't count): clear the selection. */
  onClearSelection?: () => void;
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
  const { settled = true } = props;
  // While the pages a new focus needs are still loading, the graph keeps showing what it had: laying out
  // the new focus on old data would animate to the wrong place and then jump when the data landed. The
  // views change once, from the old layout to the new, when the data is in.
  const held = useRef(props);
  // A request that never answers must not pin the graph to the old view: past a deadline it draws what it has.
  const [released, setReleased] = useState(false);
  const holding = !settled && !released;
  if (!holding) held.current = props;
  const shown = !holding
    ? props
    : {
        ...props,
        pages: held.current.pages,
        edges: held.current.edges,
        pinnedIds: held.current.pinnedIds,
        grants: held.current.grants,
        selectedPageId: held.current.selectedPageId,
        centerId: held.current.centerId,
        hiddenLinks: held.current.hiddenLinks,
        knownLinks: held.current.knownLinks,
        nearIds: held.current.nearIds,
      };
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (settled) {
      setSlow(false);
      setReleased(false);
      return;
    }
    const hint = setTimeout(() => setSlow(true), LOADING_HINT_DELAY_MS);
    const deadline = setTimeout(() => setReleased(true), LOADING_RELEASE_MS);
    return () => {
      clearTimeout(hint);
      clearTimeout(deadline);
    };
  }, [settled, props.selectedPageId]);
  return (
    <ReactFlowProvider>
      <KnowledgePageGraphInner {...shown} />
      {slow && holding ? (
        <p
          role="status"
          data-testid="knowledge-graph-loading"
          className="text-ui-sm pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded border border-border bg-card px-3 py-1 text-muted-foreground shadow-overlay"
        >
          Loading pages…
        </p>
      ) : null}
    </ReactFlowProvider>
  );
}

function KnowledgePageGraphInner({
  pages,
  edges,
  pinnedIds = [],
  grants,
  selectedPageId,
  centerId,
  hiddenLinks,
  knownLinks,
  nearIds,
  showCounts,
  onPreview,
  onSelect,
  onOpen,
  onClearSelection,
  onMentionSelect,
}: KnowledgePageGraphProps) {
  // Grants add placeholder circles for declared principals with no scope page yet, and their own lines.
  const { graphPages, allEdges } = useMemo(() => {
    const granted = grantGraph(pages, grants);
    const withPlaceholders = granted.placeholders.length ? [...pages, ...granted.placeholders] : pages;
    return { graphPages: withPlaceholders, allEdges: [...pageGraphEdges(pages, edges), ...granted.edges] };
  }, [pages, edges, grants]);
  const linkSource = knownLinks ?? edges;
  // `hoverLinks` maps a page id to its links, built once when links load: a hover is a lookup, not a scan.
  const { linkCounts, hoverLinks } = useMemo(() => {
    const counts = new Map<string, { in: number; out: number }>();
    const touching = new Map<string, KnowledgePageEdge[]>();
    const pairs = new Set<string>();
    for (const edge of linkSource) {
      if (edge.kind !== 'mention' && edge.kind !== 'link') continue;
      if (edge.source === edge.target || pairs.has(`${edge.source}\u0000${edge.target}`)) continue;
      pairs.add(`${edge.source}\u0000${edge.target}`);
      const out = counts.get(edge.source) ?? { in: 0, out: 0 };
      out.out++;
      counts.set(edge.source, out);
      const into = counts.get(edge.target) ?? { in: 0, out: 0 };
      into.in++;
      counts.set(edge.target, into);
    }
    for (const edge of linkSource) {
      if (edge.kind !== 'mention' && edge.kind !== 'link') continue;
      for (const id of edge.source === edge.target ? [edge.source] : [edge.source, edge.target]) {
        const list = touching.get(id);
        if (list) list.push(edge);
        else touching.set(id, [edge]);
      }
    }
    return { linkCounts: counts, hoverLinks: touching };
  }, [linkSource]);
  // The focused page sits at the centre with its parent and children around it as full circles; pages
  // farther out are dots on outer rings, inside their branch's slice. A last overlap pass is the only force.
  const laidOut = useMemo(() => {
    const shape = graphShape(graphPages, selectedPageId ?? centerId ?? null);
    const colors = branchColors(graphPages, shape);
    const flow = toPageFlow(graphPages, allEdges);
    for (const node of flow.nodes) {
      // With counts on, only a dot that has a count grows to fit it; the rest stay small, so linked pages stand out.
      if (shape.form.get(node.id) === 'dot') {
        const links = linkCounts.get(node.id);
        const counted = showCounts && !isChildPlaceholder(node.data.page) && !!links && links.in + links.out > 0;
        node.data.size = counted ? KNOWLEDGE_COUNTED_DOT_SIZE : KNOWLEDGE_DOT_SIZE;
      } else if (node.id === shape.center) node.data.size = Math.round(node.data.size * FOCUSED_SCALE);
      // Circles at one level share a size, scopes included, so the ring reads evenly.
      else node.data.size = KNOWLEDGE_PAGE_SIZE;
    }
    // A page with dozens of children draws them smaller, so the ring stays a size that can be read and fitted.
    const ring = flow.nodes.filter(node => shape.depth.get(node.id) === 1 && shape.form.get(node.id) === 'full');
    const crowd = crowdScale(ring.length);
    if (crowd < 1) for (const node of ring) node.data.size = Math.round(node.data.size * crowd);
    const sizes = new Map(flow.nodes.map(node => [node.id, node.data.size]));
    const radial = radialLayout(graphPages, shape, page => sizes.get(page.id) ?? KNOWLEDGE_DOT_SIZE, nearIds);
    const positions = runLayout(
      flow.nodes.map(node => ({
        id: node.id,
        size: node.data.size,
        padding: shape.form.get(node.id) === 'dot' ? 4 : 24,
        initial: radial.get(node.id),
      })),
      [],
      { ticks: 0 },
    );
    return { nodes: flow.nodes, edges: flow.edges, positions, shape, colors };
  }, [graphPages, allEdges, selectedPageId, centerId, linkCounts, showCounts, nearIds]);
  const pageById = useMemo(() => new Map(graphPages.map(page => [page.id, page])), [graphPages]);
  // The page above whatever the graph is centred on, if it is drawn.
  const focusParentId = useMemo(() => {
    const parentId = laidOut.shape.center ? pageById.get(laidOut.shape.center)?.parentId : undefined;
    return parentId && laidOut.positions.has(parentId) ? parentId : null;
  }, [laidOut, pageById]);
  const drawnLevels = useMemo(() => {
    const kinds = new Set<GraphLevel>();
    for (const [id, level] of laidOut.shape.level) if (laidOut.shape.form.get(id) === 'full') kinds.add(level);
    return [...kinds];
  }, [laidOut]);
  // Each dot takes its branch's colour; the legend says which circle each colour hangs under.
  const dotBranches = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; color: string }>();
    for (const node of laidOut.nodes) {
      if (laidOut.shape.form.get(node.id) !== 'dot' || isChildPlaceholder(node.data.page)) continue;
      const branch = laidOut.shape.branch.get(node.id);
      const color = branch ? laidOut.colors.get(branch) : undefined;
      const owner = branch ? pageById.get(branch) : undefined;
      if (branch && color && owner && !seen.has(branch))
        seen.set(branch, { id: branch, name: owner.displayLabel ?? owner.name, color });
    }
    return [...seen.values()];
  }, [laidOut, pageById]);

  const pinned = useMemo(() => new Set(pinnedIds), [pinnedIds]);
  // Pages with children none of which is drawn yet (stand-ins don't count) carry their child count.
  // A circle counts its children whenever some of them are not drawn, as the tree does, so a parent
  // with 281 pages says so even with its first few laid around it.
  const childrenUndrawn = useMemo(() => {
    const drawn = new Map<string, number>();
    for (const page of graphPages) {
      if (page.parentId && !isChildPlaceholder(page) && !isRestCircle(page))
        drawn.set(page.parentId, (drawn.get(page.parentId) ?? 0) + 1);
    }
    return new Set(
      graphPages
        .filter(
          page =>
            !isScopeGroup(page) &&
            !isRestCircle(page) &&
            (page.childCountCapped || (page.childCount ?? 0) > (drawn.get(page.id) ?? 0)),
        )
        .map(page => page.id),
    );
  }, [graphPages]);
  // The page under the pointer, if any: its own lines show and the rest of the graph fades.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // A hovered page's links to pages that are drawn but whose lines aren't, up to a cap.
  const hoverExtra = useMemo(() => {
    if (!hoveredId) return [];
    const drawnIds = new Set(laidOut.nodes.map(node => node.id));
    const have = new Set(laidOut.edges.map(edge => edge.id));
    const extra: PageFlowEdge[] = [];
    for (const edge of hoverLinks.get(hoveredId) ?? []) {
      const id = `${edge.kind}:${edge.source}->${edge.target}`;
      if (have.has(id) || !drawnIds.has(edge.source) || !drawnIds.has(edge.target)) continue;
      have.add(id);
      extra.push({ id, source: edge.source, target: edge.target, data: { kind: edge.kind, count: edge.count ?? 1 } });
      if (extra.length >= HOVER_LINK_CAP) break;
    }
    return extra;
  }, [hoveredId, hoverLinks, laidOut]);
  const emphasisId = hoveredId && laidOut.positions.has(hoveredId) ? hoveredId : (selectedPageId ?? null);
  // With a page selected or hovered, everything more than one line away fades so its neighbourhood reads at a glance.
  const neighbours = useMemo(
    () =>
      emphasisId && laidOut.positions.has(emphasisId)
        ? pageNeighbourIds(emphasisId, [
            ...allEdges,
            ...hoverExtra.map(edge => ({ kind: edge.data?.kind ?? 'link', source: edge.source, target: edge.target })),
          ] as KnowledgePageEdge[])
        : null,
    [emphasisId, laidOut, allEdges, hoverExtra],
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
            form: laidOut.shape.form.get(node.id) ?? 'full',
            color: laidOut.colors.get(laidOut.shape.branch.get(node.id) ?? ''),
            badge: childrenUndrawn.has(node.id) ? childCountLabel(node.data.page) : undefined,
            path: pagePath(node.data.page, pageById),
            hiddenLinks: laidOut.shape.form.get(node.id) === 'full' ? hiddenLinks?.get(node.id) : undefined,
            ref: pageRef(node.data.page, pageById),
            links: linkCounts.get(node.id),
            showCount: showCounts,
            level: laidOut.shape.form.get(node.id) === 'full' ? laidOut.shape.level.get(node.id) : undefined,
            isParent: node.id === focusParentId,
          },
        };
      }),
    [laidOut, selectedPageId, pinned, childrenUndrawn, pageById, hiddenLinks, linkCounts, showCounts, focusParentId],
  );
  const { flowEdges: builtEdges, drawnEdgeStyles } = useMemo(() => {
    const drawn = new Set<EdgeStyleKey>();
    const sizes = new Map(laidOut.nodes.map(node => [node.id, node.data.size]));
    const circle = (id: string): Circle => {
      const center = laidOut.positions.get(id) ?? { x: 0, y: 0 };
      return { ...center, r: (sizes.get(id) ?? 0) / 2 };
    };
    const flowEdges = [...laidOut.edges, ...hoverExtra].map((edge): Edge<RimEdgeData> => {
      const mention = edge.data?.kind === 'mention';
      const grant = edge.data?.kind === 'grant';
      const link = edge.data?.kind === 'link';
      const toDot = laidOut.shape.form.get(edge.target) === 'dot';
      // A link touching the selected page reads by direction: out of it or into it.
      const direction =
        (mention || link) && emphasisId
          ? edge.source === emphasisId
            ? 'out'
            : edge.target === emphasisId
              ? 'in'
              : undefined
          : undefined;
      const up = !mention && !grant && !link && edge.source === focusParentId && edge.target === laidOut.shape.center;
      drawn.add(
        direction ??
          (up ? 'up' : mention ? 'mention' : grant ? 'grant' : link ? 'link' : toDot ? 'dot-parent' : 'parent'),
      );
      return {
        ...edge,
        type: 'rim',
        data: {
          kind: edge.data?.kind ?? 'parent',
          count: edge.data?.count ?? 1,
          ...(edge.data?.role ? { role: edge.data.role } : {}),
          from: circle(edge.source),
          to: circle(edge.target),
        },
        ...(mention && onMentionSelect ? { className: 'cursor-pointer' } : {}),
        style: direction
          ? { ...DIRECTION_EDGE_STYLE[direction], strokeWidth: mention ? 2 : 1.5 }
          : mention
            ? { stroke: MENTION_EDGE_COLOR, strokeWidth: Math.min(1.5 + (edge.data?.count ?? 1) * 0.5, 4) }
            : up
              ? UP_EDGE_STYLE
              : grant
                ? GRANT_EDGE_STYLE
                : link
                  ? LINK_EDGE_STYLE
                  : toDot
                    ? DOT_PARENT_EDGE_STYLE
                    : PARENT_EDGE_STYLE,
        markerEnd: direction
          ? DIRECTION_ARROW[direction]
          : up
            ? UP_ARROW
            : mention
              ? { type: MarkerType.ArrowClosed, color: MENTION_EDGE_COLOR, width: 14, height: 14 }
              : grant
                ? GRANT_ARROW
                : link
                  ? LINK_ARROW
                  : toDot
                    ? undefined
                    : PARENT_ARROW,
      };
    });
    return { flowEdges, drawnEdgeStyles: drawn };
  }, [laidOut, hoverExtra, onMentionSelect, emphasisId, focusParentId]);
  const flowEdges = useStableEdges(builtEdges);
  // Dimming is CSS: the container says something is emphasised, and only the page's neighbourhood is
  // marked. Pointing at a page then changes a few nodes and lines, not all of them.
  const emphasisedNodes = useMemo(
    () =>
      neighbours
        ? nodes.map(node => (neighbours.has(node.id) ? { ...node, className: NEIGHBOUR_CLASS } : node))
        : nodes,
    [nodes, neighbours],
  );
  const emphasisedEdges = useMemo(
    () =>
      neighbours
        ? flowEdges.map(edge =>
            neighbours.has(edge.source) && neighbours.has(edge.target)
              ? { ...edge, className: [edge.className, NEIGHBOUR_CLASS].filter(Boolean).join(' ') }
              : edge,
          )
        : flowEdges,
    [flowEdges, neighbours],
  );
  const pagesById = useMemo(() => new Map(pages.map(page => [page.id, page])), [pages]);
  const reactFlow = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const hasNodes = nodes.length > 0;

  // The view frames the selected page and its neighbours, or every page when nothing is selected. It is
  // computed from the layout's own positions and sizes rather than React Flow's `fitView`, which only
  // counts nodes it has measured in the DOM: in a production Studio it measured none, so the view never
  // moved. State is read through a ref so a refetch with the same selection never moves the view.
  // Pages that just left the view stay a moment, fading, so a refocus reads as a change and not a cut.
  const drawnNodes = useLeavingNodes(emphasisedNodes, prefersMotion());
  const fitState = useRef({ nodes, allEdges, selectedPageId, centerId, reactFlow });
  fitState.current = { nodes, allEdges, selectedPageId, centerId, reactFlow };
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
    const {
      nodes: current,
      allEdges: edgesNow,
      selectedPageId: selected,
      centerId: centre,
      reactFlow: flow,
    } = fitState.current;
    const focus = focusSelection && selected ? pageNeighbourIds(selected, edgesNow) : null;
    const targets = focus ? current.filter(node => focus.has(node.id)) : current;
    const bounds = graphBounds(targets);
    if (!bounds) return;
    const viewport = getViewportForBounds(bounds, width, height, READABLE_MIN_ZOOM, focus ? 1.5 : 2, focus ? 0.3 : 0.1);
    // When the floor stops the graph shrinking to fit, what is cropped is the edge, not the page being
    // looked at: the view centres on the focused page, or the layout's centre when nothing is focused.
    const anchor = current.find(node => node.id === (selected ?? centre));
    if (anchor && viewport.zoom <= READABLE_MIN_ZOOM) {
      const cx = anchor.position.x + (anchor.width ?? 0) / 2;
      const cy = anchor.position.y + (anchor.height ?? 0) / 2;
      viewport.x = width / 2 - cx * viewport.zoom;
      viewport.y = height / 2 - cy * viewport.zoom;
    }
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
    // A stand-in or a scope group isn't a page: the host loads or opens what it stands for.
    if (isChildPlaceholder(page) || isScopeGroup(page) || isRestCircle(page)) return onSelect(page);
    if (page.id === selectedPageId && onOpen) return onOpen(page);
    selectedHere.current = page.id;
    onSelect(page);
  };
  // Where the pointer went down, so a click that ends a pan isn't taken for a click on empty canvas.
  const pressedAt = useRef<{ x: number; y: number } | null>(null);
  const onPaneClick = (event: React.MouseEvent) => {
    const start = pressedAt.current;
    pressedAt.current = null;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) return;
    onClearSelection?.();
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
    <div
      ref={containerRef}
      className="knowledge-graph relative size-full"
      data-emphasis={neighbours ? 'on' : undefined}
      data-testid="knowledge-page-graph"
      onKeyDown={onKeyDown}
      onPointerDownCapture={event => {
        pressedAt.current = { x: event.clientX, y: event.clientY };
      }}
    >
      <GraphLegend
        branches={dotBranches}
        levels={drawnLevels}
        focused={!!selectedPageId && laidOut.positions.has(selectedPageId)}
        dots={[...laidOut.shape.form.values()].includes('dot')}
        drawn={drawnEdgeStyles}
        counts={[...(hiddenLinks ?? [])].some(
          ([id, hidden]) => laidOut.shape.form.get(id) === 'full' && (hidden.in > 0 || hidden.out > 0),
        )}
      />
      <ReactFlow
        nodes={drawnNodes}
        edges={emphasisedEdges}
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
        onPaneClick={onPaneClick}
        onNodeMouseEnter={(_: unknown, node: PageFlowNode) => {
          setHoveredId(node.id);
          if (laidOut.shape.form.get(node.id) === 'dot') onPreview?.(node.data.page);
        }}
        onNodeMouseLeave={() => setHoveredId(null)}
        onNodeClick={(_: unknown, node: PageFlowNode) => {
          if (!isPlaceholder(node.data.page)) activate(node.data.page);
        }}
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
