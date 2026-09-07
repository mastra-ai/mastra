import { randomBytes } from 'node:crypto';

import type { Session } from '@mastra/core/agent-controller';
import { createKnowledgeNodeCursor, isKnowledgeScopeVisible, parseKnowledgeWikilinks } from '@mastra/core/storage';
import type {
  KnowledgeActivityEvent,
  KnowledgeRecord,
  KnowledgeNode,
  KnowledgeScope,
  KnowledgeStorage,
  MastraCompositeStore,
} from '@mastra/core/storage';

import { resolveKnowledgeScopeIdentity } from './knowledge-scope.js';
import type { MastraCodeState } from './schema.js';

export type KnowledgeInspectorScopeLevel = 'org' | 'resource' | 'thread';
export type KnowledgeInspectorRecordType = 'node';
export type KnowledgeInspectorNodeSort = 'relevant' | 'recent' | 'connected';

export interface KnowledgeInspectorScopeRoot {
  level: KnowledgeInspectorScopeLevel;
  id?: string;
  available: boolean;
  reason?: string;
}

export interface KnowledgeInspectorScopeTree {
  identityKey: string;
  defaultLevel: 'resource';
  roots: KnowledgeInspectorScopeRoot[];
}

export interface KnowledgeInspectorScopeBadge {
  level: KnowledgeInspectorScopeLevel;
  id: string;
}

export interface KnowledgeInspectorRelationshipCounts {
  records: number;
  outgoing: number;
  incoming: number;
  sampled: boolean;
}

export interface KnowledgeInspectorNodeSummary {
  handle: string;
  type: KnowledgeInspectorRecordType;
  name: string;
  kind?: string;
  scope: KnowledgeInspectorScopeBadge;
  version: number;
  updatedAt: string;
  relationshipCounts?: KnowledgeInspectorRelationshipCounts;
}

export interface KnowledgeInspectorRecordSummary {
  text: string;
  scope: KnowledgeInspectorScopeBadge;
  sourceThreadId: string;
  capturedAt: string;
  when?: string;
}

export interface KnowledgeInspectorNodeList {
  identityKey: string;
  scopeLevel: KnowledgeInspectorScopeLevel;
  nodes: KnowledgeInspectorNodeSummary[];
  nextCursor?: string;
  sort?: KnowledgeInspectorNodeSort;
  coverage?: 'exact' | 'recent-window';
}

export interface KnowledgeInspectorRelationshipPreview {
  nodes: KnowledgeInspectorNodeSummary[];
  partial: boolean;
}

export interface KnowledgeInspectorNodeDetail {
  identityKey: string;
  scopeLevel: KnowledgeInspectorScopeLevel;
  node: KnowledgeInspectorNodeSummary;
  records: KnowledgeInspectorRecordSummary[];
  recordsNextCursor?: string;
  mentioningRecords: KnowledgeInspectorRecordSummary[];
  mentioningRecordsNextCursor?: string;
  outgoingTargets: KnowledgeInspectorRelationshipPreview;
  incomingParents: KnowledgeInspectorRelationshipPreview;
  relationshipCounts: KnowledgeInspectorRelationshipCounts;
  content?: string;
  contentTruncated: boolean;
  links: Array<{ label: string; node?: KnowledgeInspectorNodeSummary }>;
}

export interface KnowledgeInspectorActivityEvent {
  action: KnowledgeActivityEvent['action'];
  recordType: KnowledgeActivityEvent['recordType'];
  scope: KnowledgeInspectorScopeBadge;
  sourceThreadId?: string;
  createdAt: string;
  record?: KnowledgeInspectorNodeSummary;
}

export interface KnowledgeInspectorActivityList {
  identityKey: string;
  scopeLevel: KnowledgeInspectorScopeLevel;
  events: KnowledgeInspectorActivityEvent[];
  nextCursor?: string;
}

