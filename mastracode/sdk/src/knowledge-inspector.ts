import { randomBytes } from 'node:crypto';

import type { Session } from '@mastra/core/agent-controller';
import { createKnowledgeRecordCursor, isKnowledgeScopeVisible, parseKnowledgeWikilinks } from '@mastra/core/storage';
import type {
  KnowledgeActivityEvent,
  KnowledgeEntity,
  KnowledgeFact,
  KnowledgePage,
  KnowledgeRecord,
  KnowledgeScope,
  KnowledgeStorage,
  MastraCompositeStore,
} from '@mastra/core/storage';

import type { MastraCodeState } from './schema.js';

export type KnowledgeInspectorScopeLevel = 'org' | 'resource' | 'thread';
export type KnowledgeInspectorRecordType = 'entity' | 'page';
export type KnowledgeInspectorEntitySort = 'relevant' | 'recent' | 'connected';

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
  facts: number;
  outgoing: number;
  incoming: number;
  sampled: boolean;
}

export interface KnowledgeInspectorRecordSummary {
  handle: string;
  type: KnowledgeInspectorRecordType;
  name: string;
  kind?: string;
  scope: KnowledgeInspectorScopeBadge;
  version: number;
  updatedAt: string;
  relationshipCounts?: KnowledgeInspectorRelationshipCounts;
}

export interface KnowledgeInspectorFactSummary {
  text: string;
  scope: KnowledgeInspectorScopeBadge;
  sourceThreadId: string;
  capturedAt: string;
  when?: string;
}

export interface KnowledgeInspectorRecordList {
  identityKey: string;
  scopeLevel: KnowledgeInspectorScopeLevel;
  items: KnowledgeInspectorRecordSummary[];
  nextCursor?: string;
  sort?: KnowledgeInspectorEntitySort;
  coverage?: 'exact' | 'recent-window';
}

export interface KnowledgeInspectorRelationshipPreview {
  items: KnowledgeInspectorRecordSummary[];
  partial: boolean;
}

export interface KnowledgeInspectorEntityDetail {
  identityKey: string;
  scopeLevel: KnowledgeInspectorScopeLevel;
  entity: KnowledgeInspectorRecordSummary;
  facts: KnowledgeInspectorFactSummary[];
  factsNextCursor?: string;
  incomingFacts: KnowledgeInspectorFactSummary[];
  incomingFactsNextCursor?: string;
  outgoingTargets: KnowledgeInspectorRelationshipPreview;
  incomingParents: KnowledgeInspectorRelationshipPreview;
  relationshipCounts: KnowledgeInspectorRelationshipCounts;
}

export interface KnowledgeInspectorPageLink {
  label: string;
  entity?: KnowledgeInspectorRecordSummary;
}

export interface KnowledgeInspectorPageDetail {
  identityKey: string;
  scopeLevel: KnowledgeInspectorScopeLevel;
  page: KnowledgeInspectorRecordSummary;
  body: string;
  bodyTruncated: boolean;
  links: KnowledgeInspectorPageLink[];
}

export interface KnowledgeInspectorActivityItem {
  action: KnowledgeActivityEvent['action'];
  recordType: KnowledgeActivityEvent['recordType'];
  scope: KnowledgeInspectorScopeBadge;
  sourceThreadId?: string;
  createdAt: string;
  record?: KnowledgeInspectorRecordSummary;
}

export interface KnowledgeInspectorActivityList {
  identityKey: string;
  scopeLevel: KnowledgeInspectorScopeLevel;
  items: KnowledgeInspectorActivityItem[];
  nextCursor?: string;
}

