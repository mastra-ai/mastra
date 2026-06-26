import { HarnessStorage, TABLE_HARNESS_SESSIONS, TABLE_SCHEMAS } from '@mastra/core/storage';
import type { HarnessPendingItemRecord, HarnessSessionOrigin, SessionRecord } from '@mastra/core/storage';

import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';

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
  pending?: Array<
    Omit<HarnessPendingItemRecord, 'createdAt' | 'updatedAt'> & {
      createdAt: string | Date;
      updatedAt: string | Date;
    }
  > | null;
};

const toDate = (value: string | Date): Date => new Date(value);

const toOptionalDate = (value: string | Date | null | undefined): Date | undefined => {
  if (value == null) return undefined;
  return toDate(value);
};

function cloneJson<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : structuredClone(value);
}

function hydratePendingItem(item: NonNullable<HarnessSessionRow['pending']>[number]): HarnessPendingItemRecord {
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

function sessionToRecord(record: SessionRecord): Record<string, unknown> {
  return {
    id: record.id,
    ownerId: record.ownerId,
    resourceId: record.resourceId,
    threadId: record.threadId,
    parentSessionId: record.parentSessionId ?? null,
    subagentDepth: record.subagentDepth ?? null,
    source: record.source ?? null,
    origin: record.origin,
    runtimeCompatibilityGeneration: record.runtimeCompatibilityGeneration ?? null,
    modeId: record.modeId,
    modelId: record.modelId,
    title: record.title ?? null,
    metadata: record.metadata ?? null,
    state: record.state ?? null,
    pending: record.pending ?? null,
    createdAt: record.createdAt,
    lastActivityAt: record.lastActivityAt,
    closingAt: record.closingAt ?? null,
    closeDeadlineAt: record.closeDeadlineAt ?? null,
    closedAt: record.closedAt ?? null,
    deletedAt: record.deletedAt ?? null,
  };
}

export class HarnessLibSQL extends HarnessStorage {
  #db: LibSQLDB;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_HARNESS_SESSIONS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_SESSIONS],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_HARNESS_SESSIONS });
  }

  async loadSession(sessionId: string): Promise<SessionRecord | null> {
    const row = await this.#db.select<HarnessSessionRow>({
      tableName: TABLE_HARNESS_SESSIONS,
      keys: { id: sessionId },
    });
    return row ? rowToSession(row) : null;
  }

  async saveSession(record: SessionRecord): Promise<void> {
    await this.#db.insert({
      tableName: TABLE_HARNESS_SESSIONS,
      record: sessionToRecord(record),
    });
  }

  async listSessions(): Promise<SessionRecord[]> {
    const rows = await this.#db.selectMany<HarnessSessionRow>({
      tableName: TABLE_HARNESS_SESSIONS,
      orderBy: '"lastActivityAt" DESC',
    });
    return rows.map(rowToSession);
  }
}
