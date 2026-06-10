import { HarnessStorage, TABLE_HARNESS_SESSIONS } from '@mastra/core/storage';
import type { HarnessPendingItemRecord, HarnessSessionOrigin, SessionRecord } from '@mastra/core/storage';

import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

type HarnessPendingItemRow = Omit<HarnessPendingItemRecord, 'createdAt' | 'updatedAt'> & {
  createdAt: string | Date;
  updatedAt: string | Date;
};

type HarnessSessionRow = Omit<
  SessionRecord,
  'createdAt' | 'lastActivityAt' | 'closingAt' | 'closeDeadlineAt' | 'closedAt' | 'deletedAt' | 'pending'
> & {
  createdAt: string | Date;
  lastActivityAt: string | Date;
  closingAt?: string | Date | null;
  closeDeadlineAt?: string | Date | null;
  closedAt?: string | Date | null;
  deletedAt?: string | Date | null;
  pending?: HarnessPendingItemRow[] | null;
};

const toDate = (value: string | Date): Date => new Date(value);

const toOptionalDate = (value: string | Date | null | undefined): Date | undefined => {
  if (value == null) return undefined;
  return toDate(value);
};

function cloneJson<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : structuredClone(value);
}

function hydratePendingItem(item: HarnessPendingItemRow): HarnessPendingItemRecord {
  const record: HarnessPendingItemRecord = {
    id: item.id,
    kind: item.kind,
    status: item.status,
    sessionId: item.sessionId,
    createdAt: toDate(item.createdAt),
    updatedAt: toDate(item.updatedAt),
  };
  if (item.runId !== undefined) record.runId = item.runId;
  if (item.traceId !== undefined) record.traceId = item.traceId;
  if (item.runtimeCompatibilityGeneration !== undefined) {
    record.runtimeCompatibilityGeneration = item.runtimeCompatibilityGeneration;
  }
  if (item.payload !== undefined) record.payload = cloneJson(item.payload);
  if (item.response !== undefined) record.response = cloneJson(item.response);
  return record;
}

function rowToSession(row: HarnessSessionRow): SessionRecord {
  const record: SessionRecord = {
    id: row.id,
    ownerId: row.ownerId,
    resourceId: row.resourceId,
    threadId: row.threadId,
    origin: row.origin as HarnessSessionOrigin,
    modeId: row.modeId,
    modelId: row.modelId,
    createdAt: toDate(row.createdAt),
    lastActivityAt: toDate(row.lastActivityAt),
  };
  if (row.parentSessionId != null) record.parentSessionId = row.parentSessionId;
  if (row.subagentDepth != null) record.subagentDepth = row.subagentDepth;
  if (row.source != null) record.source = { ...row.source, type: row.source.type as HarnessSessionOrigin };
  if (row.runtimeCompatibilityGeneration != null) {
    record.runtimeCompatibilityGeneration = row.runtimeCompatibilityGeneration;
  }
  if (row.title != null) record.title = row.title;
  if (row.metadata != null) record.metadata = cloneJson(row.metadata);
  if (row.state != null) record.state = cloneJson(row.state);
  if (row.pending != null) record.pending = row.pending.map(hydratePendingItem);

  const closingAt = toOptionalDate(row.closingAt);
  const closeDeadlineAt = toOptionalDate(row.closeDeadlineAt);
  const closedAt = toOptionalDate(row.closedAt);
  const deletedAt = toOptionalDate(row.deletedAt);
  if (closingAt) record.closingAt = closingAt;
  if (closeDeadlineAt) record.closeDeadlineAt = closeDeadlineAt;
  if (closedAt) record.closedAt = closedAt;
  if (deletedAt) record.deletedAt = deletedAt;

  return record;
}

function sessionToDocument(record: SessionRecord): HarnessSessionRow {
  return {
    id: record.id,
    ownerId: record.ownerId,
    resourceId: record.resourceId,
    threadId: record.threadId,
    parentSessionId: record.parentSessionId,
    subagentDepth: record.subagentDepth,
    source: cloneJson(record.source),
    origin: record.origin,
    runtimeCompatibilityGeneration: record.runtimeCompatibilityGeneration,
    modeId: record.modeId,
    modelId: record.modelId,
    title: record.title,
    metadata: cloneJson(record.metadata),
    state: cloneJson(record.state),
    pending: record.pending?.map(item => ({
      ...item,
      payload: cloneJson(item.payload),
      response: cloneJson(item.response),
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    })),
    createdAt: new Date(record.createdAt),
    lastActivityAt: new Date(record.lastActivityAt),
    closingAt: record.closingAt ? new Date(record.closingAt) : record.closingAt,
    closeDeadlineAt: record.closeDeadlineAt ? new Date(record.closeDeadlineAt) : record.closeDeadlineAt,
    closedAt: record.closedAt ? new Date(record.closedAt) : record.closedAt,
    deletedAt: record.deletedAt ? new Date(record.deletedAt) : record.deletedAt,
  };
}

export class HarnessMongoDB extends HarnessStorage {
  #connector: MongoDBConnector;
  #skipDefaultIndexes?: boolean;
  #indexes?: MongoDBIndexConfig[];

  static readonly MANAGED_COLLECTIONS = [TABLE_HARNESS_SESSIONS] as const;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
    this.#indexes = config.indexes?.filter(idx =>
      (HarnessMongoDB.MANAGED_COLLECTIONS as readonly string[]).includes(idx.collection),
    );
  }

  private async getCollection() {
    return this.#connector.getCollection(TABLE_HARNESS_SESSIONS);
  }

  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      { collection: TABLE_HARNESS_SESSIONS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_HARNESS_SESSIONS, keys: { lastActivityAt: -1 } },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        const collection = await this.getCollection();
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index on ${indexDef.collection}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      try {
        const collection = await this.getCollection();
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index on ${indexDef.collection}:`, error);
      }
    }
  }

  async init(): Promise<void> {
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    const collection = await this.getCollection();
    await collection.deleteMany({});
  }

  async loadSession(sessionId: string): Promise<SessionRecord | null> {
    const collection = await this.getCollection();
    const document = await collection.findOne<HarnessSessionRow>({ id: sessionId });
    return document ? rowToSession(document) : null;
  }

  async saveSession(record: SessionRecord): Promise<void> {
    const collection = await this.getCollection();
    await collection.replaceOne({ id: record.id }, sessionToDocument(record), { upsert: true });
  }

  async listSessions(): Promise<SessionRecord[]> {
    const collection = await this.getCollection();
    const documents = await collection.find<HarnessSessionRow>({}).sort({ lastActivityAt: -1 }).toArray();
    return documents.map(rowToSession);
  }
}