export interface KnowledgeInspector {
  getScopeTree(): Promise<KnowledgeInspectorScopeTree>;
  listNodes(input: {
    level: KnowledgeInspectorScopeLevel;
    namePrefix?: string;
    kind?: string;
    sort?: KnowledgeInspectorNodeSort;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgeInspectorNodeList>;
  getNode(input: {
    handle: string;
    recordsCursor?: string;
    mentioningRecordsCursor?: string;
    recordLimit?: number;
  }): Promise<KnowledgeInspectorNodeDetail>;
  listActivity(input: {
    level: KnowledgeInspectorScopeLevel;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgeInspectorActivityList>;
}

export class KnowledgeInspectorError extends Error {
  constructor(
    readonly code: 'unavailable' | 'invalid-handle' | 'stale-handle' | 'invalid-cursor' | 'not-visible',
    message: string,
  ) {
    super(message);
    this.name = 'KnowledgeInspectorError';
  }
}

interface Binding {
  /** Org rung shared with the subconscious writers (see knowledge-scope.ts). */
  organizationId: string;
  /** Resource rung of the knowledge scope: the Factory project id, else the session resource. */
  resourceId: string;
  threadId?: string;
  fingerprint: string;
  identityKey: string;
}

interface HandleEntry {
  identityKey: string;
  level: KnowledgeInspectorScopeLevel;
  type: KnowledgeInspectorRecordType;
  recordId: string;
  expiresAt: number;
}

interface CursorEntry {
  identityKey: string;
  level: KnowledgeInspectorScopeLevel;
  kind: 'node' | 'ranked-node' | 'records' | 'mentioning-records' | 'activity';
  value: string;
  filters?: { namePrefix?: string; kind?: string; sort?: KnowledgeInspectorNodeSort };
  expiresAt: number;
}

interface RankedNodeSnapshot {
  offset: number;
  entries: { id: string; degree: number; counts: KnowledgeInspectorRelationshipCounts }[];
}

interface RelationshipRecords {
  nodes: KnowledgeNode[];
  truncated: boolean;
}

const HANDLE_TTL_MS = 5 * 60_000;
const MAX_OPAQUE_ENTRIES = 1_000;
const DEFAULT_RECORD_LIMIT = 50;
const MAX_RECORD_LIMIT = 50;
const DEFAULT_FACT_LIMIT = 25;
const MAX_FACT_LIMIT = 100;
const DEFAULT_ACTIVITY_LIMIT = 20;
const MAX_ACTIVITY_LIMIT = 100;
const MAX_RELATED_RECORDS = 25;
const MAX_RANK_CANDIDATES = 50;
const MAX_RANK_FACTS = 100;
const RRF_K = 60;
const MAX_NODE_CONTENT_BYTES = 32 * 1024;

function opaqueToken(): string {
  return randomBytes(24).toString('base64url');
}

function boundedLimit(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1) return fallback;
  return Math.min(value, maximum);
}

function scopeBadge(scope: KnowledgeScope): KnowledgeInspectorScopeBadge {
  const entry = scope.at(-1);
  if (!entry) throw new KnowledgeInspectorError('unavailable', 'Knowledge record has no scope.');
  const separator = entry.indexOf(':');
  return {
    level: entry.slice(0, separator) as KnowledgeInspectorScopeLevel,
    id: entry.slice(separator + 1),
  };
}

function knowledgeSummary(record: KnowledgeRecord): KnowledgeInspectorRecordSummary {
  return {
    text: record.text,
    scope: scopeBadge(record.scope),
    sourceThreadId: record.sourceThreadId,
    capturedAt: record.capturedAt.toISOString(),
    when: record.when?.toISOString(),
  };
}

function truncateUtf8(value: string, maxBytes: number): { value: string; truncated: boolean } {
  const encoded = Buffer.from(value);
  if (encoded.byteLength <= maxBytes) return { value, truncated: false };
  let end = maxBytes;
  let truncated = encoded.subarray(0, end).toString('utf8');
  while (Buffer.byteLength(truncated) > maxBytes) {
    truncated = encoded.subarray(0, --end).toString('utf8');
  }
  return { value: truncated, truncated: true };
}

class ScopedKnowledgeInspector implements KnowledgeInspector {
  readonly #knowledge: KnowledgeStorage;
  readonly #session: Session<MastraCodeState>;
  readonly #handles = new Map<string, HandleEntry>();
  readonly #cursors = new Map<string, CursorEntry>();
  #fingerprint?: string;
  #identityKey = opaqueToken();

  constructor(input: { knowledge: KnowledgeStorage; session: Session<MastraCodeState> }) {
    this.#knowledge = input.knowledge;
    this.#session = input.session;
    this.#session.subscribe(event => {
      if (event.type === 'thread_changed' || event.type === 'thread_created' || event.type === 'thread_deleted') {
        this.#invalidateIdnode();
      }
    });
  }

  async getScopeTree(): Promise<KnowledgeInspectorScopeTree> {
    const binding = await this.#binding();
    return {
      identityKey: binding.identityKey,
      defaultLevel: 'resource',
      roots: [
        { level: 'org', id: binding.organizationId, available: true },
        { level: 'resource', id: binding.resourceId, available: true },
        binding.threadId
          ? { level: 'thread', id: binding.threadId, available: true }
          : { level: 'thread', available: false, reason: 'No active thread belongs to this project.' },
      ],
    };
  }

  async listNodes(input: {
    level: KnowledgeInspectorScopeLevel;
    namePrefix?: string;
    kind?: string;
    sort?: KnowledgeInspectorNodeSort;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgeInspectorNodeList> {
    const binding = await this.#binding();
    const scope = this.#scope(binding, input.level);
    const limit = boundedLimit(input.limit, DEFAULT_RECORD_LIMIT, MAX_RECORD_LIMIT);
    const sort = input.sort ?? 'relevant';
    if (sort === 'recent') {
      const cursor = this.#consumeCursor(input.cursor, binding, input.level, 'node', {
        namePrefix: input.namePrefix,
        kind: input.kind,
        sort,
      });
      const records = await this.#knowledge.listNodes({
        scope,
        namePrefix: input.namePrefix,
        kind: input.kind,
        cursor,
        limit,
      });
      const nodes: KnowledgeInspectorNodeSummary[] = await Promise.all(
        records.map(async record => ({
          ...this.#recordSummary(record, binding, input.level),
          relationshipCounts: (await this.#sampledRelationshipCounts(record, scope)).counts,
        })),
      );
      await this.#assertStable(binding);
      return {
        identityKey: binding.identityKey,
        scopeLevel: input.level,
        nodes,
        nextCursor:
          records.length === limit
            ? this.#mintCursor(
                binding,
                input.level,
                'node',
                createKnowledgeNodeCursor(records.at(-1)!, {
                  namePrefix: input.namePrefix,
                  kind: input.kind,
                }),
                {
                  namePrefix: input.namePrefix,
                  kind: input.kind,
                  sort,
                },
              )
            : undefined,
        sort,
        coverage: 'exact',
      };
    }