export interface KnowledgeInspector {
  getScopeTree(): Promise<KnowledgeInspectorScopeTree>;
  listEntities(input: {
    level: KnowledgeInspectorScopeLevel;
    namePrefix?: string;
    kind?: string;
    sort?: KnowledgeInspectorEntitySort;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgeInspectorRecordList>;
  listPages(input: {
    level: KnowledgeInspectorScopeLevel;
    namePrefix?: string;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgeInspectorRecordList>;
  getEntity(input: {
    handle: string;
    factsCursor?: string;
    incomingFactsCursor?: string;
    factLimit?: number;
  }): Promise<KnowledgeInspectorEntityDetail>;
  getPage(input: { handle: string }): Promise<KnowledgeInspectorPageDetail>;
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
  ownerId: string;
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
  kind: 'entity' | 'ranked-entity' | 'page' | 'facts' | 'incoming-facts' | 'activity';
  value: string;
  filters?: { namePrefix?: string; kind?: string; sort?: KnowledgeInspectorEntitySort };
  expiresAt: number;
}

interface RankedEntitySnapshot {
  offset: number;
  entries: { id: string; degree: number; counts: KnowledgeInspectorRelationshipCounts }[];
}

interface RelationshipRecords {
  items: KnowledgeEntity[];
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
const MAX_PAGE_BODY_BYTES = 32 * 1024;

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

function factSummary(fact: KnowledgeFact): KnowledgeInspectorFactSummary {
  return {
    text: fact.text,
    scope: scopeBadge(fact.scope),
    sourceThreadId: fact.sourceThreadId,
    capturedAt: fact.capturedAt.toISOString(),
    when: fact.when?.toISOString(),
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
        this.#invalidateIdentity();
      }
    });
  }

  async getScopeTree(): Promise<KnowledgeInspectorScopeTree> {
    const binding = await this.#binding();
    return {
      identityKey: binding.identityKey,
      defaultLevel: 'resource',
      roots: [
        { level: 'org', id: binding.ownerId, available: true },
        { level: 'resource', id: binding.resourceId, available: true },
        binding.threadId
          ? { level: 'thread', id: binding.threadId, available: true }
          : { level: 'thread', available: false, reason: 'No active thread belongs to this project.' },
      ],
    };
  }

  async listEntities(input: {
    level: KnowledgeInspectorScopeLevel;
    namePrefix?: string;
    kind?: string;
    sort?: KnowledgeInspectorEntitySort;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgeInspectorRecordList> {
    const binding = await this.#binding();
    const scope = this.#scope(binding, input.level);
    const limit = boundedLimit(input.limit, DEFAULT_RECORD_LIMIT, MAX_RECORD_LIMIT);
    const sort = input.sort ?? 'relevant';
    if (sort === 'recent') {
      const cursor = this.#consumeCursor(input.cursor, binding, input.level, 'entity', {
        namePrefix: input.namePrefix,
        kind: input.kind,
        sort,
      });
      const records = await this.#knowledge.listEntities({
        scope,
        namePrefix: input.namePrefix,
        kind: input.kind,
        cursor,
        limit,
      });
      const items: KnowledgeInspectorRecordSummary[] = await Promise.all(
        records.map(async record => ({
          ...this.#recordSummary(record, binding, input.level),
          relationshipCounts: (await this.#sampledRelationshipCounts(record, scope)).counts,
        })),
      );
      await this.#assertStable(binding);
      return {
        identityKey: binding.identityKey,
        scopeLevel: input.level,
        items,
        nextCursor:
          records.length === limit
            ? this.#mintCursor(binding, input.level, 'entity', createKnowledgeRecordCursor(records.at(-1)!, input), {
                namePrefix: input.namePrefix,
                kind: input.kind,
                sort,
              })
            : undefined,
        sort,
        coverage: 'exact',
      };
    }

    const filters = { namePrefix: input.namePrefix, kind: input.kind, sort };
    const encodedSnapshot = this.#consumeCursor(input.cursor, binding, input.level, 'ranked-entity', filters);
    const snapshot = encodedSnapshot
      ? (JSON.parse(encodedSnapshot) as RankedEntitySnapshot)
      : await this.#rankedEntitySnapshot(scope, input.namePrefix, input.kind, sort);
    const page = snapshot.entries.slice(snapshot.offset, snapshot.offset + limit);
    const items: KnowledgeInspectorRecordSummary[] = [];
    for (const entry of page) {
      const entity = await this.#knowledge.getEntity(entry.id);
      if (!entity || !isKnowledgeScopeVisible(entity.scope, scope)) continue;
      items.push({ ...this.#recordSummary(entity, binding, input.level), relationshipCounts: entry.counts });
    }
    const nextOffset = snapshot.offset + limit;
    await this.#assertStable(binding);
    return {
      identityKey: binding.identityKey,
      scopeLevel: input.level,
      items,
      nextCursor:
        nextOffset < snapshot.entries.length
          ? this.#mintCursor(
              binding,
              input.level,
              'ranked-entity',
              JSON.stringify({ ...snapshot, offset: nextOffset } satisfies RankedEntitySnapshot),
              filters,
            )
          : undefined,
      sort,
      coverage: 'recent-window',
    };
  }

