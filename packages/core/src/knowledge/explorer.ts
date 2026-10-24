import type {
  KnowledgeActivityEvent,
  KnowledgeNode,
  KnowledgeRecord,
  KnowledgeScope,
  KnowledgeStorage,
} from '../storage';
import { canonicalizeKnowledgeScope, isKnowledgeScopeVisible } from '../storage';
import { listPinnedKnowledge, PINNED_NODE_NAME } from './pinned';

/**
 * Read-only views over one Knowledge instance for browsing UIs (Mastra Studio).
 *
 * Every read takes a **view**: the set of scope tags the viewer holds. Knowledge shows a record when all of its
 * tags are in the view, so the view decides what is visible. These functions never write.
 *
 * @experimental Knowledge APIs are experimental and may change without notice.
 */

export type KnowledgeExplorerRung = 'org' | 'resource' | 'thread';

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
  node: { id: string; name: string; rung: KnowledgeExplorerRung; threadId?: string };
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

export const DEFAULT_KNOWLEDGE_SEARCH_LIMIT = 20;
const DEFAULT_KNOWLEDGE_SEARCH_SCAN = 1000;

/** 0 for an exact name match, 1 for a prefix match, 2 for anything else. `query` must already be lower-cased. */
export function knowledgeSearchRank(name: string, query: string): number {
  const normalized = name.toLocaleLowerCase();
  if (normalized === query) return 0;
  if (normalized.startsWith(query)) return 1;
  return 2;
}

/** A content node as a search hit; session-level nodes carry their `threadId`. */
export function knowledgeSearchHit(node: KnowledgeNode): KnowledgeExplorerSearchResult & { threadId?: string } {
  const rung = knowledgeExplorerRung(node.scope);
  const threadId = rung === 'thread' ? node.scope.find(tag => tag.startsWith('thread:'))?.slice(7) : undefined;
  return { id: node.id, name: node.name, kind: node.kind, type: 'node', rung, ...(threadId ? { threadId } : {}) };
}

/**
 * Content nodes visible from `view` whose name contains `query` (case-insensitive), ranked exact, prefix, other.
 * `truncated` is true when more could match than the limits let this read look at.
 */
export async function searchKnowledgeNodes(
  store: KnowledgeStorage,
  view: KnowledgeScope,
  query: string,
  options: { limit?: number; scanLimit?: number } = {},
): Promise<{ nodes: KnowledgeNode[]; truncated: boolean }> {
  const needle = query.trim().toLocaleLowerCase();
  const limit = options.limit ?? DEFAULT_KNOWLEDGE_SEARCH_LIMIT;
  const scanLimit = options.scanLimit ?? DEFAULT_KNOWLEDGE_SEARCH_SCAN;
  if (needle.length < 2) return { nodes: [], truncated: false };
  const [prefixNodes, scannedNodes] = await Promise.all([
    store.listNodes({ scope: view, namePrefix: needle, limit: limit + 1 }),
    store.listNodes({ scope: view, limit: scanLimit }),
  ]);
  const byId = new Map<string, KnowledgeNode>();
  for (const node of [...prefixNodes, ...scannedNodes]) {
    if (node.isScope || !Array.isArray(node.scope) || !isKnowledgeScopeVisible(node.scope, view)) continue;
    if (!node.name.toLocaleLowerCase().includes(needle)) continue;
    byId.set(node.id, node);
  }
  return {
    nodes: [...byId.values()],
    truncated: prefixNodes.length > limit || scannedNodes.length >= scanLimit,
  };
}

const ACTIVITY_BATCH = 100;
const ACTIVITY_SCAN_CAP = 1000;
export const DEFAULT_KNOWLEDGE_ACTIVITY_PAGE_SIZE = 25;

/**
 * Newest-first activity page where EVERY returned event targets a node visible in `view`. Visibility is decided
 * BEFORE the page is shaped: hidden rows are skipped entirely (no action, type, id or time metadata leaks) and a
 * hidden backlog can never displace visible events. When the scan cap stops the walk before the stream ends,
 * `nextCursor` is the last scanned event so the caller can continue past hidden rows.
 * `memberIds` further limits events to those nodes (a scope's members).
 */
export async function readKnowledgeActivity(
  store: KnowledgeStorage,
  view: KnowledgeScope,
  options: { cursor?: string; limit?: number; memberIds?: Set<string>; truncated?: boolean } = {},
): Promise<{ events: KnowledgeExplorerActivityEvent[]; nextCursor?: string; truncated?: true }> {
  const pageSize = options.limit ?? DEFAULT_KNOWLEDGE_ACTIVITY_PAGE_SIZE;
  const want = pageSize + 1;
  const items: Array<{ event: KnowledgeActivityEvent; node: KnowledgeNode }> = [];
  // Many events in a scan target the same node; read each node once per request.
  const nodes = new Map<string, Promise<KnowledgeNode | null>>();
  const getNode = (id: string) => {
    let node = nodes.get(id);
    if (!node) {
      node = store.getNode(id);
      nodes.set(id, node);
    }
    return node;
  };
  let after = options.cursor;
  let scanned = 0;
  let exhausted = false;
  while (items.length < want && scanned < ACTIVITY_SCAN_CAP) {
    const batch = await store.listActivity({ scope: view, after, limit: ACTIVITY_BATCH });
    if (batch.length === 0) {
      exhausted = true;
      break;
    }
    for (const event of batch) {
      after = event.id;
      scanned += 1;
      let targetNode: KnowledgeNode | null;
      if (event.recordType === 'node') {
        targetNode = await getNode(event.recordId);
      } else {
        const record = await store.getKnowledge({ id: event.recordId });
        targetNode = record ? await getNode(record.node) : null;
        if (record && !isKnowledgeScopeVisible(record.scope, view)) targetNode = null;
      }
      if (
        targetNode?.scope &&
        isKnowledgeScopeVisible(targetNode.scope, view) &&
        (options.memberIds === undefined || options.memberIds.has(targetNode.id))
      ) {
        items.push({ event, node: targetNode });
      }
      if (items.length >= want || scanned >= ACTIVITY_SCAN_CAP) break;
    }
  }
  const stoppedAtCap = !exhausted && items.length < want && scanned >= ACTIVITY_SCAN_CAP;
  const page = items.slice(0, pageSize);
  const lastVisible = page.at(-1);
  return {
    events: page.map(({ event, node }) => {
      const rung = knowledgeExplorerRung(node.scope);
      const threadId = rung === 'thread' ? node.scope.find(tag => tag.startsWith('thread:'))?.slice(7) : undefined;
      return {
        id: event.id,
        action: event.action,
        recordType: event.recordType,
        ...(event.recordType === 'record' ? { recordId: event.recordId } : {}),
        scope: event.scope,
        node: { id: node.id, name: node.name, rung, ...(threadId ? { threadId } : {}) },
        createdAt: event.createdAt.toISOString(),
      };
    }),
    ...(items.length > pageSize && lastVisible
      ? { nextCursor: lastVisible.event.id }
      : stoppedAtCap && after
        ? { nextCursor: after }
        : {}),
    ...(options.truncated ? { truncated: true as const } : {}),
  };
}
