/**
 * Read-only Mastra `apiRoutes` exposing the factory project's knowledge graph.
 *
 * Serves the Knowledge page in factory-ui: a polling graph snapshot (nodes
 * as nodes, wikilink edges derived from record text), a node flyout payload
 * with per-record provenance, and the recent activity feed. Every endpoint is a
 * GET — this module never writes knowledge.
 *
 * Scoping is fail-closed: the org and resource rungs are derived server-side
 * from the authenticated caller and the validated `:id` project. The DEFAULT
 * view queries `[org:<orgId>, resource:<projectId>]` (org + project records).
 * Thread-scoped records are reachable ONLY via an explicit, server-validated
 * `threadId` query parameter (the drill-down view), which appends the thread
 * rung to the query scope. A thread is drillable iff it produced knowledge
 * visible under the caller's org/project prefix; unknown or cross-org threads
 * 404 — never a silent fallback to the default view.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { KnowledgeNode, KnowledgeRecord, KnowledgeScope, KnowledgeStorage } from '@mastra/core/storage';
import {
  canonicalizeKnowledgeScope,
  isKnowledgeScopeVisible,
  knowledgeScopeKey,
  parseKnowledgeWikilinks,
} from '@mastra/core/storage';
import type { Context } from 'hono';

import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';

/** Reserved node that anchors pinned records (see subconscious/pinned.ts). */
const PINNED_NODE_NAME = 'pinned';

/** Hover-card budget for record text shipped in the graph payload. */
const RECORD_TEXT_LIMIT = 240;

