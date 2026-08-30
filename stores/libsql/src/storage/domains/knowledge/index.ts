import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

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
  SearchKnowledgeResult,
  UpdateKnowledgeImportRunInput,
  UpdateKnowledgeNodeInput,
} from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import type {
  SqliteClient as Client,
  SqliteInValue as InValue,
  SqliteResultSet as ResultSet,
  SqliteTransaction as Transaction,
} from '../../db/client';
import { withClientWriteLock } from '../../db/write-lock';

interface Executor {
  execute(statement: string | { sql: string; args?: InValue[] }): Promise<ResultSet>;
}

const reconcileChains = new Map<unknown, Promise<unknown>>();
const unidentifiedClientReconcileKey = {};

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
  `NOT EXISTS (SELECT 1 FROM json_each(${scopeColumn}) stored WHERE NOT EXISTS (SELECT 1 FROM json_each(?) available WHERE available.value = stored.value)) AND ? IS NOT NULL`;

function parseJson<T>(value: unknown): T {
  if (typeof value === 'string') return JSON.parse(value) as T;
  if (value instanceof Uint8Array) return JSON.parse(new TextDecoder().decode(value)) as T;
  if (value instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(value)) as T;
  return value as T;
}

function toDate(value: unknown): Date {
  return new Date(String(value));
}

