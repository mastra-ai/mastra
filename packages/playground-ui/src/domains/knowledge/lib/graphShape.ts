/**
 * The graph's shape around one focused page: how far each page sits from the focus along parent links,
 * which pages draw as full labelled circles and which as small dots, and where each one goes on a
 * radial layout. Pure, so the depth rule and the layout are unit-tested without React Flow.
 */

import type { KnowledgePagePayload } from '../pageTypes';
import { comparePagePosition } from './pageTree';

/** Why a page far from the focus still draws as a labelled circle. */
export type GraphLevel = 'scope' | 'ancestor';

/** Most scopes and ancestors beyond the first ring that draw as circles; any more fall back to dots. */
export const HIGHER_LEVEL_CAP = 10;

/** Full circles carry a label; dots are small coloured markers that name themselves on hover. */
export type GraphNodeForm = 'full' | 'dot';

/** Pages at most this many parent links from the focus draw as full circles. */
export const FULL_CIRCLE_DEPTH = 1;

/**
 * How many pages one level farther out than the usual circles still draw as circles, so a page with no
 * children reads like a focused scope instead of a ring of bare dots. The rest of that level, and the level
 * below, are dots.
 */
export const ROOT_CIRCLE_CAP = 8;

/**
 * The pages promoted to circles at depth two: for a centre with no children, its first siblings, the children
 * of its parent, since those are the pages around it. A centre with children needs no promotion: its own
 * children are the circles.
 */
export function promotedCircles(
  children: ReadonlyMap<string, readonly KnowledgePagePayload[]>,
  center: KnowledgePagePayload | undefined,
): Set<string> {
  const promoted = new Set<string>();
  if (center && !(children.get(center.id)?.length ?? 0) && !(center.childCount ?? 0)) {
    if (center.parentId && center.parentId !== center.id) {
      (children.get(center.parentId) ?? [])
        .filter(child => child.id !== center.id && !isChildPlaceholder(child))
        .slice(0, ROOT_CIRCLE_CAP)
        .forEach(child => promoted.add(child.id));
    }
  }
  return promoted;
}

/** A dot's diameter. */
export const KNOWLEDGE_DOT_SIZE = 20;
/** A dot's diameter when it carries its link count. */
export const KNOWLEDGE_COUNTED_DOT_SIZE = 28;

/** How far past its edge a dot still counts as under the pointer. */
export const KNOWLEDGE_DOT_HIT_MARGIN = 8;

const PLACEHOLDER_PREFIX = 'more:';
const REST_PREFIX = 'rest:';
const GROUP_PREFIX = 'group:';

/** A stand-in dot for a child that hasn't loaded yet; `parentId` is the page whose children it stands for. */
export function isChildPlaceholder(page: Pick<KnowledgePagePayload, 'id'>): boolean {
  return page.id.startsWith(PLACEHOLDER_PREFIX);
}

/** The circle that says how many more children the centre has than are drawn; it opens nothing. */
export function isRestCircle(page: Pick<KnowledgePagePayload, 'id'>): boolean {
  return page.id.startsWith(REST_PREFIX);
}

/** One circle standing for several sibling scopes of one type, e.g. a resource's memory threads. */
export function isScopeGroup(page: Pick<KnowledgePagePayload, 'id'>): boolean {
  return page.id.startsWith(GROUP_PREFIX);
}

export interface GraphShape {
  /** Parent links between each page and the focus; the focus is 0. Pages the focus can't reach are left out. */
  depth: Map<string, number>;
  form: Map<string, GraphNodeForm>;
  /** The page one link from the focus that each farther page hangs under, so its dot takes that branch's colour. */
  branch: Map<string, string>;
  /** The page each one was reached from, walking out from the focus. */
  via: Map<string, string | null>;
  /** Pages that sit above others and always draw as labelled circles: scopes, and the focus's ancestors. */
  level: Map<string, GraphLevel>;
  /** The focus's link ends drawn as circles: farther pages, not neighbours in the hierarchy. */
  linked: Set<string>;
  /** The page the layout centres on: the focus, else the first root; `null` only when there are no pages. */
  center: string | null;
}

function liveOnly(pages: readonly KnowledgePagePayload[]) {
  return pages.filter(page => !page.deletedAt && !page.mergedInto);
}

