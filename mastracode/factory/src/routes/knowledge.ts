import type { Knowledge } from '@mastra/core/knowledge';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { KnowledgeNode, KnowledgeRecord, KnowledgeScopeIds, KnowledgeStorage } from '@mastra/core/storage';
import {
  isKnowledgeNodeVisible,
  isKnowledgeScopeVisible,
  knowledgeScopeIdsKey,
  parseKnowledgeWikilinks,
  createKnowledgeNodeCursor,
} from '@mastra/core/storage';
import type { Context } from 'hono';

import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';

const PINNED_NODE_NAME = 'pinned';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface KnowledgeRouteLimits {
  maxNodes: number;
  maxRecords: number;
  maxFallbackLookups: number;
}

const DEFAULT_LIMITS: KnowledgeRouteLimits = { maxNodes: 500, maxRecords: 2000, maxFallbackLookups: 100 };

export interface KnowledgeRoutesDeps extends RouteDependencies {
  projects: FactoryProjectsStorage;
  knowledge: () => Promise<Knowledge | undefined>;
  limits?: Partial<KnowledgeRouteLimits>;
}

export interface KnowledgeGraphNode {
  id: string;
  name: string;
  kind: string;
  description?: string;
  scopeIds: KnowledgeScopeIds;
  rung: 'org' | 'resource' | 'thread';
  pinned: boolean;
  recordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'wikilink';
  recordId: string;
  pinned?: boolean;
}

export interface KnowledgeGraphRecord {
  id: string;
  nodeIds: string[];
  pinned: boolean;
  text: string;
}

export interface KnowledgeScopeTreeNode {
  id: string;
  name: string;
  kind: string;
  description?: string;
  parentScopeIds: KnowledgeScopeIds;
}

export interface KnowledgeScopeTreePayload {
  scope: KnowledgeScopeTreeNode;
  children: KnowledgeScopeTreeNode[];
  nextCursor?: string;
}

export interface KnowledgeGraphPayload {
  view: 'project' | 'thread';
  scopeId: string;
  threadId?: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  records: KnowledgeGraphRecord[];
  truncated: boolean;
  outOfWindow: Array<{ id: string; name: string }>;
  unresolvedCapped: { count: number; names: string[] };
  pinCensus: { resource: number; thread: number | null };
  version: string | null;
}

export interface KnowledgeNodeRecordPayload {
  id: string;
  nodeId: string;
  relation: 'owned' | 'mentions';
  text: string;
  scopeIds: KnowledgeScopeIds;
  rung: 'org' | 'resource' | 'thread';
  sourceThreadId?: string;
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
    scopeIds: KnowledgeScopeIds;
    rung: 'org' | 'resource' | 'thread';
    createdAt: string;
    updatedAt: string;
  };
  records: KnowledgeNodeRecordPayload[];
}

function loose(c: unknown): Context {
  return c as Context;
}

function boundedThreadId(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 && trimmed.length <= 512 ? trimmed : undefined;
}

interface ResolvedView {
  store: KnowledgeStorage;
  view: 'project' | 'thread';
  threadId?: string;
  scopeIds: KnowledgeScopeIds;
  orgScopeId: string;
  resourceScopeId: string;
  threadScopeId?: string;
  pinRungs: Array<{ rung: 'resource' | 'thread'; scopeId: string }>;
}

function rungForScopeIds(scopeIds: KnowledgeScopeIds, view: ResolvedView): 'org' | 'resource' | 'thread' {
  if (view.threadScopeId && scopeIds.includes(view.threadScopeId)) return 'thread';
  if (scopeIds.includes(view.resourceScopeId)) return 'resource';
  return 'org';
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : undefined;
}

class WikilinkResolver {
  readonly #inWindow = new Map<string, KnowledgeNode>();
  readonly #windowIds = new Set<string>();
  readonly #fallbackCache = new Map<string, KnowledgeNode | null>();
  #fallbackLookups = 0;
  readonly #store: KnowledgeStorage;
  readonly #maxFallbackLookups: number;
  readonly outOfWindow = new Map<string, { id: string; name: string }>();
  readonly cappedNames: string[] = [];
  readonly #cappedSeen = new Set<string>();

