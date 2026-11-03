export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface EdgeOffset {
  /** Signed distance in px from the centre line, measured against the pair's fixed direction. */
  offset: number;
  /** The edge runs against the pair's fixed direction, so its own left is the other way. */
  reversed: boolean;
}

/** Gap between two lines drawn between the same pair of pages. */
export const PARALLEL_EDGE_GAP = 10;

const NONE: EdgeOffset = { offset: 0, reversed: false };

/**
 * Edges that share a pair of pages (links both ways, a link plus a parent line, a grant) would be drawn on
 * top of each other, the last one hiding the rest. Each gets its own slot either side of the centre line;
 * a pair with a single edge keeps offset 0.
 */
export function edgeOffsets(edges: { id: string; source: string; target: string }[]): Map<string, EdgeOffset> {
  const pairs = new Map<string, { id: string; reversed: boolean }[]>();
  for (const edge of edges) {
    const reversed = edge.source > edge.target;
    const key = reversed ? `${edge.target}\u0000${edge.source}` : `${edge.source}\u0000${edge.target}`;
    const group = pairs.get(key);
    if (group) group.push({ id: edge.id, reversed });
    else pairs.set(key, [{ id: edge.id, reversed }]);
  }
  const offsets = new Map<string, EdgeOffset>();
  for (const group of pairs.values()) {
    group.forEach(({ id, reversed }, index) => {
      offsets.set(
        id,
        group.length === 1 ? NONE : { offset: (index - (group.length - 1) / 2) * PARALLEL_EDGE_GAP, reversed },
      );
    });
  }
  return offsets;
}

/**
 * A straight line from one circle's rim to the other's, so lines never loop or hide behind circles. A
 * non-zero offset slides it sideways; its ends stay on the rims (the gap beyond them is where arrowheads sit).
 */
export function rimToRim(from: Circle, to: Circle, { offset, reversed }: EdgeOffset = NONE, gap = 3) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const side = reversed ? -offset : offset;
  const nx = -uy * side;
  const ny = ux * side;
  const reach = (r: number) => Math.sqrt(Math.max((r + gap) ** 2 - side ** 2, 0));
  const fromReach = reach(from.r);
  const toReach = reach(to.r);
  return {
    x1: from.x + nx + ux * fromReach,
    y1: from.y + ny + uy * fromReach,
    x2: to.x + nx - ux * toReach,
    y2: to.y + ny - uy * toReach,
  };
}
