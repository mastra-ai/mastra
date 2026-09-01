import {
  assertKnowledgeCeilingRaised,
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
  TABLE_KNOWLEDGE_RECORDS,
  TABLE_KNOWLEDGE_MENTIONS,
  TABLE_KNOWLEDGE_NODES,
  TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
} from '@mastra/core/storage';
import type {
  AppendKnowledgeInput,
  ClaimKnowledgeSemanticOutboxInput,
  CreateKnowledgeNodeInput,
  KnowledgeActivityAction,
  KnowledgeActivityEvent,
  KnowledgeCurationCursor,
  KnowledgeNode,
  KnowledgeRecord,
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
} from '@mastra/core/storage';
import type { ClientSession, Collection, Filter } from 'mongodb';

import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig } from '../../types';

// #21830 shipped this helper in core 1.63.1; resolve it lazily so an older
// installed core fails feature-detection instead of breaking module load.
let assertDescriptionWithinBound: ((description: string | undefined) => void) | undefined;
async function assertKnowledgeDescriptionWithinBoundCompat(description: string | undefined): Promise<void> {
  let assertWithinBound = assertDescriptionWithinBound;
  if (!assertWithinBound) {
    const mod: Partial<typeof import('@mastra/core/storage')> = await import('@mastra/core/storage');
    const resolvedAssert: (description: string | undefined) => void =
      mod.assertKnowledgeDescriptionWithinBound ??
      (value => {
        if (value !== undefined && value.length > 400) {
          throw new Error('Knowledge node description exceeds the 400 UTF-16 code unit limit');
        }
      });
    assertDescriptionWithinBound = resolvedAssert;
    assertWithinBound = resolvedAssert;
  }
  assertWithinBound(description);
}

type Document = Record<string, any>;

