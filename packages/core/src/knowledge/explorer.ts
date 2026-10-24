import type {
  KnowledgeActivityEvent,
  KnowledgeNode,
  KnowledgeRecord,
  KnowledgeScope,
  KnowledgeStorage,
} from '../storage';
import {
  canonicalizeKnowledgeScope,
  createKnowledgeNodeCursor,
  isKnowledgeScopeVisible,
  parseKnowledgeWikilinks,
} from '../storage';
import { listPinnedKnowledge, PINNED_NODE_NAME } from './pinned';

/**
 * Read-only views over one Knowledge instance for browsing UIs (Mastra Studio).
 *
 * Every read takes a **view**: the set of scope tags the viewer holds. Knowledge shows a record when all of its
 * tags are in the view, so the view decides what is visible. These functions never write.
 *
 * @experimental Knowledge APIs are experimental and may change without notice.
 */

export interface KnowledgeExplorerLimits {
  /** Content nodes in one graph window. */
  maxNodes: number;
  /** Records in one graph window. */
  maxRecords: number;
  /** Distinct wikilink names resolved outside the window per graph. */
  maxLookups: number;
  /** Characters of record text shipped in a graph payload. */
  recordTextLimit: number;
}

export const DEFAULT_KNOWLEDGE_EXPLORER_LIMITS: KnowledgeExplorerLimits = {
  maxNodes: 200,
  maxRecords: 600,
  maxLookups: 200,
  recordTextLimit: 240,
};

export type KnowledgeExplorerRung = 'org' | 'resource' | 'thread';

export interface KnowledgeExplorerGraphNode {
  id: string;
  name: string;
  kind: string;
  description?: string;
  scope: string[] | null;
  rung: KnowledgeExplorerRung | null;
  /** A single-target pin references this node. */
  pinned: boolean;
  recordCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeExplorerGraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'wikilink';
  recordId?: string;
  /** Derived from a multi-target pin. */
  pinned?: boolean;
}

export interface KnowledgeExplorerGraphRecord {
  id: string;
  nodeIds: string[];
  pinned: boolean;
  text: string;
}

export interface KnowledgeExplorerGraph {
  view: string[];
  nodes: KnowledgeExplorerGraphNode[];
  edges: KnowledgeExplorerGraphEdge[];
  records: KnowledgeExplorerGraphRecord[];
  truncated: boolean;
  pinCount: number;
}

