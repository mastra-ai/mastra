import type { InMemoryDB } from '../inmemory-db';
import {
  assertKnowledgeScopeWithinCeiling,
  canonicalizeKnowledgeScope,
  createKnowledgeUlid,
  isKnowledgeScopeVisible,
  knowledgeScopeKey,
  knowledgeSemanticDocumentId,
  knowledgeSemanticIdempotencyKey,
  KnowledgeConflictError,
  KnowledgeNotFoundError,
  KnowledgeStorage,
  parseKnowledgeWikilinks,
} from './base';
import type {
  AppendKnowledgeFactInput,
  ClaimKnowledgeSemanticOutboxInput,
  CreateKnowledgeEntityInput,
  CreateKnowledgePageInput,
  KnowledgeActivityAction,
  KnowledgeActivityEvent,
  KnowledgeCurationCursor,
  KnowledgeEntity,
  KnowledgeFact,
  KnowledgeMention,
  KnowledgePage,
  KnowledgeScope,
  KnowledgeSemanticDocumentType,
  KnowledgeSemanticOperation,
  KnowledgeSemanticOutboxEntry,
  ListKnowledgeFactsInput,
  ListKnowledgeFactsOutput,
  ListKnowledgeRecordsInput,
  SearchKnowledgeInput,
  SearchKnowledgeResult,
  UpdateKnowledgeEntityInput,
  UpdateKnowledgePageInput,
} from './base';

function cloneEntity(entity: KnowledgeEntity): KnowledgeEntity {
  return {
    ...entity,
    scope: [...entity.scope],
    createdAt: new Date(entity.createdAt),
    updatedAt: new Date(entity.updatedAt),
  };
}

function clonePage(page: KnowledgePage): KnowledgePage {
  return { ...page, scope: [...page.scope], createdAt: new Date(page.createdAt), updatedAt: new Date(page.updatedAt) };
}

function cloneFact(fact: KnowledgeFact): KnowledgeFact {
  return {
    ...fact,
    scope: [...fact.scope],
    capturedAt: new Date(fact.capturedAt),
    when: fact.when ? new Date(fact.when) : undefined,
    deletedAt: fact.deletedAt ? new Date(fact.deletedAt) : undefined,
  };
}

function recordKey(name: string, scope: KnowledgeScope): string {
  return `${knowledgeScopeKey(scope)}\u0000${name.trim().toLocaleLowerCase()}`;
}