const cloneScope = (scope: KnowledgeScope): KnowledgeScope => [...scope];
const canonicalName = (name: string) => name.trim().toLocaleLowerCase();
const nodeReferenceId = (node: KnowledgeNode | string) => (typeof node === 'string' ? node : node.id);
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
    description: row.description == null ? undefined : String(row.description),
    scope: cloneScope(row.scope),
    version: Number(row.version),
    mergedInto: row.mergedInto ?? undefined,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function recordFromDocument(row: Document): KnowledgeRecord {
  return {
    id: String(row.id),
    node: String(row.node),
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
    TABLE_KNOWLEDGE_NODES,
    TABLE_KNOWLEDGE_RECORDS,
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
    const nodes = await this.#collection(TABLE_KNOWLEDGE_NODES);
    const knowledge = await this.#collection(TABLE_KNOWLEDGE_RECORDS);
    const mentions = await this.#collection(TABLE_KNOWLEDGE_MENTIONS);
    const cursors = await this.#collection(TABLE_KNOWLEDGE_CURSORS);
    const activity = await this.#collection(TABLE_KNOWLEDGE_ACTIVITY);
    const outbox = await this.#collection(TABLE_KNOWLEDGE_SEMANTIC_OUTBOX);
    await Promise.all([
      nodes.createIndex({ type: 1, scopeKey: 1, canonicalName: 1 }, { unique: true }),
      nodes.createIndex({ scopeKey: 1, type: 1 }),
      knowledge.createIndex({ node: 1, id: -1 }),
      knowledge.createIndex({ sourceThreadId: 1, id: -1 }),
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
    await assertKnowledgeDescriptionWithinBoundCompat(input.description);
    const scope = canonicalizeKnowledgeScope(input.scope);
    return this.#connector.withTransaction(async session => {
      const existing = await this.#getNodeByName(input.name, scope, session);
      if (existing) {
        const terminal = (await this.#resolveTerminalNode(existing.id, session))!;
        if (!isKnowledgeScopeVisible(terminal.scope, scope)) {
          throw new Error(`Merged knowledge node is not visible from scope: ${input.name}`);
        }
        return terminal;
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
      try {
        await (
          await this.#nodes()
        ).insertOne(
          {
            ...node,
            canonicalName: canonicalName(node.name),
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
      await this.#replaceMentions('node', node.id, node.content ?? '', input.resolutionScope ?? scope, scope, session);
      await this.#activity('node-created', 'node', node.id, scope, undefined, session);
      await this.#outbox('node', node.id, 'upsert', 1, scope, session);
      return node;
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
      await this.#nodes()
    )
      .find(filter)
      .sort({ updatedAt: -1, name: 1, id: 1 })
      .limit(input.limit ?? 100)
      .toArray();
    return rows.map(nodeFromDocument);
  }

  async updateNode(input: UpdateKnowledgeNodeInput): Promise<KnowledgeNode> {
    await assertKnowledgeDescriptionWithinBoundCompat(input.description);
    return this.#connector.withTransaction(async session => {
      const existing = await this.#getNode(input.id, session);
      if (!existing) throw new KnowledgeNotFoundError('node', input.id);
      if (existing.mergedInto) throw new Error(`Cannot update merged knowledge node: ${input.id}`);
      const scope = input.scope ? canonicalizeKnowledgeScope(input.scope) : existing.scope;
      const name = input.name?.trim() ?? existing.name;
      const content = input.content ?? existing.content;
      const description = input.description ?? existing.description;
      const now = new Date();
      const result = await (
        await this.#nodes()
      ).findOneAndUpdate(
        { id: input.id, type: 'node', version: input.version },
        {
          $set: {
            name,
            canonicalName: canonicalName(name),
            kind: input.kind ?? existing.kind,
            content: content ?? null,
            description: description ?? null,
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
        const records = await (await this.#knowledge()).find({ node: input.id }, sessionOptions(session)).toArray();
        for (const record of records) {
          await this.#outbox('record', record.id, 'delete', createKnowledgeUlid(), record.scope, session);
          if (!record.deletedAt)
            await this.#outbox('record', record.id, 'upsert', createKnowledgeUlid(), record.scope, session);
        }
      }
      await this.#activity('node-updated', 'node', input.id, scope, undefined, session);
      await this.#outbox('node', input.id, 'upsert', Number(result.version), scope, session);
      return nodeFromDocument(result);
    });
  }

  async mergeNodes(input: { sourceId: string; targetId: string; sourceVersion: number }): Promise<KnowledgeNode> {
    if (input.sourceId === input.targetId) throw new Error('Cannot merge a knowledge node into itself');
    return this.#connector.withTransaction(async session => {
      const source = await this.#getNode(input.sourceId, session);
      if (!source) throw new KnowledgeNotFoundError('node', input.sourceId);
      const target = await this.#resolveTerminalNode(input.targetId, session);
      if (!target) throw new KnowledgeNotFoundError('node', input.targetId);
      if (target.id === source.id) throw new Error('Cannot create a knowledge merge cycle');
      if (!isKnowledgeScopeVisible(target.scope, source.scope)) {
        throw new Error('Cannot merge a knowledge node into a target that is narrower than its source scope');
      }
      const mentions = await this.#mentions();
      const affected = await mentions.find({ recordId: source.id }, sessionOptions(session)).toArray();
      const movedFacts = await (await this.#knowledge()).find({ node: source.id }, sessionOptions(session)).toArray();
      const updated = await (
        await this.#nodes()
      ).updateOne(
        { id: source.id, type: 'node', version: input.sourceVersion, mergedInto: null },
        { $set: { mergedInto: target.id, updatedAt: new Date() }, $inc: { version: 1 } },
        sessionOptions(session),
      );
      if (updated.modifiedCount === 0) throw new KnowledgeConflictError(source.id);
      await (
        await this.#knowledge()
      ).updateMany({ node: source.id }, { $set: { node: target.id } }, sessionOptions(session));
      for (const mention of affected) {
        const duplicate = await mentions.findOne(
          { sourceType: mention.sourceType, sourceId: mention.sourceId, recordId: target.id },
          sessionOptions(session),
        );
        if (duplicate) await mentions.deleteOne({ _id: mention._id }, sessionOptions(session));
        else await mentions.updateOne({ _id: mention._id }, { $set: { recordId: target.id } }, sessionOptions(session));
      }
      for (const record of movedFacts) {
        if (!record.deletedAt)
          await this.#outbox('record', record.id, 'upsert', createKnowledgeUlid(), record.scope, session);
      }
      for (const mention of affected) {
        const scope =
          mention.sourceType === 'record'
            ? (await (await this.#knowledge()).findOne({ id: mention.sourceId }, sessionOptions(session)))?.scope
            : (await (await this.#nodes()).findOne({ id: mention.sourceId, type: 'node' }, sessionOptions(session)))
                ?.scope;
        if (scope)
          await this.#outbox(mention.sourceType, mention.sourceId, 'upsert', createKnowledgeUlid(), scope, session);
      }
      // Merge matrix: a target that NEVER had a description (undefined — '' is an explicit curator
      // clear and wins) adopts the source's; otherwise the target's state is preserved.
      let mergedTarget = target;
      if (target.description === undefined && source.description) {
        const adoptedAt = new Date();
        // Adoption is conditional on the target state this merge observed: a concurrent write (a new
        // description, or an intentional '' clear) bumps the version and loses the predicate, so the
        // merge leaves that newer value alone instead of clobbering it with the source's synopsis.
        // `description: null` matches both a missing field (never written) and an explicit null,
        // which are the two shapes a description-less node takes here.
        const adopted = await (
          await this.#nodes()
        ).updateOne(
          { id: target.id, type: 'node', version: target.version, description: null },
          { $set: { description: source.description, updatedAt: adoptedAt }, $inc: { version: 1 } },
          sessionOptions(session),
        );
        if (adopted.modifiedCount > 0) {
          mergedTarget = {
            ...target,
            description: source.description,
            version: target.version + 1,
            updatedAt: adoptedAt,
          };
          await this.#activity('node-updated', 'node', target.id, target.scope, undefined, session);
        }
      }
      await this.#activity('node-merged', 'node', source.id, source.scope, undefined, session);
      await this.#outbox('node', source.id, 'delete', input.sourceVersion + 1, source.scope, session);
      await this.#outbox('node', target.id, 'upsert', createKnowledgeUlid(), mergedTarget.scope, session);
      return mergedTarget;
    });
  }

  async appendKnowledge(input: AppendKnowledgeInput): Promise<KnowledgeRecord> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const defaultScope = canonicalizeKnowledgeScope(input.defaultScope);
    assertKnowledgeScopeWithinCeiling(scope, input.maxScope);
    return this.#connector.withTransaction(async session => {
      const parent = await this.#resolveTerminalNode(nodeReferenceId(input.node), session);
      if (!parent) throw new KnowledgeNotFoundError('node', nodeReferenceId(input.node));
      const id = input.id ?? createKnowledgeUlid();
      const existing = await (await this.#knowledge()).findOne({ id }, sessionOptions(session));
      if (existing) return recordFromDocument(existing);
      const record: KnowledgeRecord = {
        id,
        node: parent.id,
        text: input.text,
        scope,
        sourceThreadId: input.sourceThreadId,
        capturedAt: new Date(),
        when: input.when,
        maxScope: input.maxScope,
        metadata: input.metadata,
      };
      await (
        await this.#knowledge()
      ).insertOne(
        {
          ...record,
          scopeKey: knowledgeScopeKey(scope),
          when: record.when ?? null,
          maxScope: record.maxScope ?? null,
          deletedAt: null,
          deletedBy: null,
        },
        sessionOptions(session),
      );
      await this.#replaceMentions('record', id, record.text, input.resolutionScope, defaultScope, session);
      await this.#activity('record-created', 'record', id, scope, input.sourceThreadId, session);
      await this.#outbox('record', id, 'upsert', createKnowledgeUlid(), scope, session);
      return record;
    });
  }

  async getKnowledge(input: { id: string; includeDeleted?: boolean }): Promise<KnowledgeRecord | null> {
    const row = await (
      await this.#knowledge()
    ).findOne({ id: input.id, ...(input.includeDeleted ? {} : { deletedAt: null }) });
    return row ? recordFromDocument(row) : null;
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
    const rows = await (
      await this.#knowledge()
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
      records: rows.slice(0, limit).map(recordFromDocument),
      nextCursor: rows.length > limit ? rows[limit - 1]?.id : undefined,
    };
  }

  async removeKnowledge(input: { id: string; deletedBy: string }): Promise<KnowledgeRecord> {
    return this.#connector.withTransaction(async session => {
      const record = await this.#getKnowledge(input.id, true, session);
      if (!record) throw new KnowledgeNotFoundError('record', input.id);
      if (record.deletedAt) return record;
      const deletedAt = new Date();
      await (
        await this.#knowledge()
      ).updateOne(
        { id: input.id, deletedAt: null },
        { $set: { deletedAt, deletedBy: input.deletedBy } },
        sessionOptions(session),
      );
      await this.#activity('record-deleted', 'record', input.id, record.scope, record.sourceThreadId, session);
      await this.#outbox('record', input.id, 'delete', createKnowledgeUlid(), record.scope, session);
      return { ...record, deletedAt, deletedBy: input.deletedBy };
    });
  }

  async restoreKnowledge(input: { id: string }): Promise<KnowledgeRecord> {
    return this.#connector.withTransaction(async session => {
      const record = await this.#getKnowledge(input.id, true, session);
      if (!record) throw new KnowledgeNotFoundError('record', input.id);
      if (!record.deletedAt) return record;
      await (
        await this.#knowledge()
      ).updateOne({ id: input.id }, { $set: { deletedAt: null, deletedBy: null } }, sessionOptions(session));
      await this.#activity('record-restored', 'record', input.id, record.scope, record.sourceThreadId, session);
      await this.#outbox('record', input.id, 'upsert', createKnowledgeUlid(), record.scope, session);
      return { ...record, deletedAt: undefined, deletedBy: undefined };
    });
  }

  async rescopeKnowledge(input: { id: string; scope: KnowledgeScope }): Promise<KnowledgeRecord> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    return this.#connector.withTransaction(async session => {
      const record = await this.#getKnowledge(input.id, true, session);
      if (!record) throw new KnowledgeNotFoundError('record', input.id);
      assertKnowledgeScopeWithinCeiling(scope, record.maxScope);
      await (
        await this.#knowledge()
      ).updateOne({ id: input.id }, { $set: { scope, scopeKey: knowledgeScopeKey(scope) } }, sessionOptions(session));
      await this.#activity('record-rescoped', 'record', input.id, scope, record.sourceThreadId, session);
      await this.#outbox('record', input.id, 'delete', createKnowledgeUlid(), record.scope, session);
      if (!record.deletedAt) await this.#outbox('record', input.id, 'upsert', createKnowledgeUlid(), scope, session);
      return { ...record, scope };
    });
  }

  async raiseKnowledgeCeiling(input: { id: string; maxScope?: KnowledgeRecord['maxScope'] }): Promise<KnowledgeRecord> {
    const record = await this.#getKnowledge(input.id, true);
    if (!record) throw new KnowledgeNotFoundError('record', input.id);
    assertKnowledgeScopeWithinCeiling(record.scope, input.maxScope);
    assertKnowledgeCeilingRaised(record.maxScope, input.maxScope);
    await (await this.#knowledge()).updateOne({ id: input.id }, { $set: { maxScope: input.maxScope ?? null } });
    return { ...record, maxScope: input.maxScope };
  }

  async search(input: SearchKnowledgeInput): Promise<SearchKnowledgeResult[]> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const query = input.query.trim();
    if (!query) return [];
    const regex = new RegExp(this.#escapeRegex(query), 'i');
    const limit = input.limit ?? 20;
    const records = await (
      await this.#nodes()
    )
      .find({
        mergedInto: null,
        scopeKey: { $in: visibleScopeKeys(scope) },
        $or: [{ name: regex }, { kind: regex }, { content: regex }, { description: regex }],
      })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();
    const results: SearchKnowledgeResult[] = records.map(row => ({
      type: 'node',
      id: row.id,
      recordId: row.id,
      name: row.name,
      // Description joins the snippet only when present so description-less results stay byte-identical.
      text: [row.name, ...(row.description ? [row.description] : []), ...(row.content ? [row.content] : [])].join('\n'),
      scope: cloneScope(row.scope),
    }));
    if (results.length < limit) {
      const records = await (
        await this.#knowledge()
      )
        .find({ deletedAt: null, scopeKey: { $in: visibleScopeKeys(scope) }, text: regex })
        .sort({ id: -1 })
        .limit(limit - results.length)
        .toArray();
      for (const record of records) {
        const parent = await this.#resolveTerminalNode(record.node);
        const parentVisible = parent && isKnowledgeScopeVisible(parent.scope, scope);
        results.push({
          type: 'record',
          id: record.id,
          recordId: record.node,
          name: parentVisible ? parent.name : '(private node)',
          text: record.text,
          scope: cloneScope(record.scope),
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
          lastKnowledgeId: row.lastKnowledgeId,
          updatedAt: new Date(row.updatedAt),
        }
      : null;
  }

  async advanceCurationCursor(input: {
    sourceThreadId: string;
    agent: string;
    lastKnowledgeId: string;
  }): Promise<KnowledgeCurationCursor> {
    const row = await (
      await this.#cursors()
    ).findOneAndUpdate(
      { sourceThreadId: input.sourceThreadId, agent: input.agent },
      {
        $max: { lastKnowledgeId: input.lastKnowledgeId },
        $set: { updatedAt: new Date() },
        $setOnInsert: { sourceThreadId: input.sourceThreadId, agent: input.agent },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return {
      sourceThreadId: row!.sourceThreadId,
      agent: row!.agent,
      lastKnowledgeId: row!.lastKnowledgeId,
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
  #nodes() {
    return this.#collection(TABLE_KNOWLEDGE_NODES);
  }
  #knowledge() {
    return this.#collection(TABLE_KNOWLEDGE_RECORDS);
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
    const row = await (await this.#nodes()).findOne({ id, type: 'node' }, sessionOptions(session));
    return row ? nodeFromDocument(row) : null;
  }
  async #getNodeByName(name: string, scope: KnowledgeScope, session?: ClientSession): Promise<KnowledgeNode | null> {
    const row = await (
      await this.#nodes()
    ).findOne(
      { type: 'node', scopeKey: knowledgeScopeKey(scope), canonicalName: canonicalName(name) },
      sessionOptions(session),
    );
    return row ? nodeFromDocument(row) : null;
  }
  async #resolveNode(name: string, scope: KnowledgeScope, session?: ClientSession): Promise<KnowledgeNode | null> {
    for (let length = scope.length; length > 0; length--) {
      const node = await this.#getNodeByName(name, scope.slice(0, length), session);
      if (node) {
        const terminal = await this.#resolveTerminalNode(node.id, session);
        if (terminal && isKnowledgeScopeVisible(terminal.scope, scope)) return terminal;
      }
    }
    return null;
  }
  async #resolveTerminalNode(id: string, session?: ClientSession): Promise<KnowledgeNode | null> {
    let node = await this.#getNode(id, session);
    const seen = new Set<string>();
    while (node?.mergedInto) {
      if (seen.has(node.id)) throw new Error(`Knowledge merge cycle detected at ${node.id}`);
      seen.add(node.id);
      node = await this.#getNode(node.mergedInto, session);
    }
    return node;
  }
  async #getPageByExactName(
    name: string,
    scope: KnowledgeScope,
    session?: ClientSession,
  ): Promise<KnowledgeNode | null> {
    const row = await (
      await this.#nodes()
    ).findOne(
      { type: 'page', scopeKey: knowledgeScopeKey(scope), canonicalName: canonicalName(name) },
      sessionOptions(session),
    );
    return row ? nodeFromDocument(row) : null;
  }
  async #getKnowledge(id: string, includeDeleted: boolean, session?: ClientSession): Promise<KnowledgeRecord | null> {
    const row = await (
      await this.#knowledge()
    ).findOne({ id, ...(includeDeleted ? {} : { deletedAt: null }) }, sessionOptions(session));
    return row ? recordFromDocument(row) : null;
  }
  async #queryKnowledge(
    input: QueryKnowledgeInput,
    relationship: 'about' | 'mentioning' | 'related',
  ): Promise<QueryKnowledgeOutput> {
    const scope = canonicalizeKnowledgeScope(input.scope);
    const node = await this.#resolveTerminalNode(nodeReferenceId(input.node));
    if (!node) return { records: [] };
    const nodeIds = [node.id];
    if (relationship !== 'about') {
      const mentions = await (await this.#mentions()).find({ recordId: node.id, sourceType: 'record' }).toArray();
      nodeIds.push(...mentions.map(row => row.sourceId));
    }
    const limit = input.limit ?? 100;
    const filter: Filter<Document> =
      relationship === 'about'
        ? { node: node.id }
        : relationship === 'mentioning'
          ? { id: { $in: nodeIds.slice(1) } }
          : { $or: [{ node: node.id }, { id: { $in: nodeIds.slice(1) } }] };
    Object.assign(filter, {
      scopeKey: { $in: visibleScopeKeys(scope) },
      ...(input.includeDeleted ? {} : { deletedAt: null }),
      ...(input.after ? { id: { $lt: input.after } } : {}),
    });
    const rows = await (
      await this.#knowledge()
    )
      .find(filter)
      .sort({ id: -1 })
      .limit(limit + 1)
      .toArray();
    return {
      records: rows.slice(0, limit).map(recordFromDocument),
      nextCursor: rows.length > limit ? rows[limit - 1]?.id : undefined,
    };
  }
  async #replaceMentions(
    sourceType: 'record' | 'node',
    sourceId: string,
    text: string,
    resolutionScope: KnowledgeScope,
    defaultScope: KnowledgeScope,
    session?: ClientSession,
  ): Promise<void> {
    const mentions = await this.#mentions();
    await mentions.deleteMany({ sourceType, sourceId }, sessionOptions(session));
    for (const name of parseKnowledgeWikilinks(text)) {
      let node = await this.#resolveNode(name, resolutionScope, session);
      if (!node) {
        const existing = await this.#getNodeByName(name, defaultScope, session);
        node = existing ? await this.#resolveTerminalNode(existing.id, session) : null;
      }
      if (!node) {
        const now = new Date();
        node = {
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
            await this.#nodes()
          ).insertOne(
            {
              ...node,
              canonicalName: canonicalName(name),
              scopeKey: knowledgeScopeKey(defaultScope),
              mergedInto: null,
            },
            sessionOptions(session),
          );
          await this.#activity('node-created', 'node', node.id, defaultScope, undefined, session);
          await this.#outbox('node', node.id, 'upsert', 1, defaultScope, session);
        } catch (error) {
          if ((error as { code?: number }).code !== 11000) throw error;
          node = await this.#getNodeByName(name, defaultScope, session);
          if (!node) throw error;
        }
      }
      await mentions.updateOne(
        { sourceType, sourceId, recordId: node.id },
        { $setOnInsert: { sourceType, sourceId, recordId: node.id } },
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