    const filters = { namePrefix: input.namePrefix, kind: input.kind, sort };
    const encodedSnapshot = this.#consumeCursor(input.cursor, binding, input.level, 'ranked-node', filters);
    const snapshot = encodedSnapshot
      ? (JSON.parse(encodedSnapshot) as RankedNodeSnapshot)
      : await this.#rankedNodeSnapshot(scope, input.namePrefix, input.kind, sort);
    const page = snapshot.entries.slice(snapshot.offset, snapshot.offset + limit);
    const nodes: KnowledgeInspectorNodeSummary[] = [];
    for (const entry of page) {
      const node = await this.#knowledge.getNode(entry.id);
      if (!node || !isKnowledgeScopeVisible(node.scope, scope)) continue;
      nodes.push({ ...this.#recordSummary(node, binding, input.level), relationshipCounts: entry.counts });
    }
    const nextOffset = snapshot.offset + limit;
    await this.#assertStable(binding);
    return {
      identityKey: binding.identityKey,
      scopeLevel: input.level,
      nodes,
      nextCursor:
        nextOffset < snapshot.entries.length
          ? this.#mintCursor(
              binding,
              input.level,
              'ranked-node',
              JSON.stringify({ ...snapshot, offset: nextOffset } satisfies RankedNodeSnapshot),
              filters,
            )
          : undefined,
      sort,
      coverage: 'recent-window',
    };
  }

