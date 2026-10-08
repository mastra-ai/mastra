import { randomUUID } from 'node:crypto';

import {
  createKnowledgeCoreLoader,
  canonicalizeKnowledgeImporterBindingKey,
  canonicalizeKnowledgeNodeId,
  canonicalizeKnowledgeScopeIds,
  isKnowledgeNodeVisible,
  KNOWLEDGE_ACCESS_STATE_SCHEMA,
  KNOWLEDGE_IMPORT_RUNS_SCHEMA,
  KNOWLEDGE_IMPORT_STATE_SCHEMA,
  KNOWLEDGE_NODE_ADDRESSES_SCHEMA,
  KNOWLEDGE_NODE_SCOPES_SCHEMA,
  KNOWLEDGE_PROPOSALS_SCHEMA,
  KNOWLEDGE_RECORD_SCOPES_SCHEMA,
  KNOWLEDGE_SCHEMA_SCHEMA,
  KNOWLEDGE_SCOPE_ADDRESSES_SCHEMA,
  KNOWLEDGE_SCOPE_GRANTS_SCHEMA,
  KNOWLEDGE_STORAGE_CONTRACT_VERSION,
  KNOWLEDGE_STORAGE_SCHEMA_VERSION,
  KNOWLEDGE_RESET_GUIDANCE,
  KNOWLEDGE_TABLE_NAMES,
  knowledgeScopeIdsKey,
  isPublishedKnowledgeV1Layout,
  PUBLISHED_KNOWLEDGE_V1_COLUMNS,
  PUBLISHED_KNOWLEDGE_V1_INDEX_NAMES,
  RETIRED_KNOWLEDGE_TABLE_NAMES,
  TABLE_KNOWLEDGE_ACCESS_STATE,
  TABLE_KNOWLEDGE_IMPORT_RUNS,
  TABLE_KNOWLEDGE_IMPORT_STATE,
  TABLE_KNOWLEDGE_NODE_ADDRESSES,
  TABLE_KNOWLEDGE_NODE_SCOPES,
  TABLE_KNOWLEDGE_PROPOSALS,
  TABLE_KNOWLEDGE_RECORD_SCOPES,
  TABLE_KNOWLEDGE_SCHEMA,
  TABLE_KNOWLEDGE_SCOPE_ADDRESSES,
  TABLE_KNOWLEDGE_SCOPE_GRANTS,
} from '@internal/core/knowledge-compat';
import { coreFeatures } from '@mastra/core/features';
import {
  createKnowledgeUlid,
  isKnowledgeScopeVisible,
  KNOWLEDGE_SEMANTIC_OUTBOX_SCHEMA,
  KNOWLEDGE_ACTIVITY_SCHEMA,
  KNOWLEDGE_MENTIONS_SCHEMA,
  KNOWLEDGE_NODES_SCHEMA,
  KNOWLEDGE_RECORDS_SCHEMA,
  knowledgeSemanticDocumentId,
  knowledgeSemanticIdempotencyKey,
  KnowledgeConflictError,
  KnowledgeNotFoundError,
  KnowledgeStorage,
  parseKnowledgeNodeCursor,
  parseKnowledgeWikilinks,
  TABLE_KNOWLEDGE_ACTIVITY,
  TABLE_KNOWLEDGE_MENTIONS,
  TABLE_KNOWLEDGE_NODES,
  TABLE_KNOWLEDGE_RECORDS,
  TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  ClaimKnowledgeImportRunInput,
  CreateKnowledgeRecordInput,
  ClaimKnowledgeSemanticOutboxInput,
  CreateKnowledgeImportRunInput,
  CreateKnowledgeNodeInput,
  EnqueueKnowledgeImportRunInput,
  FinalizeKnowledgeImportRunInput,
  HeartbeatKnowledgeImportRunInput,
  KnowledgeActivityAction,
  KnowledgeActivityEvent,
  KnowledgeCurationCursor,
  KnowledgeImportRun,
  KnowledgeImportState,
  KnowledgeNode,
  KnowledgeNodeAddress,
  KnowledgeRecord,
  KnowledgeScopeAddress,
  KnowledgeScopeIds,
  KnowledgeSemanticDocumentType,
  KnowledgeStructurePlan,
  KnowledgeStructureReconcileResult,
  KnowledgeSemanticOperation,
  KnowledgeSemanticOutboxEntry,
  QueryKnowledgeRecordsBySourceInput,
  QueryKnowledgeRecordsInput,
  QueryKnowledgeRecordsOutput,
  RecoverKnowledgeImportRunInput,
  ListKnowledgeImportRunsInput,
  ListKnowledgeImportRunsOutput,
  ListKnowledgeNodesInput,
  SearchKnowledgeInput,
  KNOWLEDGE_TABLE_NAME,
  SearchKnowledgeResult,
  StorageColumn,
  TABLE_NAMES,
  UpdateKnowledgeImportRunInput,
  UpdateKnowledgeNodeInput,
} from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';

import { defaults as pgDefaults } from 'pg';

import { parseSchemaName } from '../../../shared/schema-name';
import type { QueryValues, TxClient } from '../../client';
import { generateTableSQL, PgDB, resolvePgConfig } from '../../db';
import type { DbClient, PgDomainConfig } from '../../db';
import { toPgJson } from '../../db/sanitize-json';
import { isDuplicateSchemaError } from '../../db/pg-errors';
import { getSchemaSnapshot } from '../../db/schema-snapshot';

const loadKnowledgeCore = createKnowledgeCoreLoader(coreFeatures, () => import('@mastra/core/storage'));

interface QueryResult {
  rows: Record<string, unknown>[];
  rowsAffected: number;
}

interface Executor {
  execute(statement: string | { sql: string; args?: QueryValues }): Promise<QueryResult>;
}

const camelCaseColumns = [
  'createdAt',
  'updatedAt',
  'deletedAt',
  'deletedBy',
  'recordId',
  'idempotencyKey',
  'documentId',
  'documentType',
  'availableAt',
  'claimedAt',
  'claimedBy',
  'completedAt',
  'isScope',
  'nodeId',
  'targetNodeId',
  'scopeNodeId',
  'scopeRefId',
  'canSuggest',
  'importerId',
  'importKind',
  'triggerKind',
  'transcriptThreadId',
  'traceId',
  'queuedAt',
  'startedAt',
  'targetType',
  'targetId',
  'contextScopeId',
  'scopeIds',
  'importRunId',
  'proposerContextScopeId',
  'expectedVersion',
  'reviewerContextScopeId',
  'reviewedAt',
  'addedAt',
] as const;

function transformSqlCode(sql: string, transform: (code: string) => string): string {
  return sql
    .split(/('(?:''|[^'])*')/g)
    .map((part, index) => (index % 2 === 0 ? transform(part) : part))
    .join('');
}

export function postgresSql(sql: string, schemaName?: string): string {
  let normalized = transformSqlCode(sql, code => {
    let transformed = code.replace(/jsonb\(\?\)/g, '?::jsonb');
    for (const column of camelCaseColumns) {
      transformed = transformed.replace(new RegExp(`(?<!")\\b${column}\\b(?!")`, 'g'), `"${column}"`);
    }
    return transformed;
  });
  if (schemaName) {
    const quotedSchema = `"${parseSchemaName(schemaName)}"`;
    normalized = transformSqlCode(normalized, code => {
      let transformed = code;
      for (const table of [...KNOWLEDGE_TABLE_NAMES, ...RETIRED_KNOWLEDGE_TABLE_NAMES]) {
        transformed = transformed.replaceAll(`"${table}"`, `${quotedSchema}."${table}"`);
      }
      return transformed;
    });
  }
  let index = 0;
  return transformSqlCode(normalized, code => code.replace(/\?/g, () => `$${++index}`));
}

function createExecutor(client: Pick<DbClient, 'query'> | TxClient, schemaName?: string): Executor {
  return {
    async execute(statement) {
      const sql = typeof statement === 'string' ? statement : statement.sql;
      const args = typeof statement === 'string' ? [] : (statement.args ?? []);
      const result = await client.query(postgresSql(sql, schemaName), args);
      return { rows: result.rows as Record<string, unknown>[], rowsAffected: result.rowCount ?? 0 };
    },
  };
}

const visibleSql = (scopeColumn = 'scope') => `${scopeColumn} <@ CAST(? AS jsonb)`;

function parseJson<T>(value: unknown): T {
  if (typeof value === 'string') return JSON.parse(value) as T;
  if (value instanceof Uint8Array) return JSON.parse(new TextDecoder().decode(value)) as T;
  if (value instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(value)) as T;
  return value as T;
}

/**
 * Knowledge timestamps are written as UTC digits into timezone-naive columns
 * ({@link postgresTimestamp} and the ISO strings passed to inserts), but the
 * driver parses naive columns in the process-local timezone. Reinterpret the
 * parsed components as UTC so reads return the digits that were stored.
 */
function toDate(value: unknown): Date {
  if (value instanceof Date) {
    return new Date(
      Date.UTC(
        value.getFullYear(),
        value.getMonth(),
        value.getDate(),
        value.getHours(),
        value.getMinutes(),
        value.getSeconds(),
        value.getMilliseconds(),
      ),
    );
  }
  const text = String(value);
  if (/(Z|[+-]\d{2}(:?\d{2})?)$/.test(text)) return new Date(text);
  return new Date(`${text.replace(' ', 'T')}Z`);
}

function optionalDate(value: unknown): Date | undefined {
  return value == null ? undefined : toDate(value);
}

