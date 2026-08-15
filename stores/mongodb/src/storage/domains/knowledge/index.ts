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
  TABLE_KNOWLEDGE_ACTIVITY,
  TABLE_KNOWLEDGE_CURSORS,
  TABLE_KNOWLEDGE_ITEMS,
  TABLE_KNOWLEDGE_MENTIONS,
  TABLE_KNOWLEDGE_RECORDS,
  TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
} from '@mastra/core/storage';
import type {
  AppendKnowledgeItemInput,
  ClaimKnowledgeSemanticOutboxInput,
  CreateKnowledgeNodeInput,
  KnowledgeActivityAction,
  KnowledgeActivityEvent,
  KnowledgeCurationCursor,
  KnowledgeNode,
  KnowledgeItem,
  KnowledgeScope,
  KnowledgeSemanticDocumentType,
  KnowledgeSemanticOperation,
  KnowledgeSemanticOutboxEntry,
  ListKnowledgeItemsBySourceInput,
  ListKnowledgeItemsInput,
  ListKnowledgeItemsOutput,
  ListKnowledgeNodesInput,
  SearchKnowledgeInput,
  SearchKnowledgeResult,
  UpdateKnowledgeNodeInput,
} from '@mastra/core/storage';
import type { ClientSession, Collection, Filter } from 'mongodb';

import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig } from '../../types';

type Document = Record<string, any>;

const cloneScope = (scope: KnowledgeScope): KnowledgeScope => [...scope];
const canonicalName = (name: string) => name.trim().toLocaleLowerCase();
const sessionOptions = (session?: ClientSession) => (session ? { session } : {});

function visibleScopeKeys(scope: KnowledgeScope): string[] {
  const canonical = canonicalizeKnowledgeScope(scope);
  return canonical.map((_, index) => knowledgeScopeKey(canonical.slice(0, index + 1)));
}

function recordCursorFilter(cursor: string, expected: { namePrefix?: string; kind?: string; hasContent?: boolean }) {
  const parsed = parseKnowledgeNodeCursor(cursor, expected);
  return {
    $or: [
      { updatedAt: { $lt: parsed.updatedAt } },
      {
        updatedAt: parsed.updatedAt,
        $or: [{ name: { $gt: parsed.name } }, { name: parsed.name, id: { $gt: parsed.id } }],
      },
    ],
  };
}

