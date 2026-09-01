import { randomUUID } from 'node:crypto';

import type { Knowledge } from '@mastra/core/knowledge';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type {
  KnowledgeImportRun,
  KnowledgeImportRunStatus,
  KnowledgeProposal,
  KnowledgeProposalStatus,
  KnowledgeImportTriggerKind,
  KnowledgeActivityAction,
  KnowledgeNode,
  KnowledgeRecord,
  KnowledgeScopeIds,
  KnowledgeStorage,
} from '@mastra/core/storage';
import {
  isKnowledgeScopeVisible,
  knowledgeScopeIdsKey,
  knowledgeImporterBindingKey,
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
}

export interface KnowledgeScopeTreePayload {
  scope: KnowledgeScopeTreeNode;
  children: KnowledgeScopeTreeNode[];
  nextCursor?: string;
}

export interface KnowledgeGraphPayload {
  view: 'project' | 'thread';
  scopeId: string;
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
  createdAt: string;
  when?: string;
  reason?: string;
  pinned: boolean;
}

export interface KnowledgeNodePayload {
  node: {
    id: string;
    name: string;
    kind: string;
    createdAt: string;
    updatedAt: string;
  };
  records: KnowledgeNodeRecordPayload[];
}

export interface KnowledgeImporterSummary {
  id: string;
  importKind: 'static' | 'agentic';
  triggers: KnowledgeImportTriggerKind[];
  bindings: Array<{ source: string; binding: string }>;
  lastRun?: KnowledgeImportRunPayload;
}

export interface KnowledgeImportRunPayload {
  id: string;
  importerId: string;
  binding: string;
  source?: string;
  importKind: KnowledgeImportRun['importKind'];
  triggerKind: KnowledgeImportRun['triggerKind'];
  status: KnowledgeImportRun['status'];
  error?: string;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface KnowledgeImportRunDetailPayload {
  run: KnowledgeImportRunPayload;
  activity: Array<{ id: string; action: string; targetType: string; createdAt: string }>;
}

export interface KnowledgeProposalPayload {
  id: string;
  operation: string;
  status: KnowledgeProposalStatus;
  reason?: string;
  reviewReason?: string;
  targets: Array<{
    type: 'node' | 'record';
    id: string;
    name?: string;
    expectedVersion: number;
    currentVersion?: number;
  }>;
  proposer: 'visible' | 'private';
  reviewer?: 'visible' | 'private';
  actions: Array<'approve' | 'reject' | 're-review'>;
  createdAt: string;
  reviewedAt?: string;
}

function loose(c: unknown): Context {
  return c as Context;
}

function boundedThreadId(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 && trimmed.length <= 512 ? trimmed : undefined;
}

function knowledgePerspectiveKey(projectId: string, threadId?: string): string {
  return threadId ? `${projectId}\u0000${threadId}` : projectId;
}

interface ResolvedView {
  projectId: string;
  knowledge: Knowledge;
  store: KnowledgeStorage;
  view: 'project' | 'thread';
  threadId?: string;
  scopeIds: KnowledgeScopeIds;
  perspectiveKey: string;
  readableScopeIds: KnowledgeScopeIds;
  orgScopeId: string;
  resourceScopeId: string;
  threadScopeId?: string;
  pinScopes: Array<{ level: 'resource' | 'thread'; scopeId: string }>;
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : undefined;
}

function importBinding(binding: string): { source?: string; scopeAddress?: string } {
  try {
    const parsed: unknown = JSON.parse(binding);
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string'
    ) {
      return { source: parsed[0], scopeAddress: parsed[1] };
    }
  } catch {
    // Older or host-managed bindings may be opaque to this read surface.
  }
  return {};
}

function importScopeBelongsToProject(scope: string | undefined, projectId: string): boolean {
  return scope === `resource:${projectId}`;
}

function importRunBelongsToProject(run: KnowledgeImportRun, projectId: string): boolean {
  return importScopeBelongsToProject(importBinding(run.binding).scopeAddress, projectId);
}

async function proposalPayload(
  knowledge: Knowledge,
  proposal: KnowledgeProposal,
  scopeIds: KnowledgeScopeIds,
  handle: (kind: 'proposal' | 'node' | 'record', value: string) => string,
  allowActions = true,
): Promise<KnowledgeProposalPayload | null> {
  const currentTargets = await Promise.all(
    proposal.targets.map(target =>
      target.type === 'node'
        ? knowledge.getNode({ id: target.id, scopeIds })
        : knowledge.getRecord({ id: target.id, scopeIds }),
    ),
  );
  if (currentTargets.some(target => !target)) return null;

  const frontier = await knowledge.evaluateAccess(scopeIds);
  const canReview =
    allowActions &&
    proposal.targets.every(target =>
      target.scopeIds.every(scopeId => frontier.scopes[scopeId]?.[target.approvalCapability]),
    );
  const actions: KnowledgeProposalPayload['actions'] = !canReview
    ? []
    : proposal.status === 'pending'
      ? ['approve', 'reject']
      : proposal.status === 'conflicted'
        ? ['re-review']
        : [];
  return {
    id: handle('proposal', proposal.id),
    operation: proposal.operation,
    status: proposal.status,
    reason: proposal.reason,
    reviewReason: proposal.reviewReason,
    targets: proposal.targets.map((target, index) => {
      const current = currentTargets[index]!;
      if (target.type === 'node') {
        return {
          type: target.type,
          id: handle('node', target.id),
          name: 'name' in current ? current.name : undefined,
          expectedVersion: target.expectedVersion,
          currentVersion: current.version,
        };
      }
      return {
        type: target.type,
        id: handle('record', target.id),
        expectedVersion: target.expectedVersion,
        currentVersion: current.version,
      };
    }),
    proposer:
      proposal.proposerContextScopeId && frontier.scopes[proposal.proposerContextScopeId]?.read ? 'visible' : 'private',
    reviewer:
      proposal.reviewerContextScopeId && frontier.scopes[proposal.reviewerContextScopeId]?.read
        ? 'visible'
        : proposal.reviewedAt
          ? 'private'
          : undefined,
    actions,
    createdAt: proposal.createdAt.toISOString(),
    reviewedAt: proposal.reviewedAt?.toISOString(),
  };
}

