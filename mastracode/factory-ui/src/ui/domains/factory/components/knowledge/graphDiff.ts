/**
 * Client-side arrival diffing for the live knowledge graph: each poll's
 * payload is compared against the previous one (same view only) and new
 * node/edge ids get an arrival animation. Switching views (project ↔ thread,
 * or between threads) resets the baseline so the swap renders as a fresh
 * layout instead of a mass "arrival" (Amendment A2).
 */

export interface DiffBaseline {
  /** Identifies the view: `project` or `thread:<id>` — baselines never cross views. */
  viewKey: string;
  version: string | null;
  nodeIds: ReadonlySet<string>;
  edgeIds: ReadonlySet<string>;
}

export interface DiffInput {
  viewKey: string;
  version: string | null;
  nodeIds: ReadonlySet<string>;
  edgeIds: ReadonlySet<string>;
}

export interface Arrivals {
  nodes: ReadonlySet<string>;
  edges: ReadonlySet<string>;
}

const NO_ARRIVALS: Arrivals = { nodes: new Set(), edges: new Set() };

export function computeArrivals(previous: DiffBaseline | null, next: DiffInput): Arrivals {
  // First payload or a view switch: fresh baseline, nothing "arrives".
  if (!previous || previous.viewKey !== next.viewKey) return NO_ARRIVALS;
  // Version cursor short-circuit: nothing changed server-side. The cursor is a
  // hint only (per-process monotonic) — equal versions mean skip, but unequal
  // versions still diff by id sets, never by the cursor itself.
  if (previous.version !== null && previous.version === next.version) return NO_ARRIVALS;
  const nodes = new Set<string>();
  for (const id of next.nodeIds) if (!previous.nodeIds.has(id)) nodes.add(id);
  const edges = new Set<string>();
  for (const id of next.edgeIds) if (!previous.edgeIds.has(id)) edges.add(id);
  if (nodes.size === 0 && edges.size === 0) return NO_ARRIVALS;
  return { nodes, edges };
}