/**
 * Walks parent links out from `focusId` (or, with no focus, from the roots), so each page's depth is how
 * many links it sits from the focus, whichever way they run: the focus's parent and its children are 1,
 * its siblings and grandchildren 2. The focus and pages within {@link FULL_CIRCLE_DEPTH} are full circles;
 * every other page, every page the walk never reaches, and every placeholder is a dot. With no focus the
 * first root becomes the centre and the other roots sit one link from it. A root is any page whose parent is not loaded, so a page cut off from its parent by a bounded graph is a root too.
 */
export function graphShape(
  pages: readonly KnowledgePagePayload[],
  focusId: string | null,
  linkEnds: ReadonlySet<string> = noPages,
): GraphShape {
  const live = liveOnly(pages);
  const byId = new Map(live.map(page => [page.id, page]));
  const children = new Map<string, KnowledgePagePayload[]>();
  const roots: KnowledgePagePayload[] = [];
  for (const page of live) {
    const parent = page.parentId && page.parentId !== page.id ? byId.get(page.parentId) : undefined;
    if (!parent) roots.push(page);
    else children.set(parent.id, [...(children.get(parent.id) ?? []), page]);
  }
  for (const list of children.values()) list.sort(comparePagePosition);
  roots.sort(comparePagePosition);

  const center = focusId && byId.has(focusId) ? focusId : (roots[0]?.id ?? null);
  const centerPage = center ? byId.get(center) : undefined;
  const depth = new Map<string, number>();
  const branch = new Map<string, string>();
  const via = new Map<string, string | null>();
  const queue: string[] = [];
  const visit = (id: string, from: string | null, at: number, fromBranch: string | undefined) => {
    if (depth.has(id)) return;
    depth.set(id, at);
    via.set(id, from);
    const own = at === 1 ? id : fromBranch;
    if (own) branch.set(id, own);
    queue.push(id);
  };
  if (center) visit(center, null, 0, undefined);
  else for (const root of roots) visit(root.id, null, 1, undefined);
  while (queue.length) {
    const id = queue.shift() as string;
    const at = depth.get(id) as number;
    const page = byId.get(id);
    const parentId = page?.parentId && byId.has(page.parentId) ? page.parentId : null;
    // Parent first, so a focused page's parent takes the first slot on the ring.
    if (parentId) visit(parentId, id, at + 1, branch.get(id));
    for (const child of children.get(id) ?? []) visit(child.id, id, at + 1, branch.get(id));
    // A root at the centre sits among the other roots, each a circle of its own beside its children.
    if (id === center && centerPage && roots.includes(centerPage)) {
      for (const root of roots) if (root.id !== center) visit(root.id, id, at + 1, root.id);
    }
  }

  // Scopes and the path up from the focus are the graph's higher levels: they read as circles, not dots.
  const level = new Map<string, GraphLevel>();
  for (let up = focusId ? byId.get(focusId)?.parentId : undefined; up && !level.has(up);) {
    const above = byId.get(up);
    if (!above) break;
    level.set(above.id, above.isScope ? 'scope' : 'ancestor');
    up = above.parentId && above.parentId !== above.id ? above.parentId : undefined;
  }
  for (const page of live) {
    if (page.isScope && !isScopeGroup(page) && !isChildPlaceholder(page) && depth.has(page.id)) {
      level.set(page.id, 'scope');
    }
  }
  const rootCircles = promotedCircles(children, centerPage);
  const form = new Map<string, GraphNodeForm>();
  const linked = new Set<string>();
  let farCircles = 0;
  for (const page of live) {
    const at = depth.get(page.id);
    const near = at !== undefined && (at <= FULL_CIRCLE_DEPTH || rootCircles.has(page.id)) && !isChildPlaceholder(page);
    const higher = at !== undefined && level.has(page.id) && !isChildPlaceholder(page);
    // The focus's own link ends are as much its neighbours as its children: they read as named circles too.
    const linkedEnd = at === undefined && linkEnds.has(page.id) && !isChildPlaceholder(page);
    if (linkedEnd) linked.add(page.id);
    form.set(page.id, near || linkedEnd || (higher && farCircles++ < HIGHER_LEVEL_CAP) ? 'full' : 'dot');
  }
  return { depth, form, branch, via, level, linked, center };
}

type Point = { x: number; y: number };