function activityAction(value: string | undefined): KnowledgeActivityAction | undefined {
  if (
    value === 'create' ||
    value === 'edit' ||
    value === 'delete' ||
    value === 'restore' ||
    value === 'move' ||
    value === 'merge' ||
    value === 'promote' ||
    value === 'demote' ||
    value === 'stamp' ||
    value === 'rebind' ||
    value === 'propose' ||
    value === 'approve' ||
    value === 'reject' ||
    value === 'conflict'
  ) {
    return value;
  }
  return undefined;
}

function importRunStatus(value: string | undefined): KnowledgeImportRunStatus | undefined {
  if (
    value === 'queued' ||
    value === 'running' ||
    value === 'succeeded' ||
    value === 'failed' ||
    value === 'skipped' ||
    value === 'interrupted'
  ) {
    return value;
  }
  return undefined;
}

function importTriggerKind(value: string | undefined): KnowledgeImportTriggerKind | undefined {
  if (value === 'cron' || value === 'webhook' || value === 'programmatic') return value;
  return undefined;
}

function boundedDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

class WikilinkResolver {
  readonly #inWindow = new Map<string, KnowledgeNode>();
  readonly #windowIds = new Set<string>();
  readonly #fallbackCache = new Map<string, KnowledgeNode | null>();
  #fallbackLookups = 0;
  readonly #knowledge: Knowledge;
  readonly #store: KnowledgeStorage;
  readonly #maxFallbackLookups: number;
  readonly outOfWindow = new Map<string, { id: string; name: string }>();
  readonly cappedNames: string[] = [];
  readonly #cappedSeen = new Set<string>();

  private constructor(knowledge: Knowledge, store: KnowledgeStorage, maxFallbackLookups: number) {
    this.#knowledge = knowledge;
    this.#store = store;
    this.#maxFallbackLookups = maxFallbackLookups;
  }

  static async create(
    knowledge: Knowledge,
    store: KnowledgeStorage,
    nodes: KnowledgeNode[],
    maxFallbackLookups: number,
  ) {
    const resolver = new WikilinkResolver(knowledge, store, maxFallbackLookups);
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
    const resolved = await this.#knowledge.getNodeByName({ name, scopeIds }).catch(() => null);
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

type KnowledgeSurfaceHandleKind = 'scope' | 'node' | 'record' | 'proposal' | 'run' | 'binding' | 'cursor';

interface KnowledgeSurfaceHandle {
  projectId: string;
  perspectiveKey: string;
  kind: KnowledgeSurfaceHandleKind;
  value: string;
  expiresAt: number;
}

export class KnowledgeRoutes extends Route<KnowledgeRoutesDeps> {
  readonly #limits: KnowledgeRouteLimits;
  readonly #handles = new Map<string, KnowledgeSurfaceHandle>();
  readonly #handlesByTarget = new Map<string, string>();
  readonly #handleTtlMs = 10 * 60_000;

  constructor(deps: KnowledgeRoutesDeps) {
    super(deps);
    this.#limits = { ...DEFAULT_LIMITS, ...deps.limits };
  }

  #mintHandle(projectId: string, perspectiveKey: string, kind: KnowledgeSurfaceHandleKind, value: string): string {
    const now = Date.now();
    const targetKey = `${projectId}\u0000${perspectiveKey}\u0000${kind}\u0000${value}`;
    const existing = this.#handlesByTarget.get(targetKey);
    if (existing) {
      const entry = this.#handles.get(existing);
      if (entry && entry.expiresAt > now) {
        entry.expiresAt = now + this.#handleTtlMs;
        return existing;
      }
      this.#handles.delete(existing);
      this.#handlesByTarget.delete(targetKey);
    }
    const handle = `kh_${randomUUID()}`;
    this.#handles.set(handle, { projectId, perspectiveKey, kind, value, expiresAt: now + this.#handleTtlMs });
    this.#handlesByTarget.set(targetKey, handle);
    return handle;
  }

  #resolveHandle(
    projectId: string,
    perspectiveKey: string,
    kind: KnowledgeSurfaceHandleKind,
    handle: string | undefined,
  ): string | undefined {
    if (!handle) return undefined;
    const entry = this.#handles.get(handle);
    if (
      !entry ||
      entry.projectId !== projectId ||
      entry.perspectiveKey !== perspectiveKey ||
      entry.kind !== kind ||
      entry.expiresAt <= Date.now()
    )
      return undefined;
    entry.expiresAt = Date.now() + this.#handleTtlMs;
    return entry.value;
  }