function postgresTimestamp(value: Date): string {
  const pad = (part: number, width = 2) => String(part).padStart(width, '0');
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}.${pad(value.getUTCMilliseconds(), 3)}`;
}

function canonicalName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function importStateKey(input: { importerId: string; binding: string; key: string }): [string, string, string] {
  return [input.importerId, input.binding, input.key];
}

function assertImportRunTransition(
  from: KnowledgeImportRun['status'],
  to: UpdateKnowledgeImportRunInput['status'],
): void {
  const allowed =
    from === 'queued'
      ? to === 'running' || to === 'interrupted'
      : from === 'running'
        ? to === 'succeeded' || to === 'failed' || to === 'interrupted'
        : false;
  if (!allowed) throw new KnowledgeConflictError(`Import run cannot transition from ${from} to ${to}`);
}

function visibleNodeSql(scopeIds: KnowledgeScopeIds): string {
  return `EXISTS (SELECT 1 FROM "${TABLE_KNOWLEDGE_NODE_SCOPES}" v WHERE v.nodeId=n.id AND v.scopeNodeId IN (${scopeIds.map(() => '?').join(',')}))`;
}

/** A record is visible when one of its scopes is, its parent is live and visible, and so is every mention target. */
function visibleRecordSql(scopeIds: KnowledgeScopeIds): { sql: string; args: string[] } {
  const visibleNode = (alias: string) =>
    `${alias}.deletedAt IS NULL AND EXISTS (SELECT 1 FROM "${TABLE_KNOWLEDGE_NODE_SCOPES}" v WHERE v.nodeId=${alias}.id AND v.scopeNodeId IN (${scopeIds.map(() => '?').join(',')}))`;
  return {
    sql: `EXISTS (SELECT 1 FROM "${TABLE_KNOWLEDGE_RECORD_SCOPES}" rs WHERE rs.recordId=r.id AND rs.scopeNodeId IN (${scopeIds.map(() => '?').join(',')})) AND ${visibleNode('p')} AND NOT EXISTS (SELECT 1 FROM "${TABLE_KNOWLEDGE_MENTIONS}" m WHERE m.recordId=r.id AND NOT EXISTS (SELECT 1 FROM "${TABLE_KNOWLEDGE_NODES}" t WHERE t.id=m.targetNodeId AND ${visibleNode('t')}))`,
    args: [...scopeIds, ...scopeIds, ...scopeIds],
  };
}

function nodeReferenceId(node: KnowledgeNode | string): string {
  return typeof node === 'string' ? node : node.id;
}

function escapeLikePattern(value: string): string {
  return value.replaceAll('=', '==').replaceAll('%', '=%').replaceAll('_', '=_');
}

function parseNode(row: Record<string, unknown>): KnowledgeNode {
  return {
    id: String(row.id),
    type: 'node',
    name: String(row.name),
    kind: row.kind == null ? undefined : String(row.kind),
    isScope: Boolean(row.isScope),
    metadata: row.metadata == null ? undefined : parseJson<Record<string, unknown>>(row.metadataJson ?? row.metadata),
    version: Number(row.version),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
    deletedAt: optionalDate(row.deletedAt),
    deletedBy: row.deletedBy == null ? undefined : String(row.deletedBy),
  };
}

function parseKnowledge(row: Record<string, unknown>): KnowledgeRecord {
  return {
    id: String(row.id),
    nodeId: String(row.nodeId),
    text: String(row.text),
    metadata: row.metadata == null ? undefined : parseJson<Record<string, unknown>>(row.metadataJson ?? row.metadata),
    source: row.source == null ? undefined : String(row.source),
    version: Number(row.version),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
    deletedAt: optionalDate(row.deletedAt),
    deletedBy: row.deletedBy == null ? undefined : String(row.deletedBy),
  };
}

function parseImportRun(row: Record<string, unknown>): KnowledgeImportRun {
  return {
    id: String(row.id),
    importerId: String(row.importerId),
    binding: String(row.binding),
    importKind: String(row.importKind) as KnowledgeImportRun['importKind'],
    triggerKind: String(row.triggerKind) as KnowledgeImportRun['triggerKind'],
    status: String(row.status) as KnowledgeImportRun['status'],
    error: row.error == null ? undefined : String(row.error),
    transcriptThreadId: row.transcriptThreadId == null ? undefined : String(row.transcriptThreadId),
    traceId: row.traceId == null ? undefined : String(row.traceId),
    queuedAt: toDate(row.queuedAt),
    startedAt: optionalDate(row.startedAt),
    completedAt: optionalDate(row.completedAt),
  };
}

function parseOutbox(row: Record<string, unknown>): KnowledgeSemanticOutboxEntry {
  return {
    id: String(row.id),
    idempotencyKey: String(row.idempotencyKey),
    documentId: String(row.documentId),
    documentType: String(row.documentType) as KnowledgeSemanticDocumentType,
    operation: String(row.operation) as KnowledgeSemanticOperation,
    scopeIds: parseJson(row.scopeIdsJson ?? row.scopeIds),
    status: String(row.status) as KnowledgeSemanticOutboxEntry['status'],
    attempts: Number(row.attempts),
    availableAt: toDate(row.availableAt),
    claimedAt: optionalDate(row.claimedAt),
    claimedBy: row.claimedBy == null ? undefined : String(row.claimedBy),
    createdAt: toDate(row.createdAt),
    completedAt: optionalDate(row.completedAt),
  };
}

function knowledgeIndexes(schemaName?: string): Array<{ name: string; sql: string }> {
  const table = (name: string) => {
    const quotedName = `"${parseSqlIdentifier(name, 'table name')}"`;
    return schemaName ? `"${parseSchemaName(schemaName)}".${quotedName}` : quotedName;
  };
  return [
    {
      name: 'idx_knowledge_nodes_name',
      sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_name ON ${table(TABLE_KNOWLEDGE_NODES)} (lower("name"));`,
    },
    {
      name: 'idx_knowledge_records_node_latest',
      sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_records_node_latest ON ${table(TABLE_KNOWLEDGE_RECORDS)} ("nodeId", "id" DESC);`,
    },
    {
      name: 'idx_knowledge_mentions_target',
      sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_mentions_target ON ${table(TABLE_KNOWLEDGE_MENTIONS)} ("targetNodeId", "recordId");`,
    },
    {
      name: 'idx_knowledge_activity_latest',
      sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_activity_latest ON ${table(TABLE_KNOWLEDGE_ACTIVITY)} ("id" DESC);`,
    },
    {
      name: 'idx_knowledge_outbox_idempotency',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_outbox_idempotency ON ${table(TABLE_KNOWLEDGE_SEMANTIC_OUTBOX)} ("idempotencyKey");`,
    },
    {
      name: 'idx_knowledge_outbox_claim',
      sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_outbox_claim ON ${table(TABLE_KNOWLEDGE_SEMANTIC_OUTBOX)} ("status", "availableAt", "createdAt");`,
    },
    {
      name: 'idx_knowledge_node_scopes_scope',
      sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_node_scopes_scope ON ${table(TABLE_KNOWLEDGE_NODE_SCOPES)} ("scopeNodeId", "nodeId");`,
    },
    {
      name: 'idx_knowledge_record_scopes_scope',
      sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_record_scopes_scope ON ${table(TABLE_KNOWLEDGE_RECORD_SCOPES)} ("scopeNodeId", "recordId");`,
    },
    {
      name: 'idx_knowledge_scope_grants_ref',
      sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_scope_grants_ref ON ${table(TABLE_KNOWLEDGE_SCOPE_GRANTS)} ("scopeRefId", "scopeNodeId");`,
    },
    {
      name: 'idx_knowledge_node_addresses_node',
      sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_node_addresses_node ON ${table(TABLE_KNOWLEDGE_NODE_ADDRESSES)} ("nodeId");`,
    },
    {
      name: 'idx_knowledge_import_runs_lookup',
      sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_import_runs_lookup ON ${table(TABLE_KNOWLEDGE_IMPORT_RUNS)} ("importerId", "binding", "queuedAt" DESC);`,
    },
    {
      name: 'idx_knowledge_activity_import_run',
      sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_activity_import_run ON ${table(TABLE_KNOWLEDGE_ACTIVITY)} ("importRunId", "id" DESC);`,
    },
  ];
}

function knowledgeIndexDDL(schemaName?: string): string[] {
  return knowledgeIndexes(schemaName).map(index => index.sql);
}

const knowledgeTableDefinitions: Array<{
  tableName: TABLE_NAMES | KNOWLEDGE_TABLE_NAME;
  schema: Record<string, StorageColumn>;
  compositePrimaryKey?: string[];
}> = [
  { tableName: TABLE_KNOWLEDGE_NODES, schema: KNOWLEDGE_NODES_SCHEMA },
  { tableName: TABLE_KNOWLEDGE_RECORDS, schema: KNOWLEDGE_RECORDS_SCHEMA },
  {
    tableName: TABLE_KNOWLEDGE_MENTIONS,
    schema: KNOWLEDGE_MENTIONS_SCHEMA,
    compositePrimaryKey: ['recordId', 'targetNodeId'],
  },
  {
    tableName: TABLE_KNOWLEDGE_NODE_SCOPES,
    schema: KNOWLEDGE_NODE_SCOPES_SCHEMA,
    compositePrimaryKey: ['nodeId', 'scopeNodeId'],
  },
  {
    tableName: TABLE_KNOWLEDGE_RECORD_SCOPES,
    schema: KNOWLEDGE_RECORD_SCOPES_SCHEMA,
    compositePrimaryKey: ['recordId', 'scopeNodeId'],
  },
  {
    tableName: TABLE_KNOWLEDGE_SCOPE_GRANTS,
    schema: KNOWLEDGE_SCOPE_GRANTS_SCHEMA,
    compositePrimaryKey: ['scopeNodeId', 'scopeRefId'],
  },
  { tableName: TABLE_KNOWLEDGE_ACCESS_STATE, schema: KNOWLEDGE_ACCESS_STATE_SCHEMA },
  { tableName: TABLE_KNOWLEDGE_SCOPE_ADDRESSES, schema: KNOWLEDGE_SCOPE_ADDRESSES_SCHEMA },
  {
    tableName: TABLE_KNOWLEDGE_NODE_ADDRESSES,
    schema: KNOWLEDGE_NODE_ADDRESSES_SCHEMA,
    compositePrimaryKey: ['source', 'address'],
  },
  {
    tableName: TABLE_KNOWLEDGE_IMPORT_STATE,
    schema: KNOWLEDGE_IMPORT_STATE_SCHEMA,
    compositePrimaryKey: ['importerId', 'binding', 'key'],
  },
  { tableName: TABLE_KNOWLEDGE_IMPORT_RUNS, schema: KNOWLEDGE_IMPORT_RUNS_SCHEMA },
  { tableName: TABLE_KNOWLEDGE_PROPOSALS, schema: KNOWLEDGE_PROPOSALS_SCHEMA },
  { tableName: TABLE_KNOWLEDGE_ACTIVITY, schema: KNOWLEDGE_ACTIVITY_SCHEMA },
  { tableName: TABLE_KNOWLEDGE_SEMANTIC_OUTBOX, schema: KNOWLEDGE_SEMANTIC_OUTBOX_SCHEMA },
  { tableName: TABLE_KNOWLEDGE_SCHEMA, schema: KNOWLEDGE_SCHEMA_SCHEMA },
];

type PgKnowledgeIsolationConfig = {
  schemaName?: string;
  client?: DbClient;
  pool?: object;
  connectionString?: string;
  host?: string;
  port?: number | string;
  database?: string;
  user?: string;
};

type PgConnectionField = 'host' | 'port' | 'database' | 'user';

// Mirrors how `pg` resolves each connection field: explicit option, then PG* env var, then pg.defaults.
function pgSetting(config: Partial<Record<PgConnectionField, unknown>>, key: PgConnectionField): string | undefined {
  const value = config[key] || process.env[`PG${key.toUpperCase()}`] || pgDefaults[key];
  return value === undefined || value === null || value === '' ? undefined : String(value);
}

function effectivePgTarget(config: Partial<Record<PgConnectionField, unknown>>): string | undefined {
  const host = pgSetting(config, 'host');
  const database = pgSetting(config, 'database') ?? pgSetting(config, 'user');
  if (!host || !database) return undefined;
  const canonicalHost = host.startsWith('/') ? host : host.toLocaleLowerCase();
  return `${canonicalHost}:${pgSetting(config, 'port') ?? '5432'}/${database}`;
}

function canonicalPgTarget(config: PgKnowledgeIsolationConfig): string | undefined {
  if (config.connectionString) {
    try {
      const parsed = new URL(config.connectionString);
      return effectivePgTarget({
        host: decodeURIComponent(parsed.hostname) || config.host,
        port: parsed.port || config.port,
        database: decodeURIComponent(parsed.pathname.slice(1)) || config.database,
        user: decodeURIComponent(parsed.username) || config.user,
      });
    } catch {
      return config.connectionString;
    }
  }
  return effectivePgTarget(config);
}

function pgSourceConfig(source: object | undefined): PgKnowledgeIsolationConfig | undefined {
  if (!source || !('options' in source)) return undefined;
  return (source as { options?: PgKnowledgeIsolationConfig }).options;
}

function pgClientPool(client: DbClient | undefined): object | undefined {
  if (!client || !('$pool' in client)) return undefined;
  return (client as DbClient & { $pool?: object }).$pool;
}

export function getPgKnowledgeIsolationKey(config: PgKnowledgeIsolationConfig): unknown {
  const schema = config.schemaName ?? 'public';
  const pool = config.pool ?? pgClientPool(config.client);
  const poolConfig = pgSourceConfig(pool);
  const hasOwnTarget = Boolean(config.connectionString || config.host || config.database);
  const target = hasOwnTarget ? canonicalPgTarget(config) : poolConfig ? canonicalPgTarget(poolConfig) : undefined;
  if (target) return `pg:${target}:schema:${schema}`;
  // Without a resolvable target, assume any two such stores may share a database so registration fails closed.
  // Callers that know the stores are distinct can pass storageIsolationKey.
  return `pg:unidentified:schema:${schema}`;
}

// Duplicated from Core so this adapter keeps working against Core versions that predate the deprecation.
const KNOWLEDGE_CURATION_CURSOR_REMOVED_MESSAGE =
  'Knowledge curation cursors were removed: observation-time curate is the only Knowledge writer and needs no cursor.';

const KNOWLEDGE_DEPENDENTS_MESSAGE =
  'Knowledge storage cannot be replaced: other database objects (views, materialized views, or foreign keys) depend on the existing Knowledge tables. Drop or detach them first; `dangerouslyReset()` removes only Knowledge tables and will not drop them.';

function isDependentObjectsError(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '2BP01';
}

export class KnowledgePG extends KnowledgeStorage {
  static readonly MANAGED_TABLES = KNOWLEDGE_TABLE_NAMES;

  static getExportDDL(schemaName?: string): string[] {
    return [
      ...knowledgeTableDefinitions.map(definition =>
        generateTableSQL({
          ...definition,
          schemaName,
          includeAllConstraints: true,
        }),
      ),
      ...knowledgeIndexDDL(schemaName),
    ];
  }

  readonly #client: DbClient;
  readonly #executor: Executor;
  /** Reader-backed executor for standalone reads; mutations and read-modify-write stay on #executor. */
  readonly #readExecutor: Executor;
  readonly #db: PgDB;
  readonly #schemaName?: string;

  constructor(config: PgDomainConfig) {
    super({ storageIsolationKey: config.storageIsolationKey ?? getPgKnowledgeIsolationKey(config) });
    const { client, readClient, schemaName, skipDefaultIndexes } = resolvePgConfig(config);
    this.#client = client;
    this.#schemaName = schemaName;
    this.#executor = createExecutor(client, schemaName);
    this.#readExecutor = createExecutor(readClient, schemaName);
    this.#db = new PgDB({ client, readClient, schemaName, skipDefaultIndexes });
  }

  override getCapabilities() {
    return {
      supported: true,
      contractVersion: KNOWLEDGE_STORAGE_CONTRACT_VERSION,
      schemaVersion: KNOWLEDGE_STORAGE_SCHEMA_VERSION,
    } as const;
  }

  async init(): Promise<void> {
    const { KnowledgeSchemaError } = await loadKnowledgeCore();
    let snapshot = getSchemaSnapshot(this.#client, this.#schemaName);
    let existingNames = await this.#knowledgeTableNames(snapshot);
    if (!existingNames.has(TABLE_KNOWLEDGE_SCHEMA)) {
      const dropped = await this.#initializeCanonicalSchema();
      if (snapshot) {
        for (const table of dropped.tables) this.#db.noteTableDropped(table);
        for (const index of dropped.indexes) this.#db.noteIndexDropped(index);
      }
      // The catalog snapshot predates first boot; verify against the live catalog instead.
      snapshot = null;
      existingNames = await this.#knowledgeTableNames(null);
    }
    const marker = await this.#executor.execute(
      `SELECT "version" FROM "${TABLE_KNOWLEDGE_SCHEMA}" WHERE "id" = 'canonical'`,
    );
    if (Number(marker.rows[0]?.version) !== KNOWLEDGE_STORAGE_SCHEMA_VERSION) {
      throw new KnowledgeSchemaError(
        `Knowledge schema reset required: the existing Knowledge schema version is unsupported. ${KNOWLEDGE_RESET_GUIDANCE}`,
      );
    }
    const missing = KNOWLEDGE_TABLE_NAMES.filter(table => !existingNames.has(table));
    if (missing.length > 0)
      throw new KnowledgeSchemaError(
        `Knowledge schema reset required: the existing Knowledge schema is missing ${missing.join(', ')}. ${KNOWLEDGE_RESET_GUIDANCE}`,
      );
    const columnsByTable = snapshot?.columns ?? new Map<string, Set<string>>();
    if (!snapshot) {
      const existingColumns = await this.#executor.execute({
        sql: `SELECT table_name AS "tableName", column_name AS "columnName" FROM information_schema.columns WHERE table_schema = COALESCE(?, current_schema()) AND table_name LIKE 'mastra_knowledge_%'`,
        args: [this.#schemaName ?? null],
      });
      for (const row of existingColumns.rows) {
        const columns = columnsByTable.get(String(row.tableName)) ?? new Set<string>();
        columns.add(String(row.columnName));
        columnsByTable.set(String(row.tableName), columns);
      }
    }
    for (const table of KNOWLEDGE_TABLE_NAMES) {
      const actual = columnsByTable.get(table) ?? new Set<string>();
      const missingColumns = Object.keys(TABLE_SCHEMAS[table]).filter(column => !actual.has(column));
      if (missingColumns.length > 0) {
        throw new KnowledgeSchemaError(
          `Knowledge schema reset required: the existing Knowledge table ${table} is missing ${missingColumns.join(', ')}. ${KNOWLEDGE_RESET_GUIDANCE}`,
        );
      }
    }

    // Converge on an already-canonical schema; on a warm snapshot these are no-ops that need no CREATE privilege.
    for (const definition of knowledgeTableDefinitions) await this.#db.createTable(definition);
    await Promise.all(
      knowledgeIndexes(this.#schemaName).map(index => this.#db.createIndexFromStatement(index.name, index.sql)),
    );
  }

  async #knowledgeTableNames(snapshot: ReturnType<typeof getSchemaSnapshot>): Promise<Set<string>> {
    if (snapshot) return new Set([...snapshot.tables].filter(table => table.startsWith('mastra_knowledge_')));
    const result = await this.#executor.execute({
      sql: `SELECT table_name AS "tableName" FROM information_schema.tables WHERE table_schema = COALESCE(?, current_schema()) AND table_name LIKE 'mastra_knowledge_%'`,
      args: [this.#schemaName ?? null],
    });
    return new Set(result.rows.map(row => String(row.tableName)));
  }

  /**
   * First boot runs in one transaction under a schema-wide advisory lock: replacing the published v1
   * layout, creating every canonical table and index, and writing the completion marker either all
   * commit or all roll back, and concurrent processes serialize so exactly one initializes while the
   * rest observe the marker. Anything other than no Knowledge tables or the published v1 layout is
   * rejected without mutation.
   */
  async #initializeCanonicalSchema(): Promise<{ tables: string[]; indexes: string[] }> {
    const { KnowledgeSchemaError } = await loadKnowledgeCore();
    // Only create a missing schema: CREATE SCHEMA IF NOT EXISTS needs CREATE on the database even when the
    // schema exists, which roles granted only schema privileges lack. Done outside the transaction because a
    // lost race with store init raises an error that would abort it.
    if (this.#schemaName) {
      const schemaName = parseSchemaName(this.#schemaName);
      const present = await this.#client.oneOrNone('SELECT 1 FROM pg_namespace WHERE nspname = $1', [schemaName]);
      if (!present) {
        await this.#client.none(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`).catch(error => {
          if (!isDuplicateSchemaError(error)) throw error;
        });
      }
    }
    return this.#client.tx(async client => {
      const tx = createExecutor(client, this.#schemaName);
      // Key on the resolved schema so stores naming it explicitly and stores relying on search_path serialize together.
      // With no schema selected the key is NULL and nothing locks, but table creation then fails before any write.
      await tx.execute({
        sql: `SELECT pg_advisory_xact_lock(hashtext('mastra-knowledge-init:' || COALESCE(?, current_schema())))`,
        args: [this.#schemaName ?? null],
      });
      const existing = await tx.execute({
        sql: `SELECT table_name AS "tableName" FROM information_schema.tables WHERE table_schema = COALESCE(?, current_schema()) AND table_name LIKE 'mastra\\_knowledge\\_%'`,
        args: [this.#schemaName ?? null],
      });
      const names = new Set(existing.rows.map(row => String(row.tableName)));
      if (names.has(TABLE_KNOWLEDGE_SCHEMA)) return { tables: [], indexes: [] };
      let dropped: { tables: string[]; indexes: string[] } = { tables: [], indexes: [] };
      if (names.size > 0) {
        const replaced = await this.#replacePublishedV1(tx);
        if (replaced === 'dependents') throw new KnowledgeSchemaError(KNOWLEDGE_DEPENDENTS_MESSAGE);
        if (!replaced) {
          throw new KnowledgeSchemaError(
            `Knowledge schema reset required: the existing Knowledge schema has no completion marker. ${KNOWLEDGE_RESET_GUIDANCE}`,
          );
        }
        dropped = replaced;
      }
      for (const definition of knowledgeTableDefinitions) {
        await client.none(generateTableSQL({ ...definition, schemaName: this.#schemaName }));
      }
      for (const index of knowledgeIndexes(this.#schemaName)) await client.none(index.sql);
      await tx.execute(
        `INSERT INTO "${TABLE_KNOWLEDGE_ACCESS_STATE}" (id,epoch) VALUES ('global',0) ON CONFLICT (id) DO NOTHING`,
      );
      await tx.execute(
        `INSERT INTO "${TABLE_KNOWLEDGE_SCHEMA}" (id,"version") VALUES ('canonical',${KNOWLEDGE_STORAGE_SCHEMA_VERSION}) ON CONFLICT (id) DO NOTHING`,
      );
      return dropped;
    });
  }

  /**
   * Knowledge v1 was experimental and its data is not migrated. When exactly the published v1 tables
   * and indexes are the only Knowledge objects in this store's schema, drop them, discarding any rows
   * they hold, so canonical storage can initialize. Partial or unfamiliar tables, views, triggers, and
   * extra indexes all leave the database untouched. Runs inside the caller's first-boot transaction.
   * Returns `'dependents'` when other objects depend on the tables, since a reset cannot remove them either.
   */
  async #replacePublishedV1(tx: Executor): Promise<{ tables: string[]; indexes: string[] } | 'dependents' | null> {
    const schema = this.#schemaName ?? null;
    const relations = await tx.execute({
      sql: `SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = COALESCE(?, current_schema()) AND table_name LIKE 'mastra\\_knowledge\\_%'`,
      args: [schema],
    });
    const tables: string[] = [];
    for (const row of relations.rows) {
      const name = String(row.table_name);
      if (row.table_type !== 'BASE TABLE' || !PUBLISHED_KNOWLEDGE_V1_COLUMNS.has(name)) return null;
      tables.push(name);
    }
    if (tables.length === 0) return null;
    const columns = await tx.execute({
      sql: `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = COALESCE(?, current_schema()) AND table_name = ANY(?::text[])`,
      args: [schema, tables],
    });
    const columnsByTable = new Map<string, string[]>(tables.map(table => [table, []]));
    for (const row of columns.rows) columnsByTable.get(String(row.table_name))?.push(String(row.column_name));
    if (!isPublishedKnowledgeV1Layout(columnsByTable, { timestampShadows: true })) return null;
    const indexes = await tx.execute({
      sql: `SELECT indexname FROM pg_indexes WHERE schemaname = COALESCE(?, current_schema()) AND tablename = ANY(?::text[])`,
      args: [schema, tables],
    });
    const indexNames = indexes.rows.map(row => String(row.indexname));
    for (const name of indexNames) {
      if (!PUBLISHED_KNOWLEDGE_V1_INDEX_NAMES.has(name) && !name.endsWith('_pkey')) return null;
    }
    const views = await tx.execute({
      sql: `SELECT 1 FROM information_schema.view_table_usage WHERE table_schema = COALESCE(?, current_schema()) AND table_name = ANY(?::text[]) LIMIT 1`,
      args: [schema, tables],
    });
    if (views.rows.length > 0) return 'dependents';
    const triggers = await tx.execute({
      sql: `SELECT 1 FROM information_schema.triggers WHERE event_object_schema = COALESCE(?, current_schema()) AND event_object_table = ANY(?::text[]) LIMIT 1`,
      args: [schema, tables],
    });
    if (triggers.rows.length > 0) return null;
    try {
      await tx.execute(`DROP TABLE ${tables.map(table => `"${table}"`).join(', ')}`);
    } catch (error) {
      // Dependents the catalog checks above cannot see (other roles' views, materialized views, foreign keys).
      if (isDependentObjectsError(error)) return 'dependents';
      throw error;
    }
    return { tables, indexes: indexNames };
  }

  override async dangerouslyReset(): Promise<void> {
    const schema = this.#schemaName ? `"${parseSchemaName(this.#schemaName)}".` : '';
    const tables = [...RETIRED_KNOWLEDGE_TABLE_NAMES, ...[...KNOWLEDGE_TABLE_NAMES].reverse()]
      .map(table => `${schema}"${table}"`)
      .join(', ');
    try {
      await this.#client.query(`DROP TABLE IF EXISTS ${tables}`);
    } catch (error) {
      if (!isDependentObjectsError(error)) throw error;
      const { KnowledgeSchemaError } = await loadKnowledgeCore();
      throw new KnowledgeSchemaError(KNOWLEDGE_DEPENDENTS_MESSAGE);
    }
    await this.init();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#transaction(async tx => {
      for (const table of [
        TABLE_KNOWLEDGE_RECORD_SCOPES,
        TABLE_KNOWLEDGE_NODE_SCOPES,
        TABLE_KNOWLEDGE_SCOPE_GRANTS,
        TABLE_KNOWLEDGE_SCOPE_ADDRESSES,
        TABLE_KNOWLEDGE_NODE_ADDRESSES,
        TABLE_KNOWLEDGE_MENTIONS,
        TABLE_KNOWLEDGE_PROPOSALS,
        TABLE_KNOWLEDGE_ACTIVITY,
        TABLE_KNOWLEDGE_IMPORT_STATE,
        TABLE_KNOWLEDGE_IMPORT_RUNS,
        TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
        TABLE_KNOWLEDGE_RECORDS,
        TABLE_KNOWLEDGE_NODES,
      ]) {
        await tx.execute(`DELETE FROM "${table}"`);
      }
      await tx.execute(
        `INSERT INTO "${TABLE_KNOWLEDGE_ACCESS_STATE}" (id,epoch) VALUES ('global',0) ON CONFLICT (id) DO UPDATE SET epoch=0`,
      );
    });
  }

  override async reconcileStructure(plan: KnowledgeStructurePlan): Promise<KnowledgeStructureReconcileResult> {
    return this.#transaction(async tx => {
      await tx.execute({
        sql: `SELECT pg_advisory_xact_lock(hashtext(?))`,
        args: [`mastra-knowledge-reconcile:${this.#schemaName}`],
      });
      // Acquire the database write lock before any read so separate clients cannot both observe a missing address.
      await tx.execute(`UPDATE "${TABLE_KNOWLEDGE_ACCESS_STATE}" SET epoch=epoch WHERE id='global'`);
      const scopes: Record<string, string> = {};
      const createdScopeIds: string[] = [];
      const deletedScopeAddresses = new Set<string>();
      let structureChanged = false;
      const resolveAddress = async (address: string): Promise<string | undefined> => {
        if (scopes[address]) return scopes[address];
        const result = await tx.execute({
          sql: `SELECT a.scopeNodeId,n.isScope,n.deletedAt FROM "${TABLE_KNOWLEDGE_SCOPE_ADDRESSES}" a JOIN "${TABLE_KNOWLEDGE_NODES}" n ON n.id=a.scopeNodeId WHERE a.address=?`,
          args: [address],
        });
        const row = result.rows[0];
        if (!row) return undefined;
        if (!row.isScope) throw new Error(`Knowledge address ${address} does not reference a scope`);
        if (row.deletedAt) deletedScopeAddresses.add(address);
        scopes[address] = String(row.scopeNodeId);
        return scopes[address];
      };

      for (const scope of plan.scopes) {
        const existingId = await resolveAddress(scope.address);
        if (existingId) continue;
        const id = randomUUID();
        const now = new Date().toISOString();
        await tx.execute({
          sql: `INSERT INTO "${TABLE_KNOWLEDGE_NODES}" (id,name,kind,isScope,metadata,version,createdAt,updatedAt,deletedAt,deletedBy) VALUES (?,?,?,TRUE,jsonb(?),1,?,?,NULL,NULL)`,
          args: [id, scope.name, scope.kind ?? null, scope.metadata ? JSON.stringify(scope.metadata) : null, now, now],
        });
        await tx.execute({
          sql: `INSERT INTO "${TABLE_KNOWLEDGE_SCOPE_ADDRESSES}" (address,scopeNodeId) VALUES (?,?)`,
          args: [scope.address, id],
        });
        scopes[scope.address] = id;
        createdScopeIds.push(id);
        structureChanged = true;
      }

      for (const scope of plan.scopes) {
        if (deletedScopeAddresses.has(scope.address)) continue;
        const scopeNodeId = scopes[scope.address]!;
        for (const parentAddress of scope.parentAddresses ?? []) {
          const parentId = await resolveAddress(parentAddress);
          if (!parentId || deletedScopeAddresses.has(parentAddress)) {
            const deletedParentId = scopes[parentAddress];
            const existing = deletedParentId
              ? await tx.execute({
                  sql: `SELECT 1 FROM "${TABLE_KNOWLEDGE_NODE_SCOPES}" WHERE nodeId=? AND scopeNodeId=?`,
                  args: [scopeNodeId, deletedParentId],
                })
              : undefined;
            if (existing?.rows.length) continue;
            throw new Error(`Knowledge parent scope does not exist: ${parentAddress}`);
          }
          const edge = await tx.execute({
            sql: `SELECT 1 FROM "${TABLE_KNOWLEDGE_NODE_SCOPES}" WHERE "nodeId"=? AND "scopeNodeId"=?`,
            args: [scopeNodeId, parentId],
          });
          if (edge.rows.length) continue;
          // Only scope children can collide by name; content nodes placed under the parent share its edges table.
          const sibling = await tx.execute({
            sql: `SELECT n.id FROM "${TABLE_KNOWLEDGE_NODE_SCOPES}" ns JOIN "${TABLE_KNOWLEDGE_NODES}" n ON n.id=ns.nodeId WHERE ns.scopeNodeId=? AND lower(n.name)=? AND n.deletedAt IS NULL AND n.id<>? LIMIT 1`,
            args: [parentId, canonicalName(scope.name), scopeNodeId],
          });
          if (sibling.rows.length) {
            throw new Error(`Knowledge scope name ${scope.name} already exists under ${parentAddress}`);
          }
          const inserted = await tx.execute({
            sql: `INSERT INTO "${TABLE_KNOWLEDGE_NODE_SCOPES}" (nodeId,scopeNodeId,addedAt) VALUES (?,?,?) ON CONFLICT DO NOTHING`,
            args: [scopeNodeId, parentId, new Date().toISOString()],
          });
          structureChanged ||= inserted.rowsAffected > 0;
        }
        for (const grant of scope.grants ?? []) {
          const scopeRefId = await resolveAddress(grant.scopeRefAddress);
          if (!scopeRefId || deletedScopeAddresses.has(grant.scopeRefAddress)) {
            const deletedScopeRefId = scopes[grant.scopeRefAddress];
            const existing = deletedScopeRefId
              ? await tx.execute({
                  sql: `SELECT 1 FROM "${TABLE_KNOWLEDGE_SCOPE_GRANTS}" WHERE scopeNodeId=? AND scopeRefId=?`,
                  args: [scopeNodeId, deletedScopeRefId],
                })
              : undefined;
            if (existing?.rows.length) continue;
            throw new Error(`Knowledge grant scope does not exist: ${grant.scopeRefAddress}`);
          }
          const inserted = await tx.execute({
            sql: `INSERT INTO "${TABLE_KNOWLEDGE_SCOPE_GRANTS}" (scopeNodeId,scopeRefId,role,canSuggest) VALUES (?,?,?,?) ON CONFLICT DO NOTHING`,
            args: [scopeNodeId, scopeRefId, grant.role, grant.canSuggest ?? null],
          });
          structureChanged ||= inserted.rowsAffected > 0;
        }
      }

      if (structureChanged) {
        await tx.execute(`UPDATE "${TABLE_KNOWLEDGE_ACCESS_STATE}" SET epoch=epoch+1 WHERE id='global'`);
      }
      const state = await tx.execute(`SELECT epoch FROM "${TABLE_KNOWLEDGE_ACCESS_STATE}" WHERE id='global'`);
      return {
        scopes,
        createdScopeIds,
        deletedScopeAddresses: [...deletedScopeAddresses],
        changed: structureChanged,
        accessEpoch: Number(state.rows[0]?.epoch ?? 0),
      };
    });
  }

  async createNode(input: CreateKnowledgeNodeInput): Promise<KnowledgeNode> {
    return this.#transaction(tx => this.#createNode(tx, input));
  }

  async getNode(id: string): Promise<KnowledgeNode | null> {
    return this.#getNode(this.#readExecutor, id);
  }

  async getNodeScopeIds(nodeId: string): Promise<KnowledgeScopeIds> {
    return this.#getNodeScopeIds(this.#readExecutor, nodeId);
  }

  async getNodeByName(input: { name: string; scopeIds: KnowledgeScopeIds }): Promise<KnowledgeNode | null> {
    return this.#getNodeByName(this.#readExecutor, input.name, canonicalizeKnowledgeScopeIds(input.scopeIds));
  }

  async resolveNode(input: { name: string; scopeIds: KnowledgeScopeIds }): Promise<KnowledgeNode | null> {
    return this.#resolveNode(this.#readExecutor, input.name, canonicalizeKnowledgeScopeIds(input.scopeIds));
  }

  async listNodes(input: ListKnowledgeNodesInput): Promise<KnowledgeNode[]> {
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    if (scopeIds.length === 0) return [];
    const clauses = ['n.deletedAt IS NULL', visibleNodeSql(scopeIds)];
    const args: QueryValues = [...scopeIds];
    if (input.namePrefix) {
      clauses.push("lower(n.name) LIKE ? ESCAPE '='");
      args.push(`${escapeLikePattern(canonicalName(input.namePrefix))}%`);
    }
    if (input.kind) {
      clauses.push('n.kind=?');
      args.push(input.kind);
    }
    if (input.isScope !== undefined) clauses.push(`n.isScope=${input.isScope ? 'TRUE' : 'FALSE'}`);
    if (input.cursor) {
      const cursor = parseKnowledgeNodeCursor(input.cursor, {
        namePrefix: input.namePrefix,
        kind: input.kind,
        isScope: input.isScope,
      });
      const updatedAt = cursor.updatedAt.toISOString();
      clauses.push('(n.updatedAt<? OR (n.updatedAt=? AND (n.name>? OR (n.name=? AND n.id>?))))');
      args.push(updatedAt, updatedAt, cursor.name, cursor.name, cursor.id);
    }
    args.push(input.limit ?? 100);
    const result = await this.#readExecutor.execute({
      sql: `SELECT n.*,json(n.metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_NODES}" n WHERE ${clauses.join(' AND ')} ORDER BY n.updatedAt DESC, n.name ASC, n.id ASC LIMIT ?`,
      args,
    });
    return result.rows.map(parseNode);
  }

  async updateNode(input: UpdateKnowledgeNodeInput): Promise<KnowledgeNode> {
    return this.#transaction(tx => this.#updateNode(tx, input));
  }

  async #updateNode(tx: Executor, input: UpdateKnowledgeNodeInput): Promise<KnowledgeNode> {
    const existing = await this.#getNode(tx, input.id);
    if (!existing) throw new KnowledgeNotFoundError('node', input.id);
    const existingScopeIds = await this.#getNodeScopeIds(tx, input.id);
    const scopeIds = await this.#assertScopeNodes(tx, input.scopeIds ?? existingScopeIds);
    const now = new Date();
    const updated: KnowledgeNode = {
      ...existing,
      name: input.name?.trim() ?? existing.name,
      kind: input.kind ?? existing.kind,
      isScope: input.isScope ?? existing.isScope,
      metadata: input.metadata ?? existing.metadata,
      version: input.version + 1,
      updatedAt: now,
    };
    await this.#lockSiblingName(tx, updated.name, scopeIds);
    const collision = await this.#getNodeByName(tx, updated.name, scopeIds);
    if (collision && collision.id !== input.id) throw new KnowledgeConflictError(collision.id);
    await this.#assertNoSiblingNameCollision(tx, updated.name, scopeIds, input.id);
    if (existing.isScope && input.isScope === false) await this.#assertScopeHasNoDependents(tx, existing.id);
    const result = await tx.execute({
      sql: `UPDATE "${TABLE_KNOWLEDGE_NODES}" SET name=?,kind=?,isScope=?,metadata=jsonb(?),version=version+1,updatedAt=? WHERE id=? AND version=?`,
      args: [
        updated.name,
        updated.kind ?? null,
        updated.isScope,
        updated.metadata ? JSON.stringify(updated.metadata) : null,
        now.toISOString(),
        input.id,
        input.version,
      ],
    });
    if (result.rowsAffected === 0) throw new KnowledgeConflictError(input.id);
    if (input.scopeIds) await this.#replaceNodeScopes(tx, input.id, scopeIds, now);
    await this.#activity(tx, 'edit', 'node', input.id, input.contextScopeId, input.importRunId);
    if (knowledgeScopeIdsKey(existingScopeIds) !== knowledgeScopeIdsKey(scopeIds)) {
      await this.#outbox(tx, 'node', input.id, 'delete', updated.version, existingScopeIds);
    }
    await this.#outbox(tx, 'node', input.id, 'upsert', updated.version, scopeIds);
    let after = '';
    while (true) {
      const recordRows = await tx.execute({
        sql: `SELECT *,json(metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE nodeId=? AND id>? ORDER BY id ASC LIMIT 100`,
        args: [input.id, after],
      });
      if (!recordRows.rows.length) break;
      for (const row of recordRows.rows) {
        const record = parseKnowledge(row);
        const recordScopeIds = await this.#getRecordScopeIds(tx, record.id);
        await tx.execute({
          sql: `UPDATE "${TABLE_KNOWLEDGE_RECORDS}" SET version=version+1,updatedAt=? WHERE id=?`,
          args: [now.toISOString(), record.id],
        });
        await this.#outbox(
          tx,
          'record',
          record.id,
          record.deletedAt ? 'delete' : 'upsert',
          record.version + 1,
          recordScopeIds,
        );
        after = record.id;
      }
    }
    return updated;
  }

  async mergeNodes(input: {
    sourceId: string;
    targetId: string;
    sourceVersion: number;
    importRunId?: string;
    contextScopeId?: string;
  }): Promise<KnowledgeNode> {
    if (input.sourceId === input.targetId) throw new Error('Cannot merge a knowledge node into itself');
    return this.#transaction(async tx => {
      const source = await this.#getNode(tx, input.sourceId);
      if (!source) throw new KnowledgeNotFoundError('node', input.sourceId);
      const target = await this.#getNode(tx, input.targetId);
      if (!target) throw new KnowledgeNotFoundError('node', input.targetId);
      const sourceScopeIds = await this.#getNodeScopeIds(tx, source.id);
      const now = new Date();
      const updated = await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_NODES}" SET deletedAt=?,deletedBy='merge',version=version+1,updatedAt=? WHERE id=? AND version=? AND deletedAt IS NULL`,
        args: [now.toISOString(), now.toISOString(), source.id, input.sourceVersion],
      });
      if (updated.rowsAffected === 0) throw new KnowledgeConflictError(source.id);
      const affectedRows = await tx.execute({
        sql: `SELECT *,json(metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE nodeId=?`,
        args: [source.id],
      });
      const affectedRecords = await Promise.all(
        affectedRows.rows.map(async row => {
          const record = parseKnowledge(row);
          return { record, scopeIds: await this.#getRecordScopeIds(tx, record.id) };
        }),
      );
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_RECORDS}" SET nodeId=?,version=version+1,updatedAt=? WHERE nodeId=?`,
        args: [target.id, now.toISOString(), source.id],
      });
      for (const { record, scopeIds } of affectedRecords) {
        await this.#outbox(
          tx,
          'record',
          record.id,
          record.deletedAt ? 'delete' : 'upsert',
          record.version + 1,
          scopeIds,
        );
      }
      await tx.execute({
        sql: `DELETE FROM "${TABLE_KNOWLEDGE_MENTIONS}" WHERE targetNodeId=? AND recordId IN (SELECT recordId FROM "${TABLE_KNOWLEDGE_MENTIONS}" WHERE targetNodeId=?)`,
        args: [source.id, target.id],
      });
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_MENTIONS}" SET targetNodeId=? WHERE targetNodeId=?`,
        args: [target.id, source.id],
      });
      await tx.execute({ sql: `DELETE FROM "${TABLE_KNOWLEDGE_MENTIONS}" WHERE targetNodeId=?`, args: [source.id] });
      await this.#activity(tx, 'merge', 'node', source.id, input.contextScopeId, input.importRunId, {
        targetId: target.id,
      });
      await this.#outbox(tx, 'node', source.id, 'delete', input.sourceVersion + 1, sourceScopeIds);
      await tx.execute({ sql: `DELETE FROM "${TABLE_KNOWLEDGE_NODE_SCOPES}" WHERE nodeId=?`, args: [source.id] });
      return target;
    });
  }

  override async createNodeWithRecord(input: {
    node: CreateKnowledgeNodeInput;
    record: Omit<CreateKnowledgeRecordInput, 'node'>;
  }): Promise<{ node: KnowledgeNode; record: KnowledgeRecord }> {
    return this.#transaction(async tx => {
      const node = await this.#createNode(tx, input.node);
      const record = await this.#createRecord(tx, { ...input.record, node });
      return { node, record };
    });
  }

  override async replaceNodeRecords(input: {
    node: UpdateKnowledgeNodeInput;
    record: Omit<CreateKnowledgeRecordInput, 'node'> & { source: string };
    visibilityScopeIds: KnowledgeScopeIds;
  }): Promise<KnowledgeRecord> {
    const scopeIds = canonicalizeKnowledgeScopeIds(input.visibilityScopeIds);
    return this.#transaction(async tx => {
      const node = await this.#updateNode(tx, input.node);
      let after = '';
      while (true) {
        const page = await tx.execute({
          sql: `SELECT *,json(metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE nodeId=? AND source=? AND deletedAt IS NULL AND id>? ORDER BY id ASC LIMIT 100`,
          args: [node.id, input.record.source, after],
        });
        if (!page.rows.length) break;
        for (const row of page.rows) {
          const record = parseKnowledge(row);
          if (await this.#isRecordVisible(tx, record, scopeIds)) {
            await this.#deleteRecord(tx, {
              id: record.id,
              deletedBy: input.record.source,
              importRunId: input.record.importRunId,
            });
          }
          after = record.id;
        }
      }
      return this.#createRecord(tx, { ...input.record, node });
    });
  }

  async createRecord(input: CreateKnowledgeRecordInput): Promise<KnowledgeRecord> {
    return this.#transaction(tx => this.#createRecord(tx, input));
  }

  async #createRecord(tx: Executor, input: CreateKnowledgeRecordInput): Promise<KnowledgeRecord> {
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    const nodeId = nodeReferenceId(input.node);
    const parent = await this.#getNode(tx, nodeId);
    if (!parent || parent.deletedAt) throw new KnowledgeNotFoundError('node', nodeId);
    const now = new Date();
    const metadataJson = input.metadata ? toPgJson(input.metadata) : null;
    const record: KnowledgeRecord = {
      id: input.id ?? createKnowledgeUlid(),
      nodeId: parent.id,
      text: input.text,
      metadata: input.metadata,
      source: input.source,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await tx.execute({
      sql: `INSERT INTO "${TABLE_KNOWLEDGE_RECORDS}" (id,nodeId,text,metadata,source,version,createdAt,updatedAt,deletedAt,deletedBy) VALUES (?,?,?,jsonb(?),?,1,?,?,NULL,NULL)`,
      args: [
        record.id,
        record.nodeId,
        record.text,
        metadataJson,
        record.source ?? null,
        now.toISOString(),
        now.toISOString(),
      ],
    });
    await this.#replaceRecordScopes(tx, record.id, scopeIds, now);
    const resolutionScopeIds = await this.#assertScopeNodes(tx, input.resolutionScopeIds ?? scopeIds);
    await this.#replaceMentions(
      tx,
      record.id,
      record.text,
      record.source,
      resolutionScopeIds,
      scopeIds,
      input.importRunId,
    );
    await this.#activity(tx, 'create', 'record', record.id, input.contextScopeId, input.importRunId);
    await this.#outbox(tx, 'record', record.id, 'upsert', record.version, scopeIds);
    return metadataJson ? { ...record, metadata: JSON.parse(metadataJson) } : record;
  }

  async getRecord(input: { id: string; includeDeleted?: boolean }): Promise<KnowledgeRecord | null> {
    return this.#getRecord(this.#readExecutor, input.id, input.includeDeleted ?? false);
  }

  async getRecordScopeIds(recordId: string): Promise<KnowledgeScopeIds> {
    return this.#getRecordScopeIds(this.#readExecutor, recordId);
  }

  async listRecords(input: QueryKnowledgeRecordsInput): Promise<QueryKnowledgeRecordsOutput> {
    return this.#queryKnowledge(input, 'about');
  }

  async listMentioningRecords(input: QueryKnowledgeRecordsInput): Promise<QueryKnowledgeRecordsOutput> {
    return this.#queryKnowledge(input, 'mentioning');
  }

  async listRelatedRecords(input: QueryKnowledgeRecordsInput): Promise<QueryKnowledgeRecordsOutput> {
    return this.#queryKnowledge(input, 'related');
  }

  async listRecordsBySource(input: QueryKnowledgeRecordsBySourceInput): Promise<QueryKnowledgeRecordsOutput> {
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    const args: QueryValues = [input.source];
    const clauses = ['source=?'];
    if (!input.includeDeleted) clauses.push('deletedAt IS NULL');
    if (input.after) {
      clauses.push('id > ?');
      args.push(input.after);
    }
    const result = await this.#readExecutor.execute({
      sql: `SELECT *,json(metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE ${clauses.join(' AND ')} ORDER BY id ASC`,
      args,
    });
    const records: KnowledgeRecord[] = [];
    for (const row of result.rows) {
      const record = parseKnowledge(row);
      if (await this.#isRecordVisible(this.#readExecutor, record, scopeIds)) records.push(record);
    }
    const limit = input.limit ?? 100;
    return {
      records: records.slice(0, limit),
      nextCursor: records.length > limit ? records[limit - 1]?.id : undefined,
    };
  }

  async deleteRecord(input: { id: string; deletedBy: string; importRunId?: string }): Promise<KnowledgeRecord> {
    return this.#transaction(tx => this.#deleteRecord(tx, input));
  }

  async #deleteRecord(
    tx: Executor,
    input: { id: string; deletedBy: string; importRunId?: string },
  ): Promise<KnowledgeRecord> {
    const record = await this.#getRecord(tx, input.id, true);
    if (!record) throw new KnowledgeNotFoundError('record', input.id);
    if (record.deletedAt) return record;
    const now = new Date();
    await tx.execute({
      sql: `UPDATE "${TABLE_KNOWLEDGE_RECORDS}" SET deletedAt=?,deletedBy=?,version=version+1,updatedAt=? WHERE id=?`,
      args: [now.toISOString(), input.deletedBy, now.toISOString(), input.id],
    });
    const scopeIds = await this.#getRecordScopeIds(tx, input.id);
    await this.#activity(tx, 'delete', 'record', input.id, undefined, input.importRunId);
    await this.#outbox(tx, 'record', input.id, 'delete', record.version + 1, scopeIds);
    return { ...record, version: record.version + 1, updatedAt: now, deletedAt: now, deletedBy: input.deletedBy };
  }

  async restoreRecord(input: { id: string; importRunId?: string }): Promise<KnowledgeRecord> {
    return this.#transaction(async tx => {
      const record = await this.#getRecord(tx, input.id, true);
      if (!record) throw new KnowledgeNotFoundError('record', input.id);
      if (!record.deletedAt) return record;
      const now = new Date();
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_RECORDS}" SET deletedAt=NULL,deletedBy=NULL,version=version+1,updatedAt=? WHERE id=?`,
        args: [now.toISOString(), input.id],
      });
      const scopeIds = await this.#getRecordScopeIds(tx, input.id);
      await this.#activity(tx, 'restore', 'record', input.id, undefined, input.importRunId);
      await this.#outbox(tx, 'record', input.id, 'upsert', record.version + 1, scopeIds);
      return { ...record, version: record.version + 1, updatedAt: now, deletedAt: undefined, deletedBy: undefined };
    });
  }

  async setRecordScopes(input: {
    id: string;
    version: number;
    scopeIds: KnowledgeScopeIds;
    importRunId?: string;
    contextScopeId?: string;
  }): Promise<KnowledgeRecord> {
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    return this.#transaction(async tx => {
      const record = await this.#getRecord(tx, input.id, true);
      if (!record) throw new KnowledgeNotFoundError('record', input.id);
      if (record.version !== input.version) throw new KnowledgeConflictError(input.id);
      const oldScopeIds = await this.#getRecordScopeIds(tx, input.id);
      const now = new Date();
      const result = await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_RECORDS}" SET version=version+1,updatedAt=? WHERE id=? AND version=?`,
        args: [now.toISOString(), input.id, input.version],
      });
      if (result.rowsAffected === 0) throw new KnowledgeConflictError(input.id);
      await this.#replaceRecordScopes(tx, input.id, scopeIds, now);
      await this.#activity(tx, 'move', 'record', input.id, input.contextScopeId, input.importRunId);
      const version = record.version + 1;
      await this.#outbox(tx, 'record', input.id, 'delete', version, oldScopeIds);
      if (!record.deletedAt) await this.#outbox(tx, 'record', input.id, 'upsert', version, scopeIds);
      return { ...record, version: record.version + 1, updatedAt: now };
    });
  }

  async search(input: SearchKnowledgeInput): Promise<SearchKnowledgeResult[]> {
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    const query = input.query.trim().toLocaleLowerCase();
    if (!query || scopeIds.length === 0) return [];
    const limit = input.limit ?? 20;
    const pattern = `%${escapeLikePattern(query)}%`;
    const nodes = await this.#readExecutor.execute({
      sql: `SELECT n.*,json(n.metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_NODES}" n WHERE n.deletedAt IS NULL AND ${visibleNodeSql(scopeIds)} AND (lower(n.name) LIKE ? ESCAPE '=' OR lower(coalesce(n.kind,'')) LIKE ? ESCAPE '=' OR lower(coalesce(n.metadata::text,'')) LIKE ? ESCAPE '=') ORDER BY n.updatedAt DESC, n.id DESC LIMIT ?`,
      args: [...scopeIds, pattern, pattern, pattern, limit],
    });
    const results: SearchKnowledgeResult[] = [];
    for (const row of nodes.rows) {
      const node = parseNode(row);
      results.push({
        type: 'node',
        id: node.id,
        recordId: node.id,
        name: node.name,
        text: node.name,
        scopeIds: await this.#getNodeScopeIds(this.#readExecutor, node.id),
      });
    }
    if (results.length >= limit) return results;
    const visibleRecord = visibleRecordSql(scopeIds);
    const records = await this.#readExecutor.execute({
      sql: `SELECT r.*,json(r.metadata) AS metadataJson,p.name AS parent_name FROM "${TABLE_KNOWLEDGE_RECORDS}" r JOIN "${TABLE_KNOWLEDGE_NODES}" p ON p.id=r.nodeId WHERE r.deletedAt IS NULL AND lower(r.text) LIKE ? ESCAPE '=' AND ${visibleRecord.sql} ORDER BY r.id DESC LIMIT ?`,
      args: [pattern, ...visibleRecord.args, limit - results.length],
    });
    for (const row of records.rows) {
      const record = parseKnowledge(row);
      results.push({
        type: 'record',
        id: record.id,
        recordId: record.nodeId,
        name: String(row.parent_name),
        text: record.text,
        scopeIds: await this.#getRecordScopeIds(this.#readExecutor, record.id),
      });
    }
    return results;
  }

  /**
   * @deprecated Curation cursors were removed. Observation-time curate is the only Knowledge writer and needs no
   * cursor. Always throws.
   */
  async getCurationCursor(_input: { sourceThreadId: string; agent: string }): Promise<KnowledgeCurationCursor | null> {
    throw new Error(KNOWLEDGE_CURATION_CURSOR_REMOVED_MESSAGE);
  }

  /**
   * @deprecated Curation cursors were removed. Observation-time curate is the only Knowledge writer and needs no
   * cursor. Always throws.
   */
  async advanceCurationCursor(_input: {
    sourceThreadId: string;
    agent: string;
    lastKnowledgeId: string;
  }): Promise<KnowledgeCurationCursor> {
    throw new Error(KNOWLEDGE_CURATION_CURSOR_REMOVED_MESSAGE);
  }

  async getScopeAddress(address: string): Promise<KnowledgeScopeAddress | null> {
    const result = await this.#executor.execute({
      sql: `SELECT a.address,a.scopeNodeId FROM "${TABLE_KNOWLEDGE_SCOPE_ADDRESSES}" a JOIN "${TABLE_KNOWLEDGE_NODES}" n ON n.id=a.scopeNodeId WHERE a.address=? AND n.isScope=TRUE AND n.deletedAt IS NULL`,
      args: [address],
    });
    const row = result.rows[0];
    return row ? { address: String(row.address), scopeNodeId: String(row.scopeNodeId) } : null;
  }

  async listScopeAddresses(input: { after?: string; limit?: number } = {}): Promise<KnowledgeScopeAddress[]> {
    const limit = Math.max(1, Math.min(input.limit ?? 100, 1000));
    const result = await this.#executor.execute({
      sql: `SELECT a.address,a.scopeNodeId FROM "${TABLE_KNOWLEDGE_SCOPE_ADDRESSES}" a JOIN "${TABLE_KNOWLEDGE_NODES}" n ON n.id=a.scopeNodeId WHERE n.isScope=TRUE AND n.deletedAt IS NULL AND (CAST(? AS TEXT) IS NULL OR a.address>?) ORDER BY a.address ASC LIMIT ?`,
      args: [input.after ?? null, input.after ?? null, limit],
    });
    return result.rows.map(row => ({ address: String(row.address), scopeNodeId: String(row.scopeNodeId) }));
  }

  async getNodeAddress(input: { source: string; address: string }): Promise<KnowledgeNodeAddress | null> {
    const result = await this.#executor.execute({
      sql: `SELECT source,address,nodeId FROM "${TABLE_KNOWLEDGE_NODE_ADDRESSES}" WHERE source=? AND address=?`,
      args: [input.source, input.address],
    });
    const row = result.rows[0];
    return row ? { source: String(row.source), address: String(row.address), nodeId: String(row.nodeId) } : null;
  }

  async listNodeAddresses(input: { source: string }): Promise<KnowledgeNodeAddress[]> {
    const result = await this.#executor.execute({
      sql: `SELECT source,address,nodeId FROM "${TABLE_KNOWLEDGE_NODE_ADDRESSES}" WHERE source=? ORDER BY address ASC`,
      args: [input.source],
    });
    return result.rows.map(row => ({
      source: String(row.source),
      address: String(row.address),
      nodeId: String(row.nodeId),
    }));
  }

  async setNodeAddress(input: KnowledgeNodeAddress): Promise<KnowledgeNodeAddress> {
    await this.#transaction(async tx => {
      if (!(await this.#getNode(tx, input.nodeId))) throw new KnowledgeNotFoundError('node', input.nodeId);
      const existing = await tx.execute({
        sql: `SELECT nodeId FROM "${TABLE_KNOWLEDGE_NODE_ADDRESSES}" WHERE source=? AND address=?`,
        args: [input.source, input.address],
      });
      const nodeId = existing.rows[0]?.nodeId;
      if (nodeId !== undefined && String(nodeId) !== input.nodeId) {
        throw new KnowledgeConflictError(`Knowledge node address already belongs to another node: ${input.address}`);
      }
      if (nodeId === undefined) {
        await tx.execute({
          sql: `INSERT INTO "${TABLE_KNOWLEDGE_NODE_ADDRESSES}" (source,address,nodeId) VALUES (?,?,?)`,
          args: [input.source, input.address, input.nodeId],
        });
      }
    });
    return { ...input };
  }

  async createNodeWithAddress(input: {
    source: string;
    address: string;
    node: CreateKnowledgeNodeInput;
  }): Promise<KnowledgeNode> {
    return this.#transaction(async tx => {
      const binding = await tx.execute({
        sql: `SELECT nodeId FROM "${TABLE_KNOWLEDGE_NODE_ADDRESSES}" WHERE source=? AND address=?`,
        args: [input.source, input.address],
      });
      if (binding.rows[0]) {
        const existing = await this.#getNode(tx, String(binding.rows[0].nodeId));
        if (!existing) throw new KnowledgeNotFoundError('node', String(binding.rows[0].nodeId));
        return existing;
      }
      const node = await this.#createNode(tx, input.node);
      await tx.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_NODE_ADDRESSES}" (source,address,nodeId) VALUES (?,?,?)`,
        args: [input.source, input.address, node.id],
      });
      return node;
    });
  }

  async removeNodeAddress(input: { source: string; address: string; nodeId: string }): Promise<void> {
    await this.#transaction(async tx => {
      await tx.execute({
        sql: `DELETE FROM "${TABLE_KNOWLEDGE_NODE_ADDRESSES}" WHERE source=? AND address=? AND nodeId=?`,
        args: [input.source, input.address, input.nodeId],
      });
    });
  }

  async rebindNodeAddress(input: {
    source: string;
    address: string;
    newAddress: string;
    nodeId: string;
    importRunId?: string;
  }): Promise<KnowledgeNodeAddress> {
    return this.#transaction(async tx => {
      const existing = await tx.execute({
        sql: `SELECT nodeId FROM "${TABLE_KNOWLEDGE_NODE_ADDRESSES}" WHERE source=? AND address=?`,
        args: [input.source, input.address],
      });
      const collision = await tx.execute({
        sql: `SELECT nodeId FROM "${TABLE_KNOWLEDGE_NODE_ADDRESSES}" WHERE source=? AND address=?`,
        args: [input.source, input.newAddress],
      });
      if (!existing.rows[0]) {
        if (String(collision.rows[0]?.nodeId ?? '') === input.nodeId) {
          return { source: input.source, address: input.newAddress, nodeId: input.nodeId };
        }
        throw new KnowledgeNotFoundError('node address', input.address);
      }
      if (String(existing.rows[0].nodeId) !== input.nodeId) {
        throw new KnowledgeNotFoundError('node address', input.address);
      }
      if (input.address === input.newAddress) {
        return { source: input.source, address: input.address, nodeId: input.nodeId };
      }
      if (collision.rows[0] && String(collision.rows[0].nodeId) !== input.nodeId) {
        throw new KnowledgeConflictError(`Knowledge node address already belongs to another node: ${input.newAddress}`);
      }
      await tx.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_NODE_ADDRESSES}" (source,address,nodeId) VALUES (?,?,?) ON CONFLICT(source,address) DO UPDATE SET nodeId=excluded.nodeId`,
        args: [input.source, input.newAddress, input.nodeId],
      });
      await tx.execute({
        sql: `DELETE FROM "${TABLE_KNOWLEDGE_NODE_ADDRESSES}" WHERE source=? AND address=? AND nodeId=?`,
        args: [input.source, input.address, input.nodeId],
      });
      const node = await this.#getNode(tx, input.nodeId);
      if (!node) throw new KnowledgeNotFoundError('node', input.nodeId);
      await this.#activity(tx, 'rebind', 'node', input.nodeId, undefined, input.importRunId);
      return { source: input.source, address: input.newAddress, nodeId: input.nodeId };
    });
  }

  async deleteNodeByAddress(input: {
    source: string;
    address: string;
    scopeId: string;
    importRunId?: string;
  }): Promise<{ node: KnowledgeNode; deleted: boolean }> {
    return this.#transaction(async tx => {
      const binding = await tx.execute({
        sql: `SELECT nodeId FROM "${TABLE_KNOWLEDGE_NODE_ADDRESSES}" WHERE source=? AND address=?`,
        args: [input.source, input.address],
      });
      const nodeId = binding.rows[0]?.nodeId;
      if (nodeId == null) throw new KnowledgeNotFoundError('node address', input.address);
      const node = await this.#getNode(tx, String(nodeId));
      if (!node) throw new KnowledgeNotFoundError('node', String(nodeId));
      if (node.isScope) throw new KnowledgeConflictError(`Knowledge scopes cannot be permanently deleted: ${node.id}`);
      await tx.execute({
        sql: `DELETE FROM "${TABLE_KNOWLEDGE_NODE_ADDRESSES}" WHERE source=? AND address=? AND nodeId=?`,
        args: [input.source, input.address, node.id],
      });
      const owned = await tx.execute({
        sql: `SELECT r.id FROM "${TABLE_KNOWLEDGE_RECORDS}" r WHERE r.nodeId=? AND r.source=? AND (SELECT COUNT(*) FROM "${TABLE_KNOWLEDGE_RECORD_SCOPES}" rs WHERE rs.recordId=r.id)=1 AND EXISTS (SELECT 1 FROM "${TABLE_KNOWLEDGE_RECORD_SCOPES}" rs WHERE rs.recordId=r.id AND rs.scopeNodeId=?)`,
        args: [node.id, input.source, input.scopeId],
      });
      for (const row of owned.rows) await this.#deleteRecordPermanently(tx, String(row.id), input.importRunId);
      const remaining = await tx.execute({
        sql: `SELECT 1 FROM "${TABLE_KNOWLEDGE_NODE_ADDRESSES}" WHERE nodeId=? UNION ALL SELECT 1 FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE nodeId=? LIMIT 1`,
        args: [node.id, node.id],
      });
      if (remaining.rows[0]) return { node, deleted: false };
      const scopeIds = await this.#getNodeScopeIds(tx, node.id);
      await this.#activity(tx, 'delete', 'node', node.id, scopeIds[0], input.importRunId);
      await this.#outbox(tx, 'node', node.id, 'delete', node.version + 1, scopeIds);
      await tx.execute({ sql: `DELETE FROM "${TABLE_KNOWLEDGE_MENTIONS}" WHERE targetNodeId=?`, args: [node.id] });
      await tx.execute({ sql: `DELETE FROM "${TABLE_KNOWLEDGE_NODE_SCOPES}" WHERE nodeId=?`, args: [node.id] });
      await tx.execute({ sql: `DELETE FROM "${TABLE_KNOWLEDGE_NODES}" WHERE id=?`, args: [node.id] });
      return { node, deleted: true };
    });
  }

  async deleteRecordBySource(input: {
    id: string;
    source: string;
    version: number;
    importRunId?: string;
  }): Promise<KnowledgeRecord> {
    return this.#transaction(async tx => {
      const record = await this.#getRecord(tx, input.id, true);
      if (!record || record.source !== input.source) throw new KnowledgeNotFoundError('record', input.id);
      await this.#deleteRecordPermanently(tx, record.id, input.importRunId, input.version);
      return record;
    });
  }

  async #deleteRecordPermanently(
    tx: Executor,
    id: string,
    importRunId?: string,
    expectedVersion?: number,
  ): Promise<void> {
    const record = await this.#getRecord(tx, id, true);
    if (!record) return;
    if (expectedVersion !== undefined && record.version !== expectedVersion) throw new KnowledgeConflictError(id);
    const scopeIds = await this.#getRecordScopeIds(tx, id);
    await this.#activity(tx, 'delete', 'record', id, scopeIds[0], importRunId);
    await this.#outbox(tx, 'record', id, 'delete', record.version + 1, scopeIds);
    await tx.execute({ sql: `DELETE FROM "${TABLE_KNOWLEDGE_MENTIONS}" WHERE recordId=?`, args: [id] });
    await tx.execute({ sql: `DELETE FROM "${TABLE_KNOWLEDGE_RECORD_SCOPES}" WHERE recordId=?`, args: [id] });
    const result = await tx.execute({
      sql: `DELETE FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE id=?${expectedVersion === undefined ? '' : ' AND version=?'}`,
      args: expectedVersion === undefined ? [id] : [id, expectedVersion],
    });
    if (expectedVersion !== undefined && result.rowsAffected === 0) throw new KnowledgeConflictError(id);
  }

  async getImportState(input: {
    importerId: string;
    binding: string;
    key: string;
  }): Promise<KnowledgeImportState | null> {
    const normalized = { ...input, binding: canonicalizeKnowledgeImporterBindingKey(input.binding) };
    const result = await this.#executor.execute({
      sql: `SELECT * FROM "${TABLE_KNOWLEDGE_IMPORT_STATE}" WHERE importerId=? AND binding=? AND key=?`,
      args: importStateKey(normalized),
    });
    const row = result.rows[0];
    return row
      ? {
          importerId: String(row.importerId),
          binding: String(row.binding),
          key: String(row.key),
          value: String(row.value),
        }
      : null;
  }

  async setImportState(input: {
    importerId: string;
    binding: string;
    key: string;
    value: string;
  }): Promise<KnowledgeImportState> {
    const normalized = { ...input, binding: canonicalizeKnowledgeImporterBindingKey(input.binding) };
    await this.#transaction(async tx => {
      await tx.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_IMPORT_STATE}" (importerId,binding,key,value) VALUES (?,?,?,?) ON CONFLICT(importerId,binding,key) DO UPDATE SET value=excluded.value`,
        args: [...importStateKey(normalized), input.value],
      });
    });
    return normalized;
  }

  async createImportRun(input: CreateKnowledgeImportRunInput): Promise<KnowledgeImportRun> {
    if (input.status === 'skipped' && input.triggerKind !== 'cron') {
      throw new Error('Only cron-triggered Knowledge import runs can be created as skipped');
    }
    const queuedAt = input.queuedAt ?? new Date();
    const status = input.status ?? 'queued';
    const run: KnowledgeImportRun = {
      id: input.id ?? createKnowledgeUlid(),
      importerId: input.importerId,
      binding: canonicalizeKnowledgeImporterBindingKey(input.binding),
      importKind: input.importKind,
      triggerKind: input.triggerKind,
      status,
      queuedAt,
      completedAt: status === 'skipped' ? queuedAt : undefined,
    };
    try {
      await this.#transaction(async tx => {
        await tx.execute({
          sql: `INSERT INTO "${TABLE_KNOWLEDGE_IMPORT_RUNS}" (id,importerId,binding,importKind,triggerKind,status,error,transcriptThreadId,traceId,queuedAt,startedAt,completedAt) VALUES (?,?,?,?,?,?,NULL,NULL,NULL,?,NULL,?)`,
          args: [
            run.id,
            run.importerId,
            run.binding,
            run.importKind,
            run.triggerKind,
            run.status,
            run.queuedAt.toISOString(),
            run.completedAt?.toISOString() ?? null,
          ],
        });
      });
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? error.code : undefined;
      if (code === '23505') throw new KnowledgeConflictError(`Import run ${run.id} already exists`);
      throw error;
    }
    return run;
  }

  async enqueueImportRun(input: EnqueueKnowledgeImportRunInput): Promise<KnowledgeImportRun> {
    const binding = canonicalizeKnowledgeImporterBindingKey(input.binding);
    const queuedAt = input.queuedAt ?? new Date();
    return this.#transaction(async tx => {
      await tx.execute({
        sql: `SELECT pg_advisory_xact_lock(hashtext(?))`,
        args: [`mastra-knowledge-import:${this.#schemaName}:${input.importerId}:${binding}`],
      });
      let status = input.status ?? 'queued';
      if (input.skipIfActiveCron) {
        const active = await tx.execute({
          sql: `SELECT 1 FROM "${TABLE_KNOWLEDGE_IMPORT_RUNS}" WHERE importerId=? AND binding=? AND status IN ('queued','running') LIMIT 1`,
          args: [input.importerId, binding],
        });
        if (active.rows.length) status = 'skipped';
      }
      const run: KnowledgeImportRun = {
        id: input.id,
        importerId: input.importerId,
        binding,
        importKind: input.importKind,
        triggerKind: input.triggerKind,
        status,
        queuedAt,
        completedAt: status === 'skipped' ? queuedAt : undefined,
      };
      await tx.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_IMPORT_RUNS}" (id,importerId,binding,importKind,triggerKind,status,error,transcriptThreadId,traceId,queuedAt,startedAt,completedAt) VALUES (?,?,?,?,?,?,NULL,NULL,NULL,?,NULL,?)`,
        args: [
          run.id,
          run.importerId,
          run.binding,
          run.importKind,
          run.triggerKind,
          run.status,
          run.queuedAt.toISOString(),
          run.completedAt?.toISOString() ?? null,
        ],
      });
      if (status !== 'skipped') {
        await tx.execute({
          sql: `INSERT INTO "${TABLE_KNOWLEDGE_IMPORT_STATE}" (importerId,binding,key,value) VALUES (?,?,?,?)`,
          args: [input.importerId, binding, input.payloadKey, input.payload],
        });
      }
      return run;
    });
  }

  async claimImportRun(input: ClaimKnowledgeImportRunInput): Promise<KnowledgeImportRun | null> {
    const binding = canonicalizeKnowledgeImporterBindingKey(input.binding);
    return this.#transaction(async tx => {
      await tx.execute({
        sql: `SELECT pg_advisory_xact_lock(hashtext(?))`,
        args: [`mastra-knowledge-import:${this.#schemaName}:${input.importerId}:${binding}`],
      });
      const running = await tx.execute({
        sql: `SELECT 1 FROM "${TABLE_KNOWLEDGE_IMPORT_RUNS}" WHERE importerId=? AND binding=? AND status='running' LIMIT 1`,
        args: [input.importerId, binding],
      });
      if (running.rows.length) return null;
      const queued = await tx.execute({
        sql: `SELECT * FROM "${TABLE_KNOWLEDGE_IMPORT_RUNS}" WHERE importerId=? AND binding=? AND status='queued' ORDER BY queuedAt ASC,id ASC LIMIT 1 FOR UPDATE`,
        args: [input.importerId, binding],
      });
      if (!queued.rows[0]) return null;
      const run = parseImportRun(queued.rows[0]);
      const timestamp = input.timestamp ?? new Date();
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_IMPORT_RUNS}" SET status='running',startedAt=? WHERE id=? AND status='queued'`,
        args: [timestamp.toISOString(), run.id],
      });
      await tx.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_IMPORT_STATE}" (importerId,binding,key,value) VALUES (?,?,?,?) ON CONFLICT(importerId,binding,key) DO UPDATE SET value=excluded.value`,
        args: [
          input.importerId,
          binding,
          `${input.leaseKey}${run.id}`,
          JSON.stringify({ workerId: input.workerId, heartbeatAt: timestamp.toISOString() }),
        ],
      });
      return { ...run, status: 'running', startedAt: timestamp };
    });
  }

  async heartbeatImportRun(input: HeartbeatKnowledgeImportRunInput): Promise<boolean> {
    const binding = canonicalizeKnowledgeImporterBindingKey(input.binding);
    return this.#transaction(async tx => {
      const current = await tx.execute({
        sql: `SELECT s.value FROM "${TABLE_KNOWLEDGE_IMPORT_STATE}" s JOIN "${TABLE_KNOWLEDGE_IMPORT_RUNS}" r ON r.id=? AND r.importerId=s.importerId AND r.binding=s.binding WHERE s.importerId=? AND s.binding=? AND s.key=? AND r.status='running' FOR UPDATE`,
        args: [input.id, input.importerId, binding, input.leaseKey],
      });
      if (!current.rows[0]) return false;
      try {
        if ((JSON.parse(String(current.rows[0].value)) as { workerId?: string }).workerId !== input.workerId)
          return false;
      } catch {
        return false;
      }
      const timestamp = input.timestamp ?? new Date();
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_IMPORT_STATE}" SET value=? WHERE importerId=? AND binding=? AND key=?`,
        args: [
          JSON.stringify({ workerId: input.workerId, heartbeatAt: timestamp.toISOString() }),
          input.importerId,
          binding,
          input.leaseKey,
        ],
      });
      if (input.transcriptThreadId) {
        await tx.execute({
          sql: `UPDATE "${TABLE_KNOWLEDGE_IMPORT_RUNS}" SET transcriptThreadId=? WHERE id=?`,
          args: [input.transcriptThreadId, input.id],
        });
      }
      return true;
    });
  }

  async finalizeImportRun(input: FinalizeKnowledgeImportRunInput): Promise<KnowledgeImportRun | null> {
    const { sanitizeKnowledgeImportError } = await loadKnowledgeCore();
    const binding = canonicalizeKnowledgeImporterBindingKey(input.binding);
    return this.#transaction(async tx => {
      const current = await tx.execute({
        sql: `SELECT r.*,s.value AS "leaseValue" FROM "${TABLE_KNOWLEDGE_IMPORT_RUNS}" r JOIN "${TABLE_KNOWLEDGE_IMPORT_STATE}" s ON s.importerId=r.importerId AND s.binding=r.binding AND s.key=? WHERE r.id=? AND r.importerId=? AND r.binding=? AND r.status='running' FOR UPDATE OF r,s`,
        args: [input.leaseKey, input.id, input.importerId, binding],
      });
      if (!current.rows[0]) return null;
      try {
        if ((JSON.parse(String(current.rows[0].leaseValue)) as { workerId?: string }).workerId !== input.workerId) {
          return null;
        }
      } catch {
        return null;
      }
      for (const state of input.state) {
        await tx.execute({
          sql: `INSERT INTO "${TABLE_KNOWLEDGE_IMPORT_STATE}" (importerId,binding,key,value) VALUES (?,?,?,?) ON CONFLICT(importerId,binding,key) DO UPDATE SET value=excluded.value`,
          args: [input.importerId, binding, state.key, state.value],
        });
      }
      const timestamp = input.timestamp ?? new Date();
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_IMPORT_RUNS}" SET status=?,error=?,transcriptThreadId=COALESCE(?,transcriptThreadId),completedAt=? WHERE id=? AND status='running'`,
        args: [
          input.status,
          input.status === 'failed' ? sanitizeKnowledgeImportError(input.error) : null,
          input.transcriptThreadId ?? null,
          timestamp.toISOString(),
          input.id,
        ],
      });
      await tx.execute({
        sql: `DELETE FROM "${TABLE_KNOWLEDGE_IMPORT_STATE}" WHERE importerId=? AND binding=? AND key IN (?,?)`,
        args: [input.importerId, binding, input.leaseKey, input.payloadKey ?? input.leaseKey],
      });
      return {
        ...parseImportRun(current.rows[0]),
        status: input.status,
        error: input.status === 'failed' ? sanitizeKnowledgeImportError(input.error) : undefined,
        transcriptThreadId: input.transcriptThreadId ?? parseImportRun(current.rows[0]).transcriptThreadId,
        completedAt: timestamp,
      };
    });
  }

  async recoverImportRun(input: RecoverKnowledgeImportRunInput): Promise<KnowledgeImportRun | null> {
    return this.#transaction(async tx => {
      const candidate = await tx.execute({
        sql: `SELECT * FROM "${TABLE_KNOWLEDGE_IMPORT_RUNS}" WHERE id=? AND status='running'`,
        args: [input.id],
      });
      if (!candidate.rows[0]) return null;
      const candidateRun = parseImportRun(candidate.rows[0]);
      await tx.execute({
        sql: `SELECT pg_advisory_xact_lock(hashtext(?))`,
        args: [`mastra-knowledge-import:${this.#schemaName}:${candidateRun.importerId}:${candidateRun.binding}`],
      });
      const result = await tx.execute({
        sql: `SELECT * FROM "${TABLE_KNOWLEDGE_IMPORT_RUNS}" WHERE id=? AND status='running' FOR UPDATE`,
        args: [input.id],
      });
      if (!result.rows[0]) return null;
      const run = parseImportRun(result.rows[0]);
      const lease = await tx.execute({
        sql: `SELECT value FROM "${TABLE_KNOWLEDGE_IMPORT_STATE}" WHERE importerId=? AND binding=? AND key=?`,
        args: [run.importerId, run.binding, input.leaseKey],
      });
      if (lease.rows[0]) {
        try {
          const heartbeatAt = new Date(
            (JSON.parse(String(lease.rows[0].value)) as { heartbeatAt: string }).heartbeatAt,
          );
          if (heartbeatAt >= input.staleBefore) return null;
        } catch {
          // Malformed internal leases are treated as stale and recovered.
        }
      }
      const payload = await tx.execute({
        sql: `SELECT value FROM "${TABLE_KNOWLEDGE_IMPORT_STATE}" WHERE importerId=? AND binding=? AND key=?`,
        args: [run.importerId, run.binding, input.payloadKey],
      });
      const recoveredAt = input.queuedAt ?? new Date();
      const replayQueuedAt = new Date(run.queuedAt.getTime() - 1);
      await tx.execute({
        sql: `DELETE FROM "${TABLE_KNOWLEDGE_IMPORT_STATE}" WHERE importerId=? AND binding=? AND key IN (?,?)`,
        args: [run.importerId, run.binding, input.leaseKey, input.payloadKey],
      });
      if (!payload.rows[0]) {
        await tx.execute({
          sql: `UPDATE "${TABLE_KNOWLEDGE_IMPORT_RUNS}" SET status='failed',error=?,completedAt=? WHERE id=? AND status='running'`,
          args: ['Import failed: durable payload is missing', recoveredAt.toISOString(), run.id],
        });
        return null;
      }
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_IMPORT_RUNS}" SET status='interrupted',completedAt=? WHERE id=? AND status='running'`,
        args: [recoveredAt.toISOString(), run.id],
      });
      await tx.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_IMPORT_RUNS}" (id,importerId,binding,importKind,triggerKind,status,error,transcriptThreadId,traceId,queuedAt,startedAt,completedAt) VALUES (?,?,?,?,?,'queued',NULL,NULL,NULL,?,NULL,NULL)`,
        args: [
          input.replacementId,
          run.importerId,
          run.binding,
          run.importKind,
          run.triggerKind,
          replayQueuedAt.toISOString(),
        ],
      });
      await tx.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_IMPORT_STATE}" (importerId,binding,key,value) VALUES (?,?,?,?)`,
        args: [run.importerId, run.binding, input.replacementPayloadKey, String(payload.rows[0].value)],
      });
      return { ...run, id: input.replacementId, status: 'queued', queuedAt: replayQueuedAt, startedAt: undefined };
    });
  }

  async getImportRun(id: string): Promise<KnowledgeImportRun | null> {
    const result = await this.#executor.execute({
      sql: `SELECT * FROM "${TABLE_KNOWLEDGE_IMPORT_RUNS}" WHERE id=?`,
      args: [id],
    });
    return result.rows[0] ? parseImportRun(result.rows[0]) : null;
  }

  async listImportRuns(input: ListKnowledgeImportRunsInput = {}): Promise<ListKnowledgeImportRunsOutput> {
    const clauses: string[] = [];
    const args: QueryValues = [];
    const binding = input.binding ? canonicalizeKnowledgeImporterBindingKey(input.binding) : undefined;
    if (input.importerId) {
      clauses.push('importerId=?');
      args.push(input.importerId);
    }
    if (binding) {
      clauses.push('binding=?');
      args.push(binding);
    }
    if (input.status) {
      clauses.push('status=?');
      args.push(input.status);
    }
    if (input.after) {
      clauses.push(
        `(queuedAt < (SELECT queuedAt FROM "${TABLE_KNOWLEDGE_IMPORT_RUNS}" WHERE id=?) OR (queuedAt = (SELECT queuedAt FROM "${TABLE_KNOWLEDGE_IMPORT_RUNS}" WHERE id=?) AND id < ?))`,
      );
      args.push(input.after, input.after, input.after);
    }
    const limit = input.limit ?? 100;
    args.push(limit + 1);
    const result = await this.#executor.execute({
      sql: `SELECT * FROM "${TABLE_KNOWLEDGE_IMPORT_RUNS}"${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY queuedAt DESC,id DESC LIMIT ?`,
      args,
    });
    const runs = result.rows.map(parseImportRun);
    return { runs: runs.slice(0, limit), nextCursor: runs.length > limit ? runs[limit - 1]?.id : undefined };
  }

  async updateImportRun(input: UpdateKnowledgeImportRunInput): Promise<KnowledgeImportRun> {
    const { sanitizeKnowledgeImportError } = await loadKnowledgeCore();
    return this.#transaction(async tx => {
      const existing = await tx.execute({
        sql: `SELECT * FROM "${TABLE_KNOWLEDGE_IMPORT_RUNS}" WHERE id=? FOR UPDATE`,
        args: [input.id],
      });
      if (!existing.rows[0]) throw new KnowledgeNotFoundError('import run', input.id);
      const run = parseImportRun(existing.rows[0]);
      assertImportRunTransition(run.status, input.status);
      const timestamp = input.timestamp ?? new Date();
      const error = input.status === 'failed' ? sanitizeKnowledgeImportError(input.error) : undefined;
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_IMPORT_RUNS}" SET status=?,error=?,transcriptThreadId=COALESCE(?,transcriptThreadId),traceId=COALESCE(?,traceId),startedAt=CASE WHEN ?='running' THEN ? ELSE startedAt END,completedAt=CASE WHEN ?!='running' THEN ? ELSE completedAt END WHERE id=?`,
        args: [
          input.status,
          error ?? null,
          input.transcriptThreadId ?? null,
          input.traceId ?? null,
          input.status,
          timestamp.toISOString(),
          input.status,
          timestamp.toISOString(),
          input.id,
        ],
      });
      return {
        ...run,
        status: input.status,
        error,
        transcriptThreadId: input.transcriptThreadId ?? run.transcriptThreadId,
        traceId: input.traceId ?? run.traceId,
        startedAt: input.status === 'running' ? timestamp : run.startedAt,
        completedAt: input.status === 'running' ? run.completedAt : timestamp,
      };
    });
  }

  async recordImportSkip(input: {
    targetType: KnowledgeSemanticDocumentType;
    targetId: string;
    contextScopeId: string;
    importRunId: string;
    details: Record<string, unknown>;
  }): Promise<void> {
    await this.#transaction(tx =>
      this.#activity(
        tx,
        'skip',
        input.targetType,
        input.targetId,
        input.contextScopeId,
        input.importRunId,
        input.details,
      ),
    );
  }

  async listActivity(input: {
    scopeIds: KnowledgeScopeIds;
    importRunId?: string;
    after?: string;
    limit?: number;
  }): Promise<KnowledgeActivityEvent[]> {
    const clauses: string[] = [];
    const args: QueryValues = [];
    if (input.importRunId) {
      clauses.push('importRunId=?');
      args.push(input.importRunId);
    }
    if (input.after) {
      clauses.push('id < ?');
      args.push(input.after);
    }
    const result = await this.#readExecutor.execute({
      sql: `SELECT * FROM "${TABLE_KNOWLEDGE_ACTIVITY}"${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY id DESC`,
      args,
    });
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    const visible = new Set(scopeIds);
    const events: KnowledgeActivityEvent[] = [];
    for (const row of result.rows) {
      if (row.contextScopeId != null && !visible.has(String(row.contextScopeId))) continue;
      const action = String(row.action) as KnowledgeActivityAction;
      const visibleDeletion = action === 'delete' && row.contextScopeId != null;
      const targetType = String(row.targetType) as KnowledgeSemanticDocumentType;
      const targetId = String(row.targetId);
      if (targetType === 'node') {
        const node = await this.#getNodeIncludingDeleted(this.#readExecutor, targetId);
        if (
          !visibleDeletion &&
          (!node || !isKnowledgeScopeVisible(await this.#getNodeScopeIds(this.#readExecutor, targetId), scopeIds))
        )
          continue;
      } else {
        const record = await this.#getRecord(this.#readExecutor, targetId, true);
        if (!visibleDeletion && (!record || !(await this.#isRecordVisible(this.#readExecutor, record, scopeIds))))
          continue;
      }
      events.push({
        id: String(row.id),
        action,
        targetType,
        targetId,
        contextScopeId: row.contextScopeId == null ? undefined : String(row.contextScopeId),
        importRunId: row.importRunId == null ? undefined : String(row.importRunId),
        details: row.details == null ? undefined : parseJson<Record<string, unknown>>(row.details),
        createdAt: toDate(row.createdAt),
      });
      if (events.length >= (input.limit ?? 100)) break;
    }
    return events;
  }

  async listSemanticOutbox(
    input: { status?: KnowledgeSemanticOutboxEntry['status']; scopeIds?: KnowledgeScopeIds; limit?: number } = {},
  ): Promise<KnowledgeSemanticOutboxEntry[]> {
    const args: QueryValues = [];
    const where = input.status ? ' WHERE status=?' : '';
    if (input.status) args.push(input.status);
    const result = await this.#executor.execute({
      sql: `SELECT *,json(scopeIds) AS scopeIdsJson FROM "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}"${where} ORDER BY createdAt ASC,id ASC`,
      args,
    });
    const scopeIds = input.scopeIds && canonicalizeKnowledgeScopeIds(input.scopeIds);
    return result.rows
      .map(parseOutbox)
      .filter(entry => !scopeIds || isKnowledgeScopeVisible(entry.scopeIds, scopeIds))
      .slice(0, input.limit ?? 100);
  }

  async claimSemanticOutbox(input: ClaimKnowledgeSemanticOutboxInput): Promise<KnowledgeSemanticOutboxEntry[]> {
    const now = input.now ?? new Date();
    const stale = new Date(now.getTime() - (input.claimTimeoutMs ?? 60_000));
    return this.#transaction(async tx => {
      const selected = await tx.execute({
        sql: `SELECT *,json(scopeIds) AS scopeIdsJson FROM "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" WHERE availableAt <= ? AND (status='pending' OR (status='processing' AND claimedAt <= ?)) AND NOT EXISTS (SELECT 1 FROM "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" AS earlier WHERE earlier.documentId = "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}".documentId AND earlier.status != 'completed' AND (earlier.createdAt < "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}".createdAt OR (earlier.createdAt = "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}".createdAt AND earlier.id < "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}".id))) ORDER BY createdAt ASC,id ASC FOR UPDATE SKIP LOCKED`,
        args: [now.toISOString(), stale.toISOString()],
      });
      const scopeIds = input.scopeIds && canonicalizeKnowledgeScopeIds(input.scopeIds);
      const entries = selected.rows
        .map(parseOutbox)
        .filter(entry => !scopeIds || isKnowledgeScopeVisible(entry.scopeIds, scopeIds))
        .slice(0, input.limit ?? 100);
      for (const entry of entries)
        await tx.execute({
          sql: `UPDATE "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" SET status='processing',attempts=attempts+1,claimedAt=?,claimedBy=? WHERE id=?`,
          args: [now.toISOString(), input.workerId, entry.id],
        });
      return entries.map(entry => ({
        ...entry,
        status: 'processing',
        attempts: entry.attempts + 1,
        claimedAt: now,
        claimedBy: input.workerId,
      }));
    });
  }

  async completeSemanticOutbox(input: { ids: string[]; workerId: string }): Promise<void> {
    if (!input.ids.length) return;
    const now = new Date().toISOString();
    await this.#transaction(async tx => {
      for (const id of input.ids)
        await tx.execute({
          sql: `UPDATE "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" SET status='completed',completedAt=? WHERE id=? AND status='processing' AND claimedBy=?`,
          args: [now, id, input.workerId],
        });
    });
  }
  async releaseSemanticOutbox(input: { ids: string[]; workerId: string; retryAt?: Date }): Promise<void> {
    if (!input.ids.length) return;
    await this.#transaction(async tx => {
      for (const id of input.ids)
        await tx.execute({
          sql: `UPDATE "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" SET status='pending',availableAt=?,claimedAt=NULL,claimedBy=NULL WHERE id=? AND status='processing' AND claimedBy=?`,
          args: [(input.retryAt ?? new Date()).toISOString(), id, input.workerId],
        });
    });
  }

  async #transaction<T>(operation: (tx: Executor) => Promise<T>): Promise<T> {
    return this.#client.tx(tx => operation(createExecutor(tx, this.#schemaName)));
  }
  async #createNode(executor: Executor, input: CreateKnowledgeNodeInput): Promise<KnowledgeNode> {
    const scopeIds = await this.#assertScopeNodes(executor, input.scopeIds);
    await this.#lockSiblingName(executor, input.name, scopeIds);
    const existing = await this.#getNodeByName(executor, input.name, scopeIds);
    if (existing) return existing;
    await this.#assertNoSiblingNameCollision(executor, input.name, scopeIds);
    const now = new Date();
    const node: KnowledgeNode = {
      id: input.id ? canonicalizeKnowledgeNodeId(input.id) : crypto.randomUUID(),
      type: 'node',
      name: input.name.trim(),
      kind: input.kind,
      isScope: input.isScope ?? false,
      metadata: input.metadata,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await executor.execute({
      sql: `INSERT INTO "${TABLE_KNOWLEDGE_NODES}" (id,name,kind,isScope,metadata,version,createdAt,updatedAt,deletedAt,deletedBy) VALUES (?,?,?, ?,jsonb(?),1,?,?,NULL,NULL)`,
      args: [
        node.id,
        node.name,
        node.kind ?? null,
        node.isScope,
        node.metadata ? JSON.stringify(node.metadata) : null,
        now.toISOString(),
        now.toISOString(),
      ],
    });
    await this.#replaceNodeScopes(executor, node.id, scopeIds, now);
    await this.#activity(executor, 'create', 'node', node.id, input.contextScopeId, input.importRunId);
    await this.#outbox(executor, 'node', node.id, 'upsert', node.version, scopeIds);
    return node;
  }

  async #getNode(executor: Executor, id: string): Promise<KnowledgeNode | null> {
    const node = await this.#getNodeIncludingDeleted(executor, id);
    return node?.deletedAt ? null : node;
  }

  async #getNodeIncludingDeleted(executor: Executor, id: string): Promise<KnowledgeNode | null> {
    const result = await executor.execute({
      sql: `SELECT *,json(metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_NODES}" WHERE id=?`,
      args: [id],
    });
    return result.rows[0] ? parseNode(result.rows[0]) : null;
  }

  async #getNodeScopeIds(executor: Executor, nodeId: string): Promise<KnowledgeScopeIds> {
    const result = await executor.execute({
      sql: `SELECT scopeNodeId FROM "${TABLE_KNOWLEDGE_NODE_SCOPES}" WHERE nodeId=? ORDER BY scopeNodeId`,
      args: [nodeId],
    });
    return result.rows.map(row => String(row.scopeNodeId));
  }

  async #getRecordScopeIds(executor: Executor, recordId: string): Promise<KnowledgeScopeIds> {
    const result = await executor.execute({
      sql: `SELECT scopeNodeId FROM "${TABLE_KNOWLEDGE_RECORD_SCOPES}" WHERE recordId=? ORDER BY scopeNodeId`,
      args: [recordId],
    });
    return result.rows.map(row => String(row.scopeNodeId));
  }

  async #lockSiblingName(executor: Executor, name: string, scopeIds: KnowledgeScopeIds): Promise<void> {
    const parents = scopeIds.length ? scopeIds : ['root'];
    for (const scopeId of parents) {
      await executor.execute({
        sql: `SELECT pg_advisory_xact_lock(hashtext(?))`,
        args: [`mastra-knowledge-sibling:${canonicalName(name)}:${scopeId}`],
      });
    }
  }

  async #assertNoSiblingNameCollision(
    executor: Executor,
    name: string,
    scopeIds: KnowledgeScopeIds,
    excludeId?: string,
  ): Promise<void> {
    const excluded = excludeId ? ' AND n.id != ?' : '';
    const excludeArgs = excludeId ? [excludeId] : [];
    const result = scopeIds.length
      ? await executor.execute({
          sql: `SELECT n.id FROM "${TABLE_KNOWLEDGE_NODES}" n JOIN "${TABLE_KNOWLEDGE_NODE_SCOPES}" ns ON ns.nodeId=n.id WHERE lower(n.name)=? AND n.deletedAt IS NULL AND ns.scopeNodeId IN (${scopeIds.map(() => '?').join(',')})${excluded} LIMIT 1`,
          args: [canonicalName(name), ...scopeIds, ...excludeArgs],
        })
      : await executor.execute({
          sql: `SELECT n.id FROM "${TABLE_KNOWLEDGE_NODES}" n WHERE lower(n.name)=? AND n.deletedAt IS NULL AND NOT EXISTS (SELECT 1 FROM "${TABLE_KNOWLEDGE_NODE_SCOPES}" ns WHERE ns.nodeId=n.id)${excluded} LIMIT 1`,
          args: [canonicalName(name), ...excludeArgs],
        });
    if (result.rows[0]) throw new KnowledgeConflictError(String(result.rows[0].id));
  }

  async #assertScopeHasNoDependents(executor: Executor, scopeId: string): Promise<void> {
    const result = await executor.execute({
      sql: `SELECT 1 FROM "${TABLE_KNOWLEDGE_NODE_SCOPES}" WHERE scopeNodeId=? AND nodeId!=?
        UNION ALL SELECT 1 FROM "${TABLE_KNOWLEDGE_RECORD_SCOPES}" WHERE scopeNodeId=?
        UNION ALL SELECT 1 FROM "${TABLE_KNOWLEDGE_SCOPE_GRANTS}" WHERE scopeNodeId=? OR scopeRefId=?
        UNION ALL SELECT 1 FROM "${TABLE_KNOWLEDGE_SCOPE_ADDRESSES}" WHERE scopeNodeId=? LIMIT 1`,
      args: [scopeId, scopeId, scopeId, scopeId, scopeId, scopeId],
    });
    if (result.rows[0]) throw new KnowledgeConflictError(`Knowledge scope has dependents: ${scopeId}`);
  }

  async #getNodeByName(executor: Executor, name: string, scopeIds: KnowledgeScopeIds): Promise<KnowledgeNode | null> {
    const result = await executor.execute({
      sql: `SELECT *,json(metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_NODES}" WHERE lower(name)=? AND deletedAt IS NULL`,
      args: [canonicalName(name)],
    });
    const expected = knowledgeScopeIdsKey(scopeIds);
    for (const row of result.rows) {
      const node = parseNode(row);
      if (knowledgeScopeIdsKey(await this.#getNodeScopeIds(executor, node.id)) === expected) return node;
    }
    return null;
  }

  async #resolveNode(executor: Executor, name: string, scopeIds: KnowledgeScopeIds): Promise<KnowledgeNode | null> {
    if (scopeIds.length === 0) return null;
    // Only same-named nodes in a visible scope are candidates; the widest membership wins.
    const result = await executor.execute({
      sql: `SELECT n.*,json(n.metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_NODES}" n WHERE lower(n.name)=? AND n.deletedAt IS NULL AND ${visibleNodeSql(scopeIds)} ORDER BY (SELECT COUNT(*) FROM "${TABLE_KNOWLEDGE_NODE_SCOPES}" c WHERE c.nodeId=n.id) DESC, n.id ASC LIMIT 1`,
      args: [canonicalName(name), ...scopeIds],
    });
    return result.rows[0] ? parseNode(result.rows[0]) : null;
  }

  async #getRecord(executor: Executor, id: string, includeDeleted: boolean): Promise<KnowledgeRecord | null> {
    const result = await executor.execute({
      sql: `SELECT *,json(metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE id=?${includeDeleted ? '' : ' AND deletedAt IS NULL'}`,
      args: [id],
    });
    return result.rows[0] ? parseKnowledge(result.rows[0]) : null;
  }

  async #isRecordVisible(
    executor: Executor,
    record: KnowledgeRecord,
    visibleScopeIds: KnowledgeScopeIds,
  ): Promise<boolean> {
    if (!isKnowledgeScopeVisible(await this.#getRecordScopeIds(executor, record.id), visibleScopeIds)) return false;
    const mentions = await executor.execute({
      sql: `SELECT targetNodeId FROM "${TABLE_KNOWLEDGE_MENTIONS}" WHERE recordId=?`,
      args: [record.id],
    });
    const nodeIds = [record.nodeId, ...mentions.rows.map(row => String(row.targetNodeId))];
    for (const nodeId of nodeIds) {
      const node = await this.#getNode(executor, nodeId);
      if (!node || !isKnowledgeNodeVisible(node, await this.#getNodeScopeIds(executor, nodeId), visibleScopeIds))
        return false;
    }
    return true;
  }

  async #queryKnowledge(
    input: QueryKnowledgeRecordsInput,
    relationship: 'about' | 'mentioning' | 'related',
  ): Promise<QueryKnowledgeRecordsOutput> {
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    const membershipScopeIds = canonicalizeKnowledgeScopeIds(input.membershipScopeIds ?? input.scopeIds);
    if (membershipScopeIds.length === 0) return { records: [] };
    const nodeId = nodeReferenceId(input.node);
    const clauses: string[] = [
      `EXISTS (SELECT 1 FROM "${TABLE_KNOWLEDGE_RECORD_SCOPES}" rs WHERE rs.recordId=r.id AND rs.scopeNodeId IN (${membershipScopeIds.map(() => '?').join(',')}))`,
    ];
    const args: QueryValues = [...membershipScopeIds];
    if (relationship === 'about') {
      clauses.push('r.nodeId=?');
      args.push(nodeId);
    } else if (relationship === 'mentioning') {
      clauses.push(`EXISTS (SELECT 1 FROM "${TABLE_KNOWLEDGE_MENTIONS}" m WHERE m.recordId=r.id AND m.targetNodeId=?)`);
      args.push(nodeId);
    } else {
      clauses.push(
        `(r.nodeId=? OR EXISTS (SELECT 1 FROM "${TABLE_KNOWLEDGE_MENTIONS}" m WHERE m.recordId=r.id AND m.targetNodeId=?))`,
      );
      args.push(nodeId, nodeId);
    }
    if (!input.includeDeleted) clauses.push('r.deletedAt IS NULL');
    if (input.after) {
      clauses.push('r.id < ?');
      args.push(input.after);
    }
    const result = await this.#readExecutor.execute({
      sql: `SELECT r.*,json(r.metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_RECORDS}" r WHERE ${clauses.join(' AND ')} ORDER BY r.id DESC`,
      args,
    });
    const visible: KnowledgeRecord[] = [];
    for (const row of result.rows) {
      const record = parseKnowledge(row);
      if (await this.#isRecordVisible(this.#readExecutor, record, scopeIds)) visible.push(record);
    }
    const limit = input.limit ?? 100;
    return {
      records: visible.slice(0, limit),
      nextCursor: visible.length > limit ? visible[limit - 1]?.id : undefined,
    };
  }

  async #assertScopeNodes(executor: Executor, scopeIds: KnowledgeScopeIds): Promise<KnowledgeScopeIds> {
    const canonical = canonicalizeKnowledgeScopeIds(scopeIds);
    for (const scopeId of canonical) {
      const result = await executor.execute({
        sql: `SELECT id FROM "${TABLE_KNOWLEDGE_NODES}" WHERE id=? AND isScope=TRUE AND deletedAt IS NULL`,
        args: [scopeId],
      });
      if (!result.rows[0]) throw new KnowledgeNotFoundError('scope', scopeId);
    }
    return canonical;
  }

  async #replaceNodeScopes(
    executor: Executor,
    nodeId: string,
    addresses: KnowledgeScopeIds,
    addedAt: Date,
  ): Promise<void> {
    const scopeIds = await this.#assertScopeNodes(executor, addresses);
    await executor.execute({ sql: `DELETE FROM "${TABLE_KNOWLEDGE_NODE_SCOPES}" WHERE nodeId=?`, args: [nodeId] });
    for (const scopeNodeId of scopeIds) {
      await executor.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_NODE_SCOPES}" (nodeId,scopeNodeId,addedAt) VALUES (?,?,?) ON CONFLICT DO NOTHING`,
        args: [nodeId, scopeNodeId, addedAt.toISOString()],
      });
    }
  }

  /**
   * Additive structural placement: every address must resolve to a live scope node
   * (unlike identity membership, an unknown address is a caller error, not a lazy
   * materialization miss). Runs inside the caller's transaction, so a throw aborts
   * the whole mutation.
   */
  async #placeNodeInScopes(
    executor: Executor,
    nodeId: string,
    addresses: string[] | undefined,
    addedAt: Date,
  ): Promise<void> {
    for (const address of addresses ?? []) {
      const result = await executor.execute({
        sql: `SELECT sa.scopeNodeId AS "scopeNodeId" FROM "${TABLE_KNOWLEDGE_SCOPE_ADDRESSES}" sa JOIN "${TABLE_KNOWLEDGE_NODES}" n ON n.id=sa."scopeNodeId" WHERE sa.address=? AND n."isScope" AND n."deletedAt" IS NULL`,
        args: [address],
      });
      const scopeNodeId = result.rows[0]?.scopeNodeId;
      if (scopeNodeId == null) throw new KnowledgeNotFoundError('scope', address);
      await executor.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_NODE_SCOPES}" ("nodeId","scopeNodeId","addedAt") VALUES (?,?,?) ON CONFLICT DO NOTHING`,
        args: [nodeId, String(scopeNodeId), addedAt.toISOString()],
      });
    }
  }

  async #replaceRecordScopes(
    executor: Executor,
    recordId: string,
    addresses: KnowledgeScopeIds,
    addedAt: Date,
  ): Promise<void> {
    const scopeIds = await this.#assertScopeNodes(executor, addresses);
    await executor.execute({
      sql: `DELETE FROM "${TABLE_KNOWLEDGE_RECORD_SCOPES}" WHERE recordId=?`,
      args: [recordId],
    });
    for (const scopeNodeId of scopeIds) {
      await executor.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_RECORD_SCOPES}" (recordId,scopeNodeId,addedAt) VALUES (?,?,?) ON CONFLICT DO NOTHING`,
        args: [recordId, scopeNodeId, addedAt.toISOString()],
      });
    }
  }

  async #replaceMentions(
    tx: Executor,
    recordId: string,
    text: string,
    source: string | undefined,
    resolutionScopeIds: KnowledgeScopeIds,
    recordScopeIds: KnowledgeScopeIds,
    importRunId?: string,
  ): Promise<void> {
    await tx.execute({ sql: `DELETE FROM "${TABLE_KNOWLEDGE_MENTIONS}" WHERE recordId=?`, args: [recordId] });
    for (const name of parseKnowledgeWikilinks(text)) {
      const bindings = await tx.execute({
        sql: `SELECT source,nodeId FROM "${TABLE_KNOWLEDGE_NODE_ADDRESSES}" WHERE address=?`,
        args: [name],
      });
      const addressed: Array<{ node: KnowledgeNode; scopeIds: KnowledgeScopeIds; preferred: boolean }> = [];
      for (const binding of bindings.rows) {
        const nodeId = binding.nodeId;
        if (nodeId == null) continue;
        const candidate = await this.#getNode(tx, String(nodeId));
        if (!candidate) continue;
        const candidateScopeIds = await this.#getNodeScopeIds(tx, candidate.id);
        if (isKnowledgeNodeVisible(candidate, candidateScopeIds, resolutionScopeIds)) {
          addressed.push({ node: candidate, scopeIds: candidateScopeIds, preferred: binding.source === source });
        }
      }
      addressed.sort(
        (left, right) =>
          Number(right.preferred) - Number(left.preferred) ||
          right.scopeIds.length - left.scopeIds.length ||
          left.node.id.localeCompare(right.node.id),
      );
      const preferred = addressed.find(candidate => candidate.preferred)?.node;
      const uniqueAddressedNodeIds = new Set(addressed.map(candidate => candidate.node.id));
      let node =
        preferred ??
        (uniqueAddressedNodeIds.size === 1 ? addressed[0]?.node : null) ??
        (await this.#resolveNode(tx, name, resolutionScopeIds));
      if (!node) node = await this.#createNode(tx, { name, scopeIds: recordScopeIds, importRunId });
      await tx.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_MENTIONS}" (recordId,targetNodeId) VALUES (?,?) ON CONFLICT DO NOTHING`,
        args: [recordId, node.id],
      });
    }
  }

  async #activity(
    executor: Executor,
    action: KnowledgeActivityAction,
    targetType: KnowledgeSemanticDocumentType,
    targetId: string,
    contextScopeId?: string,
    importRunId?: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    if (importRunId) {
      const run = await executor.execute({
        sql: `SELECT id FROM "${TABLE_KNOWLEDGE_IMPORT_RUNS}" WHERE id=?`,
        args: [importRunId],
      });
      if (!run.rows[0]) throw new KnowledgeNotFoundError('import run', importRunId);
    }
    await executor.execute({
      sql: `INSERT INTO "${TABLE_KNOWLEDGE_ACTIVITY}" (id,action,targetType,targetId,contextScopeId,importRunId,details,createdAt) VALUES (?,?,?,?,?,?,jsonb(?),?)`,
      args: [
        createKnowledgeUlid(),
        action,
        targetType,
        targetId,
        contextScopeId ?? null,
        importRunId ?? null,
        details ? JSON.stringify(details) : null,
        new Date().toISOString(),
      ],
    });
  }
  async #outbox(
    executor: Executor,
    documentType: KnowledgeSemanticDocumentType,
    id: string,
    operation: KnowledgeSemanticOperation,
    version: number | string,
    scope: KnowledgeScopeIds,
  ): Promise<void> {
    const documentId = knowledgeSemanticDocumentId(documentType, id);
    const idempotencyKey = knowledgeSemanticIdempotencyKey(documentId, operation, version);
    const now = new Date();
    await executor.execute({
      sql: `INSERT INTO "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" (id,idempotencyKey,documentId,documentType,operation,scopeIds,status,attempts,availableAt,claimedAt,claimedBy,createdAt,completedAt) VALUES (?,?,?,?,?,jsonb(?),'pending',0,?,NULL,NULL,?,NULL) ON CONFLICT DO NOTHING`,
      args: [
        createKnowledgeUlid(),
        idempotencyKey,
        documentId,
        documentType,
        operation,
        JSON.stringify(scope),
        now.toISOString(),
        now.toISOString(),
      ],
    });
  }
}