  private constructor(store: KnowledgeStorage, maxFallbackLookups: number) {
    this.#store = store;
    this.#maxFallbackLookups = maxFallbackLookups;
  }

  static async create(store: KnowledgeStorage, nodes: KnowledgeNode[], maxFallbackLookups: number) {
    const resolver = new WikilinkResolver(store, maxFallbackLookups);
    await Promise.all(
      nodes.map(async node => {
        const scopeIds = await store.getNodeScopeIds(node.id);
        resolver.#inWindow.set(`${knowledgeScopeIdsKey(scopeIds)}\u0000${node.name.trim().toLocaleLowerCase()}`, node);
        resolver.#windowIds.add(node.id);
      }),
    );
    return resolver;
  }

  inWindowId(id: string): boolean {
    return this.#windowIds.has(id);
  }

  async resolve(name: string, scopeIds: KnowledgeScopeIds): Promise<KnowledgeNode | null> {
    const lower = name.trim().toLocaleLowerCase();
    const exact = this.#inWindow.get(`${knowledgeScopeIdsKey(scopeIds)}\u0000${lower}`);
    if (exact) return exact;
    const cacheKey = `${knowledgeScopeIdsKey(scopeIds)}\u0000${lower}`;
    if (this.#fallbackCache.has(cacheKey)) return this.#track(this.#fallbackCache.get(cacheKey) ?? null);
    if (this.#fallbackLookups >= this.#maxFallbackLookups) {
      if (!this.#cappedSeen.has(lower)) {
        this.#cappedSeen.add(lower);
        if (this.cappedNames.length < 100) this.cappedNames.push(name.trim());
      }
      return null;
    }
    this.#fallbackLookups += 1;
    const resolved = await this.#store.resolveNode({ name, scopeIds }).catch(() => null);
    this.#fallbackCache.set(cacheKey, resolved);
    return this.#track(resolved);
  }

  #track(node: KnowledgeNode | null): KnowledgeNode | null {
    if (node && !this.#windowIds.has(node.id)) this.outOfWindow.set(node.id, { id: node.id, name: node.name });
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

  async #resolveView(
    c: Context,
    preflight: { scopeId?: string; nodeId?: string } = {},
  ): Promise<ResolvedView | { response: Response }> {
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
    const projectId = c.req.param('id');
    if (!projectId || !UUID_RE.test(projectId)) return { response: c.json({ error: 'Project not found' }, 404) };
    await this.deps.projects.ensureReady();
    if (!(await this.deps.projects.get({ orgId: tenant.orgId, id: projectId }))) {
      return { response: c.json({ error: 'Project not found' }, 404) };
    }
    const knowledge = await this.deps.knowledge().catch(() => undefined);
    if (!knowledge) {
      return {
        response: c.json(
          { error: 'knowledge_unavailable', message: 'The configured Knowledge runtime is unavailable.' },
          503,
        ),
      };
    }
    const store = await knowledge.getStorage().catch(() => undefined);
    if (!store) {
      return {
        response: c.json(
          { error: 'knowledge_unavailable', message: 'The configured Knowledge runtime is unavailable.' },
          503,
        ),
      };
    }

    const requestedThreadId = c.req.query('threadId');
    const threadId = boundedThreadId(requestedThreadId);
    if (requestedThreadId !== undefined && !threadId) return { response: c.json({ error: 'thread_not_found' }, 404) };
    const threadAddress = threadId ? `resource:${projectId}:thread:${threadId}` : undefined;
    const thread = threadAddress ? await store.getScopeAddress(threadAddress) : undefined;
    if (threadAddress && !thread) return { response: c.json({ error: 'thread_not_found' }, 404) };

    const orgAddress = `org:${tenant.orgId}`;
    const resourceAddress = `resource:${projectId}`;
    if (preflight.scopeId || preflight.nodeId) {
      const [existingOrg, existingResource] = await Promise.all([
        store.getScopeAddress(orgAddress),
        store.getScopeAddress(resourceAddress),
      ]);
      if (!existingOrg || !existingResource) return { response: c.json({ error: 'scope_not_found' }, 404) };
      const visibleScopeIds = [
        existingOrg.scopeNodeId,
        existingResource.scopeNodeId,
        ...(thread ? [thread.scopeNodeId] : []),
      ];
      if (preflight.scopeId) {
        if (!UUID_RE.test(preflight.scopeId)) return { response: c.json({ error: 'scope_not_found' }, 404) };
        const scope = await store.getNode(preflight.scopeId);
        if (!scope?.isScope || scope.deletedAt) return { response: c.json({ error: 'scope_not_found' }, 404) };
        const frontier = new Set(visibleScopeIds);
        const pending = [scope.id];
        const visited = new Set<string>();
        let reachable = false;
        while (pending.length > 0 && visited.size <= this.#limits.maxNodes) {
          const current = pending.pop()!;
          if (frontier.has(current)) {
            reachable = true;
            break;
          }
          if (visited.has(current)) continue;
          visited.add(current);
          pending.push(...(await store.getNodeScopeIds(current)));
        }
        if (!reachable) {
          return { response: c.json({ error: 'scope_not_found' }, 404) };
        }
      }
      if (preflight.nodeId) {
        if (!UUID_RE.test(preflight.nodeId)) return { response: c.json({ error: 'node_not_found' }, 404) };
        const node = await store.getNode(preflight.nodeId);
        if (!node || node.deletedAt) return { response: c.json({ error: 'node_not_found' }, 404) };
        const nodeScopeIds = await store.getNodeScopeIds(node.id);
        const selectedScopeId = preflight.scopeId ?? thread?.scopeNodeId ?? existingResource.scopeNodeId;
        if (!isKnowledgeNodeVisible(node, nodeScopeIds, [selectedScopeId])) {
          return { response: c.json({ error: 'node_not_found' }, 404) };
        }
      }
    }

    const org = await knowledge.materializeScope({
      address: orgAddress,
      contextualScopeAddress: orgAddress,
      parameters: { orgId: tenant.orgId },
    });
    const resource = await knowledge.materializeScope({
      address: resourceAddress,
      parentAddresses: [orgAddress],
      contextualScopeAddress: orgAddress,
      parameters: { orgId: tenant.orgId, resourceId: projectId },
    });
    const orgScopeId = org.scopes[orgAddress]!;
    const resourceScopeId = resource.scopes[resourceAddress]!;
    const defaultScopeIds = [orgScopeId, resourceScopeId];
    if (!threadId) {
      return {
        store,
        view: 'project',
        scopeIds: defaultScopeIds,
        orgScopeId,
        resourceScopeId,
        pinRungs: [{ rung: 'resource', scopeId: resourceScopeId }],
      };
    }
    const threadScopeId = thread!.scopeNodeId;
    const scopeIds = [...defaultScopeIds, threadScopeId];
    const probe = await store.listRecordsBySource({ source: threadId, scopeIds, limit: 1 });
    if (probe.records.length === 0) return { response: c.json({ error: 'thread_not_found' }, 404) };
    return {
      store,
      view: 'thread',
      threadId,
      scopeIds,
      orgScopeId,
      resourceScopeId,
      threadScopeId,
      pinRungs: [
        { rung: 'resource', scopeId: resourceScopeId },
        { rung: 'thread', scopeId: threadScopeId },
      ],
    };
  }

  async #pinnedNodeIds(
    view: ResolvedView,
  ): Promise<Array<{ rung: 'resource' | 'thread'; scopeId: string; id: string }>> {
    const out: Array<{ rung: 'resource' | 'thread'; scopeId: string; id: string }> = [];
    for (const { rung, scopeId } of view.pinRungs) {
      const node = await view.store.getNodeByName({ name: PINNED_NODE_NAME, scopeIds: [scopeId] });
      if (node && !node.deletedAt) out.push({ rung, scopeId, id: node.id });
    }
    return out;
  }