  #importRunPayload(projectId: string, perspectiveKey: string, run: KnowledgeImportRun): KnowledgeImportRunPayload {
    const binding = importBinding(run.binding);
    return {
      id: this.#mintHandle(projectId, perspectiveKey, 'run', run.id),
      importerId: run.importerId,
      binding: this.#mintHandle(projectId, perspectiveKey, 'binding', run.binding),
      source: binding.source,
      importKind: run.importKind,
      triggerKind: run.triggerKind,
      status: run.status,
      error: run.error,
      queuedAt: run.queuedAt.toISOString(),
      startedAt: run.startedAt?.toISOString(),
      completedAt: run.completedAt?.toISOString(),
    };
  }

  async #resolveOperator(c: Context): Promise<
    | {
        knowledge: Knowledge;
        orgId: string;
        projectId: string;
        scopeIds: KnowledgeScopeIds;
        perspectiveKey: string;
      }
    | { response: Response }
  > {
    await this.deps.auth.ensureUser(c);
    const tenant = this.deps.auth.tenant(c);
    if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) return { response: c.json({ error: 'organization_required' }, 403) };

    const projectId = c.req.param('id');
    if (!projectId || !UUID_RE.test(projectId)) return { response: c.json({ error: 'Project not found' }, 404) };
    await this.deps.projects.ensureReady();
    if (!(await this.deps.projects.get({ orgId: tenant.orgId, id: projectId }))) {
      return { response: c.json({ error: 'Project not found' }, 404) };
    }
    if (this.deps.auth.enabled() && !(await this.deps.auth.isOrganizationAdmin(c, tenant.orgId))) {
      return { response: c.json({ error: 'forbidden' }, 403) };
    }

    const knowledge = await this.deps.knowledge().catch(() => undefined);
    if (!knowledge || !(await knowledge.getStorageInternal().catch(() => undefined))) {
      return {
        response: c.json(
          { error: 'knowledge_unavailable', message: 'The configured Knowledge runtime is unavailable.' },
          503,
        ),
      };
    }
    const scopeIds = await this.#projectScopeIds(knowledge, tenant.orgId, projectId);
    return {
      knowledge,
      orgId: tenant.orgId,
      projectId,
      scopeIds,
      perspectiveKey: knowledgePerspectiveKey(projectId),
    };
  }

  async #projectScopeIds(knowledge: Knowledge, orgId: string, projectId: string): Promise<KnowledgeScopeIds> {
    const orgAddress = `org:${orgId}`;
    const resourceAddress = `resource:${projectId}`;
    const org = await knowledge.materializeScope({
      address: orgAddress,
      contextualScopeAddress: orgAddress,
      parameters: { orgId },
    });
    const resource = await knowledge.materializeScope({
      address: resourceAddress,
      parentAddresses: [orgAddress],
      contextualScopeAddress: orgAddress,
      parameters: { orgId, resourceId: projectId },
    });
    return [org.scopes[orgAddress]!, resource.scopes[resourceAddress]!];
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
    const store = await knowledge.getStorageInternal().catch(() => undefined);
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
        if (!reachable) return { response: c.json({ error: 'scope_not_found' }, 404) };
      }
      if (preflight.nodeId && !UUID_RE.test(preflight.nodeId)) {
        return { response: c.json({ error: 'node_not_found' }, 404) };
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
      const frontier = await knowledge.evaluateAccess(defaultScopeIds);
      return {
        projectId,
        knowledge,
        store,
        view: 'project',
        scopeIds: defaultScopeIds,
        perspectiveKey: knowledgePerspectiveKey(projectId),
        readableScopeIds: Object.entries(frontier.scopes)
          .filter(([, capabilities]) => capabilities.read)
          .map(([scopeId]) => scopeId),
        orgScopeId,
        resourceScopeId,
        pinScopes: [{ level: 'resource', scopeId: resourceScopeId }],
      };
    }
    const threadScopeId = thread!.scopeNodeId;
    const scopeIds = [...defaultScopeIds, threadScopeId];
    const frontier = await knowledge.evaluateAccess(scopeIds);
    const readableScopeIds = Object.entries(frontier.scopes)
      .filter(([, capabilities]) => capabilities.read)
      .map(([scopeId]) => scopeId);
    const probe = await knowledge.listRecordsBySource({ source: threadId, scopeIds, limit: 1 });
    if (probe.records.length === 0) return { response: c.json({ error: 'thread_not_found' }, 404) };
    return {
      projectId,
      knowledge,
      store,
      view: 'thread',
      threadId,
      scopeIds,
      perspectiveKey: knowledgePerspectiveKey(projectId, threadId),
      readableScopeIds,
      orgScopeId,
      resourceScopeId,
      threadScopeId,
      pinScopes: [
        { level: 'resource', scopeId: resourceScopeId },
        { level: 'thread', scopeId: threadScopeId },
      ],
    };
  }

  async #pinnedNodeIds(
    view: ResolvedView,
  ): Promise<Array<{ level: 'resource' | 'thread'; scopeId: string; id: string }>> {
    const out: Array<{ level: 'resource' | 'thread'; scopeId: string; id: string }> = [];
    for (const { level, scopeId } of view.pinScopes) {
      const node = (
        await view.knowledge.listNodes({
          scopeIds: view.scopeIds,
          membershipScopeIds: [scopeId],
          limit: this.#limits.maxNodes,
        })
      ).find(candidate => candidate.name === PINNED_NODE_NAME);
      if (node) out.push({ level, scopeId, id: node.id });
    }
    return out;
  }

  async #pinnedRecords(view: ResolvedView, ids: Array<{ level: 'resource' | 'thread'; scopeId: string; id: string }>) {
    const out: Array<{ level: 'resource' | 'thread'; record: KnowledgeRecord }> = [];
    for (const { level, scopeId, id } of ids) {
      const { records } = await view.knowledge.listRecords({
        node: id,
        scopeIds: view.scopeIds,
        membershipScopeIds: [scopeId],
        limit: 200,
      });
      for (const record of records) out.push({ level, record });
    }
    return out;
  }

  async #resolveSelectedScope(
    view: ResolvedView,
    rawScopeId: string | undefined,
    requireReadable = false,
  ): Promise<KnowledgeNode | null> {
    const scopeId = rawScopeId ?? view.threadScopeId ?? view.resourceScopeId;
    if (!UUID_RE.test(scopeId)) return null;
    const scope = await view.store.getNode(scopeId);
    if (!scope?.isScope || scope.deletedAt) return null;
    const roots = new Set([view.orgScopeId, view.resourceScopeId, ...(view.threadScopeId ? [view.threadScopeId] : [])]);
    const pending = [scope.id];
    const visited = new Set<string>();
    while (pending.length > 0 && visited.size <= this.#limits.maxNodes) {
      const current = pending.pop()!;
      if (roots.has(current)) {
        if (!requireReadable) return scope;
        return view.knowledge.getNode({ id: scope.id, scopeIds: view.scopeIds });
      }
      if (visited.has(current)) continue;
      visited.add(current);
      pending.push(...(await view.store.getNodeScopeIds(current)));
    }
    return null;
  }

  #scopeTreeNode(projectId: string, perspectiveKey: string, node: KnowledgeNode): KnowledgeScopeTreeNode {
    const description = metadataString(node.metadata, 'description');
    return {
      id: this.#mintHandle(projectId, perspectiveKey, 'scope', node.id),
      name: node.name,
      kind: node.kind ?? 'scope',
      ...(description ? { description } : {}),
    };
  }

  async #projectImportRuns(input: {
    knowledge: Knowledge;
    projectId: string;
    scopeIds: KnowledgeScopeIds;
    importerId: string;
    binding?: string;
    status?: KnowledgeImportRunStatus;
    trigger?: KnowledgeImportTriggerKind;
    from?: Date;
    to?: Date;
    after?: string;
    limit: number;
  }): Promise<{ runs: KnowledgeImportRun[]; nextCursor?: string }> {
    const runs: KnowledgeImportRun[] = [];
    let after = input.after;
    for (let pageIndex = 0; pageIndex < 100 && runs.length < input.limit; pageIndex += 1) {
      const page = await input.knowledge.listImportRuns({
        scopeIds: input.scopeIds,
        importerId: input.importerId,
        binding: input.binding,
        status: input.status,
        after,
        limit: 100,
      });
      for (const run of page.runs) {
        if (!importRunBelongsToProject(run, input.projectId)) continue;
        if (input.trigger && run.triggerKind !== input.trigger) continue;
        if (input.from && run.queuedAt < input.from) continue;
        if (input.to && run.queuedAt > input.to) continue;
        runs.push(run);
        if (runs.length === input.limit) return { runs, nextCursor: run.id };
      }
      if (!page.nextCursor) return { runs };
      after = page.nextCursor;
    }
    return { runs, nextCursor: after };
  }

  routes(): ApiRoute[] {
    return [
      registerApiRoute('/web/factory/projects/:id/knowledge/importers', {
        method: 'GET',
        requiresAuth: true,
        handler: async raw => {
          const c = loose(raw);
          const resolved = await this.#resolveOperator(c);
          if ('response' in resolved) return resolved.response;
          const importers = await Promise.all(
            resolved.knowledge.listImporters().map(async importer => {
              const triggerKinds: KnowledgeImportTriggerKind[] = ['programmatic'];
              if (importer.triggers.cron) triggerKinds.push('cron');
              if (importer.triggers.webhook) triggerKinds.push('webhook');
              const declaredBindings = [
                ...(importer.triggers.cron?.bindings ?? []),
                ...(importer.triggers.webhook?.bindings ?? []),
              ];
              const bindings = Array.from(
                new Map(declaredBindings.map(binding => [`${binding.source}\u0000${binding.scope}`, binding])).values(),
              )
                .filter(binding => importScopeBelongsToProject(binding.scope, resolved.projectId))
                .map(binding => ({
                  source: binding.source,
                  binding: this.#mintHandle(
                    resolved.projectId,
                    resolved.perspectiveKey,
                    'binding',
                    knowledgeImporterBindingKey(binding),
                  ),
                }));
              const lastRun = (
                await this.#projectImportRuns({
                  knowledge: resolved.knowledge,
                  projectId: resolved.projectId,
                  scopeIds: resolved.scopeIds,
                  importerId: importer.importerId,
                  limit: 1,
                })
              ).runs[0];
              if (bindings.length === 0 && !lastRun) return null;
              return {
                id: importer.importerId,
                importKind: importer.agentic ? ('agentic' as const) : ('static' as const),
                triggers: triggerKinds,
                bindings,
                lastRun: lastRun
                  ? this.#importRunPayload(resolved.projectId, resolved.perspectiveKey, lastRun)
                  : undefined,
              } satisfies KnowledgeImporterSummary;
            }),
          );
          return c.json({ importers: importers.filter(importer => importer !== null) });
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/importers/:importerId/runs', {
        method: 'GET',
        requiresAuth: true,
        handler: async raw => {
          const c = loose(raw);
          const resolved = await this.#resolveOperator(c);
          if ('response' in resolved) return resolved.response;
          const importerId = c.req.param('importerId')!;
          if (!resolved.knowledge.getImporter(importerId)) return c.json({ error: 'importer_not_found' }, 404);

          const rawStatus = c.req.query('status');
          const status = importRunStatus(rawStatus);
          const rawTrigger = c.req.query('trigger');
          const trigger = importTriggerKind(rawTrigger);
          const rawFrom = c.req.query('from');
          const from = boundedDate(rawFrom);
          const rawTo = c.req.query('to');
          const to = boundedDate(rawTo);
          if ((rawStatus && !status) || (rawTrigger && !trigger) || (rawFrom && !from) || (rawTo && !to)) {
            return c.json({ error: 'invalid_import_filters' }, 400);
          }
          const bindingHandle = c.req.query('binding');
          const binding = this.#resolveHandle(resolved.projectId, resolved.perspectiveKey, 'binding', bindingHandle);
          if (bindingHandle && !binding) return c.json({ runs: [] });
          const cursorHandle = c.req.query('cursor');
          const cursor = this.#resolveHandle(resolved.projectId, resolved.perspectiveKey, 'cursor', cursorHandle);
          if (cursorHandle && !cursor) return c.json({ runs: [] });
          const page = await this.#projectImportRuns({
            knowledge: resolved.knowledge,
            projectId: resolved.projectId,
            scopeIds: resolved.scopeIds,
            importerId,
            binding,
            status,
            trigger,
            from,
            to,
            after: cursor,
            limit: 100,
          });
          return c.json({
            runs: page.runs.map(run => this.#importRunPayload(resolved.projectId, resolved.perspectiveKey, run)),
            nextCursor: page.nextCursor
              ? this.#mintHandle(resolved.projectId, resolved.perspectiveKey, 'cursor', page.nextCursor)
              : undefined,
          });
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/importers/:importerId/runs/:runId', {
        method: 'GET',
        requiresAuth: true,
        handler: async raw => {
          const c = loose(raw);
          const resolved = await this.#resolveOperator(c);
          if ('response' in resolved) return resolved.response;
          const importerId = c.req.param('importerId')!;
          const importer = resolved.knowledge.getImporter(importerId);
          if (!importer) return c.json({ error: 'importer_not_found' }, 404);
          const runId = this.#resolveHandle(resolved.projectId, resolved.perspectiveKey, 'run', c.req.param('runId'));
          if (!runId) return c.json({ error: 'import_run_not_found' }, 404);
          const run = await resolved.knowledge.getImportRun({
            id: runId,
            scopeIds: resolved.scopeIds,
          });
          if (!run || run.importerId !== importerId || !importRunBelongsToProject(run, resolved.projectId)) {
            return c.json({ error: 'import_run_not_found' }, 404);
          }

          const store = await resolved.knowledge.getStorageInternal();
          const binding = importBinding(run.binding);
          const scope = binding.scopeAddress ? await store.getScopeAddress(binding.scopeAddress) : undefined;
          const activity = scope
            ? await resolved.knowledge.listActivity({
                scopeIds: resolved.scopeIds,
                contextScopeId: scope.scopeNodeId,
                importRunId: run.id,
                limit: 100,
              })
            : [];
          const payload: KnowledgeImportRunDetailPayload = {
            run: this.#importRunPayload(resolved.projectId, resolved.perspectiveKey, run),
            activity: activity.map(event => ({
              id: this.#mintHandle(resolved.projectId, resolved.perspectiveKey, 'cursor', event.id),
              action: event.action,
              targetType: event.targetType,
              createdAt: event.createdAt.toISOString(),
            })),
          };
          return c.json(payload);
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/proposals', {
        method: 'GET',
        requiresAuth: false,
        handler: async raw => {
          const c = loose(raw);
          const view = await this.#resolveView(c);
          if ('response' in view) return view.response;
          const tenant = this.deps.auth.tenant(c);
          const allowActions =
            !this.deps.auth.enabled() ||
            (tenant?.orgId !== undefined && (await this.deps.auth.isOrganizationAdmin(c, tenant.orgId)));
          const rawStatus = c.req.query('status');
          const status =
            rawStatus === 'pending' ||
            rawStatus === 'approved' ||
            rawStatus === 'rejected' ||
            rawStatus === 'conflicted'
              ? rawStatus
              : undefined;
          if (rawStatus && !status) return c.json({ error: 'invalid_proposal_status' }, 400);
          const cursorHandle = c.req.query('cursor');
          const cursor = this.#resolveHandle(view.projectId, view.perspectiveKey, 'cursor', cursorHandle);
          if (cursorHandle && !cursor) return c.json({ error: 'cursor_not_found' }, 404);
          const page = await view.knowledge.listProposals({
            vouchedScopeIds: view.scopeIds,
            status,
            cursor,
            limit: 100,
          });
          const proposals = (
            await Promise.all(
              page.proposals.map(proposal =>
                proposalPayload(
                  view.knowledge,
                  proposal,
                  view.scopeIds,
                  (kind, value) => this.#mintHandle(view.projectId, view.perspectiveKey, kind, value),
                  allowActions,
                ),
              ),
            )
          ).filter((proposal): proposal is KnowledgeProposalPayload => proposal !== null);
          return c.json({
            proposals,
            nextCursor: page.nextCursor
              ? this.#mintHandle(view.projectId, view.perspectiveKey, 'cursor', page.nextCursor)
              : undefined,
          });
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/proposals/:proposalId/:action', {
        method: 'POST',
        requiresAuth: true,
        handler: async raw => {
          const c = loose(raw);
          const resolved = await this.#resolveOperator(c);
          if ('response' in resolved) return resolved.response;
          const action = c.req.param('action');
          if (action !== 'approve' && action !== 'reject' && action !== 're-review') {
            return c.json({ error: 'proposal_action_not_found' }, 404);
          }
          const body: { reason?: string } = await c.req.json<{ reason?: string }>().catch(() => ({}));
          const proposalId = this.#resolveHandle(
            resolved.projectId,
            resolved.perspectiveKey,
            'proposal',
            c.req.param('proposalId'),
          );
          if (!proposalId) return c.json({ error: 'proposal_not_found' }, 404);
          const vouchedScopeIds = resolved.scopeIds;
          const decision = {
            id: proposalId,
            reviewerContextScopeId: vouchedScopeIds.at(-1)!,
            vouchedScopeIds,
            reason: typeof body.reason === 'string' ? body.reason.slice(0, 2_000) : undefined,
          };
          try {
            const proposal =
              action === 'approve'
                ? await resolved.knowledge.approveProposal(decision)
                : action === 'reject'
                  ? await resolved.knowledge.rejectProposal(decision)
                  : await resolved.knowledge.reReviewProposal(decision);
            const payload = await proposalPayload(resolved.knowledge, proposal, vouchedScopeIds, (kind, value) =>
              this.#mintHandle(resolved.projectId, resolved.perspectiveKey, kind, value),
            );
            return payload ? c.json(payload) : c.json({ error: 'proposal_not_found' }, 404);
          } catch (error) {
            const name = error instanceof Error ? error.name : '';
            if (name === 'KnowledgeNotFoundError') return c.json({ error: 'proposal_not_found' }, 404);
            if (name === 'KnowledgeConflictError') return c.json({ error: 'proposal_conflicted' }, 409);
            throw error;
          }
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/scopes', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const projectId = loose(c).req.param('id')!;
          const perspectiveKey = knowledgePerspectiveKey(projectId, boundedThreadId(loose(c).req.query('threadId')));
          const scopeHandle = loose(c).req.query('scopeId');
          const scopeId = this.#resolveHandle(projectId, perspectiveKey, 'scope', scopeHandle);
          if (scopeHandle && !scopeId) return loose(c).json({ error: 'scope_not_found' }, 404);
          const view = await this.#resolveView(loose(c), { scopeId });
          if ('response' in view) return view.response;
          const selected = await this.#resolveSelectedScope(view, scopeId, true);
          if (!selected) return loose(c).json({ error: 'scope_not_found' }, 404);
          const cursorHandle = loose(c).req.query('cursor');
          const cursor = this.#resolveHandle(projectId, view.perspectiveKey, 'cursor', cursorHandle);
          if (cursorHandle && !cursor) return loose(c).json({ error: 'cursor_not_found' }, 404);
          const fetched = await view.knowledge.listNodes({
            scopeIds: view.scopeIds,
            membershipScopeIds: [selected.id],
            isScope: true,
            ...(cursor ? { cursor } : {}),
            limit: this.#limits.maxNodes + 1,
          });
          const eligible = fetched.filter(node => node.id !== selected.id);
          const page = eligible.slice(0, this.#limits.maxNodes);
          const children = page.map(node => this.#scopeTreeNode(projectId, view.perspectiveKey, node));
          const last = eligible.length > this.#limits.maxNodes ? page.at(-1) : undefined;
          return loose(c).json({
            scope: this.#scopeTreeNode(projectId, view.perspectiveKey, selected),
            children,
            ...(last
              ? {
                  nextCursor: this.#mintHandle(
                    projectId,
                    view.perspectiveKey,
                    'cursor',
                    createKnowledgeNodeCursor(last, { isScope: true }),
                  ),
                }
              : {}),
          } satisfies KnowledgeScopeTreePayload);
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/subgraph', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const projectId = loose(c).req.param('id')!;
          const perspectiveKey = knowledgePerspectiveKey(projectId, boundedThreadId(loose(c).req.query('threadId')));
          const scopeHandle = loose(c).req.query('scopeId');
          const scopeId = this.#resolveHandle(projectId, perspectiveKey, 'scope', scopeHandle);
          if (scopeHandle && !scopeId) return loose(c).json({ error: 'scope_not_found' }, 404);
          const view = await this.#resolveView(loose(c), { scopeId });
          if ('response' in view) return view.response;
          const selected = await this.#resolveSelectedScope(view, scopeId, true);
          if (!selected) return loose(c).json({ error: 'scope_not_found' }, 404);
          const { store } = view;
          const scopeIds = [selected.id];
          const resolutionScopeIds = view.scopeIds;
          const selectedView: ResolvedView = {
            ...view,
            pinScopes: view.pinScopes.filter(level => level.scopeId === selected.id),
          };
          const fetched = await view.knowledge.listNodes({
            scopeIds: view.scopeIds,
            membershipScopeIds: scopeIds,
            isScope: false,
            limit: this.#limits.maxNodes + 1,
          });
          let truncated = fetched.length > this.#limits.maxNodes;
          const pinnedNodeIds = await this.#pinnedNodeIds(selectedView);
          const pinnedNodeIdSet = new Set(pinnedNodeIds.map(value => value.id));
          const nodes = fetched.slice(0, this.#limits.maxNodes).filter(node => !pinnedNodeIdSet.has(node.id));
          const recordWindow: KnowledgeRecord[] = [];
          for (const node of nodes) {
            if (recordWindow.length > this.#limits.maxRecords) break;
            const result = await view.knowledge.listRecords({
              node: node.id,
              scopeIds: view.scopeIds,
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
          const resolver = await WikilinkResolver.create(view.knowledge, store, nodes, this.#limits.maxFallbackLookups);
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
          const activity = await view.knowledge.listActivity({
            scopeIds: view.scopeIds,
            contextScopeId: selected.id,
            limit: 1,
          });
          const graphNodes = [...nodes, ...boundaryNodes.values()].map(node => {
            const description = metadataString(node.metadata, 'description');
            return {
              id: this.#mintHandle(projectId, view.perspectiveKey, 'node', node.id),
              name: node.name,
              kind: node.kind ?? 'concept',
              ...(description ? { description } : {}),
              pinned: accented.has(node.id),
              recordCount: recordCounts.get(node.id) ?? 0,
              createdAt: node.createdAt.toISOString(),
              updatedAt: node.updatedAt.toISOString(),
            };
          });
          const payload: KnowledgeGraphPayload = {
            view: view.view,
            scopeId: this.#mintHandle(projectId, view.perspectiveKey, 'scope', selected.id),
            nodes: graphNodes,
            edges: edges.map(edge => ({
              ...edge,
              id: this.#mintHandle(projectId, view.perspectiveKey, 'record', edge.id),
              source: this.#mintHandle(projectId, view.perspectiveKey, 'node', edge.source),
              target: this.#mintHandle(projectId, view.perspectiveKey, 'node', edge.target),
              recordId: this.#mintHandle(projectId, view.perspectiveKey, 'record', edge.recordId),
            })),
            records: [],
            truncated,
            outOfWindow: [...resolver.outOfWindow.values()].map(node => ({
              id: this.#mintHandle(projectId, view.perspectiveKey, 'node', node.id),
              name: node.name,
            })),
            unresolvedCapped: { count: resolver.cappedCount, names: resolver.cappedNames },
            pinCensus: {
              resource: pinnedRecords.filter(value => value.level === 'resource').length,
              thread: view.view === 'thread' ? pinnedRecords.filter(value => value.level === 'thread').length : null,
            },
            version: activity[0] ? this.#mintHandle(projectId, view.perspectiveKey, 'cursor', activity[0].id) : null,
          };
          return c.json(payload);
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/nodes/:nodeId', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const projectId = loose(c).req.param('id')!;
          const perspectiveKey = knowledgePerspectiveKey(projectId, boundedThreadId(loose(c).req.query('threadId')));
          const scopeHandle = loose(c).req.query('scopeId');
          const scopeId = this.#resolveHandle(projectId, perspectiveKey, 'scope', scopeHandle);
          if (scopeHandle && !scopeId) return c.json({ error: 'scope_not_found' }, 404);
          const nodeId = this.#resolveHandle(projectId, perspectiveKey, 'node', loose(c).req.param('nodeId'));
          if (!nodeId) return c.json({ error: 'node_not_found' }, 404);
          const view = await this.#resolveView(loose(c), { scopeId, nodeId });
          if ('response' in view) return view.response;
          const selected = await this.#resolveSelectedScope(view, scopeId, true);
          if (!selected) return loose(c).json({ error: 'scope_not_found' }, 404);
          const node = await view.knowledge.getNode({
            id: nodeId,
            scopeIds: view.scopeIds,
            membershipScopeIds: [selected.id],
          });
          if (!node) return c.json({ error: 'node_not_found' }, 404);
          const selectedView: ResolvedView = {
            ...view,
            pinScopes: view.pinScopes.filter(level => level.scopeId === selected.id),
          };
          const pinnedNodeIds = await this.#pinnedNodeIds(selectedView);
          const pinnedNodeIdSet = new Set(pinnedNodeIds.map(value => value.id));
          const [owned, mentioning] = await Promise.all([
            view.knowledge.listRecords({
              node: node.id,
              scopeIds: view.scopeIds,
              membershipScopeIds: [selected.id],
              limit: 200,
            }),
            view.knowledge.listMentioningRecords({
              node: node.id,
              scopeIds: view.scopeIds,
              membershipScopeIds: [selected.id],
              limit: 200,
            }),
          ]);
          const seen = new Set<string>();
          const records: KnowledgeNodeRecordPayload[] = [];
          const push = (record: KnowledgeRecord, relation: 'owned' | 'mentions') => {
            if (seen.has(record.id)) return;
            seen.add(record.id);
            const when = metadataString(record.metadata, 'when');
            const reason = metadataString(record.metadata, 'reason');
            records.push({
              id: this.#mintHandle(projectId, view.perspectiveKey, 'record', record.id),
              nodeId: this.#mintHandle(projectId, view.perspectiveKey, 'node', record.nodeId),
              relation,
              text: record.text,
              createdAt: record.createdAt.toISOString(),
              ...(when ? { when } : {}),
              ...(reason ? { reason } : {}),
              pinned: pinnedNodeIdSet.has(record.nodeId),
            });
          };
          for (const record of [...owned.records].sort((a, b) => b.id.localeCompare(a.id))) push(record, 'owned');
          for (const record of [...mentioning.records].sort((a, b) => b.id.localeCompare(a.id)))
            push(record, 'mentions');
          const payload: KnowledgeNodePayload = {
            node: {
              id: this.#mintHandle(projectId, view.perspectiveKey, 'node', node.id),
              name: node.name,
              kind: node.kind ?? 'concept',
              ...(metadataString(node.metadata, 'description')
                ? { description: metadataString(node.metadata, 'description') }
                : {}),
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
        handler: async raw => {
          const c = loose(raw);
          const projectId = c.req.param('id')!;
          const perspectiveKey = knowledgePerspectiveKey(projectId, boundedThreadId(c.req.query('threadId')));
          const scopeHandle = c.req.query('scopeId');
          const scopeId = this.#resolveHandle(projectId, perspectiveKey, 'scope', scopeHandle);
          if (scopeHandle && !scopeId) return c.json({ error: 'scope_not_found' }, 404);
          const view = await this.#resolveView(c, { scopeId });
          if ('response' in view) return view.response;
          const selected = await this.#resolveSelectedScope(view, scopeId, true);
          if (!selected) return c.json({ error: 'scope_not_found' }, 404);

          const rawAction = c.req.query('action');
          const action = activityAction(rawAction);
          const sourceType = c.req.query('sourceType');
          const rawFrom = c.req.query('from');
          const from = boundedDate(rawFrom);
          const rawTo = c.req.query('to');
          const to = boundedDate(rawTo);
          if (
            (rawAction && !action) ||
            (sourceType && sourceType !== 'importer' && sourceType !== 'system') ||
            (rawFrom && !from) ||
            (rawTo && !to)
          ) {
            return c.json({ error: 'invalid_activity_filters' }, 400);
          }
          const cursorHandle = c.req.query('cursor');
          const after = this.#resolveHandle(projectId, view.perspectiveKey, 'cursor', cursorHandle);
          if (cursorHandle && !after) return c.json({ error: 'cursor_not_found' }, 404);
          const events = await view.knowledge.listActivity({
            scopeIds: view.scopeIds,
            contextScopeId: selected.id,
            action,
            sourceType: sourceType === 'importer' || sourceType === 'system' ? sourceType : undefined,
            from,
            to,
            after,
            limit: 100,
          });
          const projected = await Promise.all(
            events.map(async event => {
              const run = event.importRunId
                ? await view.knowledge.getImportRun({ id: event.importRunId, scopeIds: view.scopeIds })
                : undefined;
              return {
                id: this.#mintHandle(projectId, view.perspectiveKey, 'cursor', event.id),
                action: event.action,
                targetType: event.targetType,
                scopeId: this.#mintHandle(projectId, view.perspectiveKey, 'scope', event.contextScopeId ?? selected.id),
                sourceType: event.importRunId ? ('importer' as const) : ('system' as const),
                ...(run
                  ? {
                      sourceId: run.importerId,
                      importRunId: this.#mintHandle(projectId, view.perspectiveKey, 'run', run.id),
                    }
                  : {}),
                createdAt: event.createdAt.toISOString(),
              };
            }),
          );
          return c.json({
            events: projected,
            ...(events.length === 100
              ? {
                  nextCursor: this.#mintHandle(projectId, view.perspectiveKey, 'cursor', events.at(-1)!.id),
                }
              : {}),
          });
        },
      }),
    ];
  }
}
