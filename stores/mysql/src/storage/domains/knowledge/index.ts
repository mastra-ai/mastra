import { createHash, randomUUID } from 'node:crypto';

import {
  canonicalizeKnowledgeImporterBindingKey,
  canonicalizeKnowledgeNodeId,
  canonicalizeKnowledgeScopeIds,
  createKnowledgeUlid,
  isKnowledgeNodeVisible,
  isKnowledgeScopeVisible,
  KNOWLEDGE_ACCESS_STATE_SCHEMA,
  KNOWLEDGE_CURSORS_SCHEMA,
  KNOWLEDGE_IMPORT_RUNS_SCHEMA,
  KNOWLEDGE_IMPORT_STATE_SCHEMA,
  KNOWLEDGE_NODE_ADDRESSES_SCHEMA,
  KNOWLEDGE_NODE_SCOPES_SCHEMA,
  KNOWLEDGE_PROPOSALS_SCHEMA,
  KNOWLEDGE_RECORD_SCOPES_SCHEMA,
  KNOWLEDGE_SCOPE_ADDRESSES_SCHEMA,
  KNOWLEDGE_SCOPE_GRANTS_SCHEMA,
  KNOWLEDGE_SCHEMA_SCHEMA,
  KNOWLEDGE_SEMANTIC_OUTBOX_SCHEMA,
  KNOWLEDGE_STORAGE_CONTRACT_VERSION,
  KNOWLEDGE_STORAGE_SCHEMA_VERSION,
  KNOWLEDGE_ACTIVITY_SCHEMA,
  KNOWLEDGE_MENTIONS_SCHEMA,
  KNOWLEDGE_NODES_SCHEMA,
  KNOWLEDGE_RECORDS_SCHEMA,
  KNOWLEDGE_TABLE_NAMES,
  knowledgeScopeIdsKey,
  knowledgeSemanticDocumentId,
  knowledgeSemanticIdempotencyKey,
  KnowledgeConflictError,
  KnowledgeNotFoundError,
  KnowledgeSchemaError,
  KnowledgeStorage,
  parseKnowledgeNodeCursor,
  parseKnowledgeWikilinks,
  sanitizeKnowledgeImportError,
  TABLE_KNOWLEDGE_ACCESS_STATE,
  TABLE_KNOWLEDGE_ACTIVITY,
  TABLE_KNOWLEDGE_CURSORS,
  TABLE_KNOWLEDGE_IMPORT_RUNS,
  TABLE_KNOWLEDGE_IMPORT_STATE,
  TABLE_KNOWLEDGE_MENTIONS,
  TABLE_KNOWLEDGE_NODE_ADDRESSES,
  TABLE_KNOWLEDGE_NODE_SCOPES,
  TABLE_KNOWLEDGE_NODES,
  TABLE_KNOWLEDGE_PROPOSALS,
  TABLE_KNOWLEDGE_RECORD_SCOPES,
  TABLE_KNOWLEDGE_RECORDS,
  TABLE_KNOWLEDGE_SCOPE_ADDRESSES,
  TABLE_KNOWLEDGE_SCOPE_GRANTS,
  TABLE_KNOWLEDGE_SCHEMA,
  TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  ApplyKnowledgeProposalInput,
  ClaimKnowledgeImportRunInput,
  CreateKnowledgeRecordInput,
  ClaimKnowledgeSemanticOutboxInput,
  CreateKnowledgeImportRunInput,
  CreateKnowledgeProposalInput,
  CreateKnowledgeNodeInput,
  DeleteKnowledgeNodeInput,
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
  KnowledgeProposal,
  KnowledgeRecord,
  KnowledgeScopeAddress,
  KnowledgeScopeGrant,
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
  ListKnowledgeProposalsInput,
  ListKnowledgeProposalsOutput,
  SearchKnowledgeInput,
  SearchKnowledgeResult,
  ReviewKnowledgeProposalInput,
  RestoreKnowledgeNodeInput,
  PromoteKnowledgeNodeInput,
  UpdateKnowledgeImportRunInput,
  UpdateKnowledgeNodeInput,
} from '@mastra/core/storage';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { generateTableSQL } from '../operations';
import type { StoreOperationsMySQL } from '../operations';
import { parseDateTime } from '../utils';

interface QueryResult {
  rows: Record<string, unknown>[];
  rowsAffected: number;
}

interface Executor {
  execute(statement: string | { sql: string; args?: unknown[] }): Promise<QueryResult>;
}

export function mysqlSql(sql: string): string {
  return sql
    .replaceAll('jsonb(?)', '?')
    .replace(/\bjson\(([^)]+)\)\s+AS\s+/gi, '$1 AS ')
    .replaceAll("json_extract(binding,'$[1]')", "JSON_UNQUOTE(JSON_EXTRACT(binding,'$[1]'))")
    .replaceAll('\"', '`');
}

function createExecutor(client: Pick<Pool, 'query'> | Pick<PoolConnection, 'query'>): Executor {
  return {
    async execute(statement) {
      const sql = typeof statement === 'string' ? statement : statement.sql;
      const args = (typeof statement === 'string' ? [] : (statement.args ?? [])).map(value =>
        typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
          ? value.replace('T', ' ').replace('Z', '')
          : value,
      );
      const [result] = await client.query(mysqlSql(sql), args);
      if (Array.isArray(result)) return { rows: result as RowDataPacket[], rowsAffected: 0 };
      return { rows: [], rowsAffected: (result as ResultSetHeader).affectedRows };
    },
  };
}

const ACTIVITY_VISIBILITY_SCOPE_IDS = '__visibilityScopeIds';
const reconcileChains = new Map<unknown, Promise<unknown>>();
const unidentifiedClientReconcileKey = {};

function replaceKnowledgeScopeId(
  scopeIds: KnowledgeScopeIds,
  sourceScopeId: string,
  destinationScopeId: string,
): KnowledgeScopeIds {
  return [...new Set(scopeIds.map(scopeId => (scopeId === sourceScopeId ? destinationScopeId : scopeId)))].sort();
}

function activityVisibilityScopeIds(details?: Record<string, unknown>): string[] {
  const value = details?.[ACTIVITY_VISIBILITY_SCOPE_IDS];
  return Array.isArray(value) ? value.filter(scopeId => typeof scopeId === 'string') : [];
}

function publicActivityDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const { [ACTIVITY_VISIBILITY_SCOPE_IDS]: _, ...visibleDetails } = details;
  return Object.keys(visibleDetails).length ? visibleDetails : undefined;
}

function withReconcileLock<T>(key: unknown, operation: () => Promise<T>): Promise<T> {
  const lockKey = typeof key === 'string' ? key : unidentifiedClientReconcileKey;
  const previous = reconcileChains.get(lockKey) ?? Promise.resolve();
  const result = previous.then(operation, operation);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  reconcileChains.set(lockKey, tail);
  void tail.finally(() => {
    if (reconcileChains.get(lockKey) === tail) reconcileChains.delete(lockKey);
  });
  return result;
}

const visibleSql = (scopeColumn = 'scope') =>
  `NOT EXISTS (SELECT 1 FROM JSON_TABLE(${scopeColumn}, '$[*]' COLUMNS(value VARCHAR(191) PATH '$')) stored WHERE NOT EXISTS (SELECT 1 FROM JSON_TABLE(?, '$[*]' COLUMNS(value VARCHAR(191) PATH '$')) available WHERE available.value = stored.value)) AND ? IS NOT NULL`;

function scopeOverlapSql(scopeColumn: string, scopeIds: KnowledgeScopeIds): string {
  return `(${scopeIds.map(() => `JSON_CONTAINS(${scopeColumn}, JSON_QUOTE(?), '$')`).join(' OR ')})`;
}

function parseJson<T>(value: unknown): T {
  if (typeof value === 'string') return JSON.parse(value) as T;
  if (value instanceof Uint8Array) return JSON.parse(new TextDecoder().decode(value)) as T;
  if (value instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(value)) as T;
  return value as T;
}

function toDate(value: unknown): Date {
  const date = parseDateTime(value as Date | string | number | null | undefined);
  if (!date) throw new KnowledgeSchemaError('Knowledge timestamp is missing or invalid.');
  return date;
}

function optionalDate(value: unknown): Date | undefined {
  return value == null ? undefined : toDate(value);
}

function canonicalName(name: string): string {
  return name.trim().toLowerCase();
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

function escapeLikePattern(value: string): string {
  return value.replaceAll('=', '==').replaceAll('%', '=%').replaceAll('_', '=_');
}

function nodeReferenceId(node: KnowledgeNode | string): string {
  return typeof node === 'string' ? node : node.id;
}

function parseNode(row: Record<string, unknown>): KnowledgeNode {
  const deletedAt = optionalDate(row.deletedAt);
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
    ...(deletedAt ? { deletedAt } : {}),
    ...(row.deletedBy == null ? {} : { deletedBy: String(row.deletedBy) }),
  };
}

