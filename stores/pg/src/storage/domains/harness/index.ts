import { HarnessStorage, TABLE_HARNESS_SESSIONS, TABLE_SCHEMAS } from '@mastra/core/storage';
import type {
  CreateIndexOptions,
  HarnessPendingItemRecord,
  HarnessSessionOrigin,
  SessionRecord,
} from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';

import { PgDB, resolvePgConfig, generateTableSQL, generateIndexSQL } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getSchemaName, getTableName } from '../utils';

type HarnessPendingItemRow = Omit<HarnessPendingItemRecord, 'createdAt' | 'updatedAt'> & {
  createdAt: string | Date;
  updatedAt: string | Date;
};

type HarnessSessionRow = Omit<
  SessionRecord,
  'createdAt' | 'lastActivityAt' | 'closingAt' | 'closeDeadlineAt' | 'closedAt' | 'deletedAt' | 'pending'
> & {
  createdAt: string | Date;
  createdAtZ?: string | Date | null;
  lastActivityAt: string | Date;
  lastActivityAtZ?: string | Date | null;
  closingAt?: string | Date | null;
  closingAtZ?: string | Date | null;
  closeDeadlineAt?: string | Date | null;
  closeDeadlineAtZ?: string | Date | null;
  closedAt?: string | Date | null;
  closedAtZ?: string | Date | null;
  deletedAt?: string | Date | null;
  deletedAtZ?: string | Date | null;
  pending?: HarnessPendingItemRow[] | null;
};

const TIMESTAMP_COLUMNS = [
  'createdAt',
  'lastActivityAt',
  'closingAt',
  'closeDeadlineAt',
  'closedAt',
  'deletedAt',
] as const;

const BASE_COLUMNS = Object.keys(TABLE_SCHEMAS[TABLE_HARNESS_SESSIONS]);
const INSERT_COLUMNS = [...BASE_COLUMNS, ...TIMESTAMP_COLUMNS.map(column => `${column}Z`)] as const;

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
    createdAt: toDate(row.createdAtZ ?? row.createdAt),
    lastActivityAt: toDate(row.lastActivityAtZ ?? row.lastActivityAt),
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

  const closingAt = toOptionalDate(row.closingAtZ ?? row.closingAt);
  const closeDeadlineAt = toOptionalDate(row.closeDeadlineAtZ ?? row.closeDeadlineAt);
  const closedAt = toOptionalDate(row.closedAtZ ?? row.closedAt);
  const deletedAt = toOptionalDate(row.deletedAtZ ?? row.deletedAt);
  if (closingAt) record.closingAt = closingAt;
  if (closeDeadlineAt) record.closeDeadlineAt = closeDeadlineAt;
  if (closedAt) record.closedAt = closedAt;
  if (deletedAt) record.deletedAt = deletedAt;

  return record;
}

function normalizeJson(value: unknown): unknown {
  return value == null ? null : JSON.stringify(value);
}

function sessionToRecord(record: SessionRecord): Record<string, unknown> {
  const normalized: Record<string, unknown> = {
    id: record.id,
    ownerId: record.ownerId,
    resourceId: record.resourceId,
    threadId: record.threadId,
    parentSessionId: record.parentSessionId ?? null,
    subagentDepth: record.subagentDepth ?? null,
    source: normalizeJson(record.source),
    origin: record.origin,
    runtimeCompatibilityGeneration: record.runtimeCompatibilityGeneration ?? null,
    modeId: record.modeId,
    modelId: record.modelId,
    title: record.title ?? null,
    metadata: normalizeJson(record.metadata),
    state: normalizeJson(record.state),
    pending: normalizeJson(record.pending),
    createdAt: record.createdAt,
    lastActivityAt: record.lastActivityAt,
    closingAt: record.closingAt ?? null,
    closeDeadlineAt: record.closeDeadlineAt ?? null,
    closedAt: record.closedAt ?? null,
    deletedAt: record.deletedAt ?? null,
  };

  for (const column of TIMESTAMP_COLUMNS) {
    normalized[`${column}Z`] = normalized[column];
  }

  return normalized;
}

export class HarnessPG extends HarnessStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_HARNESS_SESSIONS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (HarnessPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_HARNESS_SESSIONS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_SESSIONS],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  static getExportDDL(schemaName?: string): string[] {
    const statements: string[] = [];
    const parsedSchema = schemaName ? parseSqlIdentifier(schemaName, 'schema name') : '';
    const schemaPrefix = parsedSchema && parsedSchema !== 'public' ? `${parsedSchema}_` : '';

    statements.push(
      generateTableSQL({
        tableName: TABLE_HARNESS_SESSIONS,
        schema: TABLE_SCHEMAS[TABLE_HARNESS_SESSIONS],
        schemaName,
        includeAllConstraints: true,
      }),
    );

    for (const idx of HarnessPG.getDefaultIndexDefs(schemaPrefix)) {
      statements.push(generateIndexSQL(idx, schemaName));
    }

    return statements;
  }

  static getDefaultIndexDefs(_schemaPrefix: string): CreateIndexOptions[] {
    return [];
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.#schema !== 'public' ? `${this.#schema}_` : '';
    return HarnessPG.getDefaultIndexDefs(schemaPrefix);
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_HARNESS_SESSIONS });
  }

  async loadSession(sessionId: string): Promise<SessionRecord | null> {
    const tableName = getTableName({
      indexName: TABLE_HARNESS_SESSIONS,
      schemaName: getSchemaName(this.#schema),
    });
    const row = await this.#db.client.oneOrNone<HarnessSessionRow>(
      `SELECT * FROM ${tableName} WHERE "id" = $1 LIMIT 1`,
      [sessionId],
    );
    return row ? rowToSession(row) : null;
  }

  async saveSession(record: SessionRecord): Promise<void> {
    const tableName = getTableName({
      indexName: TABLE_HARNESS_SESSIONS,
      schemaName: getSchemaName(this.#schema),
    });
    const normalized = sessionToRecord(record);
    const columns = INSERT_COLUMNS.map(column => parseSqlIdentifier(column, 'column name'));
    const columnList = columns.map(column => `"${column}"`).join(', ');
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const updateColumns = columns.filter(column => column !== 'id');
    const updateClause = updateColumns.map(column => `"${column}" = EXCLUDED."${column}"`).join(', ');
    const values = INSERT_COLUMNS.map(column => normalized[column]);

    await this.#db.client.none(
      `INSERT INTO ${tableName} (${columnList}) VALUES (${placeholders})
       ON CONFLICT ("id") DO UPDATE SET ${updateClause}`,
      values,
    );
  }

  async listSessions(): Promise<SessionRecord[]> {
    const tableName = getTableName({
      indexName: TABLE_HARNESS_SESSIONS,
      schemaName: getSchemaName(this.#schema),
    });
    const rows = await this.#db.client.manyOrNone<HarnessSessionRow>(
      `SELECT * FROM ${tableName} ORDER BY "lastActivityAtZ" DESC`,
    );
    return rows.map(rowToSession);
  }
}
