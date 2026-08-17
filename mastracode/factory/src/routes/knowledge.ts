/**
 * Read-only Mastra `apiRoutes` exposing the factory project's knowledge graph.
 *
 * Serves the Knowledge page in factory-ui: a polling graph snapshot (entities
 * as nodes, wikilink edges derived from fact text), an entity flyout payload
 * with per-fact provenance, and the recent activity feed. Every endpoint is a
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
import type { KnowledgeNode, KnowledgeItem, KnowledgeScope, KnowledgeStorage } from '@mastra/core/storage';
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

/** Reserved entity that anchors pinned facts (see subconscious/pinned.ts). */
const PINNED_ENTITY_NAME = 'pinned';

/** Hover-card budget for memory text shipped in the graph payload. */
const MEMORY_TEXT_LIMIT = 240;

function truncateFactText(text: string): string {
  return text.length > MEMORY_TEXT_LIMIT ? `${text.slice(0, MEMORY_TEXT_LIMIT - 1)}…` : text;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Window caps. Injectable at construction only — never per-request. */
export interface KnowledgeRouteLimits {
  /** Max entities in a graph snapshot (newest-first). */
  maxEntities: number;
  /** Max facts parsed for edges per snapshot (newest-first). */
  maxFacts: number;
  /** Max fallback `resolveEntity` store lookups per request (deduped per unique name+scope). */
  maxFallbackLookups: number;
}

const DEFAULT_LIMITS: KnowledgeRouteLimits = { maxEntities: 500, maxFacts: 2000, maxFallbackLookups: 100 };

export interface KnowledgeRoutesDeps extends RouteDependencies {
  /** Factory projects domain — validates the `:id` project belongs to the caller's org. */
  projects: FactoryProjectsStorage;
  /** Lazy handle to the knowledge storage domain; endpoints 503 when absent. */
  knowledge: () => Promise<KnowledgeStorage | undefined>;
  limits?: Partial<KnowledgeRouteLimits>;
}

/** A graph node. `factCount` is window-derived (facts inside the snapshot window only). */
export interface KnowledgeGraphNode {
  id: string;
  name: string;
  kind: string;
  scope: KnowledgeScope;
  /** Deepest rung of the record's scope: org | resource | thread. */
  rung: 'org' | 'resource' | 'thread';
  /**
   * True when a non-deleted pinned fact's wikilinks reference ONLY this
   * entity (A9: multi-target pins mark their edges instead — the pin is
   * about the relationship; a single-target pin has no edge to carry it).
   */
  pinned: boolean;
  /** Facts owned by this entity INSIDE the snapshot window (not a total). */
  factCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  /** The owning entity of the fact (its `parentEntityId`). */
  source: string;
  /** The wikilink-resolved entity. */
  target: string;
  /**
   * Always 'wikilink': the fact's `parentEntityId` is the edge SOURCE, so the
   * plan's "parent link" collapses into the wikilink edge — entities carry no
   * separate parent field to derive a second edge type from.
   */
  type: 'wikilink';
  /** The fact whose text produced the edge. */
  factId: string;
  /**
   * True when the edge is derived from a PINNED fact linking two entities —
   * the pin marks the relationship, so the accent lives on the edge (A9).
   */
  pinned?: boolean;
}

/**
 * A memory as a first-class graph element (A11): every fact in the window,
 * with the in-window entities it touches. The client renders by arity —
 * 1 entity: a small dot linked to it; 2: the connecting line; 3+: a midpoint
 * junction splitting to each entity. Pin facts have their hidden reserved
 * owner omitted, so their arity comes purely from wikilink targets.
 */
export interface KnowledgeGraphMemory {
  /** The fact id. */
  id: string;
  /** Owner entity first (omitted for pins), then resolved wikilink targets. */
  entityIds: string[];
  pinned: boolean;
  /** Fact text, truncated for hover cards. */
  text: string;
}

export interface KnowledgeGraphPayload {
  view: 'project' | 'thread';
  threadId?: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  memories: KnowledgeGraphMemory[];
  /** True when the entity or fact window cap was hit (newest-first window). */
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

export interface KnowledgeEntityFactPayload {
  id: string;
  parentEntityId: string;
  /** 'owned' when the entity is the fact's parent, 'mentions' when it only wikilinks it. */
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

export interface KnowledgeEntityPayload {
  entity: {
    id: string;
    name: string;
    kind: string;
    scope: KnowledgeScope;
    rung: 'org' | 'resource' | 'thread';
    createdAt: string;
    updatedAt: string;
  };
  facts: KnowledgeEntityFactPayload[];
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
  /** Exact scopes where a reserved `pinned` entity may live for this view. */
  pinRungs: Array<{ rung: 'resource' | 'thread'; scope: KnowledgeScope }>;
}

/**
 * In-memory + capped-fallback wikilink resolver, shared by both endpoints.
 * Resolution uses the store's own algorithm: a descending-prefix walk over the
 * fact's canonical scope matching canonical name + exact scope key at each
 * prefix, so an edge never depends on whether the target landed in the window.
 */
class WikilinkResolver {
  /** exact `${scopeKey}\u0000${lowerName}` → entity, from the fetched window. */
  readonly #inWindow = new Map<string, KnowledgeNode>();
  readonly #windowIds = new Set<string>();
  /** `${factScopeKey}\u0000${lowerName}` → fallback result (null = dangling). */
  readonly #fallbackCache = new Map<string, KnowledgeNode | null>();
  #fallbackLookups = 0;
  readonly #store: KnowledgeStorage;
  readonly #maxFallbackLookups: number;
  readonly outOfWindow = new Map<string, { id: string; name: string }>();
  readonly cappedNames: string[] = [];
  #cappedSeen = new Set<string>();

  constructor(store: KnowledgeStorage, entities: KnowledgeNode[], maxFallbackLookups: number) {
    this.#store = store;
    this.#maxFallbackLookups = maxFallbackLookups;
    for (const entity of entities) {
      this.#inWindow.set(`${knowledgeScopeKey(entity.scope)}\u0000${entity.name.trim().toLocaleLowerCase()}`, entity);
      this.#windowIds.add(entity.id);
    }
  }

  inWindowId(id: string): boolean {
    return this.#windowIds.has(id);
  }

  /** Resolve a wikilink name from a fact's scope. Returns the entity or null (dangling/capped). */
  async resolve(name: string, factScope: KnowledgeScope): Promise<KnowledgeNode | null> {
    const canonical = canonicalizeKnowledgeScope(factScope);
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

  #trackOutOfWindow(entity: KnowledgeNode | null): KnowledgeNode | null {
    if (entity && !this.#windowIds.has(entity.id)) {
      this.outOfWindow.set(entity.id, { id: entity.id, name: entity.name });
    }
    return entity;
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
   * threadId validation runs a single `listFactsBySource` lookup with
   * `limit: 1` AT THE CANDIDATE SCOPE `[org, resource, thread:<id>]` — the
   * store's own visibility predicate is the authorization: the thread's own
   * facts (equal scope key) and its project/org captures (prefix) match, while
   * a cross-org thread's facts match nothing → zero rows → 404.
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
    const probe = await store.listItemsBySource({ sourceThreadId: threadId, scope: candidateScope, limit: 1 });
    if (probe.items.length === 0) {
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

  /** Reserved `pinned` entity ids at the active view's rungs (one exact-scope lookup per rung). */
  async #pinnedEntityIds(view: ResolvedView): Promise<Array<{ rung: 'resource' | 'thread'; id: string }>> {
    const out: Array<{ rung: 'resource' | 'thread'; id: string }> = [];
    for (const { rung, scope } of view.pinRungs) {
      const entity = await view.store.getNodeByName({ name: PINNED_ENTITY_NAME, scope });
      if (entity && !entity.mergedInto) out.push({ rung, id: entity.id });
    }
    return out;
  }

  /** Non-deleted pinned facts for the given pinned-entity ids, visible in the view. */
  async #pinnedFacts(
    view: ResolvedView,
    pinnedIds: Array<{ rung: 'resource' | 'thread'; id: string }>,
  ): Promise<Array<{ rung: 'resource' | 'thread'; fact: KnowledgeItem }>> {
    const out: Array<{ rung: 'resource' | 'thread'; fact: KnowledgeItem }> = [];
    for (const { rung, id } of pinnedIds) {
      const { items: facts } = await view.store.itemsAbout({ nodeId: id, scope: view.scope, limit: 200 });
      for (const fact of facts) out.push({ rung, fact });
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

          // Entities, newest-first; +1 to detect truncation.
          const fetched = await store.listNodes({ scope, limit: limits.maxEntities + 1 });
          let truncated = fetched.length > limits.maxEntities;
          const pinnedIds = await this.#pinnedEntityIds(view);
          const pinnedIdSet = new Set(pinnedIds.map(p => p.id));
          const entities = fetched.slice(0, limits.maxEntities).filter(entity => !pinnedIdSet.has(entity.id));

          // Facts window: per-entity owned facts, then newest-first overall.
          const factWindow: KnowledgeItem[] = [];
          for (const entity of entities) {
            if (factWindow.length > limits.maxFacts) break;
            const { items: facts } = await store.itemsAbout({
              nodeId: entity.id,
              scope,
              limit: limits.maxFacts + 1 - factWindow.length,
            });
            factWindow.push(...facts);
          }
          // Fact ids are ULIDs — descending id = newest-first.
          factWindow.sort((a, b) => b.id.localeCompare(a.id));
          if (factWindow.length > limits.maxFacts) {
            truncated = true;
            factWindow.length = limits.maxFacts;
          }

          const resolver = new WikilinkResolver(store, entities, limits.maxFallbackLookups);

          // Edges: owner entity (the fact's parent link) → wikilinked entity.
          // Memories (A11): every windowed fact with its in-window entity set,
          // owner first — the client renders dots/lines/junctions by arity.
          const edges: KnowledgeGraphEdge[] = [];
          const memories: KnowledgeGraphMemory[] = [];
          const edgeSeen = new Set<string>();
          const factCounts = new Map<string, number>();
          for (const fact of factWindow) {
            factCounts.set(fact.parentNodeId, (factCounts.get(fact.parentNodeId) ?? 0) + 1);
            const entityIds = [fact.parentNodeId];
            for (const name of parseKnowledgeWikilinks(fact.text)) {
              const target = await resolver.resolve(name, fact.scope);
              if (!target) continue; // dangling or capped
              if (target.id === fact.parentNodeId) continue; // self-link
              if (!resolver.inWindowId(target.id)) continue; // reported via outOfWindow
              if (!entityIds.includes(target.id)) entityIds.push(target.id);
              const key = `${fact.parentNodeId}\u0000${target.id}`;
              if (edgeSeen.has(key)) continue;
              edgeSeen.add(key);
              edges.push({
                id: `wikilink:${fact.parentNodeId}:${target.id}`,
                source: fact.parentNodeId,
                target: target.id,
                type: 'wikilink',
                factId: fact.id,
              });
            }
            memories.push({ id: fact.id, entityIds, pinned: false, text: truncateFactText(fact.text) });
          }

          // Pins (A9 + A11): a pin marks its relationship, so pinned facts
          // become pinned MEMORIES — the reserved owner entity is omitted, so
          // arity comes purely from wikilink targets. The client renders an
          // amber dot (1 target), line (2), or junction (3+). Pairwise pinned
          // edges are still emitted for the 2-target case, and a 1-target pin
          // keeps the node accent as a fallback signal.
          const pinnedFacts = await this.#pinnedFacts(view, pinnedIds);
          const accented = new Set<string>();
          for (const { fact } of pinnedFacts) {
            const targets: string[] = [];
            for (const name of parseKnowledgeWikilinks(fact.text)) {
              const target = await resolver.resolve(name, fact.scope);
              if (target && resolver.inWindowId(target.id) && !targets.includes(target.id)) {
                targets.push(target.id);
              }
            }
            memories.push({ id: fact.id, entityIds: targets, pinned: true, text: truncateFactText(fact.text) });
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
                  id: `pin:${fact.id}:${targets[a]}:${targets[b]}`,
                  source: targets[a]!,
                  target: targets[b]!,
                  type: 'wikilink',
                  factId: fact.id,
                  pinned: true,
                });
              }
            }
          }
          const pinCensus = {
            resource: pinnedFacts.filter(p => p.rung === 'resource').length,
            thread: view.view === 'thread' ? pinnedFacts.filter(p => p.rung === 'thread').length : null,
          };

          const activity = await store.listActivity({ scope, limit: 1 });

          const payload: KnowledgeGraphPayload = {
            view: view.view,
            ...(view.threadId ? { threadId: view.threadId } : {}),
            nodes: entities.map(entity => ({
              id: entity.id,
              name: entity.name,
              kind: entity.kind,
              scope: entity.scope,
              rung: deepestRung(entity.scope),
              pinned: accented.has(entity.id),
              factCount: factCounts.get(entity.id) ?? 0,
              createdAt: entity.createdAt.toISOString(),
              updatedAt: entity.updatedAt.toISOString(),
            })),
            edges,
            memories,
            truncated,
            outOfWindow: [...resolver.outOfWindow.values()],
            unresolvedCapped: { count: resolver.cappedCount, names: resolver.cappedNames },
            pinCensus,
            version: activity[0]?.id ?? null,
          };
          return c.json(payload);
        },
      }),

      // ── Entity flyout payload: details + provenance-rich facts ─────────────
      registerApiRoute('/web/factory/projects/:id/knowledge/entities/:entityId', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const view = await this.#resolveView(loose(c));
          if ('response' in view) return view.response;
          const { store, scope } = view;
          const entityId = loose(c).req.param('entityId');
          if (!entityId || entityId.length > 512) return c.json({ error: 'entity_not_found' }, 404);

          const entity = await store.getNode(entityId);
          // getEntity is a bare id lookup with NO scope predicate — the
          // visibility check here is what keeps this from being an IDOR.
          if (!entity || !isKnowledgeScopeVisible(entity.scope, scope)) {
            return c.json({ error: 'entity_not_found' }, 404);
          }

          const pinnedIds = await this.#pinnedEntityIds(view);
          const pinnedIdSet = new Set(pinnedIds.map(p => p.id));

          const [owned, touching] = await Promise.all([
            store.itemsAbout({ nodeId: entity.id, scope, limit: 200 }),
            store.itemsTouching({ nodeId: entity.id, scope, limit: 200 }),
          ]);
          const seen = new Set<string>();
          const facts: KnowledgeEntityFactPayload[] = [];
          const push = (fact: KnowledgeItem, relation: 'owned' | 'mentions') => {
            if (seen.has(fact.id)) return;
            seen.add(fact.id);
            facts.push({
              id: fact.id,
              parentEntityId: fact.parentNodeId,
              relation,
              text: fact.text,
              scope: fact.scope,
              rung: deepestRung(fact.scope),
              sourceThreadId: fact.sourceThreadId,
              capturedAt: fact.capturedAt.toISOString(),
              ...(fact.when ? { when: fact.when.toISOString() } : {}),
              pinned: pinnedIdSet.has(fact.parentNodeId),
              ...(fact.metadata ? { metadata: fact.metadata } : {}),
            });
          };
          // Owned first (newest-first within each group — fact ids are ULIDs).
          for (const fact of [...owned.items].sort((a, b) => b.id.localeCompare(a.id))) push(fact, 'owned');
          for (const fact of [...touching.items].sort((a, b) => b.id.localeCompare(a.id))) {
            if (fact.parentNodeId !== entity.id) push(fact, 'mentions');
          }

          const payload: KnowledgeEntityPayload = {
            entity: {
              id: entity.id,
              name: entity.name,
              kind: entity.kind,
              scope: entity.scope,
              rung: deepestRung(entity.scope),
              createdAt: entity.createdAt.toISOString(),
              updatedAt: entity.updatedAt.toISOString(),
            },
            facts,
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