export class InMemoryKnowledgeStorage extends KnowledgeStorage {
  readonly #db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.#db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.#db.knowledgeEntities.clear();
    this.#db.knowledgeEntityKeys.clear();
    this.#db.knowledgePages.clear();
    this.#db.knowledgePageKeys.clear();
    this.#db.knowledgeFacts.clear();
    this.#db.knowledgeMentions.clear();
    this.#db.knowledgeCursors.clear();
    this.#db.knowledgeActivity.length = 0;
    this.#db.knowledgeSemanticOutbox.clear();
    this.#db.knowledgeSemanticIdempotency.clear();
  }

  async createEntity(input: CreateKnowledgeEntityInput): Promise<KnowledgeEntity> {
    if (input.kind === 'page') throw new Error('Entity kind "page" is reserved for knowledge pages');
    const scope = canonicalizeKnowledgeScope(input.scope);
    const key = recordKey(input.name, scope);
    const existingId = this.#db.knowledgeEntityKeys.get(key);
    if (existingId) {
      const terminal = this.#resolveTerminalEntity(existingId)!;
      if (!isKnowledgeScopeVisible(terminal.scope, scope)) {
        throw new Error(`Merged knowledge entity is not visible from scope: ${input.name}`);
      }
      return cloneEntity(terminal);
    }

    const now = new Date();
    const entity: KnowledgeEntity = {
      id: input.id ?? crypto.randomUUID(),
      type: 'entity',
      name: input.name.trim(),
      kind: input.kind,
      scope,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    if (this.#db.knowledgeEntities.has(entity.id)) throw new Error(`Knowledge entity already exists: ${entity.id}`);
    this.#db.knowledgeEntities.set(entity.id, entity);
    this.#db.knowledgeEntityKeys.set(key, entity.id);
    this.#recordActivity('entity-created', 'entity', entity.id, scope);
    this.#enqueue('entity', entity.id, 'upsert', entity.version, scope);
    return cloneEntity(entity);
  }

  async getEntity(id: string): Promise<KnowledgeEntity | null> {
    const entity = this.#db.knowledgeEntities.get(id);
    return entity ? cloneEntity(entity) : null;
  }

  async getEntityByName({ name, scope }: { name: string; scope: KnowledgeScope }): Promise<KnowledgeEntity | null> {
    const id = this.#db.knowledgeEntityKeys.get(recordKey(name, scope));
    if (!id) return null;
    const entity = this.#db.knowledgeEntities.get(id);
    return entity ? cloneEntity(entity) : null;
  }

  async resolveEntity({ name, scope }: { name: string; scope: KnowledgeScope }): Promise<KnowledgeEntity | null> {
    const canonical = canonicalizeKnowledgeScope(scope);
    for (let length = canonical.length; length > 0; length--) {
      const entity = await this.getEntityByName({ name, scope: canonical.slice(0, length) });
      if (entity) {
        const terminal = this.#resolveTerminalEntity(entity.id)!;
        if (isKnowledgeScopeVisible(terminal.scope, canonical)) return cloneEntity(terminal);
      }
    }
    return null;
  }

  async listEntities(input: ListKnowledgeRecordsInput): Promise<KnowledgeEntity[]> {
    const queryScope = canonicalizeKnowledgeScope(input.scope);
    return [...this.#db.knowledgeEntities.values()]
      .filter(entity => !entity.mergedInto)
      .filter(entity => isKnowledgeScopeVisible(entity.scope, queryScope))
      .filter(
        entity => !input.namePrefix || entity.name.toLocaleLowerCase().startsWith(input.namePrefix.toLocaleLowerCase()),
      )
      .filter(entity => !input.kind || entity.kind === input.kind)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || a.name.localeCompare(b.name))
      .slice(0, input.limit ?? 100)
      .map(cloneEntity);
  }

  async updateEntity(input: UpdateKnowledgeEntityInput): Promise<KnowledgeEntity> {
    const existing = this.#db.knowledgeEntities.get(input.id);
    if (!existing) throw new KnowledgeNotFoundError('entity', input.id);
    if (existing.version !== input.version) throw new KnowledgeConflictError(input.id);
    if (existing.mergedInto) throw new Error(`Cannot update merged knowledge entity: ${input.id}`);
    if (input.kind === 'page') throw new Error('Entity kind "page" is reserved for knowledge pages');

    const scope = canonicalizeKnowledgeScope(input.scope ?? existing.scope);
    const name = (input.name ?? existing.name).trim();
    const oldKey = recordKey(existing.name, existing.scope);
    const newKey = recordKey(name, scope);
    const collision = this.#db.knowledgeEntityKeys.get(newKey);
    if (collision && collision !== input.id) throw new Error(`Knowledge entity already exists in scope: ${name}`);

    const updated: KnowledgeEntity = {
      ...existing,
      name,
      kind: input.kind ?? existing.kind,
      scope,
      version: existing.version + 1,
      updatedAt: new Date(),
    };
    if (oldKey !== newKey) {
      this.#db.knowledgeEntityKeys.delete(oldKey);
      this.#db.knowledgeEntityKeys.set(newKey, input.id);
    }
    this.#db.knowledgeEntities.set(input.id, updated);
    this.#recordActivity('entity-updated', 'entity', input.id, scope);
    const scopeChanged = knowledgeScopeKey(existing.scope) !== knowledgeScopeKey(scope);
    if (scopeChanged) {
      this.#enqueue('entity', input.id, 'delete', createKnowledgeUlid(), existing.scope);
      for (const fact of this.#db.knowledgeFacts.values()) {
        if (fact.parentEntityId !== input.id) continue;
        this.#enqueue('fact', fact.id, 'delete', createKnowledgeUlid(), fact.scope);
        if (!fact.deletedAt) this.#enqueue('fact', fact.id, 'upsert', createKnowledgeUlid(), fact.scope);
      }
    }
    this.#enqueue('entity', input.id, 'upsert', updated.version, scope);
    return cloneEntity(updated);
  }

  async mergeEntities(input: { sourceId: string; targetId: string; sourceVersion: number }): Promise<KnowledgeEntity> {
    if (input.sourceId === input.targetId) throw new Error('Cannot merge a knowledge entity into itself');
    const source = this.#db.knowledgeEntities.get(input.sourceId);
    if (!source) throw new KnowledgeNotFoundError('entity', input.sourceId);
    if (source.version !== input.sourceVersion) throw new KnowledgeConflictError(input.sourceId);
    const target = this.#resolveTerminalEntity(input.targetId);
    if (!target) throw new KnowledgeNotFoundError('entity', input.targetId);
    if (!isKnowledgeScopeVisible(target.scope, source.scope)) {
      throw new Error('Cannot merge a knowledge entity into a target that is narrower than its source scope');
    }

    for (const [id, fact] of this.#db.knowledgeFacts) {
      if (fact.parentEntityId === source.id) {
        this.#db.knowledgeFacts.set(id, { ...fact, parentEntityId: target.id });
        this.#enqueue('fact', id, fact.deletedAt ? 'delete' : 'upsert', createKnowledgeUlid(), fact.scope);
      }
    }
    for (const [key, mentions] of this.#db.knowledgeMentions) {
      if (mentions.has(source.id)) {
        const next = new Set(mentions);
        next.delete(source.id);
        next.add(target.id);
        this.#db.knowledgeMentions.set(key, next);
        const separator = key.indexOf(':');
        const sourceType = key.slice(0, separator);
        const sourceId = key.slice(separator + 1);
        if (sourceType === 'fact') {
          const fact = this.#db.knowledgeFacts.get(sourceId);
          if (fact)
            this.#enqueue('fact', sourceId, fact.deletedAt ? 'delete' : 'upsert', createKnowledgeUlid(), fact.scope);
        } else {
          const page = this.#db.knowledgePages.get(sourceId);
          if (page) this.#enqueue('page', sourceId, 'upsert', createKnowledgeUlid(), page.scope);
        }
      }
    }
    const updatedSource: KnowledgeEntity = {
      ...source,
      mergedInto: target.id,
      version: source.version + 1,
      updatedAt: new Date(),
    };
    this.#db.knowledgeEntities.set(source.id, updatedSource);
    this.#recordActivity('entity-merged', 'entity', source.id, source.scope);
    this.#enqueue('entity', source.id, 'delete', updatedSource.version, source.scope);
    this.#enqueue('entity', target.id, 'upsert', createKnowledgeUlid(), target.scope);
    return cloneEntity(target);
  }

  async createPage(input: CreateKnowledgePageInput): Promise<KnowledgePage> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const key = recordKey(input.name, scope);
    if (this.#db.knowledgePageKeys.has(key)) throw new Error(`Knowledge page already exists in scope: ${input.name}`);
    const now = new Date();
    const page: KnowledgePage = {
      id: input.id ?? crypto.randomUUID(),
      type: 'page',
      name: input.name.trim(),
      body: input.body,
      scope,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    if (this.#db.knowledgePages.has(page.id)) throw new Error(`Knowledge page already exists: ${page.id}`);
    this.#db.knowledgePages.set(page.id, page);
    this.#db.knowledgePageKeys.set(key, page.id);
    await this.#replaceMentions('page', page.id, page.body, scope, scope);
    this.#recordActivity('page-created', 'page', page.id, scope);
    this.#enqueue('page', page.id, 'upsert', page.version, scope);
    return clonePage(page);
  }

  async getPage(id: string): Promise<KnowledgePage | null> {
    const page = this.#db.knowledgePages.get(id);
    return page ? clonePage(page) : null;
  }

  async getPageByName({ name, scope }: { name: string; scope: KnowledgeScope }): Promise<KnowledgePage | null> {
    const canonical = canonicalizeKnowledgeScope(scope);
    for (let length = canonical.length; length > 0; length--) {
      const id = this.#db.knowledgePageKeys.get(recordKey(name, canonical.slice(0, length)));
      if (id) return clonePage(this.#db.knowledgePages.get(id)!);
    }
    return null;
  }

  async listPages(input: Omit<ListKnowledgeRecordsInput, 'kind'>): Promise<KnowledgePage[]> {
    const queryScope = canonicalizeKnowledgeScope(input.scope);
    return [...this.#db.knowledgePages.values()]
      .filter(page => isKnowledgeScopeVisible(page.scope, queryScope))
      .filter(
        page => !input.namePrefix || page.name.toLocaleLowerCase().startsWith(input.namePrefix.toLocaleLowerCase()),
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || a.name.localeCompare(b.name))
      .slice(0, input.limit ?? 100)
      .map(clonePage);
  }

  async updatePage(input: UpdateKnowledgePageInput): Promise<KnowledgePage> {
    const existing = this.#db.knowledgePages.get(input.id);
    if (!existing) throw new KnowledgeNotFoundError('page', input.id);
    if (existing.version !== input.version) throw new KnowledgeConflictError(input.id);
    const scope = canonicalizeKnowledgeScope(input.scope ?? existing.scope);
    const name = (input.name ?? existing.name).trim();
    const oldKey = recordKey(existing.name, existing.scope);
    const newKey = recordKey(name, scope);
    const collision = this.#db.knowledgePageKeys.get(newKey);
    if (collision && collision !== input.id) throw new Error(`Knowledge page already exists in scope: ${name}`);
    const updated: KnowledgePage = {
      ...existing,
      name,
      body: input.body ?? existing.body,
      scope,
      version: existing.version + 1,
      updatedAt: new Date(),
    };
    if (oldKey !== newKey) {
      this.#db.knowledgePageKeys.delete(oldKey);
      this.#db.knowledgePageKeys.set(newKey, input.id);
    }
    this.#db.knowledgePages.set(input.id, updated);
    if (input.body !== undefined || input.scope !== undefined) {
      await this.#replaceMentions('page', input.id, updated.body, input.resolutionScope ?? scope, scope);
    }
    this.#recordActivity('page-updated', 'page', input.id, scope);
    if (knowledgeScopeKey(existing.scope) !== knowledgeScopeKey(scope)) {
      this.#enqueue('page', input.id, 'delete', createKnowledgeUlid(), existing.scope);
    }
    this.#enqueue('page', input.id, 'upsert', updated.version, scope);
    return clonePage(updated);
  }

  async appendFact(input: AppendKnowledgeFactInput): Promise<KnowledgeFact> {
    const parent = this.#resolveTerminalEntity(input.parentEntityId);
    if (!parent) throw new KnowledgeNotFoundError('entity', input.parentEntityId);
    const scope = canonicalizeKnowledgeScope(input.scope);
    assertKnowledgeScopeWithinCeiling(scope, input.maxScope);
    const fact: KnowledgeFact = {
      id: input.id ?? createKnowledgeUlid(),
      parentEntityId: parent.id,
      text: input.text,
      scope,
      sourceThreadId: input.sourceThreadId,
      capturedAt: new Date(),
      when: input.when ? new Date(input.when) : undefined,
      maxScope: input.maxScope,
    };
    if (this.#db.knowledgeFacts.has(fact.id)) throw new Error(`Knowledge fact already exists: ${fact.id}`);
    this.#db.knowledgeFacts.set(fact.id, fact);
    await this.#replaceMentions('fact', fact.id, fact.text, input.resolutionScope, input.defaultScope);
    parent.updatedAt = new Date();
    this.#recordActivity('fact-created', 'fact', fact.id, scope, input.sourceThreadId);
    this.#enqueue('fact', fact.id, 'upsert', fact.id, scope);
    return cloneFact(fact);
  }

  async getFact({
    id,
    includeDeleted = false,
  }: {
    id: string;
    includeDeleted?: boolean;
  }): Promise<KnowledgeFact | null> {
    const fact = this.#db.knowledgeFacts.get(id);
    if (!fact || (fact.deletedAt && !includeDeleted)) return null;
    return cloneFact(fact);
  }

  async factsAbout(input: ListKnowledgeFactsInput): Promise<ListKnowledgeFactsOutput> {
    const queryScope = canonicalizeKnowledgeScope(input.scope);
    const terminal = this.#resolveTerminalEntity(input.entityId);
    if (!terminal || !isKnowledgeScopeVisible(terminal.scope, queryScope)) return { facts: [] };
    return this.#paginateFacts(
      [...this.#db.knowledgeFacts.values()].filter(fact => fact.parentEntityId === terminal.id),
      { ...input, scope: queryScope },
    );
  }

  async factsTouching(input: ListKnowledgeFactsInput): Promise<ListKnowledgeFactsOutput> {
    const queryScope = canonicalizeKnowledgeScope(input.scope);
    const terminal = this.#resolveTerminalEntity(input.entityId);
    if (!terminal || !isKnowledgeScopeVisible(terminal.scope, queryScope)) return { facts: [] };
    return this.#paginateFacts(
      [...this.#db.knowledgeFacts.values()].filter(
        fact =>
          fact.parentEntityId === terminal.id || this.#db.knowledgeMentions.get(`fact:${fact.id}`)?.has(terminal.id),
      ),
      { ...input, scope: queryScope },
    );
  }

  async removeFact({ id, deletedBy }: { id: string; deletedBy: string }): Promise<KnowledgeFact> {
    const fact = this.#db.knowledgeFacts.get(id);
    if (!fact) throw new KnowledgeNotFoundError('fact', id);
    if (fact.deletedAt) return cloneFact(fact);
    const updated = { ...fact, deletedAt: new Date(), deletedBy };
    this.#db.knowledgeFacts.set(id, updated);
    this.#recordActivity('fact-deleted', 'fact', id, fact.scope, fact.sourceThreadId);
    this.#enqueue('fact', id, 'delete', updated.deletedAt.toISOString(), fact.scope);
    return cloneFact(updated);
  }

  async restoreFact({ id }: { id: string }): Promise<KnowledgeFact> {
    const fact = this.#db.knowledgeFacts.get(id);
    if (!fact) throw new KnowledgeNotFoundError('fact', id);
    if (!fact.deletedAt) return cloneFact(fact);
    const updated = { ...fact, deletedAt: undefined, deletedBy: undefined };
    this.#db.knowledgeFacts.set(id, updated);
    this.#recordActivity('fact-restored', 'fact', id, fact.scope, fact.sourceThreadId);
    this.#enqueue('fact', id, 'upsert', createKnowledgeUlid(), fact.scope);
    return cloneFact(updated);
  }

  async rescopeFact({ id, scope }: { id: string; scope: KnowledgeScope }): Promise<KnowledgeFact> {
    const fact = this.#db.knowledgeFacts.get(id);
    if (!fact) throw new KnowledgeNotFoundError('fact', id);
    const canonical = canonicalizeKnowledgeScope(scope);
    assertKnowledgeScopeWithinCeiling(canonical, fact.maxScope);
    const updated = { ...fact, scope: canonical };
    this.#db.knowledgeFacts.set(id, updated);
    this.#recordActivity('fact-rescoped', 'fact', id, canonical, fact.sourceThreadId);
    if (knowledgeScopeKey(fact.scope) !== knowledgeScopeKey(canonical)) {
      this.#enqueue('fact', id, 'delete', createKnowledgeUlid(), fact.scope);
    }
    if (!fact.deletedAt) {
      this.#enqueue('fact', id, 'upsert', createKnowledgeUlid(), canonical);
    }
    return cloneFact(updated);
  }

  async raiseCeiling({ id, maxScope }: { id: string; maxScope?: KnowledgeFact['maxScope'] }): Promise<KnowledgeFact> {
    const fact = this.#db.knowledgeFacts.get(id);
    if (!fact) throw new KnowledgeNotFoundError('fact', id);
    const updated = { ...fact, maxScope };
    this.#db.knowledgeFacts.set(id, updated);
    return cloneFact(updated);
  }

  async search(input: SearchKnowledgeInput): Promise<SearchKnowledgeResult[]> {
    const queryScope = canonicalizeKnowledgeScope(input.scope);
    const query = input.query.trim().toLocaleLowerCase();
    if (!query) return [];
    const results: SearchKnowledgeResult[] = [];
    for (const entity of await this.listEntities({ scope: queryScope, limit: Number.MAX_SAFE_INTEGER })) {
      if (entity.name.toLocaleLowerCase().includes(query) || entity.kind.toLocaleLowerCase().includes(query)) {
        results.push({
          type: 'entity',
          id: entity.id,
          recordId: entity.id,
          name: entity.name,
          text: entity.name,
          scope: entity.scope,
        });
      }
    }
    for (const page of await this.listPages({ scope: queryScope, limit: Number.MAX_SAFE_INTEGER })) {
      if (page.name.toLocaleLowerCase().includes(query) || page.body.toLocaleLowerCase().includes(query)) {
        results.push({
          type: 'page',
          id: page.id,
          recordId: page.id,
          name: page.name,
          text: page.body,
          scope: page.scope,
        });
      }
    }
    for (const fact of this.#db.knowledgeFacts.values()) {
      if (
        !fact.deletedAt &&
        isKnowledgeScopeVisible(fact.scope, queryScope) &&
        fact.text.toLocaleLowerCase().includes(query)
      ) {
        const entity = this.#db.knowledgeEntities.get(fact.parentEntityId);
        if (entity && !entity.mergedInto && isKnowledgeScopeVisible(entity.scope, queryScope)) {
          results.push({
            type: 'fact',
            id: fact.id,
            recordId: entity.id,
            name: entity.name,
            text: fact.text,
            scope: fact.scope,
          });
        }
      }
    }
    return results.slice(0, input.limit ?? 20);
  }

  async getCurationCursor(input: { sourceThreadId: string; agent: string }): Promise<KnowledgeCurationCursor | null> {
    const cursor = this.#db.knowledgeCursors.get(`${input.sourceThreadId}\u0000${input.agent}`);
    return cursor ? { ...cursor, updatedAt: new Date(cursor.updatedAt) } : null;
  }

  async advanceCurationCursor(input: {
    sourceThreadId: string;
    agent: string;
    lastFactId: string;
  }): Promise<KnowledgeCurationCursor> {
    const key = `${input.sourceThreadId}\u0000${input.agent}`;
    const existing = this.#db.knowledgeCursors.get(key);
    if (existing && input.lastFactId < existing.lastFactId)
      throw new Error('Knowledge curation cursor cannot move backwards');
    const cursor = { ...input, updatedAt: new Date() };
    this.#db.knowledgeCursors.set(key, cursor);
    return { ...cursor };
  }

  async listActivity(input: {
    scope: KnowledgeScope;
    after?: string;
    limit?: number;
  }): Promise<KnowledgeActivityEvent[]> {
    const queryScope = canonicalizeKnowledgeScope(input.scope);
    return this.#db.knowledgeActivity
      .filter(event => isKnowledgeScopeVisible(event.scope, queryScope))
      .filter(event => !input.after || event.id > input.after)
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, input.limit ?? 100)
      .map(event => ({ ...event, scope: [...event.scope], createdAt: new Date(event.createdAt) }));
  }

  async listSemanticOutbox(
    input: {
      status?: KnowledgeSemanticOutboxEntry['status'];
      scope?: KnowledgeScope;
      limit?: number;
    } = {},
  ): Promise<KnowledgeSemanticOutboxEntry[]> {
    const queryScope = input.scope ? canonicalizeKnowledgeScope(input.scope) : undefined;
    return [...this.#db.knowledgeSemanticOutbox.values()]
      .filter(entry => !input.status || entry.status === input.status)
      .filter(entry => !queryScope || isKnowledgeScopeVisible(entry.scope, queryScope))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
      .slice(0, input.limit ?? 100)
      .map(entry => ({ ...entry, scope: [...entry.scope] }));
  }

  async claimSemanticOutbox(input: ClaimKnowledgeSemanticOutboxInput): Promise<KnowledgeSemanticOutboxEntry[]> {
    const now = input.now ?? new Date();
    const timeout = input.claimTimeoutMs ?? 60_000;
    const queryScope = input.scope ? canonicalizeKnowledgeScope(input.scope) : undefined;
    const claimed = [...this.#db.knowledgeSemanticOutbox.values()]
      .filter(
        entry =>
          entry.status === 'pending' ||
          (entry.status === 'processing' && entry.claimedAt && now.getTime() - entry.claimedAt.getTime() >= timeout),
      )
      .filter(entry => entry.availableAt <= now)
      .filter(entry => !queryScope || isKnowledgeScopeVisible(entry.scope, queryScope))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
      .slice(0, input.limit ?? 100);
    for (const entry of claimed) {
      entry.status = 'processing';
      entry.claimedAt = now;
      entry.claimedBy = input.workerId;
      entry.attempts += 1;
    }
    return claimed.map(entry => ({ ...entry, scope: [...entry.scope] }));
  }

  async completeSemanticOutbox({ ids, workerId }: { ids: string[]; workerId: string }): Promise<void> {
    const now = new Date();
    for (const id of ids) {
      const entry = this.#db.knowledgeSemanticOutbox.get(id);
      if (entry?.status === 'processing' && entry.claimedBy === workerId) {
        entry.status = 'completed';
        entry.completedAt = now;
      }
    }
  }

  async releaseSemanticOutbox({
    ids,
    workerId,
    retryAt,
  }: {
    ids: string[];
    workerId: string;
    retryAt?: Date;
  }): Promise<void> {
    for (const id of ids) {
      const entry = this.#db.knowledgeSemanticOutbox.get(id);
      if (entry?.status === 'processing' && entry.claimedBy === workerId) {
        entry.status = 'pending';
        entry.availableAt = retryAt ?? new Date();
        entry.claimedAt = undefined;
        entry.claimedBy = undefined;
      }
    }
  }

  #resolveTerminalEntity(id: string): KnowledgeEntity | null {
    let entity = this.#db.knowledgeEntities.get(id);
    const seen = new Set<string>();
    while (entity?.mergedInto) {
      if (seen.has(entity.id)) throw new Error(`Knowledge merge cycle detected at ${entity.id}`);
      seen.add(entity.id);
      entity = this.#db.knowledgeEntities.get(entity.mergedInto);
    }
    return entity ?? null;
  }

  async #replaceMentions(
    sourceType: KnowledgeMention['sourceType'],
    sourceId: string,
    text: string,
    resolutionScope: KnowledgeScope,
    defaultScope: KnowledgeScope,
  ): Promise<void> {
    const mentions = new Set<string>();
    for (const name of parseKnowledgeWikilinks(text)) {
      let entity = await this.resolveEntity({ name, scope: resolutionScope });
      entity ??= await this.createEntity({ name, kind: 'entity', scope: defaultScope });
      mentions.add(entity.id);
    }
    this.#db.knowledgeMentions.set(`${sourceType}:${sourceId}`, mentions);
  }

  #paginateFacts(facts: KnowledgeFact[], input: ListKnowledgeFactsInput): ListKnowledgeFactsOutput {
    const filtered = facts
      .filter(fact => input.includeDeleted || !fact.deletedAt)
      .filter(fact => isKnowledgeScopeVisible(fact.scope, input.scope))
      .filter(fact => !input.after || fact.id < input.after)
      .sort((a, b) => b.id.localeCompare(a.id));
    const limit = input.limit ?? 100;
    const page = filtered.slice(0, limit);
    return {
      facts: page.map(cloneFact),
      nextCursor: filtered.length > limit ? page.at(-1)?.id : undefined,
    };
  }

  #recordActivity(
    action: KnowledgeActivityAction,
    recordType: KnowledgeSemanticDocumentType,
    recordId: string,
    scope: KnowledgeScope,
    sourceThreadId?: string,
  ): void {
    const event: KnowledgeActivityEvent = {
      id: createKnowledgeUlid(),
      action,
      recordType,
      recordId,
      scope: [...scope],
      sourceThreadId,
      createdAt: new Date(),
    };
    this.#db.knowledgeActivity.push(event);
  }

  #enqueue(
    documentType: KnowledgeSemanticDocumentType,
    id: string,
    operation: KnowledgeSemanticOperation,
    version: number | string,
    scope: KnowledgeScope,
  ): void {
    const documentId = knowledgeSemanticDocumentId(documentType, id);
    const idempotencyKey = knowledgeSemanticIdempotencyKey(documentId, operation, version);
    if (this.#db.knowledgeSemanticIdempotency.has(idempotencyKey)) return;
    const now = new Date();
    const entry: KnowledgeSemanticOutboxEntry = {
      id: createKnowledgeUlid(),
      idempotencyKey,
      documentId,
      documentType,
      operation,
      scope: [...scope],
      status: 'pending',
      attempts: 0,
      availableAt: now,
      createdAt: now,
    };
    this.#db.knowledgeSemanticOutbox.set(entry.id, entry);
    this.#db.knowledgeSemanticIdempotency.set(idempotencyKey, entry.id);
  }
}