export interface KnowledgeExplorerNodeRecord {
  id: string;
  node: string;
  relation: 'owned' | 'mentions';
  text: string;
  scope: string[];
  rung: KnowledgeExplorerRung;
  sourceThreadId: string;
  capturedAt: string;
  when?: string;
  pinned: boolean;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeExplorerNode {
  node: {
    id: string;
    name: string;
    kind: string;
    content: string;
    description?: string;
    scope: string[];
    rung: KnowledgeExplorerRung;
    createdAt: string;
    updatedAt: string;
  };
  records: KnowledgeExplorerNodeRecord[];
}

export interface KnowledgeExplorerSearchResult {
  id: string;
  name: string;
  kind: string;
  type: 'node';
  rung: KnowledgeExplorerRung | null;
}

export interface KnowledgeExplorerActivityEvent {
  id: string;
  action: string;
  recordType: string;
  recordId?: string;
  scope: string[];
  node: { id: string; name: string; rung: KnowledgeExplorerRung };
  createdAt: string;
}

/** The tag set a view is made of: canonical, deduplicated, and within the storage cap. Throws when invalid. */
export function knowledgeViewScope(tags: string[]): KnowledgeScope {
  return canonicalizeKnowledgeScope(tags);
}

/**
 * Which view level a scope belongs to, for labels: a session (`thread:` or a session's `resource:` tag),
 * the project (`project:`), or the org.
 */
export function knowledgeExplorerRung(scope: KnowledgeScope): KnowledgeExplorerRung {
  let rung: KnowledgeExplorerRung = 'org';
  for (const entry of scope) {
    const ns = entry.slice(0, entry.indexOf(':'));
    if (ns === 'thread' || ns === 'resource') return 'thread';
    if (ns === 'project') rung = 'resource';
  }
  return rung;
}

function clip(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

async function listVisibleNodes(
  store: KnowledgeStorage,
  scope: KnowledgeScope,
  max: number,
): Promise<{ nodes: KnowledgeNode[]; truncated: boolean }> {
  const nodes: KnowledgeNode[] = [];
  let cursor: string | undefined;
  while (nodes.length <= max) {
    const page = await store.listNodes({ scope, cursor, limit: Math.min(100, max + 1 - nodes.length) });
    for (const node of page) {
      if (node.mergedInto || node.isScope || node.name === PINNED_NODE_NAME) continue;
      nodes.push(node);
    }
    if (page.length < 100 || page.length === 0) break;
    cursor = createKnowledgeNodeCursor(page[page.length - 1] as KnowledgeNode);
  }
  const truncated = nodes.length > max;
  return { nodes: truncated ? nodes.slice(0, max) : nodes, truncated };
}

/**
 * The graph a viewer sees: content nodes visible from `view`, their records, wikilink edges between nodes in the
 * window, and pins marked on nodes (one target) or edges (several targets). The reserved `pinned` node never shows.
 */
export async function readKnowledgeGraph(
  store: KnowledgeStorage,
  view: KnowledgeScope,
  limits: KnowledgeExplorerLimits = DEFAULT_KNOWLEDGE_EXPLORER_LIMITS,
): Promise<KnowledgeExplorerGraph> {
  const { nodes, truncated: nodesTruncated } = await listVisibleNodes(store, view, limits.maxNodes);
  const byId = new Map(nodes.map(node => [node.id, node]));
  const byName = new Map<string, KnowledgeNode[]>();
  for (const node of nodes) byName.set(node.name.toLowerCase(), [...(byName.get(node.name.toLowerCase()) ?? []), node]);

  let truncated = nodesTruncated;
  const recordWindow: KnowledgeRecord[] = [];
  for (const node of nodes) {
    if (recordWindow.length > limits.maxRecords) break;
    const { records } = await store.listKnowledgeAbout({
      node: node.id,
      scope: view,
      limit: limits.maxRecords + 1 - recordWindow.length,
    });
    recordWindow.push(...records);
  }
  if (recordWindow.length > limits.maxRecords) {
    truncated = true;
    recordWindow.length = limits.maxRecords;
  }

  const resolveName = (name: string, recordScope: KnowledgeScope): KnowledgeNode | undefined => {
    const matches = byName.get(name.toLowerCase());
    if (!matches?.length) return undefined;
    // The nearest scope wins: the node whose tags are the closest to the record's own.
    return [...matches].sort(
      (a, b) => Math.abs(a.scope.length - recordScope.length) - Math.abs(b.scope.length - recordScope.length),
    )[0];
  };

  const edges: KnowledgeExplorerGraphEdge[] = [];
  const seenEdges = new Set<string>();
  const graphRecords: KnowledgeExplorerGraphRecord[] = [];
  const recordCounts = new Map<string, number>();
  for (const record of recordWindow) {
    recordCounts.set(record.node, (recordCounts.get(record.node) ?? 0) + 1);
    const nodeIds = [record.node];
    for (const name of parseKnowledgeWikilinks(record.text)) {
      const target = resolveName(name, record.scope);
      if (!target || target.id === record.node) continue;
      if (!nodeIds.includes(target.id)) nodeIds.push(target.id);
      const key = `${record.node}\u0000${target.id}`;
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);
      edges.push({
        id: `wikilink:${record.node}:${target.id}`,
        source: record.node,
        target: target.id,
        type: 'wikilink',
        recordId: record.id,
      });
    }
    graphRecords.push({ id: record.id, nodeIds, pinned: false, text: clip(record.text, limits.recordTextLimit) });
  }

  // Pins: a pin that links one node marks that node; a pin that links several marks the edges between them.
  const pinnedNodeIds = new Set<string>();
  const pinnedEdgeKeys = new Set<string>();
  const { pins } = await listPinnedKnowledge({ store, scope: view });
  for (const pin of pins) {
    const targets = [
      ...new Set(
        parseKnowledgeWikilinks(pin.text).flatMap(name => {
          const target = resolveName(name, pin.scope);
          return target && byId.has(target.id) ? [target.id] : [];
        }),
      ),
    ];
    if (targets.length === 1) pinnedNodeIds.add(targets[0]!);
    for (let i = 0; i < targets.length; i += 1) {
      for (let j = i + 1; j < targets.length; j += 1) {
        const a = targets[i]!;
        const b = targets[j]!;
        const existing = edges.find(
          edge => (edge.source === a && edge.target === b) || (edge.source === b && edge.target === a),
        );
        if (existing) {
          pinnedEdgeKeys.add(existing.id);
          existing.pinned = true;
        } else {
          edges.push({
            id: `wikilink:${a}:${b}`,
            source: a,
            target: b,
            type: 'wikilink',
            recordId: pin.id,
            pinned: true,
          });
          pinnedEdgeKeys.add(`wikilink:${a}:${b}`);
        }
      }
    }
    graphRecords.push({ id: pin.id, nodeIds: targets, pinned: true, text: clip(pin.text, limits.recordTextLimit) });
  }

  return {
    view: [...view],
    nodes: nodes.map(node => ({
      id: node.id,
      name: node.name,
      kind: node.kind,
      ...(node.description ? { description: node.description } : {}),
      scope: node.scope,
      rung: knowledgeExplorerRung(node.scope),
      pinned: pinnedNodeIds.has(node.id),
      recordCount: recordCounts.get(node.id) ?? 0,
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
    })),
    edges,
    records: graphRecords,
    truncated,
    pinCount: pins.length,
  };
}

/**
 * One node and the records about it and mentioning it, as visible from `view`. Null when it is not visible.
 * `getNode` is a bare id lookup, so the visibility check here is what keeps one view from reading another's node.
 * Owned records come first, newest first within each group. `pins: false` skips the pin lookup.
 */
export async function readKnowledgeNode(
  store: KnowledgeStorage,
  view: KnowledgeScope,
  nodeId: string,
  options: { limit?: number; pins?: boolean } = {},
): Promise<KnowledgeExplorerNode | null> {
  const node = await store.getNode(nodeId);
  if (!node?.scope || !isKnowledgeScopeVisible(node.scope, view)) return null;

  const limit = options.limit ?? 200;
  const pinnedNodeIds = new Set(
    options.pins === false ? [] : (await listPinnedKnowledge({ store, scope: view })).nodeIds,
  );
  const [owned, mentioning] = await Promise.all([
    store.listKnowledgeAbout({ node: node.id, scope: view, limit }),
    store.listKnowledgeMentioning({ node: node.id, scope: view, limit }),
  ]);
  const seen = new Set<string>();
  const records: KnowledgeExplorerNodeRecord[] = [];
  const push = (record: KnowledgeRecord, relation: 'owned' | 'mentions') => {
    if (seen.has(record.id)) return;
    seen.add(record.id);
    records.push({
      id: record.id,
      node: record.node,
      relation,
      text: record.text,
      scope: record.scope,
      rung: knowledgeExplorerRung(record.scope),
      sourceThreadId: record.sourceThreadId,
      capturedAt: record.capturedAt.toISOString(),
      ...(record.when ? { when: record.when.toISOString() } : {}),
      pinned: pinnedNodeIds.has(record.node),
      ...(record.metadata ? { metadata: record.metadata } : {}),
    });
  };
  // Record ids are ULIDs, so id order is newest-first order.
  for (const record of [...owned.records].sort((a, b) => b.id.localeCompare(a.id))) push(record, 'owned');
  for (const record of [...mentioning.records].sort((a, b) => b.id.localeCompare(a.id))) push(record, 'mentions');

  return {
    node: {
      id: node.id,
      name: node.name,
      kind: node.kind,
      content: node.content ?? '',
      ...(node.description ? { description: node.description } : {}),
      scope: node.scope,
      rung: knowledgeExplorerRung(node.scope),
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
    },
    records,
  };
}

/** Nodes visible from `view` whose record text matches `query`. */
export async function searchKnowledgeNodes(
  store: KnowledgeStorage,
  view: KnowledgeScope,
  query: string,
  limit = 20,
): Promise<{ results: KnowledgeExplorerSearchResult[]; truncated: boolean }> {
  const hits = await store.search({ query, scope: view, limit: limit + 1 });
  const results: KnowledgeExplorerSearchResult[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    const nodeId = hit.type === 'node' ? hit.id : (await store.getKnowledge({ id: hit.recordId }))?.node;
    if (!nodeId || seen.has(nodeId)) continue;
    const node = await store.getNode(nodeId);
    if (!node || node.mergedInto || node.isScope || node.name === PINNED_NODE_NAME) continue;
    seen.add(nodeId);
    results.push({
      id: node.id,
      name: node.name,
      kind: node.kind,
      type: 'node',
      rung: knowledgeExplorerRung(node.scope),
    });
  }
  return { results: results.slice(0, limit), truncated: results.length > limit || hits.length > limit };
}

/** Recent writes visible from `view`, newest first. `cursor` is the `nextCursor` of the previous page. */
export async function readKnowledgeActivity(
  store: KnowledgeStorage,
  view: KnowledgeScope,
  options: { cursor?: string; limit?: number } = {},
): Promise<{ events: KnowledgeExplorerActivityEvent[]; nextCursor?: string }> {
  const limit = options.limit ?? 25;
  const rows: KnowledgeActivityEvent[] = await store.listActivity({
    scope: view,
    after: options.cursor,
    limit: limit + 1,
  });
  const page = rows.slice(0, limit);
  const events: KnowledgeExplorerActivityEvent[] = [];
  for (const row of page) {
    const record =
      row.recordType === 'record' ? await store.getKnowledge({ id: row.recordId, includeDeleted: true }) : null;
    const node = await store.getNode(record?.node ?? row.recordId);
    if (!node) continue;
    events.push({
      id: row.id,
      action: row.action,
      recordType: row.recordType,
      recordId: row.recordId,
      scope: row.scope,
      node: { id: node.id, name: node.name, rung: knowledgeExplorerRung(node.scope) },
      createdAt: row.createdAt.toISOString(),
    });
  }
  return { events, ...(rows.length > limit && page.at(-1) ? { nextCursor: page.at(-1)!.id } : {}) };
}
