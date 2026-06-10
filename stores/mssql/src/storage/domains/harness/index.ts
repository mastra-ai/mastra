import { HarnessStorage, TABLE_HARNESS_SESSIONS, TABLE_SCHEMAS } from '@mastra/core/storage';
import type {
  CreateIndexOptions,
  HarnessPendingItemRecord,
  HarnessSessionOrigin,
  SessionRecord,
  StorageColumn,
} from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';
import sql from 'mssql';

import { MssqlDB, resolveMssqlConfig } from '../../db';
import type { MssqlDomainConfig } from '../../db';
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
  lastActivityAt: string | Date;
  closingAt?: string | Date | null;
  closeDeadlineAt?: string | Date | null;
  closedAt?: string | Date | null;
  deletedAt?: string | Date | null;
  pending?: HarnessPendingItemRow[] | string | null;
  source?: SessionRecord['source'] | string | null;
  metadata?: SessionRecord['metadata'] | string | null;
  state?: SessionRecord['state'] | string | null;
};

const BASE_COLUMNS = Object.keys(TABLE_SCHEMAS[TABLE_HARNESS_SESSIONS]);

const toDate = (value: string | Date): Date => new Date(value);

const toOptionalDate = (value: string | Date | null | undefined): Date | undefined => {
  if (value == null) return undefined;
  return toDate(value);
};

function cloneJson<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : structuredClone(value);
}

function parseJson<T>(value: T | string | null | undefined): T | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'string') return value;
  return JSON.parse(value) as T;
}

function normalizeJson(value: unknown): unknown {
  return value == null ? null : JSON.stringify(value);
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
  const source = parseJson<SessionRecord['source']>(row.source);
  const pending = parseJson<HarnessPendingItemRow[]>(row.pending);
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
  if (source != null) record.source = { ...source, type: source.type as HarnessSessionOrigin };
  if (row.runtimeCompatibilityGeneration != null) {
    record.runtimeCompatibilityGeneration = row.runtimeCompatibilityGeneration;
  }
  if (row.title != null) record.title = row.title;
  const metadata = parseJson<SessionRecord['metadata']>(row.metadata);
  const state = parseJson<SessionRecord['state']>(row.state);
  if (metadata != null) record.metadata = cloneJson(metadata);
  if (state != null) record.state = cloneJson(state);
  if (pending != null) record.pending = pending.map(hydratePendingItem);

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
}

function getMssqlType(column: StorageColumn | undefined): any {
  switch (column?.type) {
    case 'timestamp':
      return sql.DateTime2;
    case 'integer':
      return sql.Int;
    case 'bigint':
      return sql.BigInt;
    case 'float':
      return sql.Float;
    case 'boolean':
      return sql.Bit;
    case 'uuid':
      return sql.UniqueIdentifier;
    default:
      return sql.NVarChar;
  }
}

function bindValue(request: sql.Request, name: string, value: unknown): void {
  const column = TABLE_SCHEMAS[TABLE_HARNESS_SESSIONS][name];
  if (value instanceof Date) {
    request.input(name, sql.DateTime2, value);
  } else if (value === null || value === undefined) {
    request.input(name, getMssqlType(column), null);
  } else if (column?.type === 'boolean') {
    request.input(name, sql.Bit, value ? 1 : 0);
  } else {
    request.input(name, value);
  }
}

export class HarnessMSSQL extends HarnessStorage {
  public pool: sql.ConnectionPool;
  private db: MssqlDB;
  private schema?: string;
  private needsConnect: boolean;
  private skipDefaultIndexes?: boolean;
  private indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_HARNESS_SESSIONS] as const;

  constructor(config: MssqlDomainConfig) {
    super();
    const { pool, schemaName, skipDefaultIndexes, indexes, needsConnect } = resolveMssqlConfig(config);
    this.pool = pool;
    this.schema = schemaName;
    this.db = new MssqlDB({ pool, schemaName, skipDefaultIndexes });
    this.needsConnect = needsConnect;
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx => (HarnessMSSQL.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    for (const indexDef of this.indexes) {
      try {
        await this.db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async init(): Promise<void> {
    if (this.needsConnect) {
      await this.pool.connect();
      this.needsConnect = false;
    }
    await this.db.createTable({
      tableName: TABLE_HARNESS_SESSIONS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_SESSIONS],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_HARNESS_SESSIONS });
  }

  async loadSession(sessionId: string): Promise<SessionRecord | null> {
    const row = await this.db.load<HarnessSessionRow>({
      tableName: TABLE_HARNESS_SESSIONS,
      keys: { id: sessionId },
    });
    return row ? rowToSession(row) : null;
  }

  async saveSession(record: SessionRecord): Promise<void> {
    const tableName = getTableName({
      indexName: TABLE_HARNESS_SESSIONS,
      schemaName: getSchemaName(this.schema),
    });
    const normalized = sessionToRecord(record);
    const columns = BASE_COLUMNS.map(column => parseSqlIdentifier(column, 'column name'));
    const insertColumns = columns.map(column => `[${column}]`).join(', ');
    const insertValues = columns.map(column => `@${column}`).join(', ');
    const updateClause = columns
      .filter(column => column !== 'id')
      .map(column => `[${column}] = @${column}`)
      .join(', ');
    const request = this.pool.request();
    for (const column of BASE_COLUMNS) {
      bindValue(request, column, normalized[column]);
    }

    await request.query(
      `MERGE INTO ${tableName} WITH (HOLDLOCK) AS target
       USING (SELECT @id AS [id]) AS source
       ON target.[id] = source.[id]
       WHEN MATCHED THEN UPDATE SET ${updateClause}
       WHEN NOT MATCHED THEN INSERT (${insertColumns}) VALUES (${insertValues});`,
    );
  }

  async listSessions(): Promise<SessionRecord[]> {
    const tableName = getTableName({
      indexName: TABLE_HARNESS_SESSIONS,
      schemaName: getSchemaName(this.schema),
    });
    const result = await this.pool.request().query(`SELECT * FROM ${tableName} ORDER BY [lastActivityAt] DESC`);
    return (result.recordset as HarnessSessionRow[]).map(rowToSession);
  }
}
