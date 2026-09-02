import { randomUUID } from 'node:crypto';

import { KnowledgeCurator, type Knowledge, type MaterializeKnowledgeScopeInput } from '@mastra/core/knowledge';
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
  KnowledgeScopeAddress,
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
  maxEdges: number;
  maxBoundaryNodes: number;
  maxRecords: number;
  maxFallbackLookups: number;
}

const DEFAULT_LIMITS: KnowledgeRouteLimits = {
  maxNodes: 250,
  maxEdges: 500,
  maxBoundaryNodes: 100,
  maxRecords: 1000,
  maxFallbackLookups: 100,
};

export interface KnowledgeAccessProfile {
  id: string;
  rootScopeAddress: string;
  baselineScopes: MaterializeKnowledgeScopeInput[];
  intakeScopes?: MaterializeKnowledgeScopeInput[];
  /** Addresses whose resolved scope IDs the host vouches for this request principal. */
  vouchedScopeAddresses?: string[];
  /** Host-declared companion addresses eligible for the curation worklist. */
  curationScopeAddresses?: string[];
  /** Host-selected standing curator identity. Never sourced from request data. */
  curatorProfileId?: string;
}

export interface KnowledgeAccessProfileInput {
  request: Request;
  knowledge: Knowledge;
  orgId: string;
  userId: string;
  projectId: string;
  threadId?: string;
  builtInScopes: {
    org: MaterializeKnowledgeScopeInput;
    resource: MaterializeKnowledgeScopeInput;
    thread?: MaterializeKnowledgeScopeInput;
  };
}

export type KnowledgeAccessProfileResolver = (
  input: KnowledgeAccessProfileInput,
) => Promise<KnowledgeAccessProfile | undefined>;

export interface KnowledgeRoutesDeps extends RouteDependencies {
  projects: FactoryProjectsStorage;
  knowledge: () => Promise<Knowledge | undefined>;
  accessProfile: KnowledgeAccessProfileResolver;
  limits?: Partial<KnowledgeRouteLimits>;
}

export interface KnowledgeGraphNode {
  id: string;
  reference: string;
  name: string;
  kind: string;
  description?: string;
  pinned: boolean;
  recordCount: number;
  boundary?: {
    scope: KnowledgeScopeTreeNode;
  };
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'wikilink';
  recordId: string;
  boundary?: boolean;
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
  reference: string;
  name: string;
  kind: string;
  description?: string;
  needsCuration?: boolean;
}

export interface KnowledgeScopeTreePayload {
  scope: KnowledgeScopeTreeNode;
  children: KnowledgeScopeTreeNode[];
  curationDestination?: KnowledgeScopeTreeNode;
  nextCursor?: string;
}

export interface KnowledgeGraphPayload {
  view: 'project' | 'thread';
  scope: KnowledgeScopeTreeNode;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  records: KnowledgeGraphRecord[];
  page: {
    nextCursor?: string;
    truncated: boolean;
    incomplete: boolean;
  };
  limits: {
    maxNodes: number;
    maxEdges: number;
    maxBoundaryNodes: number;
    boundaryHops: 1;
  };
  version?: string;
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
    reference: string;
    name: string;
    kind: string;
    createdAt: string;
    updatedAt: string;
  };
  records: KnowledgeNodeRecordPayload[];
}

