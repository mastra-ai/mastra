import { knowledgeAgentImportMemoryResourceId } from '@mastra/core/knowledge';
import type { Knowledge } from '@mastra/core/knowledge';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type {
  KnowledgeActivityEvent,
  KnowledgeImportRun,
  KnowledgeImportRunStatus,
  KnowledgeImportTriggerKind,
  KnowledgeNode,
  KnowledgeRecord,
  KnowledgeScopeIds,
  KnowledgeScopeNodeSummary,
  KnowledgeStorage,
} from '@mastra/core/storage';
import {
  isKnowledgeNodeVisible,
  isKnowledgeScopeVisible,
  KNOWLEDGE_SOURCE_PROBE_LIMIT,
  KnowledgeUnsupportedError,
  MAX_KNOWLEDGE_SCOPE_NODES,
  knowledgeScopeIdsKey,
  parseKnowledgeWikilinks,
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
  /** Max `listScopeNodes` pages (of up to 1,000 scopes) read for one org; past it responses report `truncated`. */
  maxOrgScopePages: number;
}

const DEFAULT_LIMITS: KnowledgeRouteLimits = {
  maxNodes: 500,
  maxRecords: 2000,
  maxFallbackLookups: 100,
  maxOrgScopePages: 10,
};
const SEARCH_SCAN_CAP = 1000;
const SEARCH_RESULT_LIMIT = 20;
const SEARCH_QUERY_LIMIT = 128;

export interface KnowledgeRoutesDeps extends RouteDependencies {
  projects: FactoryProjectsStorage;
  knowledge: (key: string) => Promise<Knowledge | undefined>;
  /** Host-selected Knowledge key. Requests cannot override it; endpoints 503 when it does not resolve. */
  defaultKnowledgeKey?: string;
  limits?: Partial<KnowledgeRouteLimits>;
  /**
   * Current title of a thread, read when a session scope is listed so its label follows renames.
   * Sessions fall back to `session <first 8 of id>` when absent or untitled.
   */
  threadTitle?: (threadId: string) => Promise<string | undefined>;
  /**
   * Host rule for who may see a project's importers, import runs, and transcripts. Unset: anyone who can
   * open the project's Knowledge page. Set it to narrow that, e.g. to organization administrators.
   */
  importOperator?: KnowledgeImportOperatorRule;
}

/** Decides whether an authenticated caller operates a project's Knowledge importers. */
export type KnowledgeImportOperatorRule = (input: {
  orgId: string;
  userId: string;
  projectId: string;
}) => boolean | Promise<boolean>;

type KnowledgeRung = 'org' | 'resource' | 'thread';
type KnowledgeAddressPath = string[];

export interface KnowledgeScopeTreeNode {
  id: string;
  address: string;
  name: string;
  kind?: string;
  description?: string;
  parentIds: string[];
  /** Viewer-visible direct members, capped by the route's node window. */
  memberCount: number;
  /** True when more direct members may exist beyond `memberCount`. */
  memberCountTruncated: boolean;
  /** Content nodes directly assigned to this scope. */
  contentNodeCount: number;
  /** Direct child scopes available for lazy expansion. */
  childScopeCount: number;
}

export interface KnowledgeScopeTreePayload {
  roots: Array<{
    level: KnowledgeRung;
    id: string;
    available: boolean;
    scopeNodeId?: string;
    name?: string;
  }>;
  defaultLevel: 'resource';
  scopeNodes?: KnowledgeScopeTreeNode[];
  /** Cursor for the next sibling page (roots when parentId is omitted). */
  nextCursor?: string;
  /** Initial child-page cursors keyed by parent scope id. */
  childCursors?: Record<string, string>;
  /** Set when the org has more scopes than the route reads. */
  truncated?: true;
}

export interface KnowledgeSearchResult {
  id: string;
  name: string;
  kind: string;
  type: 'scope' | 'node';
  rung: KnowledgeRung | null;
  threadId?: string;
  address?: string;
  description?: string;
}

export interface KnowledgeSearchPayload {
  results: KnowledgeSearchResult[];
  truncated: boolean;
}

export interface KnowledgeGraphNode {
  id: string;
  name: string;
  kind: string;
  description?: string;
  scope: KnowledgeAddressPath | null;
  rung: KnowledgeRung | null;
  isScope?: boolean;
  pinned: boolean;
  recordCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'wikilink' | 'contains';
  recordId?: string;
  pinned?: boolean;
}

export interface KnowledgeGraphRecord {
  id: string;
  nodeIds: string[];
  pinned: boolean;
  text: string;
}

export interface KnowledgeGraphPayload {
  view: 'project' | 'thread';
  threadId?: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  records: KnowledgeGraphRecord[];
  truncated: boolean;
  outOfWindow: Array<{ id: string; name: string; scope: KnowledgeAddressPath; rung: KnowledgeRung }>;
  unresolvedCapped: { count: number; names: string[] };
  pinCensus: { resource: number; thread: number | null };
  version: string | null;
}

export interface KnowledgeNodeRecordPayload {
  id: string;
  node: string;
  relation: 'owned' | 'mentions';
  text: string;
  scope: KnowledgeAddressPath;
  rung: KnowledgeRung;
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
    scope: KnowledgeAddressPath;
    rung: KnowledgeRung;
    createdAt: string;
    updatedAt: string;
  };
  records: KnowledgeNodeRecordPayload[];
}

export interface KnowledgeImporterSummary {
  id: string;
  importKind: 'static' | 'agentic';
  triggers: KnowledgeImportTriggerKind[];
  bindings: Array<{ source: string; scope: string }>;
  lastRun?: KnowledgeImportRunPayload;
}

