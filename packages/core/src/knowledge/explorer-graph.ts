import type { KnowledgeNode, KnowledgeRecord, KnowledgeScope, KnowledgeStorage } from '../storage';
import { canonicalizeKnowledgeScope, knowledgeScopeKey, parseKnowledgeWikilinks } from '../storage';
import { knowledgeExplorerRung } from './explorer';
import type { KnowledgeExplorerRung } from './explorer';
import { listPinnedKnowledge } from './pinned';

/**
 * Read-only graph windows over one Knowledge instance. A window is a bounded set of content nodes, their records
 * (newest first) and the wikilink edges between them; pins accent nodes (one target) or edges (several).
 *
 * @experimental Knowledge APIs are experimental and may change without notice.
 */

export interface KnowledgeGraphLimits {
  /** Max nodes in a graph snapshot (newest-first). */
  maxNodes: number;
  /** Max records parsed for edges per snapshot (newest-first). */
  maxRecords: number;
  /** Max fallback `resolveNode` store lookups per request (deduped per unique name+scope). */
  maxFallbackLookups: number;
}

export const DEFAULT_KNOWLEDGE_GRAPH_LIMITS: KnowledgeGraphLimits = {
  maxNodes: 200,
  maxRecords: 600,
  maxFallbackLookups: 200,
};

/** Hover-card budget for record text shipped in the graph payload. */
const RECORD_TEXT_LIMIT = 240;

export function truncateKnowledgeRecordText(text: string): string {
  return text.length > RECORD_TEXT_LIMIT ? `${text.slice(0, RECORD_TEXT_LIMIT - 1)}…` : text;
}

export interface KnowledgeGraphNodePayload {
  id: string;
  name: string;
  kind: string;
  description?: string;
  /** Null for structural scope-node members (global, not identity-scoped). */
  scope: KnowledgeScope | null;
  rung: KnowledgeExplorerRung | null;
  isScope?: boolean;
  /** A pin whose wikilinks reference only this node accents it; multi-target pins accent their edges. */
  pinned: boolean;
  /** Records owned by this node inside the window (not a total). */
  recordCount: number;
  memberCount?: number;
  memberCountTruncated?: boolean;
  contentNodeCount?: number;
  childScopeCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeGraphEdgePayload {
  id: string;
  source: string;
  target: string;
  type: 'wikilink' | 'contains';
  recordId?: string;
  pinned?: boolean;
}

export interface KnowledgeGraphRecordPayload {
  id: string;
  /** Owner node first (omitted for pins), then resolved wikilink targets. */
  nodeIds: string[];
  pinned: boolean;
  text: string;
}

export interface KnowledgeGraphWindowPayload {
  nodes: KnowledgeGraphNodePayload[];
  edges: KnowledgeGraphEdgePayload[];
  records: KnowledgeGraphRecordPayload[];
  /** True when the node or record window cap was hit (newest-first window). */
  truncated: boolean;
  /** Authorized wikilink targets outside the node window. */
  outOfWindow: Array<{ id: string; name: string; scope: KnowledgeScope; rung: KnowledgeExplorerRung }>;
  /** Unique unknown names skipped once the fallback-lookup cap was hit. */
  unresolvedCapped: { count: number; names: string[] };
  /** Pin counts per rung. */
  pinCensus: { resource: number; thread: number };
  /** Change hint: newest knowledge activity id. */
  version: string | null;
}

export interface KnowledgeGraphPins {
  nodeIds: string[];
  records: Array<{ rung: 'resource' | 'thread'; record: KnowledgeRecord }>;
}

/** The pins a scope sees, labeled session (`thread`) when they carry a session tag, otherwise project (`resource`). */
export async function loadKnowledgePins(store: KnowledgeStorage, scope: KnowledgeScope): Promise<KnowledgeGraphPins> {
  const { nodeIds, pins } = await listPinnedKnowledge({ store, scope });
  return {
    nodeIds,
    records: pins.map(record => ({
      rung: knowledgeExplorerRung(record.scope) === 'thread' ? ('thread' as const) : ('resource' as const),
      record,
    })),
  };
}

/**
 * Wikilink resolution for graph windows: exact (scope, name) matches inside the fetched window first, walking the
 * record's scope prefixes, then a bounded, deduped storage lookup. An edge never depends on whether the target
 * landed in the window.
 */
export class KnowledgeWikilinkResolver {
  /** exact `${scopeKey}\u0000${lowerName}` → node, from the fetched window. */
  readonly #inWindow = new Map<string, KnowledgeNode>();
  readonly #windowIds = new Set<string>();
  /** `${recordScopeKey}\u0000${lowerName}` → fallback result (null = dangling). */
  readonly #fallbackCache = new Map<string, KnowledgeNode | null>();
  #fallbackLookups = 0;
  readonly #store: KnowledgeStorage;
  readonly #maxFallbackLookups: number;
  readonly outOfWindow = new Map<
    string,
    { id: string; name: string; scope: KnowledgeScope; rung: KnowledgeExplorerRung }
  >();
  readonly cappedNames: string[] = [];
  #cappedSeen = new Set<string>();