  async listPages(input: {
    level: KnowledgeInspectorScopeLevel;
    namePrefix?: string;
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgeInspectorRecordList> {
    const binding = await this.#binding();
    const scope = this.#scope(binding, input.level);
    const limit = boundedLimit(input.limit, DEFAULT_RECORD_LIMIT, MAX_RECORD_LIMIT);
    const cursor = this.#consumeCursor(input.cursor, binding, input.level, 'page', {
      namePrefix: input.namePrefix,
    });
    const records = await this.#knowledge.listPages({ scope, namePrefix: input.namePrefix, cursor, limit });
    await this.#assertStable(binding);
    return {
      identityKey: binding.identityKey,
      scopeLevel: input.level,
      items: records.map(record => this.#recordSummary(record, binding, input.level)),
      nextCursor:
        records.length === limit
          ? this.#mintCursor(binding, input.level, 'page', createKnowledgeRecordCursor(records.at(-1)!, input), {
              namePrefix: input.namePrefix,
            })
          : undefined,
    };
  }

  async getEntity(input: {
    handle: string;
    factsCursor?: string;
    incomingFactsCursor?: string;
    factLimit?: number;
  }): Promise<KnowledgeInspectorEntityDetail> {
    const binding = await this.#binding();
    const handle = this.#readHandle(input.handle, binding, 'entity');
    const scope = this.#scope(binding, handle.level);
    const entity = await this.#knowledge.getEntity(handle.recordId);
    this.#assertVisible(entity, scope);
    const limit = boundedLimit(input.factLimit, DEFAULT_FACT_LIMIT, MAX_FACT_LIMIT);
    const factsAfter = this.#consumeCursor(input.factsCursor, binding, handle.level, 'facts');
    const incomingAfter = this.#consumeCursor(input.incomingFactsCursor, binding, handle.level, 'incoming-facts');
    const [factsResult, incomingResult] = await Promise.all([
      this.#knowledge.factsAbout({ entityId: entity.id, scope, after: factsAfter, limit }),
      this.#knowledge.factsTouching({ entityId: entity.id, scope, after: incomingAfter, limit }),
    ]);
    const incomingFacts = incomingResult.facts.filter(fact => fact.parentEntityId !== entity.id);
    const [outgoingTargets, incomingParents, relationship] = await Promise.all([
      this.#outgoingTargets(entity, factsResult.facts, scope, binding, handle.level),
      this.#incomingParents(entity, incomingFacts, scope, binding, handle.level),
      this.#sampledRelationshipCounts(entity, scope),
    ]);
    await this.#assertStable(binding);
    return {
      identityKey: binding.identityKey,
      scopeLevel: handle.level,
      entity: { ...this.#recordSummary(entity, binding, handle.level), relationshipCounts: relationship.counts },
      facts: factsResult.facts.map(factSummary),
      factsNextCursor: factsResult.nextCursor
        ? this.#mintCursor(binding, handle.level, 'facts', factsResult.nextCursor)
        : undefined,
      incomingFacts: incomingFacts.map(factSummary),
      incomingFactsNextCursor: incomingResult.nextCursor
        ? this.#mintCursor(binding, handle.level, 'incoming-facts', incomingResult.nextCursor)
        : undefined,
      outgoingTargets: {
        items: outgoingTargets.items,
        partial: outgoingTargets.partial || Boolean(factsResult.nextCursor),
      },
      incomingParents: {
        items: incomingParents.items,
        partial: incomingParents.partial || Boolean(incomingResult.nextCursor),
      },
      relationshipCounts: relationship.counts,
    };
  }

  async getPage(input: { handle: string }): Promise<KnowledgeInspectorPageDetail> {
    const binding = await this.#binding();
    const handle = this.#readHandle(input.handle, binding, 'page');
    const scope = this.#scope(binding, handle.level);
    const page = await this.#knowledge.getPage(handle.recordId);
    this.#assertVisible(page, scope);
    const body = truncateUtf8(page.body, MAX_PAGE_BODY_BYTES);
    const links: KnowledgeInspectorPageLink[] = [];
    for (const label of parseKnowledgeWikilinks(body.value).slice(0, MAX_RELATED_RECORDS)) {
      const entity = await this.#knowledge.resolveEntity({ name: label, scope });
      links.push({
        label,
        entity: entity ? this.#recordSummary(entity, binding, handle.level) : undefined,
      });
    }
    await this.#assertStable(binding);
    return {
      identityKey: binding.identityKey,
      scopeLevel: handle.level,
      page: this.#recordSummary(page, binding, handle.level),
      body: body.value,
      bodyTruncated: body.truncated,
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
    const items: KnowledgeInspectorActivityItem[] = [];
    for (const event of events) {
      const record = await this.#activityRecord(event, scope, binding, input.level);
      items.push({
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
      items,
      nextCursor:
        events.length === limit ? this.#mintCursor(binding, input.level, 'activity', events.at(-1)!.id) : undefined,
    };
  }

  async #binding(): Promise<Binding> {
    const ownerId = this.#session.identity.getOwnerId();
    const resourceId = this.#session.identity.getResourceId();
    if (!ownerId || !resourceId) {
      throw new KnowledgeInspectorError('unavailable', 'Knowledge inspection requires an active owner and project.');
    }
    const activeThreadId = this.#session.thread.getId() ?? undefined;
    const thread = activeThreadId ? await this.#session.thread.getById({ threadId: activeThreadId }) : null;
    const threadId = thread?.resourceId === resourceId ? thread.id : undefined;
    const fingerprint = `${ownerId}\0${resourceId}\0${threadId ?? ''}`;
    if (this.#fingerprint !== fingerprint) {
      this.#fingerprint = fingerprint;
      this.#identityKey = opaqueToken();
      this.#handles.clear();
      this.#cursors.clear();
    }
    return { ownerId, resourceId, threadId, fingerprint, identityKey: this.#identityKey };
  }

  #scope(binding: Binding, level: KnowledgeInspectorScopeLevel): KnowledgeScope {
    if (level === 'org') return [`org:${binding.ownerId}`];
    const scope = [`org:${binding.ownerId}`, `resource:${binding.resourceId}`];
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

  #assertVisible<T extends KnowledgeRecord>(record: T | null, scope: KnowledgeScope): asserts record is T {
    if (!record || !isKnowledgeScopeVisible(record.scope, scope)) {
      throw new KnowledgeInspectorError('not-visible', 'Knowledge record is not visible in the selected scope.');
    }
  }

  #recordSummary(
    record: KnowledgeEntity | KnowledgePage,
    binding: Binding,
    level: KnowledgeInspectorScopeLevel,
  ): KnowledgeInspectorRecordSummary {
    return {
      handle: this.#mintHandle(binding, level, record.type, record.id),
      type: record.type,
      name: record.name,
      kind: record.type === 'entity' ? record.kind : undefined,
      scope: scopeBadge(record.scope),
      version: record.version,
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  async #rankedEntitySnapshot(
    scope: KnowledgeScope,
    namePrefix: string | undefined,
    kind: string | undefined,
    sort: Exclude<KnowledgeInspectorEntitySort, 'recent'>,
  ): Promise<RankedEntitySnapshot> {
    const records = await this.#knowledge.listEntities({ scope, namePrefix, kind, limit: MAX_RANK_CANDIDATES });
    const ranked = await Promise.all(
      records.map(async (entity, recencyRank) => ({
        entity,
        recencyRank,
        ...(await this.#sampledRelationshipCounts(entity, scope)),
      })),
    );
    const connected = [...ranked].sort(
      (a, b) => b.degree - a.degree || a.recencyRank - b.recencyRank || a.entity.id.localeCompare(b.entity.id),
    );
    const connectedRank = new Map(connected.map((entry, index) => [entry.entity.id, index]));
    const ordered =
      sort === 'connected'
        ? connected
        : [...ranked].sort((a, b) => {
            const aScore = 1 / (RRF_K + a.recencyRank + 1) + 1 / (RRF_K + connectedRank.get(a.entity.id)! + 1);
            const bScore = 1 / (RRF_K + b.recencyRank + 1) + 1 / (RRF_K + connectedRank.get(b.entity.id)! + 1);
            return bScore - aScore || a.recencyRank - b.recencyRank || a.entity.id.localeCompare(b.entity.id);
          });
    return {
      offset: 0,
      entries: ordered.map(entry => ({ id: entry.entity.id, degree: entry.degree, counts: entry.counts })),
    };
  }

  async #sampledRelationshipCounts(
    entity: KnowledgeEntity,
    scope: KnowledgeScope,
  ): Promise<{ degree: number; counts: KnowledgeInspectorRelationshipCounts }> {
    const [factsResult, touchingResult] = await Promise.all([
      this.#knowledge.factsAbout({ entityId: entity.id, scope, limit: MAX_RANK_FACTS }),
      this.#knowledge.factsTouching({ entityId: entity.id, scope, limit: MAX_RANK_FACTS }),
    ]);
    const [outgoing, incoming] = await Promise.all([
      this.#outgoingEntityRecords(entity, factsResult.facts, scope),
      this.#incomingParentRecords(entity, touchingResult.facts, scope),
    ]);
    const incomingFacts = touchingResult.facts.filter(fact => fact.parentEntityId !== entity.id);
    const degree = new Set([...outgoing.items, ...incoming.items].map(record => record.id)).size;
    return {
      degree,
      counts: {
        facts: factsResult.facts.length + incomingFacts.length,
        outgoing: outgoing.items.length,
        incoming: incoming.items.length,
        sampled: Boolean(
          factsResult.nextCursor || touchingResult.nextCursor || outgoing.truncated || incoming.truncated,
        ),
      },
    };
  }

  async #outgoingEntityRecords(
    current: KnowledgeEntity,
    facts: KnowledgeFact[],
    scope: KnowledgeScope,
  ): Promise<RelationshipRecords> {
    const related = new Map<string, KnowledgeEntity>();
    let truncated = false;
    for (const fact of facts) {
      for (const name of parseKnowledgeWikilinks(fact.text)) {
        if (related.size >= MAX_RELATED_RECORDS) {
          truncated = true;
          break;
        }
        const entity = await this.#knowledge.resolveEntity({ name, scope });
        if (entity && entity.id !== current.id && isKnowledgeScopeVisible(entity.scope, scope)) {
          related.set(entity.id, entity);
        }
      }
      if (truncated) break;
    }
    return { items: [...related.values()], truncated };
  }

  async #incomingParentRecords(
    current: KnowledgeEntity,
    facts: KnowledgeFact[],
    scope: KnowledgeScope,
  ): Promise<RelationshipRecords> {
    const related = new Map<string, KnowledgeEntity>();
    let truncated = false;
    for (const fact of facts) {
      if (fact.parentEntityId === current.id || related.has(fact.parentEntityId)) continue;
      if (related.size >= MAX_RELATED_RECORDS) {
        truncated = true;
        break;
      }
      const entity = await this.#knowledge.getEntity(fact.parentEntityId);
      if (entity && isKnowledgeScopeVisible(entity.scope, scope)) related.set(entity.id, entity);
    }
    return { items: [...related.values()], truncated };
  }

  async #outgoingTargets(
    current: KnowledgeEntity,
    facts: KnowledgeFact[],
    scope: KnowledgeScope,
    binding: Binding,
    level: KnowledgeInspectorScopeLevel,
  ): Promise<KnowledgeInspectorRelationshipPreview> {
    const entities = await this.#outgoingEntityRecords(current, facts, scope);
    return {
      items: entities.items.map(entity => this.#recordSummary(entity, binding, level)),
      partial: entities.truncated,
    };
  }

  async #incomingParents(
    current: KnowledgeEntity,
    facts: KnowledgeFact[],
    scope: KnowledgeScope,
    binding: Binding,
    level: KnowledgeInspectorScopeLevel,
  ): Promise<KnowledgeInspectorRelationshipPreview> {
    const entities = await this.#incomingParentRecords(current, facts, scope);
    return {
      items: entities.items.map(entity => this.#recordSummary(entity, binding, level)),
      partial: entities.truncated,
    };
  }

  async #activityRecord(
    event: KnowledgeActivityEvent,
    scope: KnowledgeScope,
    binding: Binding,
    level: KnowledgeInspectorScopeLevel,
  ): Promise<KnowledgeInspectorRecordSummary | undefined> {
    if (event.recordType === 'entity') {
      const entity = await this.#knowledge.getEntity(event.recordId);
      return entity && isKnowledgeScopeVisible(entity.scope, scope)
        ? this.#recordSummary(entity, binding, level)
        : undefined;
    }
    if (event.recordType === 'page') {
      const page = await this.#knowledge.getPage(event.recordId);
      return page && isKnowledgeScopeVisible(page.scope, scope) ? this.#recordSummary(page, binding, level) : undefined;
    }
    const fact = await this.#knowledge.getFact({ id: event.recordId, includeDeleted: true });
    if (!fact || !isKnowledgeScopeVisible(fact.scope, scope)) return undefined;
    const entity = await this.#knowledge.getEntity(fact.parentEntityId);
    return entity && isKnowledgeScopeVisible(entity.scope, scope)
      ? this.#recordSummary(entity, binding, level)
      : undefined;
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

  #invalidateIdentity(): void {
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