  async #pinnedRecords(view: ResolvedView, ids: Array<{ rung: 'resource' | 'thread'; scopeId: string; id: string }>) {
    const out: Array<{ rung: 'resource' | 'thread'; record: KnowledgeRecord }> = [];
    for (const { rung, scopeId, id } of ids) {
      const { records } = await view.store.listRecords({
        node: id,
        scopeIds: view.scopeIds,
        membershipScopeIds: [scopeId],
        limit: 200,
      });
      for (const record of records) out.push({ rung, record });
    }
    return out;
  }

  async #resolveSelectedScope(view: ResolvedView, rawScopeId: string | undefined): Promise<KnowledgeNode | null> {
    const scopeId = rawScopeId ?? view.threadScopeId ?? view.resourceScopeId;
    if (!UUID_RE.test(scopeId)) return null;
    const scope = await view.store.getNode(scopeId);
    if (!scope?.isScope || scope.deletedAt) return null;

    const frontier = new Set(view.scopeIds);
    const pending = [scope.id];
    const visited = new Set<string>();
    while (pending.length > 0 && visited.size <= this.#limits.maxNodes) {
      const current = pending.pop()!;
      if (frontier.has(current)) return scope;
      if (visited.has(current)) continue;
      visited.add(current);
      pending.push(...(await view.store.getNodeScopeIds(current)));
    }
    return null;
  }

  async #scopeTreeNode(store: KnowledgeStorage, node: KnowledgeNode): Promise<KnowledgeScopeTreeNode> {
    const description = metadataString(node.metadata, 'description');
    return {
      id: node.id,
      name: node.name,
      kind: node.kind ?? 'scope',
      ...(description ? { description } : {}),
      parentScopeIds: await store.getNodeScopeIds(node.id),
    };
  }

  routes(): ApiRoute[] {
    return [
      registerApiRoute('/web/factory/projects/:id/knowledge/scopes', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const scopeId = loose(c).req.query('scopeId');
          const view = await this.#resolveView(loose(c), { scopeId });
          if ('response' in view) return view.response;
          const selected = await this.#resolveSelectedScope(view, scopeId);
          if (!selected) return loose(c).json({ error: 'scope_not_found' }, 404);
          const cursor = loose(c).req.query('cursor');
          const fetched = await view.store.listNodes({
            scopeIds: [selected.id],
            isScope: true,
            ...(cursor ? { cursor } : {}),
            limit: this.#limits.maxNodes + 2,
          });
          const eligible: Array<{ node: KnowledgeNode; parentScopeIds: KnowledgeScopeIds }> = [];
          for (const node of fetched) {
            if (node.id === selected.id) continue;
            const parentScopeIds = await view.store.getNodeScopeIds(node.id);
            if (parentScopeIds.includes(selected.id)) eligible.push({ node, parentScopeIds });
          }
          const page = eligible.slice(0, this.#limits.maxNodes);
          const children: KnowledgeScopeTreeNode[] = page.map(({ node, parentScopeIds }) => {
            const description = metadataString(node.metadata, 'description');
            return {
              id: node.id,
              name: node.name,
              kind: node.kind ?? 'scope',
              ...(description ? { description } : {}),
              parentScopeIds,
            };
          });
          const last = eligible.length > this.#limits.maxNodes ? page.at(-1)?.node : undefined;
          return loose(c).json({
            scope: await this.#scopeTreeNode(view.store, selected),
            children,
            ...(last ? { nextCursor: createKnowledgeNodeCursor(last, { isScope: true }) } : {}),
          } satisfies KnowledgeScopeTreePayload);
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/subgraph', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const scopeId = loose(c).req.query('scopeId');
          const view = await this.#resolveView(loose(c), { scopeId });
          if ('response' in view) return view.response;
          const selected = await this.#resolveSelectedScope(view, scopeId);
          if (!selected) return loose(c).json({ error: 'scope_not_found' }, 404);
          const { store } = view;
          const scopeIds = [selected.id];
          const resolutionScopeIds = [...new Set([...view.scopeIds, selected.id])];
          const selectedView: ResolvedView = {
            ...view,
            scopeIds: resolutionScopeIds,
            pinRungs: view.pinRungs.filter(rung => rung.scopeId === selected.id),
          };
          const fetched = await store.listNodes({ scopeIds, isScope: false, limit: this.#limits.maxNodes + 1 });
          let truncated = fetched.length > this.#limits.maxNodes;
          const pinnedNodeIds = await this.#pinnedNodeIds(selectedView);
          const pinnedNodeIdSet = new Set(pinnedNodeIds.map(value => value.id));
          const nodes = fetched.slice(0, this.#limits.maxNodes).filter(node => !pinnedNodeIdSet.has(node.id));
          const recordWindow: KnowledgeRecord[] = [];
          for (const node of nodes) {
            if (recordWindow.length > this.#limits.maxRecords) break;
            const result = await store.listRecords({
              node,
              scopeIds: resolutionScopeIds,
              membershipScopeIds: scopeIds,
              limit: this.#limits.maxRecords + 1 - recordWindow.length,
            });
            recordWindow.push(...result.records);
          }
          recordWindow.sort((a, b) => b.id.localeCompare(a.id));
          if (recordWindow.length > this.#limits.maxRecords) {
            truncated = true;
            recordWindow.length = this.#limits.maxRecords;
          }
          const resolver = await WikilinkResolver.create(store, nodes, this.#limits.maxFallbackLookups);
          const edges: KnowledgeGraphEdge[] = [];
          const boundaryNodes = new Map<string, KnowledgeNode>();
          const edgeSeen = new Set<string>();
          const recordCounts = new Map<string, number>();
          for (const record of recordWindow) {
            recordCounts.set(record.nodeId, (recordCounts.get(record.nodeId) ?? 0) + 1);
            const nodeIds = [record.nodeId];
            for (const name of parseKnowledgeWikilinks(record.text)) {
              const target = await resolver.resolve(name, resolutionScopeIds);
              if (!target || target.id === record.nodeId) continue;
              if (!resolver.inWindowId(target.id)) {
                if (!boundaryNodes.has(target.id) && nodes.length + boundaryNodes.size >= this.#limits.maxNodes)
                  continue;
                boundaryNodes.set(target.id, target);
              }
              if (!nodeIds.includes(target.id)) nodeIds.push(target.id);
              const key = `${record.nodeId}\u0000${target.id}`;
              if (edgeSeen.has(key)) continue;
              edgeSeen.add(key);
              edges.push({
                id: `wikilink:${record.nodeId}:${target.id}`,
                source: record.nodeId,
                target: target.id,
                type: 'wikilink',
                recordId: record.id,
              });
            }
          }
          const pinnedRecords = await this.#pinnedRecords(selectedView, pinnedNodeIds);
          const accented = new Set<string>();
          for (const { record } of pinnedRecords) {
            const targets: string[] = [];
            for (const name of parseKnowledgeWikilinks(record.text)) {
              const target = await resolver.resolve(name, resolutionScopeIds);
              if (target && resolver.inWindowId(target.id) && !targets.includes(target.id)) targets.push(target.id);
            }
            if (targets.length === 1) accented.add(targets[0]!);
            for (let a = 0; a < targets.length; a++) {
              for (let b = a + 1; b < targets.length; b++) {
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
          const activity = await store.listActivity({ scopeIds, limit: 1 });
          const graphNodes = await Promise.all(
            [...nodes, ...boundaryNodes.values()].map(async node => {
              const nodeScopeIds = await store.getNodeScopeIds(node.id);
              const description = metadataString(node.metadata, 'description');
              return {
                id: node.id,
                name: node.name,
                kind: node.kind ?? 'concept',
                ...(description ? { description } : {}),
                scopeIds: nodeScopeIds,
                rung: rungForScopeIds(nodeScopeIds, view),
                pinned: accented.has(node.id),
                recordCount: recordCounts.get(node.id) ?? 0,
                createdAt: node.createdAt.toISOString(),
                updatedAt: node.updatedAt.toISOString(),
              };
            }),
          );
          const payload: KnowledgeGraphPayload = {
            view: view.view,
            scopeId: selected.id,
            ...(view.threadId ? { threadId: view.threadId } : {}),
            nodes: graphNodes,
            edges,
            records: [],
            truncated,
            outOfWindow: [...resolver.outOfWindow.values()],
            unresolvedCapped: { count: resolver.cappedCount, names: resolver.cappedNames },
            pinCensus: {
              resource: pinnedRecords.filter(value => value.rung === 'resource').length,
              thread: view.view === 'thread' ? pinnedRecords.filter(value => value.rung === 'thread').length : null,
            },
            version: activity[0]?.id ?? null,
          };
          return c.json(payload);
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/nodes/:nodeId', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const scopeId = loose(c).req.query('scopeId');
          const nodeId = loose(c).req.param('nodeId');
          if (!nodeId || nodeId.length > 512) return c.json({ error: 'node_not_found' }, 404);
          const view = await this.#resolveView(loose(c), { scopeId, nodeId });
          if ('response' in view) return view.response;
          const selected = await this.#resolveSelectedScope(view, scopeId);
          if (!selected) return loose(c).json({ error: 'scope_not_found' }, 404);
          const node = await view.store.getNode(nodeId);
          const nodeScopeIds = node ? await view.store.getNodeScopeIds(node.id) : [];
          if (!node || !isKnowledgeNodeVisible(node, nodeScopeIds, [selected.id]))
            return c.json({ error: 'node_not_found' }, 404);
          const visibilityScopeIds = [...new Set([...view.scopeIds, selected.id])];
          const selectedView: ResolvedView = {
            ...view,
            scopeIds: visibilityScopeIds,
            pinRungs: view.pinRungs.filter(rung => rung.scopeId === selected.id),
          };
          const pinnedNodeIds = await this.#pinnedNodeIds(selectedView);
          const pinnedNodeIdSet = new Set(pinnedNodeIds.map(value => value.id));
          const [owned, mentioning] = await Promise.all([
            view.store.listRecords({
              node,
              scopeIds: visibilityScopeIds,
              membershipScopeIds: [selected.id],
              limit: 200,
            }),
            view.store.listMentioningRecords({
              node,
              scopeIds: visibilityScopeIds,
              membershipScopeIds: [selected.id],
              limit: 200,
            }),
          ]);
          const seen = new Set<string>();
          const records: KnowledgeNodeRecordPayload[] = [];
          const push = async (record: KnowledgeRecord, relation: 'owned' | 'mentions') => {
            if (seen.has(record.id)) return;
            seen.add(record.id);
            const recordScopeIds = await view.store.getRecordScopeIds(record.id);
            const when = metadataString(record.metadata, 'when');
            records.push({
              id: record.id,
              nodeId: record.nodeId,
              relation,
              text: record.text,
              scopeIds: recordScopeIds,
              rung: rungForScopeIds(recordScopeIds, view),
              ...(metadataString(record.metadata, 'sourceThreadId')
                ? { sourceThreadId: metadataString(record.metadata, 'sourceThreadId') }
                : {}),
              capturedAt: record.createdAt.toISOString(),
              ...(when ? { when } : {}),
              pinned: pinnedNodeIdSet.has(record.nodeId),
              ...(record.metadata ? { metadata: record.metadata } : {}),
            });
          };
          for (const record of [...owned.records].sort((a, b) => b.id.localeCompare(a.id))) await push(record, 'owned');
          for (const record of [...mentioning.records].sort((a, b) => b.id.localeCompare(a.id)))
            await push(record, 'mentions');
          const payload: KnowledgeNodePayload = {
            node: {
              id: node.id,
              name: node.name,
              kind: node.kind ?? 'concept',
              ...(metadataString(node.metadata, 'description')
                ? { description: metadataString(node.metadata, 'description') }
                : {}),
              scopeIds: nodeScopeIds,
              rung: rungForScopeIds(nodeScopeIds, view),
              createdAt: node.createdAt.toISOString(),
              updatedAt: node.updatedAt.toISOString(),
            },
            records,
          };
          return c.json(payload);
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/activity', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const view = await this.#resolveView(loose(c));
          if ('response' in view) return view.response;
          const events = await view.store.listActivity({ scopeIds: view.scopeIds, limit: 100 });
          return c.json({
            events: events.map(event => ({
              id: event.id,
              action: event.action,
              targetType: event.targetType,
              createdAt: event.createdAt.toISOString(),
            })),
          });
        },
      }),
    ];
  }
}