function truncateRecordText(text: string): string {
  return text.length > RECORD_TEXT_LIMIT ? `${text.slice(0, RECORD_TEXT_LIMIT - 1)}…` : text;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Window caps. Injectable at construction only — never per-request. */
export interface KnowledgeRouteLimits {
  /** Max nodes in a graph snapshot (newest-first). */
  maxNodes: number;
  /** Max records parsed for edges per snapshot (newest-first). */
  maxRecords: number;
  /** Max fallback `resolveNode` store lookups per request (deduped per unique name+scope). */
  maxFallbackLookups: number;
}

const DEFAULT_LIMITS: KnowledgeRouteLimits = { maxNodes: 500, maxRecords: 2000, maxFallbackLookups: 100 };

export interface KnowledgeRoutesDeps extends RouteDependencies {
  /** Factory projects domain — validates the `:id` project belongs to the caller's org. */
  projects: FactoryProjectsStorage;
  /** Lazy handle to the knowledge storage domain; endpoints 503 when absent. */
  knowledge: () => Promise<KnowledgeStorage | undefined>;
  limits?: Partial<KnowledgeRouteLimits>;
}

/** A graph node. `recordCount` is window-derived (records inside the snapshot window only). */
export interface KnowledgeGraphNode {
  id: string;
  name: string;
  kind: string;
  description?: string;
  scope: KnowledgeScope;
  /** Deepest rung of the record's scope: org | resource | thread. */
  rung: 'org' | 'resource' | 'thread';
  /**
   * True when a non-deleted pinned record's wikilinks reference ONLY this
   * node (A9: multi-target pins mark their edges instead — the pin is
   * about the relationship; a single-target pin has no edge to carry it).
   */
  pinned: boolean;
  /** Records owned by this node INSIDE the snapshot window (not a total). */
  recordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  /** The owning node of the record (its `node`). */
  source: string;
  /** The wikilink-resolved node. */
  target: string;
  /**
   * Always 'wikilink': the record's `node` is the edge SOURCE, so the
   * plan's "parent link" collapses into the wikilink edge — nodes carry no
   * separate parent field to derive a second edge type from.
   */
  type: 'wikilink';
  /** The record whose text produced the edge. */
  recordId: string;
  /**
   * True when the edge is derived from a PINNED record linking two nodes —
   * the pin marks the relationship, so the accent lives on the edge (A9).
   */
  pinned?: boolean;
}

/**
 * A knowledge record as a first-class graph element (A11): every record in the window,
 * with the in-window nodes it touches. The client renders by arity —
 * 1 node: a small dot linked to it; 2: the connecting line; 3+: a midpoint
 * junction splitting to each node. Pin records have their hidden reserved
 * owner omitted, so their arity comes purely from wikilink targets.
 */
export interface KnowledgeGraphRecord {
  /** The record id. */
  id: string;
  /** Owner node first (omitted for pins), then resolved wikilink targets. */
  nodeIds: string[];
  pinned: boolean;
  /** Record text, truncated for hover cards. */
  text: string;
}

export interface KnowledgeGraphPayload {
  view: 'project' | 'thread';
  threadId?: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  records: KnowledgeGraphRecord[];
  /** True when the node or record window cap was hit (newest-first window). */
  truncated: boolean;
  /** Wikilink targets that resolved in the store but fell outside the node window. */
  outOfWindow: Array<{ id: string; name: string }>;
  /** Unique unknown names skipped once the fallback-lookup cap was hit. */
  unresolvedCapped: { count: number; names: string[] };
  /** Pin counts per rung of the active view (thread is null in the default view). */
  pinCensus: { resource: number; thread: number | null };
  /** Change hint: newest knowledge activity id (per-process monotonic — hint only). */
  version: string | null;
}

export interface KnowledgeNodeRecordPayload {
  id: string;
  node: string;
  /** 'owned' when the node is the record's parent, 'mentions' when it only wikilinks it. */
  relation: 'owned' | 'mentions';
  text: string;
  scope: KnowledgeScope;
  rung: 'org' | 'resource' | 'thread';
  sourceThreadId: string;
  capturedAt: string;
  when?: string;
  pinned: boolean;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeNodePayload {
  node: {
    id: string;
    name: string;
    kind: string;
    content: string;
    scope: KnowledgeScope;
    rung: 'org' | 'resource' | 'thread';
    createdAt: string;
    updatedAt: string;
  };
  records: KnowledgeNodeRecordPayload[];
}

function loose(c: unknown): Context {
  return c as Context;
}

function deepestRung(scope: KnowledgeScope): 'org' | 'resource' | 'thread' {
  let rung: 'org' | 'resource' | 'thread' = 'org';
  for (const entry of scope) {
    const ns = entry.slice(0, entry.indexOf(':'));
    if (ns === 'thread') return 'thread';
    if (ns === 'resource') rung = 'resource';
  }
  return rung;
}

function boundedThreadId(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 && trimmed.length <= 512 ? trimmed : undefined;
}

interface ResolvedView {
  orgId: string;
  userId: string;
  factoryProjectId: string;
  store: KnowledgeStorage;
  view: 'project' | 'thread';
  threadId?: string;
  /** The query scope for the active view. */
  scope: KnowledgeScope;
  /** Exact scopes where a reserved `pinned` node may live for this view. */
  pinRungs: Array<{ rung: 'resource' | 'thread'; scope: KnowledgeScope }>;
}

/**
 * In-record + capped-fallback wikilink resolver, shared by both endpoints.
 * Resolution uses the store's own algorithm: a descending-prefix walk over the
 * record's canonical scope matching canonical name + exact scope key at each
 * prefix, so an edge never depends on whether the target landed in the window.
 */
class WikilinkResolver {
  /** exact `${scopeKey}\u0000${lowerName}` → node, from the fetched window. */
  readonly #inWindow = new Map<string, KnowledgeNode>();
  readonly #windowIds = new Set<string>();
  /** `${recordScopeKey}\u0000${lowerName}` → fallback result (null = dangling). */
  readonly #fallbackCache = new Map<string, KnowledgeNode | null>();
  #fallbackLookups = 0;
  readonly #store: KnowledgeStorage;
  readonly #maxFallbackLookups: number;
  readonly outOfWindow = new Map<string, { id: string; name: string }>();
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
      this.outOfWindow.set(node.id, { id: node.id, name: node.name });
    }
    return node;
  }

  get cappedCount(): number {
    return this.#cappedSeen.size;
  }
}