function nodeFromDocument(row: Document): KnowledgeNode {
  return {
    id: String(row.id),
    type: 'node',
    name: String(row.name),
    kind: String(row.kind),
    content: row.content == null ? undefined : String(row.content),
    scope: cloneScope(row.scope),
    version: Number(row.version),
    mergedInto: row.mergedInto ?? undefined,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function itemFromDocument(row: Document): KnowledgeItem {
  return {
    id: String(row.id),
    parentNodeId: String(row.parentNodeId),
    text: String(row.text),
    scope: cloneScope(row.scope),
    sourceThreadId: String(row.sourceThreadId),
    capturedAt: new Date(row.capturedAt),
    when: row.when ? new Date(row.when) : undefined,
    maxScope: row.maxScope ?? undefined,
    metadata: row.metadata ?? undefined,
    deletedAt: row.deletedAt ? new Date(row.deletedAt) : undefined,
    deletedBy: row.deletedBy ?? undefined,
  };
}

function outboxFromDocument(row: Document): KnowledgeSemanticOutboxEntry {
  return {
    id: String(row.id),
    idempotencyKey: String(row.idempotencyKey),
    documentId: String(row.documentId),
    documentType: row.documentType,
    operation: row.operation,
    scope: cloneScope(row.scope),
    status: row.status,
    attempts: Number(row.attempts),
    availableAt: new Date(row.availableAt),
    claimedAt: row.claimedAt ? new Date(row.claimedAt) : undefined,
    claimedBy: row.claimedBy ?? undefined,
    createdAt: new Date(row.createdAt),
    completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
  };
}

export class KnowledgeMongoDB extends KnowledgeStorage {
  static readonly MANAGED_COLLECTIONS = [
    TABLE_KNOWLEDGE_RECORDS,
    TABLE_KNOWLEDGE_ITEMS,
    TABLE_KNOWLEDGE_MENTIONS,
    TABLE_KNOWLEDGE_CURSORS,
    TABLE_KNOWLEDGE_ACTIVITY,
    TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
  ] as const;

  readonly #connector: MongoDBConnector;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
  }

  async init(): Promise<void> {
    const records = await this.#collection(TABLE_KNOWLEDGE_RECORDS);
    const facts = await this.#collection(TABLE_KNOWLEDGE_ITEMS);
    const mentions = await this.#collection(TABLE_KNOWLEDGE_MENTIONS);
    const cursors = await this.#collection(TABLE_KNOWLEDGE_CURSORS);
    const activity = await this.#collection(TABLE_KNOWLEDGE_ACTIVITY);
    const outbox = await this.#collection(TABLE_KNOWLEDGE_SEMANTIC_OUTBOX);
    await Promise.all([
      records.createIndex({ type: 1, scopeKey: 1, canonicalName: 1 }, { unique: true }),
      records.createIndex({ scopeKey: 1, type: 1 }),
      facts.createIndex({ parentNodeId: 1, id: -1 }),
      facts.createIndex({ sourceThreadId: 1, id: -1 }),
      mentions.createIndex({ sourceType: 1, sourceId: 1, recordId: 1 }, { unique: true }),
      mentions.createIndex({ recordId: 1, sourceType: 1, sourceId: 1 }),
      cursors.createIndex({ sourceThreadId: 1, agent: 1 }, { unique: true }),
      activity.createIndex({ id: -1 }),
      outbox.createIndex({ idempotencyKey: 1 }, { unique: true }),
      outbox.createIndex({ status: 1, availableAt: 1, createdAt: 1 }),
    ]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#connector.withTransaction(async session => {
      for (const name of KnowledgeMongoDB.MANAGED_COLLECTIONS) {
        await (await this.#collection(name)).deleteMany({}, sessionOptions(session));
      }
    });
  }

  async createNode(input: CreateKnowledgeNodeInput): Promise<KnowledgeNode> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    return this.#connector.withTransaction(async session => {
      const existing = await this.#getNodeByName(input.name, scope, session);
      if (existing) {
        const terminal = (await this.#resolveTerminalNode(existing.id, session))!;
        if (!isKnowledgeScopeVisible(terminal.scope, scope)) {
          throw new Error(`Merged knowledge entity is not visible from scope: ${input.name}`);
        }
        return terminal;
      }
      const now = new Date();
      const entity: KnowledgeNode = {
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
      try {
        await (
          await this.#records()
        ).insertOne(
          {
            ...entity,
            canonicalName: canonicalName(entity.name),
            scopeKey: knowledgeScopeKey(scope),
            mergedInto: null,
          },
          sessionOptions(session),
        );
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        const concurrent = await this.#getNodeByName(input.name, scope, session);
        if (!concurrent) throw error;
        return (await this.#resolveTerminalNode(concurrent.id, session))!;
      }
      await this.#replaceMentions(
        'node',
        entity.id,
        entity.content ?? '',
        input.resolutionScope ?? scope,
        scope,
        session,
      );
      await this.#activity('node-created', 'node', entity.id, scope, undefined, session);
      await this.#outbox('node', entity.id, 'upsert', 1, scope, session);
      return entity;
    });
  }

  async getNode(id: string): Promise<KnowledgeNode | null> {
    return this.#getNode(id);
  }

  async getNodeByName(input: { name: string; scope: KnowledgeScope }): Promise<KnowledgeNode | null> {
    return this.#getNodeByName(input.name, canonicalizeKnowledgeScope(input.scope));
  }

  async resolveNode(input: { name: string; scope: KnowledgeScope }): Promise<KnowledgeNode | null> {
    return this.#resolveNode(input.name, canonicalizeKnowledgeScope(input.scope));
  }

  async listNodes(input: ListKnowledgeNodesInput): Promise<KnowledgeNode[]> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const filter: Filter<Document> = {
      type: 'node',
      mergedInto: null,
      scopeKey: { $in: visibleScopeKeys(scope) },
      ...(input.namePrefix
        ? { canonicalName: { $regex: `^${this.#escapeRegex(canonicalName(input.namePrefix))}` } }
        : {}),
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.hasContent === undefined
        ? {}
        : input.hasContent
          ? { content: { $exists: true, $nin: [null, ''] } }
          : { $or: [{ content: { $exists: false } }, { content: null }, { content: '' }] }),
      ...(input.cursor
        ? recordCursorFilter(input.cursor, {
            namePrefix: input.namePrefix,
            kind: input.kind,
            hasContent: input.hasContent,
          })
        : {}),
    };
    const rows = await (
      await this.#records()
    )
      .find(filter)
      .sort({ updatedAt: -1, name: 1, id: 1 })
      .limit(input.limit ?? 100)
      .toArray();
    return rows.map(nodeFromDocument);
  }

  async updateNode(input: UpdateKnowledgeNodeInput): Promise<KnowledgeNode> {
    return this.#connector.withTransaction(async session => {
      const existing = await this.#getNode(input.id, session);
      if (!existing) throw new KnowledgeNotFoundError('node', input.id);
      if (existing.mergedInto) throw new Error(`Cannot update merged knowledge entity: ${input.id}`);
      const scope = input.scope ? canonicalizeKnowledgeScope(input.scope) : existing.scope;
      const name = input.name?.trim() ?? existing.name;
      const content = input.content ?? existing.content;
      const now = new Date();
      const result = await (
        await this.#records()
      ).findOneAndUpdate(
        { id: input.id, type: 'node', version: input.version },
        {
          $set: {
            name,
            canonicalName: canonicalName(name),
            kind: input.kind ?? existing.kind,
            content: content ?? null,
            scope,
            scopeKey: knowledgeScopeKey(scope),
            updatedAt: now,
          },
          $inc: { version: 1 },
        },
        { ...sessionOptions(session), returnDocument: 'after' },
      );
      if (!result) throw new KnowledgeConflictError(input.id);
      if (input.content !== undefined || input.name !== undefined || input.scope !== undefined) {
        await this.#replaceMentions('node', input.id, content ?? '', input.resolutionScope ?? scope, scope, session);
      }
      if (knowledgeScopeKey(scope) !== knowledgeScopeKey(existing.scope)) {
        await this.#outbox('node', input.id, 'delete', createKnowledgeUlid(), existing.scope, session);
        const facts = await (await this.#items()).find({ parentNodeId: input.id }, sessionOptions(session)).toArray();
        for (const fact of facts) {
          await this.#outbox('item', fact.id, 'delete', createKnowledgeUlid(), fact.scope, session);
          if (!fact.deletedAt)
            await this.#outbox('item', fact.id, 'upsert', createKnowledgeUlid(), fact.scope, session);
        }
      }
      await this.#activity('node-updated', 'node', input.id, scope, undefined, session);
      await this.#outbox('node', input.id, 'upsert', Number(result.version), scope, session);
      return nodeFromDocument(result);
    });
  }

  async mergeNodes(input: { sourceId: string; targetId: string; sourceVersion: number }): Promise<KnowledgeNode> {
    if (input.sourceId === input.targetId) throw new Error('Cannot merge a knowledge entity into itself');
    return this.#connector.withTransaction(async session => {
      const source = await this.#getNode(input.sourceId, session);
      if (!source) throw new KnowledgeNotFoundError('node', input.sourceId);
      const target = await this.#resolveTerminalNode(input.targetId, session);
      if (!target) throw new KnowledgeNotFoundError('node', input.targetId);
      if (target.id === source.id) throw new Error('Cannot create a knowledge merge cycle');
      if (!isKnowledgeScopeVisible(target.scope, source.scope)) {
        throw new Error('Cannot merge a knowledge entity into a target that is narrower than its source scope');
      }
      const mentions = await this.#mentions();
      const affected = await mentions.find({ recordId: source.id }, sessionOptions(session)).toArray();
      const movedFacts = await (
        await this.#items()
      )
        .find({ parentNodeId: source.id }, sessionOptions(session))
        .toArray();
      const updated = await (
        await this.#records()
      ).updateOne(
        { id: source.id, type: 'node', version: input.sourceVersion, mergedInto: null },
        { $set: { mergedInto: target.id, updatedAt: new Date() }, $inc: { version: 1 } },
        sessionOptions(session),
      );
      if (updated.modifiedCount === 0) throw new KnowledgeConflictError(source.id);
      await (
        await this.#items()
      ).updateMany({ parentNodeId: source.id }, { $set: { parentNodeId: target.id } }, sessionOptions(session));
      for (const mention of affected) {
        const duplicate = await mentions.findOne(
          { sourceType: mention.sourceType, sourceId: mention.sourceId, recordId: target.id },
          sessionOptions(session),
        );
        if (duplicate) await mentions.deleteOne({ _id: mention._id }, sessionOptions(session));
        else await mentions.updateOne({ _id: mention._id }, { $set: { recordId: target.id } }, sessionOptions(session));
      }
      for (const fact of movedFacts) {
        if (!fact.deletedAt) await this.#outbox('item', fact.id, 'upsert', createKnowledgeUlid(), fact.scope, session);
      }
      for (const mention of affected) {
        const scope =
          mention.sourceType === 'item'
            ? (await (await this.#items()).findOne({ id: mention.sourceId }, sessionOptions(session)))?.scope
            : (await (await this.#records()).findOne({ id: mention.sourceId, type: 'node' }, sessionOptions(session)))
                ?.scope;
        if (scope)
          await this.#outbox(mention.sourceType, mention.sourceId, 'upsert', createKnowledgeUlid(), scope, session);
      }
      await this.#activity('node-merged', 'node', source.id, source.scope, undefined, session);
      await this.#outbox('node', source.id, 'delete', input.sourceVersion + 1, source.scope, session);
      return target;
    });
  }

  async appendItem(input: AppendKnowledgeItemInput): Promise<KnowledgeItem> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const defaultScope = canonicalizeKnowledgeScope(input.defaultScope);
    assertKnowledgeScopeWithinCeiling(scope, input.maxScope);
    return this.#connector.withTransaction(async session => {
      const parent = await this.#resolveTerminalNode(input.parentNodeId, session);
      if (!parent) throw new KnowledgeNotFoundError('node', input.parentNodeId);
      const id = input.id ?? createKnowledgeUlid();
      const existing = await (await this.#items()).findOne({ id }, sessionOptions(session));
      if (existing) return itemFromDocument(existing);
      const fact: KnowledgeItem = {
        id,
        parentNodeId: parent.id,
        text: input.text,
        scope,
        sourceThreadId: input.sourceThreadId,
        capturedAt: new Date(),
        when: input.when,
        maxScope: input.maxScope,
        metadata: input.metadata,
      };
      await (
        await this.#items()
      ).insertOne(
        {
          ...fact,
          scopeKey: knowledgeScopeKey(scope),
          when: fact.when ?? null,
          maxScope: fact.maxScope ?? null,
          deletedAt: null,
          deletedBy: null,
        },
        sessionOptions(session),
      );
      await this.#replaceMentions('item', id, fact.text, input.resolutionScope, defaultScope, session);
      await this.#activity('item-created', 'item', id, scope, input.sourceThreadId, session);
      await this.#outbox('item', id, 'upsert', createKnowledgeUlid(), scope, session);
      return fact;
    });
  }

  async getItem(input: { id: string; includeDeleted?: boolean }): Promise<KnowledgeItem | null> {
    const row = await (
      await this.#items()
    ).findOne({ id: input.id, ...(input.includeDeleted ? {} : { deletedAt: null }) });
    return row ? itemFromDocument(row) : null;
  }

  async itemsAbout(input: ListKnowledgeItemsInput): Promise<ListKnowledgeItemsOutput> {
    return this.#listFacts(input, false);
  }

  async itemsTouching(input: ListKnowledgeItemsInput): Promise<ListKnowledgeItemsOutput> {
    return this.#listFacts(input, true);
  }

  async listItemsBySource(input: ListKnowledgeItemsBySourceInput): Promise<ListKnowledgeItemsOutput> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const limit = input.limit ?? 100;
    const rows = await (
      await this.#items()
    )
      .find({
        sourceThreadId: input.sourceThreadId,
        scopeKey: { $in: visibleScopeKeys(scope) },
        ...(input.includeDeleted ? {} : { deletedAt: null }),
        ...(input.after ? { id: { $gt: input.after } } : {}),
      })
      .sort({ id: 1 })
      .limit(limit + 1)
      .toArray();
    return {
      items: rows.slice(0, limit).map(itemFromDocument),
      nextCursor: rows.length > limit ? rows[limit - 1]?.id : undefined,
    };
  }

  async removeItem(input: { id: string; deletedBy: string }): Promise<KnowledgeItem> {
    return this.#connector.withTransaction(async session => {
      const fact = await this.#getItem(input.id, true, session);
      if (!fact) throw new KnowledgeNotFoundError('item', input.id);
      if (fact.deletedAt) return fact;
      const deletedAt = new Date();
      await (
        await this.#items()
      ).updateOne(
        { id: input.id, deletedAt: null },
        { $set: { deletedAt, deletedBy: input.deletedBy } },
        sessionOptions(session),
      );
      await this.#activity('item-deleted', 'item', input.id, fact.scope, fact.sourceThreadId, session);
      await this.#outbox('item', input.id, 'delete', createKnowledgeUlid(), fact.scope, session);
      return { ...fact, deletedAt, deletedBy: input.deletedBy };
    });
  }

  async restoreItem(input: { id: string }): Promise<KnowledgeItem> {
    return this.#connector.withTransaction(async session => {
      const fact = await this.#getItem(input.id, true, session);
      if (!fact) throw new KnowledgeNotFoundError('item', input.id);
      if (!fact.deletedAt) return fact;
      await (
        await this.#items()
      ).updateOne({ id: input.id }, { $set: { deletedAt: null, deletedBy: null } }, sessionOptions(session));
      await this.#activity('item-restored', 'item', input.id, fact.scope, fact.sourceThreadId, session);
      await this.#outbox('item', input.id, 'upsert', createKnowledgeUlid(), fact.scope, session);
      return { ...fact, deletedAt: undefined, deletedBy: undefined };
    });
  }

  async rescopeItem(input: { id: string; scope: KnowledgeScope }): Promise<KnowledgeItem> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    return this.#connector.withTransaction(async session => {
      const fact = await this.#getItem(input.id, true, session);
      if (!fact) throw new KnowledgeNotFoundError('item', input.id);
      assertKnowledgeScopeWithinCeiling(scope, fact.maxScope);
      await (
        await this.#items()
      ).updateOne({ id: input.id }, { $set: { scope, scopeKey: knowledgeScopeKey(scope) } }, sessionOptions(session));
      await this.#activity('item-rescoped', 'item', input.id, scope, fact.sourceThreadId, session);
      await this.#outbox('item', input.id, 'delete', createKnowledgeUlid(), fact.scope, session);
      if (!fact.deletedAt) await this.#outbox('item', input.id, 'upsert', createKnowledgeUlid(), scope, session);
      return { ...fact, scope };
    });
  }

  async raiseCeiling(input: { id: string; maxScope?: KnowledgeItem['maxScope'] }): Promise<KnowledgeItem> {
    const fact = await this.#getItem(input.id, true);
    if (!fact) throw new KnowledgeNotFoundError('item', input.id);
    assertKnowledgeScopeWithinCeiling(fact.scope, input.maxScope);
    await (await this.#items()).updateOne({ id: input.id }, { $set: { maxScope: input.maxScope ?? null } });
    return { ...fact, maxScope: input.maxScope };
  }

  async search(input: SearchKnowledgeInput): Promise<SearchKnowledgeResult[]> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const query = input.query.trim();
    if (!query) return [];
    const regex = new RegExp(this.#escapeRegex(query), 'i');
    const limit = input.limit ?? 20;
    const records = await (
      await this.#records()
    )
      .find({
        mergedInto: null,
        scopeKey: { $in: visibleScopeKeys(scope) },
        $or: [{ name: regex }, { kind: regex }, { content: regex }],
      })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();
    const results: SearchKnowledgeResult[] = records.map(row => ({
      type: 'node',
      id: row.id,
      recordId: row.id,
      name: row.name,
      text: row.content ? `${row.name}\n${row.content}` : row.name,
      scope: cloneScope(row.scope),
    }));
    if (results.length < limit) {
      const facts = await (
        await this.#items()
      )
        .find({ deletedAt: null, scopeKey: { $in: visibleScopeKeys(scope) }, text: regex })
        .sort({ id: -1 })
        .limit(limit - results.length)
        .toArray();
      for (const fact of facts) {
        const parent = await this.#resolveTerminalNode(fact.parentNodeId);
        const parentVisible = parent && isKnowledgeScopeVisible(parent.scope, scope);
        results.push({
          type: 'item',
          id: fact.id,
          recordId: parentVisible ? fact.parentNodeId : fact.id,
          name: parentVisible ? parent.name : '(private entity)',
          text: fact.text,
          scope: cloneScope(fact.scope),
        });
      }
    }
    return results.slice(0, limit);
  }

  async getCurationCursor(input: { sourceThreadId: string; agent: string }): Promise<KnowledgeCurationCursor | null> {
    const row = await (await this.#cursors()).findOne(input);
    return row
      ? {
          sourceThreadId: row.sourceThreadId,
          agent: row.agent,
          lastItemId: row.lastItemId,
          updatedAt: new Date(row.updatedAt),
        }
      : null;
  }

  async advanceCurationCursor(input: {
    sourceThreadId: string;
    agent: string;
    lastItemId: string;
  }): Promise<KnowledgeCurationCursor> {
    const row = await (
      await this.#cursors()
    ).findOneAndUpdate(
      { sourceThreadId: input.sourceThreadId, agent: input.agent },
      {
        $max: { lastItemId: input.lastItemId },
        $set: { updatedAt: new Date() },
        $setOnInsert: { sourceThreadId: input.sourceThreadId, agent: input.agent },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return {
      sourceThreadId: row!.sourceThreadId,
      agent: row!.agent,
      lastItemId: row!.lastItemId,
      updatedAt: new Date(row!.updatedAt),
    };
  }

  async listActivity(input: {
    scope: KnowledgeScope;
    after?: string;
    limit?: number;
  }): Promise<KnowledgeActivityEvent[]> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const rows = await (
      await this.#activityCollection()
    )
      .find({ scopeKey: { $in: visibleScopeKeys(scope) }, ...(input.after ? { id: { $lt: input.after } } : {}) })
      .sort({ id: -1 })
      .limit(input.limit ?? 100)
      .toArray();
    return rows.map(row => ({
      id: row.id,
      action: row.action,
      recordType: row.recordType,
      recordId: row.recordId,
      scope: cloneScope(row.scope),
      sourceThreadId: row.sourceThreadId ?? undefined,
      createdAt: new Date(row.createdAt),
    }));
  }

  async listSemanticOutbox(
    input: { status?: KnowledgeSemanticOutboxEntry['status']; scope?: KnowledgeScope; limit?: number } = {},
  ): Promise<KnowledgeSemanticOutboxEntry[]> {
    const filter: Filter<Document> = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.scope ? { scopeKey: { $in: visibleScopeKeys(input.scope) } } : {}),
    };
    const rows = await (
      await this.#outboxCollection()
    )
      .find(filter)
      .sort({ createdAt: 1, id: 1 })
      .limit(input.limit ?? 100)
      .toArray();
    return rows.map(outboxFromDocument);
  }

  async claimSemanticOutbox(input: ClaimKnowledgeSemanticOutboxInput): Promise<KnowledgeSemanticOutboxEntry[]> {
    return this.#connector.withTransaction(async session => {
      const collection = await this.#outboxCollection();
      const now = input.now ?? new Date();
      const staleBefore = new Date(now.getTime() - (input.claimTimeoutMs ?? 60_000));
      const filter: Filter<Document> = {
        $or: [
          { status: 'pending', availableAt: { $lte: now } },
          { status: 'processing', claimedAt: { $lte: staleBefore } },
        ],
        ...(input.scope ? { scopeKey: { $in: visibleScopeKeys(input.scope) } } : {}),
      };
      const limit = input.limit ?? 100;
      const candidates = await collection
        .find(filter, sessionOptions(session))
        .sort({ createdAt: 1, id: 1 })
        .limit(Math.max(limit * 10, 100))
        .toArray();
      const claimed: Document[] = [];
      for (const candidate of candidates) {
        if (claimed.length >= limit) break;
        const predecessor = await collection.findOne(
          {
            documentId: candidate.documentId,
            status: { $ne: 'completed' },
            $or: [
              { createdAt: { $lt: candidate.createdAt } },
              { createdAt: candidate.createdAt, id: { $lt: candidate.id } },
            ],
          },
          sessionOptions(session),
        );
        if (predecessor) continue;
        const result = await collection.findOneAndUpdate(
          {
            id: candidate.id,
            $or: [
              { status: 'pending', availableAt: { $lte: now } },
              { status: 'processing', claimedAt: { $lte: staleBefore } },
            ],
          },
          { $set: { status: 'processing', claimedAt: now, claimedBy: input.workerId }, $inc: { attempts: 1 } },
          { ...sessionOptions(session), returnDocument: 'after' },
        );
        if (result) claimed.push(result);
      }
      return claimed.map(outboxFromDocument);
    });
  }

  async completeSemanticOutbox(input: { ids: string[]; workerId: string }): Promise<void> {
    if (!input.ids.length) return;
    await (
      await this.#outboxCollection()
    ).updateMany(
      { id: { $in: input.ids }, status: 'processing', claimedBy: input.workerId },
      { $set: { status: 'completed', completedAt: new Date(), claimedAt: null, claimedBy: null } },
    );
  }

  async releaseSemanticOutbox(input: { ids: string[]; workerId: string; retryAt?: Date }): Promise<void> {
    if (!input.ids.length) return;
    await (
      await this.#outboxCollection()
    ).updateMany(
      { id: { $in: input.ids }, status: 'processing', claimedBy: input.workerId },
      { $set: { status: 'pending', availableAt: input.retryAt ?? new Date(), claimedAt: null, claimedBy: null } },
    );
  }

  async #collection(name: string): Promise<Collection<Document>> {
    return this.#connector.getCollection(name) as Promise<Collection<Document>>;
  }
  #records() {
    return this.#collection(TABLE_KNOWLEDGE_RECORDS);
  }
  #items() {
    return this.#collection(TABLE_KNOWLEDGE_ITEMS);
  }
  #mentions() {
    return this.#collection(TABLE_KNOWLEDGE_MENTIONS);
  }
  #cursors() {
    return this.#collection(TABLE_KNOWLEDGE_CURSORS);
  }
  #activityCollection() {
    return this.#collection(TABLE_KNOWLEDGE_ACTIVITY);
  }
  #outboxCollection() {
    return this.#collection(TABLE_KNOWLEDGE_SEMANTIC_OUTBOX);
  }

  async #getNode(id: string, session?: ClientSession): Promise<KnowledgeNode | null> {
    const row = await (await this.#records()).findOne({ id, type: 'node' }, sessionOptions(session));
    return row ? nodeFromDocument(row) : null;
  }
  async #getNodeByName(name: string, scope: KnowledgeScope, session?: ClientSession): Promise<KnowledgeNode | null> {
    const row = await (
      await this.#records()
    ).findOne(
      { type: 'node', scopeKey: knowledgeScopeKey(scope), canonicalName: canonicalName(name) },
      sessionOptions(session),
    );
    return row ? nodeFromDocument(row) : null;
  }
  async #resolveNode(name: string, scope: KnowledgeScope, session?: ClientSession): Promise<KnowledgeNode | null> {
    for (let length = scope.length; length > 0; length--) {
      const entity = await this.#getNodeByName(name, scope.slice(0, length), session);
      if (entity) {
        const terminal = await this.#resolveTerminalNode(entity.id, session);
        if (terminal && isKnowledgeScopeVisible(terminal.scope, scope)) return terminal;
      }
    }
    return null;
  }
  async #resolveTerminalNode(id: string, session?: ClientSession): Promise<KnowledgeNode | null> {
    let entity = await this.#getNode(id, session);
    const seen = new Set<string>();
    while (entity?.mergedInto) {
      if (seen.has(entity.id)) throw new Error(`Knowledge merge cycle detected at ${entity.id}`);
      seen.add(entity.id);
      entity = await this.#getNode(entity.mergedInto, session);
    }
    return entity;
  }
  async #getPageByExactName(
    name: string,
    scope: KnowledgeScope,
    session?: ClientSession,
  ): Promise<KnowledgeNode | null> {
    const row = await (
      await this.#records()
    ).findOne(
      { type: 'page', scopeKey: knowledgeScopeKey(scope), canonicalName: canonicalName(name) },
      sessionOptions(session),
    );
    return row ? nodeFromDocument(row) : null;
  }
  async #getItem(id: string, includeDeleted: boolean, session?: ClientSession): Promise<KnowledgeItem | null> {
    const row = await (
      await this.#items()
    ).findOne({ id, ...(includeDeleted ? {} : { deletedAt: null }) }, sessionOptions(session));
    return row ? itemFromDocument(row) : null;
  }
  async #listFacts(input: ListKnowledgeItemsInput, touching: boolean): Promise<ListKnowledgeItemsOutput> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const entity = await this.#resolveTerminalNode(input.nodeId);
    if (!entity) return { items: [] };
    const nodeIds = [entity.id];
    if (touching) {
      const mentions = await (await this.#mentions()).find({ recordId: entity.id, sourceType: 'item' }).toArray();
      nodeIds.push(...mentions.map(row => row.sourceId));
    }
    const limit = input.limit ?? 100;
    const filter: Filter<Document> = touching
      ? { $or: [{ parentNodeId: entity.id }, { id: { $in: nodeIds.slice(1) } }] }
      : { parentNodeId: entity.id };
    Object.assign(filter, {
      scopeKey: { $in: visibleScopeKeys(scope) },
      ...(input.includeDeleted ? {} : { deletedAt: null }),
      ...(input.after ? { id: { $lt: input.after } } : {}),
    });
    const rows = await (
      await this.#items()
    )
      .find(filter)
      .sort({ id: -1 })
      .limit(limit + 1)
      .toArray();
    return {
      items: rows.slice(0, limit).map(itemFromDocument),
      nextCursor: rows.length > limit ? rows[limit - 1]?.id : undefined,
    };
  }
  async #replaceMentions(
    sourceType: 'item' | 'node',
    sourceId: string,
    text: string,
    resolutionScope: KnowledgeScope,
    defaultScope: KnowledgeScope,
    session?: ClientSession,
  ): Promise<void> {
    const mentions = await this.#mentions();
    await mentions.deleteMany({ sourceType, sourceId }, sessionOptions(session));
    for (const name of parseKnowledgeWikilinks(text)) {
      let entity = await this.#resolveNode(name, resolutionScope, session);
      if (!entity) {
        const existing = await this.#getNodeByName(name, defaultScope, session);
        entity = existing ? await this.#resolveTerminalNode(existing.id, session) : null;
      }
      if (!entity) {
        const now = new Date();
        entity = {
          id: crypto.randomUUID(),
          type: 'node',
          name,
          kind: 'node',
          scope: defaultScope,
          version: 1,
          createdAt: now,
          updatedAt: now,
        };
        try {
          await (
            await this.#records()
          ).insertOne(
            {
              ...entity,
              canonicalName: canonicalName(name),
              scopeKey: knowledgeScopeKey(defaultScope),
              mergedInto: null,
            },
            sessionOptions(session),
          );
          await this.#activity('node-created', 'node', entity.id, defaultScope, undefined, session);
          await this.#outbox('node', entity.id, 'upsert', 1, defaultScope, session);
        } catch (error) {
          if ((error as { code?: number }).code !== 11000) throw error;
          entity = await this.#getNodeByName(name, defaultScope, session);
          if (!entity) throw error;
        }
      }
      await mentions.updateOne(
        { sourceType, sourceId, recordId: entity.id },
        { $setOnInsert: { sourceType, sourceId, recordId: entity.id } },
        { ...sessionOptions(session), upsert: true },
      );
    }
  }
  async #activity(
    action: KnowledgeActivityAction,
    recordType: KnowledgeSemanticDocumentType,
    recordId: string,
    scope: KnowledgeScope,
    sourceThreadId?: string,
    session?: ClientSession,
  ): Promise<void> {
    await (
      await this.#activityCollection()
    ).insertOne(
      {
        id: createKnowledgeUlid(),
        action,
        recordType,
        recordId,
        scope,
        scopeKey: knowledgeScopeKey(scope),
        sourceThreadId: sourceThreadId ?? null,
        createdAt: new Date(),
      },
      sessionOptions(session),
    );
  }
  async #outbox(
    documentType: KnowledgeSemanticDocumentType,
    id: string,
    operation: KnowledgeSemanticOperation,
    version: number | string,
    scope: KnowledgeScope,
    session?: ClientSession,
  ): Promise<void> {
    const documentId = knowledgeSemanticDocumentId(documentType, id);
    const idempotencyKey = knowledgeSemanticIdempotencyKey(documentId, operation, version);
    const now = new Date();
    try {
      await (
        await this.#outboxCollection()
      ).insertOne(
        {
          id: createKnowledgeUlid(),
          idempotencyKey,
          documentId,
          documentType,
          operation,
          scope,
          scopeKey: knowledgeScopeKey(scope),
          status: 'pending',
          attempts: 0,
          availableAt: now,
          claimedAt: null,
          claimedBy: null,
          createdAt: now,
          completedAt: null,
        },
        sessionOptions(session),
      );
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }
  #escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