/** Radius of the first ring: at least this, more when its full circles need the room. */
const FIRST_RING = 230;
/** Widest the first ring of full circles grows before they stagger over more rows. */
const MAX_CIRCLE_RING = 300;
/** Gap from the full-circle ring out to the first ring of dots. */
const FIRST_DOT_RING_GAP = 150;
/** Gap between rings of dots. */
const DOT_RING_GAP = 70;
/** Space a dot needs along its ring before the next one staggers outward. */
const DOT_SPACING = 28;
/** Space kept clear between the focus, its link-end circles and the first ring around them. */
const LINK_GAP = 16;
/** The ring of link-end circles grows to hold this many before they stack into more rows. */
const LINK_RING_WIDEST = 260;
const noPages: ReadonlySet<string> = new Set();

/**
 * Places the focus's link-end circles on rings around it, inside the first ring. Each circle keeps clear of
 * the focus, of the line from the focus to every page on the first ring (its parent and children) and of
 * its neighbours, so the angles those lines run at are skipped and the circles fill the gaps between them;
 * when the gaps on a ring are full the rest stack onto a ring outside it. `reach` is how far out the
 * outermost circle's edge sits.
 */
function layoutLinkEnds(
  ends: readonly KnowledgePagePayload[],
  center: string,
  positions: ReadonlyMap<string, Point>,
  firstRing: readonly string[],
  sizeOf: (page: KnowledgePagePayload) => number,
): { points: Map<string, Point>; reach: number } {
  const half = Math.max(...ends.map(page => sizeOf(page))) / 2;
  const blocked = firstRing.flatMap(id => {
    const at = positions.get(id);
    return at ? [Math.atan2(at.y, at.x)] : [];
  });
  const points = new Map<string, Point>();
  let remaining = [...ends];
  // The first ring starts clear of the focus, which draws a little larger than a circle of its own size.
  let radius = half * 2.5 + LINK_GAP;
  let reach = radius + half;
  for (let rows = 0; remaining.length && rows < 12; rows++) {
    // Angles on this ring that a line to the first ring passes through are off limits.
    const margin = Math.asin(Math.min(1, (half + LINK_GAP / 2) / radius));
    const step = 2 * Math.asin(Math.min(1, (half * 2 + LINK_GAP) / (2 * radius)));
    const gaps = blocked.length ? [...blocked].sort((a, b) => a - b) : [-Math.PI];
    const slots: number[] = [];
    gaps.forEach((from, index) => {
      const next = gaps[(index + 1) % gaps.length] as number;
      const start = from + margin;
      const end = (index + 1 < gaps.length ? next : next + 2 * Math.PI) - margin;
      for (let angle = start; angle <= end + 1e-9; angle += step) slots.push(angle);
    });
    const used = remaining.splice(0, Math.max(1, slots.length));
    used.forEach((page, index) => {
      // A ring with no gap left puts its one circle at angle 0; the next ring is wider, so it stays clear.
      const angle = slots[index] ?? slots[0] ?? 0;
      points.set(page.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    });
    reach = radius + half;
    radius += half * 2 + LINK_GAP;
  }
  return { points, reach };
}

/**
 * Places the focus at the centre and every other page on the ring for its depth, each page's children in
 * a slice of the circle taken out of its parent's slice, sized by how much hangs under each one (a full
 * circle counts for more than a dot). The focus's parent gets the slice at the top. Dots that don't fit
 * along their ring stagger outward in rows. Pages the walk never reached go on one outer ring, except
 * those in `near` (the focus's links), which sit on a ring close around the focus so they stay in view.
 */
export function radialLayout(
  pages: readonly KnowledgePagePayload[],
  shape: GraphShape,
  sizeOf: (page: KnowledgePagePayload) => number,
  near: ReadonlySet<string> = noPages,
): Map<string, Point> {
  const live = liveOnly(pages);
  const byId = new Map(live.map(page => [page.id, page]));
  // In the order the walk reached them, which graphShape keeps in position order: the input's order never matters.
  const kids = new Map<string | null, string[]>();
  for (const id of shape.depth.keys()) {
    if (!byId.has(id) || id === shape.center) continue;
    const from = shape.via.get(id) ?? null;
    kids.set(from, [...(kids.get(from) ?? []), id]);
  }
  const weight = new Map<string, number>();
  const weigh = (id: string): number => {
    const own = shape.form.get(id) === 'full' ? 4 : 1;
    const below = (kids.get(id) ?? []).reduce((sum, kid) => sum + weigh(kid), 0);
    const total = Math.max(own, below);
    weight.set(id, total);
    return total;
  };
  const firstRing = shape.center ? (kids.get(shape.center) ?? []) : (kids.get(null) ?? []);
  firstRing.forEach(weigh);

  // Ring radii: the first fits its full circles side by side; dot rings sit beyond it.
  // A ring of full circles is wide enough for them side by side; the ring after one leaves room for their size.
  const circleWidth = new Map<number, number>();
  for (const [id, at] of shape.depth) {
    const page = byId.get(id);
    if (!page || id === shape.center || shape.form.get(id) !== 'full') continue;
    circleWidth.set(at, (circleWidth.get(at) ?? 0) + sizeOf(page) + 30);
  }
  // Circles that would need a huge ring to sit side by side stagger over a few rows instead, so the
  // whole first level stays within reach of the centre at a readable zoom.
  const firstWidth = circleWidth.get(1) ?? 0;
  const ringRows = Math.max(1, Math.ceil(firstWidth / (2 * Math.PI * MAX_CIRCLE_RING)));
  const fullCount = [...shape.depth].filter(
    ([id, at]) => at === 1 && id !== shape.center && shape.form.get(id) === 'full' && byId.has(id),
  ).length;
  const rowStep = fullCount ? firstWidth / fullCount : 0;
  const radii = [0, Math.max(FIRST_RING, firstWidth / ringRows / (2 * Math.PI))];
  const radius = (at: number) => {
    while (radii.length <= at) {
      const next = radii.length;
      const last = radii[next - 1] as number;
      const gap = circleWidth.has(next - 1) && next > 1 ? FIRST_DOT_RING_GAP : DOT_RING_GAP;
      const outer = next === 2 ? (ringRows - 1) * rowStep : 0;
      radii.push(Math.max(last + gap + outer, (circleWidth.get(next) ?? 0) / (2 * Math.PI)));
    }
    return radii[at] as number;
  };
  let circleIndex = 0;

  const positions = new Map<string, Point>();
  const place = (ids: string[], at: number, start: number, span: number) => {
    const total = ids.reduce((sum, id) => sum + (weight.get(id) ?? 1), 0) || 1;
    // Dots that won't fit side by side along the arc stagger outward in rows.
    const dots = ids.filter(id => shape.form.get(id) !== 'full').length;
    const arc = span * radius(at);
    const perRow = Math.max(1, Math.floor(arc / DOT_SPACING));
    let angle = start;
    let dotIndex = 0;
    for (const id of ids) {
      const share = ((weight.get(id) ?? 1) / total) * span;
      const middle = angle + share / 2;
      const full = shape.form.get(id) === 'full';
      const row = full || dots <= perRow ? 0 : dotIndex % Math.ceil(dots / perRow);
      if (!full) dotIndex++;
      const r = radius(at) + (full && at === 1 ? (circleIndex++ % ringRows) * rowStep : row * DOT_SPACING);
      positions.set(id, { x: Math.cos(middle) * r, y: Math.sin(middle) * r });
      place(kids.get(id) ?? [], at + 1, angle, share);
      angle += share;
    }
  };
  // The first slice is centred at the top, where the focus's parent (always first) lands.
  const firstShare = firstRing.length
    ? ((weight.get(firstRing[0] as string) ?? 1) / firstRing.reduce((s, id) => s + (weight.get(id) ?? 1), 0)) *
      2 *
      Math.PI
    : 0;
  const run = () => {
    positions.clear();
    circleIndex = 0;
    if (shape.center) positions.set(shape.center, { x: 0, y: 0 });
    place(firstRing, 1, -Math.PI / 2 - firstShare / 2, 2 * Math.PI);
  };
  run();

  const unreached = live.filter(page => !positions.has(page.id)).sort((a, b) => (a.id < b.id ? -1 : 1));
  const close = unreached.filter(page => near.has(page.id) && shape.form.get(page.id) === 'full');
  const linkDots = unreached.filter(page => near.has(page.id) && shape.form.get(page.id) !== 'full');
  let linkRingReach = 0;
  const parentId = shape.center ? byId.get(shape.center)?.parentId : undefined;
  const hasChildren = firstRing.some(id => id !== parentId);
  if (close.length && shape.center && hasChildren) {
    // A focus with children keeps its ring to them: pages in other branches go on a ring beyond the
    // children and the dots under them, a link from the centre crossing that band to reach each one.
    const half = Math.max(...close.map(page => sizeOf(page))) / 2;
    let extent = 0;
    for (const [id, point] of positions) {
      const page = byId.get(id);
      if (page) extent = Math.max(extent, Math.hypot(point.x, point.y) + sizeOf(page) / 2);
    }
    const ring = Math.max(extent + LINK_GAP + half, (close.length * (half * 2 + LINK_GAP)) / (2 * Math.PI));
    // Start opposite the focus's parent, which sits at the top, and go round.
    close.forEach((page, index) => {
      const angle = Math.PI / 2 + (index / close.length) * 2 * Math.PI;
      positions.set(page.id, { x: Math.cos(angle) * ring, y: Math.sin(angle) * ring });
    });
    linkRingReach = ring + half;
  } else if (close.length && shape.center) {
    const linked = layoutLinkEnds(close, shape.center, positions, firstRing, sizeOf);
    // The first ring and everything beyond it make room for the circles inside it.
    const firstSize = Math.max(
      0,
      ...firstRing.filter(id => shape.form.get(id) === 'full').map(id => sizeOf(byId.get(id) as KnowledgePagePayload)),
    );
    radii.length = 2;
    radii[1] = Math.max(radii[1] as number, linked.reach + LINK_GAP + firstSize / 2);
    run();
    const relinked = layoutLinkEnds(close, shape.center, positions, firstRing, sizeOf);
    for (const [id, point] of relinked.points) positions.set(id, point);
  }
  const closeDots = linkDots;
  const closeRing = Math.min(175, Math.max(120, (closeDots.length * DOT_SPACING) / (2 * Math.PI)));
  closeDots.forEach((page, index) => {
    // Half a step off the top, where the focus's parent sits.
    const angle = Math.PI / 2 + (index / closeDots.length) * 2 * Math.PI;
    positions.set(page.id, { x: Math.cos(angle) * closeRing, y: Math.sin(angle) * closeRing });
  });
  const far = unreached.filter(page => !near.has(page.id));
  if (far.length) {
    const outer = Math.max(radius(radii.length), linkRingReach) + DOT_RING_GAP;
    far.forEach((page, index) => {
      const angle = -Math.PI / 2 + (index / far.length) * 2 * Math.PI;
      positions.set(page.id, { x: Math.cos(angle) * outer, y: Math.sin(angle) * outer });
    });
  }
  return positions;
}

/** Colours for the dots of each branch around the focus, in branch order. */
export const BRANCH_COLORS = [
  'var(--chart-blue)',
  'var(--chart-green)',
  'var(--chart-amber)',
  'var(--chart-pink)',
  'var(--chart-cyan)',
  'var(--chart-orange)',
  'var(--chart-purple)',
  'var(--chart-red)',
];

/** One colour per branch, in the order the branches sit around the focus. */
export function branchColors(pages: readonly KnowledgePagePayload[], shape: GraphShape): Map<string, string> {
  const order: string[] = [];
  for (const page of pages) {
    const own = shape.branch.get(page.id);
    if (own && !order.includes(own)) order.push(own);
  }
  return new Map(order.map((id, index) => [id, BRANCH_COLORS[index % BRANCH_COLORS.length] as string]));
}

/** Framing never zooms out past this, so circle names stay readable; a bigger graph is panned, not shrunk. */
export const READABLE_MIN_ZOOM = 0.7;
/** Children a drawn page shows at most; the rest are counted, not drawn. */
export const GRAPH_CHILD_CAP = 48;
/** How many more children a click on a "+N more" circle draws. */
export const REST_BATCH = 12;
/** Stand-in dots drawn at most for a page whose children haven't loaded yet. */
export const PLACEHOLDER_CAP = 8;
/** Most circles whose children are loaded just to draw them as dots around it. */
export const WANTED_CIRCLE_CAP = 24;
/** Roots drawn beside the root at the centre when nothing is focused. */
export const SIBLING_ROOT_CAP = 8;
/** Children around a page that fit at full size; past this the circles shrink to make room. */
export const CROWD_START = 16;
/** Smallest a crowded ring's circles shrink to, as a fraction of their usual size. */
export const CROWD_MIN_SCALE = 0.7;

/** How much to shrink each of `count` circles sharing a ring, so a page with dozens of children still fits. */
export function crowdScale(count: number): number {
  if (count <= CROWD_START) return 1;
  return Math.max(CROWD_MIN_SCALE, Math.sqrt(CROWD_START / count));
}

/** Sibling scopes of one type (e.g. `thread`) collapse into one circle from this many. */
export const SCOPE_GROUP_MIN = 3;

const nobody = { author: '' };

function syntheticPage(id: string, parent: KnowledgePagePayload, fields: Partial<KnowledgePagePayload>) {
  return {
    id,
    scopeId: parent.scopeId,
    parentId: parent.id,
    isScope: false,
    position: '',
    name: '',
    version: 0,
    createdBy: nobody,
    updatedBy: nobody,
    createdAt: '',
    updatedAt: '',
    ...fields,
  } satisfies KnowledgePagePayload;
}

/** The type part of a scope address (`thread` in `thread:abc`), or `null` for a page or an untyped scope. */
function scopeType(page: KnowledgePagePayload): string | null {
  if (!page.isScope || !page.address) return null;
  const colon = page.address.indexOf(':');
  return colon > 0 ? page.address.slice(0, colon) : null;
}

export interface LazyGraphInput {
  /** Every page loaded so far (tree levels, the focused page's path), live or not. */
  pages: readonly KnowledgePagePayload[];
  /** Parents whose first level of children has loaded; `rootKey` stands for the root scopes. */
  loadedParents: ReadonlySet<string>;
  rootKey: string;
  focusId: string | null;
  /** Scope groups the user opened, by group id. */
  openGroups: ReadonlySet<string>;
  /** Children drawn past the cap, per parent: what clicks on its "+N more" circle have revealed. */
  revealed?: ReadonlyMap<string, number>;
  cap?: number;
}

export interface LazyGraph {
  pages: KnowledgePagePayload[];
  /** Per drawn page whose children have loaded: how many of them are drawn and how many are not. */
  hiddenChildren: Map<string, { hidden: number; drawn: number }>;
  /** Pages the graph wants the next level of: the focus and its parent, or the roots with no focus. */
  wanted: string[];
  /** The page the layout centres on: the focus, or with nothing focused the first root scope. */
  hub: string | null;
}

/**
 * What a lazily loaded graph draws: the focus (or the root scopes), everything within two parent links
 * of it, and the focus's path up to its root. A page's children are capped; sibling scopes of one type
 * past {@link SCOPE_GROUP_MIN} collapse into one group circle unless opened (never under the focus
 * itself); a full-circle page whose children haven't loaded gets stand-in dots, one per child up to
 * {@link PLACEHOLDER_CAP}.
 */
export function lazyGraph(input: LazyGraphInput): LazyGraph {
  const cap = input.cap ?? GRAPH_CHILD_CAP;
  const live = liveOnly(input.pages);
  const byId = new Map(live.map(page => [page.id, page]));
  const children = new Map<string, KnowledgePagePayload[]>();
  const roots: KnowledgePagePayload[] = [];
  for (const page of live) {
    const parent = page.parentId && page.parentId !== page.id ? page.parentId : null;
    if (!parent) roots.push(page);
    else children.set(parent, [...(children.get(parent) ?? []), page]);
  }
  for (const list of children.values()) list.sort(comparePagePosition);
  roots.sort(comparePagePosition);

  const focus = input.focusId ? byId.get(input.focusId) : undefined;
  const drawn = new Map<string, KnowledgePagePayload>();
  const hiddenChildren = new Map<string, { hidden: number; drawn: number }>();
  const depth = new Map<string, number>();
  const queue: string[] = [];
  const add = (page: KnowledgePagePayload, at: number) => {
    if (depth.has(page.id)) return;
    depth.set(page.id, at);
    drawn.set(page.id, page);
    queue.push(page.id);
  };
  // With nothing focused the first root scope is the hub, drawn exactly as a focused scope is; the other
  // roots sit beside its children.
  const center = focus ?? roots[0];
  // Pages one level out that draw as circles too, with their own children drawn as dots.
  const rootCircleIds = promotedCircles(children, center);
  if (center) add(center, 0);
  if (center && !focus) for (const root of roots.slice(1, 1 + SIBLING_ROOT_CAP)) add(root, 1);
  // The path up from the focus, however far, so it is clear where the focus sits.
  for (let up = focus?.parentId ? byId.get(focus.parentId) : undefined, at = 1; up; at++) {
    if (!depth.has(up.id)) add(up, at);
    up = up.parentId && up.parentId !== up.id ? byId.get(up.parentId) : undefined;
  }

  while (queue.length) {
    const id = queue.shift() as string;
    const page = drawn.get(id) as KnowledgePagePayload;
    const at = depth.get(id) as number;
    if (at >= 3 || (at === 2 && !rootCircleIds.has(id))) continue;
    const parent = page.parentId ? byId.get(page.parentId) : undefined;
    if (parent) add(parent, at + 1);
    const kids = children.get(id) ?? [];
    if (!input.loadedParents.has(id)) {
      const count = page.childCount ?? 0;
      const stand = Math.min(count, PLACEHOLDER_CAP);
      for (let index = 0; index < stand; index++) {
        const placeholder = syntheticPage(`${PLACEHOLDER_PREFIX}${id}:${index}`, page, {
          name: `${page.childCountCapped ? `${count}+` : count} ${count === 1 ? 'page' : 'pages'} under ${page.name}`,
        });
        drawn.set(placeholder.id, placeholder);
        depth.set(placeholder.id, at + 1);
      }
      if (!kids.length) continue;
    }
    // Sibling scopes of one type collapse into a group circle, except under the focus.
    const byType = new Map<string, KnowledgePagePayload[]>();
    for (const kid of kids) {
      const type = scopeType(kid);
      if (type) byType.set(type, [...(byType.get(type) ?? []), kid]);
    }
    const grouped = new Set<string>();
    if (id !== center?.id) {
      for (const [type, members] of byType) {
        const groupId = `${GROUP_PREFIX}${id}:${type}`;
        if (members.length < SCOPE_GROUP_MIN || input.openGroups.has(groupId)) continue;
        for (const member of members) grouped.add(member.id);
        const group = syntheticPage(groupId, page, {
          isScope: true,
          address: `${type}:*`,
          displayLabel: `${type} scopes`,
          name: `${members.length} ${type} scopes`,
          childCount: members.length,
        });
        drawn.set(group.id, group);
        depth.set(group.id, at + 1);
      }
    }
    const shown = kids.filter(kid => !grouped.has(kid.id));
    let drawnKids = 0;
    for (const kid of shown) {
      if (depth.has(kid.id)) {
        drawnKids++;
        continue;
      }
      if (drawnKids >= cap + (input.revealed?.get(id) ?? 0)) break;
      add(kid, at + 1);
      drawnKids++;
    }
    if (input.loadedParents.has(id)) {
      const total = Math.max(page.childCount ?? kids.length, kids.length);
      const hidden = Math.max(0, total - drawnKids - grouped.size);
      hiddenChildren.set(id, { hidden, drawn: drawnKids });
      if (hidden > 0 && id === center?.id) {
        const rest = syntheticPage(`${REST_PREFIX}${id}`, page, {
          name: `+${page.childCountCapped ? `${total}+` : hidden} more`,
          childCount: hidden,
        });
        drawn.set(rest.id, rest);
        depth.set(rest.id, at + 1);
      }
    }
  }

  const wanted = focus
    ? [focus.id, ...(focus.parentId && focus.parentId !== focus.id ? [focus.parentId] : [])]
    : roots.map(root => root.id);
  // One level beyond the circles: the children of the pages drawn as circles, so their own children show as dots.
  const circles = [...depth]
    .filter(([id, at]) => (at <= 1 || rootCircleIds.has(id)) && !wanted.includes(id))
    .map(([id]) => drawn.get(id) as KnowledgePagePayload)
    .filter(
      page => (page.childCount ?? 0) > 0 && !isScopeGroup(page) && !isChildPlaceholder(page) && !isRestCircle(page),
    );
  wanted.push(...circles.slice(0, WANTED_CIRCLE_CAP).map(page => page.id));
  return { pages: [...drawn.values()], hiddenChildren, wanted, hub: center?.id ?? null };
}
