import {
  TABLE_MESSAGES,
  TABLE_OBSERVATIONAL_MEMORY,
  TABLE_RESOURCES,
  TABLE_SCHEMAS,
  TABLE_THREADS,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
import type { CreateIndexOptions, StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import type { Connection } from 'oracledb';
import type oracledb from 'oracledb';

import {
  asBindParameters,
  clobBind,
  executeDdl,
  executeOptions,
  jsonBind,
  rollbackQuietly,
  rows,
  safeJsonStringify,
} from '../../shared/connection';
import type { ObjectRow, OraclePoolManager } from '../../shared/connection';
import { normalizeIdentifier, qualifyName } from '../../vector/identifiers';

export type OracleQueryBinds = Record<string, unknown>;
export type OracleExecuteManyBinds = Array<Record<string, unknown> | unknown[]>;

export interface OracleDBConfig {
  poolManager: OraclePoolManager;
  schemaName?: string;
}

export interface OracleTxClient {
  execute<T extends ObjectRow = ObjectRow>(sql: string, binds?: OracleQueryBinds): Promise<T[]>;
  executeMany<T = unknown>(
    sql: string,
    binds: OracleExecuteManyBinds,
    options?: oracledb.ExecuteManyOptions,
  ): Promise<oracledb.Results<T> | undefined>;
  none(sql: string, binds?: OracleQueryBinds): Promise<void>;
  one<T extends ObjectRow = ObjectRow>(sql: string, binds?: OracleQueryBinds): Promise<T>;
  oneOrNone<T extends ObjectRow = ObjectRow>(sql: string, binds?: OracleQueryBinds): Promise<T | null>;
  manyOrNone<T extends ObjectRow = ObjectRow>(sql: string, binds?: OracleQueryBinds): Promise<T[]>;
}

type OracleWriteClient = Pick<OracleTxClient, 'none'>;

type PreparedField = {
  columnName: string;
  columnSql: string;
  bindName: string;
  value: unknown;
};

// Thin adapter around one Oracle connection. It gives storage domains a small
// API while keeping commit/rollback control in OracleDB.
class OracleConnectionClient implements OracleTxClient {
  constructor(private readonly connection: Connection) {}

  async execute<T extends ObjectRow = ObjectRow>(sql: string, binds: OracleQueryBinds = {}): Promise<T[]> {
    const result = await this.connection.execute<T>(sql, asBindParameters(binds), executeOptions());
    return rows(result);
  }

  async executeMany<T = unknown>(
    sql: string,
    binds: OracleExecuteManyBinds,
    options: oracledb.ExecuteManyOptions = {},
  ): Promise<oracledb.Results<T> | undefined> {
    if (binds.length === 0) return undefined;
    // executeMany is used for hot paths such as message writes; callers pass
    // explicit bind definitions when Oracle needs CLOB/JSON type information.
    return this.connection.executeMany<T>(sql, binds as oracledb.BindParameters[], options);
  }

  async none(sql: string, binds: OracleQueryBinds = {}): Promise<void> {
    await this.connection.execute(sql, asBindParameters(binds));
  }

  async one<T extends ObjectRow = ObjectRow>(sql: string, binds: OracleQueryBinds = {}): Promise<T> {
    const result = await this.execute<T>(sql, binds);
    if (result.length !== 1) {
      throw new Error(`Expected exactly one row but received ${result.length}`);
    }
    return result[0]!;
  }

  async oneOrNone<T extends ObjectRow = ObjectRow>(sql: string, binds: OracleQueryBinds = {}): Promise<T | null> {
    const result = await this.execute<T>(sql, binds);
    if (result.length > 1) {
      throw new Error(`Expected zero or one row but received ${result.length}`);
    }
    return result[0] ?? null;
  }

  async manyOrNone<T extends ObjectRow = ObjectRow>(sql: string, binds: OracleQueryBinds = {}): Promise<T[]> {
    return this.execute<T>(sql, binds);
  }
}

// OracleDB is the shared storage-domain facade for DDL, DML, transactions,
// schema qualification, and Mastra schema-to-Oracle type conversion.
export class OracleDB {
  constructor(private readonly config: OracleDBConfig) {}

  table(tableName: string): string {
    // Centralize schema qualification so domains never concatenate owner names by hand.
    return qualifyName(tableName, this.config.schemaName);
  }

  async execute<T extends ObjectRow = ObjectRow>(sql: string, binds: OracleQueryBinds = {}): Promise<T[]> {
    return this.config.poolManager.withConnection(async connection => new OracleConnectionClient(connection).execute<T>(sql, binds));
  }

  async executeMany<T = unknown>(
    sql: string,
    binds: OracleExecuteManyBinds,
    options: oracledb.ExecuteManyOptions = {},
  ): Promise<oracledb.Results<T> | undefined> {
    return this.config.poolManager.withConnection(async connection => {
      try {
        // Non-transactional bulk calls still commit once so domain code gets
        // predictable write visibility without managing connection state itself.
        const result = await new OracleConnectionClient(connection).executeMany<T>(sql, binds, options);
        await connection.commit();
        return result;
      } catch (error) {
        await rollbackQuietly(connection);
        throw error;
      }
    });
  }

  async withConnection<T>(callback: (connection: Connection) => Promise<T>): Promise<T> {
    return this.config.poolManager.withConnection(callback);
  }

  async none(sql: string, binds: OracleQueryBinds = {}): Promise<void> {
    await this.config.poolManager.withConnection(async connection => {
      await connection.execute(sql, asBindParameters(binds));
      await connection.commit();
    });
  }

  async one<T extends ObjectRow = ObjectRow>(sql: string, binds: OracleQueryBinds = {}): Promise<T> {
    const result = await this.execute<T>(sql, binds);
    if (result.length !== 1) {
      throw new Error(`Expected exactly one row but received ${result.length}`);
    }
    return result[0]!;
  }

  async oneOrNone<T extends ObjectRow = ObjectRow>(sql: string, binds: OracleQueryBinds = {}): Promise<T | null> {
    const result = await this.execute<T>(sql, binds);
    if (result.length > 1) {
      throw new Error(`Expected zero or one row but received ${result.length}`);
    }
    return result[0] ?? null;
  }

  async manyOrNone<T extends ObjectRow = ObjectRow>(sql: string, binds: OracleQueryBinds = {}): Promise<T[]> {
    return this.execute<T>(sql, binds);
  }

  async tx<T>(callback: (client: OracleTxClient, connection: Connection) => Promise<T>): Promise<T> {
    return this.config.poolManager.withConnection(async connection => {
      try {
        // Domains use this for multi-row mutations that must commit or roll back as one Oracle transaction.
        const result = await callback(new OracleConnectionClient(connection), connection);
        await connection.commit();
        return result;
      } catch (error) {
        await rollbackQuietly(connection);
        throw error;
      }
    });
  }

  async executeDdl(sql: string, ignoredErrorCodes: number[] = []): Promise<void> {
    await this.config.poolManager.withConnection(async connection => {
      await executeDdl(connection, sql, ignoredErrorCodes);
    });
  }

  async hasColumn(tableName: string, columnName: string): Promise<boolean> {
    const table = normalizeIdentifier(tableName, 'table name');
    const candidates = columnNameCandidates(columnName);
    const binds: OracleQueryBinds = { tableName: table };
    const ownerPredicate = this.config.schemaName ? ':ownerName' : `SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA')`;
    if (this.config.schemaName) {
      binds.ownerName = normalizeIdentifier(this.config.schemaName, 'schema name');
    }

    const columnPredicates = candidates.map((candidate, index) => {
      const bindName = `columnName${index}`;
      binds[bindName] = candidate;
      return `:${bindName}`;
    });

    // Older Oracle provider builds may have created quoted camelCase columns;
    // check both exact and upper-case candidates before running additive DDL.
    const row = await this.oneOrNone(
      `SELECT 1 AS "exists" FROM all_tab_columns WHERE owner = ${ownerPredicate} AND table_name = :tableName AND column_name IN (${columnPredicates.join(', ')}) FETCH FIRST 1 ROW ONLY`,
      binds,
    );
    return !!row;
  }

  async createTable({
    tableName,
    schema,
    compositePrimaryKey,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    compositePrimaryKey?: string[];
  }): Promise<void> {
    // Oracle does not support CREATE TABLE IF NOT EXISTS, so ORA-00955 is the idempotency path.
    await this.executeDdl(generateOracleTableSQL({ tableName, schema, schemaName: this.config.schemaName, compositePrimaryKey }), [
      -955,
    ]);
  }

  async alterTable({
    tableName,
    schema,
    ifNotExists,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    for (const columnName of ifNotExists) {
      const column = schema[columnName];
      if (!column) continue;
      if (await this.hasColumn(tableName, columnName)) continue;

      // Additive migrations use ALTER TABLE ADD and tolerate concurrent runs that add the same column first.
      await this.executeDdl(
        `ALTER TABLE ${this.table(tableName)} ADD (${oracleColumnDefinition(tableName, columnName, column, this.config.schemaName)})`,
        [-1430],
      );
    }
  }

  async insert({ tableName, record, schema }: OracleRecordOperation): Promise<void> {
    await executeInsert(this, this.table(tableName), tableName, record, schemaForTable(tableName, schema));
  }

  async batchInsert({ tableName, records, schema }: OracleBatchInsertOperation): Promise<void> {
    const tableSchema = schemaForTable(tableName, schema);
    const tableSql = this.table(tableName);
    await this.tx(async client => {
      // Keep batch inserts inside one transaction while reusing the same value
      // preparation path as single-row inserts for JSON, CLOB, and booleans.
      for (const record of records) {
        await executeInsert(client, tableSql, tableName, record, tableSchema);
      }
    });
  }

  async update({ tableName, keys, data, schema }: OracleUpdateOperation): Promise<void> {
    await executeUpdate(this, this.table(tableName), tableName, keys, data, schemaForTable(tableName, schema));
  }

  async batchUpdate({ tableName, updates, schema }: OracleBatchUpdateOperation): Promise<void> {
    const tableSchema = schemaForTable(tableName, schema);
    const tableSql = this.table(tableName);
    await this.tx(async client => {
      for (const { keys, data } of updates) {
        await executeUpdate(client, tableSql, tableName, keys, data, tableSchema);
      }
    });
  }

  async batchDelete({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, unknown>[] }): Promise<void> {
    if (keys.length === 0) return;
    await this.tx(async client => {
      for (const keySet of keys) {
        const { sql, binds } = whereFromKeys(keySet, 'k');
        await client.none(`DELETE FROM ${this.table(tableName)} WHERE ${sql}`, binds);
      }
    });
  }

  async merge({ tableName, keys, record, schema }: OracleMergeOperation): Promise<void> {
    if (keys.length === 0) {
      throw new Error('Oracle merge requires at least one key column');
    }

    const tableSchema = schemaForTable(tableName, schema);
    const keySet = new Set(keys);
    const fields = prepareRecord(tableName, record, tableSchema);
    if (fields.length === 0) return;

    for (const key of keys) {
      if (!fields.some(field => field.columnName === key)) {
        throw new Error(`Oracle merge record is missing key column ${key}`);
      }
    }

    const nonKeyFields = fields.filter(field => !keySet.has(field.columnName));
    const onClause = fields
      .filter(field => keySet.has(field.columnName))
      .map(field => `target.${field.columnSql} = :${field.bindName}`)
      .join(' AND ');
    const updateClause = nonKeyFields.map(field => `target.${field.columnSql} = :${field.bindName}`).join(', ');
    const insertColumns = fields.map(field => field.columnSql).join(', ');
    const insertValues = fields.map(field => `:${field.bindName}`).join(', ');
    const matchedClause = updateClause ? ` WHEN MATCHED THEN UPDATE SET ${updateClause}` : '';

    // MERGE gives domains a consistent upsert primitive without exposing Oracle-specific SQL at call sites.
    await this.none(
      `MERGE INTO ${this.table(tableName)} target USING dual ON (${onClause})${matchedClause} WHEN NOT MATCHED THEN INSERT (${insertColumns}) VALUES (${insertValues})`,
      bindsFromFields(fields),
    );
  }

  async load<R extends ObjectRow = ObjectRow>({ tableName, keys, schema, orderBy }: OracleLoadOperation): Promise<R | null> {
    const tableSchema = schemaForTable(tableName, schema);
    const { sql, binds } = whereFromKeys(keys, 'k');
    const orderClause = orderBy ?? (tableSchema.createdAt ? ` ORDER BY ${formatColumnName('createdAt')} DESC` : '');
    return this.oneOrNone<R>(`SELECT * FROM ${this.table(tableName)} WHERE ${sql}${orderClause} FETCH FIRST 1 ROW ONLY`, binds);
  }

  async createIndex(options: OracleCreateIndexOptions): Promise<void> {
    await this.config.poolManager.withConnection(async connection => {
      await createOracleIndex(connection, options, this.config.schemaName);
    });
  }

  async dropTable(tableName: TABLE_NAMES): Promise<void> {
    await this.executeDdl(`DROP TABLE ${this.table(tableName)}`, [-942]);
  }

  async clearTable(tableName: string): Promise<void> {
    await this.none(`DELETE FROM ${this.table(tableName)}`);
  }
}

export interface OracleRecordOperation {
  tableName: TABLE_NAMES;
  record: Record<string, unknown>;
  schema?: Record<string, StorageColumn>;
}

export interface OracleBatchInsertOperation {
  tableName: TABLE_NAMES;
  records: Record<string, unknown>[];
  schema?: Record<string, StorageColumn>;
}

export interface OracleUpdateOperation {
  tableName: TABLE_NAMES;
  keys: Record<string, unknown>;
  data: Record<string, unknown>;
  schema?: Record<string, StorageColumn>;
}

export interface OracleBatchUpdateOperation {
  tableName: TABLE_NAMES;
  updates: Array<{ keys: Record<string, unknown>; data: Record<string, unknown> }>;
  schema?: Record<string, StorageColumn>;
}

export interface OracleMergeOperation {
  tableName: TABLE_NAMES;
  keys: string[];
  record: Record<string, unknown>;
  schema?: Record<string, StorageColumn>;
}

export interface OracleLoadOperation {
  tableName: TABLE_NAMES;
  keys: Record<string, unknown>;
  schema?: Record<string, StorageColumn>;
  orderBy?: string;
}

export function parseOracleJson<T = unknown>(value: unknown): T | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string' && !Buffer.isBuffer(value)) return value as T;

  // Depending on driver fetch settings, Oracle JSON/CLOB values can arrive as
  // objects, strings, or buffers. Normalize all three into Mastra-facing values.
  const raw = Buffer.isBuffer(value) ? value.toString('utf8') : value;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as T;
  }
}

export type OracleIndexType = 'normal' | 'bitmap';

export interface OracleCreateIndexOptions
  extends Omit<CreateIndexOptions, 'concurrent' | 'method' | 'opclass' | 'storage'> {
  /**
   * Oracle index type. `normal` creates a standard B-tree/function-based index.
   * `bitmap` is useful for low-cardinality columns, but should be avoided for
   * high-write OLTP workloads.
   */
  type?: OracleIndexType;
  /**
   * Creates the index online. This is the Oracle-native equivalent of avoiding
   * long blocking DDL, subject to Oracle edition/version support.
   */
  online?: boolean;
  /** Marks the index invisible so it can be tested before optimizer use. */
  invisible?: boolean;
  /** Adds PARALLEL or PARALLEL n to speed large index builds. */
  parallel?: boolean | number;
  /** Adds COMPRESS or COMPRESS n for duplicate leading-key compression. */
  compress?: boolean | number;
  /** Adds NOLOGGING for faster bulk index builds when recoverability policy allows it. */
  noLogging?: boolean;
  /** Creates a reverse key index. Only valid for normal B-tree indexes. */
  reverse?: boolean;
}

type ParsedColumn = {
  expression: string;
  direction?: 'ASC' | 'DESC';
};

const SIMPLE_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/;
const LOWERCASE_SQL_IDENTIFIER = /^[a-z][a-z0-9_]*$/;
const QUOTED_IDENTIFIER = /^"([A-Za-z][A-Za-z0-9_]*)"$/;
const ORDERED_COLUMN = /^(.*?)(?:\s+(ASC|DESC))?$/i;
const UNSAFE_SQL = /;|--|\/\*|\*\/|\0|\b(CREATE|ALTER|DROP|TRUNCATE|INSERT|UPDATE|DELETE|MERGE|GRANT|REVOKE|COMMIT|ROLLBACK|EXECUTE|BEGIN|END)\b/i;
const RESERVED_COLUMN_NAMES = new Set(['references', 'size']);
const LONG_TEXT_COLUMNS = new Set([
  'activeObservations',
  'activeObservationsPendingUpdate',
  'bufferedObservations',
  'bufferedReflection',
  'changeMessage',
  'content',
  'description',
  'instructions',
  'analyzePrompt',
  'other',
  'extractPrompt',
  'generateReasonPrompt',
  'generateScorePrompt',
  'preprocessPrompt',
  'reason',
  'reasonPrompt',
  'workingMemory',
]);

const COLUMN_MAP: Record<string, Record<string, string>> = {
  ...Object.fromEntries(
    Object.entries(TABLE_SCHEMAS).map(([tableName, schema]) => [
      tableName,
      Object.fromEntries(Object.keys(schema).map(columnName => [columnName, formatColumnName(columnName)])),
    ]),
  ),
  [TABLE_THREADS]: {
    ...columnMapFor(TABLE_THREADS),
    id: 'id',
    resourceId: '"resourceId"',
    title: 'title',
    metadata: 'metadata',
    createdAt: '"createdAt"',
    updatedAt: '"updatedAt"',
  },
  [TABLE_MESSAGES]: {
    ...columnMapFor(TABLE_MESSAGES),
    id: 'id',
    thread_id: 'thread_id',
    content: 'content',
    role: 'role',
    type: 'type',
    resourceId: '"resourceId"',
    createdAt: '"createdAt"',
  },
  [TABLE_RESOURCES]: {
    ...columnMapFor(TABLE_RESOURCES),
    id: 'id',
    workingMemory: '"workingMemory"',
    metadata: 'metadata',
    createdAt: '"createdAt"',
    updatedAt: '"updatedAt"',
  },
  [TABLE_OBSERVATIONAL_MEMORY]: {
    ...columnMapFor(TABLE_OBSERVATIONAL_MEMORY),
    id: 'id',
    lookupKey: '"lookupKey"',
    scope: '"scope"',
    resourceId: '"resourceId"',
    threadId: '"threadId"',
    activeObservations: '"activeObservations"',
    activeObservationsPendingUpdate: '"activeObservationsPendingUpdate"',
    originType: '"originType"',
    config: 'config',
    generationCount: '"generationCount"',
    lastObservedAt: '"lastObservedAt"',
    lastReflectionAt: '"lastReflectionAt"',
    pendingMessageTokens: '"pendingMessageTokens"',
    totalTokensObserved: '"totalTokensObserved"',
    observationTokenCount: '"observationTokenCount"',
    isObserving: '"isObserving"',
    isReflecting: '"isReflecting"',
    observedMessageIds: '"observedMessageIds"',
    observedTimezone: '"observedTimezone"',
    bufferedObservationChunks: '"bufferedObservationChunks"',
    isBufferingObservation: '"isBufferingObservation"',
    isBufferingReflection: '"isBufferingReflection"',
    lastBufferedAtTokens: '"lastBufferedAtTokens"',
    lastBufferedAtTime: '"lastBufferedAtTime"',
    metadata: 'metadata',
    createdAt: '"createdAt"',
    updatedAt: '"updatedAt"',
  },
  [TABLE_WORKFLOW_SNAPSHOT]: {
    ...columnMapFor(TABLE_WORKFLOW_SNAPSHOT),
    workflow_name: 'workflow_name',
    run_id: 'run_id',
    resourceId: '"resourceId"',
    snapshot: 'snapshot',
    createdAt: '"createdAt"',
    updatedAt: '"updatedAt"',
  },
};

export function generateOracleTableSQL({
  tableName,
  schema,
  schemaName,
  compositePrimaryKey,
}: {
  tableName: TABLE_NAMES;
  schema: Record<string, StorageColumn>;
  schemaName?: string;
  compositePrimaryKey?: string[];
}): string {
  const compositePrimaryKeySet = compositePrimaryKey ? new Set(compositePrimaryKey) : undefined;
  const columns = Object.entries(schema).map(([columnName, column]) =>
    oracleColumnDefinition(tableName, columnName, column, schemaName, compositePrimaryKeySet),
  );
  const constraints = compositePrimaryKey?.length
    ? [`PRIMARY KEY (${compositePrimaryKey.map(columnName => formatColumnName(columnName)).join(', ')})`]
    : [];

  return `CREATE TABLE ${qualifyName(tableName, schemaName)} (\n  ${[...columns, ...constraints].join(',\n  ')}\n)`;
}

// Mastra storage schemas are database-neutral. This is where we choose Oracle
// native JSON for structured fields and CLOBs for prompts/messages that exceed VARCHAR2 limits.
export function oracleColumnType(tableName: TABLE_NAMES | string, columnName: string, column: StorageColumn): string {
  switch (column.type) {
    case 'text':
      if (column.primaryKey || isIdentifierLikeColumn(columnName)) return 'VARCHAR2(512)';
      if (isLongTextColumn(tableName, columnName)) return 'CLOB';
      return 'VARCHAR2(4000)';
    case 'uuid':
      return 'VARCHAR2(36)';
    case 'timestamp':
      return 'TIMESTAMP WITH TIME ZONE';
    case 'jsonb':
      return 'JSON';
    case 'integer':
      return 'NUMBER(10)';
    case 'bigint':
      return 'NUMBER(20)';
    case 'float':
      return 'BINARY_DOUBLE';
    case 'boolean':
      return 'NUMBER(1)';
    default:
      return 'VARCHAR2(4000)';
  }
}

function oracleColumnDefinition(
  tableName: TABLE_NAMES,
  columnName: string,
  column: StorageColumn,
  schemaName?: string,
  compositePrimaryKeySet?: Set<string>,
): string {
  const constraints: string[] = [];
  const isCompositePrimaryKeyColumn = compositePrimaryKeySet?.has(columnName);

  if (!column.nullable && !column.primaryKey) constraints.push('NOT NULL');
  if (column.primaryKey && !isCompositePrimaryKeyColumn) constraints.push('PRIMARY KEY');
  if (column.references) {
    constraints.push(
      `REFERENCES ${qualifyName(column.references.table, schemaName)} (${formatColumnName(column.references.column)})`,
    );
  }

  return [formatColumnName(columnName), oracleColumnType(tableName, columnName, column), ...constraints].join(' ');
}

function schemaForTable(tableName: TABLE_NAMES, schema?: Record<string, StorageColumn>): Record<string, StorageColumn> {
  return schema ?? TABLE_SCHEMAS[tableName];
}

async function executeInsert(
  client: OracleWriteClient,
  tableSql: string,
  tableName: TABLE_NAMES,
  record: Record<string, unknown>,
  schema: Record<string, StorageColumn>,
): Promise<void> {
  const fields = prepareRecord(tableName, record, schema);
  if (fields.length === 0) return;

  await client.none(
    `INSERT INTO ${tableSql} (${fields.map(field => field.columnSql).join(', ')}) VALUES (${fields
      .map(field => `:${field.bindName}`)
      .join(', ')})`,
    bindsFromFields(fields),
  );
}

async function executeUpdate(
  client: OracleWriteClient,
  tableSql: string,
  tableName: TABLE_NAMES,
  keys: Record<string, unknown>,
  data: Record<string, unknown>,
  schema: Record<string, StorageColumn>,
): Promise<void> {
  const fields = prepareRecord(tableName, data, schema, 'v');
  if (fields.length === 0) return;

  const { sql, binds } = whereFromKeys(keys, 'k');
  const assignments = fields.map(field => `${field.columnSql} = :${field.bindName}`).join(', ');
  await client.none(`UPDATE ${tableSql} SET ${assignments} WHERE ${sql}`, { ...binds, ...bindsFromFields(fields) });
}

function prepareRecord(
  tableName: TABLE_NAMES,
  record: Record<string, unknown>,
  schema: Record<string, StorageColumn>,
  bindPrefix = 'v',
): PreparedField[] {
  // Undefined means "do not touch this column"; null is preserved and written as SQL NULL / JSON null.
  return Object.entries(record)
    .filter(([, value]) => value !== undefined)
    .map(([columnName, value], index) => {
      const column = schema[columnName];
      return {
        columnName,
        columnSql: formatColumnName(columnName),
        bindName: `${bindPrefix}${index}`,
        value: prepareValue(tableName, columnName, value, column),
      };
    });
}

function bindsFromFields(fields: PreparedField[]): OracleQueryBinds {
  return Object.fromEntries(fields.map(field => [field.bindName, field.value]));
}

function whereFromKeys(keys: Record<string, unknown>, bindPrefix: string): { sql: string; binds: OracleQueryBinds } {
  const entries = Object.entries(keys).filter(([, value]) => value !== undefined);
  if (entries.length === 0) throw new Error('At least one key is required');

  // undefined means "not part of the key"; null is an intentional IS NULL
  // predicate so optional composite-key fields can still be matched.
  const binds: OracleQueryBinds = {};
  const sql = entries
    .map(([columnName, value], index) => {
      const bindName = `${bindPrefix}${index}`;
      if (value === null) return `${formatColumnName(columnName)} IS NULL`;
      binds[bindName] = value instanceof Date ? value : normalizePrimitiveBind(value);
      return `${formatColumnName(columnName)} = :${bindName}`;
    })
    .join(' AND ');

  return { sql, binds };
}

function prepareValue(
  tableName: TABLE_NAMES,
  columnName: string,
  value: unknown,
  column?: StorageColumn,
): unknown {
  // Respect Mastra's schema types first, then fall back to safe primitive binds.
  if (column?.type === 'jsonb') {
    if (value === null && column.nullable) return null;
    return jsonBind(value);
  }

  if (value === null) return null;
  if (value instanceof Date) return value;
  if (column?.type === 'boolean') return value ? 1 : 0;
  if (column?.type === 'text' && isLongTextColumn(tableName, columnName)) return clobBind(String(value));
  if (typeof value === 'object') return safeJsonStringify(value);

  return normalizePrimitiveBind(value);
}

function normalizePrimitiveBind(value: unknown): unknown {
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

function columnMapFor(tableName: string): Record<string, string> {
  const schema = TABLE_SCHEMAS[tableName as TABLE_NAMES];
  if (!schema) return {};
  return Object.fromEntries(Object.keys(schema).map(columnName => [columnName, formatColumnName(columnName)]));
}

function formatColumnName(columnName: string): string {
  const trimmed = columnName.trim();
  if (!SIMPLE_IDENTIFIER.test(trimmed)) {
    throw new Error(`column name must start with a letter and contain only letters, numbers, and underscores`);
  }
  if (RESERVED_COLUMN_NAMES.has(trimmed.toLowerCase())) return `"${trimmed}"`;
  // Preserve camelCase names with quotes because Mastra schemas use names like resourceId and createdAt.
  if (LOWERCASE_SQL_IDENTIFIER.test(trimmed)) return trimmed;
  return `"${trimmed}"`;
}

function columnNameCandidates(columnName: string): string[] {
  const trimmed = columnName.trim();
  if (!SIMPLE_IDENTIFIER.test(trimmed)) {
    throw new Error(`column name must start with a letter and contain only letters, numbers, and underscores`);
  }
  return Array.from(new Set([trimmed, trimmed.toUpperCase()]));
}

function isIdentifierLikeColumn(columnName: string): boolean {
  return columnName === 'id' || columnName === 'hash' || columnName.endsWith('Id') || columnName.endsWith('_id');
}

function isLongTextColumn(tableName: TABLE_NAMES | string, columnName: string): boolean {
  if (tableName === TABLE_THREADS && columnName === 'title') return false;
  return LONG_TEXT_COLUMNS.has(columnName);
}

// Custom indexes accept a constrained SQL surface so domains can expose useful
// Oracle options without letting arbitrary DDL fragments through provider config.
export function generateOracleIndexSQL(options: OracleCreateIndexOptions, schemaName?: string): string {
  validateIndexOptions(options);

  const table = canonicalTableName(options.table);
  const indexType = options.type ?? 'normal';
  const unique = options.unique ? 'UNIQUE ' : '';
  const bitmap = indexType === 'bitmap' ? 'BITMAP ' : '';
  const columns = options.columns.map(column => formatIndexColumn(table, column, options.where)).join(', ');
  const attributes = indexAttributes(options);

  return `CREATE ${unique}${bitmap}INDEX ${qualifyName(options.name, schemaName)} ON ${qualifyName(
    table,
    schemaName,
  )} (${columns})${attributes}`;
}

export async function createOracleIndex(
  connection: Connection,
  options: OracleCreateIndexOptions,
  schemaName?: string,
): Promise<void> {
  // ORA-01408 ("column list already indexed") must propagate rather than being
  // swallowed: a custom index request with different visibility, compression,
  // or tablespace settings than an existing index on the same columns must not
  // be silently skipped. Only ORA-00955 (name already used) is safe to ignore here.
  await executeDdl(connection, generateOracleIndexSQL(options, schemaName), [-955]);
}

export function filterIndexesForTables(
  indexes: OracleCreateIndexOptions[] | undefined,
  managedTables: readonly string[],
): OracleCreateIndexOptions[] {
  if (!indexes?.length) return [];
  const managed = new Set(managedTables.map(table => normalizeIdentifier(table, 'table name')));
  return indexes.filter(index => managed.has(normalizeIdentifier(index.table, 'table name')));
}

function validateIndexOptions(options: OracleCreateIndexOptions): void {
  normalizeIdentifier(options.name, 'index name');
  normalizeIdentifier(options.table, 'table name');

  if (!options.columns.length) {
    throw new Error(`Index ${options.name} must include at least one column or expression`);
  }
  if (options.unique && options.type === 'bitmap') {
    throw new Error(`Index ${options.name} cannot be both unique and bitmap`);
  }
  if (options.reverse && options.type === 'bitmap') {
    throw new Error(`Index ${options.name} cannot be both reverse and bitmap`);
  }
  if (options.where && options.type === 'bitmap') {
    throw new Error(`Index ${options.name} cannot emulate partial indexes with bitmap indexes`);
  }
  if (options.where) validateSqlFragment(options.where, 'index where clause');
  if (options.parallel !== undefined && options.parallel !== true && options.parallel !== false) {
    validatePositiveInteger(options.parallel, 'parallel');
  }
  if (typeof options.compress === 'number') {
    validatePositiveInteger(options.compress, 'compress');
  }
  if (options.tablespace) normalizeIdentifier(options.tablespace, 'tablespace name');
}

function formatIndexColumn(table: string, column: string, where?: string): string {
  const parsed = parseColumn(table, column);
  const expression = where ? `CASE WHEN (${where}) THEN ${parsed.expression} END` : parsed.expression;
  return parsed.direction ? `${expression} ${parsed.direction}` : expression;
}

function parseColumn(table: string, column: string): ParsedColumn {
  const trimmed = column.trim();
  if (!trimmed) throw new Error('Index column cannot be empty');

  // Custom index columns may be normal schema fields or vetted expressions such
  // as JSON_VALUE(...). Keep a narrow SQL surface before passing DDL to Oracle.
  const match = trimmed.match(ORDERED_COLUMN);
  const rawExpression = match?.[1]?.trim();
  const direction = match?.[2]?.toUpperCase() as 'ASC' | 'DESC' | undefined;
  if (!rawExpression) throw new Error(`Invalid index column: ${column}`);

  const quoted = rawExpression.match(QUOTED_IDENTIFIER);
  if (quoted) return { expression: `"${quoted[1]}"`, direction };

  if (SIMPLE_IDENTIFIER.test(rawExpression)) {
    return { expression: resolveColumnName(table, rawExpression), direction };
  }

  validateSqlFragment(rawExpression, 'index column expression');
  validateBalancedParentheses(rawExpression, 'index column expression');
  return { expression: rawExpression, direction };
}

function resolveColumnName(table: string, column: string): string {
  const mapped = COLUMN_MAP[table]?.[column];
  if (mapped) return mapped;
  return normalizeIdentifier(column, 'column name');
}

function canonicalTableName(table: string): string {
  const normalized = normalizeIdentifier(table, 'table name');
  return Object.keys(COLUMN_MAP).find(knownTable => normalizeIdentifier(knownTable, 'table name') === normalized) ?? table;
}

function indexAttributes(options: OracleCreateIndexOptions): string {
  const attributes: string[] = [];

  if (options.compress === true) attributes.push('COMPRESS');
  if (typeof options.compress === 'number') attributes.push(`COMPRESS ${options.compress}`);
  if (options.tablespace) attributes.push(`TABLESPACE ${normalizeIdentifier(options.tablespace, 'tablespace name')}`);
  if (options.noLogging) attributes.push('NOLOGGING');
  if (options.parallel === true) attributes.push('PARALLEL');
  if (typeof options.parallel === 'number') attributes.push(`PARALLEL ${options.parallel}`);
  if (options.reverse) attributes.push('REVERSE');
  if (options.online) attributes.push('ONLINE');
  if (options.invisible) attributes.push('INVISIBLE');

  return attributes.length ? ` ${attributes.join(' ')}` : '';
}

function validateSqlFragment(fragment: string, label: string): void {
  if (UNSAFE_SQL.test(fragment)) {
    throw new Error(`${label} contains unsafe SQL`);
  }
}

function validateBalancedParentheses(expression: string, label: string): void {
  let depth = 0;
  for (const char of expression) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth < 0) throw new Error(`${label} has unbalanced parentheses`);
  }
  if (depth !== 0) throw new Error(`${label} has unbalanced parentheses`);
}

function validatePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}