  constructor(store: KnowledgeStorage, nodes: KnowledgeNode[], maxFallbackLookups: number) {
    this.#store = store;
    this.#maxFallbackLookups = maxFallbackLookups;
    for (const node of nodes) {
      this.#inWindow.set(`${knowledgeScopeKey(node.scope)}\u0000${node.name.trim().toLocaleLowerCase()}`, node);
      this.#windowIds.add(node.id);
    }
  }

  inWindowId(id: string): boolean {
    return this.#windowIds.has(id);
  }

  /** Resolve a wikilink name from a knowledge record's scope. Returns the node or null (dangling/capped). */
  async resolve(name: string, recordScope: KnowledgeScope): Promise<KnowledgeNode | null> {
    const canonical = canonicalizeKnowledgeScope(recordScope);
    const lower = name.trim().toLocaleLowerCase();
    for (let length = canonical.length; length > 0; length--) {
      const hit = this.#inWindow.get(`${knowledgeScopeKey(canonical.slice(0, length))}\u0000${lower}`);
      if (hit) return hit;
    }
    const cacheKey = `${knowledgeScopeKey(canonical)}\u0000${lower}`;
    if (this.#fallbackCache.has(cacheKey)) {
      return this.#trackOutOfWindow(this.#fallbackCache.get(cacheKey) ?? null);
    }
    if (this.#fallbackLookups >= this.#maxFallbackLookups) {
      if (!this.#cappedSeen.has(lower) && this.cappedNames.length < 100) {
        this.#cappedSeen.add(lower);
        this.cappedNames.push(name.trim());
      } else if (!this.#cappedSeen.has(lower)) {
        this.#cappedSeen.add(lower);
      }
      return null;
    }
    this.#fallbackLookups += 1;
    let resolved: KnowledgeNode | null = null;
    try {
      resolved = await this.#store.resolveNode({ name, scope: canonical });
    } catch {
      resolved = null;
    }
    this.#fallbackCache.set(cacheKey, resolved);
    return this.#trackOutOfWindow(resolved);
  }

  #trackOutOfWindow(node: KnowledgeNode | null): KnowledgeNode | null {
    if (node && !this.#windowIds.has(node.id)) {
      this.outOfWindow.set(node.id, {
        id: node.id,
        name: node.name,
        scope: node.scope,
        rung: knowledgeExplorerRung(node.scope),
      });
    }
    return node;
  }

  get cappedCount(): number {
    return this.#cappedSeen.size;
  }
}

export interface KnowledgeGraphWindow {
  edges: KnowledgeGraphEdgePayload[];
  records: KnowledgeGraphRecordPayload[];
  recordCounts: Map<string, number>;
  /** Nodes a single-target pin accents. */
  accented: Set<string>;
  /** True when the record cap cut the window. */
  recordsTruncated: boolean;
  resolver: KnowledgeWikilinkResolver;
}

/**
 * Records for `nodes` (newest first, capped), the wikilink edges between nodes in the window, and the pins that
 * accent them. `recordScope` is the scope each node's records are read with.
 */
