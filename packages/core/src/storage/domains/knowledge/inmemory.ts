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
  parseKnowledgeNodeCursor,
  parseKnowledgeWikilinks,
} from './base';
import type {
  AppendKnowledgeItemInput,
  ClaimKnowledgeSemanticOutboxInput,
  CreateKnowledgeNodeInput,
  KnowledgeActivityAction,
  KnowledgeActivityEvent,
  KnowledgeCurationCursor,
  KnowledgeNode,
  KnowledgeItem,
  KnowledgeMention,
  KnowledgeScope,
  KnowledgeSemanticDocumentType,
  KnowledgeSemanticOperation,
  KnowledgeSemanticOutboxEntry,
  ListKnowledgeItemsInput,
  ListKnowledgeItemsOutput,
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

function cloneItem(item: KnowledgeItem): KnowledgeItem {
  return {
    ...item,
    scope: [...item.scope],
    capturedAt: new Date(item.capturedAt),
    when: item.when ? new Date(item.when) : undefined,
    deletedAt: item.deletedAt ? new Date(item.deletedAt) : undefined,
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
    this.#db.knowledgeItems.clear();
    this.#db.knowledgeMentions.clear();
    this.#db.knowledgeCursors.clear();
    this.#db.knowledgeActivity.length = 0;
    this.#db.knowledgeSemanticOutbox.clear();
    this.#db.knowledgeSemanticIdempotency.clear();
  }

  async createNode(input: CreateKnowledgeNodeInput): Promise<KnowledgeNode> {
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
      scope,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    if (this.#db.knowledgeNodes.has(node.id)) throw new Error(`Knowledge node already exists: ${node.id}`);
    this.#db.knowledgeNodes.set(node.id, node);
    this.#db.knowledgeNodeKeys.set(key, node.id);
    await this.#replaceMentions('node', node.id, node.content ?? '', input.resolutionScope ?? scope, scope);
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

  async resolveNode({ name, scope }: { name: string; scope: KnowledgeScope }): Promise<KnowledgeNode | null> {
    const canonical = canonicalizeKnowledgeScope(scope);
    for (let length = canonical.length; length > 0; length--) {
      const node = await this.getNodeByName({ name, scope: canonical.slice(0, length) });
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
      await this.#replaceMentions('node', input.id, updated.content ?? '', input.resolutionScope ?? scope, scope);
    }
    this.#recordActivity('node-updated', 'node', input.id, scope);
    const scopeChanged = knowledgeScopeKey(existing.scope) !== knowledgeScopeKey(scope);
    if (scopeChanged) {
      this.#enqueue('node', input.id, 'delete', createKnowledgeUlid(), existing.scope);
      for (const item of this.#db.knowledgeItems.values()) {
        if (item.parentNodeId !== input.id) continue;
        this.#enqueue('item', item.id, 'delete', createKnowledgeUlid(), item.scope);
        if (!item.deletedAt) this.#enqueue('item', item.id, 'upsert', createKnowledgeUlid(), item.scope);
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
    if (!isKnowledgeScopeVisible(target.scope, source.scope)) {
      throw new Error('Cannot merge a knowledge node into a target that is narrower than its source scope');
    }

    for (const [id, item] of this.#db.knowledgeItems) {
      if (item.parentNodeId === source.id) {
        this.#db.knowledgeItems.set(id, { ...item, parentNodeId: target.id });
        this.#enqueue('item', id, item.deletedAt ? 'delete' : 'upsert', createKnowledgeUlid(), item.scope);
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
        if (sourceType === 'item') {
          const item = this.#db.knowledgeItems.get(sourceId);
          if (item)
            this.#enqueue('item', sourceId, item.deletedAt ? 'delete' : 'upsert', createKnowledgeUlid(), item.scope);
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
    this.#recordActivity('node-merged', 'node', source.id, source.scope);
    this.#enqueue('node', source.id, 'delete', updatedSource.version, source.scope);
    this.#enqueue('node', target.id, 'upsert', createKnowledgeUlid(), target.scope);
    return cloneNode(target);
  }

  async appendItem(input: AppendKnowledgeItemInput): Promise<KnowledgeItem> {
    const parent = this.#resolveTerminalNode(input.parentNodeId);
    if (!parent) throw new KnowledgeNotFoundError('node', input.parentNodeId);
    const scope = canonicalizeKnowledgeScope(input.scope);
    assertKnowledgeScopeWithinCeiling(scope, input.maxScope);
    const item: KnowledgeItem = {
      id: input.id ?? createKnowledgeUlid(),
      parentNodeId: parent.id,
      text: input.text,
      scope,
      sourceThreadId: input.sourceThreadId,
      capturedAt: new Date(),
      when: input.when ? new Date(input.when) : undefined,
      maxScope: input.maxScope,
    };
    if (this.#db.knowledgeItems.has(item.id)) throw new Error(`Knowledge item already exists: ${item.id}`);
    this.#db.knowledgeItems.set(item.id, item);
    await this.#replaceMentions('item', item.id, item.text, input.resolutionScope, input.defaultScope);
    parent.updatedAt = new Date();
    this.#recordActivity('item-created', 'item', item.id, scope, input.sourceThreadId);
    this.#enqueue('item', item.id, 'upsert', item.id, scope);
    return cloneItem(item);
  }

  async getItem({
    id,
    includeDeleted = false,
  }: {
    id: string;
    includeDeleted?: boolean;
  }): Promise<KnowledgeItem | null> {
    const item = this.#db.knowledgeItems.get(id);
    if (!item || (item.deletedAt && !includeDeleted)) return null;
    return cloneItem(item);
  }

  async itemsAbout(input: ListKnowledgeItemsInput): Promise<ListKnowledgeItemsOutput> {
    const queryScope = canonicalizeKnowledgeScope(input.scope);
    const terminal = this.#resolveTerminalNode(input.nodeId);
    if (!terminal) return { items: [] };
    return this.#paginateItems(
      [...this.#db.knowledgeItems.values()].filter(item => item.parentNodeId === terminal.id),
      { ...input, scope: queryScope },
    );
  }

  async itemsTouching(input: ListKnowledgeItemsInput): Promise<ListKnowledgeItemsOutput> {
    const queryScope = canonicalizeKnowledgeScope(input.scope);
    const terminal = this.#resolveTerminalNode(input.nodeId);
    if (!terminal) return { items: [] };
    return this.#paginateItems(
      [...this.#db.knowledgeItems.values()].filter(
        item =>
          item.parentNodeId === terminal.id || this.#db.knowledgeMentions.get(`item:${item.id}`)?.has(terminal.id),
      ),
      { ...input, scope: queryScope },
    );
  }

  async removeItem({ id, deletedBy }: { id: string; deletedBy: string }): Promise<KnowledgeItem> {
    const item = this.#db.knowledgeItems.get(id);
    if (!item) throw new KnowledgeNotFoundError('item', id);
    if (item.deletedAt) return cloneItem(item);
    const updated = { ...item, deletedAt: new Date(), deletedBy };
    this.#db.knowledgeItems.set(id, updated);
    this.#recordActivity('item-deleted', 'item', id, item.scope, item.sourceThreadId);
    this.#enqueue('item', id, 'delete', updated.deletedAt.toISOString(), item.scope);
    return cloneItem(updated);
  }

  async restoreItem({ id }: { id: string }): Promise<KnowledgeItem> {
    const item = this.#db.knowledgeItems.get(id);
    if (!item) throw new KnowledgeNotFoundError('item', id);
    if (!item.deletedAt) return cloneItem(item);
    const updated = { ...item, deletedAt: undefined, deletedBy: undefined };
    this.#db.knowledgeItems.set(id, updated);
    this.#recordActivity('item-restored', 'item', id, item.scope, item.sourceThreadId);
    this.#enqueue('item', id, 'upsert', createKnowledgeUlid(), item.scope);
    return cloneItem(updated);
  }

  async rescopeItem({ id, scope }: { id: string; scope: KnowledgeScope }): Promise<KnowledgeItem> {
    const item = this.#db.knowledgeItems.get(id);
    if (!item) throw new KnowledgeNotFoundError('item', id);
    const canonical = canonicalizeKnowledgeScope(scope);
    assertKnowledgeScopeWithinCeiling(canonical, item.maxScope);
    const updated = { ...item, scope: canonical };
    this.#db.knowledgeItems.set(id, updated);
    this.#recordActivity('item-rescoped', 'item', id, canonical, item.sourceThreadId);
    if (knowledgeScopeKey(item.scope) !== knowledgeScopeKey(canonical)) {
      this.#enqueue('item', id, 'delete', createKnowledgeUlid(), item.scope);
    }
    if (!item.deletedAt) {
      this.#enqueue('item', id, 'upsert', createKnowledgeUlid(), canonical);
    }
    return cloneItem(updated);
  }

  async raiseCeiling({ id, maxScope }: { id: string; maxScope?: KnowledgeItem['maxScope'] }): Promise<KnowledgeItem> {
    const item = this.#db.knowledgeItems.get(id);
    if (!item) throw new KnowledgeNotFoundError('item', id);
    const updated = { ...item, maxScope };
    this.#db.knowledgeItems.set(id, updated);
    return cloneItem(updated);
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
        node.content?.toLocaleLowerCase().includes(query)
      ) {
        results.push({
          type: 'node',
          id: node.id,
          recordId: node.id,
          name: node.name,
          text: node.content ? `${node.name}\n${node.content}` : node.name,
          scope: node.scope,
        });
      }
    }
    for (const item of this.#db.knowledgeItems.values()) {
      if (
        item.deletedAt ||
        !isKnowledgeScopeVisible(item.scope, queryScope) ||
        !item.text.toLocaleLowerCase().includes(query)
      ) {
        continue;
      }
      const parent = this.#resolveTerminalNode(item.parentNodeId);
      if (!parent) continue;
      results.push({
        type: 'item',
        id: item.id,
        recordId: parent.id,
        name: parent.name,
        text: item.text,
        scope: item.scope,
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
    lastItemId: string;
  }): Promise<KnowledgeCurationCursor> {
    const key = `${input.sourceThreadId}\u0000${input.agent}`;
    const existing = this.#db.knowledgeCursors.get(key);
    if (existing && input.lastItemId < existing.lastItemId)
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

  async #replaceMentions(
    sourceType: KnowledgeMention['sourceType'],
    sourceId: string,
    text: string,
    resolutionScope: KnowledgeScope,
    defaultScope: KnowledgeScope,
  ): Promise<void> {
    const mentions = new Set<string>();
    for (const name of parseKnowledgeWikilinks(text)) {
      let node = await this.resolveNode({ name, scope: resolutionScope });
      node ??= await this.createNode({ name, kind: 'node', scope: defaultScope });
      mentions.add(node.id);
    }
    this.#db.knowledgeMentions.set(`${sourceType}:${sourceId}`, mentions);
  }

  #paginateItems(items: KnowledgeItem[], input: ListKnowledgeItemsInput): ListKnowledgeItemsOutput {
    const filtered = items
      .filter(item => input.includeDeleted || !item.deletedAt)
      .filter(item => isKnowledgeScopeVisible(item.scope, input.scope))
      .filter(item => !input.after || item.id < input.after)
      .sort((a, b) => b.id.localeCompare(a.id));
    const limit = input.limit ?? 100;
    const page = filtered.slice(0, limit);
    return {
      items: page.map(cloneItem),
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
