import type { Edge, EdgeProps, NodeProps } from '@xyflow/react';
import {
  Background,
  BaseEdge,
  BackgroundVariant,
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
import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { fitWords } from '../lib/circleText';
import {
  fitAllViewport,
  fitDuration,
  fitViewport,
  INITIAL_SETTLE_MS,
  nudgeAxis,
  uncoveredInsets,
} from '../lib/fitViewport';
import type { PaneInsets } from '../lib/fitViewport';
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
  REST_BATCH,
} from '../lib/graphShape';
import type { GraphLevel, GraphNodeForm } from '../lib/graphShape';
import { runLayout } from '../lib/layout';
import { linkCountsText } from '../lib/linkCountsText';
import { pagePath, pageRef, scopeTitle } from '../lib/pageAddress';
import type { PageFlowEdge, PageFlowNode } from '../lib/pageGraph';
import { KNOWLEDGE_PAGE_SIZE, grantGraph, pageGraphEdges, pageNeighbourIds, toPageFlow } from '../lib/pageGraph';
import { childCountLabel } from '../lib/pageTree';
import { chooseTooltipSide } from '../lib/tooltipSide';
import type { Box, TooltipPlacementInput, TooltipSide } from '../lib/tooltipSide';
import { prefersMotion, useLeavingNodes } from '../lib/useLeavingNodes';
import type { KnowledgePageEdge, KnowledgePagePayload, KnowledgeScopeGrantPayload } from '../pageTypes';
import { KnowledgePageCard } from './KnowledgePageCard';
import { KnowledgeTooltip } from './KnowledgeTooltip';

import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { Metadata } from '@/ds/components/Metadata';
import { Txt } from '@/ds/components/Txt';

import './knowledge.css';
import { IconArrowWallUp } from '@/ds/icons/central/IconArrowWallUp';
import { IconCircleInfo } from '@/ds/icons/central/IconCircleInfo';
import { IconFullscreen1 } from '@/ds/icons/central/IconFullscreen1';
import { IconLayersTwo } from '@/ds/icons/central/IconLayersTwo';
import { IconMinusLarge } from '@/ds/icons/central/IconMinusLarge';
import { IconPin } from '@/ds/icons/central/IconPin';
import { IconPlusLarge } from '@/ds/icons/central/IconPlusLarge';

const NO_PANE_INSETS: PaneInsets = { left: 0, right: 0 };
type PaneStyle = CSSProperties & { '--knowledge-pane-left': string };