function optionalDate(value: unknown): Date | undefined {
  return value == null ? undefined : toDate(value);
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

function escapeLikePattern(value: string): string {
  return value.replaceAll('=', '==').replaceAll('%', '=%').replaceAll('_', '=_');
}

function nodeReferenceId(node: KnowledgeNode | string): string {
  return typeof node === 'string' ? node : node.id;
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

function canonicalizeLibSQLUrl(url: string): string | undefined {
  if (url.includes(':memory:')) return undefined;
  if (url.startsWith('file:')) {
    const [path] = url.slice('file:'.length).split('?');
    if (url.startsWith('file://')) {
      const parsed = new URL(url);
      const host = parsed.hostname.toLocaleLowerCase();
      const filePath = host && host !== 'localhost' ? `//${host}${parsed.pathname}` : parsed.pathname;
      return `file:${resolve(decodeURIComponent(filePath))}`;
    }
    return `file:${resolve(decodeURIComponent(path!))}`;
  }

  try {
    const parsed = new URL(url);
    const port = parsed.port || (parsed.protocol === 'libsql:' || parsed.protocol === 'https:' ? '443' : '80');
    return `${parsed.protocol}//${parsed.hostname.toLocaleLowerCase()}:${port}${parsed.pathname}`;
  } catch {
    return url;
  }
}

const unidentifiedClientIsolationKey = {};
const knowledgeWriteChains = new Map<unknown, Promise<unknown>>();

function withKnowledgeWriteLock<T>(key: unknown, operation: () => Promise<T>): Promise<T> {
  const previous = knowledgeWriteChains.get(key) ?? Promise.resolve();
  const result = previous.then(operation, operation);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  knowledgeWriteChains.set(key, tail);
  void tail.finally(() => {
    if (knowledgeWriteChains.get(key) === tail) knowledgeWriteChains.delete(key);
  });
  return result;
}

export function getLibSQLKnowledgeIsolationKey(
  config: { url?: string; client?: Client; storageIsolationKey?: unknown },
  _client?: Client,
): unknown {
  if (config.storageIsolationKey !== undefined) return config.storageIsolationKey;
  const urlKey = config.url ? canonicalizeLibSQLUrl(config.url) : undefined;
  return urlKey ? `libsql:${urlKey}` : unidentifiedClientIsolationKey;
}

export class KnowledgeLibSQL extends KnowledgeStorage {
  readonly #client: Client;
  readonly #db: LibSQLDB;

  constructor(config: LibSQLDomainConfig) {
    const client = resolveClient(config);
    const storageIsolationKey = config.storageIsolationKey ?? getLibSQLKnowledgeIsolationKey(config, client);
    super({ storageIsolationKey });
    this.#client = client;
    this.#db = new LibSQLDB({
      client: this.#client,
      maxRetries: config.maxRetries,
      initialBackoffMs: config.initialBackoffMs,
    });
  }

  override getCapabilities() {
    return {
      contractVersion: KNOWLEDGE_STORAGE_CONTRACT_VERSION,
      schemaVersion: KNOWLEDGE_STORAGE_SCHEMA_VERSION,
      supported: true,
    } as const;
  }

  async init(): Promise<void> {
    const existingTables = await this.#client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'mastra_knowledge_%'",
    );
    const existingNames = new Set(existingTables.rows.map(row => String(row.name)));
    if (existingNames.size > 0) {
      if (!existingNames.has(TABLE_KNOWLEDGE_SCHEMA)) {
        throw new KnowledgeSchemaError('The existing Knowledge schema has no completion marker.');
      }
      const marker = await this.#client.execute(`SELECT version FROM ${TABLE_KNOWLEDGE_SCHEMA} WHERE id = 'canonical'`);
      if (Number(marker.rows[0]?.version) !== KNOWLEDGE_STORAGE_SCHEMA_VERSION) {
        throw new KnowledgeSchemaError('The existing Knowledge schema version is unsupported.');
      }
      const missing = KNOWLEDGE_TABLE_NAMES.filter(table => !existingNames.has(table));
      if (missing.length > 0)
        throw new KnowledgeSchemaError(`The existing Knowledge schema is incomplete: ${missing.join(', ')}`);
      for (const table of KNOWLEDGE_TABLE_NAMES) {
        const columns = await this.#client.execute(`PRAGMA table_info("${table}")`);
        const actual = new Set(columns.rows.map(row => String(row.name)));
        const missingColumns = Object.keys(TABLE_SCHEMAS[table]).filter(column => !actual.has(column));
        if (missingColumns.length > 0) {
          throw new KnowledgeSchemaError(
            `The existing Knowledge table ${table} is incomplete: ${missingColumns.join(', ')}`,
          );
        }
      }
    }

    await this.#db.createTable({ tableName: TABLE_KNOWLEDGE_NODES, schema: KNOWLEDGE_NODES_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_KNOWLEDGE_RECORDS, schema: KNOWLEDGE_RECORDS_SCHEMA });
    await this.#db.createTable({
      tableName: TABLE_KNOWLEDGE_MENTIONS,
      schema: KNOWLEDGE_MENTIONS_SCHEMA,
      compositePrimaryKey: ['recordId', 'targetNodeId'],
    });
    await this.#db.createTable({
      tableName: TABLE_KNOWLEDGE_NODE_SCOPES,
      schema: KNOWLEDGE_NODE_SCOPES_SCHEMA,
      compositePrimaryKey: ['nodeId', 'scopeNodeId'],
    });
    await this.#db.createTable({
      tableName: TABLE_KNOWLEDGE_RECORD_SCOPES,
      schema: KNOWLEDGE_RECORD_SCOPES_SCHEMA,
      compositePrimaryKey: ['recordId', 'scopeNodeId'],
    });
    await this.#db.createTable({
      tableName: TABLE_KNOWLEDGE_SCOPE_GRANTS,
      schema: KNOWLEDGE_SCOPE_GRANTS_SCHEMA,
      compositePrimaryKey: ['scopeNodeId', 'scopeRefId'],
    });
    await this.#db.createTable({ tableName: TABLE_KNOWLEDGE_ACCESS_STATE, schema: KNOWLEDGE_ACCESS_STATE_SCHEMA });
    await this.#db.createTable({
      tableName: TABLE_KNOWLEDGE_SCOPE_ADDRESSES,
      schema: KNOWLEDGE_SCOPE_ADDRESSES_SCHEMA,
    });
    await this.#db.createTable({
      tableName: TABLE_KNOWLEDGE_NODE_ADDRESSES,
      schema: KNOWLEDGE_NODE_ADDRESSES_SCHEMA,
      compositePrimaryKey: ['source', 'address'],
    });
    await this.#db.createTable({
      tableName: TABLE_KNOWLEDGE_IMPORT_STATE,
      schema: KNOWLEDGE_IMPORT_STATE_SCHEMA,
      compositePrimaryKey: ['importerId', 'binding', 'key'],
    });
    await this.#db.createTable({ tableName: TABLE_KNOWLEDGE_IMPORT_RUNS, schema: KNOWLEDGE_IMPORT_RUNS_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_KNOWLEDGE_PROPOSALS, schema: KNOWLEDGE_PROPOSALS_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_KNOWLEDGE_SCHEMA, schema: KNOWLEDGE_SCHEMA_SCHEMA });
    await this.#db.createTable({
      tableName: TABLE_KNOWLEDGE_CURSORS,
      schema: KNOWLEDGE_CURSORS_SCHEMA,
      compositePrimaryKey: ['sourceThreadId', 'agent'],
    });
    await this.#db.createTable({ tableName: TABLE_KNOWLEDGE_ACTIVITY, schema: KNOWLEDGE_ACTIVITY_SCHEMA });
    await this.#db.createTable({
      tableName: TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
      schema: KNOWLEDGE_SEMANTIC_OUTBOX_SCHEMA,
    });
    await this.#client.batch(
      [
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_name ON "${TABLE_KNOWLEDGE_NODES}" (name)`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_records_node_latest ON "${TABLE_KNOWLEDGE_RECORDS}" (nodeId, id DESC)`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_mentions_record ON "${TABLE_KNOWLEDGE_MENTIONS}" (recordId, targetNodeId)`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_activity_latest ON "${TABLE_KNOWLEDGE_ACTIVITY}" (id DESC)`,
          args: [],
        },
        {
          sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_outbox_idempotency ON "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" (idempotencyKey)`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_outbox_claim ON "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" (status, availableAt, createdAt)`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_node_scopes_scope ON "${TABLE_KNOWLEDGE_NODE_SCOPES}" (scopeNodeId, nodeId)`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_record_scopes_scope ON "${TABLE_KNOWLEDGE_RECORD_SCOPES}" (scopeNodeId, recordId)`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_scope_grants_ref ON "${TABLE_KNOWLEDGE_SCOPE_GRANTS}" (scopeRefId, scopeNodeId)`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_node_addresses_node ON "${TABLE_KNOWLEDGE_NODE_ADDRESSES}" (nodeId)`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_import_runs_lookup ON "${TABLE_KNOWLEDGE_IMPORT_RUNS}" (importerId, binding, queuedAt DESC)`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_knowledge_activity_import_run ON "${TABLE_KNOWLEDGE_ACTIVITY}" (importRunId, id DESC)`,
          args: [],
        },
      ],
      'write',
    );
    await this.#client.execute({
      sql: `INSERT OR IGNORE INTO "${TABLE_KNOWLEDGE_ACCESS_STATE}" (id, epoch) VALUES ('global', 0)`,
      args: [],
    });
    await this.#client.execute({
      sql: `INSERT OR IGNORE INTO "${TABLE_KNOWLEDGE_SCHEMA}" (id, version) VALUES ('canonical', ?)`,
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

  override async reconcileStructure(plan: KnowledgeStructurePlan): Promise<KnowledgeStructureReconcileResult> {
    return withReconcileLock(this.getStorageIsolationKey(), () =>
      this.#transaction(async tx => {
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
            const sibling = await tx.execute({
              sql: `SELECT n.id FROM "${TABLE_KNOWLEDGE_NODE_SCOPES}" ns JOIN "${TABLE_KNOWLEDGE_NODES}" n ON n.id=ns.nodeId WHERE ns.scopeNodeId=? AND lower(n.name)=? AND n.deletedAt IS NULL AND n.id<>? LIMIT 1`,
              args: [parentId, canonicalName(scope.name), scopeNodeId],
            });
            if (sibling.rows.length) {
              throw new Error(`Knowledge scope name ${scope.name} already exists under ${parentAddress}`);
            }
            const inserted = await tx.execute({
              sql: `INSERT OR IGNORE INTO "${TABLE_KNOWLEDGE_NODE_SCOPES}" (nodeId,scopeNodeId,addedAt) VALUES (?,?,?)`,
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
              sql: `INSERT OR IGNORE INTO "${TABLE_KNOWLEDGE_SCOPE_GRANTS}" (scopeNodeId,scopeRefId,role,canSuggest) VALUES (?,?,?,?)`,
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
      }),
    );
  }

  async createNode(input: CreateKnowledgeNodeInput): Promise<KnowledgeNode> {
    return this.#transaction(tx => this.#createNode(tx, input));
  }

  async getNode(id: string): Promise<KnowledgeNode | null> {
    return this.#getNode(this.#client, id);
  }

  async getNodeScopeIds(nodeId: string): Promise<KnowledgeScopeIds> {
    return this.#getNodeScopeIds(this.#client, nodeId);
  }

  async getNodeByName(input: { name: string; scopeIds: KnowledgeScopeIds }): Promise<KnowledgeNode | null> {
    return this.#getNodeByName(this.#client, input.name, canonicalizeKnowledgeScopeIds(input.scopeIds));
  }

  async resolveNode(input: { name: string; scopeIds: KnowledgeScopeIds }): Promise<KnowledgeNode | null> {
    return this.#resolveNode(this.#client, input.name, canonicalizeKnowledgeScopeIds(input.scopeIds));
  }

  async listNodes(input: ListKnowledgeNodesInput): Promise<KnowledgeNode[]> {
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    const result = await this.#client.execute(
      `SELECT *,json(metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_NODES}" WHERE deletedAt IS NULL`,
    );
    const nodes: KnowledgeNode[] = [];
    for (const row of result.rows) {
      const node = parseNode(row);
      if (!isKnowledgeNodeVisible(node, await this.#getNodeScopeIds(this.#client, node.id), scopeIds)) continue;
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
    return this.#transaction(async tx => {
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
      const recordRows = await tx.execute({
        sql: `SELECT *,json(metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE nodeId=?`,
        args: [input.id],
      });
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
      }
      return updated;
    });
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
        sql: `UPDATE OR IGNORE "${TABLE_KNOWLEDGE_MENTIONS}" SET targetNodeId=? WHERE targetNodeId=?`,
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

  async createRecord(input: CreateKnowledgeRecordInput): Promise<KnowledgeRecord> {
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    return this.#transaction(async tx => {
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
      await this.#replaceMentions(tx, record.id, record.text, resolutionScopeIds, scopeIds, input.importRunId);
      await this.#activity(tx, 'create', 'record', record.id, input.contextScopeId, input.importRunId);
      await this.#outbox(tx, 'record', record.id, 'upsert', record.version, scopeIds);
      return record;
    });
  }

  async getRecord(input: { id: string; includeDeleted?: boolean }): Promise<KnowledgeRecord | null> {
    return this.#getRecord(this.#client, input.id, input.includeDeleted ?? false);
  }

  async getRecordScopeIds(recordId: string): Promise<KnowledgeScopeIds> {
    return this.#getRecordScopeIds(this.#client, recordId);
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
    const args: InValue[] = [input.source];
    const clauses = ['source=?'];
    if (!input.includeDeleted) clauses.push('deletedAt IS NULL');
    if (input.after) {
      clauses.push('id > ?');
      args.push(input.after);
    }
    const result = await this.#client.execute({
      sql: `SELECT *,json(metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE ${clauses.join(' AND ')} ORDER BY id ASC`,
      args,
    });
    const records: KnowledgeRecord[] = [];
    for (const row of result.rows) {
      const record = parseKnowledge(row);
      if (await this.#isRecordVisible(this.#client, record, scopeIds)) records.push(record);
    }
    const limit = input.limit ?? 100;
    return {
      records: records.slice(0, limit),
      nextCursor: records.length > limit ? records[limit - 1]?.id : undefined,
    };
  }

  async deleteRecord(input: { id: string; deletedBy: string; importRunId?: string }): Promise<KnowledgeRecord> {
    return this.#transaction(async tx => {
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
    });
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
    scopeIds: KnowledgeScopeIds;
    importRunId?: string;
    contextScopeId?: string;
  }): Promise<KnowledgeRecord> {
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    return this.#transaction(async tx => {
      const record = await this.#getRecord(tx, input.id, true);
      if (!record) throw new KnowledgeNotFoundError('record', input.id);
      const oldScopeIds = await this.#getRecordScopeIds(tx, input.id);
      const now = new Date();
      await tx.execute({
        sql: `UPDATE "${TABLE_KNOWLEDGE_RECORDS}" SET version=version+1,updatedAt=? WHERE id=?`,
        args: [now.toISOString(), input.id],
      });
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
    const nodes = await this.#client.execute(
      `SELECT *,json(metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_NODES}" WHERE deletedAt IS NULL ORDER BY updatedAt DESC`,
    );
    for (const row of nodes.rows) {
      const node = parseNode(row);
      const nodeScopeIds = await this.#getNodeScopeIds(this.#client, node.id);
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
    const records = await this.#client.execute(
      `SELECT *,json(metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE deletedAt IS NULL ORDER BY id DESC`,
    );
    for (const row of records.rows) {
      const record = parseKnowledge(row);
      if (!record.text.toLocaleLowerCase().includes(query)) continue;
      const recordScopeIds = await this.#getRecordScopeIds(this.#client, record.id);
      if (!(await this.#isRecordVisible(this.#client, record, scopeIds))) continue;
      const parent = await this.#getNode(this.#client, record.nodeId);
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
    const result = await this.#client.execute({
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
    const result = await this.#db.executeWriteOperationWithRetry(
      () =>
        withClientWriteLock(this.#client, () =>
          this.#client.execute({
            sql: `INSERT INTO "${TABLE_KNOWLEDGE_CURSORS}" (sourceThreadId,agent,lastKnowledgeId,updatedAt) VALUES (?,?,?,?) ON CONFLICT(sourceThreadId,agent) DO UPDATE SET lastKnowledgeId=excluded.lastKnowledgeId,updatedAt=excluded.updatedAt WHERE excluded.lastKnowledgeId >= "${TABLE_KNOWLEDGE_CURSORS}".lastKnowledgeId`,
            args: [input.sourceThreadId, input.agent, input.lastKnowledgeId, updatedAt.toISOString()],
          }),
        ),
      'advance knowledge curation cursor',
    );
    if (result.rowsAffected === 0) throw new Error('Knowledge curation cursor cannot move backwards');
    return { ...input, updatedAt };
  }

  async getScopeAddress(address: string): Promise<KnowledgeScopeAddress | null> {
    const result = await this.#client.execute({
      sql: `SELECT a.address,a.scopeNodeId FROM "${TABLE_KNOWLEDGE_SCOPE_ADDRESSES}" a JOIN "${TABLE_KNOWLEDGE_NODES}" n ON n.id=a.scopeNodeId WHERE a.address=? AND n.isScope=1 AND n.deletedAt IS NULL`,
      args: [address],
    });
    const row = result.rows[0];
    return row ? { address: String(row.address), scopeNodeId: String(row.scopeNodeId) } : null;
  }

  async getNodeAddress(input: { source: string; address: string }): Promise<KnowledgeNodeAddress | null> {
    const result = await this.#client.execute({
      sql: `SELECT source,address,nodeId FROM "${TABLE_KNOWLEDGE_NODE_ADDRESSES}" WHERE source=? AND address=?`,
      args: [input.source, input.address],
    });
    const row = result.rows[0];
    return row ? { source: String(row.source), address: String(row.address), nodeId: String(row.nodeId) } : null;
  }

  async listNodeAddresses(input: { source: string }): Promise<KnowledgeNodeAddress[]> {
    const result = await this.#client.execute({
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
      await this.#activity(tx, 'delete', 'node', node.id, undefined, input.importRunId);
      await this.#outbox(tx, 'node', node.id, 'delete', node.version + 1, scopeIds);
      await tx.execute({ sql: `DELETE FROM "${TABLE_KNOWLEDGE_MENTIONS}" WHERE targetNodeId=?`, args: [node.id] });
      await tx.execute({ sql: `DELETE FROM "${TABLE_KNOWLEDGE_NODE_SCOPES}" WHERE nodeId=?`, args: [node.id] });
      await tx.execute({ sql: `DELETE FROM "${TABLE_KNOWLEDGE_NODES}" WHERE id=?`, args: [node.id] });
      return { node, deleted: true };
    });
  }

  async deleteRecordBySource(input: { id: string; source: string; importRunId?: string }): Promise<KnowledgeRecord> {
    return this.#transaction(async tx => {
      const record = await this.#getRecord(tx, input.id, true);
      if (!record || record.source !== input.source) throw new KnowledgeNotFoundError('record', input.id);
      await this.#deleteRecordPermanently(tx, record.id, input.importRunId);
      return record;
    });
  }

  async #deleteRecordPermanently(tx: Transaction, id: string, importRunId?: string): Promise<void> {
    const record = await this.#getRecord(tx, id, true);
    if (!record) return;
    const scopeIds = await this.#getRecordScopeIds(tx, id);
    await this.#activity(tx, 'delete', 'record', id, undefined, importRunId);
    await this.#outbox(tx, 'record', id, 'delete', record.version + 1, scopeIds);
    await tx.execute({ sql: `DELETE FROM "${TABLE_KNOWLEDGE_MENTIONS}" WHERE recordId=?`, args: [id] });
    await tx.execute({ sql: `DELETE FROM "${TABLE_KNOWLEDGE_RECORD_SCOPES}" WHERE recordId=?`, args: [id] });
    await tx.execute({ sql: `DELETE FROM "${TABLE_KNOWLEDGE_RECORDS}" WHERE id=?`, args: [id] });
  }

  async getImportState(input: {
    importerId: string;
    binding: string;
    key: string;
  }): Promise<KnowledgeImportState | null> {
    const normalized = { ...input, binding: canonicalizeKnowledgeImporterBindingKey(input.binding) };
    const result = await this.#client.execute({
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
      if (String(error).includes('UNIQUE constraint failed')) {
        throw new KnowledgeConflictError(`Import run ${run.id} already exists`);
      }
      throw error;
    }
    return run;
  }

  async enqueueImportRun(input: EnqueueKnowledgeImportRunInput): Promise<KnowledgeImportRun> {
    const binding = canonicalizeKnowledgeImporterBindingKey(input.binding);
    const queuedAt = input.queuedAt ?? new Date();
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
        sql: `SELECT s.value FROM "${TABLE_KNOWLEDGE_IMPORT_STATE}" s JOIN "${TABLE_KNOWLEDGE_IMPORT_RUNS}" r ON r.id=? AND r.importerId=s.importerId AND r.binding=s.binding WHERE s.importerId=? AND s.binding=? AND s.key=? AND r.status='running'`,
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
    const binding = canonicalizeKnowledgeImporterBindingKey(input.binding);
    return this.#transaction(async tx => {
      const current = await tx.execute({
        sql: `SELECT r.*,s.value AS leaseValue FROM "${TABLE_KNOWLEDGE_IMPORT_RUNS}" r JOIN "${TABLE_KNOWLEDGE_IMPORT_STATE}" s ON s.importerId=r.importerId AND s.binding=r.binding AND s.key=? WHERE r.id=? AND r.importerId=? AND r.binding=? AND r.status='running'`,
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
    const result = await this.#client.execute({
      sql: `SELECT * FROM "${TABLE_KNOWLEDGE_IMPORT_RUNS}" WHERE id=?`,
      args: [id],
    });
    return result.rows[0] ? parseImportRun(result.rows[0]) : null;
  }

  async listImportRuns(input: ListKnowledgeImportRunsInput = {}): Promise<ListKnowledgeImportRunsOutput> {
    const clauses: string[] = [];
    const args: InValue[] = [];
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
    const result = await this.#client.execute({
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

  async listActivity(input: {
    scopeIds: KnowledgeScopeIds;
    importRunId?: string;
    after?: string;
    limit?: number;
  }): Promise<KnowledgeActivityEvent[]> {
    const clauses: string[] = [];
    const args: InValue[] = [];
    if (input.importRunId) {
      clauses.push('importRunId=?');
      args.push(input.importRunId);
    }
    if (input.after) {
      clauses.push('id < ?');
      args.push(input.after);
    }
    const result = await this.#client.execute({
      sql: `SELECT * FROM "${TABLE_KNOWLEDGE_ACTIVITY}"${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY id DESC`,
      args,
    });
    const scopeIds = canonicalizeKnowledgeScopeIds(input.scopeIds);
    const visible = new Set(scopeIds);
    const events: KnowledgeActivityEvent[] = [];
    for (const row of result.rows) {
      if (row.contextScopeId != null && !visible.has(String(row.contextScopeId))) continue;
      const targetType = String(row.targetType) as KnowledgeSemanticDocumentType;
      const targetId = String(row.targetId);
      if (targetType === 'node') {
        const node = await this.#getNodeIncludingDeleted(this.#client, targetId);
        if (!node || !isKnowledgeScopeVisible(await this.#getNodeScopeIds(this.#client, targetId), scopeIds)) continue;
      } else {
        const record = await this.#getRecord(this.#client, targetId, true);
        if (!record || !(await this.#isRecordVisible(this.#client, record, scopeIds))) continue;
      }
      events.push({
        id: String(row.id),
        action: String(row.action) as KnowledgeActivityAction,
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
    const args: InValue[] = [];
    const where = input.status ? ' WHERE status=?' : '';
    if (input.status) args.push(input.status);
    const result = await this.#client.execute({
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
        sql: `SELECT *,json(scopeIds) AS scopeIdsJson FROM "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" WHERE availableAt <= ? AND (status='pending' OR (status='processing' AND claimedAt <= ?)) ORDER BY createdAt ASC,id ASC`,
        args: [now.toISOString(), stale.toISOString()],
      });
      const scopeIds = input.scopeIds && canonicalizeKnowledgeScopeIds(input.scopeIds);
      const entries = selected.rows
        .map(parseOutbox)
        .filter(entry => !scopeIds || isKnowledgeScopeVisible(entry.scopeIds, scopeIds))
        .slice(0, input.limit ?? 100);
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

  async #transaction<T>(operation: (tx: Transaction) => Promise<T>): Promise<T> {
    return withKnowledgeWriteLock(this.getStorageIsolationKey(), () =>
      this.#db.executeWriteOperationWithRetry(
        () =>
          withClientWriteLock(this.#client, async () => {
            const tx = await this.#client.transaction('write');
            try {
              const result = await operation(tx);
              await tx.commit();
              return result;
            } catch (error) {
              if (!tx.closed) await tx.rollback();
              throw error;
            }
          }),
        'write knowledge state',
      ),
    );
  }
  async #createNode(executor: Transaction, input: CreateKnowledgeNodeInput): Promise<KnowledgeNode> {
    const scopeIds = await this.#assertScopeNodes(executor, input.scopeIds);
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
    const args: InValue[] = [...membershipScopeIds];
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
    const result = await this.#client.execute({
      sql: `SELECT r.*,json(r.metadata) AS metadataJson FROM "${TABLE_KNOWLEDGE_RECORDS}" r WHERE ${clauses.join(' AND ')} ORDER BY r.id DESC`,
      args,
    });
    const visible: KnowledgeRecord[] = [];
    for (const row of result.rows) {
      const record = parseKnowledge(row);
      if (await this.#isRecordVisible(this.#client, record, scopeIds)) visible.push(record);
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
        sql: `INSERT OR IGNORE INTO "${TABLE_KNOWLEDGE_NODE_SCOPES}" (nodeId,scopeNodeId,addedAt) VALUES (?,?,?)`,
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
        sql: `INSERT OR IGNORE INTO "${TABLE_KNOWLEDGE_RECORD_SCOPES}" (recordId,scopeNodeId,addedAt) VALUES (?,?,?)`,
        args: [recordId, scopeNodeId, addedAt.toISOString()],
      });
    }
  }

  async #replaceMentions(
    tx: Transaction,
    recordId: string,
    text: string,
    resolutionScopeIds: KnowledgeScopeIds,
    recordScopeIds: KnowledgeScopeIds,
    importRunId?: string,
  ): Promise<void> {
    await tx.execute({ sql: `DELETE FROM "${TABLE_KNOWLEDGE_MENTIONS}" WHERE recordId=?`, args: [recordId] });
    for (const name of parseKnowledgeWikilinks(text)) {
      let node = await this.#resolveNode(tx, name, resolutionScopeIds);
      if (!node) node = await this.#createNode(tx, { name, scopeIds: recordScopeIds, importRunId });
      await tx.execute({
        sql: `INSERT OR IGNORE INTO "${TABLE_KNOWLEDGE_MENTIONS}" (recordId,targetNodeId) VALUES (?,?)`,
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
      sql: `INSERT OR IGNORE INTO "${TABLE_KNOWLEDGE_SEMANTIC_OUTBOX}" (id,idempotencyKey,documentId,documentType,operation,scopeIds,status,attempts,availableAt,claimedAt,claimedBy,createdAt,completedAt) VALUES (?,?,?,?,?,jsonb(?),'pending',0,?,NULL,NULL,?,NULL)`,
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