export interface KnowledgeCurationWorkItem {
  id: string;
  reference: string;
  name: string;
  kind: string;
  version: number;
  evidence: Array<{ source?: string; provenance?: string }>;
  evidenceCursor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeCurationWorklistPayload {
  scopeId: string;
  items: KnowledgeCurationWorkItem[];
  nextCursor?: string;
}

export interface KnowledgeCurationEvidencePayload {
  evidence: Array<{ source?: string; provenance?: string }>;
  nextCursor?: string;
}

export interface KnowledgeCurationMergeTargetsPayload {
  targets: Array<{ id: string; reference: string; name: string; kind: string; version: number }>;
}

export interface KnowledgeCurationActionPayload {
  outcome: 'applied' | 'proposed' | 'retained';
  node?: { id: string; reference: string; name: string; kind: string; version: number };
  proposal?: { id: string; reference: string; status: KnowledgeProposalStatus };
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
  reference: string;
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
  nextCursor?: string;
}

export interface KnowledgeProposalPayload {
  id: string;
  reference: string;
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

function isKnowledgeHandle(value: string | undefined): boolean {
  return !value || /^kh_[0-9a-f-]{36}$/.test(value) || /^kr_[A-Za-z0-9_-]+$/.test(value);
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
  curatorProfileId?: string;
  curationScopeIds: KnowledgeScopeIds;
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

function importScopeBelongsToView(scope: string | undefined, projectId: string, threadId?: string): boolean {
  return (
    scope === `resource:${projectId}` ||
    (threadId !== undefined && scope === `resource:${projectId}:thread:${threadId}`)
  );
}

function importRunBelongsToView(run: KnowledgeImportRun, projectId: string, threadId?: string): boolean {
  return importScopeBelongsToView(importBinding(run.binding).scopeAddress, projectId, threadId);
}

async function proposalPayload(
  knowledge: Knowledge,
  store: KnowledgeStorage,
  proposal: KnowledgeProposal,
  scopeIds: KnowledgeScopeIds,
  handle: (kind: 'proposal' | 'node' | 'record', value: string) => string,
  reference: (kind: 'proposal' | 'node' | 'record', value: string) => string,
  allowActions = true,
): Promise<KnowledgeProposalPayload | null> {
  const frontier = await knowledge.evaluateAccess(scopeIds);
  const currentTargets = await Promise.all(
    proposal.targets.map(async target => {
      let current =
        target.type === 'node'
          ? await knowledge.getNode({ id: target.id, scopeIds })
          : await knowledge.getRecord({ id: target.id, scopeIds });
      if (!current && target.type === 'node' && frontier.scopes[target.id]?.read) {
        const scopeTarget = await store.getNode(target.id);
        if (scopeTarget?.isScope) current = scopeTarget;
      }
      if (!current || current.deletedAt) return null;
      const currentScopeIds =
        target.type === 'node'
          ? 'isScope' in current && current.isScope
            ? [current.id]
            : await store.getNodeScopeIds(target.id)
          : await store.getRecordScopeIds(target.id);
      if (!currentScopeIds.every(scopeId => frontier.scopes[scopeId]?.read)) return null;
      return { current, currentScopeIds };
    }),
  );
  if (currentTargets.some(target => !target)) return null;

  const canReview =
    allowActions &&
    proposal.targets.every((target, index) =>
      currentTargets[index]!.currentScopeIds.every(scopeId => frontier.scopes[scopeId]?.[target.approvalCapability]),
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
    reference: reference('proposal', proposal.id),
    operation: proposal.operation,
    status: proposal.status,
    reason: proposal.reason,
    reviewReason: proposal.reviewReason,
    targets: proposal.targets.map((target, index) => {
      const { current } = currentTargets[index]!;
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
  readonly #windowIds: Set<string>;
  readonly #cache = new Map<string, KnowledgeNode | null>();
  #lookups = 0;
  #capped = false;

  private constructor(
    readonly knowledge: Knowledge,
    nodes: KnowledgeNode[],
    readonly selectedScopeId: string,
    readonly maxLookups: number,
  ) {
    this.#windowIds = new Set(nodes.map(node => node.id));
  }

  static create(knowledge: Knowledge, nodes: KnowledgeNode[], selectedScopeId: string, maxLookups: number) {
    return new WikilinkResolver(knowledge, nodes, selectedScopeId, maxLookups);
  }

  inWindowId(id: string): boolean {
    return this.#windowIds.has(id);
  }

  async resolve(name: string, scopeIds: KnowledgeScopeIds): Promise<KnowledgeNode | null> {
    const cacheKey = `${knowledgeScopeIdsKey(scopeIds)}\u0000${name.trim().toLocaleLowerCase()}`;
    if (this.#cache.has(cacheKey)) return this.#cache.get(cacheKey) ?? null;
    if (this.#lookups >= this.maxLookups) {
      this.#capped = true;
      return null;
    }
    this.#lookups += 1;
    const localMatches = await this.knowledge
      .listNodes({
        scopeIds,
        membershipScopeIds: [this.selectedScopeId],
        namePrefix: name,
        isScope: false,
        limit: 2,
      })
      .catch(() => []);
    const exactLocalMatches = localMatches.filter(
      node => node.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
    );
    const exactLocal = exactLocalMatches.length === 1 ? exactLocalMatches.at(0) : undefined;
    const resolved = exactLocal ?? (await this.knowledge.getNodeByName({ name, scopeIds }).catch(() => null));
    this.#cache.set(cacheKey, resolved ?? null);
    return resolved ?? null;
  }

  get cappedCount(): number {
    return this.#capped ? 1 : 0;
  }
}

type KnowledgeSurfaceHandleKind =
  | 'scope'
  | 'node'
  | 'record'
  | 'proposal'
  | 'run'
  | 'binding'
  | 'scope-cursor'
  | 'activity-cursor'
  | 'import-runs-cursor'
  | 'import-activity-cursor'
  | 'proposal-cursor'
  | 'lens-cursor'
  | 'curation-cursor'
  | 'curation-record-cursor';

interface KnowledgeSurfaceHandle {
  projectId: string;
  perspectiveKey: string;
  kind: KnowledgeSurfaceHandleKind;
  value: string;
  expiresAt: number;
}

type KnowledgeStableReferenceKind = 'scope' | 'node' | 'record' | 'proposal' | 'run';

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

  #mintReference(projectId: string, kind: KnowledgeStableReferenceKind, value: string): string {
    return `kr_${Buffer.from(JSON.stringify([projectId, kind, value])).toString('base64url')}`;
  }

  #resolveReference(
    projectId: string,
    kind: KnowledgeStableReferenceKind,
    reference: string | undefined,
  ): string | undefined {
    if (!reference?.startsWith('kr_') || reference.length > 2048) return undefined;
    try {
      const parsed: unknown = JSON.parse(Buffer.from(reference.slice(3), 'base64url').toString());
      if (
        !Array.isArray(parsed) ||
        parsed.length !== 3 ||
        parsed[0] !== projectId ||
        parsed[1] !== kind ||
        typeof parsed[2] !== 'string'
      ) {
        return undefined;
      }
      return parsed[2];
    } catch {
      return undefined;
    }
  }

  #resolveResource(
    projectId: string,
    perspectiveKey: string,
    kind: KnowledgeStableReferenceKind,
    token: string | undefined,
  ): string | undefined {
    return (
      this.#resolveHandle(projectId, perspectiveKey, kind, token) ?? this.#resolveReference(projectId, kind, token)
    );
  }

  #importRunPayload(projectId: string, perspectiveKey: string, run: KnowledgeImportRun): KnowledgeImportRunPayload {
    const binding = importBinding(run.binding);
    return {
      id: this.#mintHandle(projectId, perspectiveKey, 'run', run.id),
      reference: this.#mintReference(projectId, 'run', run.id),
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

  async #resolveAccessProfile(input: {
    c: Context;
    knowledge: Knowledge;
    orgId: string;
    userId: string;
    projectId: string;
    threadId?: string;
  }): Promise<
    | {
        scopeIds: KnowledgeScopeIds;
        rootScopeId: string;
        orgScopeId: string;
        resourceScopeId: string;
        threadScopeId?: string;
        perspectiveKey: string;
        curatorProfileId?: string;
        curationScopeIds: KnowledgeScopeIds;
      }
    | undefined
  > {
    const builtInScopes: KnowledgeAccessProfileInput['builtInScopes'] = {
      org: {
        address: `org:${input.orgId}`,
        contextualScopeAddress: `org:${input.orgId}`,
        parameters: { orgId: input.orgId },
      },
      resource: {
        address: `resource:${input.projectId}`,
        parentAddresses: [`org:${input.orgId}`],
        contextualScopeAddress: `org:${input.orgId}`,
        parameters: { resourceId: input.projectId },
      },
      ...(input.threadId
        ? {
            thread: {
              address: `resource:${input.projectId}:thread:${input.threadId}`,
              parentAddresses: [`resource:${input.projectId}`],
              contextualScopeAddress: `resource:${input.projectId}`,
              parameters: { resourceId: input.projectId, threadId: input.threadId },
            },
          }
        : {}),
    };
    const profile = await this.deps.accessProfile({
      request: input.c.req.raw,
      knowledge: input.knowledge,
      orgId: input.orgId,
      userId: input.userId,
      projectId: input.projectId,
      threadId: input.threadId,
      builtInScopes,
    });
    if (!profile?.id.trim()) return undefined;
    const profileScopesByAddress = new Map(
      [...profile.baselineScopes, ...(profile.intakeScopes ?? [])].map(scope => [scope.address, scope]),
    );
    if (profileScopesByAddress.size === 0 || !profileScopesByAddress.has(profile.rootScopeAddress)) return undefined;
    const scopesByAddress = new Map(
      [
        builtInScopes.org,
        builtInScopes.resource,
        ...(builtInScopes.thread ? [builtInScopes.thread] : []),
        ...profileScopesByAddress.values(),
      ].map(scope => [scope.address, scope]),
    );
    const entries = [...scopesByAddress.entries()];
    let resolvedScopes: Array<KnowledgeScopeAddress | null>;
    try {
      const existingScopes = await Promise.all(
        entries.map(([address]) => input.knowledge.resolveScopeAddress(address)),
      );
      await Promise.all(
        entries.flatMap(([, scope], index) => (existingScopes[index] ? [] : [input.knowledge.materializeScope(scope)])),
      );
      resolvedScopes = await Promise.all(entries.map(([address]) => input.knowledge.resolveScopeAddress(address)));
    } catch {
      return undefined;
    }
    const resolvedByAddress = new Map<string, string>();
    entries.forEach(([address], index) => {
      const resolved = resolvedScopes[index];
      if (resolved) resolvedByAddress.set(address, resolved.scopeNodeId);
    });
    const curationScopeAddresses = new Set(profile.curationScopeAddresses ?? []);
    const vouchedScopeAddresses = new Set(
      profile.vouchedScopeAddresses ??
        [...profileScopesByAddress.keys()].filter(address => !curationScopeAddresses.has(address)),
    );
    if ([...vouchedScopeAddresses, ...curationScopeAddresses].some(address => !resolvedByAddress.has(address))) {
      return undefined;
    }
    const scopeIds = [...vouchedScopeAddresses]
      .flatMap(address => {
        const scopeId = resolvedByAddress.get(address);
        return scopeId ? [scopeId] : [];
      })
      .toSorted();
    const rootScopeId = resolvedByAddress.get(profile.rootScopeAddress);
    const orgScopeId = resolvedByAddress.get(`org:${input.orgId}`);
    const resourceScopeId = resolvedByAddress.get(`resource:${input.projectId}`);
    const threadScopeId = input.threadId
      ? resolvedByAddress.get(`resource:${input.projectId}:thread:${input.threadId}`)
      : undefined;
    if (!rootScopeId || !orgScopeId || !resourceScopeId || (input.threadId && !threadScopeId)) return undefined;
    const curationScopeIds = [...curationScopeAddresses].flatMap(address => {
      const scopeId = resolvedByAddress.get(address);
      return scopeId ? [scopeId] : [];
    });
    return {
      scopeIds,
      rootScopeId,
      orgScopeId,
      resourceScopeId,
      ...(threadScopeId ? { threadScopeId } : {}),
      perspectiveKey: `${input.projectId}\u0000${input.userId}\u0000${profile.id}\u0000${knowledgeScopeIdsKey(scopeIds)}`,
      curatorProfileId: profile.curatorProfileId?.trim() || undefined,
      curationScopeIds: [...new Set(curationScopeIds)].sort(),
    };
  }

  async #resolveView(c: Context): Promise<ResolvedView | { response: Response }> {
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
    const [existingOrg, existingResource, existingThread] = await Promise.all([
      knowledge.resolveScopeAddress(`org:${tenant.orgId}`),
      knowledge.resolveScopeAddress(`resource:${projectId}`),
      threadId ? knowledge.resolveScopeAddress(`resource:${projectId}:thread:${threadId}`) : undefined,
    ]);
    if (!existingOrg || !existingResource) return { response: c.json({ error: 'knowledge_not_found' }, 404) };
    if (threadId && !existingThread) return { response: c.json({ error: 'thread_not_found' }, 404) };
    const profile = await this.#resolveAccessProfile({
      c,
      knowledge,
      orgId: tenant.orgId,
      userId: tenant.userId,
      projectId,
      ...(threadId ? { threadId } : {}),
    });
    if (!profile) return { response: c.json({ error: 'knowledge_profile_unavailable' }, 503) };
    const { orgScopeId, resourceScopeId, threadScopeId } = profile;
    const frontier = await knowledge.evaluateAccess(profile.scopeIds);
    const perspectiveKey = `${profile.perspectiveKey}\u0000${frontier.accessEpoch}`;
    const readableScopeIds = Object.entries(frontier.scopes)
      .filter(([, capabilities]) => capabilities.read)
      .map(([scopeId]) => scopeId);
    if (!readableScopeIds.includes(profile.rootScopeId)) {
      return { response: c.json({ error: threadId ? 'thread_not_found' : 'knowledge_not_found' }, 404) };
    }
    if (!threadId) {
      return {
        projectId,
        knowledge,
        store,
        view: 'project',
        scopeIds: profile.scopeIds,
        perspectiveKey,
        readableScopeIds,
        curatorProfileId: profile.curatorProfileId,
        curationScopeIds: profile.curationScopeIds,
        orgScopeId,
        resourceScopeId: profile.rootScopeId,
        pinScopes: [{ level: 'resource', scopeId: profile.rootScopeId }],
      };
    }
    if (!threadScopeId || profile.rootScopeId !== threadScopeId || !readableScopeIds.includes(threadScopeId)) {
      return { response: c.json({ error: 'thread_not_found' }, 404) };
    }
    const probe = await knowledge.listRecordsBySource({ source: threadId, scopeIds: profile.scopeIds, limit: 1 });
    if (probe.records.length === 0) return { response: c.json({ error: 'thread_not_found' }, 404) };
    return {
      projectId,
      knowledge,
      store,
      view: 'thread',
      threadId,
      scopeIds: profile.scopeIds,
      perspectiveKey,
      readableScopeIds,
      curatorProfileId: profile.curatorProfileId,
      curationScopeIds: profile.curationScopeIds,
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

  async #resolveSelectedScope(view: ResolvedView, rawScopeId: string | undefined): Promise<KnowledgeNode | null> {
    const scopeId = rawScopeId ?? view.threadScopeId ?? view.resourceScopeId;
    if (!UUID_RE.test(scopeId)) return null;
    const scope = await view.knowledge.getScope({ id: scopeId, scopeIds: view.scopeIds });
    if (!scope?.isScope || scope.deletedAt) return null;
    const roots = new Set([view.orgScopeId, view.resourceScopeId, ...(view.threadScopeId ? [view.threadScopeId] : [])]);
    const pending = [scope.id];
    const visited = new Set<string>();
    while (pending.length > 0 && visited.size <= this.#limits.maxNodes) {
      const current = pending.pop()!;
      if (roots.has(current)) return scope;
      if (visited.has(current)) continue;
      visited.add(current);
      const parents = await view.knowledge.getNodeScopes({ id: current, scopeIds: view.scopeIds });
      pending.push(...parents.map(parent => parent.id));
    }
    return null;
  }

