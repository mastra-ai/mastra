import type { InMemoryDB } from '../inmemory-db';
import {
  assertKnowledgeCeilingRaised,
  assertKnowledgeDescriptionWithinBound,
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
  parseKnowledgeNodeCursor,
  parseKnowledgeWikilinks,
} from './base';
import type {
  AppendKnowledgeInput,
  ClaimKnowledgeSemanticOutboxInput,
  CreateKnowledgeNodeInput,
  KnowledgeActivityAction,
  KnowledgeActivityEvent,
  KnowledgeCurationCursor,
  KnowledgeNode,
  KnowledgeRecord,
  KnowledgeMention,
  KnowledgeScope,
  KnowledgeSemanticDocumentType,
  KnowledgeSemanticOperation,
  KnowledgeSemanticOutboxEntry,
  QueryKnowledgeBySourceInput,
  QueryKnowledgeInput,
  QueryKnowledgeOutput,
  ListKnowledgeNodesInput,
  SearchKnowledgeInput,
  SearchKnowledgeResult,
  UpdateKnowledgeNodeInput,
} from './base';

function cloneNode(node: KnowledgeNode): KnowledgeNode {
  return {
    ...node,
    scope: [...node.scope],
    createdAt: new Date(node.createdAt),
    updatedAt: new Date(node.updatedAt),
  };
}

function nodeReferenceId(node: KnowledgeNode | string): string {
  return typeof node === 'string' ? node : node.id;
}

function cloneRecord(record: KnowledgeRecord): KnowledgeRecord {
  return {
    ...record,
    scope: [...record.scope],
    capturedAt: new Date(record.capturedAt),
    when: record.when ? new Date(record.when) : undefined,
    deletedAt: record.deletedAt ? new Date(record.deletedAt) : undefined,
  };
}