function parseKnowledge(row: Record<string, unknown>): KnowledgeRecord {
  const deletedAt = optionalDate(row.deletedAt);
  return {
    id: String(row.id),
    nodeId: String(row.nodeId),
    text: String(row.text),
    metadata: row.metadata == null ? undefined : parseJson<Record<string, unknown>>(row.metadataJson ?? row.metadata),
    source: row.source == null ? undefined : String(row.source),
    version: Number(row.version),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
    ...(deletedAt ? { deletedAt } : {}),
    ...(row.deletedBy == null ? {} : { deletedBy: String(row.deletedBy) }),
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

function parseProposal(row: Record<string, unknown>): KnowledgeProposal {
  const changes = parseJson<{ targets: KnowledgeProposal['targets']; payload: Record<string, unknown> }>(
    row.changesJson ?? row.changes,
  );
  return {
    id: String(row.id),
    targetType: String(row.targetType) as KnowledgeProposal['targetType'],
    targetId: String(row.targetId),
    expectedVersion: Number(row.expectedVersion),
    targets: changes.targets,
    operation: String(row.action),
    payload: changes.payload,
    reason: row.reason == null ? undefined : String(row.reason),
    proposerContextScopeId: row.proposerContextScopeId == null ? undefined : String(row.proposerContextScopeId),
    status: String(row.status) as KnowledgeProposal['status'],
    reviewerContextScopeId: row.reviewerContextScopeId == null ? undefined : String(row.reviewerContextScopeId),
    reviewReason: row.reviewReason == null ? undefined : String(row.reviewReason),
    reviewedAt: optionalDate(row.reviewedAt),
    createdAt: toDate(row.createdAt),
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

export class KnowledgeMySQL extends KnowledgeStorage {
  readonly #pool: Pool;
  readonly #operations: StoreOperationsMySQL;
  readonly #executor: Executor;

  constructor(config: { pool: Pool; operations: StoreOperationsMySQL }) {
    super({ storageIsolationKey: config.pool });
    this.#pool = config.pool;
    this.#operations = config.operations;
    this.#executor = createExecutor(config.pool);
  }

  override getCapabilities() {
    return {
      contractVersion: KNOWLEDGE_STORAGE_CONTRACT_VERSION,
      schemaVersion: KNOWLEDGE_STORAGE_SCHEMA_VERSION,
      supported: true,
    } as const;
  }

  static getExportDDL(): string[] {
    return [
      generateTableSQL({ tableName: TABLE_KNOWLEDGE_NODES, schema: KNOWLEDGE_NODES_SCHEMA }),
      generateTableSQL({ tableName: TABLE_KNOWLEDGE_RECORDS, schema: KNOWLEDGE_RECORDS_SCHEMA }),
      generateTableSQL({
        tableName: TABLE_KNOWLEDGE_MENTIONS,
        schema: KNOWLEDGE_MENTIONS_SCHEMA,
        compositePrimaryKey: ['recordId', 'targetNodeId'],
      }),
      generateTableSQL({
        tableName: TABLE_KNOWLEDGE_NODE_SCOPES,
        schema: KNOWLEDGE_NODE_SCOPES_SCHEMA,
        compositePrimaryKey: ['nodeId', 'scopeNodeId'],
      }),
      generateTableSQL({
        tableName: TABLE_KNOWLEDGE_RECORD_SCOPES,
        schema: KNOWLEDGE_RECORD_SCOPES_SCHEMA,
        compositePrimaryKey: ['recordId', 'scopeNodeId'],
      }),
      generateTableSQL({
        tableName: TABLE_KNOWLEDGE_SCOPE_GRANTS,
        schema: KNOWLEDGE_SCOPE_GRANTS_SCHEMA,
        compositePrimaryKey: ['scopeNodeId', 'scopeRefId'],
      }),
      generateTableSQL({ tableName: TABLE_KNOWLEDGE_ACCESS_STATE, schema: KNOWLEDGE_ACCESS_STATE_SCHEMA }),
      generateTableSQL({ tableName: TABLE_KNOWLEDGE_SCOPE_ADDRESSES, schema: KNOWLEDGE_SCOPE_ADDRESSES_SCHEMA }),
      generateTableSQL({
        tableName: TABLE_KNOWLEDGE_NODE_ADDRESSES,
        schema: KNOWLEDGE_NODE_ADDRESSES_SCHEMA,
        compositePrimaryKey: ['source', 'address'],
      }),
      generateTableSQL({
        tableName: TABLE_KNOWLEDGE_IMPORT_STATE,
        schema: KNOWLEDGE_IMPORT_STATE_SCHEMA,
        compositePrimaryKey: ['importerId', 'binding', 'key'],
      }),
      generateTableSQL({ tableName: TABLE_KNOWLEDGE_IMPORT_RUNS, schema: KNOWLEDGE_IMPORT_RUNS_SCHEMA }),
      generateTableSQL({ tableName: TABLE_KNOWLEDGE_PROPOSALS, schema: KNOWLEDGE_PROPOSALS_SCHEMA }),
      generateTableSQL({ tableName: TABLE_KNOWLEDGE_SCHEMA, schema: KNOWLEDGE_SCHEMA_SCHEMA }),
      generateTableSQL({
        tableName: TABLE_KNOWLEDGE_CURSORS,
        schema: KNOWLEDGE_CURSORS_SCHEMA,
        compositePrimaryKey: ['sourceThreadId', 'agent'],
      }),
      generateTableSQL({ tableName: TABLE_KNOWLEDGE_ACTIVITY, schema: KNOWLEDGE_ACTIVITY_SCHEMA }),
      generateTableSQL({ tableName: TABLE_KNOWLEDGE_SEMANTIC_OUTBOX, schema: KNOWLEDGE_SEMANTIC_OUTBOX_SCHEMA }),
    ];
  }

  async init(): Promise<void> {
    const tables = [
      [TABLE_KNOWLEDGE_NODES, KNOWLEDGE_NODES_SCHEMA],
      [TABLE_KNOWLEDGE_RECORDS, KNOWLEDGE_RECORDS_SCHEMA],
      [TABLE_KNOWLEDGE_MENTIONS, KNOWLEDGE_MENTIONS_SCHEMA, ['recordId', 'targetNodeId']],
      [TABLE_KNOWLEDGE_NODE_SCOPES, KNOWLEDGE_NODE_SCOPES_SCHEMA, ['nodeId', 'scopeNodeId']],
      [TABLE_KNOWLEDGE_RECORD_SCOPES, KNOWLEDGE_RECORD_SCOPES_SCHEMA, ['recordId', 'scopeNodeId']],
      [TABLE_KNOWLEDGE_SCOPE_GRANTS, KNOWLEDGE_SCOPE_GRANTS_SCHEMA, ['scopeNodeId', 'scopeRefId']],
      [TABLE_KNOWLEDGE_ACCESS_STATE, KNOWLEDGE_ACCESS_STATE_SCHEMA],
      [TABLE_KNOWLEDGE_SCOPE_ADDRESSES, KNOWLEDGE_SCOPE_ADDRESSES_SCHEMA],
      [TABLE_KNOWLEDGE_NODE_ADDRESSES, KNOWLEDGE_NODE_ADDRESSES_SCHEMA, ['source', 'address']],
      [TABLE_KNOWLEDGE_IMPORT_STATE, KNOWLEDGE_IMPORT_STATE_SCHEMA, ['importerId', 'binding', 'key']],
      [TABLE_KNOWLEDGE_IMPORT_RUNS, KNOWLEDGE_IMPORT_RUNS_SCHEMA],
      [TABLE_KNOWLEDGE_PROPOSALS, KNOWLEDGE_PROPOSALS_SCHEMA],
      [TABLE_KNOWLEDGE_SCHEMA, KNOWLEDGE_SCHEMA_SCHEMA],
      [TABLE_KNOWLEDGE_CURSORS, KNOWLEDGE_CURSORS_SCHEMA, ['sourceThreadId', 'agent']],
      [TABLE_KNOWLEDGE_ACTIVITY, KNOWLEDGE_ACTIVITY_SCHEMA],
      [TABLE_KNOWLEDGE_SEMANTIC_OUTBOX, KNOWLEDGE_SEMANTIC_OUTBOX_SCHEMA],
    ] as const;
    const tableNames = tables.map(([tableName]) => tableName);
    const existingTablesResult = await this.#executor.execute({
      sql: `SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN (${tableNames.map(() => '?').join(',')})`,
      args: tableNames,
    });
    if (existingTablesResult.rows.length > 0) {
      const existingTables = new Set(existingTablesResult.rows.map(row => String(row.tableName)));
      if (existingTables.size !== tableNames.length || tableNames.some(tableName => !existingTables.has(tableName))) {
        throw new KnowledgeSchemaError('Knowledge schema is partial or missing required tables.');
      }
      const columnsResult = await this.#executor.execute({
        sql: `SELECT table_name AS tableName,column_name AS columnName FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name IN (${tableNames.map(() => '?').join(',')})`,
        args: tableNames,
      });
      const existingColumns = new Set(
        columnsResult.rows.map(row => `${String(row.tableName)}\u0000${String(row.columnName)}`),
      );
      for (const [tableName, schema] of tables) {
        for (const columnName of Object.keys(schema)) {
          if (!existingColumns.has(`${tableName}\u0000${columnName}`)) {
            throw new KnowledgeSchemaError(`Knowledge schema table ${tableName} is missing column ${columnName}.`);
          }
        }
      }
      const marker = await this.#executor.execute(
        `SELECT version FROM "${TABLE_KNOWLEDGE_SCHEMA}" WHERE id='canonical'`,
      );
      if (Number(marker.rows[0]?.version) !== KNOWLEDGE_STORAGE_SCHEMA_VERSION) {
        throw new KnowledgeSchemaError(
          `Knowledge schema version mismatch: expected ${KNOWLEDGE_STORAGE_SCHEMA_VERSION}, received ${String(marker.rows[0]?.version ?? 'none')}.`,
        );
      }
    }
    for (const [tableName, schema, compositePrimaryKey] of tables) {
      await this.#executor.execute(
        generateTableSQL({ tableName, schema, compositePrimaryKey: compositePrimaryKey && [...compositePrimaryKey] }),
      );
    }
    const indexes = [
      ['idx_knowledge_nodes_name', TABLE_KNOWLEDGE_NODES, ['name']],
      ['idx_knowledge_records_node_latest', TABLE_KNOWLEDGE_RECORDS, ['nodeId', 'id']],
      ['idx_knowledge_mentions_record', TABLE_KNOWLEDGE_MENTIONS, ['recordId', 'targetNodeId']],
      ['idx_knowledge_activity_latest', TABLE_KNOWLEDGE_ACTIVITY, ['id']],
      ['idx_knowledge_outbox_idempotency', TABLE_KNOWLEDGE_SEMANTIC_OUTBOX, ['idempotencyKey'], true],
      ['idx_knowledge_outbox_claim', TABLE_KNOWLEDGE_SEMANTIC_OUTBOX, ['status', 'availableAt', 'createdAt']],
      ['idx_knowledge_node_scopes_scope', TABLE_KNOWLEDGE_NODE_SCOPES, ['scopeNodeId', 'nodeId']],
      ['idx_knowledge_record_scopes_scope', TABLE_KNOWLEDGE_RECORD_SCOPES, ['scopeNodeId', 'recordId']],
      ['idx_knowledge_scope_grants_ref', TABLE_KNOWLEDGE_SCOPE_GRANTS, ['scopeRefId', 'scopeNodeId']],
      ['idx_knowledge_node_addresses_node', TABLE_KNOWLEDGE_NODE_ADDRESSES, ['nodeId']],
      ['idx_knowledge_import_runs_lookup', TABLE_KNOWLEDGE_IMPORT_RUNS, ['importerId', 'binding', 'queuedAt']],
      ['idx_knowledge_activity_import_run', TABLE_KNOWLEDGE_ACTIVITY, ['importRunId', 'id']],
    ] as const;
    for (const [name, table, columns, unique] of indexes) {
      await this.#operations.createIndex({ name, table, columns: [...columns], unique: unique ?? false });
    }
    await this.#executor.execute(
      `INSERT INTO "${TABLE_KNOWLEDGE_ACCESS_STATE}" (id, epoch) VALUES ('global', 0) ON DUPLICATE KEY UPDATE id=id`,
    );
    await this.#executor.execute({
      sql: `INSERT INTO "${TABLE_KNOWLEDGE_SCHEMA}" (id, version) VALUES ('canonical', ?) ON DUPLICATE KEY UPDATE id=id`,
      args: [KNOWLEDGE_STORAGE_SCHEMA_VERSION],
    });
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
        TABLE_KNOWLEDGE_CURSORS,
        TABLE_KNOWLEDGE_RECORDS,
        TABLE_KNOWLEDGE_NODES,
      ]) {
        await tx.execute(`DELETE FROM "${table}"`);
      }
      await tx.execute(`UPDATE "${TABLE_KNOWLEDGE_ACCESS_STATE}" SET epoch = 0 WHERE id = 'global'`);
    });
  }

  override async getAccessEpoch(): Promise<number> {
    const result = await this.#executor.execute(
      `SELECT epoch FROM "${TABLE_KNOWLEDGE_ACCESS_STATE}" WHERE id='global'`,
    );
    return Number(result.rows[0]?.epoch ?? 0);
  }

  override async listScopeGrants(input: { includeDeleted?: boolean } = {}): Promise<KnowledgeScopeGrant[]> {
    const result = await this.#executor.execute(
      input.includeDeleted
        ? `SELECT scopeNodeId,scopeRefId,role,canSuggest FROM "${TABLE_KNOWLEDGE_SCOPE_GRANTS}" ORDER BY scopeNodeId,scopeRefId`
        : `SELECT g.scopeNodeId,g.scopeRefId,g.role,g.canSuggest FROM "${TABLE_KNOWLEDGE_SCOPE_GRANTS}" g JOIN "${TABLE_KNOWLEDGE_NODES}" target ON target.id=g.scopeNodeId JOIN "${TABLE_KNOWLEDGE_NODES}" ref ON ref.id=g.scopeRefId WHERE target.deletedAt IS NULL AND ref.deletedAt IS NULL ORDER BY g.scopeNodeId,g.scopeRefId`,
    );
    return result.rows.map(row => ({
      scopeNodeId: String(row.scopeNodeId),
      scopeRefId: String(row.scopeRefId),
      role: String(row.role) as KnowledgeScopeGrant['role'],
      canSuggest: row.canSuggest === null ? undefined : Boolean(row.canSuggest),
    }));
  }

  override async reconcileScopeReferenceGrants(input: {
    scopeRefId: string;
    grants: KnowledgeScopeGrant[];
    expectedAccessEpoch?: number;
  }): Promise<{ changed: boolean; accessEpoch: number }> {
    return withReconcileLock(this.getStorageIsolationKey(), () =>
      this.#transaction(async tx => {
        await tx.execute(`UPDATE "${TABLE_KNOWLEDGE_ACCESS_STATE}" SET epoch=epoch WHERE id='global'`);
        await this.#assertExpectedAccessEpoch(tx, input.expectedAccessEpoch);
        const desired = new Map<string, KnowledgeScopeGrant>();
        for (const grant of input.grants) {
          if (grant.scopeRefId !== input.scopeRefId || desired.has(grant.scopeNodeId)) {
            throw new KnowledgeConflictError('Knowledge scope-reference grant set is invalid');
          }
          desired.set(grant.scopeNodeId, grant);
        }
        const scopeIds = [input.scopeRefId, ...desired.keys()];
        const scopes = await tx.execute({
          sql: `SELECT id FROM "${TABLE_KNOWLEDGE_NODES}" WHERE id IN (${scopeIds.map(() => '?').join(',')}) AND isScope=TRUE AND deletedAt IS NULL`,
          args: scopeIds,
        });
        const liveScopeIds = new Set(scopes.rows.map(row => String(row.id)));
        const missingScopeId = scopeIds.find(scopeId => !liveScopeIds.has(scopeId));
        if (missingScopeId) throw new KnowledgeNotFoundError('scope', missingScopeId);
        const existing = await tx.execute({
          sql: `SELECT scopeNodeId,role,canSuggest FROM "${TABLE_KNOWLEDGE_SCOPE_GRANTS}" WHERE scopeRefId=?`,
          args: [input.scopeRefId],
        });
        const unchanged =
          existing.rows.length === desired.size &&
          existing.rows.every(row => {
            const grant = desired.get(String(row.scopeNodeId));
            return (
              grant?.role === String(row.role) &&
              grant.canSuggest === (row.canSuggest === null ? undefined : Boolean(row.canSuggest))
            );
          });
        if (unchanged) {
          const epoch = await tx.execute(`SELECT epoch FROM "${TABLE_KNOWLEDGE_ACCESS_STATE}" WHERE id='global'`);
          return { changed: false, accessEpoch: Number(epoch.rows[0]?.epoch ?? 0) };
        }

        await tx.execute({
          sql: `DELETE FROM "${TABLE_KNOWLEDGE_SCOPE_GRANTS}" WHERE scopeRefId=?`,
          args: [input.scopeRefId],
        });
        for (const grant of desired.values()) {
          await tx.execute({
            sql: `INSERT INTO "${TABLE_KNOWLEDGE_SCOPE_GRANTS}" (scopeNodeId,scopeRefId,role,canSuggest) VALUES (?,?,?,?)`,
            args: [grant.scopeNodeId, grant.scopeRefId, grant.role, grant.canSuggest ?? null],
          });
        }
        await tx.execute(`UPDATE "${TABLE_KNOWLEDGE_ACCESS_STATE}" SET epoch=epoch+1 WHERE id='global'`);
        const epoch = await tx.execute(`SELECT epoch FROM "${TABLE_KNOWLEDGE_ACCESS_STATE}" WHERE id='global'`);
        return { changed: true, accessEpoch: Number(epoch.rows[0]?.epoch ?? 0) };
      }),
    );
  }

  override async upsertScopeGrant(
    grant: KnowledgeScopeGrant,
    fence: { expectedAccessEpoch?: number } = {},
  ): Promise<{ changed: boolean; accessEpoch: number }> {
    return withReconcileLock(this.getStorageIsolationKey(), () =>
      this.#transaction(async tx => {
        await tx.execute(`UPDATE "${TABLE_KNOWLEDGE_ACCESS_STATE}" SET epoch=epoch WHERE id='global'`);
        await this.#assertExpectedAccessEpoch(tx, fence.expectedAccessEpoch);
        const scopes = await tx.execute({
          sql: `SELECT id FROM "${TABLE_KNOWLEDGE_NODES}" WHERE id IN (?,?) AND isScope=TRUE AND deletedAt IS NULL`,
          args: [grant.scopeNodeId, grant.scopeRefId],
        });
        const expectedScopeCount = grant.scopeNodeId === grant.scopeRefId ? 1 : 2;
        if (new Set(scopes.rows.map(row => String(row.id))).size !== expectedScopeCount) {
          throw new KnowledgeNotFoundError('scope', grant.scopeNodeId);
        }
        const existing = await tx.execute({
          sql: `SELECT role,canSuggest FROM "${TABLE_KNOWLEDGE_SCOPE_GRANTS}" WHERE scopeNodeId=? AND scopeRefId=?`,
          args: [grant.scopeNodeId, grant.scopeRefId],
        });
        const row = existing.rows[0];
        if (
          row &&
          String(row.role) === grant.role &&
          (row.canSuggest === null ? undefined : Boolean(row.canSuggest)) === grant.canSuggest
        ) {
          const epoch = await tx.execute(`SELECT epoch FROM "${TABLE_KNOWLEDGE_ACCESS_STATE}" WHERE id='global'`);
          return { changed: false, accessEpoch: Number(epoch.rows[0]?.epoch ?? 0) };
        }
        await tx.execute({
          sql: `INSERT INTO "${TABLE_KNOWLEDGE_SCOPE_GRANTS}" (scopeNodeId,scopeRefId,role,canSuggest) VALUES (?,?,?,?) AS incoming ON DUPLICATE KEY UPDATE role=incoming.role,canSuggest=incoming.canSuggest`,
          args: [grant.scopeNodeId, grant.scopeRefId, grant.role, grant.canSuggest ?? null],
        });
        await tx.execute(`UPDATE "${TABLE_KNOWLEDGE_ACCESS_STATE}" SET epoch=epoch+1 WHERE id='global'`);
        const epoch = await tx.execute(`SELECT epoch FROM "${TABLE_KNOWLEDGE_ACCESS_STATE}" WHERE id='global'`);
        return { changed: true, accessEpoch: Number(epoch.rows[0]?.epoch ?? 0) };
      }),
    );
  }

  override async removeScopeGrant(input: {
    scopeNodeId: string;
    scopeRefId: string;
    expectedAccessEpoch?: number;
  }): Promise<{ changed: boolean; accessEpoch: number }> {
    return withReconcileLock(this.getStorageIsolationKey(), () =>
      this.#transaction(async tx => {
        await tx.execute(`UPDATE "${TABLE_KNOWLEDGE_ACCESS_STATE}" SET epoch=epoch WHERE id='global'`);
        await this.#assertExpectedAccessEpoch(tx, input.expectedAccessEpoch);
        const result = await tx.execute({
          sql: `DELETE FROM "${TABLE_KNOWLEDGE_SCOPE_GRANTS}" WHERE scopeNodeId=? AND scopeRefId=?`,
          args: [input.scopeNodeId, input.scopeRefId],
        });
        if (result.rowsAffected > 0) {
          await tx.execute(`UPDATE "${TABLE_KNOWLEDGE_ACCESS_STATE}" SET epoch=epoch+1 WHERE id='global'`);
        }
        const epoch = await tx.execute(`SELECT epoch FROM "${TABLE_KNOWLEDGE_ACCESS_STATE}" WHERE id='global'`);
        return { changed: result.rowsAffected > 0, accessEpoch: Number(epoch.rows[0]?.epoch ?? 0) };
      }),
    );
  }

  override async reconcileStructure(
    plan: KnowledgeStructurePlan,
    options: { expectedAccessEpoch?: number; expectedAbsentScopeAddresses?: string[] } = {},
  ): Promise<KnowledgeStructureReconcileResult> {
    return withReconcileLock(this.getStorageIsolationKey(), () =>
      this.#transaction(async tx => {
        // Acquire the database write lock before any read so separate clients cannot both observe a missing address.
        await tx.execute(`UPDATE "${TABLE_KNOWLEDGE_ACCESS_STATE}" SET epoch=epoch WHERE id='global'`);
        await this.#assertExpectedAccessEpoch(tx, options.expectedAccessEpoch);
        for (const address of options.expectedAbsentScopeAddresses ?? []) {
          const existing = await tx.execute({
            sql: `SELECT 1 FROM "${TABLE_KNOWLEDGE_SCOPE_ADDRESSES}" WHERE address=? LIMIT 1`,
            args: [address],
          });
          if (existing.rows[0]) throw new KnowledgeConflictError(`Knowledge scope address already exists: ${address}`);
        }
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
            args: [
              id,
              scope.name,
              scope.kind ?? null,
              scope.metadata ? JSON.stringify(scope.metadata) : null,
              now,
              now,
            ],
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
          const desiredParentIds = new Set<string>();
          for (const parentAddress of scope.parentAddresses ?? []) {
            const parentId = await resolveAddress(parentAddress);
            if (!parentId || deletedScopeAddresses.has(parentAddress)) {
              throw new Error(`Knowledge parent scope does not exist: ${parentAddress}`);
            }
            desiredParentIds.add(parentId);
            const sibling = await tx.execute({
              sql: `SELECT n.id FROM "${TABLE_KNOWLEDGE_NODE_SCOPES}" ns JOIN "${TABLE_KNOWLEDGE_NODES}" n ON n.id=ns.nodeId WHERE ns.scopeNodeId=? AND lower(n.name)=? AND n.deletedAt IS NULL AND n.id<>? LIMIT 1`,
              args: [parentId, canonicalName(scope.name), scopeNodeId],
            });
            if (sibling.rows.length) {
              throw new Error(`Knowledge scope name ${scope.name} already exists under ${parentAddress}`);
            }
            const existingParent = await tx.execute({
              sql: `SELECT 1 FROM "${TABLE_KNOWLEDGE_NODE_SCOPES}" WHERE nodeId=? AND scopeNodeId=?`,
              args: [scopeNodeId, parentId],
            });
            await tx.execute({
              sql: `INSERT INTO "${TABLE_KNOWLEDGE_NODE_SCOPES}" (nodeId,scopeNodeId,addedAt) VALUES (?,?,?) ON DUPLICATE KEY UPDATE nodeId=nodeId`,
              args: [scopeNodeId, parentId, new Date().toISOString()],
            });
            structureChanged ||= !existingParent.rows[0];
          }
          const existingParents = await tx.execute({
            sql: `SELECT scopeNodeId FROM "${TABLE_KNOWLEDGE_NODE_SCOPES}" WHERE nodeId=?`,
            args: [scopeNodeId],
          });
          for (const row of existingParents.rows) {
            const parentId = String(row.scopeNodeId);
            if (!desiredParentIds.has(parentId)) {
              await tx.execute({
                sql: `DELETE FROM "${TABLE_KNOWLEDGE_NODE_SCOPES}" WHERE nodeId=? AND scopeNodeId=?`,
                args: [scopeNodeId, parentId],
              });
              structureChanged = true;
            }
          }

          const desiredGrantRefs = new Set<string>();
          for (const grant of scope.grants ?? []) {
            const scopeRefId = await resolveAddress(grant.scopeRefAddress);
            if (!scopeRefId || deletedScopeAddresses.has(grant.scopeRefAddress)) {
              throw new Error(`Knowledge grant scope does not exist: ${grant.scopeRefAddress}`);
            }
            desiredGrantRefs.add(scopeRefId);
            const existingGrant = await tx.execute({
              sql: `SELECT role,canSuggest FROM "${TABLE_KNOWLEDGE_SCOPE_GRANTS}" WHERE scopeNodeId=? AND scopeRefId=?`,
              args: [scopeNodeId, scopeRefId],
            });
            await tx.execute({
              sql: `INSERT INTO "${TABLE_KNOWLEDGE_SCOPE_GRANTS}" (scopeNodeId,scopeRefId,role,canSuggest) VALUES (?,?,?,?) AS incoming ON DUPLICATE KEY UPDATE role=incoming.role,canSuggest=incoming.canSuggest`,
              args: [scopeNodeId, scopeRefId, grant.role, grant.canSuggest ?? null],
            });
            const currentGrant = existingGrant.rows[0];
            structureChanged ||=
              !currentGrant ||
              String(currentGrant.role) !== grant.role ||
              (currentGrant.canSuggest == null ? undefined : Boolean(currentGrant.canSuggest)) !== grant.canSuggest;
          }
          const existingGrants = await tx.execute({
            sql: `SELECT scopeRefId FROM "${TABLE_KNOWLEDGE_SCOPE_GRANTS}" WHERE scopeNodeId=?`,
            args: [scopeNodeId],
          });
          for (const row of existingGrants.rows) {
            const scopeRefId = String(row.scopeRefId);
            if (!desiredGrantRefs.has(scopeRefId)) {
              await tx.execute({
                sql: `DELETE FROM "${TABLE_KNOWLEDGE_SCOPE_GRANTS}" WHERE scopeNodeId=? AND scopeRefId=?`,
                args: [scopeNodeId, scopeRefId],
              });
              structureChanged = true;
            }
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
      }),
    );
  }

  async createNode(input: CreateKnowledgeNodeInput): Promise<KnowledgeNode> {
    const lockKey = createHash('sha256').update(canonicalName(input.name)).digest('hex');
    return this.#transaction(async tx => {
      await this.#assertExpectedAccessEpoch(tx, input.expectedAccessEpoch);
      return this.#createNode(tx, input);
    }, lockKey);
  }

  async getNode(id: string): Promise<KnowledgeNode | null> {
    return this.#getNode(this.#executor, id);
  }

  async getNodeIncludingDeleted(id: string): Promise<KnowledgeNode | null> {
    return this.#getNodeIncludingDeleted(this.#executor, id);
  }

  async getNodeScopeIds(nodeId: string): Promise<KnowledgeScopeIds> {
    return this.#getNodeScopeIds(this.#executor, nodeId);
  }

  async getNodeByName(input: { name: string; scopeIds: KnowledgeScopeIds }): Promise<KnowledgeNode | null> {
    return this.#getNodeByName(this.#executor, input.name, canonicalizeKnowledgeScopeIds(input.scopeIds));
  }

  async resolveNode(input: { name: string; scopeIds: KnowledgeScopeIds }): Promise<KnowledgeNode | null> {
    return this.#resolveNode(this.#executor, input.name, canonicalizeKnowledgeScopeIds(input.scopeIds));
  }

  async listNodes(input: ListKnowledgeNodesInput): Promise<KnowledgeNode[]> {
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    const result = await this.#executor.execute(
      `SELECT *,json(metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_NODES}" WHERE deletedAt IS NULL`,
    );
    const nodes: KnowledgeNode[] = [];
    for (const row of result.rows) {
      const node = parseNode(row);
      const nodeScopeIds = await this.#getNodeScopeIds(this.#executor, node.id);
      if (!isKnowledgeNodeVisible(node, nodeScopeIds, scopeIds)) continue;
      if (input.membershipScopeIds && !isKnowledgeScopeVisible(nodeScopeIds, input.membershipScopeIds)) continue;
      if (input.name && node.name.trim().toLocaleLowerCase() !== input.name.trim().toLocaleLowerCase()) continue;
      if (input.namePrefix && !node.name.toLocaleLowerCase().startsWith(input.namePrefix.toLocaleLowerCase())) continue;
      if (input.kind && node.kind !== input.kind) continue;
      if (input.isScope !== undefined && node.isScope !== input.isScope) continue;
      nodes.push(node);
    }
    nodes.sort(
      (left, right) =>
        right.updatedAt.getTime() - left.updatedAt.getTime() ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id),
    );
    let start = 0;
    if (input.cursor) {
      const cursor = parseKnowledgeNodeCursor(input.cursor, {
        name: input.name,
        namePrefix: input.namePrefix,
        kind: input.kind,
        isScope: input.isScope,
      });
      start = nodes.findIndex(
        node =>
          node.updatedAt.getTime() < cursor.updatedAt.getTime() ||
          (node.updatedAt.getTime() === cursor.updatedAt.getTime() &&
            (node.name > cursor.name || (node.name === cursor.name && node.id > cursor.id))),
      );
      if (start < 0) return [];
    }
    return nodes.slice(start, start + (input.limit ?? 100));
  }

  async updateNode(input: UpdateKnowledgeNodeInput): Promise<KnowledgeNode> {
    const existing = await this.#getNode(this.#executor, input.id);
    const lockKey = existing
      ? createHash('sha256')
          .update(canonicalName(input.name ?? existing.name))
          .digest('hex')
      : undefined;
    return this.#transaction(tx => this.#updateNode(tx, input), lockKey);
  }

  async promoteNode(input: PromoteKnowledgeNodeInput): Promise<KnowledgeNode> {
    const existing = await this.#getNode(this.#executor, input.id);
    const lockKey = existing ? createHash('sha256').update(canonicalName(existing.name)).digest('hex') : undefined;
    return this.#transaction(tx => this.#promoteNode(tx, input), lockKey);
  }

  async #promoteNode(
    tx: Executor,
    input: PromoteKnowledgeNodeInput,
    expectedRecordVersions?: ReadonlyMap<string, number>,
  ): Promise<KnowledgeNode> {
    await this.#assertExpectedAccessEpoch(tx, input.expectedAccessEpoch);
    const node = await this.#getNode(tx, input.id);
    if (!node || node.deletedAt) throw new KnowledgeNotFoundError('node', input.id);
    if (node.version !== input.version) throw new KnowledgeConflictError(input.id);
    const nodeScopeIds = await this.#getNodeScopeIds(tx, node.id);
    if (!nodeScopeIds.includes(input.sourceScopeId)) throw new KnowledgeNotFoundError('node', input.id);
    const destination = await this.#getNode(tx, input.destinationScopeId);
    if (!destination?.isScope || destination.deletedAt) {
      throw new KnowledgeNotFoundError('scope', input.destinationScopeId);
    }

    const rows = await tx.execute({
      sql: `SELECT *,json(metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE nodeId=? AND deletedAt IS NULL`,
      args: [node.id],
    });
    const affectedRecords: { record: KnowledgeRecord; oldScopeIds: KnowledgeScopeIds }[] = [];
    for (const row of rows.rows) {
      const record = parseKnowledge(row);
      const oldScopeIds = await this.#getRecordScopeIds(tx, record.id);
      if (oldScopeIds.includes(input.sourceScopeId)) affectedRecords.push({ record, oldScopeIds });
    }
    if (
      expectedRecordVersions &&
      (affectedRecords.length !== expectedRecordVersions.size ||
        affectedRecords.some(({ record }) => expectedRecordVersions.get(record.id) !== record.version))
    ) {
      throw new KnowledgeConflictError(input.id);
    }
    const now = new Date();
    for (const { record, oldScopeIds } of affectedRecords) {
      const scopeIds = replaceKnowledgeScopeId(oldScopeIds, input.sourceScopeId, input.destinationScopeId);
      const updated = await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_RECORDS}" SET version=version+1,updatedAt=? WHERE id=? AND version=?`,
        args: [now.toISOString(), record.id, record.version],
      });
      if (updated.rowsAffected !== 1) throw new KnowledgeConflictError(record.id);
      await this.#replaceRecordScopes(tx, record.id, scopeIds, now);
      await this.#activity(tx, 'move', 'record', record.id, input.contextScopeId);
      await this.#outbox(tx, 'record', record.id, 'delete', record.version + 1, oldScopeIds);
      await this.#outbox(tx, 'record', record.id, 'upsert', record.version + 1, scopeIds);
    }

    return this.#updateNode(
      tx,
      {
        id: node.id,
        version: node.version,
        scopeIds: replaceKnowledgeScopeId(nodeScopeIds, input.sourceScopeId, input.destinationScopeId),
        metadata: {
          ...node.metadata,
          curatedFromScopeId: input.sourceScopeId,
          curatedAt: now.toISOString(),
        },
        contextScopeId: input.contextScopeId,
        expectedAccessEpoch: input.expectedAccessEpoch,
      },
      false,
    );
  }

  async deleteNode(input: DeleteKnowledgeNodeInput): Promise<KnowledgeNode> {
    return this.#transaction(async tx => {
      await this.#assertExpectedAccessEpoch(tx, input.expectedAccessEpoch);
      const existing = await this.#getNode(tx, input.id);
      if (!existing) throw new KnowledgeNotFoundError('node', input.id);
      if (existing.version !== input.version) throw new KnowledgeConflictError(input.id);
      if (existing.isScope) await this.#assertScopeIsEmpty(tx, existing.id);
      const scopeIds = await this.#getNodeScopeIds(tx, existing.id);
      const now = new Date();
      const result = await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_NODES}" SET version=version+1,updatedAt=?,deletedAt=?,deletedBy=? WHERE id=? AND version=? AND deletedAt IS NULL`,
        args: [now.toISOString(), now.toISOString(), input.deletedBy, input.id, input.version],
      });
      if (result.rowsAffected === 0) throw new KnowledgeConflictError(input.id);
      if (existing.isScope) {
        await tx.execute(`UPDATE "${TABLE_KNOWLEDGE_ACCESS_STATE}" SET epoch=epoch+1 WHERE id='global'`);
      }
      await this.#activity(tx, 'delete', 'node', input.id, scopeIds[0], undefined, {
        [ACTIVITY_VISIBILITY_SCOPE_IDS]: scopeIds,
      });
      await this.#outbox(tx, 'node', input.id, 'delete', existing.version + 1, scopeIds);
      const records = await tx.execute({
        sql: `SELECT id,version FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE nodeId=? AND deletedAt IS NULL`,
        args: [input.id],
      });
      for (const record of records.rows) {
        const recordId = String(record.id);
        await this.#outbox(
          tx,
          'record',
          recordId,
          'delete',
          Number(record.version),
          await this.#getRecordScopeIds(tx, recordId),
        );
      }
      return { ...existing, version: existing.version + 1, updatedAt: now, deletedAt: now, deletedBy: input.deletedBy };
    });
  }

  async restoreNode(input: RestoreKnowledgeNodeInput): Promise<KnowledgeNode> {
    return this.#transaction(async tx => {
      await this.#assertExpectedAccessEpoch(tx, input.expectedAccessEpoch);
      const existing = await this.#getNodeIncludingDeleted(tx, input.id);
      if (!existing?.deletedAt) throw new KnowledgeNotFoundError('node', input.id);
      if (existing.version !== input.version) throw new KnowledgeConflictError(input.id);
      const scopeIds = await this.#assertScopeNodes(tx, await this.#getNodeScopeIds(tx, existing.id));
      const now = new Date();
      const result = await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_NODES}" SET version=version+1,updatedAt=?,deletedAt=NULL,deletedBy=NULL WHERE id=? AND version=? AND deletedAt IS NOT NULL`,
        args: [now.toISOString(), input.id, input.version],
      });
      if (result.rowsAffected === 0) throw new KnowledgeConflictError(input.id);
      if (existing.isScope) {
        await tx.execute(`UPDATE "${TABLE_KNOWLEDGE_ACCESS_STATE}" SET epoch=epoch+1 WHERE id='global'`);
      }
      await this.#activity(tx, 'restore', 'node', input.id, scopeIds[0], undefined, {
        [ACTIVITY_VISIBILITY_SCOPE_IDS]: scopeIds,
      });
      await this.#outbox(tx, 'node', input.id, 'upsert', existing.version + 1, scopeIds);
      const records = await tx.execute({
        sql: `SELECT id,version FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE nodeId=? AND deletedAt IS NULL`,
        args: [input.id],
      });
      for (const record of records.rows) {
        const recordId = String(record.id);
        await this.#outbox(
          tx,
          'record',
          recordId,
          'upsert',
          Number(record.version),
          await this.#getRecordScopeIds(tx, recordId),
        );
      }
      return { ...existing, version: existing.version + 1, updatedAt: now, deletedAt: undefined, deletedBy: undefined };
    });
  }

  async mergeNodes(input: {
    sourceId: string;
    targetId: string;
    sourceVersion: number;
    targetVersion: number;
    importRunId?: string;
    contextScopeId?: string;
    expectedAccessEpoch?: number;
  }): Promise<KnowledgeNode> {
    if (input.sourceId === input.targetId) throw new Error('Cannot merge a knowledge node into itself');
    return this.#transaction(async tx => {
      await this.#assertExpectedAccessEpoch(tx, input.expectedAccessEpoch);
      const source = await this.#getNode(tx, input.sourceId);
      if (!source) throw new KnowledgeNotFoundError('node', input.sourceId);
      const target = await this.#getNode(tx, input.targetId);
      if (!target) throw new KnowledgeNotFoundError('node', input.targetId);
      if (target.version !== input.targetVersion) throw new KnowledgeConflictError(input.targetId);
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
        sql: `UPDATE IGNORE "${TABLE_KNOWLEDGE_MENTIONS}" SET targetNodeId=? WHERE targetNodeId=?`,
        args: [target.id, source.id],
      });
      await tx.execute({ sql: `DELETE FROM "${TABLE_KNOWLEDGE_MENTIONS}" WHERE targetNodeId=?`, args: [source.id] });
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_NODE_ADDRESSES}" SET nodeId=? WHERE nodeId=?`,
        args: [target.id, source.id],
      });
      await this.#activity(tx, 'merge', 'node', source.id, input.contextScopeId, input.importRunId, {
        targetId: target.id,
        [ACTIVITY_VISIBILITY_SCOPE_IDS]: sourceScopeIds,
      });
      await this.#outbox(tx, 'node', source.id, 'delete', input.sourceVersion + 1, sourceScopeIds);
      await tx.execute({ sql: `DELETE FROM "${TABLE_KNOWLEDGE_NODE_SCOPES}" WHERE nodeId=?`, args: [source.id] });
      return target;
    });
  }

  async createRecord(input: CreateKnowledgeRecordInput): Promise<KnowledgeRecord> {
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    if (scopeIds.length === 0) throw new KnowledgeNotFoundError('scope', 'root');
    return this.#transaction(async tx => {
      await this.#assertExpectedAccessEpoch(tx, input.expectedAccessEpoch);
      const nodeId = nodeReferenceId(input.node);
      const parent = await this.#getNode(tx, nodeId);
      if (!parent || parent.deletedAt) throw new KnowledgeNotFoundError('node', nodeId);
      const now = new Date();
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
          record.metadata ? JSON.stringify(record.metadata) : null,
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
      return record;
    });
  }

  async getRecord(input: { id: string; includeDeleted?: boolean }): Promise<KnowledgeRecord | null> {
    return this.#getRecord(this.#executor, input.id, input.includeDeleted ?? false);
  }

  async getVisibleRecord(input: {
    id: string;
    scopeIds: KnowledgeScopeIds;
    includeDeleted?: boolean;
  }): Promise<KnowledgeRecord | null> {
    const record = await this.#getRecord(this.#executor, input.id, input.includeDeleted ?? false);
    return record && (await this.#isRecordVisible(this.#executor, record, input.scopeIds)) ? record : null;
  }

  async getRecordScopeIds(recordId: string): Promise<KnowledgeScopeIds> {
    return this.#getRecordScopeIds(this.#executor, recordId);
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
    const args: unknown[] = [input.source];
    const clauses = ['source=?'];
    if (!input.includeDeleted) clauses.push('deletedAt IS NULL');
    if (input.after) {
      clauses.push('id > ?');
      args.push(input.after);
    }
    const result = await this.#executor.execute({
      sql: `SELECT *,json(metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE ${clauses.join(' AND ')} ORDER BY id ASC`,
      args,
    });
    const records: KnowledgeRecord[] = [];
    for (const row of result.rows) {
      const record = parseKnowledge(row);
      if (await this.#isRecordVisible(this.#executor, record, scopeIds)) records.push(record);
    }
    const limit = input.limit ?? 100;
    return {
      records: records.slice(0, limit),
      nextCursor: records.length > limit ? records[limit - 1]?.id : undefined,
    };
  }

  async deleteRecord(input: {
    id: string;
    version: number;
    deletedBy: string;
    importRunId?: string;
    expectedAccessEpoch?: number;
  }): Promise<KnowledgeRecord> {
    return this.#transaction(async tx => {
      await this.#assertExpectedAccessEpoch(tx, input.expectedAccessEpoch);
      const record = await this.#getRecord(tx, input.id, true);
      if (!record) throw new KnowledgeNotFoundError('record', input.id);
      if (record.version !== input.version) throw new KnowledgeConflictError(input.id);
      if (record.deletedAt) return record;
      const now = new Date();
      const updated = await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_RECORDS}" SET deletedAt=?,deletedBy=?,version=version+1,updatedAt=? WHERE id=? AND version=?`,
        args: [now.toISOString(), input.deletedBy, now.toISOString(), input.id, input.version],
      });
      if (updated.rowsAffected !== 1) throw new KnowledgeConflictError(input.id);
      const scopeIds = await this.#getRecordScopeIds(tx, input.id);
      await this.#activity(tx, 'delete', 'record', input.id, undefined, input.importRunId);
      await this.#outbox(tx, 'record', input.id, 'delete', record.version + 1, scopeIds);
      return { ...record, version: record.version + 1, updatedAt: now, deletedAt: now, deletedBy: input.deletedBy };
    });
  }

  async restoreRecord(input: {
    id: string;
    version: number;
    importRunId?: string;
    expectedAccessEpoch?: number;
  }): Promise<KnowledgeRecord> {
    return this.#transaction(async tx => {
      await this.#assertExpectedAccessEpoch(tx, input.expectedAccessEpoch);
      const record = await this.#getRecord(tx, input.id, true);
      if (!record) throw new KnowledgeNotFoundError('record', input.id);
      if (record.version !== input.version) throw new KnowledgeConflictError(input.id);
      if (!record.deletedAt) return record;
      const now = new Date();
      const updated = await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_RECORDS}" SET deletedAt=NULL,deletedBy=NULL,version=version+1,updatedAt=? WHERE id=? AND version=?`,
        args: [now.toISOString(), input.id, input.version],
      });
      if (updated.rowsAffected !== 1) throw new KnowledgeConflictError(input.id);
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
    expectedAccessEpoch?: number;
  }): Promise<KnowledgeRecord> {
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    if (scopeIds.length === 0) throw new KnowledgeNotFoundError('scope', 'root');
    return this.#transaction(async tx => {
      await this.#assertExpectedAccessEpoch(tx, input.expectedAccessEpoch);
      const record = await this.#getRecord(tx, input.id, true);
      if (!record) throw new KnowledgeNotFoundError('record', input.id);
      if (record.version !== input.version) throw new KnowledgeConflictError(input.id);
      const oldScopeIds = await this.#getRecordScopeIds(tx, input.id);
      const now = new Date();
      const updated = await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_RECORDS}" SET version=version+1,updatedAt=? WHERE id=? AND version=?`,
        args: [now.toISOString(), input.id, input.version],
      });
      if (updated.rowsAffected !== 1) throw new KnowledgeConflictError(input.id);
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
    if (!query) return [];
    const results: SearchKnowledgeResult[] = [];
    const nodes = await this.#executor.execute(
      `SELECT *,json(metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_NODES}" WHERE deletedAt IS NULL ORDER BY updatedAt DESC`,
    );
    for (const row of nodes.rows) {
      const node = parseNode(row);
      const nodeScopeIds = await this.#getNodeScopeIds(this.#executor, node.id);
      const haystack = `${node.name} ${node.kind ?? ''} ${JSON.stringify(node.metadata ?? {})}`.toLocaleLowerCase();
      if (isKnowledgeNodeVisible(node, nodeScopeIds, scopeIds) && haystack.includes(query))
        results.push({
          type: 'node',
          id: node.id,
          recordId: node.id,
          name: node.name,
          text: node.name,
          scopeIds: nodeScopeIds,
        });
      if (results.length >= (input.limit ?? 20)) return results;
    }
    const records = await this.#executor.execute(
      `SELECT *,json(metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE deletedAt IS NULL ORDER BY id DESC`,
    );
    for (const row of records.rows) {
      const record = parseKnowledge(row);
      if (!record.text.toLocaleLowerCase().includes(query)) continue;
      const recordScopeIds = await this.#getRecordScopeIds(this.#executor, record.id);
      if (!(await this.#isRecordVisible(this.#executor, record, scopeIds))) continue;
      const parent = await this.#getNode(this.#executor, record.nodeId);
      results.push({
        type: 'record',
        id: record.id,
        recordId: record.nodeId,
        name: parent!.name,
        text: record.text,
        scopeIds: recordScopeIds,
      });
      if (results.length >= (input.limit ?? 20)) break;
    }
    return results;
  }

  async getCurationCursor(input: { sourceThreadId: string; agent: string }): Promise<KnowledgeCurationCursor | null> {
    const result = await this.#executor.execute({
      sql: `SELECT * FROM "${TABLE_KNOWLEDGE_CURSORS}" WHERE sourceThreadId=? AND agent=?`,
      args: [input.sourceThreadId, input.agent],
    });
    const row = result.rows[0];
    return row
      ? {
          sourceThreadId: String(row.sourceThreadId),
          agent: String(row.agent),
          lastKnowledgeId: String(row.lastKnowledgeId),
          updatedAt: toDate(row.updatedAt),
        }
      : null;
  }

  async advanceCurationCursor(input: {
    sourceThreadId: string;
    agent: string;
    lastKnowledgeId: string;
  }): Promise<KnowledgeCurationCursor> {
    const updatedAt = new Date();
    const result = await this.#transaction(tx =>
      tx.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_CURSORS}" (sourceThreadId,agent,lastKnowledgeId,updatedAt) VALUES (?,?,?,?) AS incoming ON DUPLICATE KEY UPDATE lastKnowledgeId=IF(incoming.lastKnowledgeId>=lastKnowledgeId,incoming.lastKnowledgeId,lastKnowledgeId),updatedAt=IF(incoming.lastKnowledgeId>=lastKnowledgeId,incoming.updatedAt,updatedAt)`,
        args: [input.sourceThreadId, input.agent, input.lastKnowledgeId, updatedAt.toISOString()],
      }),
    );
    if (result.rowsAffected === 0) throw new Error('Knowledge curation cursor cannot move backwards');
    return { ...input, updatedAt };
  }

  async getScopeAddress(address: string): Promise<KnowledgeScopeAddress | null> {
    const result = await this.#executor.execute({
      sql: `SELECT a.address,a.scopeNodeId FROM "${TABLE_KNOWLEDGE_SCOPE_ADDRESSES}" a JOIN "${TABLE_KNOWLEDGE_NODES}" n ON n.id=a.scopeNodeId WHERE a.address=? AND n.isScope=1 AND n.deletedAt IS NULL`,
      args: [address],
    });
    const row = result.rows[0];
    return row ? { address: String(row.address), scopeNodeId: String(row.scopeNodeId) } : null;
  }

  async getNodeAddress(input: { source: string; address: string }): Promise<KnowledgeNodeAddress | null> {
    const result = await this.#executor.execute({
      sql: `SELECT a.source,a.address,a.nodeId FROM "${TABLE_KNOWLEDGE_NODE_ADDRESSES}" a JOIN "${TABLE_KNOWLEDGE_NODES}" n ON n.id=a.nodeId WHERE a.source=? AND a.address=? AND n.deletedAt IS NULL`,
      args: [input.source, input.address],
    });
    const row = result.rows[0];
    return row ? { source: String(row.source), address: String(row.address), nodeId: String(row.nodeId) } : null;
  }

  async listNodeAddresses(input: { source: string }): Promise<KnowledgeNodeAddress[]> {
    const result = await this.#executor.execute({
      sql: `SELECT a.source,a.address,a.nodeId FROM "${TABLE_KNOWLEDGE_NODE_ADDRESSES}" a JOIN "${TABLE_KNOWLEDGE_NODES}" n ON n.id=a.nodeId WHERE a.source=? AND n.deletedAt IS NULL ORDER BY a.address ASC`,
      args: [input.source],
    });
    return result.rows.map(row => ({
      source: String(row.source),
      address: String(row.address),
      nodeId: String(row.nodeId),
    }));
  }

  async setNodeAddress(input: KnowledgeNodeAddress & { expectedAccessEpoch?: number }): Promise<KnowledgeNodeAddress> {
    await this.#transaction(async tx => {
      await this.#assertExpectedAccessEpoch(tx, input.expectedAccessEpoch);
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
    return { source: input.source, address: input.address, nodeId: input.nodeId };
  }

  async createNodeWithAddress(input: {
    source: string;
    address: string;
    node: CreateKnowledgeNodeInput;
    expectedAccessEpoch?: number;
  }): Promise<KnowledgeNode> {
    return this.#transaction(async tx => {
      await this.#assertExpectedAccessEpoch(tx, input.expectedAccessEpoch ?? input.node.expectedAccessEpoch);
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

  async removeNodeAddress(input: {
    source: string;
    address: string;
    nodeId: string;
    expectedAccessEpoch?: number;
  }): Promise<void> {
    await this.#transaction(async tx => {
      await this.#assertExpectedAccessEpoch(tx, input.expectedAccessEpoch);
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
    expectedAccessEpoch?: number;
  }): Promise<KnowledgeNodeAddress> {
    return this.#transaction(async tx => {
      await this.#assertExpectedAccessEpoch(tx, input.expectedAccessEpoch);
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
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_NODE_ADDRESSES}" (source,address,nodeId) VALUES (?,?,?) AS incoming ON DUPLICATE KEY UPDATE nodeId=incoming.nodeId`,
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
    expectedAccessEpoch?: number;
  }): Promise<{ node: KnowledgeNode; deleted: boolean }> {
    return this.#transaction(async tx => {
      await this.#assertExpectedAccessEpoch(tx, input.expectedAccessEpoch);
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
      await this.#activity(tx, 'delete', 'node', node.id, undefined, input.importRunId, {
        [ACTIVITY_VISIBILITY_SCOPE_IDS]: scopeIds,
      });
      await this.#outbox(tx, 'node', node.id, 'delete', node.version + 1, scopeIds);
      const now = new Date().toISOString();
      await tx.execute({ sql: `DELETE FROM "${TABLE_KNOWLEDGE_NODE_SCOPES}" WHERE nodeId=?`, args: [node.id] });
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_NODES}" SET version=version+1,updatedAt=?,deletedAt=?,deletedBy=? WHERE id=?`,
        args: [now, now, `importer:${input.source}`, node.id],
      });
      return { node, deleted: true };
    });
  }

  async deleteRecordBySource(input: {
    id: string;
    version: number;
    source: string;
    importRunId?: string;
    expectedAccessEpoch?: number;
  }): Promise<KnowledgeRecord> {
    return this.#transaction(async tx => {
      await this.#assertExpectedAccessEpoch(tx, input.expectedAccessEpoch);
      const record = await this.#getRecord(tx, input.id, true);
      if (!record || record.source !== input.source) throw new KnowledgeNotFoundError('record', input.id);
      if (record.version !== input.version) throw new KnowledgeConflictError(input.id);
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
    const scopeIds = await this.#getRecordScopeIds(tx, id);
    const mentions = await tx.execute({
      sql: `SELECT 1 FROM "${TABLE_KNOWLEDGE_MENTIONS}" WHERE recordId=? LIMIT 1`,
      args: [id],
    });
    await this.#activity(
      tx,
      'delete',
      'record',
      id,
      undefined,
      importRunId,
      mentions.rows[0] ? undefined : { [ACTIVITY_VISIBILITY_SCOPE_IDS]: scopeIds },
    );
    await tx.execute({
      sql: `DELETE FROM "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" WHERE documentId=?`,
      args: [knowledgeSemanticDocumentId('record', id)],
    });
    await this.#outbox(tx, 'record', id, 'delete', record.version + 1, mentions.rows[0] ? [] : scopeIds);
    await tx.execute({ sql: `DELETE FROM "${TABLE_KNOWLEDGE_MENTIONS}" WHERE recordId=?`, args: [id] });
    await tx.execute({ sql: `DELETE FROM "${TABLE_KNOWLEDGE_RECORD_SCOPES}" WHERE recordId=?`, args: [id] });
    const deleted = await tx.execute({
      sql: `DELETE FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE id=?${expectedVersion === undefined ? '' : ' AND version=?'}`,
      args: expectedVersion === undefined ? [id] : [id, expectedVersion],
    });
    if (expectedVersion !== undefined && deleted.rowsAffected !== 1) throw new KnowledgeConflictError(id);
  }

  async getImportState(input: {
    importerId: string;
    binding: string;
    key: string;
  }): Promise<KnowledgeImportState | null> {
    const normalized = { ...input, binding: canonicalizeKnowledgeImporterBindingKey(input.binding) };
    const result = await this.#executor.execute({
      sql: `SELECT * FROM "${TABLE_KNOWLEDGE_IMPORT_STATE}" WHERE importerId=? AND binding=? AND "key"=?`,
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
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_IMPORT_STATE}" (importerId,binding,"key","value") VALUES (?,?,?,?) AS incoming ON DUPLICATE KEY UPDATE "value"=incoming."value"`,
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
      if (String(error).includes('Duplicate entry')) {
        throw new KnowledgeConflictError(`Import run ${run.id} already exists`);
      }
      throw error;
    }
    return run;
  }

  async enqueueImportRun(input: EnqueueKnowledgeImportRunInput): Promise<KnowledgeImportRun> {
    const binding = canonicalizeKnowledgeImporterBindingKey(input.binding);
    const queuedAt = input.queuedAt ?? new Date();
    const lockKey = input.skipIfActiveCron
      ? createHash('sha256').update(`import:${input.importerId}\0${binding}`).digest('hex')
      : undefined;
    return this.#transaction(async tx => {
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
          sql: `INSERT INTO "${TABLE_KNOWLEDGE_IMPORT_STATE}" (importerId,binding,"key","value") VALUES (?,?,?,?)`,
          args: [input.importerId, binding, input.payloadKey, input.payload],
        });
      }
      return run;
    }, lockKey);
  }

  async claimImportRun(input: ClaimKnowledgeImportRunInput): Promise<KnowledgeImportRun | null> {
    const binding = canonicalizeKnowledgeImporterBindingKey(input.binding);
    return this.#transaction(async tx => {
      const running = await tx.execute({
        sql: `SELECT 1 FROM "${TABLE_KNOWLEDGE_IMPORT_RUNS}" WHERE importerId=? AND binding=? AND status='running' LIMIT 1`,
        args: [input.importerId, binding],
      });
      if (running.rows.length) return null;
      const queued = await tx.execute({
        sql: `SELECT * FROM "${TABLE_KNOWLEDGE_IMPORT_RUNS}" WHERE importerId=? AND binding=? AND status='queued' ORDER BY queuedAt ASC,id ASC LIMIT 1`,
        args: [input.importerId, binding],
      });
      if (!queued.rows[0]) return null;
      const run = parseImportRun(queued.rows[0]);
      const timestamp = input.timestamp ?? new Date();
      const claimed = await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_IMPORT_RUNS}" SET status='running',startedAt=? WHERE id=? AND status='queued'`,
        args: [timestamp.toISOString(), run.id],
      });
      if (claimed.rowsAffected !== 1) return null;
      await tx.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_IMPORT_STATE}" (importerId,binding,"key","value") VALUES (?,?,?,?) AS incoming ON DUPLICATE KEY UPDATE "value"=incoming."value"`,
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
        sql: `SELECT s."value" FROM "${TABLE_KNOWLEDGE_IMPORT_STATE}" s JOIN "${TABLE_KNOWLEDGE_IMPORT_RUNS}" r ON r.id=? AND r.importerId=s.importerId AND r.binding=s.binding WHERE s.importerId=? AND s.binding=? AND s."key"=? AND r.status='running'`,
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
        sql: `UPDATE "${TABLE_KNOWLEDGE_IMPORT_STATE}" SET "value"=? WHERE importerId=? AND binding=? AND "key"=?`,
        args: [
          JSON.stringify({ workerId: input.workerId, heartbeatAt: timestamp.toISOString() }),
          input.importerId,
          binding,
          input.leaseKey,
        ],
      });
      return true;
    });
  }

  async finalizeImportRun(input: FinalizeKnowledgeImportRunInput): Promise<KnowledgeImportRun | null> {
    const binding = canonicalizeKnowledgeImporterBindingKey(input.binding);
    return this.#transaction(async tx => {
      const current = await tx.execute({
        sql: `SELECT r.*,s."value" AS leaseValue FROM "${TABLE_KNOWLEDGE_IMPORT_RUNS}" r JOIN "${TABLE_KNOWLEDGE_IMPORT_STATE}" s ON s.importerId=r.importerId AND s.binding=r.binding AND s."key"=? WHERE r.id=? AND r.importerId=? AND r.binding=? AND r.status='running'`,
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
          sql: `INSERT INTO "${TABLE_KNOWLEDGE_IMPORT_STATE}" (importerId,binding,"key","value") VALUES (?,?,?,?) AS incoming ON DUPLICATE KEY UPDATE "value"=incoming."value"`,
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
      const result = await tx.execute({
        sql: `SELECT * FROM "${TABLE_KNOWLEDGE_IMPORT_RUNS}" WHERE id=? AND status='running'`,
        args: [input.id],
      });
      if (!result.rows[0]) return null;
      const run = parseImportRun(result.rows[0]);
      const lease = await tx.execute({
        sql: `SELECT value FROM "${TABLE_KNOWLEDGE_IMPORT_STATE}" WHERE importerId=? AND binding=? AND "key"=?`,
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
        sql: `SELECT value FROM "${TABLE_KNOWLEDGE_IMPORT_STATE}" WHERE importerId=? AND binding=? AND "key"=?`,
        args: [run.importerId, run.binding, input.payloadKey],
      });
      const recoveredAt = input.queuedAt ?? new Date();
      const replayQueuedAt = new Date(run.queuedAt.getTime() - 1);
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
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_IMPORT_STATE}" (importerId,binding,"key","value") VALUES (?,?,?,?)`,
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
    const args: unknown[] = [];
    const binding = input.binding ? canonicalizeKnowledgeImporterBindingKey(input.binding) : undefined;
    if (input.importerId) {
      clauses.push('importerId=?');
      args.push(input.importerId);
    }
    if (input.importerIds) {
      if (input.importerIds.length === 0) return { runs: [], nextCursor: undefined };
      clauses.push(`importerId IN (${input.importerIds.map(() => '?').join(',')})`);
      args.push(...input.importerIds);
    }
    if (input.scopeIds) {
      if (input.scopeIds.length === 0) return { runs: [], nextCursor: undefined };
      clauses.push(
        `EXISTS (SELECT 1 FROM "${TABLE_KNOWLEDGE_SCOPE_ADDRESSES}" sa WHERE sa.address=json_extract(binding,'$[1]') AND sa.scopeNodeId IN (${input.scopeIds.map(() => '?').join(',')}))`,
      );
      args.push(...input.scopeIds);
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
    return this.#transaction(async tx => {
      const existing = await tx.execute({
        sql: `SELECT * FROM "${TABLE_KNOWLEDGE_IMPORT_RUNS}" WHERE id=?`,
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

  async createProposal(input: CreateKnowledgeProposalInput): Promise<KnowledgeProposal> {
    return this.#transaction(async tx => {
      await this.#assertExpectedAccessEpoch(tx, input.expectedAccessEpoch);
      const id = input.id ?? randomUUID();
      const createdAt = new Date();
      const primaryTarget = input.targets[0];
      if (!primaryTarget) throw new Error('A knowledge proposal requires at least one target');
      await tx.execute({
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_PROPOSALS}" (id,targetType,targetId,expectedVersion,action,changes,reason,proposerContextScopeId,status,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        args: [
          id,
          primaryTarget.type,
          primaryTarget.id,
          primaryTarget.expectedVersion,
          input.operation,
          JSON.stringify({ targets: input.targets, payload: input.payload }),
          input.reason ?? null,
          input.proposerContextScopeId,
          'pending',
          createdAt.toISOString(),
        ],
      });
      await this.#activity(
        tx,
        'propose',
        primaryTarget.type,
        primaryTarget.id,
        input.proposerContextScopeId,
        undefined,
        {
          proposalId: id,
        },
      );
      return {
        id,
        targetType: primaryTarget.type,
        targetId: primaryTarget.id,
        expectedVersion: primaryTarget.expectedVersion,
        targets: structuredClone(input.targets),
        operation: input.operation,
        payload: structuredClone(input.payload),
        reason: input.reason,
        proposerContextScopeId: input.proposerContextScopeId,
        status: 'pending',
        createdAt,
      };
    });
  }

  async getProposal(id: string): Promise<KnowledgeProposal | null> {
    const result = await this.#executor.execute({
      sql: `SELECT * FROM "${TABLE_KNOWLEDGE_PROPOSALS}" WHERE id=?`,
      args: [id],
    });
    return result.rows[0] ? parseProposal(result.rows[0]) : null;
  }

  async getVisibleProposal(input: { id: string; scopeIds: KnowledgeScopeIds }): Promise<KnowledgeProposal | null> {
    const proposal = await this.getProposal(input.id);
    return proposal && (await this.#isProposalVisible(this.#executor, proposal, input.scopeIds)) ? proposal : null;
  }

  async listProposals(input: ListKnowledgeProposalsInput): Promise<ListKnowledgeProposalsOutput> {
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    if (scopeIds.length === 0) return { proposals: [] };
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 100);
    if (input.cursor) {
      const cursor = await this.getVisibleProposal({ id: input.cursor, scopeIds });
      if (!cursor || (input.status && cursor.status !== input.status)) return { proposals: [] };
    }
    const clauses: string[] = [];
    const args: unknown[] = [];
    if (input.status) {
      clauses.push('status=?');
      args.push(input.status);
    }
    if (input.cursor) {
      clauses.push(
        `(createdAt < (SELECT createdAt FROM "${TABLE_KNOWLEDGE_PROPOSALS}" WHERE id=?) OR (createdAt = (SELECT createdAt FROM "${TABLE_KNOWLEDGE_PROPOSALS}" WHERE id=?) AND id < ?))`,
      );
      args.push(input.cursor, input.cursor, input.cursor);
    }
    const result = await this.#executor.execute({
      sql: `SELECT * FROM "${TABLE_KNOWLEDGE_PROPOSALS}"${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY createdAt DESC,id DESC`,
      args,
    });
    const proposals: KnowledgeProposal[] = [];
    for (const row of result.rows) {
      const proposal = parseProposal(row);
      if (await this.#isProposalVisible(this.#executor, proposal, scopeIds)) proposals.push(proposal);
      if (proposals.length > limit) break;
    }
    return {
      proposals: proposals.slice(0, limit),
      nextCursor: proposals.length > limit ? proposals[limit - 1]?.id : undefined,
    };
  }

  async reviewProposal(input: ReviewKnowledgeProposalInput): Promise<KnowledgeProposal> {
    return this.#transaction(async tx => {
      await this.#assertExpectedAccessEpoch(tx, input.expectedAccessEpoch);
      const existing = await tx.execute({
        sql: `SELECT * FROM "${TABLE_KNOWLEDGE_PROPOSALS}" WHERE id=?`,
        args: [input.id],
      });
      if (!existing.rows[0]) throw new KnowledgeNotFoundError('proposal', input.id);
      const proposal = parseProposal(existing.rows[0]);
      if (proposal.status !== 'pending') throw new KnowledgeConflictError('Knowledge proposal was already reviewed');
      const reviewedAt = new Date();
      const status = input.status;
      const updated = await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_PROPOSALS}" SET status=?,reviewerContextScopeId=?,reviewReason=?,reviewedAt=? WHERE id=? AND status='pending'`,
        args: [status, input.reviewerContextScopeId, input.reviewReason ?? null, reviewedAt.toISOString(), input.id],
      });
      if (updated.rowsAffected !== 1) throw new KnowledgeConflictError('Knowledge proposal was already reviewed');
      await this.#activity(
        tx,
        status === 'rejected' ? 'reject' : 'conflict',
        proposal.targetType,
        proposal.targetId,
        input.reviewerContextScopeId,
        undefined,
        { proposalId: proposal.id, reason: input.reviewReason },
      );
      return {
        ...proposal,
        status,
        reviewerContextScopeId: input.reviewerContextScopeId,
        reviewReason: input.reviewReason,
        reviewedAt,
      };
    });
  }

  async applyProposal(input: ApplyKnowledgeProposalInput): Promise<KnowledgeProposal> {
    return this.#transaction(async tx => {
      await this.#assertExpectedAccessEpoch(tx, input.expectedAccessEpoch);
      const existing = await tx.execute({
        sql: `SELECT * FROM "${TABLE_KNOWLEDGE_PROPOSALS}" WHERE id=?`,
        args: [input.id],
      });
      if (!existing.rows[0]) throw new KnowledgeNotFoundError('proposal', input.id);
      const proposal = parseProposal(existing.rows[0]);
      if (proposal.status !== 'pending') throw new KnowledgeConflictError('Knowledge proposal was already reviewed');
      for (const target of proposal.targets) {
        const table = target.type === 'node' ? TABLE_KNOWLEDGE_NODES : TABLE_KNOWLEDGE_RECORDS;
        const locked = await tx.execute({
          sql: `UPDATE "${table}" SET version=version WHERE id=? AND version=? AND deletedAt IS NULL`,
          args: [target.id, target.expectedVersion],
        });
        if (locked.rowsAffected !== 1) {
          return this.#markProposalConflicted(
            tx,
            proposal,
            input.reviewerContextScopeId,
            `Expected ${target.type} ${target.id} version ${target.expectedVersion}`,
          );
        }
      }
      const payload = proposal.payload as { kind?: unknown; mutation?: unknown };
      if (!payload.mutation || typeof payload.mutation !== 'object') {
        throw new Error(`Unsupported immutable payload for knowledge proposal ${proposal.id}`);
      }
      try {
        if (payload.kind === 'update-node') {
          await this.#updateNode(tx, {
            ...(structuredClone(payload.mutation) as UpdateKnowledgeNodeInput),
            contextScopeId: input.reviewerContextScopeId,
            importRunId: undefined,
            expectedAccessEpoch: input.expectedAccessEpoch,
          });
        } else if (payload.kind === 'promote-node') {
          await this.#promoteNode(
            tx,
            {
              ...(structuredClone(payload.mutation) as PromoteKnowledgeNodeInput),
              contextScopeId: input.reviewerContextScopeId,
              expectedAccessEpoch: input.expectedAccessEpoch,
            },
            new Map(
              proposal.targets
                .filter(target => target.type === 'record')
                .map(target => [target.id, target.expectedVersion]),
            ),
          );
        } else {
          throw new Error(`Unsupported immutable payload for knowledge proposal ${proposal.id}`);
        }
      } catch (error) {
        if (error instanceof KnowledgeConflictError) {
          return this.#markProposalConflicted(
            tx,
            proposal,
            input.reviewerContextScopeId,
            'Proposed mutation conflicts with current state',
          );
        }
        throw error;
      }
      const reviewedAt = new Date();
      const updated = await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_PROPOSALS}" SET status='approved',reviewerContextScopeId=?,reviewedAt=? WHERE id=? AND status='pending'`,
        args: [input.reviewerContextScopeId, reviewedAt.toISOString(), input.id],
      });
      if (updated.rowsAffected !== 1) throw new KnowledgeConflictError('Knowledge proposal was already reviewed');
      await this.#activity(
        tx,
        'approve',
        proposal.targetType,
        proposal.targetId,
        input.reviewerContextScopeId,
        undefined,
        {
          proposalId: proposal.id,
        },
      );
      return { ...proposal, status: 'approved', reviewerContextScopeId: input.reviewerContextScopeId, reviewedAt };
    });
  }

  async listActivity(input: {
    scopeIds: KnowledgeScopeIds;
    membershipScopeIds?: KnowledgeScopeIds;
    contextScopeId?: string;
    importRunId?: string;
    action?: KnowledgeActivityAction;
    sourceType?: 'importer' | 'system';
    from?: Date;
    to?: Date;
    after?: string;
    limit?: number;
  }): Promise<KnowledgeActivityEvent[]> {
    const clauses: string[] = [];
    const args: unknown[] = [];
    if (input.importRunId) {
      clauses.push('importRunId=?');
      args.push(input.importRunId);
    }
    if (input.action) {
      clauses.push('action=?');
      args.push(input.action);
    }
    if (input.sourceType)
      clauses.push(input.sourceType === 'importer' ? 'importRunId IS NOT NULL' : 'importRunId IS NULL');
    if (input.from) {
      clauses.push('createdAt>=?');
      args.push(input.from.toISOString());
    }
    if (input.to) {
      clauses.push('createdAt<=?');
      args.push(input.to.toISOString());
    }
    if (input.after) {
      clauses.push('id < ?');
      args.push(input.after);
    }
    const result = await this.#executor.execute({
      sql: `SELECT *,json(details) AS detailsJson FROM "${TABLE_KNOWLEDGE_ACTIVITY}"${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY id DESC`,
      args,
    });
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    const membershipScopeIds = input.membershipScopeIds
      ? canonicalizeKnowledgeScopeIds(input.membershipScopeIds)
      : undefined;
    const events: KnowledgeActivityEvent[] = [];
    for (const row of result.rows) {
      const action = String(row.action) as KnowledgeActivityAction;
      const details = row.detailsJson == null ? undefined : parseJson<Record<string, unknown>>(row.detailsJson);
      const proposalId = typeof details?.proposalId === 'string' ? details.proposalId : undefined;
      if (proposalId && !(await this.getVisibleProposal({ id: proposalId, scopeIds }))) continue;
      const retainedScopeIds = activityVisibilityScopeIds(details);
      const targetType = String(row.targetType) as KnowledgeSemanticDocumentType;
      const visibleDeletion = action === 'delete' && isKnowledgeScopeVisible(retainedScopeIds, scopeIds);
      const targetId = String(row.targetId);
      if (targetType === 'node') {
        const node = await this.#getNodeIncludingDeleted(this.#executor, targetId);
        const targetScopeIds = node ? await this.#getNodeScopeIds(this.#executor, targetId) : retainedScopeIds;
        if (membershipScopeIds && !isKnowledgeScopeVisible(targetScopeIds, membershipScopeIds)) continue;
        if (!visibleDeletion && (!node || !isKnowledgeScopeVisible(targetScopeIds, scopeIds))) continue;
      } else {
        const record = await this.#getRecord(this.#executor, targetId, true);
        const targetScopeIds = record ? await this.getRecordScopeIds(targetId) : retainedScopeIds;
        if (membershipScopeIds && !isKnowledgeScopeVisible(targetScopeIds, membershipScopeIds)) continue;
        if (record ? !(await this.#isRecordVisible(this.#executor, record, scopeIds)) : !visibleDeletion) continue;
      }
      events.push({
        id: String(row.id),
        action,
        targetType,
        targetId,
        contextScopeId: row.contextScopeId == null ? undefined : String(row.contextScopeId),
        importRunId: row.importRunId == null ? undefined : String(row.importRunId),
        details: publicActivityDetails(details),
        createdAt: toDate(row.createdAt),
      });
      if (events.length >= (input.limit ?? 100)) break;
    }
    return events;
  }

  async listSemanticOutbox(
    input: { status?: KnowledgeSemanticOutboxEntry['status']; scopeIds?: KnowledgeScopeIds; limit?: number } = {},
  ): Promise<KnowledgeSemanticOutboxEntry[]> {
    const args: unknown[] = [];
    const clauses: string[] = [];
    if (input.status) {
      clauses.push('status=?');
      args.push(input.status);
    }
    const scopeIds = input.scopeIds && canonicalizeKnowledgeScopeIds(input.scopeIds);
    if (scopeIds) {
      if (!scopeIds.length) return [];
      clauses.push(scopeOverlapSql('scopeIds', scopeIds));
      args.push(...scopeIds);
    }
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 100);
    const batchSize = Math.max(limit, Math.min(100, limit * 2));
    const entries: KnowledgeSemanticOutboxEntry[] = [];
    let cursor: { createdAt: string; id: string } | undefined;
    let scanned = 0;
    while (entries.length < limit && scanned < 1_000) {
      const pageClauses = [...clauses];
      const pageArgs = [...args];
      if (cursor) {
        pageClauses.push('(createdAt > ? OR (createdAt = ? AND id > ?))');
        pageArgs.push(cursor.createdAt, cursor.createdAt, cursor.id);
      }
      pageArgs.push(Math.min(batchSize, 1_000 - scanned));
      const result = await this.#executor.execute({
        sql: `SELECT *,json(scopeIds) AS scopeIdsJson FROM "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}"${pageClauses.length ? ` WHERE ${pageClauses.join(' AND ')}` : ''} ORDER BY createdAt ASC,id ASC LIMIT ?`,
        args: pageArgs,
      });
      scanned += result.rows.length;
      for (const row of result.rows) {
        const entry = parseOutbox(row);
        if (scopeIds && !(await this.#isSemanticOutboxEntryVisible(this.#executor, entry, scopeIds))) continue;
        entries.push(entry);
        if (entries.length >= limit) break;
      }
      const last = result.rows.at(-1);
      if (!last || result.rows.length < batchSize) break;
      cursor = { createdAt: toDate(last.createdAt).toISOString(), id: String(last.id) };
    }
    return entries;
  }

  async claimSemanticOutbox(input: ClaimKnowledgeSemanticOutboxInput): Promise<KnowledgeSemanticOutboxEntry[]> {
    const now = input.now ?? new Date();
    const stale = new Date(now.getTime() - (input.claimTimeoutMs ?? 60_000));
    return this.#transaction(async tx => {
      const scopeIds = input.scopeIds && canonicalizeKnowledgeScopeIds(input.scopeIds);
      if (scopeIds && !scopeIds.length) return [];
      const scopeClause = scopeIds ? ` AND ${scopeOverlapSql('o.scopeIds', scopeIds)}` : '';
      if (scopeIds) {
        const successors = await tx.execute({
          sql: `SELECT o.*,json(o.scopeIds) AS scopeIdsJson FROM "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" o WHERE o.availableAt <= ? AND (o.status='pending' OR (o.status='processing' AND o.claimedAt <= ?))${scopeClause} ORDER BY o.createdAt ASC,o.id ASC LIMIT 1000`,
          args: [now.toISOString(), stale.toISOString(), ...scopeIds],
        });
        for (const row of successors.rows) {
          const successor = parseOutbox(row);
          if (!(await this.#isSemanticOutboxEntryVisible(tx, successor, scopeIds))) continue;
          const invisiblePredecessorClause =
            successor.operation === 'delete' ? '' : ` AND NOT ${scopeOverlapSql('scopeIds', scopeIds)}`;
          await tx.execute({
            sql: `UPDATE "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" SET status='completed',completedAt=? WHERE documentId=? AND (status='pending' OR (status='processing' AND claimedAt <= ?)) AND (createdAt < ? OR (createdAt = ? AND id < ?))${invisiblePredecessorClause}`,
            args: [
              now.toISOString(),
              successor.documentId,
              stale.toISOString(),
              successor.createdAt.toISOString(),
              successor.createdAt.toISOString(),
              successor.id,
              ...(successor.operation === 'delete' ? [] : scopeIds),
            ],
          });
        }
      }
      const predecessorClause = ` AND NOT EXISTS (SELECT 1 FROM "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" earlier WHERE earlier.documentId=o.documentId AND earlier.status!='completed' AND (earlier.createdAt < o.createdAt OR (earlier.createdAt = o.createdAt AND earlier.id < o.id)))`;
      const limit = Math.min(Math.max(input.limit ?? 100, 1), 100);
      const batchSize = Math.max(limit, Math.min(100, limit * 2));
      const entries: KnowledgeSemanticOutboxEntry[] = [];
      let cursor: { createdAt: string; id: string } | undefined;
      let scanned = 0;
      while (entries.length < limit && scanned < 1_000) {
        const cursorClause = cursor ? ' AND (o.createdAt > ? OR (o.createdAt = ? AND o.id > ?))' : '';
        const selected = await tx.execute({
          sql: `SELECT o.*,json(o.scopeIds) AS scopeIdsJson FROM "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" o WHERE o.availableAt <= ? AND (o.status='pending' OR (o.status='processing' AND o.claimedAt <= ?))${scopeClause}${predecessorClause}${cursorClause} ORDER BY o.createdAt ASC,o.id ASC LIMIT ?`,
          args: [
            now.toISOString(),
            stale.toISOString(),
            ...(scopeIds ?? []),
            ...(cursor ? [cursor.createdAt, cursor.createdAt, cursor.id] : []),
            Math.min(batchSize, 1_000 - scanned),
          ],
        });
        scanned += selected.rows.length;
        for (const row of selected.rows) {
          const entry = parseOutbox(row);
          if (scopeIds && !(await this.#isSemanticOutboxEntryVisible(tx, entry, scopeIds))) continue;
          entries.push(entry);
          if (entries.length >= limit) break;
        }
        const last = selected.rows.at(-1);
        if (!last || selected.rows.length < batchSize) break;
        cursor = { createdAt: toDate(last.createdAt).toISOString(), id: String(last.id) };
      }
      const claimed: KnowledgeSemanticOutboxEntry[] = [];
      for (const entry of entries) {
        const updated = await tx.execute({
          sql: `UPDATE "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" SET status='processing',attempts=attempts+1,claimedAt=?,claimedBy=? WHERE id=? AND availableAt <= ? AND (status='pending' OR (status='processing' AND claimedAt <= ?))`,
          args: [now.toISOString(), input.workerId, entry.id, now.toISOString(), stale.toISOString()],
        });
        if (updated.rowsAffected > 0) {
          claimed.push({
            ...entry,
            status: 'processing',
            attempts: entry.attempts + 1,
            claimedAt: now,
            claimedBy: input.workerId,
          });
        }
      }
      return claimed;
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

  async #transaction<T>(operation: (tx: Executor) => Promise<T>, lockName?: string): Promise<T> {
    return this.#operations.withTransaction(connection => operation(createExecutor(connection)), lockName);
  }

  async #createNode(executor: Executor, input: CreateKnowledgeNodeInput): Promise<KnowledgeNode> {
    const scopeIds = await this.#assertScopeNodes(executor, input.scopeIds);
    const existing = await this.#getNodeByName(executor, input.name, scopeIds, true);
    if (existing?.deletedAt) throw new KnowledgeConflictError(existing.id);
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

  async #updateNode(
    executor: Executor,
    input: UpdateKnowledgeNodeInput,
    restampRecords = true,
  ): Promise<KnowledgeNode> {
    await this.#assertExpectedAccessEpoch(executor, input.expectedAccessEpoch);
    const existing = await this.#getNode(executor, input.id);
    if (!existing) throw new KnowledgeNotFoundError('node', input.id);
    const existingScopeIds = await this.#getNodeScopeIds(executor, input.id);
    const scopeIds = await this.#assertScopeNodes(executor, input.scopeIds ?? existingScopeIds);
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
    const collision = await this.#getNodeByName(executor, updated.name, scopeIds);
    if (collision && collision.id !== input.id) throw new KnowledgeConflictError(collision.id);
    await this.#assertNoSiblingNameCollision(executor, updated.name, scopeIds, input.id);
    if (existing.isScope && input.isScope === false) await this.#assertScopeHasNoDependents(executor, existing.id);
    const result = await executor.execute({
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
    if (input.scopeIds) await this.#replaceNodeScopes(executor, input.id, scopeIds, now);
    await this.#activity(executor, 'edit', 'node', input.id, input.contextScopeId, input.importRunId);
    if (knowledgeScopeIdsKey(existingScopeIds) !== knowledgeScopeIdsKey(scopeIds)) {
      await this.#outbox(executor, 'node', input.id, 'delete', updated.version, existingScopeIds);
    }
    await this.#outbox(executor, 'node', input.id, 'upsert', updated.version, scopeIds);
    if (restampRecords) {
      const recordRows = await executor.execute({
        sql: `SELECT *,json(metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE nodeId=?`,
        args: [input.id],
      });
      for (const row of recordRows.rows) {
        const record = parseKnowledge(row);
        const recordScopeIds = await this.#getRecordScopeIds(executor, record.id);
        await executor.execute({
          sql: `UPDATE "${TABLE_KNOWLEDGE_RECORDS}" SET version=version+1,updatedAt=? WHERE id=?`,
          args: [now.toISOString(), record.id],
        });
        await this.#outbox(
          executor,
          'record',
          record.id,
          record.deletedAt ? 'delete' : 'upsert',
          record.version + 1,
          recordScopeIds,
        );
      }
    }
    return updated;
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

  async #assertScopeIsEmpty(executor: Executor, scopeId: string): Promise<void> {
    const result = await executor.execute({
      sql: `SELECT 1 FROM "${TABLE_KNOWLEDGE_NODE_SCOPES}" ns JOIN "${TABLE_KNOWLEDGE_NODES}" n ON n.id=ns.nodeId WHERE ns.scopeNodeId=? AND ns.nodeId!=? AND n.deletedAt IS NULL LIMIT 1`,
      args: [scopeId, scopeId],
    });
    if (result.rows[0]) throw new KnowledgeConflictError(`Knowledge scope is not empty: ${scopeId}`);
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

  async #getNodeByName(
    executor: Executor,
    name: string,
    scopeIds: KnowledgeScopeIds,
    includeDeleted = false,
  ): Promise<KnowledgeNode | null> {
    const result = await executor.execute({
      sql: `SELECT *,json(metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_NODES}" WHERE lower(name)=? ${includeDeleted ? '' : 'AND deletedAt IS NULL'}`,
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
    const result = await executor.execute({
      sql: `SELECT *,json(metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_NODES}" WHERE lower(name)=? AND deletedAt IS NULL`,
      args: [canonicalName(name)],
    });
    const candidates: Array<{ node: KnowledgeNode; scopeIds: KnowledgeScopeIds }> = [];
    for (const row of result.rows) {
      const node = parseNode(row);
      const nodeScopeIds = await this.#getNodeScopeIds(executor, node.id);
      if (isKnowledgeNodeVisible(node, nodeScopeIds, scopeIds)) candidates.push({ node, scopeIds: nodeScopeIds });
    }
    candidates.sort(
      (left, right) => right.scopeIds.length - left.scopeIds.length || left.node.id.localeCompare(right.node.id),
    );
    return candidates[0]?.node ?? null;
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

  async #markProposalConflicted(
    tx: Executor,
    proposal: KnowledgeProposal,
    reviewerContextScopeId: string,
    reviewReason: string,
  ): Promise<KnowledgeProposal> {
    const reviewedAt = new Date();
    const updated = await tx.execute({
      sql: `UPDATE "${TABLE_KNOWLEDGE_PROPOSALS}" SET status='conflicted',reviewerContextScopeId=?,reviewReason=?,reviewedAt=? WHERE id=? AND status='pending'`,
      args: [reviewerContextScopeId, reviewReason, reviewedAt.toISOString(), proposal.id],
    });
    if (updated.rowsAffected !== 1) throw new KnowledgeConflictError('Knowledge proposal was already reviewed');
    await this.#activity(tx, 'conflict', proposal.targetType, proposal.targetId, reviewerContextScopeId, undefined, {
      proposalId: proposal.id,
      reason: reviewReason,
    });
    return {
      ...proposal,
      status: 'conflicted',
      reviewerContextScopeId,
      reviewReason,
      reviewedAt,
    };
  }

  async #isProposalVisible(
    executor: Executor,
    proposal: KnowledgeProposal,
    visibleScopeIds: KnowledgeScopeIds,
  ): Promise<boolean> {
    for (const target of proposal.targets) {
      if (target.type === 'node') {
        const node = await this.#getNodeIncludingDeleted(executor, target.id);
        if (!node || node.deletedAt) return false;
        const scopeIds = node.isScope ? [node.id] : await this.#getNodeScopeIds(executor, node.id);
        if (!isKnowledgeScopeVisible(scopeIds, visibleScopeIds)) return false;
      } else {
        const record = await this.#getRecord(executor, target.id, true);
        if (!record || record.deletedAt || !(await this.#isRecordVisible(executor, record, visibleScopeIds)))
          return false;
      }
    }
    return true;
  }

  async #isSemanticOutboxEntryVisible(
    executor: Executor,
    entry: KnowledgeSemanticOutboxEntry,
    visibleScopeIds: KnowledgeScopeIds,
  ): Promise<boolean> {
    const scopesVisible =
      entry.documentType === 'record'
        ? isKnowledgeScopeVisible(entry.scopeIds, visibleScopeIds)
        : isKnowledgeScopeVisible(entry.scopeIds, visibleScopeIds);
    if (!scopesVisible) return false;
    const id = entry.documentId.slice(`knowledge:${entry.documentType}:`.length);
    if (entry.documentType === 'node') {
      if (entry.operation === 'delete') return true;
      const node = await this.#getNode(executor, id);
      return Boolean(node && isKnowledgeNodeVisible(node, await this.#getNodeScopeIds(executor, id), visibleScopeIds));
    }
    const record = await this.#getRecord(executor, id, true);
    if (!record) return entry.operation === 'delete';
    if (entry.operation === 'delete') {
      const owner = await this.#getNodeIncludingDeleted(executor, record.nodeId);
      if (!owner || !isKnowledgeNodeVisible(owner, await this.#getNodeScopeIds(executor, owner.id), visibleScopeIds)) {
        return false;
      }
      const mentions = await executor.execute({
        sql: `SELECT targetNodeId FROM "${TABLE_KNOWLEDGE_MENTIONS}" WHERE recordId=?`,
        args: [record.id],
      });
      for (const row of mentions.rows) {
        const nodeId = String(row.targetNodeId);
        const node = await this.#getNode(executor, nodeId);
        if (!node || !isKnowledgeNodeVisible(node, await this.#getNodeScopeIds(executor, nodeId), visibleScopeIds)) {
          return false;
        }
      }
      return true;
    }
    return !record.deletedAt && (await this.#isRecordVisible(executor, record, visibleScopeIds));
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
    const args: unknown[] = [...membershipScopeIds];
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
    const result = await this.#executor.execute({
      sql: `SELECT r.*,json(r.metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_RECORDS}" r WHERE ${clauses.join(' AND ')} ORDER BY r.id DESC`,
      args,
    });
    const visible: KnowledgeRecord[] = [];
    for (const row of result.rows) {
      const record = parseKnowledge(row);
      if (await this.#isRecordVisible(this.#executor, record, scopeIds)) visible.push(record);
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
        sql: `SELECT id FROM "${TABLE_KNOWLEDGE_NODES}" WHERE id=? AND isScope=1 AND deletedAt IS NULL`,
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
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_NODE_SCOPES}" (nodeId,scopeNodeId,addedAt) VALUES (?,?,?) ON DUPLICATE KEY UPDATE nodeId=nodeId`,
        args: [nodeId, scopeNodeId, addedAt.toISOString()],
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
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_RECORD_SCOPES}" (recordId,scopeNodeId,addedAt) VALUES (?,?,?) ON DUPLICATE KEY UPDATE recordId=recordId`,
        args: [recordId, scopeNodeId, addedAt.toISOString()],
      });
    }
  }

  async #assertExpectedAccessEpoch(executor: Executor, expectedAccessEpoch?: number): Promise<void> {
    if (expectedAccessEpoch === undefined) return;
    const result = await executor.execute(`SELECT epoch FROM "${TABLE_KNOWLEDGE_ACCESS_STATE}" WHERE id='global'`);
    if (Number(result.rows[0]?.epoch ?? 0) !== expectedAccessEpoch) {
      throw new KnowledgeConflictError('Knowledge access changed during mutation authorization');
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
        sql: `INSERT INTO "${TABLE_KNOWLEDGE_MENTIONS}" (recordId,targetNodeId) VALUES (?,?) ON DUPLICATE KEY UPDATE recordId=recordId`,
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
      sql: `INSERT INTO "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" (id,idempotencyKey,documentId,documentType,operation,scopeIds,status,attempts,availableAt,claimedAt,claimedBy,createdAt,completedAt) VALUES (?,?,?,?,?,jsonb(?),'pending',0,?,NULL,NULL,?,NULL) ON DUPLICATE KEY UPDATE id=id`,
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