  async getNode(input: {
    handle: string;
    recordsCursor?: string;
    mentioningRecordsCursor?: string;
    recordLimit?: number;
  }): Promise<KnowledgeInspectorNodeDetail> {
    const binding = await this.#binding();
    const handle = this.#readHandle(input.handle, binding, 'node');
    const scope = this.#scope(binding, handle.level);
    const node = await this.#knowledge.getNode(handle.recordId);
    this.#assertVisible(node, scope);
    const limit = boundedLimit(input.recordLimit, DEFAULT_FACT_LIMIT, MAX_FACT_LIMIT);
    const recordsAfter = this.#consumeCursor(input.recordsCursor, binding, handle.level, 'records');
    const mentioningAfter = this.#consumeCursor(
      input.mentioningRecordsCursor,
      binding,
      handle.level,
      'mentioning-records',
    );
    const [recordsResult, mentioningResult] = await Promise.all([
      this.#knowledge.listKnowledgeAbout({ node: node.id, scope, after: recordsAfter, limit }),
      this.#knowledge.listKnowledgeMentioning({ node: node.id, scope, after: mentioningAfter, limit }),
    ]);
    const mentioningRecords = mentioningResult.records.filter(record => record.node !== node.id);
    const content = truncateUtf8(node.content ?? '', MAX_NODE_CONTENT_BYTES);
    const [outgoingTargets, incomingParents, relationship] = await Promise.all([
      this.#outgoingTargets(node, recordsResult.records, scope, binding, handle.level),
      this.#incomingParents(node, mentioningRecords, scope, binding, handle.level),
      this.#sampledRelationshipCounts(node, scope),
    ]);
    const links = await Promise.all(
      parseKnowledgeWikilinks(content.value)
        .slice(0, MAX_RELATED_RECORDS)
        .map(async label => {
          const target = await this.#knowledge.resolveNode({ name: label, scope });
          return {
            label,
            node: target ? this.#recordSummary(target, binding, handle.level) : undefined,
          };
        }),
    );
    await this.#assertStable(binding);
    return {
      identityKey: binding.identityKey,
      scopeLevel: handle.level,
      node: { ...this.#recordSummary(node, binding, handle.level), relationshipCounts: relationship.counts },
      records: recordsResult.records.map(knowledgeSummary),
      recordsNextCursor: recordsResult.nextCursor
        ? this.#mintCursor(binding, handle.level, 'records', recordsResult.nextCursor)
        : undefined,
      mentioningRecords: mentioningRecords.map(knowledgeSummary),
      mentioningRecordsNextCursor: mentioningResult.nextCursor
        ? this.#mintCursor(binding, handle.level, 'mentioning-records', mentioningResult.nextCursor)
        : undefined,
      outgoingTargets: {
        nodes: outgoingTargets.nodes,
        partial: outgoingTargets.partial || Boolean(recordsResult.nextCursor),
      },
      incomingParents: {
        nodes: incomingParents.nodes,
        partial: incomingParents.partial || Boolean(mentioningResult.nextCursor),
      },
      relationshipCounts: relationship.counts,
      content: node.content === undefined ? undefined : content.value,
      contentTruncated: content.truncated,
      links,
    };
  }

