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

export interface KnowledgeInspectorRecordSummary {
  handle: string;
  type: KnowledgeInspectorRecordType;
  name: string;
  kind?: string;
  scope: KnowledgeInspectorScopeBadge;
  version: number;
  updatedAt: string;
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
}

export interface KnowledgeInspectorEntityDetail {
  identityKey: string;
  scopeLevel: KnowledgeInspectorScopeLevel;
  entity: KnowledgeInspectorRecordSummary;
  facts: KnowledgeInspectorFactSummary[];
  factsNextCursor?: string;
  incomingFacts: KnowledgeInspectorFactSummary[];
  incomingFactsNextCursor?: string;
  relatedEntities: KnowledgeInspectorRecordSummary[];
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
  kind: 'entity' | 'page' | 'facts' | 'incoming-facts' | 'activity';
  value: string;
  filters?: { namePrefix?: string; kind?: string };
  expiresAt: number;
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
    cursor?: string;
    limit?: number;
  }): Promise<KnowledgeInspectorRecordList> {
    const binding = await this.#binding();
    const scope = this.#scope(binding, input.level);
    const limit = boundedLimit(input.limit, DEFAULT_RECORD_LIMIT, MAX_RECORD_LIMIT);
    const cursor = this.#consumeCursor(input.cursor, binding, input.level, 'entity', {
      namePrefix: input.namePrefix,
      kind: input.kind,
    });
    const records = await this.#knowledge.listEntities({
      scope,
      namePrefix: input.namePrefix,
      kind: input.kind,
      cursor,
      limit,
    });
    await this.#assertStable(binding);
    return {
      identityKey: binding.identityKey,
      scopeLevel: input.level,
      items: records.map(record => this.#recordSummary(record, binding, input.level)),
      nextCursor:
        records.length === limit
          ? this.#mintCursor(binding, input.level, 'entity', createKnowledgeRecordCursor(records.at(-1)!, input), {
              namePrefix: input.namePrefix,
              kind: input.kind,
            })
          : undefined,
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
    const ownedIds = new Set(factsResult.facts.map(fact => fact.id));
    const incomingFacts = incomingResult.facts.filter(fact => !ownedIds.has(fact.id));
    const relatedEntities = await this.#relatedEntities(
      entity,
      [...factsResult.facts, ...incomingFacts],
      scope,
      binding,
      handle.level,
    );
    await this.#assertStable(binding);
    return {
      identityKey: binding.identityKey,
      scopeLevel: handle.level,
      entity: this.#recordSummary(entity, binding, handle.level),
      facts: factsResult.facts.map(factSummary),
      factsNextCursor: factsResult.nextCursor
        ? this.#mintCursor(binding, handle.level, 'facts', factsResult.nextCursor)
        : undefined,
      incomingFacts: incomingFacts.map(factSummary),
      incomingFactsNextCursor: incomingResult.nextCursor
        ? this.#mintCursor(binding, handle.level, 'incoming-facts', incomingResult.nextCursor)
        : undefined,
      relatedEntities,
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

  async #relatedEntities(
    current: KnowledgeEntity,
    facts: KnowledgeFact[],
    scope: KnowledgeScope,
    binding: Binding,
    level: KnowledgeInspectorScopeLevel,
  ): Promise<KnowledgeInspectorRecordSummary[]> {
    const related = new Map<string, KnowledgeEntity>();
    for (const fact of facts) {
      for (const name of parseKnowledgeWikilinks(fact.text)) {
        if (related.size >= MAX_RELATED_RECORDS) break;
        const entity = await this.#knowledge.resolveEntity({ name, scope });
        if (entity && entity.id !== current.id && isKnowledgeScopeVisible(entity.scope, scope))
          related.set(entity.id, entity);
      }
      if (related.size >= MAX_RELATED_RECORDS) break;
    }
    return [...related.values()].map(entity => this.#recordSummary(entity, binding, level));
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
      entry.filters?.kind !== filters?.kind
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