// knowledge.css draws the border and the selection ring from this colour.
type CircleStyle = CSSProperties & { '--knowledge-color': string };
const SCOPE_STYLE: CircleStyle = {
  '--knowledge-color': 'var(--chart-blue)',
  background: 'color-mix(in oklab, var(--chart-blue) 16%, var(--card))',
};
const PAGE_STYLE: CircleStyle = { '--knowledge-color': 'var(--border-strong)' };
/** A farther page drawn as a named circle: the legend's "Page in another branch" dot grown, same solid grey fill, name in the page background colour to read on it. */
const FAR_FILL = 'var(--muted-foreground)';
const FAR_STYLE: CircleStyle = { '--knowledge-color': FAR_FILL, background: FAR_FILL };

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
  /** Of `links`, how many go to pages the graph doesn't draw; only on the page under the pointer. */
  notShown?: number;
  /** Write the dot's links in and out inside it. */
  showCount?: boolean;
  /** A scope or an ancestor of the focus: a circle that says it sits above other pages. */
  level?: GraphLevel;
  /** The focused page's parent: its circle says so. */
  isParent?: boolean;
  /** A page the focus links to or from rather than one of its neighbours in the hierarchy: drawn faded. */
  far?: boolean;
};

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
  const Icon = level === 'scope' ? IconLayersTwo : IconArrowWallUp;
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
  const { page, size, color, path, ref, links, notShown } = data;
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
  const linkText = links && (links.in > 0 || links.out > 0) ? linkCountsText(links, notShown) : null;
  const label = [page.name, hint ?? path, children, linkText].filter(Boolean).join(', ');
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
        '[aria-label="Legend"], [data-testid="knowledge-graph-back"], [data-knowledge-graph-zoom]',
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
          {hint ? (
            <>
              <Txt as="span" variant="label" tone="ink">
                {page.name}
              </Txt>
              <Txt as="span" variant="meta" tone="muted">
                <Metadata>
                  {group && <Metadata.Item>{path}</Metadata.Item>}
                  <Metadata.Item>{hint}</Metadata.Item>
                </Metadata>
              </Txt>
            </>
          ) : (
            <KnowledgePageCard
              name={page.name}
              kind={kind}
              pageRef={ref}
              path={path}
              childCount={page.childCount ? childCountLabel(page) : undefined}
              links={links}
              notShown={notShown}
            />
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
  const tip = circleTooltip(data, kind);
  return (
    <div
      data-testid="knowledge-page-node"
      data-page-id={page.id}
      data-page-type={placeholder ? 'placeholder' : rest ? 'rest' : group ? 'group' : page.isScope ? 'scope' : 'page'}
      className={`relative transition-opacity ${placeholder ? 'cursor-default' : 'cursor-pointer'}`}
      style={{ width: size, height: size }}
      aria-label={tip}
    >
      <KnowledgeTooltip label={tip}>
        <div
          className={`knowledge-circle flex size-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-full border-2 text-center shadow-raised ${rest ? 'hover:border-foreground' : ''}`}
          data-selected={selected || undefined}
          data-far={data.far || undefined}
          style={{
            ...(placeholder || rest
              ? PLACEHOLDER_STYLE
              : data.far
                ? FAR_STYLE
                : page.isScope
                  ? SCOPE_STYLE
                  : PAGE_STYLE),
            paddingInline: size * ((1 - CIRCLE_TEXT_SHARE) / 2),
          }}
        >
          {data.far ? null : (
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
          )}
          <Txt
            as="span"
            variant={compact ? 'meta' : 'label'}
            tone="ink"
            className={`pointer-events-none max-w-full overflow-hidden [overflow-wrap:normal] ${compact ? 'line-clamp-2' : 'line-clamp-3'}`}
            style={data.far ? { color: 'var(--background)' } : undefined}
            data-testid="knowledge-circle-name"
          >
            <BreakAtColons text={fitWords(scopeTitle(page), fit)} />
          </Txt>
        </div>
      </KnowledgeTooltip>
      {pinned ? <PinBadge size={size} /> : null}
      {data.hiddenLinks && (data.hiddenLinks.in > 0 || data.hiddenLinks.out > 0) ? (
        <KnowledgeTooltip label={linkCountsText(data.hiddenLinks)}>
          <span
            data-testid="knowledge-hidden-links"
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
        </KnowledgeTooltip>
      ) : null}
      {badge ? (
        <KnowledgeTooltip label={`${badge} children, not all drawn`}>
          <span
            data-testid="knowledge-child-count-badge"
            aria-label={`${badge} children, not all drawn`}
            className="absolute top-full left-1/2 -mt-1 -translate-x-1/2 rounded-full border border-border bg-card px-1.5 shadow-raised"
          >
            <Txt as="span" variant="meta" tone="ink">
              {badge}
            </Txt>
          </span>
        </KnowledgeTooltip>
      ) : null}
      <Handle type="target" position={Position.Top} className="!invisible" />
      <Handle type="source" position={Position.Bottom} className="!invisible" />
    </div>
  );
}

function circleTooltip(data: PageNodeData, kind: string): string {
  const { page, links, notShown } = data;
  if (isPlaceholder(page)) return `${kind}: ${page.address}. Nothing written to it yet.`;
  if (isRestCircle(page)) {
    return `Show ${Math.min(REST_BATCH, page.childCount ?? REST_BATCH)} more of ${page.childCount ?? 'the rest'}`;
  }
  if (isScopeGroup(page)) return `${page.name}: click to show them`;
  if (page.isScope && page.address) {
    const title = scopeTitle(page);
    return title === page.address ? `${kind}: ${title}` : `${kind}: ${title} (${page.address})`;
  }
  if (links && links.in + links.out > 0) return `${page.name}: ${linkCountsText(links, notShown)}`;
  return page.name;
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
      <IconPin size={Math.round(badge * 0.6)} aria-hidden />
    </span>
  );
}