  async listActivity(input: {
    level: KnowledgeInspectorScopeLevel;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgeInspectorActivityList> {
    const binding = await this.#binding();
    const scope = this.#scope(binding, input.level);
    const limit = boundedLimit(input.limit, DEFAULT_ACTIVITY_LIMIT, MAX_ACTIVITY_LIMIT);
    const after = this.#consumeCursor(input.cursor, binding, input.level, 'activity');
    const events = await this.#knowledge.listActivity({ scope, after, limit });
    const activityEvents: KnowledgeInspectorActivityEvent[] = [];
    for (const event of events) {
      const record = await this.#activityRecord(event, scope, binding, input.level);
      activityEvents.push({
        action: event.action,
        recordType: event.recordType,
        scope: scopeBadge(event.scope),
        sourceThreadId: record ? event.sourceThreadId : undefined,
        createdAt: event.createdAt.toISOString(),
        record,
      });
    }
    await this.#assertStable(binding);
    return {
      identityKey: binding.identityKey,
      scopeLevel: input.level,
      events: activityEvents,
      nextCursor:
        events.length === limit ? this.#mintCursor(binding, input.level, 'activity', events.at(-1)!.id) : undefined,
    };
  }

  async #binding(): Promise<Binding> {
    // Scope rungs come from the same resolver the subconscious writes under; an
    // owner id is a USER id and never names a knowledge org.
    const identity = resolveKnowledgeScopeIdentity(this.#session.state.get());
    const sessionResourceId = this.#session.identity.getResourceId();
    if (!identity.resolved) {
      // An unresolved org is its own identity: handles minted under the
      // previous scope must not survive into whatever resolves next.
      this.#invalidateIdnode();
      throw new KnowledgeInspectorError(
        'unavailable',
        identity.reason
          ? `Knowledge inspection unavailable: ${identity.reason}`
          : 'Knowledge inspection requires a resolved organization for this session.',
      );
    }
    if (!sessionResourceId) {
      throw new KnowledgeInspectorError('unavailable', 'Knowledge inspection requires an active project.');
    }
    const organizationId = identity.organizationId;
    const resourceId = identity.knowledgeResourceId ?? sessionResourceId;
    const activeThreadId = this.#session.thread.getId() ?? undefined;
    const thread = activeThreadId ? await this.#session.thread.getById({ threadId: activeThreadId }) : null;
    const threadId = thread?.resourceId === sessionResourceId ? thread.id : undefined;
    const fingerprint = `${organizationId}\0${resourceId}\0${threadId ?? ''}`;
    if (this.#fingerprint !== fingerprint) {
      this.#fingerprint = fingerprint;
      this.#identityKey = opaqueToken();
      this.#handles.clear();
      this.#cursors.clear();
    }
    return { organizationId, resourceId, threadId, fingerprint, identityKey: this.#identityKey };
  }

  #scope(binding: Binding, level: KnowledgeInspectorScopeLevel): KnowledgeScope {
    if (level === 'org') return [`org:${binding.organizationId}`];
    const scope = [`org:${binding.organizationId}`, `resource:${binding.resourceId}`];
    if (level === 'resource') return scope;
    if (!binding.threadId) {
      throw new KnowledgeInspectorError('unavailable', 'The active thread does not belong to this project.');
    }
    return [...scope, `thread:${binding.threadId}`];
  }

  async #assertStable(binding: Binding): Promise<void> {
    const current = await this.#binding();
    if (current.identityKey !== binding.identityKey || current.fingerprint !== binding.fingerprint) {
      throw new KnowledgeInspectorError('stale-handle', 'Knowledge scope changed while the request was running.');
    }
  }

  #assertVisible<T extends KnowledgeNode>(record: T | null, scope: KnowledgeScope): asserts record is T {
    if (!record || !isKnowledgeScopeVisible(record.scope, scope)) {
      throw new KnowledgeInspectorError('not-visible', 'Knowledge record is not visible in the selected scope.');
    }
  }