export class KnowledgeRoutes extends Route<KnowledgeRoutesDeps> {
  readonly #limits: KnowledgeRouteLimits;

  constructor(deps: KnowledgeRoutesDeps) {
    super(deps);
    this.#limits = { ...DEFAULT_LIMITS, ...deps.limits };
  }

  /** Resolve the `(orgId, userId)` tenant or a ready-to-return error response. */
  async #resolveTenant(c: Context): Promise<{ orgId: string; userId: string } | { response: Response }> {
    await this.deps.auth.ensureUser(c);
    const tenant = this.deps.auth.tenant(c);
    if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) {
      return {
        response: c.json(
          { error: 'organization_required', message: 'The knowledge graph requires an organization.' },
          403,
        ),
      };
    }
    return { orgId: tenant.orgId, userId: tenant.userId };
  }

  /**
   * Resolve tenant + org-owned project + knowledge store + the active view's
   * query scope. The ONE seam both endpoints share, so the default/thread view
   * scope and the pin rungs cannot drift between them.
   *
   * threadId validation runs a single `listRecordsBySource` lookup with
   * `limit: 1` AT THE CANDIDATE SCOPE `[org, resource, thread:<id>]` — the
   * store's own visibility predicate is the authorization: the thread's own
   * records (equal scope key) and its project/org captures (prefix) match, while
   * a cross-org thread's records match nothing → zero rows → 404.
   */
  async #resolveView(c: Context): Promise<ResolvedView | { response: Response }> {
    const tenant = await this.#resolveTenant(c);
    if ('response' in tenant) return tenant;

    const projectId = c.req.param('id');
    if (!projectId || !UUID_RE.test(projectId)) {
      return { response: c.json({ error: 'Project not found' }, 404) };
    }
    const { projects } = this.deps;
    await projects.ensureReady();
    const project = await projects.get({ orgId: tenant.orgId, id: projectId });
    if (!project) {
      return { response: c.json({ error: 'Project not found' }, 404) };
    }

    const store = await this.deps.knowledge();
    if (!store) {
      return {
        response: c.json(
          { error: 'knowledge_unavailable', message: 'The knowledge storage domain is not configured.' },
          503,
        ),
      };
    }

    const defaultScope: KnowledgeScope = [`org:${tenant.orgId}`, `resource:${projectId}`];
    const resourceRungScope = defaultScope;

    const threadId = boundedThreadId(c.req.query('threadId'));
    if (c.req.query('threadId') !== undefined && !threadId) {
      return { response: c.json({ error: 'thread_not_found' }, 404) };
    }
    if (!threadId) {
      return {
        ...tenant,
        factoryProjectId: projectId,
        store,
        view: 'project',
        scope: defaultScope,
        pinRungs: [{ rung: 'resource', scope: resourceRungScope }],
      };
    }

    const candidateScope: KnowledgeScope = [...defaultScope, `thread:${threadId}`];
    const probe = await store.knowledgeBySource({ sourceThreadId: threadId, scope: candidateScope, limit: 1 });
    if (probe.records.length === 0) {
      return { response: c.json({ error: 'thread_not_found' }, 404) };
    }
    return {
      ...tenant,
      factoryProjectId: projectId,
      store,
      view: 'thread',
      threadId,
      scope: candidateScope,
      pinRungs: [
        { rung: 'resource', scope: resourceRungScope },
        { rung: 'thread', scope: candidateScope },
      ],
    };
  }

  /** Reserved `pinned` node ids at the active view's rungs (one exact-scope lookup per rung). */
  async #pinnedNodeIds(view: ResolvedView): Promise<Array<{ rung: 'resource' | 'thread'; id: string }>> {
    const out: Array<{ rung: 'resource' | 'thread'; id: string }> = [];
    for (const { rung, scope } of view.pinRungs) {
      const node = await view.store.getNodeByName({ name: PINNED_NODE_NAME, scope });
      if (node && !node.mergedInto) out.push({ rung, id: node.id });
    }
    return out;
  }

  /** Non-deleted pinned records for the given pinned-node ids, visible in the view. */
  async #pinnedRecords(
    view: ResolvedView,
    pinnedNodeIds: Array<{ rung: 'resource' | 'thread'; id: string }>,
  ): Promise<Array<{ rung: 'resource' | 'thread'; record: KnowledgeRecord }>> {
    const out: Array<{ rung: 'resource' | 'thread'; record: KnowledgeRecord }> = [];
    for (const { rung, id } of pinnedNodeIds) {
      const { records } = await view.store.listKnowledgeAbout({ node: id, scope: view.scope, limit: 200 });
      for (const record of records) out.push({ rung, record });
    }
    return out;
  }

  routes(): ApiRoute[] {
    return [
      // ── Graph snapshot: nodes + derived edges, polled by the page ──────────
      registerApiRoute('/web/factory/projects/:id/knowledge/graph', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const view = await this.#resolveView(loose(c));
          if ('response' in view) return view.response;
          const { store, scope } = view;
          const limits = this.#limits;

          // Nodes, newest-first; +1 to detect truncation.
          const fetched = await store.listNodes({ scope, limit: limits.maxNodes + 1 });
          let truncated = fetched.length > limits.maxNodes;
          const pinnedNodeIds = await this.#pinnedNodeIds(view);
          const pinnedNodeIdSet = new Set(pinnedNodeIds.map(p => p.id));
          const nodes = fetched.slice(0, limits.maxNodes).filter(node => !pinnedNodeIdSet.has(node.id));

          // Record window: per-node owned records, then newest-first overall.
          const recordWindow: KnowledgeRecord[] = [];
          for (const node of nodes) {
            if (recordWindow.length > limits.maxRecords) break;
            const { records } = await store.listKnowledgeAbout({
              node: node.id,
              scope,
              limit: limits.maxRecords + 1 - recordWindow.length,
            });
            recordWindow.push(...records);
          }
          // Record ids are ULIDs — descending id = newest-first.
          recordWindow.sort((a, b) => b.id.localeCompare(a.id));
          if (recordWindow.length > limits.maxRecords) {
            truncated = true;
            recordWindow.length = limits.maxRecords;
          }

          const resolver = new WikilinkResolver(store, nodes, limits.maxFallbackLookups);

          // Edges: owner node (the record's parent link) → wikilinked node.
          // Graph records: every windowed record with its in-window node set,
          // owner first. The client renders dots, lines, or junctions by arity.
          const edges: KnowledgeGraphEdge[] = [];
          const graphRecords: KnowledgeGraphRecord[] = [];
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
            graphRecords.push({ id: record.id, nodeIds, pinned: false, text: truncateRecordText(record.text) });
          }

          // Pins mark relationships. The reserved owner node is omitted, so
          // arity comes purely from wikilink targets.
          const pinnedRecords = await this.#pinnedRecords(view, pinnedNodeIds);
          const accented = new Set<string>();
          for (const { record } of pinnedRecords) {
            const targets: string[] = [];
            for (const name of parseKnowledgeWikilinks(record.text)) {
              const target = await resolver.resolve(name, record.scope);
              if (target && resolver.inWindowId(target.id) && !targets.includes(target.id)) {
                targets.push(target.id);
              }
            }
            graphRecords.push({ id: record.id, nodeIds: targets, pinned: true, text: truncateRecordText(record.text) });
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
          const pinCensus = {
            resource: pinnedRecords.filter(p => p.rung === 'resource').length,
            thread: view.view === 'thread' ? pinnedRecords.filter(p => p.rung === 'thread').length : null,
          };

          const activity = await store.listActivity({ scope, limit: 1 });

          const payload: KnowledgeGraphPayload = {
            view: view.view,
            ...(view.threadId ? { threadId: view.threadId } : {}),
            nodes: nodes.map(node => ({
              id: node.id,
              name: node.name,
              kind: node.kind,
              // Empty string is a curator clear — omit it so the payload carries no dead keys.
              ...(node.description ? { description: node.description } : {}),
              scope: node.scope,
              rung: deepestRung(node.scope),
              pinned: accented.has(node.id),
              recordCount: recordCounts.get(node.id) ?? 0,
              createdAt: node.createdAt.toISOString(),
              updatedAt: node.updatedAt.toISOString(),
            })),
            edges,
            records: graphRecords,
            truncated,
            outOfWindow: [...resolver.outOfWindow.values()],
            unresolvedCapped: { count: resolver.cappedCount, names: resolver.cappedNames },
            pinCensus,
            version: activity[0]?.id ?? null,
          };
          return c.json(payload);
        },
      }),

      // ── Node flyout payload: details + provenance-rich records ───────────────
      registerApiRoute('/web/factory/projects/:id/knowledge/nodes/:nodeId', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const view = await this.#resolveView(loose(c));
          if ('response' in view) return view.response;
          const { store, scope } = view;
          const nodeId = loose(c).req.param('nodeId');
          if (!nodeId || nodeId.length > 512) return c.json({ error: 'node_not_found' }, 404);

          const node = await store.getNode(nodeId);
          // getNode is a bare id lookup with no scope predicate. This explicit
          // visibility check prevents an IDOR.
          if (!node || !isKnowledgeScopeVisible(node.scope, scope)) {
            return c.json({ error: 'node_not_found' }, 404);
          }

          const pinnedNodeIds = await this.#pinnedNodeIds(view);
          const pinnedNodeIdSet = new Set(pinnedNodeIds.map(p => p.id));

          const [owned, mentioning] = await Promise.all([
            store.listKnowledgeAbout({ node: node.id, scope, limit: 200 }),
            store.listKnowledgeMentioning({ node: node.id, scope, limit: 200 }),
          ]);
          const seen = new Set<string>();
          const records: KnowledgeNodeRecordPayload[] = [];
          const push = (record: KnowledgeRecord, relation: 'owned' | 'mentions') => {
            if (seen.has(record.id)) return;
            seen.add(record.id);
            records.push({
              id: record.id,
              node: record.node,
              relation,
              text: record.text,
              scope: record.scope,
              rung: deepestRung(record.scope),
              sourceThreadId: record.sourceThreadId,
              capturedAt: record.capturedAt.toISOString(),
              ...(record.when ? { when: record.when.toISOString() } : {}),
              pinned: pinnedNodeIdSet.has(record.node),
              ...(record.metadata ? { metadata: record.metadata } : {}),
            });
          };
          // Owned first, newest-first within each group. Record ids are ULIDs.
          for (const record of [...owned.records].sort((a, b) => b.id.localeCompare(a.id))) push(record, 'owned');
          for (const record of [...mentioning.records].sort((a, b) => b.id.localeCompare(a.id))) {
            push(record, 'mentions');
          }

          const payload: KnowledgeNodePayload = {
            node: {
              id: node.id,
              name: node.name,
              kind: node.kind,
              content: node.content ?? '',
              scope: node.scope,
              rung: deepestRung(node.scope),
              createdAt: node.createdAt.toISOString(),
              updatedAt: node.updatedAt.toISOString(),
            },
            records,
          };
          return c.json(payload);
        },
      }),

      // ── Recent activity feed for the live-arrival affordance ───────────────
      registerApiRoute('/web/factory/projects/:id/knowledge/activity', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const view = await this.#resolveView(loose(c));
          if ('response' in view) return view.response;
          const events = await view.store.listActivity({ scope: view.scope, limit: 100 });
          return c.json({
            events: events.map(event => ({
              id: event.id,
              action: event.action,
              recordType: event.recordType,
              recordId: event.recordId,
              scope: event.scope,
              ...(event.sourceThreadId ? { sourceThreadId: event.sourceThreadId } : {}),
              createdAt: event.createdAt.toISOString(),
            })),
          });
        },
      }),
    ];
  }
}