  async #lensTargetScope(
    view: ResolvedView,
    nodeId: string,
    selectedScopeId: string,
  ): Promise<KnowledgeNode | undefined> {
    const memberships = (await view.knowledge.getNodeScopes({ id: nodeId, scopeIds: view.scopeIds })).toSorted(
      (left, right) => left.id.localeCompare(right.id),
    );
    const selected = memberships.find(scope => scope.id === selectedScopeId);
    if (selected) return selected;
    for (const scope of memberships) {
      if (await this.#resolveSelectedScope(view, scope.id)) return scope;
    }
    return undefined;
  }

  #scopeTreeNode(
    projectId: string,
    perspectiveKey: string,
    node: KnowledgeNode,
    needsCuration = false,
  ): KnowledgeScopeTreeNode {
    const description = metadataString(node.metadata, 'description');
    return {
      id: this.#mintHandle(projectId, perspectiveKey, 'scope', node.id),
      reference: this.#mintReference(projectId, 'scope', node.id),
      name: node.name,
      kind: node.kind ?? 'scope',
      ...(description ? { description } : {}),
      ...(needsCuration ? { needsCuration: true } : {}),
    };
  }

  async #projectImportRuns(input: {
    knowledge: Knowledge;
    projectId: string;
    threadId?: string;
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
        if (!importRunBelongsToView(run, input.projectId, input.threadId)) continue;
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
          const resolved = await this.#resolveView(c);
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
                .filter(binding => importScopeBelongsToView(binding.scope, resolved.projectId, resolved.threadId))
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
                  threadId: resolved.threadId,
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
          const resolved = await this.#resolveView(c);
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
          const cursor = this.#resolveHandle(
            resolved.projectId,
            resolved.perspectiveKey,
            'import-runs-cursor',
            cursorHandle,
          );
          if (cursorHandle && !cursor) return c.json({ runs: [] });
          const page = await this.#projectImportRuns({
            knowledge: resolved.knowledge,
            projectId: resolved.projectId,
            threadId: resolved.threadId,
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
              ? this.#mintHandle(resolved.projectId, resolved.perspectiveKey, 'import-runs-cursor', page.nextCursor)
              : undefined,
          });
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/importers/:importerId/runs/:runId', {
        method: 'GET',
        requiresAuth: true,
        handler: async raw => {
          const c = loose(raw);
          const resolved = await this.#resolveView(c);
          if ('response' in resolved) return resolved.response;
          const importerId = c.req.param('importerId')!;
          const importer = resolved.knowledge.getImporter(importerId);
          if (!importer) return c.json({ error: 'importer_not_found' }, 404);
          const runId = this.#resolveResource(resolved.projectId, resolved.perspectiveKey, 'run', c.req.param('runId'));
          if (!runId) return c.json({ error: 'import_run_not_found' }, 404);
          const run = await resolved.knowledge.getImportRun({
            id: runId,
            scopeIds: resolved.scopeIds,
          });
          if (
            !run ||
            run.importerId !== importerId ||
            !importRunBelongsToView(run, resolved.projectId, resolved.threadId)
          ) {
            return c.json({ error: 'import_run_not_found' }, 404);
          }

          const store = await resolved.knowledge.getStorageInternal();
          const binding = importBinding(run.binding);
          const scope = binding.scopeAddress ? await store.getScopeAddress(binding.scopeAddress) : undefined;
          const cursorHandle = c.req.query('cursor');
          const after = this.#resolveHandle(
            resolved.projectId,
            resolved.perspectiveKey,
            'import-activity-cursor',
            cursorHandle,
          );
          if (cursorHandle && !after) return c.json({ error: 'cursor_not_found' }, 404);
          const activity = scope
            ? await resolved.knowledge.listActivity({
                scopeIds: resolved.scopeIds,
                membershipScopeIds: [scope.scopeNodeId],
                importRunId: run.id,
                after,
                limit: 101,
              })
            : [];
          const payload: KnowledgeImportRunDetailPayload = {
            run: this.#importRunPayload(resolved.projectId, resolved.perspectiveKey, run),
            activity: activity.slice(0, 100).map(event => ({
              id: this.#mintHandle(resolved.projectId, resolved.perspectiveKey, 'import-activity-cursor', event.id),
              action: event.action,
              targetType: event.targetType,
              createdAt: event.createdAt.toISOString(),
            })),
            nextCursor:
              activity.length > 100 && activity[99]
                ? this.#mintHandle(
                    resolved.projectId,
                    resolved.perspectiveKey,
                    'import-activity-cursor',
                    activity[99].id,
                  )
                : undefined,
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
          const cursor = this.#resolveHandle(view.projectId, view.perspectiveKey, 'proposal-cursor', cursorHandle);
          if (cursorHandle && !cursor) return c.json({ error: 'cursor_not_found' }, 404);
          const visible: Array<{ proposal: KnowledgeProposalPayload; cursor: string }> = [];
          let scanCursor = cursor;
          do {
            const page = await view.knowledge.listProposals({
              vouchedScopeIds: view.scopeIds,
              status,
              cursor: scanCursor,
              limit: 100,
            });
            const payloads = await Promise.all(
              page.proposals.map(proposal =>
                proposalPayload(
                  view.knowledge,
                  view.store,
                  proposal,
                  view.scopeIds,
                  (kind, value) => this.#mintHandle(view.projectId, view.perspectiveKey, kind, value),
                  (kind, value) => this.#mintReference(view.projectId, kind, value),
                  allowActions,
                ),
              ),
            );
            page.proposals.forEach((proposal, index) => {
              const payload = payloads[index];
              if (payload) visible.push({ proposal: payload, cursor: proposal.id });
            });
            scanCursor = page.nextCursor;
          } while (visible.length <= 100 && scanCursor);

          const proposals = visible.slice(0, 100).map(item => item.proposal);
          return c.json({
            proposals,
            nextCursor:
              visible.length > 100
                ? this.#mintHandle(view.projectId, view.perspectiveKey, 'proposal-cursor', visible[99]!.cursor)
                : undefined,
          });
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/proposals/:proposalId', {
        method: 'GET',
        requiresAuth: false,
        handler: async raw => {
          const c = loose(raw);
          const proposalHandle = c.req.param('proposalId');
          const view = await this.#resolveView(c);
          if ('response' in view) return view.response;
          const proposalId = this.#resolveResource(view.projectId, view.perspectiveKey, 'proposal', proposalHandle);
          if (!proposalId) return c.json({ error: 'proposal_not_found' }, 404);
          const proposal = await view.knowledge.getProposal({ id: proposalId, vouchedScopeIds: view.scopeIds });
          if (!proposal) return c.json({ error: 'proposal_not_found' }, 404);
          const tenant = this.deps.auth.tenant(c);
          const allowActions =
            !this.deps.auth.enabled() ||
            (tenant?.orgId !== undefined && (await this.deps.auth.isOrganizationAdmin(c, tenant.orgId)));
          const payload = await proposalPayload(
            view.knowledge,
            view.store,
            proposal,
            view.scopeIds,
            (kind, value) => this.#mintHandle(view.projectId, view.perspectiveKey, kind, value),
            (kind, value) => this.#mintReference(view.projectId, kind, value),
            allowActions,
          );
          return payload ? c.json(payload) : c.json({ error: 'proposal_not_found' }, 404);
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/proposals/:proposalId/:action', {
        method: 'POST',
        requiresAuth: true,
        handler: async raw => {
          const c = loose(raw);
          const resolved = await this.#resolveView(c);
          if ('response' in resolved) return resolved.response;
          const tenant = this.deps.auth.tenant(c);
          if (
            this.deps.auth.enabled() &&
            (!tenant?.orgId || !(await this.deps.auth.isOrganizationAdmin(c, tenant.orgId)))
          ) {
            return c.json({ error: 'forbidden' }, 403);
          }
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
            reviewerContextScopeId: resolved.threadScopeId ?? resolved.resourceScopeId,
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
            const payload = await proposalPayload(
              resolved.knowledge,
              resolved.store,
              proposal,
              vouchedScopeIds,
              (kind, value) => this.#mintHandle(resolved.projectId, resolved.perspectiveKey, kind, value),
              (kind, value) => this.#mintReference(resolved.projectId, kind, value),
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
      registerApiRoute('/web/factory/projects/:id/knowledge/curation/worklist', {
        method: 'GET',
        requiresAuth: true,
        handler: async raw => {
          const c = loose(raw);
          const view = await this.#resolveView(c);
          if ('response' in view) return view.response;
          const scopeHandle = c.req.query('scopeId');
          const companionScopeId = this.#resolveHandle(view.projectId, view.perspectiveKey, 'scope', scopeHandle);
          if (!companionScopeId || !view.curationScopeIds.includes(companionScopeId)) {
            return c.json({ error: 'scope_not_found' }, 404);
          }
          const selected = await this.#resolveSelectedScope(view, companionScopeId);
          if (!selected) return c.json({ error: 'scope_not_found' }, 404);
          const cursorHandle = c.req.query('cursor');
          const cursor = this.#resolveHandle(view.projectId, view.perspectiveKey, 'curation-cursor', cursorHandle);
          if (cursorHandle && !cursor) return c.json({ error: 'cursor_not_found' }, 404);
          const rawLimit = Number(c.req.query('limit') ?? 50);
          const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
          try {
            const curator = new KnowledgeCurator(view.knowledge, {
              vouchedScopeIds: view.scopeIds,
              companionScopeId,
              contextScopeId: view.threadScopeId ?? view.resourceScopeId,
            });
            const page = await curator.listWorklist({ cursor, limit });
            const items = page.items.map(({ node, records, recordsNextCursor }) => ({
              id: this.#mintHandle(view.projectId, view.perspectiveKey, 'node', node.id),
              reference: this.#mintReference(view.projectId, 'node', node.id),
              name: node.name,
              kind: node.kind ?? 'unknown',
              version: node.version,
              description: metadataString(node.metadata, 'description'),
              evidence: records.map(record => ({
                source: record.source,
                provenance: metadataString(record.metadata, 'provenance'),
              })),
              evidenceCursor: recordsNextCursor
                ? this.#mintHandle(view.projectId, view.perspectiveKey, 'curation-record-cursor', recordsNextCursor)
                : undefined,
              createdAt: node.createdAt.toISOString(),
              updatedAt: node.updatedAt.toISOString(),
            }));
            const payload: KnowledgeCurationWorklistPayload = {
              scopeId: scopeHandle!,
              items,
              nextCursor: page.nextCursor
                ? this.#mintHandle(view.projectId, view.perspectiveKey, 'curation-cursor', page.nextCursor)
                : undefined,
            };
            return c.json(payload);
          } catch (error) {
            if (
              error instanceof Error &&
              (error.name === 'KnowledgeNotFoundError' ||
                error.message.startsWith('Knowledge curator profile is not registered:'))
            ) {
              return c.json({ error: 'curation_not_found' }, 404);
            }
            throw error;
          }
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/curation/items/:nodeId/evidence', {
        method: 'GET',
        requiresAuth: true,
        handler: async raw => {
          const c = loose(raw);
          const view = await this.#resolveView(c);
          if ('response' in view) return view.response;
          const companionScopeId = this.#resolveHandle(
            view.projectId,
            view.perspectiveKey,
            'scope',
            c.req.query('scopeId'),
          );
          const nodeId = this.#resolveHandle(view.projectId, view.perspectiveKey, 'node', c.req.param('nodeId'));
          if (!companionScopeId || !view.curationScopeIds.includes(companionScopeId) || !nodeId) {
            return c.json({ error: 'curation_not_found' }, 404);
          }
          const cursorHandle = c.req.query('cursor');
          const cursor = this.#resolveHandle(
            view.projectId,
            view.perspectiveKey,
            'curation-record-cursor',
            cursorHandle,
          );
          if (cursorHandle && !cursor) return c.json({ error: 'cursor_not_found' }, 404);
          const curator = new KnowledgeCurator(view.knowledge, {
            vouchedScopeIds: view.scopeIds,
            companionScopeId,
            contextScopeId: view.threadScopeId ?? view.resourceScopeId,
          });
          try {
            const page = await curator.listItemRecords({ nodeId, cursor, limit: 100 });
            return c.json({
              evidence: page.records.map(record => ({
                source: record.source,
                provenance: metadataString(record.metadata, 'provenance'),
              })),
              nextCursor: page.nextCursor
                ? this.#mintHandle(view.projectId, view.perspectiveKey, 'curation-record-cursor', page.nextCursor)
                : undefined,
            } satisfies KnowledgeCurationEvidencePayload);
          } catch (error) {
            if (error instanceof Error && error.name === 'KnowledgeNotFoundError') {
              return c.json({ error: 'curation_not_found' }, 404);
            }
            throw error;
          }
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/curation/merge-targets', {
        method: 'GET',
        requiresAuth: true,
        handler: async raw => {
          const c = loose(raw);
          const view = await this.#resolveView(c);
          if ('response' in view) return view.response;
          const scopeHandle = c.req.query('scopeId');
          const companionScopeId = this.#resolveHandle(view.projectId, view.perspectiveKey, 'scope', scopeHandle);
          if (!companionScopeId || !view.curationScopeIds.includes(companionScopeId)) {
            return c.json({ error: 'curation_not_found' }, 404);
          }
          const namePrefix = c.req.query('query')?.trim();
          if (!namePrefix) return c.json({ targets: [] } satisfies KnowledgeCurationMergeTargetsPayload);
          try {
            const curator = new KnowledgeCurator(view.knowledge, {
              vouchedScopeIds: view.scopeIds,
              companionScopeId,
              contextScopeId: view.threadScopeId ?? view.resourceScopeId,
            });
            const nodes = await curator.listMergeTargets({ namePrefix, limit: 20 });
            return c.json({
              targets: nodes.map(node => ({
                id: this.#mintHandle(view.projectId, view.perspectiveKey, 'node', node.id),
                reference: this.#mintReference(view.projectId, 'node', node.id),
                name: node.name,
                kind: node.kind ?? 'unknown',
                version: node.version,
              })),
            } satisfies KnowledgeCurationMergeTargetsPayload);
          } catch (error) {
            if (error instanceof Error && error.message.startsWith('Knowledge curator profile is not registered:')) {
              return c.json({ error: 'curation_not_found' }, 404);
            }
            throw error;
          }
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/curation/actions/:action', {
        method: 'POST',
        requiresAuth: true,
        handler: async raw => {
          const c = loose(raw);
          const view = await this.#resolveView(c);
          if ('response' in view) return view.response;
          const action = c.req.param('action');
          if (
            action !== 'refine' &&
            action !== 'promote' &&
            action !== 'merge' &&
            action !== 'discard' &&
            action !== 'retain'
          ) {
            return c.json({ error: 'curation_action_not_found' }, 404);
          }
          const body: unknown = await c.req.json().catch(() => undefined);
          if (!body || typeof body !== 'object') return c.json({ error: 'invalid_curation_action' }, 400);
          const input = body as Record<string, unknown>;
          const companionScopeId = this.#resolveHandle(
            view.projectId,
            view.perspectiveKey,
            'scope',
            typeof input.scopeId === 'string' ? input.scopeId : undefined,
          );
          const nodeId = this.#resolveHandle(
            view.projectId,
            view.perspectiveKey,
            'node',
            typeof input.nodeId === 'string' ? input.nodeId : undefined,
          );
          if (!companionScopeId || !view.curationScopeIds.includes(companionScopeId) || !nodeId) {
            return c.json({ error: 'curation_not_found' }, 404);
          }
          if (!(await this.#resolveSelectedScope(view, companionScopeId))) {
            return c.json({ error: 'curation_not_found' }, 404);
          }
          const version =
            typeof input.version === 'number' && Number.isInteger(input.version) ? input.version : undefined;
          try {
            const curator = new KnowledgeCurator(view.knowledge, {
              vouchedScopeIds: view.scopeIds,
              companionScopeId,
              contextScopeId: view.threadScopeId ?? view.resourceScopeId,
            });
            let result;
            if (action === 'retain') {
              const retained = await curator.retain(nodeId);
              const payload: KnowledgeCurationActionPayload = {
                outcome: 'retained',
                node: {
                  id: this.#mintHandle(view.projectId, view.perspectiveKey, 'node', retained.node.id),
                  reference: this.#mintReference(view.projectId, 'node', retained.node.id),
                  name: retained.node.name,
                  kind: retained.node.kind ?? 'unknown',
                  version: retained.node.version,
                },
              };
              return c.json(payload);
            }
            if (version === undefined) return c.json({ error: 'invalid_curation_action' }, 400);
            if (action === 'refine') {
              result = await curator.refine({
                nodeId,
                version,
                name: typeof input.name === 'string' ? input.name.slice(0, 512) : undefined,
                kind: typeof input.kind === 'string' ? input.kind.slice(0, 128) : undefined,
                metadata:
                  typeof input.description === 'string'
                    ? { description: input.description.slice(0, 10_000) }
                    : undefined,
                reason: typeof input.reason === 'string' ? input.reason.slice(0, 2_000) : undefined,
              });
            } else if (action === 'promote') {
              const destinationScopeId = this.#resolveHandle(
                view.projectId,
                view.perspectiveKey,
                'scope',
                typeof input.destinationScopeId === 'string' ? input.destinationScopeId : undefined,
              );
              if (!destinationScopeId || !(await this.#resolveSelectedScope(view, destinationScopeId))) {
                return c.json({ error: 'curation_not_found' }, 404);
              }
              result = await curator.promote({
                nodeId,
                version,
                destinationScopeId,
                reason: typeof input.reason === 'string' ? input.reason.slice(0, 2_000) : undefined,
              });
            } else if (action === 'merge') {
              const targetId = this.#resolveHandle(
                view.projectId,
                view.perspectiveKey,
                'node',
                typeof input.targetId === 'string' ? input.targetId : undefined,
              );
              const targetVersion =
                typeof input.targetVersion === 'number' && Number.isInteger(input.targetVersion)
                  ? input.targetVersion
                  : undefined;
              if (!targetId || targetVersion === undefined) return c.json({ error: 'curation_not_found' }, 404);
              const merged = await curator.merge({
                sourceId: nodeId,
                targetId,
                sourceVersion: version,
                targetVersion,
              });
              result = { mode: 'applied', node: merged } as const;
            } else {
              const discarded = await curator.discard({ nodeId, version });
              result = { mode: 'applied', node: discarded } as const;
            }
            const payload: KnowledgeCurationActionPayload =
              result.mode === 'proposed'
                ? {
                    outcome: 'proposed',
                    proposal: {
                      id: this.#mintHandle(view.projectId, view.perspectiveKey, 'proposal', result.proposal.id),
                      reference: this.#mintReference(view.projectId, 'proposal', result.proposal.id),
                      status: result.proposal.status,
                    },
                  }
                : {
                    outcome: 'applied',
                    node: {
                      id: this.#mintHandle(view.projectId, view.perspectiveKey, 'node', result.node.id),
                      reference: this.#mintReference(view.projectId, 'node', result.node.id),
                      name: result.node.name,
                      kind: result.node.kind ?? 'unknown',
                      version: result.node.version,
                    },
                  };
            return c.json(payload);
          } catch (error) {
            const name = error instanceof Error ? error.name : '';
            if (
              name === 'KnowledgeNotFoundError' ||
              (error instanceof Error && error.message.startsWith('Knowledge curator profile is not registered:'))
            ) {
              return c.json({ error: 'curation_not_found' }, 404);
            }
            if (name === 'KnowledgeConflictError') return c.json({ error: 'curation_conflicted' }, 409);
            throw error;
          }
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/scopes', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const projectId = loose(c).req.param('id')!;
          const scopeHandle = loose(c).req.query('scopeId');
          if (!isKnowledgeHandle(scopeHandle)) return loose(c).json({ error: 'scope_not_found' }, 404);
          const view = await this.#resolveView(loose(c));
          if ('response' in view) return view.response;
          const scopeId = this.#resolveResource(projectId, view.perspectiveKey, 'scope', scopeHandle);
          if (scopeHandle && !scopeId) return loose(c).json({ error: 'scope_not_found' }, 404);
          const selected = await this.#resolveSelectedScope(view, scopeId);
          if (!selected) return loose(c).json({ error: 'scope_not_found' }, 404);
          const cursorHandle = loose(c).req.query('cursor');
          const cursor = this.#resolveHandle(projectId, view.perspectiveKey, 'scope-cursor', cursorHandle);
          if (cursorHandle && !cursor) return loose(c).json({ error: 'cursor_not_found' }, 404);
          const fetched = await view.knowledge.listNodes({
            scopeIds: view.scopeIds,
            membershipScopeIds: [selected.id],
            isScope: true,
            ...(cursor ? { cursor } : {}),
            limit: this.#limits.maxNodes + 2,
          });
          const eligible = fetched.filter(node => node.id !== selected.id);
          const page = eligible.slice(0, this.#limits.maxNodes);
          const children = page.map(node =>
            this.#scopeTreeNode(projectId, view.perspectiveKey, node, view.curationScopeIds.includes(node.id)),
          );
          const last = eligible.length > this.#limits.maxNodes ? page.at(-1) : undefined;
          const selectedNeedsCuration = view.curationScopeIds.includes(selected.id);
          const destinationScopeId = view.view === 'thread' ? view.threadScopeId : view.resourceScopeId;
          const curationDestination =
            selectedNeedsCuration && destinationScopeId
              ? await view.knowledge.getNode({ id: destinationScopeId, scopeIds: view.scopeIds })
              : undefined;
          return loose(c).json({
            scope: this.#scopeTreeNode(projectId, view.perspectiveKey, selected, selectedNeedsCuration),
            children,
            ...(curationDestination
              ? { curationDestination: this.#scopeTreeNode(projectId, view.perspectiveKey, curationDestination) }
              : {}),
            ...(last
              ? {
                  nextCursor: this.#mintHandle(
                    projectId,
                    view.perspectiveKey,
                    'scope-cursor',
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
        handler: async raw => {
          const c = loose(raw);
          const projectId = c.req.param('id')!;
          const scopeHandle = c.req.query('scopeId');
          if (!isKnowledgeHandle(scopeHandle)) return c.json({ error: 'scope_not_found' }, 404);
          const view = await this.#resolveView(c);
          if ('response' in view) return view.response;
          const scopeId = this.#resolveResource(projectId, view.perspectiveKey, 'scope', scopeHandle);
          if (scopeHandle && !scopeId) return c.json({ error: 'scope_not_found' }, 404);
          const selected = await this.#resolveSelectedScope(view, scopeId);
          if (!selected) return c.json({ error: 'scope_not_found' }, 404);

          const requestedLimit = Number(c.req.query('limit') ?? this.#limits.maxNodes);
          const limit = Number.isInteger(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), this.#limits.maxNodes)
            : this.#limits.maxNodes;
          const cursorHandle = c.req.query('cursor');
          const cursorPayload = this.#resolveHandle(projectId, view.perspectiveKey, 'lens-cursor', cursorHandle);
          if (cursorHandle && !cursorPayload) return c.json({ error: 'cursor_not_found' }, 404);
          let cursor: string | undefined;
          if (cursorPayload) {
            try {
              const parsed: unknown = JSON.parse(cursorPayload);
              if (
                !Array.isArray(parsed) ||
                parsed.length !== 3 ||
                parsed[0] !== selected.id ||
                parsed[1] !== limit ||
                typeof parsed[2] !== 'string'
              ) {
                return c.json({ error: 'cursor_not_found' }, 404);
              }
              cursor = parsed[2];
            } catch {
              return c.json({ error: 'cursor_not_found' }, 404);
            }
          }

          const selectedView: ResolvedView = {
            ...view,
            pinScopes: view.pinScopes.filter(level => level.scopeId === selected.id),
          };
          const pinnedNodeIds = await this.#pinnedNodeIds(selectedView);
          const pinnedNodeIdSet = new Set(pinnedNodeIds.map(value => value.id));
          const fetched: KnowledgeNode[] = [];
          const fetchTarget = limit + pinnedNodeIdSet.size + 1;
          let nodeCursor = cursor;
          while (fetched.length < fetchTarget) {
            const batchLimit = Math.min(100, fetchTarget - fetched.length);
            const batch = await view.knowledge.listNodes({
              scopeIds: view.scopeIds,
              membershipScopeIds: [selected.id],
              isScope: false,
              ...(nodeCursor ? { cursor: nodeCursor } : {}),
              limit: batchLimit,
            });
            fetched.push(...batch);
            const batchLast = batch.at(-1);
            if (batch.length < batchLimit || !batchLast) break;
            nodeCursor = createKnowledgeNodeCursor(batchLast, { isScope: false });
          }
          const eligible = fetched.filter(node => !pinnedNodeIdSet.has(node.id));
          const nodes = eligible.slice(0, limit);
          const last = eligible.length > limit ? nodes.at(-1) : undefined;

          const recordWindow: KnowledgeRecord[] = [];
          let recordsTruncated = false;
          for (const node of nodes) {
            if (recordWindow.length >= this.#limits.maxRecords) {
              recordsTruncated = true;
              break;
            }
            const result = await view.knowledge.listRecords({
              node: node.id,
              scopeIds: view.scopeIds,
              membershipScopeIds: [selected.id],
              limit: Math.min(100, this.#limits.maxRecords - recordWindow.length + 1),
            });
            if (result.nextCursor || result.records.length + recordWindow.length > this.#limits.maxRecords) {
              recordsTruncated = true;
            }
            recordWindow.push(...result.records.slice(0, this.#limits.maxRecords - recordWindow.length));
          }
          const recordIds = new Set(recordWindow.map(record => record.id));
          for (const node of nodes) {
            if (recordWindow.length >= this.#limits.maxRecords) {
              recordsTruncated = true;
              break;
            }
            const result = await view.knowledge.listMentioningRecords({
              node: node.id,
              scopeIds: view.scopeIds,
              membershipScopeIds: [selected.id],
              limit: Math.min(100, this.#limits.maxRecords - recordWindow.length + 1),
            });
            if (result.nextCursor) recordsTruncated = true;
            for (const record of result.records) {
              if (recordIds.has(record.id)) continue;
              if (recordWindow.length >= this.#limits.maxRecords) {
                recordsTruncated = true;
                break;
              }
              recordIds.add(record.id);
              recordWindow.push(record);
            }
          }
          recordWindow.sort((a, b) => b.id.localeCompare(a.id));

          const resolver = WikilinkResolver.create(view.knowledge, nodes, selected.id, this.#limits.maxFallbackLookups);
          const pinnedRecords = await this.#pinnedRecords(selectedView, pinnedNodeIds);
          const accented = new Set<string>();
          const edges: KnowledgeGraphEdge[] = [];
          const boundaryNodes = new Map<string, { node: KnowledgeNode; scope?: KnowledgeNode }>();
          const edgeSeen = new Set<string>();
          for (const { record } of pinnedRecords) {
            const targets: string[] = [];
            for (const name of parseKnowledgeWikilinks(record.text)) {
              const target = await resolver.resolve(name, view.scopeIds);
              if (target && resolver.inWindowId(target.id) && !targets.includes(target.id)) targets.push(target.id);
            }
            if (targets.length === 1) accented.add(targets[0]!);
            for (let a = 0; a < targets.length; a++) {
              for (let b = a + 1; b < targets.length; b++) {
                const key = `${targets[a]}\u0000${targets[b]}\u0000pin`;
                if (edgeSeen.has(key) || edges.length >= this.#limits.maxEdges) continue;
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
          const recordCounts = new Map<string, number>();
          let edgesTruncated = false;
          for (const record of recordWindow) {
            recordCounts.set(record.nodeId, (recordCounts.get(record.nodeId) ?? 0) + 1);
            for (const name of parseKnowledgeWikilinks(record.text)) {
              const target = await resolver.resolve(name, view.scopeIds);
              if (!target || target.id === record.nodeId) continue;
              const outsideWindow = !resolver.inWindowId(target.id);
              let boundary = false;
              if (outsideWindow) {
                const existing = boundaryNodes.get(target.id);
                if (existing) {
                  boundary = Boolean(existing.scope);
                } else {
                  if (boundaryNodes.size >= this.#limits.maxBoundaryNodes) {
                    edgesTruncated = true;
                    continue;
                  }
                  const targetScope = await this.#lensTargetScope(view, target.id, selected.id);
                  if (!targetScope) continue;
                  if (targetScope.id === selected.id) {
                    edgesTruncated = true;
                    continue;
                  }
                  boundary = true;
                  boundaryNodes.set(target.id, { node: target, scope: targetScope });
                }
              }
              const key = `${record.nodeId}\u0000${target.id}`;
              if (edgeSeen.has(key)) continue;
              if (edges.length >= this.#limits.maxEdges) {
                edgesTruncated = true;
                continue;
              }
              edgeSeen.add(key);
              edges.push({
                id: `wikilink:${record.nodeId}:${target.id}`,
                source: record.nodeId,
                target: target.id,
                type: 'wikilink',
                recordId: record.id,
                ...(boundary ? { boundary: true } : {}),
              });
            }
          }

          const activity = await view.knowledge.listActivity({
            scopeIds: view.scopeIds,
            membershipScopeIds: [selected.id],
            limit: 1,
          });
          const graphNodes = [
            ...nodes.map(node => ({ node, boundaryScope: undefined })),
            ...[...boundaryNodes.values()].map(value => ({ node: value.node, boundaryScope: value.scope })),
          ].map(({ node, boundaryScope }) => {
            const description = metadataString(node.metadata, 'description');
            return {
              id: this.#mintHandle(projectId, view.perspectiveKey, 'node', node.id),
              reference: this.#mintReference(projectId, 'node', node.id),
              name: node.name,
              kind: node.kind ?? 'concept',
              ...(description ? { description } : {}),
              pinned: accented.has(node.id),
              recordCount: recordCounts.get(node.id) ?? 0,
              ...(boundaryScope
                ? { boundary: { scope: this.#scopeTreeNode(projectId, view.perspectiveKey, boundaryScope) } }
                : {}),
              createdAt: node.createdAt.toISOString(),
              updatedAt: node.updatedAt.toISOString(),
            } satisfies KnowledgeGraphNode;
          });
          const incomplete = Boolean(recordsTruncated || edgesTruncated || resolver.cappedCount);
          const payload: KnowledgeGraphPayload = {
            view: view.view,
            scope: this.#scopeTreeNode(
              projectId,
              view.perspectiveKey,
              selected,
              view.curationScopeIds.includes(selected.id),
            ),
            nodes: graphNodes,
            edges: edges.map(edge => ({
              ...edge,
              id: this.#mintHandle(projectId, view.perspectiveKey, 'record', edge.id),
              source: this.#mintHandle(projectId, view.perspectiveKey, 'node', edge.source),
              target: this.#mintHandle(projectId, view.perspectiveKey, 'node', edge.target),
              recordId: this.#mintHandle(projectId, view.perspectiveKey, 'record', edge.recordId),
            })),
            records: [],
            page: {
              truncated: Boolean(last || incomplete),
              incomplete,
              ...(last
                ? {
                    nextCursor: this.#mintHandle(
                      projectId,
                      view.perspectiveKey,
                      'lens-cursor',
                      JSON.stringify([selected.id, limit, createKnowledgeNodeCursor(last, { isScope: false })]),
                    ),
                  }
                : {}),
            },
            limits: {
              maxNodes: limit,
              maxEdges: this.#limits.maxEdges,
              maxBoundaryNodes: this.#limits.maxBoundaryNodes,
              boundaryHops: 1,
            },
            ...(activity[0]
              ? { version: this.#mintHandle(projectId, view.perspectiveKey, 'activity-cursor', activity[0].id) }
              : {}),
          };
          return c.json(payload);
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/nodes/:nodeId', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const projectId = loose(c).req.param('id')!;
          const scopeHandle = loose(c).req.query('scopeId');
          if (!isKnowledgeHandle(scopeHandle)) return loose(c).json({ error: 'scope_not_found' }, 404);
          const nodeHandle = loose(c).req.param('nodeId');
          if (!isKnowledgeHandle(nodeHandle)) return loose(c).json({ error: 'node_not_found' }, 404);
          const view = await this.#resolveView(loose(c));
          if ('response' in view) return view.response;
          const scopeId = this.#resolveResource(projectId, view.perspectiveKey, 'scope', scopeHandle);
          if (scopeHandle && !scopeId) return c.json({ error: 'scope_not_found' }, 404);
          const nodeId = this.#resolveResource(projectId, view.perspectiveKey, 'node', nodeHandle);
          if (!nodeId) return c.json({ error: 'node_not_found' }, 404);
          const selected = await this.#resolveSelectedScope(view, scopeId);
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
              reference: this.#mintReference(projectId, 'node', node.id),
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
          const scopeHandle = c.req.query('scopeId');
          if (!isKnowledgeHandle(scopeHandle)) return c.json({ error: 'scope_not_found' }, 404);
          const view = await this.#resolveView(c);
          if ('response' in view) return view.response;
          const scopeId = this.#resolveResource(projectId, view.perspectiveKey, 'scope', scopeHandle);
          if (scopeHandle && !scopeId) return c.json({ error: 'scope_not_found' }, 404);
          const selected = await this.#resolveSelectedScope(view, scopeId);
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
          const after = this.#resolveHandle(projectId, view.perspectiveKey, 'activity-cursor', cursorHandle);
          if (cursorHandle && !after) return c.json({ error: 'cursor_not_found' }, 404);
          const events = await view.knowledge.listActivity({
            scopeIds: view.scopeIds,
            membershipScopeIds: [selected.id],
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
                id: this.#mintHandle(projectId, view.perspectiveKey, 'activity-cursor', event.id),
                action: event.action,
                targetType: event.targetType,
                ...(event.contextScopeId && view.readableScopeIds.includes(event.contextScopeId)
                  ? {
                      scopeId: this.#mintHandle(projectId, view.perspectiveKey, 'scope', event.contextScopeId),
                    }
                  : {}),
                sourceType: event.importRunId ? ('importer' as const) : ('system' as const),
                ...(run
                  ? {
                      sourceId: run.importerId,
                      importRunId: this.#mintReference(projectId, 'run', run.id),
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
                  nextCursor: this.#mintHandle(projectId, view.perspectiveKey, 'activity-cursor', events.at(-1)!.id),
                }
              : {}),
          });
        },
      }),
    ];
  }
}