export async function windowKnowledgeGraph(
  store: KnowledgeStorage,
  input: {
    nodes: KnowledgeNode[];
    recordScope: (node: KnowledgeNode) => KnowledgeScope;
    pinned?: KnowledgeGraphPins['records'];
    limits: Pick<KnowledgeGraphLimits, 'maxRecords' | 'maxFallbackLookups'>;
  },
): Promise<KnowledgeGraphWindow> {
  const { nodes, limits } = input;
  const recordWindow: KnowledgeRecord[] = [];
  for (const node of nodes) {
    if (recordWindow.length > limits.maxRecords) break;
    const { records } = await store.listKnowledgeAbout({
      node: node.id,
      scope: input.recordScope(node),
      limit: limits.maxRecords + 1 - recordWindow.length,
    });
    recordWindow.push(...records);
  }
  // Record ids are ULIDs — descending id = newest-first.
  recordWindow.sort((a, b) => b.id.localeCompare(a.id));
  let recordsTruncated = false;
  if (recordWindow.length > limits.maxRecords) {
    recordsTruncated = true;
    recordWindow.length = limits.maxRecords;
  }

  const resolver = new KnowledgeWikilinkResolver(store, nodes, limits.maxFallbackLookups);
  const edges: KnowledgeGraphEdgePayload[] = [];
  const records: KnowledgeGraphRecordPayload[] = [];
  const edgeSeen = new Set<string>();
  const recordCounts = new Map<string, number>();
  for (const record of recordWindow) {
    recordCounts.set(record.node, (recordCounts.get(record.node) ?? 0) + 1);
    const nodeIds = [record.node];
    for (const name of parseKnowledgeWikilinks(record.text)) {
      const target = await resolver.resolve(name, record.scope);
      if (!target) continue;
      if (target.id === record.node) continue;
      if (!resolver.inWindowId(target.id)) continue;
      if (!nodeIds.includes(target.id)) nodeIds.push(target.id);
      const key = `${record.node}\u0000${target.id}`;
      if (edgeSeen.has(key)) continue;
      edgeSeen.add(key);
      edges.push({
        id: `wikilink:${record.node}:${target.id}`,
        source: record.node,
        target: target.id,
        type: 'wikilink',
        recordId: record.id,
      });
    }
    records.push({ id: record.id, nodeIds, pinned: false, text: truncateKnowledgeRecordText(record.text) });
  }

  // Pins mark relationships. The reserved owner node is omitted, so arity comes purely from wikilink targets.
  const accented = new Set<string>();
  for (const { record } of input.pinned ?? []) {
    const targets: string[] = [];
    for (const name of parseKnowledgeWikilinks(record.text)) {
      const target = await resolver.resolve(name, record.scope);
      if (target && resolver.inWindowId(target.id) && !targets.includes(target.id)) targets.push(target.id);
    }
    records.push({ id: record.id, nodeIds: targets, pinned: true, text: truncateKnowledgeRecordText(record.text) });
    if (targets.length === 1) {
      accented.add(targets[0]!);
      continue;
    }
    for (let a = 0; a < targets.length; a += 1) {
      for (let b = a + 1; b < targets.length; b += 1) {
        const key = `${targets[a]}\u0000${targets[b]}\u0000pin`;
        if (edgeSeen.has(key)) continue;
        edgeSeen.add(key);
        edges.push({
          id: `pin:${record.id}:${targets[a]}:${targets[b]}`,
          source: targets[a]!,
          target: targets[b]!,
          type: 'wikilink',
          recordId: record.id,
          pinned: true,
        });
      }
    }
  }
  return { edges, records, recordCounts, accented, recordsTruncated, resolver };
}

/**
 * The graph a viewer sees from `scope`: content nodes (newest first, pins' reserved owner excluded), their
 * records and wikilink edges, pins accenting nodes and edges. Structural scope-node members are not included.
 * `pins` is read from the store when omitted; pass `false` to ignore pins.
 */
export async function readKnowledgeGraph(
  store: KnowledgeStorage,
  scope: KnowledgeScope,
  options: { limits?: KnowledgeGraphLimits; pins?: KnowledgeGraphPins | false } = {},
): Promise<KnowledgeGraphWindowPayload> {
  const limits = options.limits ?? DEFAULT_KNOWLEDGE_GRAPH_LIMITS;
  // Nodes, newest-first; +1 to detect truncation. SQL adapters return global scope nodes (scope: null) from
  // identity-scope reads — they are surfaced by the scope tree, so exclude them before truncation.
  const fetched = (await store.listNodes({ scope, limit: limits.maxNodes + 1 })).filter(node =>
    Array.isArray(node.scope),
  );
  const pins =
    options.pins === false ? { nodeIds: [], records: [] } : (options.pins ?? (await loadKnowledgePins(store, scope)));
  const pinnedNodeIds = new Set(pins.nodeIds);
  const nodes = fetched.slice(0, limits.maxNodes).filter(node => !pinnedNodeIds.has(node.id));

  const window = await windowKnowledgeGraph(store, {
    nodes,
    recordScope: () => scope,
    pinned: pins.records,
    limits,
  });
  const activity = await store.listActivity({ scope, limit: 1 });
  return {
    nodes: nodes.map(node => ({
      id: node.id,
      name: node.name,
      kind: node.kind,
      // Empty string is a curator clear — omit it so the payload carries no dead keys.
      ...(node.description ? { description: node.description } : {}),
      scope: node.scope,
      rung: knowledgeExplorerRung(node.scope),
      pinned: window.accented.has(node.id),
      recordCount: window.recordCounts.get(node.id) ?? 0,
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
    })),
    edges: window.edges,
    records: window.records,
    truncated: fetched.length > limits.maxNodes || window.recordsTruncated,
    outOfWindow: [...window.resolver.outOfWindow.values()],
    unresolvedCapped: { count: window.resolver.cappedCount, names: window.resolver.cappedNames },
    pinCensus: {
      resource: pins.records.filter(p => p.rung === 'resource').length,
      thread: pins.records.filter(p => p.rung === 'thread').length,
    },
    version: activity[0]?.id ?? null,
  };
}