export interface KnowledgeImportRunPayload {
  id: string;
  importerId: string;
  binding: string;
  source?: string;
  scope?: string;
  importKind: KnowledgeImportRun['importKind'];
  triggerKind: KnowledgeImportRun['triggerKind'];
  status: KnowledgeImportRun['status'];
  error?: string;
  transcriptThreadId?: string;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface KnowledgeImportRunDetailPayload {
  run: KnowledgeImportRunPayload;
  activity: Array<{ id: string; action: string; targetType: string; createdAt: string }>;
  transcript?: {
    threadId: string;
    available: boolean;
    messages: Array<{
      id: string;
      role: string;
      preview: string;
      truncated: boolean;
      omittedBytes: number;
      createdAt: string;
    }>;
  };
}

const MAX_TRANSCRIPT_MESSAGE_PREVIEW_BYTES = 2_000;

function previewTranscriptMessage(content: unknown): { preview: string; truncated: boolean; omittedBytes: number } {
  const serialized = typeof content === 'string' ? content : JSON.stringify(content) || '';
  const bytes = Buffer.from(serialized, 'utf8');
  if (bytes.byteLength <= MAX_TRANSCRIPT_MESSAGE_PREVIEW_BYTES) {
    return { preview: serialized, truncated: false, omittedBytes: 0 };
  }
  const omittedBytes = bytes.byteLength - MAX_TRANSCRIPT_MESSAGE_PREVIEW_BYTES;
  const preview = bytes.subarray(0, MAX_TRANSCRIPT_MESSAGE_PREVIEW_BYTES).toString('utf8');
  return { preview, truncated: true, omittedBytes };
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
  knowledge: Knowledge;
  store: KnowledgeStorage;
  orgId: string;
  projectId: string;
  projectName: string;
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

const SESSION_ADDRESS_RE = /^thread:([^:]+)$/;
const SESSION_NAME_CONCURRENCY = 8;
/** Sessions probed for a visible captured record at once. */
const SESSION_PROBE_CONCURRENCY = 8;

/** Authorized visible events returned per activity page. */
const ACTIVITY_PAGE_SIZE = 25;
/** Events fetched per `listActivity` batch while filling a visible page. */
const ACTIVITY_BATCH = 100;
/** Hard scan cap so a huge hidden or filtered backlog cannot spin the request. */
const ACTIVITY_SCAN_CAP = 1000;
/** Scope nodes returned per parent while lazily expanding the tree. */
const SCOPE_PAGE_SIZE = 25;
/** Bound storage pressure while calculating direct-member counts. */
const SCOPE_COUNT_CONCURRENCY = 8;

/** Sorts scope nodes by name, then id. */
function compareScopeNodes(a: KnowledgeScopeNodeSummary, b: KnowledgeScopeNodeSummary): number {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

/** The thread id of a session (`thread:<id>`) scope address. Which project it belongs to is its parent edge. */
function sessionThreadId(address: string | undefined): string | undefined {
  return address ? SESSION_ADDRESS_RE.exec(address)?.[1] : undefined;
}

/**
 * What a scope node is, for labels: the rung name for vouched identity scopes, otherwise the
 * stored kind, or "topic" for structural scopes created without one.
 */
function scopeKindLabel(address: string | undefined, kind: string | null | undefined): string {
  if (address?.startsWith('org:')) return 'org';
  if (sessionThreadId(address)) return 'session';
  if (address?.startsWith('project:')) return 'project';
  return kind || 'topic';
}

interface ScopeAddressEntry {
  address: string;
  parentIds: string[];
}

/**
 * Addresses for the given scope nodes and their ancestors, read by id so the cost follows what
 * the response shows rather than how many scopes every tenant holds.
 */
async function scopeAddressIndex(
  store: KnowledgeStorage,
  scopeIds: Iterable<string>,
): Promise<Map<string, ScopeAddressEntry>> {
  const index = new Map<string, ScopeAddressEntry>();
  const requested = new Set<string>();
  let pending = [...new Set(scopeIds)];
  try {
    for (let depth = 0; pending.length > 0 && depth < 16; depth += 1) {
      for (const id of pending) requested.add(id);
      const next: string[] = [];
      for (let start = 0; start < pending.length; start += MAX_KNOWLEDGE_SCOPE_NODES) {
        const { scopes } = await store.listScopeNodes({ ids: pending.slice(start, start + MAX_KNOWLEDGE_SCOPE_NODES) });
        for (const scope of scopes) {
          index.set(scope.id, { address: scope.address, parentIds: scope.parentIds });
          next.push(...scope.parentIds.filter(id => !requested.has(id)));
        }
      }
      pending = [...new Set(next)];
    }
  } catch (error) {
    // Adapters without the structural read show paths without addresses.
    if (!(error instanceof KnowledgeUnsupportedError)) throw error;
  }
  return index;
}

/**
 * Scopes in one org (the org scope and everything beneath it), filtered and paged in storage.
 * Reads at most `maxPages` pages; `truncated` is true when scopes remain past that point.
 */
async function listOrgScopeNodes(
  store: KnowledgeStorage,
  orgId: string,
  maxPages: number,
): Promise<{ scopes: KnowledgeScopeNodeSummary[]; truncated: boolean }> {
  const scopes: KnowledgeScopeNodeSummary[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await store.listScopeNodes({ withinAddress: `org:${orgId}`, cursor });
    scopes.push(...result.scopes);
    if (!result.nextCursor) return { scopes, truncated: false };
    cursor = result.nextCursor;
  }
  return { scopes, truncated: true };
}

function knowledgeSearchRank(name: string, query: string): number {
  const normalized = name.toLocaleLowerCase();
  if (normalized === query) return 0;
  if (normalized.startsWith(query)) return 1;
  return 2;
}

function addressPath(scopeIds: KnowledgeScopeIds, addresses: Map<string, ScopeAddressEntry>): KnowledgeAddressPath {
  const path: string[] = [];
  const seen = new Set<string>();
  const visit = (scopeId: string) => {
    if (seen.has(scopeId)) return;
    seen.add(scopeId);
    const entry = addresses.get(scopeId);
    if (!entry) return;
    for (const parentId of entry.parentIds) visit(parentId);
    path.push(entry.address);
  };
  for (const scopeId of scopeIds) visit(scopeId);
  return path;
}

function recordSourceThreadId(record: KnowledgeRecord): string {
  return metadataString(record.metadata, 'sourceThreadId') ?? '';
}

function recordWhen(record: KnowledgeRecord): string | undefined {
  return metadataString(record.metadata, 'when');
}

function importBinding(binding: string): { source?: string; scope?: string } {
  try {
    const parsed: unknown = JSON.parse(binding);
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string'
    ) {
      return { source: parsed[0], scope: parsed[1] };
    }
  } catch {
    // Older or host-managed bindings may be opaque to this read surface.
  }
  return {};
}

/** Importers bind to the project scope; a thread address carries no project, so it never qualifies here. */
function importScopeBelongsToProject(scope: string | undefined, projectId: string): boolean {
  return scope === `project:${projectId}`;
}

function importRunBelongsToProject(run: KnowledgeImportRun, projectId: string): boolean {
  return importScopeBelongsToProject(importBinding(run.binding).scope, projectId);
}

function importRunPayload(run: KnowledgeImportRun): KnowledgeImportRunPayload {
  return {
    id: run.id,
    importerId: run.importerId,
    binding: run.binding,
    ...importBinding(run.binding),
    importKind: run.importKind,
    triggerKind: run.triggerKind,
    status: run.status,
    error: run.error,
    transcriptThreadId: run.transcriptThreadId,
    queuedAt: run.queuedAt.toISOString(),
    startedAt: run.startedAt?.toISOString(),
    completedAt: run.completedAt?.toISOString(),
  };
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

  async #resolveOperator(
    c: Context,
  ): Promise<{ knowledge: Knowledge; orgId: string; projectId: string } | { response: Response }> {
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
    if (!(await this.#isImportOperator({ orgId: tenant.orgId, userId: tenant.userId, projectId }))) {
      return { response: c.json({ error: 'forbidden' }, 403) };
    }

    // Requests cannot override the host-selected Knowledge key.
    const knowledge = await this.deps.knowledge(this.deps.defaultKnowledgeKey ?? 'default').catch(() => undefined);
    if (!knowledge || !(await knowledge.getStorage().catch(() => undefined))) {
      return {
        response: c.json(
          { error: 'knowledge_unavailable', message: 'The configured Knowledge runtime is unavailable.' },
          503,
        ),
      };
    }
    return { knowledge, orgId: tenant.orgId, projectId };
  }

  async #isImportOperator(input: { orgId: string; userId: string; projectId: string }): Promise<boolean> {
    if (this.deps.importOperator) return (await this.deps.importOperator(input)) === true;
    return true;
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
    const project = await this.deps.projects.get({ orgId: tenant.orgId, id: projectId });
    if (!project) {
      return { response: c.json({ error: 'Project not found' }, 404) };
    }
    let knowledge: Knowledge | undefined;
    try {
      // Host-selected key only: an untrusted query parameter must never select
      // another registered Knowledge runtime.
      const key = this.deps.defaultKnowledgeKey ?? 'default';
      knowledge = key.trim() ? await this.deps.knowledge(key) : undefined;
    } catch {
      knowledge = undefined;
    }
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
    const orgAddress = `org:${tenant.orgId}`;
    const resourceAddress = `project:${projectId}`;
    const threadAddress = threadId ? `thread:${threadId}` : undefined;
    const thread = threadAddress ? await store.getScopeAddress(threadAddress) : undefined;
    if (threadAddress && !thread) return { response: c.json({ error: 'thread_not_found' }, 404) };
    // A session belongs to the project it was created under: its parent edge, not its address.
    if (thread) {
      const project = await store.getScopeAddress(resourceAddress);
      if (!project || !(await store.getNodeScopeIds(thread.scopeNodeId)).includes(project.scopeNodeId)) {
        return { response: c.json({ error: 'thread_not_found' }, 404) };
      }
    }
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
        // Identity scopes are vouched by address; any other scope must sit inside the viewer's org.
        if (!visibleScopeIds.includes(preflight.scopeId)) {
          let summary: KnowledgeScopeNodeSummary | undefined;
          try {
            const { scopes } = await store.listScopeNodes({
              withinAddress: orgAddress,
              ids: [preflight.scopeId],
              limit: 1,
            });
            summary = scopes[0];
          } catch (error) {
            // Without the structural read there is no way to prove org membership: fail closed.
            if (!(error instanceof KnowledgeUnsupportedError)) throw error;
          }
          if (!summary) return { response: c.json({ error: 'scope_not_found' }, 404) };
          // Session scopes resolve only under the viewed project, and only when a
          // visible record was captured in that session — other projects' sessions
          // stay as unreachable through drill-downs as they are absent from listings.
          const sessionThread = sessionThreadId(summary.address);
          if (sessionThread) {
            const ownSession = summary.parentIds.includes(existingResource.scopeNodeId);
            if (!ownSession) return { response: c.json({ error: 'scope_not_found' }, 404) };
            const probe = await store.listRecordsBySource({
              source: sessionThread,
              scopeIds: [existingOrg.scopeNodeId, existingResource.scopeNodeId, preflight.scopeId],
              limit: 1,
            });
            if (probe.records.length === 0) return { response: c.json({ error: 'scope_not_found' }, 404) };
          }
        }
        const scope = await store.getNode(preflight.scopeId);
        if (!scope?.isScope || scope.deletedAt) return { response: c.json({ error: 'scope_not_found' }, 404) };
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

    // Materialized scopes are never retrofitted, so only a missing rung needs the write path.
    const orgScopeId =
      (await store.getScopeAddress(orgAddress))?.scopeNodeId ??
      (
        await knowledge.materializeScope({
          address: orgAddress,
          contextualScopeAddress: orgAddress,
          parameters: { orgId: tenant.orgId },
        })
      ).scopes[orgAddress]!;
    const resourceScopeId =
      (await store.getScopeAddress(resourceAddress))?.scopeNodeId ??
      (
        await knowledge.materializeScope({
          address: resourceAddress,
          name: project.name,
          parentAddresses: [orgAddress],
          contextualScopeAddress: orgAddress,
          parameters: { orgId: tenant.orgId, projectId },
        })
      ).scopes[resourceAddress]!;
    const defaultScopeIds = [orgScopeId, resourceScopeId];
    if (!threadId) {
      return {
        knowledge,
        store,
        orgId: tenant.orgId,
        projectId,
        projectName: project.name,
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
      knowledge,
      store,
      orgId: tenant.orgId,
      projectId,
      projectName: project.name,
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

  /**
   * Display names for session scopes, resolved at read time from the thread's current title
   * (never stored on the scope node, where it would go stale). Keyed by scope node id.
   */
  async #sessionNames(nodes: Array<{ id: string; address?: string }>): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    const sessions = nodes.flatMap(node => {
      const threadId = sessionThreadId(node.address);
      return threadId ? [{ id: node.id, threadId }] : [];
    });
    for (let index = 0; index < sessions.length; index += SESSION_NAME_CONCURRENCY) {
      await Promise.all(
        sessions.slice(index, index + SESSION_NAME_CONCURRENCY).map(async ({ id, threadId }) => {
          let title: string | undefined;
          try {
            title = (await this.deps.threadTitle?.(threadId))?.trim();
          } catch {
            // A failed title read only costs the label; fall back below.
          }
          names.set(id, title || `session ${threadId.slice(0, 8)}`);
        }),
      );
    }
    return names;
  }

  /**
   * Session scopes are listed only under the viewed project, and only when the thread
   * drill-down would accept them (a visible record captured in that session), so no
   * listing exposes a session id the drill-down would reject. Returns the ids of hidden
   * session nodes. With `probe: false` only the cheap project check runs; callers probe
   * the bounded set they return.
   */
  async #hiddenSessionIds(
    view: ResolvedView,
    nodes: Array<{ id: string; address?: string; parentIds?: string[] }>,
    { probe }: { probe: boolean },
  ): Promise<Set<string>> {
    const hidden = new Set<string>();
    const sessions: Array<{ id: string; threadId: string }> = [];
    for (const node of nodes) {
      const threadId = sessionThreadId(node.address);
      if (!threadId) continue;
      if (!node.parentIds?.includes(view.resourceScopeId)) {
        hidden.add(node.id);
      } else if (probe && threadId !== view.threadId) {
        sessions.push({ id: node.id, threadId });
      }
    }
    // One bounded storage query per KNOWLEDGE_SOURCE_PROBE_LIMIT sessions answers which threads hold a visible
    // record, so the work no longer grows with one probe per session. Each thread is paired with its own session
    // scope, so a record filed under a sibling session never makes another session look live.
    for (let index = 0; index < sessions.length; index += KNOWLEDGE_SOURCE_PROBE_LIMIT) {
      const batch = sessions.slice(index, index + KNOWLEDGE_SOURCE_PROBE_LIMIT);
      let live: Set<string>;
      try {
        live = new Set(
          await view.store.listSourcesWithVisibleRecords({
            sources: batch.map(session => ({ source: session.threadId, scopeId: session.id })),
            scopeIds: [view.orgScopeId, view.resourceScopeId],
          }),
        );
      } catch (error) {
        if (!(error instanceof KnowledgeUnsupportedError)) throw error;
        live = new Set();
        for (let at = 0; at < batch.length; at += SESSION_PROBE_CONCURRENCY) {
          await Promise.all(
            batch.slice(at, at + SESSION_PROBE_CONCURRENCY).map(async ({ id, threadId }) => {
              const { records } = await view.store.listRecordsBySource({
                source: threadId,
                scopeIds: [view.orgScopeId, view.resourceScopeId, id],
                limit: 1,
              });
              if (records.length > 0) live.add(threadId);
            }),
          );
        }
      }
      for (const session of batch) if (!live.has(session.threadId)) hidden.add(session.id);
    }
    return hidden;
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
    return scope?.isScope && !scope.deletedAt ? scope : null;
  }