/** A colour the legend explains: the circle the dots of that colour hang under. */
interface LegendBranch {
  id: string;
  name: string;
  color: string;
  scope: boolean;
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

const edgeTypes = { rim: memo(RimEdgeComponent) };

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
  linkEnds,
  focused,
  levels,
  branches,
  collapsible,
}: {
  collapsible?: boolean;
  /** The line styles on screen right now; the legend explains those and only those. */
  drawn: ReadonlySet<EdgeStyleKey>;
  /** Some circle carries an in/out link badge. */
  counts: boolean;
  dots: boolean;
  /** Link ends drawn as circles in the farther-page grey. */
  linkEnds: boolean;
  /** A page is focused, drawn larger and ringed at the centre. */
  focused: boolean;
  /** Which kinds of higher-level circle are drawn, to explain their icons. */
  levels: GraphLevel[];
  /** The branches dots are coloured by, each named for the circle it hangs under. */
  branches: LegendBranch[];
}) {
  const [pinned, setPinned] = useState(!collapsible);
  const [peeking, setPeeking] = useState(false);
  const open = pinned || peeking;
  return (
    <div
      className="absolute top-3 left-3 z-10 flex translate-x-(--knowledge-pane-left) flex-col items-start gap-1.5 transition-transform duration-slow ease-out-custom motion-reduce:transition-none"
      onPointerEnter={collapsible ? () => setPeeking(true) : undefined}
      onPointerLeave={collapsible ? () => setPeeking(false) : undefined}
    >
      {collapsible ? (
        <Button
          size="sm"
          icon={<IconCircleInfo />}
          aria-expanded={open}
          className="shadow-overlay"
          onFocus={() => setPeeking(true)}
          onBlur={() => setPeeking(false)}
          onClick={() => {
            setPinned(current => !current);
            setPeeking(false);
          }}
        >
          Legend
        </Button>
      ) : null}
      <ul
        aria-label="Legend"
        hidden={collapsible && !open}
        className={`pointer-events-none flex flex-col gap-1 rounded-lg px-2.5 py-2 ${collapsible ? 'bg-card shadow-overlay' : 'rounded-md border border-border bg-card/90 shadow-raised'}`}
      >
        <li className="flex items-center gap-2">
          <span className={LEGEND_SWATCH} style={{ ...SCOPE_STYLE }} aria-hidden />
          <Txt as="span" variant="meta" tone="muted">
            Scope
          </Txt>
        </li>
        {levels.includes('scope') ? (
          <li className="flex items-center gap-2" data-testid="knowledge-legend-level-scope">
            <IconLayersTwo aria-hidden className="size-3 shrink-0 text-muted-foreground" />
            <Txt as="span" variant="meta" tone="muted">
              Scope, above its pages
            </Txt>
          </li>
        ) : null}
        {levels.includes('ancestor') ? (
          <li className="flex items-center gap-2" data-testid="knowledge-legend-level-ancestor">
            <IconArrowWallUp aria-hidden className="size-3 shrink-0 text-muted-foreground" />
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
            <span className={LEGEND_SWATCH} style={{ ...PAGE_STYLE, borderWidth: 3 }} aria-hidden />
            <Txt as="span" variant="meta" tone="muted">
              Focused page
            </Txt>
          </li>
        ) : null}
        {dots || linkEnds ? (
          <li className="flex items-center gap-2" data-testid="knowledge-legend-dot">
            <span className="inline-block size-2 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
            <Txt as="span" variant="meta" tone="muted">
              Page in another branch
            </Txt>
          </li>
        ) : null}
        {/* One parent group reads generically; several would look identical, so each row names its parent. */}
        {branches.slice(0, LEGEND_BRANCH_CAP).map(branch => (
          <li key={branch.id} className="flex items-center gap-2 pl-0.5" data-testid="knowledge-legend-branch">
            <span
              className="inline-block size-2 shrink-0 rounded-full"
              style={{ background: branch.color }}
              aria-hidden
            />
            <KnowledgeTooltip label={branch.name}>
              <Txt as="span" variant="meta" tone="muted" className="pointer-events-auto max-w-40 truncate">
                {branches.length > 1
                  ? `Under ${branch.name}`
                  : branch.scope
                    ? 'Under parent scope'
                    : 'Under parent page'}
              </Txt>
            </KnowledgeTooltip>
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
            <IconPin size={8} />
          </span>
          <Txt as="span" variant="meta" tone="muted">
            Pinned
          </Txt>
        </li>
      </ul>
    </div>
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
/** Pages in other branches that the focus links to draw a little smaller than its own neighbours. */
const LINK_END_SCALE = 0.8;
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
  insets?: PaneInsets;
  collapsibleLegend?: boolean;
  /** Exact links into and out of pages, from the store; they replace the counts taken from `knownLinks`. */
  exactLinkCounts?: ReadonlyMap<string, { in: number; out: number }>;
  /** Links fetched for the page under the pointer: drawn on hover, never counted or laid out. */
  fetchedLinks?: readonly KnowledgePageEdge[];
  /** The page under the pointer, or null: a host can fetch that page's links. */
  onHover?: (pageId: string | null) => void;
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
  exactLinkCounts,
  fetchedLinks,
  onHover,
  showCounts,
  onPreview,
  onSelect,
  onOpen,
  onClearSelection,
  onMentionSelect,
  insets = NO_PANE_INSETS,
  collapsibleLegend,
}: KnowledgePageGraphProps) {
  // Grants add placeholder circles for declared principals with no scope page yet, and their own lines.
  const { graphPages, allEdges } = useMemo(() => {
    const granted = grantGraph(pages, grants);
    const withPlaceholders = granted.placeholders.length ? [...pages, ...granted.placeholders] : pages;
    return { graphPages: withPlaceholders, allEdges: [...pageGraphEdges(pages, edges), ...granted.edges] };
  }, [pages, edges, grants]);
  const linkSource = knownLinks ?? edges;
  // Counts size the dots, so they feed the layout: they come from what is loaded and the store's counts,
  // never from links fetched for a hover, or every hover would lay the whole graph out again.
  const linkCounts = useMemo(() => {
    const counts = new Map<string, { in: number; out: number }>();
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
    // Counts from the store cover pages whose links go to pages that were never loaded.
    for (const [id, exact] of exactLinkCounts ?? []) counts.set(id, exact);
    return counts;
  }, [linkSource, exactLinkCounts]);
  // Page id -> its links, built once when links load; a hover is a lookup, not a scan of every link.
  const hoverLinks = useMemo(() => {
    const touching = new Map<string, KnowledgePageEdge[]>();
    const add = (id: string, edge: KnowledgePageEdge) => {
      const list = touching.get(id);
      if (list) list.push(edge);
      else touching.set(id, [edge]);
    };
    for (const edge of [...linkSource, ...(fetchedLinks ?? [])]) {
      if (edge.kind !== 'mention' && edge.kind !== 'link') continue;
      add(edge.source, edge);
      if (edge.target !== edge.source) add(edge.target, edge);
    }
    return touching;
  }, [linkSource, fetchedLinks]);
  // The focused page sits at the centre with its parent and children around it as full circles; pages
  // farther out are dots on outer rings, inside their branch's slice. A last overlap pass is the only force.
  const laidOut = useMemo(() => {
    const shape = graphShape(graphPages, selectedPageId ?? centerId ?? null, nearIds);
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
      else node.data.size = Math.round(KNOWLEDGE_PAGE_SIZE * (shape.linked.has(node.id) ? LINK_END_SCALE : 1));
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
    const seen = new Map<string, LegendBranch>();
    for (const node of laidOut.nodes) {
      if (laidOut.shape.form.get(node.id) !== 'dot' || isChildPlaceholder(node.data.page)) continue;
      const branch = laidOut.shape.branch.get(node.id);
      const color = branch ? laidOut.colors.get(branch) : undefined;
      const owner = branch ? pageById.get(branch) : undefined;
      if (branch && color && owner && !seen.has(branch))
        seen.set(branch, { id: branch, name: owner.displayLabel ?? scopeTitle(owner), color, scope: !!owner.isScope });
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
  useEffect(() => onHover?.(hoveredId), [hoveredId, onHover]);
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
  // Of the hovered page's links, those with no line drawn: the other end is off screen, or past the cap.
  const hoveredNotShown = useMemo(() => {
    const total = hoveredId ? linkCounts.get(hoveredId) : undefined;
    if (!hoveredId || !total) return 0;
    const pairs = new Set<string>();
    for (const edge of [...laidOut.edges, ...hoverExtra]) {
      const kind = edge.data?.kind;
      if ((kind !== 'mention' && kind !== 'link') || (edge.source !== hoveredId && edge.target !== hoveredId)) continue;
      pairs.add(`${edge.source}\u0000${edge.target}`);
    }
    return Math.max(0, total.in + total.out - pairs.size);
  }, [hoveredId, linkCounts, laidOut, hoverExtra]);
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
            far: laidOut.shape.linked.has(node.id) || undefined,
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
        // Into the focus is dashed: drawn over the solid way out, so the green shows between the dashes.
        ...(direction === 'in' ? { zIndex: 1 } : {}),
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
      nodes.map(node => {
        const near = neighbours?.has(node.id);
        const hovered = node.id === hoveredId && hoveredNotShown > 0;
        if (!near && !hovered) return node;
        return {
          ...node,
          ...(near ? { className: NEIGHBOUR_CLASS } : {}),
          ...(hovered ? { data: { ...node.data, notShown: hoveredNotShown } } : {}),
        };
      }),
    [nodes, neighbours, hoveredId, hoveredNotShown],
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
  const linkedIds = laidOut.shape.linked;
  const paneStyle: PaneStyle = { '--knowledge-pane-left': `${insets.left}px` };
  const fitState = useRef({ nodes, selectedPageId, centerId, reactFlow, linkedIds, insets });
  fitState.current = { nodes, selectedPageId, centerId, reactFlow, linkedIds, insets };
  // Set when a fit found the pane 0×0, so the next non-zero size fits even if it matches the last one seen.
  const fitPending = useRef(false);
  // The pane and what is drawn, or null while the pane has no size (the next non-zero size fits).
  const paneAndNodes = () => {
    const container = containerRef.current;
    const width = container?.clientWidth ?? 0;
    const height = container?.clientHeight ?? 0;
    if (width === 0 || height === 0) {
      fitPending.current = true;
      return null;
    }
    fitPending.current = false;
    const { nodes: current, reactFlow: flow } = fitState.current;
    const bounds = graphBounds(current);
    return bounds ? { container, width, height, current, flow, bounds } : null;
  };
  // Fit view: every drawn node; with an outer ring of linked pages, below the readable floor so it all shows.
  const fit = useCallback((duration?: number) => {
    const view = paneAndNodes();
    if (!view) return;
    const { selectedPageId: selected, centerId: centre, linkedIds: linked, insets: covered } = fitState.current;
    const anchor = view.current.find(node => node.id === (selected ?? centre));
    const ring = !!selected && view.current.some(node => linked.has(node.id));
    const viewport = fitViewport({
      bounds: view.bounds,
      width: view.width,
      height: view.height,
      ring,
      anchor,
      insets: covered,
    });
    void view.flow.setViewport(viewport, duration ? { duration } : undefined);
  }, []);
  // The first view, once the graph has a size: everything drawn, with a margin, clear of the legend.
  const fitInitial = useCallback(() => {
    const view = paneAndNodes();
    if (!view) return;
    const box = view.container?.getBoundingClientRect();
    const legend = view.container?.querySelector('[aria-label="Legend"]')?.getBoundingClientRect();
    const viewport = fitAllViewport({
      bounds: view.bounds,
      nodes: view.current.map(node => ({
        x: node.position.x,
        y: node.position.y,
        width: node.width ?? 0,
        height: node.height ?? 0,
      })),
      width: view.width,
      height: view.height,
      legend: box && legend ? { right: legend.right - box.left + 8, bottom: legend.bottom - box.top + 8 } : undefined,
      insets: fitState.current.insets,
    });
    void view.flow.setViewport(viewport);
  }, []);

  // A refocus leaves the view exactly where the user put it, pan and zoom. Only when the newly focused page
  // would land outside the pane (or too close to its edge) does the view move, and then by just enough to
  // bring the page back in. A pane that merely changes size does the same. Fit view is the one control that
  // changes zoom.
  const nudgeToSelection = useCallback((duration?: number) => {
    const container = containerRef.current;
    const width = container?.clientWidth ?? 0;
    const height = container?.clientHeight ?? 0;
    const { nodes: current, selectedPageId: selected, centerId: centre, reactFlow: flow, insets } = fitState.current;
    const anchor = current.find(node => node.id === (selected ?? centre));
    if (!anchor || width === 0 || height === 0) return;
    const covered = uncoveredInsets(width, insets);
    const view = flow.getViewport();
    const dx = nudgeAxis(
      anchor.position.x * view.zoom + view.x - covered.left,
      (anchor.width ?? 0) * view.zoom,
      width - covered.left - covered.right,
    );
    const dy = nudgeAxis(anchor.position.y * view.zoom + view.y, (anchor.height ?? 0) * view.zoom, height);
    if (dx === 0 && dy === 0) return;
    void flow.setViewport({ zoom: view.zoom, x: view.x + dx, y: view.y + dy }, duration ? { duration } : undefined);
  }, []);

  // A host that hides the graph behind a Tree/Graph toggle gives it zero size at first, so fit when the
  // container first gets a non-zero size. Once it has been laid out, a new size (the window resized, a
  // banner appeared above it) keeps the zoom and re-centres, so it never undoes the user's zoom. At most
  // once a frame.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    let last = { width: container.clientWidth, height: container.clientHeight };
    let frame: number | undefined;
    // Set while the pane has been hidden, until a fit has run. A second resize can cancel the frame that
    // would have fitted, so this has to outlive the callback.
    let needsFit = false;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const changed = width !== last.width || height !== last.height;
      if (last.width === 0 || last.height === 0) needsFit = true;
      last = { width, height };
      if ((!changed && !fitPending.current) || width === 0 || height === 0) return;
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = undefined;
        if (needsFit || fitPending.current) {
          needsFit = false;
          fitInitial();
        } else nudgeToSelection();
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [hasNodes, fitInitial, nudgeToSelection]);

  // A selection made outside the graph (tree, search, a link) pans to that page at the current zoom. A
  // click on the graph itself leaves the view where the user put it.
  const selectedHere = useRef<string | null>(null);
  const selectedIsLoaded = !!selectedPageId && pagesById.has(selectedPageId);
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) nudgeToSelection(fitDuration(prefersMotion()));
  }, [insets.left, insets.right, nudgeToSelection]);

  // The first view is refitted while the graph is still filling in (ring pages, children, links arrive over the
  // first moments), until the user does anything or the window closes. After that the view is theirs.
  const settleUntil = useRef(0);
  const settledOn = useRef<string | null>(null);
  // What the last first-view fit was of, so a refetch that draws the same thing doesn't fit again.
  const fittedLayout = useRef('');
  const stopSettling = useCallback(() => {
    settleUntil.current = 0;
  }, []);
  useEffect(() => {
    if (!initialized.current) return;
    if ((selectedPageId ?? null) !== settledOn.current) settleUntil.current = 0;
    if (Date.now() >= settleUntil.current) return;
    const layout = nodes.map(node => `${node.id}@${node.position.x},${node.position.y}`).join('|');
    if (layout === fittedLayout.current) return;
    fittedLayout.current = layout;
    fitInitial();
  }, [nodes, selectedPageId, fitInitial]);
  useEffect(() => {
    if (!initialized.current || !selectedIsLoaded || !selectedPageId) return;
    const fromGraph = selectedHere.current === selectedPageId;
    selectedHere.current = null;
    if (fromGraph) return;
    nudgeToSelection(fitDuration(prefersMotion()));
  }, [selectedPageId, selectedIsLoaded, nudgeToSelection]);

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

  // React Flow focuses nodes but only toggles its own selection on Enter or Space; route them like a click.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const id = (event.target as HTMLElement).closest<HTMLElement>('.react-flow__node')?.dataset.id;
    const page = id ? pagesById.get(id) : undefined;
    if (!page) return;
    event.preventDefault();
    activate(page);
  };
  // React Flow hands these to every node and line, and re-renders them all when one changes. They read the
  // latest props through a ref so their identity never changes, and pointing at a page re-renders only the
  // pages whose own props changed.
  const latest = useRef({ activate, onPreview, onMentionSelect, onClearSelection, laidOut, pagesById });
  latest.current = { activate, onPreview, onMentionSelect, onClearSelection, laidOut, pagesById };
  const onNodeMouseEnter = useCallback((_: unknown, node: PageFlowNode) => {
    setHoveredId(node.id);
    if (latest.current.laidOut.shape.form.get(node.id) === 'dot') latest.current.onPreview?.(node.data.page);
  }, []);
  const onNodeMouseLeave = useCallback(() => setHoveredId(null), []);
  const onNodeClick = useCallback((_: unknown, node: PageFlowNode) => {
    if (!isPlaceholder(node.data.page)) latest.current.activate(node.data.page);
  }, []);
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge<RimEdgeData>) => {
    const { onMentionSelect, pagesById } = latest.current;
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
  }, []);
  const onPaneClick = useCallback((event: React.MouseEvent) => {
    const start = pressedAt.current;
    pressedAt.current = null;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) return;
    latest.current.onClearSelection?.();
  }, []);

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
      style={paneStyle}
      className="knowledge-graph relative size-full"
      data-emphasis={neighbours ? 'on' : undefined}
      data-testid="knowledge-page-graph"
      onKeyDown={onKeyDown}
      onWheelCapture={stopSettling}
      onPointerDownCapture={event => {
        stopSettling();
        pressedAt.current = { x: event.clientX, y: event.clientY };
      }}
    >
      <GraphLegend
        collapsible={collapsibleLegend}
        branches={dotBranches}
        levels={drawnLevels}
        focused={!!selectedPageId && laidOut.positions.has(selectedPageId)}
        dots={[...laidOut.shape.form.values()].includes('dot')}
        linkEnds={laidOut.shape.linked.size > 0}
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
          settleUntil.current = Date.now() + INITIAL_SETTLE_MS;
          settledOn.current = fitState.current.selectedPageId ?? null;
          fittedLayout.current = fitState.current.nodes
            .map(node => `${node.id}@${node.position.x},${node.position.y}`)
            .join('|');
          fitInitial();
        }}
        minZoom={0.1}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        nodesDraggable={false}
        onPaneClick={onPaneClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.4} color="var(--border-strong)" />
      </ReactFlow>
      <div className="absolute bottom-3 left-3 z-10 translate-x-(--knowledge-tree-drawer-inset,0px) transition-transform duration-slow ease-out-custom motion-reduce:transition-none">
        <ButtonsGroup size="sm" aria-label="Zoom" data-knowledge-graph-zoom className="rounded-full shadow-overlay">
          <Button
            size="icon-sm"
            tooltip="Zoom out"
            aria-label="Zoom out"
            onClick={() => void reactFlow.zoomOut({ duration: fitDuration(prefersMotion()) })}
          >
            <IconMinusLarge />
          </Button>
          <Button
            size="icon-sm"
            tooltip="Zoom in"
            aria-label="Zoom in"
            onClick={() => void reactFlow.zoomIn({ duration: fitDuration(prefersMotion()) })}
          >
            <IconPlusLarge />
          </Button>
          <Button
            size="icon-sm"
            tooltip="Fit view"
            aria-label="Fit view"
            onClick={() => fit(fitDuration(prefersMotion()))}
          >
            <IconFullscreen1 />
          </Button>
        </ButtonsGroup>
      </div>
    </div>
  );
}
