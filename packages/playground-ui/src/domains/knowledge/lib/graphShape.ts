/**
 * The graph's shape around one focused page: how far each page sits from the focus along parent links,
 * which pages draw as full labelled circles and which as small dots, and where each one goes on a
 * radial layout. Pure, so the depth rule and the layout are unit-tested without React Flow.
 */

import type { KnowledgePagePayload } from '../pageTypes';
import { comparePagePosition } from './pageTree';

/** Full circles carry a label; dots are small coloured markers that name themselves on hover. */
export type GraphNodeForm = 'full' | 'dot';

/** Pages at most this many parent links from the focus draw as full circles. */
export const FULL_CIRCLE_DEPTH = 1;
/** A dot's diameter. */
export const KNOWLEDGE_DOT_SIZE = 14;

const PLACEHOLDER_PREFIX = 'more:';
const GROUP_PREFIX = 'group:';

/** A stand-in dot for a child that hasn't loaded yet; `parentId` is the page whose children it stands for. */
export function isChildPlaceholder(page: Pick<KnowledgePagePayload, 'id'>): boolean {
  return page.id.startsWith(PLACEHOLDER_PREFIX);
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
  /** The page the layout centres on; `null` when several root scopes share the centre. */
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
 * roots count as one link from the centre, unless there is only one root, which then becomes the centre.
 */
export function graphShape(pages: readonly KnowledgePagePayload[], focusId: string | null): GraphShape {
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

  const center = focusId && byId.has(focusId) ? focusId : roots.length === 1 ? (roots[0]?.id ?? null) : null;
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
  }

  const form = new Map<string, GraphNodeForm>();
  for (const page of live) {
    const at = depth.get(page.id);
    form.set(page.id, at !== undefined && at <= FULL_CIRCLE_DEPTH && !isChildPlaceholder(page) ? 'full' : 'dot');
  }
  return { depth, form, branch, via, center };
}

type Point = { x: number; y: number };

/** Radius of the first ring: at least this, more when its full circles need the room. */
const FIRST_RING = 230;
/** Gap from the full-circle ring out to the first ring of dots. */
const FIRST_DOT_RING_GAP = 150;
/** Gap between rings of dots. */
const DOT_RING_GAP = 70;
/** Space a dot needs along its ring before the next one staggers outward. */
const DOT_SPACING = 22;

/**
 * Places the focus at the centre and every other page on the ring for its depth, each page's children in
 * a slice of the circle taken out of its parent's slice, sized by how much hangs under each one (a full
 * circle counts for more than a dot). The focus's parent gets the slice at the top. Dots that don't fit
 * along their ring stagger outward in rows. Pages the walk never reached go on one outer ring.
 */
export function radialLayout(
  pages: readonly KnowledgePagePayload[],
  shape: GraphShape,
  sizeOf: (page: KnowledgePagePayload) => number,
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
  const firstSizes = firstRing.reduce((sum, id) => sum + sizeOf(byId.get(id) as KnowledgePagePayload) + 30, 0);
  const radii = [0, Math.max(FIRST_RING, firstSizes / (2 * Math.PI))];
  const radius = (at: number) => {
    while (radii.length <= at) {
      const last = radii[radii.length - 1] as number;
      radii.push(last + (radii.length === 2 ? FIRST_DOT_RING_GAP : DOT_RING_GAP));
    }
    return radii[at] as number;
  };

  const positions = new Map<string, Point>();
  if (shape.center) positions.set(shape.center, { x: 0, y: 0 });
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
      const r = radius(at) + row * DOT_SPACING;
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
  place(firstRing, 1, -Math.PI / 2 - firstShare / 2, 2 * Math.PI);

  const unreached = live.filter(page => !positions.has(page.id)).sort((a, b) => (a.id < b.id ? -1 : 1));
  if (unreached.length) {
    const outer = radius(radii.length) + DOT_RING_GAP;
    unreached.forEach((page, index) => {
      const angle = -Math.PI / 2 + (index / unreached.length) * 2 * Math.PI;
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

/** Children a drawn page shows at most; the rest are counted, not drawn. */
export const GRAPH_CHILD_CAP = 24;
/** Stand-in dots drawn at most for a page whose children haven't loaded yet. */
export const PLACEHOLDER_CAP = 8;
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
  cap?: number;
}

export interface LazyGraph {
  pages: KnowledgePagePayload[];
  /** Per drawn page whose children have loaded: how many of them are drawn and how many are not. */
  hiddenChildren: Map<string, { hidden: number; drawn: number }>;
  /** Pages the graph wants the next level of: the focus and its parent, or the roots with no focus. */
  wanted: string[];
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
  const center = focus ?? (roots.length === 1 ? roots[0] : undefined);
  if (center) add(center, 0);
  else for (const root of roots) add(root, 1);
  // The path up from the focus, however far, so it is clear where the focus sits.
  for (let up = focus?.parentId ? byId.get(focus.parentId) : undefined, at = 1; up; at++) {
    if (!depth.has(up.id)) add(up, at);
    up = up.parentId && up.parentId !== up.id ? byId.get(up.parentId) : undefined;
  }

  while (queue.length) {
    const id = queue.shift() as string;
    const page = drawn.get(id) as KnowledgePagePayload;
    const at = depth.get(id) as number;
    if (at >= 2) continue;
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
    if (id !== focus?.id) {
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
      if (drawnKids >= cap) break;
      add(kid, at + 1);
      drawnKids++;
    }
    if (input.loadedParents.has(id)) {
      const total = Math.max(page.childCount ?? kids.length, kids.length);
      hiddenChildren.set(id, { hidden: Math.max(0, total - drawnKids - grouped.size), drawn: drawnKids });
    }
  }

  const wanted = focus
    ? [focus.id, ...(focus.parentId && focus.parentId !== focus.id ? [focus.parentId] : [])]
    : center
      ? [center.id]
      : roots.map(root => root.id);
  return { pages: [...drawn.values()], hiddenChildren, wanted };
}