  async #projectImportRuns(input: {
    knowledge: Knowledge;
    projectId: string;
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
        importerId: input.importerId,
        binding: input.binding,
        status: input.status,
        after,
        limit: 100,
      });
      for (const run of page.runs) {
        if (run.importerId !== input.importerId || !importRunBelongsToProject(run, input.projectId)) continue;
        if (input.binding && run.binding !== input.binding) continue;
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
              ).filter(binding => importScopeBelongsToProject(binding.scope, resolved.projectId));
              const lastRun = (
                await this.#projectImportRuns({
                  knowledge: resolved.knowledge,
                  projectId: resolved.projectId,
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
                lastRun: lastRun ? importRunPayload(lastRun) : undefined,
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
          const importerId = c.req.param('importerId');
          if (!importerId) return c.json({ error: 'importer_not_found' }, 404);

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
          const binding = c.req.query('binding');
          if (binding && !importScopeBelongsToProject(importBinding(binding).scope, resolved.projectId)) {
            return c.json({ runs: [] });
          }
          const page = await this.#projectImportRuns({
            knowledge: resolved.knowledge,
            projectId: resolved.projectId,
            importerId,
            binding,
            status,
            trigger,
            from,
            to,
            after: c.req.query('cursor'),
            limit: 100,
          });
          return c.json({ runs: page.runs.map(importRunPayload), nextCursor: page.nextCursor });
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/importers/:importerId/runs/:runId', {
        method: 'GET',
        requiresAuth: true,
        handler: async raw => {
          const c = loose(raw);
          const resolved = await this.#resolveOperator(c);
          if ('response' in resolved) return resolved.response;
          const importerId = c.req.param('importerId');
          if (!importerId) return c.json({ error: 'importer_not_found' }, 404);
          const importer = resolved.knowledge.getImporter(importerId);
          const runId = c.req.param('runId');
          if (!runId) return c.json({ error: 'import_run_not_found' }, 404);
          const run = await resolved.knowledge.getImportRun(runId);
          if (!run || run.importerId !== importerId || !importRunBelongsToProject(run, resolved.projectId)) {
            return c.json({ error: 'import_run_not_found' }, 404);
          }

          const store = await resolved.knowledge.getStorage();
          const binding = importBinding(run.binding);
          const scope = binding.scope ? await store.getScopeAddress(binding.scope) : undefined;
          const activity = scope
            ? await resolved.knowledge.listActivity({ scopeIds: [scope.scopeNodeId], importRunId: run.id, limit: 100 })
            : [];
          let transcript: KnowledgeImportRunDetailPayload['transcript'];
          if (run.transcriptThreadId) {
            const memory = importer?.agentic
              ? await importer.agentic.agent.getMemory().catch(() => undefined)
              : undefined;
            const recalled = memory
              ? await memory
                  .recall({
                    threadId: run.transcriptThreadId,
                    resourceId: knowledgeAgentImportMemoryResourceId(resolved.knowledge, run.importerId, run.binding),
                    perPage: 100,
                  })
                  .catch(() => undefined)
              : undefined;
            transcript = {
              threadId: run.transcriptThreadId,
              available: Boolean(recalled),
              messages:
                recalled?.messages.map(message => ({
                  id: message.id,
                  role: message.role,
                  ...previewTranscriptMessage(message.content),
                  createdAt: message.createdAt.toISOString(),
                })) ?? [],
            };
          }
          const payload: KnowledgeImportRunDetailPayload = {
            run: importRunPayload(run),
            activity: activity.map(event => ({
              id: event.id,
              action: event.action,
              targetType: event.targetType,
              createdAt: event.createdAt.toISOString(),
            })),
            transcript,
          };
          return c.json(payload);
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/scopes', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const view = await this.#resolveView(loose(c));
          if ('response' in view) return view.response;
          const parentId = loose(c).req.query('parentId');
          const cursor = loose(c).req.query('cursor');
          let scopeNodes: KnowledgeScopeTreeNode[] | undefined;
          let scopesTruncated = false;
          let nextCursor: string | undefined;
          const childCursors: Record<string, string> = {};
          let storedScopeNodes: KnowledgeScopeNodeSummary[] = [];
          try {
            const orgScopes = await listOrgScopeNodes(view.store, view.orgId, this.#limits.maxOrgScopePages);
            scopesTruncated = orgScopes.truncated;
            // Hidden sessions (foreign projects' sessions and own sessions without
            // visible records) are removed BEFORE any paging or count math, so no
            // cursor, child cursor, or count can disclose a session the drill-down
            // would reject. The probe only runs for the viewer's own project's
            // sessions — foreign ones fail the cheap structural check first.
            const hiddenSessions = await this.#hiddenSessionIds(view, orgScopes.scopes, { probe: true });
            storedScopeNodes = orgScopes.scopes.filter(scope => !hiddenSessions.has(scope.id));
            const scopeNodeById = new Map(storedScopeNodes.map(node => [node.id, node]));
            const childScopeCountByParent = new Map<string, number>();
            for (const node of storedScopeNodes) {
              for (const ancestorId of node.parentIds) {
                childScopeCountByParent.set(ancestorId, (childScopeCountByParent.get(ancestorId) ?? 0) + 1);
              }
            }
            if (parentId && !scopeNodeById.has(parentId)) {
              return loose(c).json({ error: 'scope_not_found' }, 404);
            }

            const siblings = storedScopeNodes
              .filter(node => (parentId ? node.parentIds.includes(parentId) : node.parentIds.length === 0))
              .sort(compareScopeNodes);
            const cursorIndex = cursor ? siblings.findIndex(node => node.id === cursor) : -1;
            if (cursor && cursorIndex < 0) {
              return loose(c).json({ error: 'invalid_scope_cursor' }, 400);
            }
            const pageStart = cursorIndex + 1;
            const siblingPage = siblings.slice(pageStart, pageStart + SCOPE_PAGE_SIZE);
            if (pageStart + siblingPage.length < siblings.length) {
              nextCursor = siblingPage.at(-1)?.id;
            }

            const returnedById = new Map(siblingPage.map(node => [node.id, node]));
            if (!parentId) {
              // The active identity chain must stay present even when it is
              // deeper than one level, or rung/tree dedup would regress on a
              // thread view. It is included FIRST so the window cap can never
              // evict it in favor of earlier-sorting structural scopes.
              const identityAddresses = new Set([
                `org:${view.orgId}`,
                `project:${view.projectId}`,
                ...(view.threadId ? [`thread:${view.threadId}`] : []),
              ]);
              const includeWithParents = (node: KnowledgeScopeNodeSummary): void => {
                if (returnedById.has(node.id) || returnedById.size >= this.#limits.maxNodes) return;
                for (const ancestorId of node.parentIds) {
                  const ancestor = scopeNodeById.get(ancestorId);
                  if (ancestor) includeWithParents(ancestor);
                }
                returnedById.set(node.id, node);
              };
              for (const node of storedScopeNodes) {
                if (identityAddresses.has(node.address)) includeWithParents(node);
              }

              // Initial load: roots plus their first page of immediate children.
              // Deeper levels are fetched only when that scope is expanded.
              const addFirstChildPage = (parent: KnowledgeScopeNodeSummary): void => {
                const children = storedScopeNodes
                  .filter(node => node.parentIds.includes(parent.id))
                  .sort(compareScopeNodes);
                const returnedChildren: KnowledgeScopeNodeSummary[] = [];
                for (const child of children.slice(0, SCOPE_PAGE_SIZE)) {
                  if (returnedById.size >= this.#limits.maxNodes && !returnedById.has(child.id)) break;
                  returnedById.set(child.id, child);
                  returnedChildren.push(child);
                }
                if (returnedChildren.length < children.length) {
                  const lastChild = returnedChildren.at(-1);
                  if (lastChild) childCursors[parent.id] = lastChild.id;
                }
              };
              for (const root of siblingPage) addFirstChildPage(root);
              // The viewed project's first page of children (its sessions among
              // them) loads with the tree, so a session is listed without
              // expanding the project first.
              const projectNode = storedScopeNodes.find(node => node.address === `project:${view.projectId}`);
              if (projectNode && returnedById.has(projectNode.id)) addFirstChildPage(projectNode);
            }

            const returnedNodes = [...returnedById.values()].sort(compareScopeNodes);
            scopeNodes = [];
            for (let index = 0; index < returnedNodes.length; index += SCOPE_COUNT_CONCURRENCY) {
              const batch = returnedNodes.slice(index, index + SCOPE_COUNT_CONCURRENCY);
              scopeNodes.push(
                ...(await Promise.all(
                  batch.map(async scope => {
                    const members = await view.store.listNodes({
                      scopeIds: [scope.id],
                      isScope: false,
                      limit: this.#limits.maxNodes + 1,
                    });
                    const contentNodeCount = Math.min(members.length, this.#limits.maxNodes);
                    const childScopeCount = childScopeCountByParent.get(scope.id) ?? 0;
                    const directMemberCount = childScopeCount + contentNodeCount;
                    return {
                      id: scope.id,
                      address: scope.address,
                      name: scope.address === `project:${view.projectId}` ? view.projectName : scope.name,
                      kind: scopeKindLabel(scope.address, scope.kind),
                      ...(scope.description ? { description: scope.description } : {}),
                      parentIds: scope.parentIds,
                      memberCount: Math.min(directMemberCount, this.#limits.maxNodes),
                      memberCountTruncated:
                        directMemberCount > this.#limits.maxNodes || members.length > this.#limits.maxNodes,
                      contentNodeCount,
                      childScopeCount,
                    } satisfies KnowledgeScopeTreeNode;
                  }),
                )),
              );
            }
            const sessionNames = await this.#sessionNames(scopeNodes);
            scopeNodes = scopeNodes.map(node => {
              const name = sessionNames.get(node.id);
              return name ? { ...node, name } : node;
            });
          } catch (error) {
            if (!(error instanceof KnowledgeUnsupportedError)) throw error;
            scopeNodes = undefined;
          }
          // Identity rungs are matched against the FULL filtered scope set, not
          // just the returned page, so a rung merges with its scope node even
          // when that node sorts past the current page.
          const scopeNodeByAddress = new Map(storedScopeNodes.map(node => [node.address, node]));
          const identity = [
            { level: 'org' as const, id: view.orgId, address: `org:${view.orgId}` },
            { level: 'resource' as const, id: view.projectId, address: `project:${view.projectId}` },
            ...(view.threadId
              ? [
                  {
                    level: 'thread' as const,
                    id: view.threadId,
                    address: `thread:${view.threadId}`,
                  },
                ]
              : []),
          ];
          const threadRoot = view.threadId ? scopeNodeByAddress.get(`thread:${view.threadId}`) : undefined;
          const threadRootName = threadRoot ? (await this.#sessionNames([threadRoot])).get(threadRoot.id) : undefined;
          return loose(c).json({
            roots: identity.map(({ level, id, address }) => {
              const scopeNode = scopeNodeByAddress.get(address);
              const name =
                scopeNode?.address === `project:${view.projectId}`
                  ? view.projectName
                  : scopeNode && level === 'thread'
                    ? (threadRootName ?? scopeNode.name)
                    : scopeNode?.name;
              return {
                level,
                id,
                available: true,
                ...(scopeNode ? { scopeNodeId: scopeNode.id, name } : {}),
              };
            }),
            defaultLevel: 'resource',
            ...(scopeNodes ? { scopeNodes } : {}),
            ...(nextCursor ? { nextCursor } : {}),
            ...(Object.keys(childCursors).length > 0 ? { childCursors } : {}),
            ...(scopesTruncated ? { truncated: true as const } : {}),
          } satisfies KnowledgeScopeTreePayload);
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/search', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const view = await this.#resolveView(loose(c));
          if ('response' in view) return view.response;

          const query = (loose(c).req.query('q') ?? '').trim().slice(0, SEARCH_QUERY_LIMIT).toLocaleLowerCase();
          if (query.length < 2) {
            return loose(c).json({ results: [], truncated: false } satisfies KnowledgeSearchPayload);
          }

          const scanLimit = Math.min(SEARCH_SCAN_CAP, this.#limits.maxNodes);
          const [prefixNodes, scannedNodes] = await Promise.all([
            view.store.listNodes({
              scopeIds: view.scopeIds,
              isScope: false,
              namePrefix: query,
              limit: SEARCH_RESULT_LIMIT + 1,
            }),
            view.store.listNodes({ scopeIds: view.scopeIds, isScope: false, limit: scanLimit }),
          ]);
          const contentById = new Map<string, KnowledgeNode>();
          for (const node of [...prefixNodes, ...scannedNodes]) {
            if (!node.isScope && node.name.toLocaleLowerCase().includes(query)) contentById.set(node.id, node);
          }

          let structuralScopes: KnowledgeScopeNodeSummary[] = [];
          let scopesTruncated = false;
          try {
            const orgScopes = await listOrgScopeNodes(view.store, view.orgId, this.#limits.maxOrgScopePages);
            scopesTruncated = orgScopes.truncated;
            // Search lists only the viewer's own open session; others are reached from
            // the tree. Matching by scope node id (not thread id) keeps a foreign
            // project's session out even when it reuses the open thread's id.
            structuralScopes = orgScopes.scopes.filter(scope => {
              const threadId = sessionThreadId(scope.address);
              return (!threadId || scope.id === view.threadScopeId) && scope.name.toLocaleLowerCase().includes(query);
            });
          } catch (error) {
            if (!(error instanceof KnowledgeUnsupportedError)) throw error;
          }

          const sessionNames = await this.#sessionNames(structuralScopes);
          const contentResults = await Promise.all(
            [...contentById.values()].map(async node => {
              const rung = rungForScopeIds(await view.store.getNodeScopeIds(node.id), view);
              return {
                id: node.id,
                name: node.name,
                kind: node.kind ?? 'concept',
                type: 'node' as const,
                rung,
                ...(rung === 'thread' && view.threadId ? { threadId: view.threadId } : {}),
              } satisfies KnowledgeSearchResult;
            }),
          );
          const results: KnowledgeSearchResult[] = [
            ...structuralScopes.map(scope => {
              const projectScope = scope.address === `project:${view.projectId}`;
              return {
                id: scope.id,
                name: projectScope ? view.projectName : (sessionNames.get(scope.id) ?? scope.name),
                kind: scopeKindLabel(scope.address, scope.kind),
                type: 'scope' as const,
                rung:
                  scope.id === view.orgScopeId
                    ? ('org' as const)
                    : scope.id === view.resourceScopeId
                      ? ('resource' as const)
                      : scope.id === view.threadScopeId
                        ? ('thread' as const)
                        : null,
                address: scope.address,
                ...(scope.description ? { description: scope.description } : {}),
              } satisfies KnowledgeSearchResult;
            }),
            ...contentResults,
          ].sort(
            (a, b) =>
              knowledgeSearchRank(a.name, query) - knowledgeSearchRank(b.name, query) ||
              a.name.localeCompare(b.name) ||
              a.id.localeCompare(b.id),
          );

          return loose(c).json({
            results: results.slice(0, SEARCH_RESULT_LIMIT),
            truncated:
              scopesTruncated ||
              results.length > SEARCH_RESULT_LIMIT ||
              prefixNodes.length > SEARCH_RESULT_LIMIT ||
              scannedNodes.length >= scanLimit,
          } satisfies KnowledgeSearchPayload);
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/subgraph', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const request = loose(c);
          const scopeNodeId = request.req.query('scopeNodeId');
          const scopeLevel = request.req.query('scopeLevel');
          if (!scopeNodeId && !scopeLevel) return request.json({ error: 'scope_not_found' }, 404);
          const view = await this.#resolveView(request, { scopeId: scopeNodeId });
          if ('response' in view) return view.response;
          const identityScopeId =
            scopeLevel === 'org'
              ? view.orgScopeId
              : scopeLevel === 'thread'
                ? view.threadScopeId
                : view.resourceScopeId;
          const selected = await this.#resolveSelectedScope(view, scopeNodeId ?? identityScopeId);
          if (!selected) return request.json({ error: 'scope_not_found' }, 404);
          const { store } = view;
          const membershipScopeIds = scopeNodeId
            ? [selected.id]
            : scopeLevel === 'org'
              ? [view.orgScopeId]
              : scopeLevel === 'thread'
                ? view.scopeIds
                : [view.orgScopeId, view.resourceScopeId];
          const resolutionScopeIds = [...new Set([...view.scopeIds, selected.id])];
          const selectedView: ResolvedView = {
            ...view,
            scopeIds: resolutionScopeIds,
            pinRungs: scopeNodeId
              ? view.pinRungs.filter(rung => rung.scopeId === selected.id)
              : scopeLevel === 'thread'
                ? view.pinRungs
                : view.pinRungs.filter(rung => rung.rung === 'resource'),
          };
          const fetched = await store.listNodes({
            scopeIds: membershipScopeIds,
            ...(scopeNodeId ? {} : { isScope: false }),
            limit: this.#limits.maxNodes + 1,
          });
          let truncated = fetched.length > this.#limits.maxNodes;
          const pinnedNodeIds = await this.#pinnedNodeIds(selectedView);
          const pinnedNodeIdSet = new Set(pinnedNodeIds.map(value => value.id));
          const directMembers: KnowledgeNode[] = [];
          for (const node of fetched.slice(0, this.#limits.maxNodes)) {
            if (node.id === selected.id || pinnedNodeIdSet.has(node.id)) continue;
            const nodeScopeIds = await store.getNodeScopeIds(node.id);
            if (scopeNodeId && !nodeScopeIds.includes(selected.id)) continue;
            if (!node.isScope && !isKnowledgeScopeVisible(nodeScopeIds, view.scopeIds)) continue;
            directMembers.push(node);
          }
          // Hidden sessions never surface as scope members either: a lens on a sibling
          // project (or this one) must not expose session ids the drill-down rejects.
          const memberScopes = directMembers.filter(node => node.isScope);
          if (memberScopes.length > 0) {
            const memberAddresses = await scopeAddressIndex(
              store,
              memberScopes.map(node => node.id),
            );
            const hiddenSessions = await this.#hiddenSessionIds(
              view,
              memberScopes.map(node => ({
                id: node.id,
                address: memberAddresses.get(node.id)?.address,
                parentIds: memberAddresses.get(node.id)?.parentIds,
              })),
              { probe: true },
            );
            // Without a proven address (adapters lacking structural reads, or a
            // partial read) a scope member cannot be shown to be harmless: fail closed.
            for (const node of memberScopes) {
              if (!memberAddresses.get(node.id)?.address) hiddenSessions.add(node.id);
            }
            if (hiddenSessions.size > 0) {
              directMembers.splice(
                0,
                directMembers.length,
                ...directMembers.filter(node => !hiddenSessions.has(node.id)),
              );
            }
          }
          const contentNodes = directMembers.filter(node => !node.isScope);
          const recordWindow: KnowledgeRecord[] = [];
          for (const node of contentNodes) {
            if (recordWindow.length > this.#limits.maxRecords) break;
            const result = await store.listRecords({
              node,
              scopeIds: resolutionScopeIds,
              membershipScopeIds,
              limit: this.#limits.maxRecords + 1 - recordWindow.length,
            });
            recordWindow.push(...result.records);
          }
          recordWindow.sort((a, b) => b.id.localeCompare(a.id));
          if (recordWindow.length > this.#limits.maxRecords) {
            truncated = true;
            recordWindow.length = this.#limits.maxRecords;
          }
          const resolver = await WikilinkResolver.create(store, contentNodes, this.#limits.maxFallbackLookups);
          const edges: KnowledgeGraphEdge[] = scopeNodeId
            ? directMembers.map(node => ({
                id: `contains:${selected.id}:${node.id}`,
                source: selected.id,
                target: node.id,
                type: 'contains',
              }))
            : [];
          const records: KnowledgeGraphRecord[] = [];
          const boundaryNodes = new Map<string, KnowledgeNode>();
          const edgeSeen = new Set<string>();
          const recordCounts = new Map<string, number>();
          for (const record of recordWindow) {
            recordCounts.set(record.nodeId, (recordCounts.get(record.nodeId) ?? 0) + 1);
            const nodeIds = [record.nodeId];
            for (const name of parseKnowledgeWikilinks(record.text)) {
              const target = await resolver.resolve(name, resolutionScopeIds);
              if (!target || target.id === record.nodeId) continue;
              if (!nodeIds.includes(target.id)) nodeIds.push(target.id);
              if (!resolver.inWindowId(target.id)) {
                boundaryNodes.set(target.id, target);
                continue;
              }
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
            records.push({ id: record.id, nodeIds, pinned: false, text: record.text });
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
            records.push({ id: record.id, nodeIds: targets, pinned: true, text: record.text });
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
          const memberScopeIds = await Promise.all(
            [...directMembers, ...boundaryNodes.values()].map(node => store.getNodeScopeIds(node.id)),
          );
          const addresses = await scopeAddressIndex(store, [
            selected.id,
            ...directMembers.filter(node => node.isScope).map(node => node.id),
            ...memberScopeIds.flat(),
          ]);
          if (scopeNodeId) {
            // Child scopes come from the org's scope read, which may be capped.
            try {
              if ((await listOrgScopeNodes(store, view.orgId, this.#limits.maxOrgScopePages)).truncated)
                truncated = true;
            } catch (error) {
              if (!(error instanceof KnowledgeUnsupportedError)) throw error;
            }
          }
          const sessionNames = await this.#sessionNames(
            [...directMembers.filter(node => node.isScope), selected].map(node => ({
              id: node.id,
              address: addresses.get(node.id)?.address,
            })),
          );
          const graphMembers = await Promise.all(
            directMembers.map(async node => {
              const nodeScopeIds = await store.getNodeScopeIds(node.id);
              const description = metadataString(node.metadata, 'description');
              return {
                id: node.id,
                name: sessionNames.get(node.id) ?? node.name,
                kind: node.isScope
                  ? scopeKindLabel(addresses.get(node.id)?.address, node.kind)
                  : (node.kind ?? 'concept'),
                ...(description ? { description } : {}),
                scope: node.isScope ? null : addressPath(nodeScopeIds, addresses),
                rung: node.isScope ? null : rungForScopeIds(nodeScopeIds, view),
                ...(node.isScope ? { isScope: true } : {}),
                pinned: accented.has(node.id),
                recordCount: recordCounts.get(node.id) ?? 0,
                createdAt: node.createdAt.toISOString(),
                updatedAt: node.updatedAt.toISOString(),
              } satisfies KnowledgeGraphNode;
            }),
          );
          const root = scopeNodeId
            ? [
                {
                  id: selected.id,
                  name:
                    selected.id === view.resourceScopeId
                      ? view.projectName
                      : (sessionNames.get(selected.id) ?? selected.name),
                  kind: scopeKindLabel(addresses.get(selected.id)?.address, selected.kind),
                  ...(metadataString(selected.metadata, 'description')
                    ? { description: metadataString(selected.metadata, 'description') }
                    : {}),
                  scope: null,
                  rung: null,
                  isScope: true,
                  pinned: false,
                  recordCount: 0,
                  createdAt: selected.createdAt.toISOString(),
                  updatedAt: selected.updatedAt.toISOString(),
                } satisfies KnowledgeGraphNode,
              ]
            : [];
          const outOfWindow = await Promise.all(
            [...boundaryNodes.values()].map(async node => {
              const nodeScopeIds = await store.getNodeScopeIds(node.id);
              return {
                id: node.id,
                name: node.name,
                scope: addressPath(nodeScopeIds, addresses),
                rung: rungForScopeIds(nodeScopeIds, view),
              };
            }),
          );
          const activity = await store.listActivity({ scopeIds: membershipScopeIds, limit: 1 });
          const payload: KnowledgeGraphPayload = {
            view: view.view,
            ...(view.threadId ? { threadId: view.threadId } : {}),
            nodes: [...root, ...graphMembers],
            edges,
            records,
            truncated,
            outOfWindow,
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
          const request = loose(c);
          const scopeNodeId = request.req.query('scopeNodeId');
          const scopeLevel = request.req.query('scopeLevel');
          const nodeId = request.req.param('nodeId');
          if (!nodeId || nodeId.length > 512) return request.json({ error: 'node_not_found' }, 404);
          const view = await this.#resolveView(request, { scopeId: scopeNodeId });
          if ('response' in view) return view.response;
          const identityScopeId =
            scopeLevel === 'org'
              ? view.orgScopeId
              : scopeLevel === 'thread'
                ? view.threadScopeId
                : view.resourceScopeId;
          const selected = await this.#resolveSelectedScope(view, scopeNodeId ?? identityScopeId);
          if (!selected) return request.json({ error: 'scope_not_found' }, 404);
          const node = await view.store.getNode(nodeId);
          const nodeScopeIds = node ? await view.store.getNodeScopeIds(node.id) : [];
          if (!node || !isKnowledgeNodeVisible(node, nodeScopeIds, [selected.id])) {
            return request.json({ error: 'node_not_found' }, 404);
          }
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
          const recordScopeIds = new Map(
            await Promise.all(
              [...owned.records, ...mentioning.records].map(
                async record => [record.id, await view.store.getRecordScopeIds(record.id)] as const,
              ),
            ),
          );
          const addresses = await scopeAddressIndex(view.store, [
            ...nodeScopeIds,
            ...[...recordScopeIds.values()].flat(),
          ]);
          const seen = new Set<string>();
          const records: KnowledgeNodeRecordPayload[] = [];
          const push = async (record: KnowledgeRecord, relation: 'owned' | 'mentions') => {
            if (seen.has(record.id)) return;
            seen.add(record.id);
            const scopeIds = recordScopeIds.get(record.id) ?? (await view.store.getRecordScopeIds(record.id));
            const when = recordWhen(record);
            records.push({
              id: record.id,
              node: record.nodeId,
              relation,
              text: record.text,
              scope: addressPath(scopeIds, addresses),
              rung: rungForScopeIds(scopeIds, view),
              sourceThreadId: recordSourceThreadId(record),
              capturedAt: record.createdAt.toISOString(),
              ...(when ? { when } : {}),
              pinned: pinnedNodeIdSet.has(record.nodeId),
              ...(record.metadata ? { metadata: record.metadata } : {}),
            });
          };
          for (const record of [...owned.records].sort((a, b) => b.id.localeCompare(a.id))) await push(record, 'owned');
          for (const record of [...mentioning.records].sort((a, b) => b.id.localeCompare(a.id))) {
            await push(record, 'mentions');
          }
          const payload: KnowledgeNodePayload = {
            node: {
              id: node.id,
              name: node.name,
              kind: node.kind ?? 'concept',
              content: metadataString(node.metadata, 'content') ?? metadataString(node.metadata, 'description') ?? '',
              scope: addressPath(nodeScopeIds, addresses),
              rung: rungForScopeIds(nodeScopeIds, view),
              createdAt: node.createdAt.toISOString(),
              updatedAt: node.updatedAt.toISOString(),
            },
            records,
          };
          return request.json(payload);
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/activity', {
        method: 'GET',
        requiresAuth: false,
        handler: async raw => {
          const c = loose(raw);
          const scopeNodeId = c.req.query('scopeNodeId');
          const scopeLevel = c.req.query('scopeLevel');
          if (!scopeNodeId && !scopeLevel) return c.json({ error: 'scope_not_found' }, 404);
          const view = await this.#resolveView(c, { scopeId: scopeNodeId });
          if ('response' in view) return view.response;
          const identityScopeId =
            scopeLevel === 'org'
              ? view.orgScopeId
              : scopeLevel === 'thread'
                ? view.threadScopeId
                : view.resourceScopeId;
          const selected = await this.#resolveSelectedScope(view, scopeNodeId ?? identityScopeId);
          if (!selected) return c.json({ error: 'scope_not_found' }, 404);

          const action = c.req.query('action');
          const sourceType = c.req.query('sourceType');
          const rawFrom = c.req.query('from');
          const from = boundedDate(rawFrom);
          const rawTo = c.req.query('to');
          const to = boundedDate(rawTo);
          if (
            (sourceType && sourceType !== 'importer' && sourceType !== 'system') ||
            (rawFrom && !from) ||
            (rawTo && !to)
          ) {
            return c.json({ error: 'invalid_activity_filters' }, 400);
          }
          const cursor = c.req.query('cursor');
          if (cursor && cursor.length > 128) return c.json({ error: 'invalid_activity_cursor' }, 400);
          // Visibility is re-checked here before any window shaping: a row whose target
          // is not visible in the selected scope is skipped entirely, so no action/type/
          // id/time metadata leaks even when an adapter's activity read is lax about it —
          // and a hidden or filtered backlog can never displace visible events from the page.
          interface VisibleTargetNode {
            node: KnowledgeNode;
            scopeIds: string[];
          }
          const nodeVisibility = new Map<string, Promise<VisibleTargetNode | null>>();
          const visibleNode = (nodeId: string): Promise<VisibleTargetNode | null> => {
            let cached = nodeVisibility.get(nodeId);
            if (!cached) {
              cached = (async () => {
                const node = await view.store.getNode(nodeId);
                if (!node) return null;
                const scopeIds = await view.store.getNodeScopeIds(nodeId);
                return isKnowledgeScopeVisible(scopeIds, [selected.id]) ? { node, scopeIds } : null;
              })();
              nodeVisibility.set(nodeId, cached);
            }
            return cached;
          };
          // Resolves the event's owner node when the event is visible, null otherwise.
          const visibleEventNode = async (event: KnowledgeActivityEvent): Promise<VisibleTargetNode | null> => {
            if (event.contextScopeId && event.contextScopeId !== selected.id) return null;
            if (action && event.action !== action) return null;
            if (from && event.createdAt < from) return null;
            if (to && event.createdAt > to) return null;
            if (sourceType && (sourceType === 'importer') !== Boolean(event.importRunId)) return null;
            if (event.targetType === 'node') return visibleNode(event.targetId);
            const record = await view.store.getRecord({ id: event.targetId, includeDeleted: true });
            if (!record) return null;
            const recordScopeIds = await view.store.getRecordScopeIds(event.targetId);
            if (!isKnowledgeScopeVisible(recordScopeIds, [selected.id])) return null;
            return visibleNode(record.nodeId);
          };
          // Newest-first scan: fill one visible page plus a lookahead row, bounded by
          // the scan cap. When the cap stops the walk early, the scan position comes
          // back as the cursor so the client can continue without skipping events.
          const collected: Array<{ event: KnowledgeActivityEvent; target: VisibleTargetNode }> = [];
          let after = cursor;
          let scanned = 0;
          let exhausted = false;
          while (collected.length <= ACTIVITY_PAGE_SIZE && scanned < ACTIVITY_SCAN_CAP) {
            const batch = await view.store.listActivity({ scopeIds: [selected.id], after, limit: ACTIVITY_BATCH });
            if (batch.length === 0) {
              exhausted = true;
              break;
            }
            for (const event of batch) {
              after = event.id;
              scanned += 1;
              const target = await visibleEventNode(event);
              if (target) collected.push({ event, target });
              if (collected.length > ACTIVITY_PAGE_SIZE || scanned >= ACTIVITY_SCAN_CAP) break;
            }
          }
          const events = collected.slice(0, ACTIVITY_PAGE_SIZE);
          const lastVisible = events.at(-1);
          const nextCursor =
            collected.length > ACTIVITY_PAGE_SIZE && lastVisible
              ? lastVisible.event.id
              : !exhausted && scanned >= ACTIVITY_SCAN_CAP && after
                ? after
                : undefined;
          const addresses = await scopeAddressIndex(view.store, [
            selected.id,
            ...events.flatMap(({ event }) => (event.contextScopeId ? [event.contextScopeId] : [])),
            ...events.flatMap(({ target }) => target.scopeIds),
          ]);
          const projected = await Promise.all(
            events.map(async ({ event, target }) => {
              const run = event.importRunId ? await view.store.getImportRun(event.importRunId) : undefined;
              const eventScopeIds = event.contextScopeId ? [event.contextScopeId] : [selected.id];
              // Derive the owning session ONLY from the viewed project's own
              // session scopes — a multi-scoped node must never disclose a
              // foreign project's thread id through enrichment.
              const nodeThreadId = target.scopeIds
                .map(scopeId => {
                  const entry = addresses.get(scopeId);
                  return entry?.parentIds.includes(view.resourceScopeId) ? sessionThreadId(entry.address) : undefined;
                })
                .find(threadId => threadId !== undefined);
              return {
                id: event.id,
                action: event.action,
                recordType: event.targetType,
                scope: addressPath(eventScopeIds, addresses),
                node: {
                  id: target.node.id,
                  name: target.node.name,
                  rung: nodeThreadId ? ('thread' as const) : rungForScopeIds(target.scopeIds, view),
                  ...(nodeThreadId ? { threadId: nodeThreadId } : {}),
                },
                sourceType: run ? ('importer' as const) : ('system' as const),
                ...(run ? { sourceId: run.importerId, importRunId: run.id } : {}),
                createdAt: event.createdAt.toISOString(),
              };
            }),
          );
          return c.json({ events: projected, ...(nextCursor ? { nextCursor } : {}) });
        },
      }),
    ];
  }
}