function cloneSemanticOutboxEntry(entry: KnowledgeSemanticOutboxEntry): KnowledgeSemanticOutboxEntry {
  return {
    ...entry,
    scope: [...entry.scope],
    availableAt: new Date(entry.availableAt),
    createdAt: new Date(entry.createdAt),
    claimedAt: entry.claimedAt ? new Date(entry.claimedAt) : undefined,
    completedAt: entry.completedAt ? new Date(entry.completedAt) : undefined,
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
    this.#db.knowledgeNodes.clear();
    this.#db.knowledgeNodeKeys.clear();
    this.#db.knowledgeRecords.clear();
    this.#db.knowledgeMentions.clear();
    this.#db.knowledgeCursors.clear();
    this.#db.knowledgeActivity.length = 0;
    this.#db.knowledgeSemanticOutbox.clear();
    this.#db.knowledgeSemanticIdempotency.clear();
  }

  async createNode(input: CreateKnowledgeNodeInput): Promise<KnowledgeNode> {
    return this.#runAtomicMutation(() => this.#createNode(input));
  }

  #createNode(input: CreateKnowledgeNodeInput): KnowledgeNode {
    assertKnowledgeDescriptionWithinBound(input.description);
    const scope = canonicalizeKnowledgeScope(input.scope);
    const key = recordKey(input.name, scope);
    const existingId = this.#db.knowledgeNodeKeys.get(key);
    if (existingId) {
      const terminal = this.#resolveTerminalNode(existingId)!;
      if (!isKnowledgeScopeVisible(terminal.scope, scope)) {
        throw new Error(`Merged knowledge node is not visible from scope: ${input.name}`);
      }
      return cloneNode(terminal);
    }

    const now = new Date();
    const node: KnowledgeNode = {
      id: input.id ?? crypto.randomUUID(),
      type: 'node',
      name: input.name.trim(),
      kind: input.kind,
      content: input.content,
      description: input.description,
      scope,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    if (this.#db.knowledgeNodes.has(node.id)) throw new Error(`Knowledge node already exists: ${node.id}`);
    this.#db.knowledgeNodes.set(node.id, node);
    this.#db.knowledgeNodeKeys.set(key, node.id);
    this.#replaceMentions('node', node.id, node.content ?? '', input.resolutionScope ?? scope, scope);
    this.#recordActivity('node-created', 'node', node.id, scope);
    this.#enqueue('node', node.id, 'upsert', node.version, scope);
    return cloneNode(node);
  }

  async getNode(id: string): Promise<KnowledgeNode | null> {
    const node = this.#db.knowledgeNodes.get(id);
    return node ? cloneNode(node) : null;
  }

  async getNodeByName({ name, scope }: { name: string; scope: KnowledgeScope }): Promise<KnowledgeNode | null> {
    const id = this.#db.knowledgeNodeKeys.get(recordKey(name, scope));
    if (!id) return null;
    const node = this.#db.knowledgeNodes.get(id);
    return node ? cloneNode(node) : null;
  }

  async resolveNode(input: { name: string; scope: KnowledgeScope }): Promise<KnowledgeNode | null> {
    return this.#resolveNode(input);
  }

  #resolveNode({ name, scope }: { name: string; scope: KnowledgeScope }): KnowledgeNode | null {
    const canonical = canonicalizeKnowledgeScope(scope);
    for (let length = canonical.length; length > 0; length--) {
      const id = this.#db.knowledgeNodeKeys.get(recordKey(name, canonical.slice(0, length)));
      const node = id ? this.#db.knowledgeNodes.get(id) : undefined;
      if (node) {
        const terminal = this.#resolveTerminalNode(node.id)!;
        if (isKnowledgeScopeVisible(terminal.scope, canonical)) return cloneNode(terminal);
      }
    }
    return null;
  }

  async listNodes(input: ListKnowledgeNodesInput): Promise<KnowledgeNode[]> {
    const queryScope = canonicalizeKnowledgeScope(input.scope);
    const cursor = input.cursor
      ? parseKnowledgeNodeCursor(input.cursor, {
          namePrefix: input.namePrefix,
          kind: input.kind,
          hasContent: input.hasContent,
        })
      : undefined;
    return [...this.#db.knowledgeNodes.values()]
      .filter(node => !node.mergedInto)
      .filter(node => isKnowledgeScopeVisible(node.scope, queryScope))
      .filter(
        node => !input.namePrefix || node.name.toLocaleLowerCase().startsWith(input.namePrefix.toLocaleLowerCase()),
      )
      .filter(node => !input.kind || node.kind === input.kind)
      .filter(node => input.hasContent === undefined || Boolean(node.content) === input.hasContent)
      .sort(
        (a, b) =>
          b.updatedAt.getTime() - a.updatedAt.getTime() ||
          (a.name === b.name ? a.id.localeCompare(b.id) : a.name.localeCompare(b.name)),
      )
      .filter(
        node =>
          !cursor ||
          node.updatedAt < cursor.updatedAt ||
          (node.updatedAt.getTime() === cursor.updatedAt.getTime() &&
            (node.name > cursor.name || (node.name === cursor.name && node.id > cursor.id))),
      )
      .slice(0, input.limit ?? 100)
      .map(cloneNode);
  }

  async updateNode(input: UpdateKnowledgeNodeInput): Promise<KnowledgeNode> {
    return this.#runAtomicMutation(() => this.#updateNode(input));
  }

  #updateNode(input: UpdateKnowledgeNodeInput): KnowledgeNode {
    assertKnowledgeDescriptionWithinBound(input.description);
    const existing = this.#db.knowledgeNodes.get(input.id);
    if (!existing) throw new KnowledgeNotFoundError('node', input.id);
    if (existing.version !== input.version) throw new KnowledgeConflictError(input.id);
    if (existing.mergedInto) throw new Error(`Cannot update merged knowledge node: ${input.id}`);

    const scope = canonicalizeKnowledgeScope(input.scope ?? existing.scope);
    const name = (input.name ?? existing.name).trim();
    const oldKey = recordKey(existing.name, existing.scope);
    const newKey = recordKey(name, scope);
    const collision = this.#db.knowledgeNodeKeys.get(newKey);
    if (collision && collision !== input.id) throw new Error(`Knowledge node already exists in scope: ${name}`);

    const updated: KnowledgeNode = {
      ...existing,
      name,
      kind: input.kind ?? existing.kind,
      content: input.content ?? existing.content,
      description: input.description ?? existing.description,
      scope,
      version: existing.version + 1,
      updatedAt: new Date(),
    };
    if (oldKey !== newKey) {
      this.#db.knowledgeNodeKeys.delete(oldKey);
      this.#db.knowledgeNodeKeys.set(newKey, input.id);
    }
    this.#db.knowledgeNodes.set(input.id, updated);
    if (input.content !== undefined || input.name !== undefined || input.scope !== undefined) {
      this.#replaceMentions('node', input.id, updated.content ?? '', input.resolutionScope ?? scope, scope);
    }
    this.#recordActivity('node-updated', 'node', input.id, scope);
    const scopeChanged = knowledgeScopeKey(existing.scope) !== knowledgeScopeKey(scope);
    if (scopeChanged) {
      this.#enqueue('node', input.id, 'delete', createKnowledgeUlid(), existing.scope);
      for (const record of this.#db.knowledgeRecords.values()) {
        if (record.node !== input.id) continue;
        this.#enqueue('record', record.id, 'delete', createKnowledgeUlid(), record.scope);
        if (!record.deletedAt) this.#enqueue('record', record.id, 'upsert', createKnowledgeUlid(), record.scope);
      }
    }
    this.#enqueue('node', input.id, 'upsert', updated.version, scope);
    return cloneNode(updated);
  }

  async mergeNodes(input: { sourceId: string; targetId: string; sourceVersion: number }): Promise<KnowledgeNode> {
    if (input.sourceId === input.targetId) throw new Error('Cannot merge a knowledge node into itself');
    const source = this.#db.knowledgeNodes.get(input.sourceId);
    if (!source) throw new KnowledgeNotFoundError('node', input.sourceId);
    if (source.version !== input.sourceVersion) throw new KnowledgeConflictError(input.sourceId);
    const target = this.#resolveTerminalNode(input.targetId);
    if (!target) throw new KnowledgeNotFoundError('node', input.targetId);
    if (target.id === source.id) throw new Error('Cannot create a knowledge merge cycle');
    if (!isKnowledgeScopeVisible(target.scope, source.scope)) {
      throw new Error('Cannot merge a knowledge node into a target that is narrower than its source scope');
    }

    for (const [id, record] of this.#db.knowledgeRecords) {
      if (record.node === source.id) {
        this.#db.knowledgeRecords.set(id, { ...record, node: target.id });
        this.#enqueue('record', id, record.deletedAt ? 'delete' : 'upsert', createKnowledgeUlid(), record.scope);
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
        if (sourceType === 'record') {
          const record = this.#db.knowledgeRecords.get(sourceId);
          if (record)
            this.#enqueue(
              'record',
              sourceId,
              record.deletedAt ? 'delete' : 'upsert',
              createKnowledgeUlid(),
              record.scope,
            );
        } else {
          const sourceNode = this.#db.knowledgeNodes.get(sourceId);
          if (sourceNode) this.#enqueue('node', sourceId, 'upsert', createKnowledgeUlid(), sourceNode.scope);
        }
      }
    }
    const updatedSource: KnowledgeNode = {
      ...source,
      mergedInto: target.id,
      version: source.version + 1,
      updatedAt: new Date(),
    };
    this.#db.knowledgeNodes.set(source.id, updatedSource);
    // Merge matrix: a target that NEVER had a description (undefined — '' is an explicit curator
    // clear and wins) adopts the source's; otherwise the target's state is preserved.
    let mergedTarget = target;
    // No version predicate is needed here: the whole merge runs inside #runAtomicMutation, so `target`
    // cannot change between the read above and this write. The persistent adapters guard the same
    // adoption with an explicit version + description predicate, where that window is real.
    if (target.description === undefined && source.description) {
      mergedTarget = {
        ...target,
        description: source.description,
        version: target.version + 1,
        updatedAt: new Date(),
      };
      this.#db.knowledgeNodes.set(target.id, mergedTarget);
      this.#recordActivity('node-updated', 'node', target.id, target.scope);
    }
    this.#recordActivity('node-merged', 'node', source.id, source.scope);
    this.#enqueue('node', source.id, 'delete', updatedSource.version, source.scope);
    this.#enqueue('node', target.id, 'upsert', createKnowledgeUlid(), mergedTarget.scope);
    return cloneNode(mergedTarget);
  }

  async appendKnowledge(input: AppendKnowledgeInput): Promise<KnowledgeRecord> {
    return this.#runAtomicMutation(() => this.#appendKnowledge(input));
  }

  #appendKnowledge(input: AppendKnowledgeInput): KnowledgeRecord {
    const node = nodeReferenceId(input.node);
    const parent = this.#resolveTerminalNode(node);
    if (!parent) throw new KnowledgeNotFoundError('node', node);
    const scope = canonicalizeKnowledgeScope(input.scope);
    assertKnowledgeScopeWithinCeiling(scope, input.maxScope);
    const record: KnowledgeRecord = {
      id: input.id ?? createKnowledgeUlid(),
      node: parent.id,
      text: input.text,
      scope,
      sourceThreadId: input.sourceThreadId,
      capturedAt: new Date(),
      when: input.when ? new Date(input.when) : undefined,
      maxScope: input.maxScope,
      metadata: input.metadata,
    };
    if (this.#db.knowledgeRecords.has(record.id)) throw new Error(`Knowledge already exists: ${record.id}`);
    this.#db.knowledgeRecords.set(record.id, record);
    this.#replaceMentions('record', record.id, record.text, input.resolutionScope, input.defaultScope);
    parent.updatedAt = new Date();
    this.#recordActivity('record-created', 'record', record.id, scope, input.sourceThreadId);
    this.#enqueue('record', record.id, 'upsert', record.id, scope);
    return cloneRecord(record);
  }

  async getKnowledge({
    id,
    includeDeleted = false,
  }: {
    id: string;
    includeDeleted?: boolean;
  }): Promise<KnowledgeRecord | null> {
    const record = this.#db.knowledgeRecords.get(id);
    if (!record || (record.deletedAt && !includeDeleted)) return null;
    return cloneRecord(record);
  }

  async listKnowledgeAbout(input: QueryKnowledgeInput): Promise<QueryKnowledgeOutput> {
    return this.#queryKnowledge(input, 'about');
  }

  async listKnowledgeMentioning(input: QueryKnowledgeInput): Promise<QueryKnowledgeOutput> {
    return this.#queryKnowledge(input, 'mentioning');
  }

  async listKnowledgeRelatedTo(input: QueryKnowledgeInput): Promise<QueryKnowledgeOutput> {
    return this.#queryKnowledge(input, 'related');
  }

  async knowledgeBySource(input: QueryKnowledgeBySourceInput): Promise<QueryKnowledgeOutput> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const limit = input.limit ?? 100;
    const records = [...this.#db.knowledgeRecords.values()]
      .filter(
        record =>
          record.sourceThreadId === input.sourceThreadId &&
          isKnowledgeScopeVisible(record.scope, scope) &&
          (input.includeDeleted || !record.deletedAt) &&
          (!input.after || record.id > input.after),
      )
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, limit + 1);
    return {
      records: records.slice(0, limit).map(cloneRecord),
      nextCursor: records.length > limit ? records[limit - 1]?.id : undefined,
    };
  }

  async removeKnowledge({ id, deletedBy }: { id: string; deletedBy: string }): Promise<KnowledgeRecord> {
    const record = this.#db.knowledgeRecords.get(id);
    if (!record) throw new KnowledgeNotFoundError('record', id);
    if (record.deletedAt) return cloneRecord(record);
    const updated = { ...record, deletedAt: new Date(), deletedBy };
    this.#db.knowledgeRecords.set(id, updated);
    this.#recordActivity('record-deleted', 'record', id, record.scope, record.sourceThreadId);
    this.#enqueue('record', id, 'delete', updated.deletedAt.toISOString(), record.scope);
    return cloneRecord(updated);
  }

  async restoreKnowledge({ id }: { id: string }): Promise<KnowledgeRecord> {
    const record = this.#db.knowledgeRecords.get(id);
    if (!record) throw new KnowledgeNotFoundError('record', id);
    if (!record.deletedAt) return cloneRecord(record);
    const updated = { ...record, deletedAt: undefined, deletedBy: undefined };
    this.#db.knowledgeRecords.set(id, updated);
    this.#recordActivity('record-restored', 'record', id, record.scope, record.sourceThreadId);
    this.#enqueue('record', id, 'upsert', createKnowledgeUlid(), record.scope);
    return cloneRecord(updated);
  }

  async rescopeKnowledge({ id, scope }: { id: string; scope: KnowledgeScope }): Promise<KnowledgeRecord> {
    const record = this.#db.knowledgeRecords.get(id);
    if (!record) throw new KnowledgeNotFoundError('record', id);
    const canonical = canonicalizeKnowledgeScope(scope);
    assertKnowledgeScopeWithinCeiling(canonical, record.maxScope);
    const updated = { ...record, scope: canonical };
    this.#db.knowledgeRecords.set(id, updated);
    this.#recordActivity('record-rescoped', 'record', id, canonical, record.sourceThreadId);
    if (knowledgeScopeKey(record.scope) !== knowledgeScopeKey(canonical)) {
      this.#enqueue('record', id, 'delete', createKnowledgeUlid(), record.scope);
    }
    if (!record.deletedAt) {
      this.#enqueue('record', id, 'upsert', createKnowledgeUlid(), canonical);
    }
    return cloneRecord(updated);
  }

  async raiseKnowledgeCeiling({
    id,
    maxScope,
  }: {
    id: string;
    maxScope?: KnowledgeRecord['maxScope'];
  }): Promise<KnowledgeRecord> {
    const record = this.#db.knowledgeRecords.get(id);
    if (!record) throw new KnowledgeNotFoundError('record', id);
    assertKnowledgeScopeWithinCeiling(record.scope, maxScope);
    assertKnowledgeCeilingRaised(record.maxScope, maxScope);
    const updated = { ...record, maxScope };
    this.#db.knowledgeRecords.set(id, updated);
    return cloneRecord(updated);
  }

  async search(input: SearchKnowledgeInput): Promise<SearchKnowledgeResult[]> {
    const queryScope = canonicalizeKnowledgeScope(input.scope);
    const query = input.query.trim().toLocaleLowerCase();
    if (!query) return [];
    const results: SearchKnowledgeResult[] = [];
    for (const node of await this.listNodes({ scope: queryScope, limit: Number.MAX_SAFE_INTEGER })) {
      if (
        node.name.toLocaleLowerCase().includes(query) ||
        node.kind.toLocaleLowerCase().includes(query) ||
        node.content?.toLocaleLowerCase().includes(query) ||
        node.description?.toLocaleLowerCase().includes(query)
      ) {
        // Description joins the snippet only when present so description-less results stay byte-identical.
        const parts = [
          node.name,
          ...(node.description ? [node.description] : []),
          ...(node.content ? [node.content] : []),
        ];
        results.push({
          type: 'node',
          id: node.id,
          recordId: node.id,
          name: node.name,
          text: parts.join('\n'),
          scope: [...node.scope],
        });
      }
    }
    for (const record of this.#db.knowledgeRecords.values()) {
      if (
        record.deletedAt ||
        !isKnowledgeScopeVisible(record.scope, queryScope) ||
        !record.text.toLocaleLowerCase().includes(query)
      ) {
        continue;
      }
      const parent = this.#resolveTerminalNode(record.node);
      if (!parent) continue;
      results.push({
        type: 'record',
        id: record.id,
        recordId: parent.id,
        name: parent.name,
        text: record.text,
        scope: [...record.scope],
      });
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
    lastKnowledgeId: string;
  }): Promise<KnowledgeCurationCursor> {
    const key = `${input.sourceThreadId}\u0000${input.agent}`;
    const existing = this.#db.knowledgeCursors.get(key);
    if (existing && input.lastKnowledgeId < existing.lastKnowledgeId)
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
      .filter(event => !input.after || event.id < input.after)
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
      .map(cloneSemanticOutboxEntry);
  }

  async claimSemanticOutbox(input: ClaimKnowledgeSemanticOutboxInput): Promise<KnowledgeSemanticOutboxEntry[]> {
    const now = input.now ? new Date(input.now) : new Date();
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
      .filter(
        entry =>
          ![...this.#db.knowledgeSemanticOutbox.values()].some(
            earlier =>
              earlier.documentId === entry.documentId &&
              earlier.status !== 'completed' &&
              (earlier.createdAt < entry.createdAt ||
                (earlier.createdAt.getTime() === entry.createdAt.getTime() && earlier.id < entry.id)),
          ),
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
      .slice(0, input.limit ?? 100);
    for (const entry of claimed) {
      entry.status = 'processing';
      entry.claimedAt = now;
      entry.claimedBy = input.workerId;
      entry.attempts += 1;
    }
    return claimed.map(cloneSemanticOutboxEntry);
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
        entry.availableAt = retryAt ? new Date(retryAt) : new Date();
        entry.claimedAt = undefined;
        entry.claimedBy = undefined;
      }
    }
  }

  #runAtomicMutation<T>(mutation: () => T): T {
    const snapshot = {
      nodes: new Map([...this.#db.knowledgeNodes].map(([id, node]) => [id, cloneNode(node)])),
      nodeKeys: new Map(this.#db.knowledgeNodeKeys),
      records: new Map([...this.#db.knowledgeRecords].map(([id, record]) => [id, cloneRecord(record)])),
      mentions: new Map([...this.#db.knowledgeMentions].map(([key, mentions]) => [key, new Set(mentions)])),
      activity: this.#db.knowledgeActivity.map(event => ({
        ...event,
        scope: [...event.scope],
        createdAt: new Date(event.createdAt),
      })),
      outbox: new Map(
        [...this.#db.knowledgeSemanticOutbox].map(([id, entry]) => [id, cloneSemanticOutboxEntry(entry)]),
      ),
      idempotency: new Map(this.#db.knowledgeSemanticIdempotency),
    };

    try {
      return mutation();
    } catch (error) {
      this.#db.knowledgeNodes.clear();
      snapshot.nodes.forEach((node, id) => this.#db.knowledgeNodes.set(id, node));
      this.#db.knowledgeNodeKeys.clear();
      snapshot.nodeKeys.forEach((id, key) => this.#db.knowledgeNodeKeys.set(key, id));
      this.#db.knowledgeRecords.clear();
      snapshot.records.forEach((record, id) => this.#db.knowledgeRecords.set(id, record));
      this.#db.knowledgeMentions.clear();
      snapshot.mentions.forEach((mentions, key) => this.#db.knowledgeMentions.set(key, mentions));
      this.#db.knowledgeActivity.splice(0, this.#db.knowledgeActivity.length, ...snapshot.activity);
      this.#db.knowledgeSemanticOutbox.clear();
      snapshot.outbox.forEach((entry, id) => this.#db.knowledgeSemanticOutbox.set(id, entry));
      this.#db.knowledgeSemanticIdempotency.clear();
      snapshot.idempotency.forEach((id, key) => this.#db.knowledgeSemanticIdempotency.set(key, id));
      throw error;
    }
  }

  #resolveTerminalNode(id: string): KnowledgeNode | null {
    let node = this.#db.knowledgeNodes.get(id);
    const seen = new Set<string>();
    while (node?.mergedInto) {
      if (seen.has(node.id)) throw new Error(`Knowledge merge cycle detected at ${node.id}`);
      seen.add(node.id);
      node = this.#db.knowledgeNodes.get(node.mergedInto);
    }
    return node ?? null;
  }

  #replaceMentions(
    sourceType: KnowledgeMention['sourceType'],
    sourceId: string,
    text: string,
    resolutionScope: KnowledgeScope,
    defaultScope: KnowledgeScope,
  ): void {
    const mentions = new Set<string>();
    for (const name of parseKnowledgeWikilinks(text)) {
      let node = this.#resolveNode({ name, scope: resolutionScope });
      node ??= this.#createNode({ name, kind: 'node', scope: defaultScope });
      mentions.add(node.id);
    }
    this.#db.knowledgeMentions.set(`${sourceType}:${sourceId}`, mentions);
  }

  #queryKnowledge(input: QueryKnowledgeInput, relationship: 'about' | 'mentioning' | 'related'): QueryKnowledgeOutput {
    const queryScope = canonicalizeKnowledgeScope(input.scope);
    const terminal = this.#resolveTerminalNode(nodeReferenceId(input.node));
    if (!terminal) return { records: [] };
    return this.#paginateKnowledge(
      [...this.#db.knowledgeRecords.values()].filter(record => {
        const about = record.node === terminal.id;
        const mentioning = this.#db.knowledgeMentions.get(`record:${record.id}`)?.has(terminal.id) ?? false;
        if (relationship === 'about') return about;
        if (relationship === 'mentioning') return mentioning;
        return about || mentioning;
      }),
      { ...input, scope: queryScope },
    );
  }

  #paginateKnowledge(records: KnowledgeRecord[], input: QueryKnowledgeInput): QueryKnowledgeOutput {
    const filtered = records
      .filter(record => input.includeDeleted || !record.deletedAt)
      .filter(record => isKnowledgeScopeVisible(record.scope, input.scope))
      .filter(record => !input.after || record.id < input.after)
      .sort((a, b) => b.id.localeCompare(a.id));
    const limit = input.limit ?? 100;
    const page = filtered.slice(0, limit);
    return {
      records: page.map(cloneRecord),
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