  #recordSummary(
    record: KnowledgeNode,
    binding: Binding,
    level: KnowledgeInspectorScopeLevel,
  ): KnowledgeInspectorNodeSummary {
    const type: KnowledgeInspectorRecordType = 'node';
    return {
      handle: this.#mintHandle(binding, level, type, record.id),
      type,
      name: record.name,
      kind: record.kind,
      scope: scopeBadge(record.scope),
      version: record.version,
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  async #rankedNodeSnapshot(
    scope: KnowledgeScope,
    namePrefix: string | undefined,
    kind: string | undefined,
    sort: Exclude<KnowledgeInspectorNodeSort, 'recent'>,
  ): Promise<RankedNodeSnapshot> {
    const records = await this.#knowledge.listNodes({
      scope,
      namePrefix,
      kind,
      limit: MAX_RANK_CANDIDATES,
    });
    const ranked = await Promise.all(
      records.map(async (node, recencyRank) => ({
        node,
        recencyRank,
        ...(await this.#sampledRelationshipCounts(node, scope)),
      })),
    );
    const connected = [...ranked].sort(
      (a, b) => b.degree - a.degree || a.recencyRank - b.recencyRank || a.node.id.localeCompare(b.node.id),
    );
    const connectedRank = new Map(connected.map((entry, index) => [entry.node.id, index]));
    const ordered =
      sort === 'connected'
        ? connected
        : [...ranked].sort((a, b) => {
            const aScore = 1 / (RRF_K + a.recencyRank + 1) + 1 / (RRF_K + connectedRank.get(a.node.id)! + 1);
            const bScore = 1 / (RRF_K + b.recencyRank + 1) + 1 / (RRF_K + connectedRank.get(b.node.id)! + 1);
            return bScore - aScore || a.recencyRank - b.recencyRank || a.node.id.localeCompare(b.node.id);
          });
    return {
      offset: 0,
      entries: ordered.map(entry => ({ id: entry.node.id, degree: entry.degree, counts: entry.counts })),
    };
  }

  async #sampledRelationshipCounts(
    node: KnowledgeNode,
    scope: KnowledgeScope,
  ): Promise<{ degree: number; counts: KnowledgeInspectorRelationshipCounts }> {
    const [aboutResult, mentioningResult] = await Promise.all([
      this.#knowledge.listKnowledgeAbout({ node: node.id, scope, limit: MAX_RANK_FACTS }),
      this.#knowledge.listKnowledgeMentioning({ node: node.id, scope, limit: MAX_RANK_FACTS }),
    ]);
    const [outgoing, incoming] = await Promise.all([
      this.#outgoingNodeRecords(node, aboutResult.records, scope),
      this.#incomingParentRecords(node, mentioningResult.records, scope),
    ]);
    const mentioningRecords = mentioningResult.records.filter(record => record.node !== node.id);
    const degree = new Set([...outgoing.nodes, ...incoming.nodes].map(record => record.id)).size;
    return {
      degree,
      counts: {
        records: aboutResult.records.length + mentioningRecords.length,
        outgoing: outgoing.nodes.length,
        incoming: incoming.nodes.length,
        sampled: Boolean(
          aboutResult.nextCursor || mentioningResult.nextCursor || outgoing.truncated || incoming.truncated,
        ),
      },
    };
  }

  async #outgoingNodeRecords(
    current: KnowledgeNode,
    records: KnowledgeRecord[],
    scope: KnowledgeScope,
  ): Promise<RelationshipRecords> {
    const related = new Map<string, KnowledgeNode>();
    let truncated = false;
    const sources = [current.content ?? '', ...records.map(record => record.text)];
    for (const source of sources) {
      for (const name of parseKnowledgeWikilinks(source)) {
        if (related.size >= MAX_RELATED_RECORDS) {
          truncated = true;
          break;
        }
        const node = await this.#knowledge.resolveNode({ name, scope });
        if (node && node.id !== current.id && isKnowledgeScopeVisible(node.scope, scope)) {
          related.set(node.id, node);
        }
      }
      if (truncated) break;
    }
    return { nodes: [...related.values()], truncated };
  }

  async #incomingParentRecords(
    current: KnowledgeNode,
    records: KnowledgeRecord[],
    scope: KnowledgeScope,
  ): Promise<RelationshipRecords> {
    const related = new Map<string, KnowledgeNode>();
    let truncated = false;
    for (const record of records) {
      if (record.node === current.id || related.has(record.node)) continue;
      if (related.size >= MAX_RELATED_RECORDS) {
        truncated = true;
        break;
      }
      const node = await this.#knowledge.getNode(record.node);
      if (node && isKnowledgeScopeVisible(node.scope, scope)) related.set(node.id, node);
    }
    return { nodes: [...related.values()], truncated };
  }

  async #outgoingTargets(
    current: KnowledgeNode,
    records: KnowledgeRecord[],
    scope: KnowledgeScope,
    binding: Binding,
    level: KnowledgeInspectorScopeLevel,
  ): Promise<KnowledgeInspectorRelationshipPreview> {
    const related = await this.#outgoingNodeRecords(current, records, scope);
    return {
      nodes: related.nodes.map(node => this.#recordSummary(node, binding, level)),
      partial: related.truncated,
    };
  }

  async #incomingParents(
    current: KnowledgeNode,
    records: KnowledgeRecord[],
    scope: KnowledgeScope,
    binding: Binding,
    level: KnowledgeInspectorScopeLevel,
  ): Promise<KnowledgeInspectorRelationshipPreview> {
    const related = await this.#incomingParentRecords(current, records, scope);
    return {
      nodes: related.nodes.map(node => this.#recordSummary(node, binding, level)),
      partial: related.truncated,
    };
  }

  async #activityRecord(
    event: KnowledgeActivityEvent,
    scope: KnowledgeScope,
    binding: Binding,
    level: KnowledgeInspectorScopeLevel,
  ): Promise<KnowledgeInspectorNodeSummary | undefined> {
    if (event.recordType === 'node') {
      const node = await this.#knowledge.getNode(event.recordId);
      return node && isKnowledgeScopeVisible(node.scope, scope) ? this.#recordSummary(node, binding, level) : undefined;
    }
    const record = await this.#knowledge.getKnowledge({ id: event.recordId, includeDeleted: true });
    if (!record || !isKnowledgeScopeVisible(record.scope, scope)) return undefined;
    const node = await this.#knowledge.getNode(record.node);
    return node && isKnowledgeScopeVisible(node.scope, scope) ? this.#recordSummary(node, binding, level) : undefined;
  }

  #mintHandle(
    binding: Binding,
    level: KnowledgeInspectorScopeLevel,
    type: KnowledgeInspectorRecordType,
    recordId: string,
  ): string {
    this.#pruneOpaqueEntries();
    const token = opaqueToken();
    this.#handles.set(token, {
      identityKey: binding.identityKey,
      level,
      type,
      recordId,
      expiresAt: Date.now() + HANDLE_TTL_MS,
    });
    return token;
  }

  #readHandle(handle: string, binding: Binding, expectedType: KnowledgeInspectorRecordType): HandleEntry {
    const entry = this.#handles.get(handle);
    if (!entry || entry.expiresAt < Date.now() || entry.type !== expectedType) {
      throw new KnowledgeInspectorError('invalid-handle', 'Knowledge record handle is invalid or expired.');
    }
    if (entry.identityKey !== binding.identityKey) {
      throw new KnowledgeInspectorError('stale-handle', 'Knowledge record handle belongs to a previous scope.');
    }
    return entry;
  }

  #mintCursor(
    binding: Binding,
    level: KnowledgeInspectorScopeLevel,
    kind: CursorEntry['kind'],
    value: string,
    filters?: CursorEntry['filters'],
  ): string {
    this.#pruneOpaqueEntries();
    const token = opaqueToken();
    this.#cursors.set(token, {
      identityKey: binding.identityKey,
      level,
      kind,
      value,
      filters,
      expiresAt: Date.now() + HANDLE_TTL_MS,
    });
    return token;
  }

  #consumeCursor(
    cursor: string | undefined,
    binding: Binding,
    level: KnowledgeInspectorScopeLevel,
    kind: CursorEntry['kind'],
    filters?: CursorEntry['filters'],
  ): string | undefined {
    if (!cursor) return undefined;
    const entry = this.#cursors.get(cursor);
    if (
      !entry ||
      entry.expiresAt < Date.now() ||
      entry.identityKey !== binding.identityKey ||
      entry.level !== level ||
      entry.kind !== kind ||
      entry.filters?.namePrefix !== filters?.namePrefix ||
      entry.filters?.kind !== filters?.kind ||
      entry.filters?.sort !== filters?.sort
    ) {
      throw new KnowledgeInspectorError(
        'invalid-cursor',
        'Knowledge cursor does not match the active scope and filters.',
      );
    }
    return entry.value;
  }

  #pruneOpaqueEntries(): void {
    const now = Date.now();
    for (const [token, entry] of this.#handles) {
      if (entry.expiresAt < now) this.#handles.delete(token);
    }
    for (const [token, entry] of this.#cursors) {
      if (entry.expiresAt < now) this.#cursors.delete(token);
    }
    while (this.#handles.size + this.#cursors.size >= MAX_OPAQUE_ENTRIES) {
      const handle = this.#handles.keys().next().value;
      if (handle) this.#handles.delete(handle);
      else {
        const cursor = this.#cursors.keys().next().value;
        if (cursor) this.#cursors.delete(cursor);
        else break;
      }
    }
  }

  #invalidateIdnode(): void {
    this.#fingerprint = undefined;
    this.#identityKey = opaqueToken();
    this.#handles.clear();
    this.#cursors.clear();
  }
}

export async function createKnowledgeInspector(input: {
  storage: MastraCompositeStore;
  session: Session<MastraCodeState>;
}): Promise<KnowledgeInspector | undefined> {
  const knowledge = await input.storage.getStore('knowledge');
  return knowledge ? new ScopedKnowledgeInspector({ knowledge, session: input.session }) : undefined;
}
