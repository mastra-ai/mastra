import { createHash, randomUUID } from 'node:crypto';

import {
  HarnessStorage,
  HarnessStorageAdmissionConflictError,
  HarnessStorageAttachmentInUseError,
  HarnessStorageAttachmentUnavailableError,
  HarnessStorageChannelActionClaimConflictError,
  HarnessStorageChannelActionReceiptTransitionError,
  HarnessStorageChannelActionTokenConflictError,
  HarnessStorageChannelInboxClaimConflictError,
  HarnessStorageChannelInboxTransitionError,
  HarnessStorageChannelOutboxClaimConflictError,
  HarnessStorageChannelOutboxTransitionError,
  HarnessStorageDeleteGuardConflictError,
  HarnessStorageLeaseConflictError,
  HarnessStorageParentSessionUnavailableError,
  HarnessStorageSessionNotFoundError,
  HarnessStorageThreadDeleteFenceConflictError,
  HarnessStorageVersionConflictError,
  HarnessStorageWakeupClaimConflictError,
  HarnessStorageWakeupTransitionError,
  TABLE_CONFIGS,
  TABLE_HARNESS_ATTACHMENT_REFERENCES,
  TABLE_HARNESS_ATTACHMENTS,
  TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS,
  TABLE_HARNESS_CHANNEL_ACTION_TOKENS,
  TABLE_HARNESS_CHANNEL_INBOX,
  TABLE_HARNESS_CHANNEL_OUTBOX,
  TABLE_HARNESS_MESSAGE_RESULTS,
  TABLE_HARNESS_OPERATION_TOMBSTONES,
  TABLE_HARNESS_SESSION_EVENTS,
  TABLE_HARNESS_SESSIONS,
  TABLE_HARNESS_THREAD_DELETE_FENCES,
  TABLE_HARNESS_WAKEUPS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  AcquireSessionLeaseInput,
  AgentSignalResultEvidence,
  AgentSignalResultStatus,
  AttachmentReference,
  AttachmentRecord,
  AttachmentSemanticMetadata,
  ChannelActionReceipt,
  ChannelActionToken,
  ChannelDiagnosticsRows,
  ChannelInboxItem,
  ChannelOutboxItem,
  ChannelProviderDeliveryReceipt,
  CreateIndexOptions,
  CreateOrLoadActiveSessionOptions,
  CreateOrLoadActiveSessionResult,
  CreateOrLoadChannelActionReceiptResult,
  CreateOrLoadChannelActionTokenResult,
  CreateOrLoadChannelInboxItemResult,
  CreateOrLoadHarnessWakeupItemResult,
  DeleteSessionOptions,
  HarnessWakeupItem,
  HarnessSessionEventRecord,
  HarnessSessionEventReplayState,
  ListActiveSessionsByThreadInput,
  ListChannelDiagnosticsInput,
  ListSessionsByThreadInput,
  ListSessionsInput,
  LoadedAttachment,
  JsonValue,
  OperationAdmissionEvidence,
  OperationAdmissionTombstone,
  QueueAdmissionReceipt,
  ReleaseSessionLeaseInput,
  RenewSessionLeaseInput,
  SaveAttachmentReferenceInput,
  SaveAttachmentInput,
  SaveAttachmentResult,
  SaveSessionOptions,
  SaveSessionResult,
  SessionLeaseResult,
  SessionRecord,
  SessionSummary,
  ThreadDeleteFenceLease,
  WithThreadDeleteFenceInput,
  WriteMessageResultEvidenceResult,
} from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';

import type { DbClient, QueryValues, TxClient } from '../../client';
import { PgDB, generateIndexSQL, generateTableSQL, resolvePgConfig } from '../../db';
import type { PgDomainConfig } from '../../db';

type HarnessWakeupClaimStatus = Extract<HarnessWakeupItem['status'], 'due' | 'claimed' | 'failed'>;
type PgHarnessExecuteArgs = string | { sql: string; args?: QueryValues };
type PgHarnessExecuteResult = { rows: Record<string, unknown>[]; rowsAffected: number };
type PgHarnessTx = PgHarnessClient & { closed: boolean; commit(): Promise<void>; rollback(): Promise<void> };
const HARNESS_TABLE_NAMES = [
  TABLE_HARNESS_SESSIONS,
  TABLE_HARNESS_ATTACHMENTS,
  TABLE_HARNESS_ATTACHMENT_REFERENCES,
  TABLE_HARNESS_MESSAGE_RESULTS,
  TABLE_HARNESS_OPERATION_TOMBSTONES,
  TABLE_HARNESS_SESSION_EVENTS,
  TABLE_HARNESS_THREAD_DELETE_FENCES,
  TABLE_HARNESS_CHANNEL_INBOX,
  TABLE_HARNESS_CHANNEL_ACTION_TOKENS,
  TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS,
  TABLE_HARNESS_CHANNEL_OUTBOX,
  TABLE_HARNESS_WAKEUPS,
] as const;

class PgHarnessClient {
  readonly #client: DbClient;
  readonly #schemaName?: string;

  constructor(client: DbClient, schemaName?: string) {
    this.#client = client;
    this.#schemaName = schemaName;
  }

  async execute(input: PgHarnessExecuteArgs): Promise<PgHarnessExecuteResult> {
    const { sql, args } = typeof input === 'string' ? { sql: input, args: [] } : input;
    const prepared = preparePgHarnessSql(sql, this.#schemaName);
    const result = await this.#client.query(prepared, args);
    return { rows: result.rows as Record<string, unknown>[], rowsAffected: result.rowCount ?? 0 };
  }

  async transaction(_mode?: 'write'): Promise<PgHarnessTx> {
    const client = await this.#client.connect();
    let closed = false;
    try {
      await client.query('BEGIN');
      const tx = new PgHarnessClient(
        {
          $pool: this.#client.$pool,
          connect: this.#client.connect.bind(this.#client),
          async none(query, values) {
            await client.query(query, values);
            return null;
          },
          async one<T>(query: string, values?: QueryValues): Promise<T> {
            const result = await client.query(query, values);
            if (result.rows.length !== 1) {
              throw new Error(`Expected one row from Harness PG transaction query, got ${result.rows.length}`);
            }
            return result.rows[0] as T;
          },
          async oneOrNone<T>(query: string, values?: QueryValues): Promise<T | null> {
            const result = await client.query(query, values);
            if (result.rows.length > 1) {
              throw new Error(`Expected zero or one row from Harness PG transaction query, got ${result.rows.length}`);
            }
            return (result.rows[0] as T | undefined) ?? null;
          },
          async any<T>(query: string, values?: QueryValues): Promise<T[]> {
            const result = await client.query(query, values);
            return result.rows as T[];
          },
          async manyOrNone<T>(query: string, values?: QueryValues): Promise<T[]> {
            const result = await client.query(query, values);
            return result.rows as T[];
          },
          async many<T>(query: string, values?: QueryValues): Promise<T[]> {
            const result = await client.query(query, values);
            if (result.rows.length === 0) {
              throw new Error('Expected at least one row from Harness PG transaction query');
            }
            return result.rows as T[];
          },
          async query(query: string, values?: QueryValues) {
            return client.query(query, values);
          },
          async batch<T>(promises: Promise<T>[]): Promise<T[]> {
            return Promise.all(promises);
          },
          async tx<T>(callback: (t: TxClient) => Promise<T>) {
            return callback(this as unknown as TxClient);
          },
        } as DbClient,
        this.#schemaName,
      ) as PgHarnessTx;
      Object.defineProperty(tx, 'closed', { get: () => closed });
      tx.commit = async () => {
        if (closed) return;
        await client.query('COMMIT');
        closed = true;
        client.release();
      };
      tx.rollback = async () => {
        if (closed) return;
        await client.query('ROLLBACK');
        closed = true;
        client.release();
      };
      return tx;
    } catch (err) {
      if (!closed) client.release();
      throw err;
    }
  }
}

function preparePgHarnessSql(sql: string, schemaName?: string): string {
  let param = 0;
  const schemaQualified = qualifyHarnessTableNames(sql, schemaName);
  return schemaQualified.replace(/\bIS\s+\?/g, 'IS NOT DISTINCT FROM ?').replace(/\?/g, () => `$${++param}`);
}

function qualifyHarnessTableNames(sql: string, schemaName?: string): string {
  if (!schemaName || schemaName === 'public') return sql;
  const schema = `"${parseSqlIdentifier(schemaName, 'schema name')}"`;
  let next = sql;
  for (const table of HARNESS_TABLE_NAMES) {
    const bare = parseSqlIdentifier(table, 'table name');
    const qualified = `${schema}."${bare}"`;
    next = next.replace(new RegExp(`"${bare}"`, 'g'), qualified);
    next = next.replace(new RegExp(`(?<!")\\b${bare}\\b(?!")`, 'g'), qualified);
  }
  return next;
}

function harnessIndexDefs(schemaPrefix: string): CreateIndexOptions[] {
  return [
    {
      name: `${schemaPrefix}idx_harness_sessions_active_key`,
      table: TABLE_HARNESS_SESSIONS,
      columns: ['harness_name', 'resource_id', 'thread_id'],
      unique: true,
      where: '"closed_at" IS NULL',
    },
    {
      name: `${schemaPrefix}idx_harness_sessions_thread_scope`,
      table: TABLE_HARNESS_SESSIONS,
      columns: ['harness_name', 'resource_id', 'thread_id', 'last_activity_at'],
    },
    {
      name: `${schemaPrefix}idx_harness_sessions_thread_global`,
      table: TABLE_HARNESS_SESSIONS,
      columns: ['thread_id', 'last_activity_at'],
    },
    {
      name: `${schemaPrefix}idx_harness_sessions_active_thread`,
      table: TABLE_HARNESS_SESSIONS,
      columns: ['harness_name', 'thread_id', 'last_activity_at'],
      where: '"closed_at" IS NULL',
    },
    {
      name: `${schemaPrefix}idx_harness_sessions_active_thread_global`,
      table: TABLE_HARNESS_SESSIONS,
      columns: ['thread_id', 'last_activity_at'],
      where: '"closed_at" IS NULL',
    },
    {
      name: `${schemaPrefix}idx_harness_session_events_replay`,
      table: TABLE_HARNESS_SESSION_EVENTS,
      columns: ['harness_name', 'session_id', 'resource_id', 'thread_id', 'epoch', 'sequence'],
    },
    {
      name: `${schemaPrefix}idx_harness_channel_inbox_idempotency`,
      table: TABLE_HARNESS_CHANNEL_INBOX,
      columns: ['harness_name', 'channel_id', 'idempotency_key'],
      unique: true,
    },
    {
      name: `${schemaPrefix}idx_harness_channel_inbox_claim`,
      table: TABLE_HARNESS_CHANNEL_INBOX,
      columns: ['harness_name', 'channel_id', 'status', 'next_attempt_at', 'claim_expires_at', 'received_at'],
    },
    {
      name: `${schemaPrefix}idx_harness_channel_action_tokens_transport`,
      table: TABLE_HARNESS_CHANNEL_ACTION_TOKENS,
      columns: ['harness_name', 'channel_id', 'transport_hash'],
      unique: true,
    },
    {
      name: `${schemaPrefix}idx_harness_channel_action_tokens_pending`,
      table: TABLE_HARNESS_CHANNEL_ACTION_TOKENS,
      columns: [
        'harness_name',
        'channel_id',
        'binding_id',
        'binding_generation',
        'owning_session_id',
        'item_id',
        'kind',
        'run_id',
        'pending_requested_at',
        'metadata_hash',
      ],
      unique: true,
    },
    {
      name: `${schemaPrefix}idx_harness_channel_action_receipts_token`,
      table: TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS,
      columns: ['harness_name', 'channel_id', 'action_token_id'],
      unique: true,
    },
    {
      name: `${schemaPrefix}idx_harness_channel_action_receipts_action`,
      table: TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS,
      columns: ['harness_name', 'channel_id', 'action_id', 'created_at'],
    },
    {
      name: `${schemaPrefix}idx_harness_channel_action_receipts_claim`,
      table: TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS,
      columns: ['harness_name', 'channel_id', 'status', 'next_attempt_at', 'claim_expires_at', 'created_at'],
    },
    {
      name: `${schemaPrefix}idx_harness_channel_outbox_idempotency`,
      table: TABLE_HARNESS_CHANNEL_OUTBOX,
      columns: ['harness_name', 'binding_id', 'idempotency_key'],
      unique: true,
    },
    {
      name: `${schemaPrefix}idx_harness_channel_outbox_claim`,
      table: TABLE_HARNESS_CHANNEL_OUTBOX,
      columns: ['harness_name', 'channel_id', 'status', 'next_attempt_at', 'claim_expires_at', 'created_at', 'id'],
    },
    {
      name: `${schemaPrefix}idx_harness_channel_outbox_binding_order`,
      table: TABLE_HARNESS_CHANNEL_OUTBOX,
      columns: ['harness_name', 'binding_id', 'status', 'created_at', 'id'],
    },
    {
      name: `${schemaPrefix}idx_harness_wakeups_idempotency`,
      table: TABLE_HARNESS_WAKEUPS,
      columns: ['harness_name', 'idempotency_key'],
      unique: true,
    },
    {
      name: `${schemaPrefix}idx_harness_wakeups_source_fire`,
      table: TABLE_HARNESS_WAKEUPS,
      columns: ['harness_name', 'source', 'source_id', 'fire_id'],
      unique: true,
    },
    {
      name: `${schemaPrefix}idx_harness_wakeups_claim`,
      table: TABLE_HARNESS_WAKEUPS,
      columns: ['harness_name', 'source', 'status', 'due_at', 'next_attempt_at', 'claim_expires_at'],
    },
  ];
}

/**
 * PostgreSQL `HarnessStorage` adapter.
 *
 * Sessions are persisted to a single row in `mastra_harness_sessions`. The
 * `version` column drives the optimistic-CAS contract — every successful
 * `saveSession` increments it inside the same `UPDATE`'s `WHERE` clause so
 * two writers cannot both observe the same predecessor.
 *
 * Attachments live in `mastra_harness_attachments` with a composite primary
 * key on `(harness_name, session_id, attachment_id)`. Bytes are stored
 * base64-encoded in `data_b64` for now and the digest/source metadata is
 * stored alongside the byte payload.
 */
export class HarnessPG extends HarnessStorage {
  #db: PgDB;
  #client: PgHarnessClient;
  #harnessName: string;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];
  #sessionEventsReady: Promise<void> | undefined;
  #compactionLocks = new Map<string, Promise<void>>();
  #channelInboxIndexesReady: Promise<void> | undefined;
  #channelActionIndexesReady: Promise<void> | undefined;
  #channelOutboxIndexesReady: Promise<void> | undefined;
  #wakeupIndexesReady: Promise<void> | undefined;
  #localThreadDeleteFences = new Map<string, { ownerId: string; leaseId: string; ttlMs: number }>();

  static readonly MANAGED_TABLES = [
    TABLE_HARNESS_SESSIONS,
    TABLE_HARNESS_ATTACHMENTS,
    TABLE_HARNESS_ATTACHMENT_REFERENCES,
    TABLE_HARNESS_MESSAGE_RESULTS,
    TABLE_HARNESS_OPERATION_TOMBSTONES,
    TABLE_HARNESS_SESSION_EVENTS,
    TABLE_HARNESS_THREAD_DELETE_FENCES,
    TABLE_HARNESS_CHANNEL_INBOX,
    TABLE_HARNESS_CHANNEL_ACTION_TOKENS,
    TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS,
    TABLE_HARNESS_CHANNEL_OUTBOX,
    TABLE_HARNESS_WAKEUPS,
  ] as const;

  constructor(config: PgDomainConfig & { harnessName?: string }) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#client = new PgHarnessClient(client, schemaName);
    this.#harnessName = config.harnessName ?? 'default';
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (HarnessPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
  }

  static getDefaultIndexDefs(schemaPrefix: string) {
    return harnessIndexDefs(schemaPrefix);
  }

  static getExportDDL(schemaName?: string): string[] {
    const statements: string[] = [];
    const parsedSchema = schemaName ? parseSqlIdentifier(schemaName, 'schema name') : '';
    const schemaPrefix = parsedSchema && parsedSchema !== 'public' ? `${parsedSchema}_` : '';

    for (const tableName of HarnessPG.MANAGED_TABLES) {
      const config = TABLE_CONFIGS[tableName];
      statements.push(
        generateTableSQL({
          tableName,
          schema: TABLE_SCHEMAS[tableName],
          schemaName,
          compositePrimaryKey: config?.compositePrimaryKey,
          includeAllConstraints: true,
        }),
      );
    }
    for (const indexDef of HarnessPG.getDefaultIndexDefs(schemaPrefix)) {
      statements.push(generateIndexSQL(indexDef, schemaName));
    }
    return statements;
  }

  async init(): Promise<void> {
    const sessionsConfig = TABLE_CONFIGS[TABLE_HARNESS_SESSIONS];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_SESSIONS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_SESSIONS],
      compositePrimaryKey: sessionsConfig?.compositePrimaryKey,
    });
    const attachmentsConfig = TABLE_CONFIGS[TABLE_HARNESS_ATTACHMENTS];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_ATTACHMENTS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_ATTACHMENTS],
      compositePrimaryKey: attachmentsConfig?.compositePrimaryKey,
    });
    const attachmentRefsConfig = TABLE_CONFIGS[TABLE_HARNESS_ATTACHMENT_REFERENCES];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_ATTACHMENT_REFERENCES,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_ATTACHMENT_REFERENCES],
      compositePrimaryKey: attachmentRefsConfig?.compositePrimaryKey,
    });
    await this.#ensureMessageResultsTable();
    await this.#ensureSessionEventsTable();
    const tombstonesConfig = TABLE_CONFIGS[TABLE_HARNESS_OPERATION_TOMBSTONES];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_OPERATION_TOMBSTONES,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_OPERATION_TOMBSTONES],
      compositePrimaryKey: tombstonesConfig?.compositePrimaryKey,
    });
    const threadDeleteFencesConfig = TABLE_CONFIGS[TABLE_HARNESS_THREAD_DELETE_FENCES];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_THREAD_DELETE_FENCES,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_THREAD_DELETE_FENCES],
      compositePrimaryKey: threadDeleteFencesConfig?.compositePrimaryKey,
    });
    await this.#ensureChannelInboxTable();
    await this.#ensureChannelActionTables();
    await this.#ensureChannelOutboxTable();
    await this.#ensureWakeupTable();
    await this.#db.alterTable({
      tableName: TABLE_HARNESS_SESSIONS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_SESSIONS],
      ifNotExists: [
        'harness_name',
        'subagent_depth',
        'queue_admission_receipts',
        'inbox_response_receipts',
        'closing_at',
        'close_deadline_at',
      ],
    });
    await this.#db.alterTable({
      tableName: TABLE_HARNESS_ATTACHMENTS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_ATTACHMENTS],
      ifNotExists: [
        'harness_name',
        'sha256',
        'source',
        'kind',
        'primitive_type',
        'element_type',
        'renderer_json',
        'schema_id',
        'metadata_json',
        'object_json',
      ],
    });
    await this.#db.alterTable({
      tableName: TABLE_HARNESS_ATTACHMENT_REFERENCES,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_ATTACHMENT_REFERENCES],
      ifNotExists: ['harness_name'],
    });
    await this.#backfillHarnessNamespace();
    if (!this.#skipDefaultIndexes) {
      await this.#assertNoDuplicateActiveSessions();
    }
    await this.#backfillAttachmentMetadata();
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return HarnessPG.getDefaultIndexDefs(this.#schemaPrefix());
  }

  async createDefaultIndexes(): Promise<void> {
    await this.#createDefaultIndexes();
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  async #lockThreadDeleteFence(tx: PgHarnessClient, threadId: string): Promise<void> {
    await tx.execute({
      sql: `SELECT pg_advisory_xact_lock(hashtextextended(?, 0::bigint))`,
      args: [`mastra:harness:thread-delete:${threadId}`],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#ensureMessageResultsTable();
    await this.#ensureOperationTombstonesTable();
    await this.#ensureSessionEventsTable();
    await this.#ensureThreadDeleteFencesTable();
    await this.#ensureChannelInboxTable();
    await this.#ensureChannelActionTables();
    await this.#ensureChannelOutboxTable();
    await this.#ensureWakeupTable();
    this.#localThreadDeleteFences.clear();
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_ATTACHMENT_REFERENCES}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_ATTACHMENTS}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_MESSAGE_RESULTS}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_OPERATION_TOMBSTONES}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_SESSION_EVENTS}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_CHANNEL_INBOX}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_CHANNEL_ACTION_TOKENS}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_CHANNEL_OUTBOX}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_WAKEUPS}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_THREAD_DELETE_FENCES}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_SESSIONS}`);
  }

  // -------------------------------------------------------------------------
  // Session records
  // -------------------------------------------------------------------------

  async loadSession({
    sessionId,
    harnessName,
  }: {
    sessionId: string;
    harnessName?: string;
  }): Promise<SessionRecord | null> {
    const namespace = this.#resolveHarnessName(harnessName);
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_SESSIONS} WHERE harness_name = ? AND id = ?`,
      args: [namespace, sessionId],
    });
    const row = result.rows[0];
    return row ? rowToSession(row as Record<string, unknown>) : null;
  }

  async loadSessionByThread({
    threadId,
    resourceId,
    harnessName,
  }: {
    threadId: string;
    resourceId: string;
    harnessName?: string;
  }): Promise<SessionRecord | null> {
    const namespace = this.#resolveHarnessName(harnessName);
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_SESSIONS}
            WHERE harness_name = ? AND thread_id = ? AND resource_id = ? AND closed_at IS NULL
            ORDER BY last_activity_at DESC
            LIMIT 1`,
      args: [namespace, threadId, resourceId],
    });
    const row = result.rows[0];
    return row ? rowToSession(row as Record<string, unknown>) : null;
  }

  async listSessions({
    resourceId,
    includeClosed = false,
    parentSessionId,
    harnessName,
  }: ListSessionsInput): Promise<SessionSummary[]> {
    const conditions: string[] = ['harness_name = ?', 'resource_id = ?'];
    const args: (string | number)[] = [this.#resolveHarnessName(harnessName), resourceId];

    if (!includeClosed) conditions.push('closed_at IS NULL');
    if (parentSessionId !== undefined) {
      conditions.push('parent_session_id = ?');
      args.push(parentSessionId);
    }

    const result = await this.#client.execute({
      sql: `SELECT harness_name, id, resource_id, thread_id, parent_session_id, origin, mode_id, model_id,
                   last_activity_at, closing_at, close_deadline_at, closed_at
            FROM ${TABLE_HARNESS_SESSIONS}
            WHERE ${conditions.join(' AND ')}
            ORDER BY last_activity_at DESC`,
      args,
    });

    return result.rows.map(row => rowToSummary(row as Record<string, unknown>));
  }

  async listSessionsByThread({
    resourceId,
    threadId,
    includeClosed = false,
    harnessName,
  }: ListSessionsByThreadInput): Promise<SessionSummary[]> {
    await this.#renewLocalThreadDeleteFence(threadId);
    const conditions: string[] = ['thread_id = ?'];
    const args: (string | number)[] = [threadId];
    if (harnessName !== undefined) {
      conditions.unshift('harness_name = ?');
      args.unshift(this.#resolveHarnessName(harnessName));
    }
    if (resourceId !== undefined) {
      conditions.push('resource_id = ?');
      args.push(resourceId);
    }

    if (!includeClosed) conditions.push('closed_at IS NULL');

    const result = await this.#client.execute({
      sql: `SELECT harness_name, id, resource_id, thread_id, parent_session_id, origin, mode_id, model_id,
                   last_activity_at, closing_at, close_deadline_at, closed_at
            FROM ${TABLE_HARNESS_SESSIONS}
            WHERE ${conditions.join(' AND ')}
            ORDER BY last_activity_at DESC`,
      args,
    });

    return result.rows.map(row => rowToSummary(row as Record<string, unknown>));
  }

  async listActiveSessionsByThread({
    threadId,
    harnessName,
  }: ListActiveSessionsByThreadInput): Promise<SessionSummary[]> {
    await this.#renewLocalThreadDeleteFence(threadId);
    const conditions = ['thread_id = ?', 'closed_at IS NULL'];
    const args: (string | number)[] = [threadId];
    if (harnessName !== undefined) {
      conditions.unshift('harness_name = ?');
      args.unshift(this.#resolveHarnessName(harnessName));
    }

    const result = await this.#client.execute({
      sql: `SELECT harness_name, id, resource_id, thread_id, parent_session_id, origin, mode_id, model_id,
                   last_activity_at, closing_at, close_deadline_at, closed_at
            FROM ${TABLE_HARNESS_SESSIONS}
            WHERE ${conditions.join(' AND ')}
            ORDER BY last_activity_at DESC`,
      args,
    });

    return result.rows.map(row => rowToSummary(row as Record<string, unknown>));
  }

  async withThreadDeleteFence<T>(
    { threadId, ownerId, ttlMs }: WithThreadDeleteFenceInput,
    fn: (fence: ThreadDeleteFenceLease) => Promise<T>,
  ): Promise<T> {
    await this.#ensureThreadDeleteFencesTable();
    const leaseId = randomUUID();
    for (;;) {
      const tx = await this.#client.transaction('write');
      try {
        await this.#lockThreadDeleteFence(tx, threadId);
        const now = Date.now();
        const expiresAt = now + ttlMs;
        await tx.execute({
          sql: `DELETE FROM ${TABLE_HARNESS_THREAD_DELETE_FENCES}
                WHERE expires_at <= ?`,
          args: [now],
        });
        const result = await tx.execute({
          sql: `INSERT INTO ${TABLE_HARNESS_THREAD_DELETE_FENCES}
                  (thread_id, owner_id, lease_id, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(thread_id) DO UPDATE SET
                  owner_id = excluded.owner_id,
                  lease_id = excluded.lease_id,
                  created_at = excluded.created_at,
                  expires_at = excluded.expires_at
                WHERE ${TABLE_HARNESS_THREAD_DELETE_FENCES}.expires_at <= ?`,
          args: [threadId, ownerId, leaseId, now, expiresAt, now],
        });
        if (result.rowsAffected !== 0) {
          await tx.commit();
          break;
        }
        const existing = await tx.execute({
          sql: `SELECT owner_id FROM ${TABLE_HARNESS_THREAD_DELETE_FENCES}
                WHERE thread_id = ? AND expires_at > ?
                LIMIT 1`,
          args: [threadId, now],
        });
        const existingOwnerId = (existing.rows[0] as any)?.owner_id as string | undefined;
        await tx.rollback();
        if (existingOwnerId === undefined) continue;
        throw new HarnessStorageThreadDeleteFenceConflictError(threadId, existingOwnerId);
      } catch (err) {
        if (!tx.closed) await tx.rollback();
        throw err;
      }
    }
    this.#localThreadDeleteFences.set(threadId, { ownerId, leaseId, ttlMs });
    const renewalIntervalMs = Math.max(1, Math.floor(ttlMs / 3));
    let renewals = Promise.resolve();
    let renewalFailure: unknown;
    const renewal = setInterval(() => {
      renewals = renewals
        .catch(err => {
          renewalFailure ??= err;
        })
        .then(async () => {
          await this.#renewLocalThreadDeleteFence(threadId, leaseId);
        })
        .then(
          () => undefined,
          err => {
            renewalFailure ??= err;
          },
        );
    }, renewalIntervalMs);
    (renewal as ReturnType<typeof setInterval> & { unref?: () => void }).unref?.();
    const assertActive = async () => {
      try {
        await renewals;
      } catch (err) {
        renewalFailure ??= err;
      }
      if (renewalFailure) throw renewalFailure;
      await this.#renewLocalThreadDeleteFence(threadId, leaseId);
      if (renewalFailure) throw renewalFailure;
    };
    const fence: ThreadDeleteFenceLease = {
      threadId,
      ownerId,
      assertActive,
    };
    try {
      const result = await fn(fence);
      if (renewalFailure) throw renewalFailure;
      return result;
    } finally {
      clearInterval(renewal);
      try {
        await renewals;
      } catch (err) {
        renewalFailure ??= err;
      }
      const localFence = this.#localThreadDeleteFences.get(threadId);
      if (localFence && localFence.ownerId === ownerId && localFence.leaseId === leaseId) {
        this.#localThreadDeleteFences.delete(threadId);
      }
      await this.#client.execute({
        sql: `DELETE FROM ${TABLE_HARNESS_THREAD_DELETE_FENCES}
              WHERE thread_id = ? AND owner_id = ? AND lease_id = ?`,
        args: [threadId, ownerId, leaseId],
      });
    }
  }

  async #renewLocalThreadDeleteFence(threadId: string, expectedLeaseId?: string): Promise<void> {
    const fence = this.#localThreadDeleteFences.get(threadId);
    if (!fence) {
      if (expectedLeaseId === undefined) return;
      throw new HarnessStorageThreadDeleteFenceConflictError(threadId);
    }
    if (expectedLeaseId !== undefined && fence.leaseId !== expectedLeaseId) {
      throw new HarnessStorageThreadDeleteFenceConflictError(threadId, fence.ownerId);
    }
    const now = Date.now();
    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_THREAD_DELETE_FENCES}
            SET expires_at = ?
            WHERE thread_id = ? AND owner_id = ? AND lease_id = ? AND expires_at > ?`,
      args: [now + fence.ttlMs, threadId, fence.ownerId, fence.leaseId, now],
    });
    if (result.rowsAffected === 0) {
      const existing = await this.#client.execute({
        sql: `SELECT owner_id FROM ${TABLE_HARNESS_THREAD_DELETE_FENCES}
              WHERE thread_id = ? AND expires_at > ?
              LIMIT 1`,
        args: [threadId, Date.now()],
      });
      throw new HarnessStorageThreadDeleteFenceConflictError(threadId, (existing.rows[0] as any)?.owner_id as string);
    }
  }

  async saveSession(record: SessionRecord, opts: SaveSessionOptions): Promise<SaveSessionResult> {
    const harnessName = this.#resolveHarnessName(opts.harnessName ?? record.harnessName);
    const namespacedRecord: SessionRecord = { ...record, harnessName };
    const nextVersion = opts.ifVersion + 1;
    const cols = sessionColumnValues(namespacedRecord, nextVersion);

    if (opts.ifVersion === 0) {
      await this.#renewLocalThreadDeleteFence(record.threadId);
      if (this.#localThreadDeleteFences.has(record.threadId)) {
        throw new HarnessStorageThreadDeleteFenceConflictError(record.threadId);
      }
      // First insert. Race with another writer is caught by the PRIMARY KEY
      // constraint — translate that into the same conflict error.
      const tx = await this.#client.transaction('write');
      try {
        const fence = await tx.execute({
          sql: `SELECT thread_id FROM ${TABLE_HARNESS_THREAD_DELETE_FENCES}
                WHERE thread_id = ? AND expires_at > ?
                LIMIT 1`,
          args: [record.threadId, Date.now()],
        });
        if (fence.rows[0]) {
          throw new HarnessStorageThreadDeleteFenceConflictError(record.threadId);
        }
        await tx.execute({
          sql: `INSERT INTO ${TABLE_HARNESS_SESSIONS}
                (${cols.names.join(', ')})
                VALUES (${cols.names.map(() => '?').join(', ')})`,
          args: cols.values,
        });
        await tx.commit();
      } catch (err) {
        if (!tx.closed) await tx.rollback();
        if (isUniqueConstraintError(err)) {
          const existing = await this.loadSession({ harnessName, sessionId: record.id });
          const active = await this.loadSessionByThread({
            harnessName,
            resourceId: record.resourceId,
            threadId: record.threadId,
          });
          throw new HarnessStorageVersionConflictError(
            record.id,
            opts.ifVersion,
            existing?.version ?? active?.version ?? 0,
          );
        }
        throw err;
      }
      return { version: nextVersion };
    }

    // Update path. Single statement does both the lease check and the CAS so
    // two concurrent writers cannot both succeed on the same predecessor.
    // We exclude owner_id and lease_expires_at from the update set — those
    // belong to the lease lifecycle methods.
    const updateNames = cols.names.filter(
      n => n !== 'owner_id' && n !== 'lease_expires_at' && n !== 'id' && n !== 'harness_name',
    );
    const updateValues = updateNames.map(n => cols.values[cols.names.indexOf(n)]);

    const setClause = updateNames.map(n => `${n} = ?`).join(', ');
    const updateResult = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
            SET ${setClause}
            WHERE harness_name = ?
              AND id = ?
              AND version = ?
              AND (
                owner_id IS NULL
                OR lease_expires_at IS NULL
                OR lease_expires_at <= ?
                OR owner_id = ?
              )`,
      args: [...updateValues, harnessName, record.id, opts.ifVersion, Date.now(), opts.ownerId],
    });

    if (updateResult.rowsAffected === 0) {
      // Distinguish lease conflict from version conflict by re-reading the row.
      const existing = await this.loadSession({ harnessName, sessionId: record.id });
      if (!existing) {
        throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, 0);
      }
      const now = Date.now();
      const leaseHeld =
        existing.ownerId !== undefined &&
        existing.leaseExpiresAt !== undefined &&
        existing.leaseExpiresAt > now &&
        existing.ownerId !== opts.ownerId;
      if (leaseHeld) {
        throw new HarnessStorageLeaseConflictError(record.id, existing.ownerId!, existing.leaseExpiresAt!);
      }
      throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, existing.version);
    }

    return { version: nextVersion };
  }

  async saveSessionWithAttachmentReferences(
    record: SessionRecord,
    opts: SaveSessionOptions,
    references: SaveAttachmentReferenceInput[],
  ): Promise<SaveSessionResult> {
    if (opts.ifVersion === 0) {
      throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, 0);
    }

    const harnessName = this.#resolveHarnessName(opts.harnessName ?? record.harnessName);
    const namespacedRecord: SessionRecord = { ...record, harnessName };
    const nextVersion = opts.ifVersion + 1;
    const cols = sessionColumnValues(namespacedRecord, nextVersion);
    const updateNames = cols.names.filter(
      n => n !== 'owner_id' && n !== 'lease_expires_at' && n !== 'id' && n !== 'harness_name',
    );
    const updateValues = updateNames.map(n => cols.values[cols.names.indexOf(n)]);
    const setClause = updateNames.map(n => `${n} = ?`).join(', ');

    const tx = await this.#client.transaction('write');
    try {
      const updateResult = await tx.execute({
        sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
              SET ${setClause}
              WHERE harness_name = ?
                AND id = ?
                AND version = ?
                AND (
                  owner_id IS NULL
                  OR lease_expires_at IS NULL
                  OR lease_expires_at <= ?
                  OR owner_id = ?
                )`,
        args: [...updateValues, harnessName, record.id, opts.ifVersion, Date.now(), opts.ownerId],
      });

      if (updateResult.rowsAffected === 0) {
        await tx.rollback();
        await this.#throwSaveSessionConflict(namespacedRecord, opts);
      }

      const createdAt = Date.now();
      for (const ref of references) {
        if (ref.harnessName !== undefined && this.#resolveHarnessName(ref.harnessName) !== harnessName) {
          throw new HarnessStorageAttachmentUnavailableError(ref.sessionId, ref.attachmentId);
        }
        const attachment = await tx.execute({
          sql: `SELECT attachment_id
	                FROM ${TABLE_HARNESS_ATTACHMENTS}
	                WHERE harness_name = ? AND session_id = ? AND attachment_id = ?
	                LIMIT 1
	                FOR KEY SHARE`,
          args: [harnessName, ref.sessionId, ref.attachmentId],
        });
        if (attachment.rows.length === 0) {
          throw new HarnessStorageAttachmentUnavailableError(ref.sessionId, ref.attachmentId);
        }
        await tx.execute({
          sql: `INSERT INTO ${TABLE_HARNESS_ATTACHMENT_REFERENCES}
                (harness_name, session_id, attachment_id, source, source_id, retained_until, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (harness_name, session_id, attachment_id, source, source_id) DO UPDATE SET
                  retained_until = excluded.retained_until`,
          args: [
            harnessName,
            ref.sessionId,
            ref.attachmentId,
            ref.source,
            ref.sourceId,
            ref.retainedUntil ?? null,
            createdAt,
          ],
        });
      }

      await tx.commit();
      return { version: nextVersion };
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
  }

  async #throwSaveSessionConflict(record: SessionRecord, opts: SaveSessionOptions): Promise<never> {
    const existing = await this.loadSession({ harnessName: record.harnessName, sessionId: record.id });
    if (!existing) {
      throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, 0);
    }
    const now = Date.now();
    const leaseHeld =
      existing.ownerId !== undefined &&
      existing.leaseExpiresAt !== undefined &&
      existing.leaseExpiresAt > now &&
      existing.ownerId !== opts.ownerId;
    if (leaseHeld) {
      throw new HarnessStorageLeaseConflictError(record.id, existing.ownerId!, existing.leaseExpiresAt!);
    }
    throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, existing.version);
  }

  async createOrLoadActiveSession(
    record: SessionRecord,
    opts: CreateOrLoadActiveSessionOptions,
  ): Promise<CreateOrLoadActiveSessionResult> {
    const harnessName = this.#resolveHarnessName(record.harnessName);
    await this.#renewLocalThreadDeleteFence(record.threadId);
    if (this.#localThreadDeleteFences.has(record.threadId)) {
      throw new HarnessStorageThreadDeleteFenceConflictError(record.threadId);
    }
    let storageNow = Date.now();
    const tx = await this.#client.transaction('write');
    try {
      await this.#lockThreadDeleteFence(tx, record.threadId);
      storageNow = Date.now();
      const fence = await tx.execute({
        sql: `SELECT thread_id FROM ${TABLE_HARNESS_THREAD_DELETE_FENCES}
              WHERE thread_id = ? AND expires_at > ?
              LIMIT 1`,
        args: [record.threadId, storageNow],
      });
      if (fence.rows[0]) {
        throw new HarnessStorageThreadDeleteFenceConflictError(record.threadId);
      }

      const active = await tx.execute({
        sql: `SELECT * FROM ${TABLE_HARNESS_SESSIONS}
              WHERE harness_name = ? AND resource_id = ? AND thread_id = ? AND closed_at IS NULL
              ORDER BY last_activity_at DESC
              LIMIT 1`,
        args: [harnessName, record.resourceId, record.threadId],
      });
      const activeRow = active.rows[0];
      if (activeRow) {
        await tx.commit();
        const existing = rowToSession(activeRow as Record<string, unknown>);
        return {
          record: existing,
          created: false,
          leaseAcquired: false,
          version: existing.version,
          expiresAt: existing.leaseExpiresAt,
          storageNow,
        };
      }

      if (record.parentSessionId !== undefined) {
        const parent = await tx.execute({
          sql: `SELECT resource_id, closed_at, closing_at FROM ${TABLE_HARNESS_SESSIONS}
                WHERE harness_name = ? AND id = ?
                LIMIT 1`,
          args: [harnessName, record.parentSessionId],
        });
        const parentRow = parent.rows[0] as Record<string, unknown> | undefined;
        if (!parentRow || String(parentRow.resource_id) !== record.resourceId) {
          throw new HarnessStorageParentSessionUnavailableError(record.parentSessionId, 'not_found');
        }
        if (parentRow.closed_at != null) {
          throw new HarnessStorageParentSessionUnavailableError(record.parentSessionId, 'closed');
        }
        if (parentRow.closing_at != null) {
          throw new HarnessStorageParentSessionUnavailableError(record.parentSessionId, 'closing');
        }
      }

      const existingById = await tx.execute({
        sql: `SELECT version FROM ${TABLE_HARNESS_SESSIONS}
              WHERE harness_name = ? AND id = ?
              LIMIT 1`,
        args: [harnessName, record.id],
      });
      if (existingById.rows[0]) {
        await tx.rollback();
        throw new HarnessStorageVersionConflictError(record.id, 0, Number(existingById.rows[0]!.version));
      }

      const expiresAt = storageNow + opts.initialLease.ttlMs;
      const namespacedRecord: SessionRecord = {
        ...record,
        harnessName,
        ownerId: opts.initialLease.ownerId,
        leaseExpiresAt: expiresAt,
      };
      const cols = sessionColumnValues(namespacedRecord, 1);
      await tx.execute({
        sql: `INSERT INTO ${TABLE_HARNESS_SESSIONS}
              (${cols.names.join(', ')})
              VALUES (${cols.names.map(() => '?').join(', ')})`,
        args: cols.values,
      });
      await tx.commit();
      const created = rowToSession(Object.fromEntries(cols.names.map((name, index) => [name, cols.values[index]])));
      return {
        record: created,
        created: true,
        leaseAcquired: true,
        version: 1,
        expiresAt,
        storageNow,
      };
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      if (isUniqueConstraintError(err)) {
        const active = await this.loadSessionByThread({
          harnessName,
          resourceId: record.resourceId,
          threadId: record.threadId,
        });
        if (active) {
          return {
            record: active,
            created: false,
            leaseAcquired: false,
            version: active.version,
            expiresAt: active.leaseExpiresAt,
            storageNow,
          };
        }
        const existingById = await this.loadSession({ harnessName, sessionId: record.id });
        if (existingById) throw new HarnessStorageVersionConflictError(record.id, 0, existingById.version);
      }
      throw err;
    }
  }

  async deleteSession(opts: DeleteSessionOptions): Promise<void> {
    await this.deleteSessions({ sessions: [opts] });
  }

  async deleteSessions({ sessions }: { sessions: DeleteSessionOptions[] }): Promise<void> {
    await this.#ensureMessageResultsTable();
    await this.#ensureOperationTombstonesTable();
    await this.#ensureSessionEventsTable();
    const tx = await this.#client.transaction('write');
    const deleteCandidates = new Map<
      string,
      { namespace: string; sessionId: string; resourceId: string; threadId: string }
    >();
    try {
      for (const opts of sessions) {
        const { sessionId } = opts;
        const namespace = this.#resolveHarnessName(opts.harnessName);
        const existing = await tx.execute({
          sql: `SELECT version, resource_id, thread_id, parent_session_id, created_at, closed_at
	                FROM ${TABLE_HARNESS_SESSIONS}
	                WHERE harness_name = ? AND id = ?
	                LIMIT 1
	                FOR UPDATE`,
          args: [namespace, sessionId],
        });
        const existingRow = existing.rows[0] as Record<string, unknown> | undefined;
        if (!existingRow) continue;

        const record = rowToDeleteGuardRecord(existingRow);
        const mismatch = getDeleteGuardMismatch(record, opts);
        if (mismatch) {
          throw new HarnessStorageDeleteGuardConflictError(
            sessionId,
            mismatch,
            opts.ifVersion ?? record.version,
            record.version,
          );
        }
        deleteCandidates.set(`${namespace}\u0000${sessionId}`, {
          namespace,
          sessionId,
          resourceId: record.resourceId,
          threadId: record.threadId,
        });
      }

      for (const { namespace, sessionId, resourceId, threadId } of deleteCandidates.values()) {
        const result = await tx.execute({
          sql: `DELETE FROM ${TABLE_HARNESS_SESSIONS}
                WHERE harness_name = ? AND id = ?`,
          args: [namespace, sessionId],
        });
        if (result.rowsAffected === 0) {
          throw new HarnessStorageVersionConflictError(sessionId, 0, 0);
        }
        await tx.execute({
          sql: `DELETE FROM ${TABLE_HARNESS_MESSAGE_RESULTS}
                WHERE harness_name = ? AND session_id = ? AND resource_id = ? AND thread_id = ?`,
          args: [namespace, sessionId, resourceId, threadId],
        });
        await tx.execute({
          sql: `DELETE FROM ${TABLE_HARNESS_OPERATION_TOMBSTONES}
                WHERE harness_name = ? AND session_id = ? AND resource_id = ? AND thread_id = ?`,
          args: [namespace, sessionId, resourceId, threadId],
        });
        await tx.execute({
          sql: `DELETE FROM ${TABLE_HARNESS_SESSION_EVENTS}
                WHERE harness_name = ? AND session_id = ?`,
          args: [namespace, sessionId],
        });
        await tx.execute({
          sql: `DELETE FROM ${TABLE_HARNESS_ATTACHMENT_REFERENCES}
                WHERE harness_name = ? AND session_id = ?`,
          args: [namespace, sessionId],
        });
        await tx.execute({
          sql: `DELETE FROM ${TABLE_HARNESS_ATTACHMENTS}
                WHERE harness_name = ? AND session_id = ?
                  AND NOT EXISTS (
                    SELECT 1 FROM ${TABLE_HARNESS_ATTACHMENT_REFERENCES} refs
                    WHERE refs.harness_name = ${TABLE_HARNESS_ATTACHMENTS}.harness_name
                      AND refs.session_id = ${TABLE_HARNESS_ATTACHMENTS}.session_id
                      AND refs.attachment_id = ${TABLE_HARNESS_ATTACHMENTS}.attachment_id
                  )`,
          args: [namespace, sessionId],
        });
      }

      await tx.commit();
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Session leases
  // -------------------------------------------------------------------------

  async acquireSessionLease({
    sessionId,
    ownerId,
    ttlMs,
    harnessName,
  }: AcquireSessionLeaseInput): Promise<SessionLeaseResult> {
    const namespace = this.#resolveHarnessName(harnessName);
    const now = Date.now();
    const expiresAt = now + ttlMs;

    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
            SET owner_id = ?, lease_expires_at = ?
            WHERE harness_name = ?
              AND id = ?
              AND (
                owner_id IS NULL
                OR lease_expires_at IS NULL
                OR lease_expires_at <= ?
                OR owner_id = ?
              )
            RETURNING version`,
      args: [ownerId, expiresAt, namespace, sessionId, now, ownerId],
    });

    if (result.rows.length === 0) {
      const existing = await this.loadSession({ harnessName: namespace, sessionId });
      if (!existing) throw new HarnessStorageSessionNotFoundError(sessionId);
      throw new HarnessStorageLeaseConflictError(
        sessionId,
        existing.ownerId ?? '<unowned>',
        existing.leaseExpiresAt ?? 0,
      );
    }

    return { version: Number(result.rows[0]!.version), expiresAt };
  }

  async renewSessionLease({
    sessionId,
    ownerId,
    ttlMs,
    harnessName,
  }: RenewSessionLeaseInput): Promise<SessionLeaseResult> {
    const namespace = this.#resolveHarnessName(harnessName);
    const now = Date.now();
    const expiresAt = now + ttlMs;

    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
            SET lease_expires_at = ?
            WHERE harness_name = ?
              AND id = ?
              AND owner_id = ?
              AND lease_expires_at IS NOT NULL
              AND lease_expires_at > ?
            RETURNING version`,
      args: [expiresAt, namespace, sessionId, ownerId, now],
    });

    if (result.rows.length === 0) {
      const existing = await this.loadSession({ harnessName: namespace, sessionId });
      if (!existing) throw new HarnessStorageSessionNotFoundError(sessionId);
      throw new HarnessStorageLeaseConflictError(
        sessionId,
        existing.ownerId ?? '<unowned>',
        existing.leaseExpiresAt ?? 0,
      );
    }

    return { version: Number(result.rows[0]!.version), expiresAt };
  }

  async releaseSessionLease({ sessionId, ownerId, harnessName }: ReleaseSessionLeaseInput): Promise<void> {
    const namespace = this.#resolveHarnessName(harnessName);
    const exists = await this.#client.execute({
      sql: `SELECT 1 FROM ${TABLE_HARNESS_SESSIONS} WHERE harness_name = ? AND id = ? LIMIT 1`,
      args: [namespace, sessionId],
    });
    if (exists.rows.length === 0) {
      throw new HarnessStorageSessionNotFoundError(sessionId);
    }

    // No-op if we're not the current owner.
    await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
            SET owner_id = NULL, lease_expires_at = NULL
            WHERE harness_name = ? AND id = ? AND owner_id = ?`,
      args: [namespace, sessionId, ownerId],
    });
  }

  // -------------------------------------------------------------------------
  // Attachments
  // -------------------------------------------------------------------------

  async saveAttachment({
    sessionId,
    attachmentId,
    harnessName,
    name,
    mimeType,
    source,
    data,
    semantic,
  }: SaveAttachmentInput): Promise<SaveAttachmentResult> {
    const namespace = this.#resolveHarnessName(harnessName);
    const sha256 = sha256Hex(data);
    const bytes = data.byteLength;
    const dataB64 = bytesToBase64(data);
    await this.#client.execute({
      sql: `INSERT INTO ${TABLE_HARNESS_ATTACHMENTS}
            (harness_name, session_id, attachment_id, name, mime_type, size_bytes, sha256, source,
             kind, primitive_type, element_type, renderer_json, schema_id, metadata_json, object_json,
             created_at, data_b64)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (harness_name, session_id, attachment_id) DO NOTHING`,
      args: [
        namespace,
        sessionId,
        attachmentId,
        name,
        mimeType,
        bytes,
        sha256,
        source,
        semantic?.kind ?? 'file',
        semantic?.primitiveType ?? null,
        semantic?.elementType ?? null,
        semantic?.renderer ? JSON.stringify(semantic.renderer) : null,
        semantic?.schemaId ?? null,
        semantic?.metadata ? JSON.stringify(semantic.metadata) : null,
        semantic?.object ? JSON.stringify(semantic.object) : null,
        Date.now(),
        dataB64,
      ],
    });
    const row = (
      await this.#client.execute({
        sql: `SELECT attachment_id, size_bytes, sha256
              FROM ${TABLE_HARNESS_ATTACHMENTS}
              WHERE harness_name = ? AND session_id = ? AND attachment_id = ?`,
        args: [namespace, sessionId, attachmentId],
      })
    ).rows[0];
    if (!row) throw new Error(`Failed to save attachment "${attachmentId}"`);
    return { attachmentId: String(row.attachment_id), bytes: Number(row.size_bytes), sha256: String(row.sha256) };
  }

  async loadAttachment({
    sessionId,
    attachmentId,
    harnessName,
  }: {
    sessionId: string;
    attachmentId: string;
    harnessName?: string;
  }): Promise<LoadedAttachment | null> {
    const namespace = this.#resolveHarnessName(harnessName);
    const result = await this.#client.execute({
      sql: `SELECT name, mime_type, size_bytes, sha256, data_b64,
                   kind, primitive_type, element_type, renderer_json, schema_id, metadata_json, object_json
            FROM ${TABLE_HARNESS_ATTACHMENTS}
            WHERE harness_name = ? AND session_id = ? AND attachment_id = ?`,
      args: [namespace, sessionId, attachmentId],
    });
    const row = result.rows[0];
    if (!row) return null;
    return {
      name: String(row.name),
      mimeType: String(row.mime_type),
      bytes: Number(row.size_bytes),
      sha256: String(row.sha256),
      data: base64ToBytes(String(row.data_b64)),
      semantic: rowToAttachmentSemantic(row),
    };
  }

  async deleteAttachment({
    sessionId,
    attachmentId,
    harnessName,
  }: {
    sessionId: string;
    attachmentId: string;
    harnessName?: string;
  }): Promise<void> {
    const namespace = this.#resolveHarnessName(harnessName);
    const result = await this.#client.execute({
      sql: `DELETE FROM ${TABLE_HARNESS_ATTACHMENTS}
            WHERE harness_name = ? AND session_id = ? AND attachment_id = ?
              AND NOT EXISTS (
                SELECT 1 FROM ${TABLE_HARNESS_ATTACHMENT_REFERENCES} refs
                WHERE refs.harness_name = ${TABLE_HARNESS_ATTACHMENTS}.harness_name
                  AND refs.session_id = ${TABLE_HARNESS_ATTACHMENTS}.session_id
                  AND refs.attachment_id = ${TABLE_HARNESS_ATTACHMENTS}.attachment_id
              )`,
      args: [namespace, sessionId, attachmentId],
    });
    if (result.rowsAffected === 0) {
      const references = await this.listAttachmentReferences({ harnessName: namespace, sessionId, attachmentId });
      if (references.length > 0) {
        throw new HarnessStorageAttachmentInUseError(sessionId, attachmentId, references);
      }
    }
  }

  async deleteAttachmentsForSession({
    sessionId,
    harnessName,
  }: {
    sessionId: string;
    harnessName?: string;
  }): Promise<void> {
    const namespace = this.#resolveHarnessName(harnessName);
    await this.#client.execute({
      sql: `DELETE FROM ${TABLE_HARNESS_ATTACHMENTS}
            WHERE harness_name = ? AND session_id = ?
              AND NOT EXISTS (
                SELECT 1 FROM ${TABLE_HARNESS_ATTACHMENT_REFERENCES} refs
                WHERE refs.harness_name = ${TABLE_HARNESS_ATTACHMENTS}.harness_name
                  AND refs.session_id = ${TABLE_HARNESS_ATTACHMENTS}.session_id
                  AND refs.attachment_id = ${TABLE_HARNESS_ATTACHMENTS}.attachment_id
              )`,
      args: [namespace, sessionId],
    });
  }

  async getAttachmentRecord({
    sessionId,
    attachmentId,
    harnessName,
  }: {
    sessionId: string;
    attachmentId: string;
    harnessName?: string;
  }): Promise<AttachmentRecord | null> {
    const namespace = this.#resolveHarnessName(harnessName);
    const result = await this.#client.execute({
      sql: `SELECT session_id, attachment_id, name, mime_type, size_bytes, sha256, source,
                   kind, primitive_type, element_type, renderer_json, schema_id, metadata_json, object_json,
                   created_at
            FROM ${TABLE_HARNESS_ATTACHMENTS}
            WHERE harness_name = ? AND session_id = ? AND attachment_id = ?`,
      args: [namespace, sessionId, attachmentId],
    });
    const row = result.rows[0];
    if (!row) return null;
    return {
      ownerSessionId: String(row.session_id),
      attachmentId: String(row.attachment_id),
      name: String(row.name),
      mimeType: String(row.mime_type),
      bytes: Number(row.size_bytes),
      sha256: String(row.sha256),
      source: toAttachmentSource(row.source),
      ...rowToAttachmentSemantic(row),
      createdAt: Number(row.created_at),
    };
  }

  async recordAttachmentReferences(references: SaveAttachmentReferenceInput[]): Promise<void> {
    const createdAt = Date.now();
    const tx = await this.#client.transaction('write');
    try {
      for (const ref of references) {
        const namespace = this.#resolveHarnessName(ref.harnessName);
        const attachment = await tx.execute({
          sql: `SELECT attachment_id
                FROM ${TABLE_HARNESS_ATTACHMENTS}
                WHERE harness_name = ? AND session_id = ? AND attachment_id = ?
                LIMIT 1
                FOR KEY SHARE`,
          args: [namespace, ref.sessionId, ref.attachmentId],
        });
        if (attachment.rows.length === 0) {
          throw new HarnessStorageAttachmentUnavailableError(ref.sessionId, ref.attachmentId);
        }
        await tx.execute({
          sql: `INSERT INTO ${TABLE_HARNESS_ATTACHMENT_REFERENCES}
                (harness_name, session_id, attachment_id, source, source_id, retained_until, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (harness_name, session_id, attachment_id, source, source_id) DO UPDATE SET
                  retained_until = excluded.retained_until`,
          args: [
            namespace,
            ref.sessionId,
            ref.attachmentId,
            ref.source,
            ref.sourceId,
            ref.retainedUntil ?? null,
            createdAt,
          ],
        });
      }
      await tx.commit();
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
  }

  async deleteAttachmentReferences(references: SaveAttachmentReferenceInput[]): Promise<void> {
    for (const ref of references) {
      await this.#client.execute({
        sql: `DELETE FROM ${TABLE_HARNESS_ATTACHMENT_REFERENCES}
              WHERE harness_name = ? AND session_id = ? AND attachment_id = ? AND source = ? AND source_id = ?`,
        args: [this.#resolveHarnessName(ref.harnessName), ref.sessionId, ref.attachmentId, ref.source, ref.sourceId],
      });
    }
  }

  async listAttachmentReferences({
    sessionId,
    attachmentId,
    harnessName,
  }: {
    sessionId: string;
    attachmentId: string;
    harnessName?: string;
  }): Promise<AttachmentReference[]> {
    const namespace = this.#resolveHarnessName(harnessName);
    const result = await this.#client.execute({
      sql: `SELECT source, source_id, retained_until
            FROM ${TABLE_HARNESS_ATTACHMENT_REFERENCES}
            WHERE harness_name = ? AND session_id = ? AND attachment_id = ?
            ORDER BY source ASC, source_id ASC`,
      args: [namespace, sessionId, attachmentId],
    });
    return result.rows.map(rowToAttachmentReference);
  }

  // -------------------------------------------------------------------------
  // Admission/result evidence
  // -------------------------------------------------------------------------

  async loadMessageResultEvidence({
    harnessName,
    sessionId,
    resourceId,
    threadId,
    signalId,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId: string;
    signalId: string;
  }): Promise<AgentSignalResultStatus | OperationAdmissionTombstone | null> {
    const namespace = this.#resolveHarnessName(harnessName);
    await this.#ensureMessageResultsTable();
    const retainedResult = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_MESSAGE_RESULTS}
            WHERE harness_name = ? AND session_id = ? AND resource_id = ? AND thread_id = ?
              AND signal_id = ?
            LIMIT 1`,
      args: [namespace, sessionId, resourceId, threadId, signalId],
    });
    const retained = retainedResult.rows[0];
    if (retained) return rowToMessageResultEvidence(retained as Record<string, unknown>);
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_OPERATION_TOMBSTONES}
            WHERE harness_name = ? AND session_id = ? AND resource_id = ? AND thread_id = ?
              AND kind = 'message' AND signal_id = ?
            LIMIT 1`,
      args: [namespace, sessionId, resourceId, threadId, signalId],
    });
    const row = result.rows[0];
    return row ? rowToTombstone(row as Record<string, unknown>) : null;
  }

  async writeMessageResultEvidence(record: AgentSignalResultEvidence): Promise<WriteMessageResultEvidenceResult> {
    await this.#ensureMessageResultsTable();
    const namespacedRecord = { ...record, harnessName: this.#resolveHarnessName(record.harnessName) };
    if (namespacedRecord.status === 'completed') completedMessageEvidenceRunId(namespacedRecord);
    const id = messageEvidenceId(namespacedRecord);
    const loadCurrent = async () => {
      const current = await this.loadMessageResultEvidence({
        harnessName: namespacedRecord.harnessName,
        sessionId: namespacedRecord.sessionId,
        resourceId: namespacedRecord.resourceId,
        threadId: namespacedRecord.threadId,
        signalId: namespacedRecord.signalId,
      });
      return current && 'status' in current ? (current as AgentSignalResultEvidence) : null;
    };
    const tx = await this.#client.transaction('write');
    let created = false;
    try {
      const existing = await tx.execute({
        sql: `SELECT * FROM ${TABLE_HARNESS_MESSAGE_RESULTS} WHERE id = ? LIMIT 1 FOR UPDATE`,
        args: [id],
      });
      if (existing.rows[0]) {
        const current = rowToMessageResultEvidence(existing.rows[0] as Record<string, unknown>);
        if (!sameMessageEvidenceIdentity(current, namespacedRecord)) {
          throw new HarnessStorageAdmissionConflictError(
            namespacedRecord.sessionId,
            'message',
            namespacedRecord.admissionId ?? namespacedRecord.signalId,
          );
        }
        if (isTerminalMessageEvidence(current)) {
          await tx.commit();
          return { created: false, evidence: current };
        }
        const updated = {
          ...namespacedRecord,
          createdAt: current.createdAt,
        };
        await tx.execute({
          sql: `UPDATE ${TABLE_HARNESS_MESSAGE_RESULTS}
                SET run_id = ?, status = ?, result = ?, error = ?, updated_at = ?
                WHERE id = ?`,
          args: [
            namespacedRecord.runId ?? null,
            namespacedRecord.status,
            'result' in namespacedRecord ? JSON.stringify(namespacedRecord.result) : null,
            'error' in namespacedRecord ? JSON.stringify(namespacedRecord.error) : null,
            namespacedRecord.updatedAt,
            id,
          ],
        });
        await tx.commit();
        return { created: false, evidence: updated };
      } else {
        created = true;
        await tx.execute({
          sql: `INSERT INTO ${TABLE_HARNESS_MESSAGE_RESULTS}
                (id, harness_name, session_id, resource_id, thread_id, signal_id, run_id,
                 admission_id, admission_hash, status, result, error, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            id,
            namespacedRecord.harnessName,
            namespacedRecord.sessionId,
            namespacedRecord.resourceId,
            namespacedRecord.threadId,
            namespacedRecord.signalId,
            namespacedRecord.runId ?? null,
            namespacedRecord.admissionId ?? null,
            namespacedRecord.admissionHash ?? null,
            namespacedRecord.status,
            'result' in namespacedRecord ? JSON.stringify(namespacedRecord.result) : null,
            'error' in namespacedRecord ? JSON.stringify(namespacedRecord.error) : null,
            namespacedRecord.createdAt,
            namespacedRecord.updatedAt,
          ],
        });
      }
      await tx.commit();
      return { created };
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      if (isUniqueConstraintError(err)) {
        const current = await loadCurrent();
        if (current && sameMessageEvidenceIdentity(current as AgentSignalResultEvidence, namespacedRecord)) {
          return { created: false, evidence: current };
        }
        throw new HarnessStorageAdmissionConflictError(
          namespacedRecord.sessionId,
          'message',
          namespacedRecord.admissionId ?? namespacedRecord.signalId,
        );
      }
      throw err;
    }
  }

  async loadQueueResultEvidence({
    harnessName,
    sessionId,
    resourceId,
    queuedItemId,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    queuedItemId: string;
  }): Promise<QueueAdmissionReceipt | OperationAdmissionTombstone | null> {
    const namespace = this.#resolveHarnessName(harnessName);
    const session = await this.loadSession({ harnessName: namespace, sessionId });
    if (session && session.resourceId !== resourceId) return null;
    const receipt = session?.queueAdmissionReceipts?.[queuedItemId];
    if (receipt) return receipt;
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_OPERATION_TOMBSTONES}
            WHERE harness_name = ? AND session_id = ? AND resource_id = ?
              AND kind = 'queue' AND queued_item_id = ?
            LIMIT 1`,
      args: [namespace, sessionId, resourceId, queuedItemId],
    });
    const row = result.rows[0];
    return row ? rowToTombstone(row as Record<string, unknown>) : null;
  }

  async appendSessionEvent(record: HarnessSessionEventRecord): Promise<void> {
    const namespace = this.#resolveHarnessName(record.harnessName);
    await this.#ensureSessionEventsTable();
    await this.#client.execute({
      sql: `INSERT INTO ${TABLE_HARNESS_SESSION_EVENTS}
            (harness_name, session_id, resource_id, thread_id, event_id, epoch, sequence, event, emitted_at, stored_at)
            SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            FROM ${TABLE_HARNESS_SESSIONS}
            WHERE harness_name = ? AND id = ? AND resource_id = ? AND thread_id = ?
            FOR KEY SHARE
            ON CONFLICT (harness_name, session_id, epoch, sequence) DO NOTHING`,
      args: [
        namespace,
        record.sessionId,
        record.resourceId,
        record.threadId,
        record.eventId,
        record.epoch,
        record.sequence,
        JSON.stringify(record.event),
        record.emittedAt,
        record.storedAt,
        namespace,
        record.sessionId,
        record.resourceId,
        record.threadId,
      ],
    });
  }

  async getSessionEventReplayState({
    harnessName,
    sessionId,
    resourceId,
    threadId,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId: string;
  }): Promise<HarnessSessionEventReplayState | null> {
    const namespace = this.#resolveHarnessName(harnessName);
    await this.#ensureSessionEventsTable();
    const bounds = await this.#client.execute({
      sql: `SELECT
              oldest.epoch AS oldest_epoch,
              oldest.sequence AS oldest_sequence,
              newest.epoch AS newest_epoch,
              newest.sequence AS newest_sequence
            FROM (
              SELECT epoch, sequence
              FROM ${TABLE_HARNESS_SESSION_EVENTS}
              WHERE harness_name = ? AND session_id = ? AND resource_id = ? AND thread_id = ?
              ORDER BY epoch ASC, sequence ASC
              LIMIT 1
            ) AS oldest
            CROSS JOIN (
              SELECT epoch, sequence
              FROM ${TABLE_HARNESS_SESSION_EVENTS}
              WHERE harness_name = ? AND session_id = ? AND resource_id = ? AND thread_id = ?
              ORDER BY epoch DESC, sequence DESC
              LIMIT 1
            ) AS newest`,
      args: [namespace, sessionId, resourceId, threadId, namespace, sessionId, resourceId, threadId],
    });
    const row = bounds.rows[0];
    if (!row || row.oldest_epoch == null || row.newest_epoch == null) return null;
    if (row.oldest_sequence == null || row.newest_sequence == null) return null;
    if (String(row.oldest_epoch) !== String(row.newest_epoch)) return null;

    return {
      epoch: String(row.newest_epoch),
      oldestSequence: Number(row.oldest_sequence),
      newestSequence: Number(row.newest_sequence),
    };
  }

  async listSessionEvents({
    harnessName,
    sessionId,
    resourceId,
    threadId,
    epoch,
    afterSequence,
    limit,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId: string;
    epoch: string;
    afterSequence: number;
    limit: number;
  }): Promise<HarnessSessionEventRecord[]> {
    const namespace = this.#resolveHarnessName(harnessName);
    await this.#ensureSessionEventsTable();
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_SESSION_EVENTS}
            WHERE harness_name = ? AND session_id = ? AND resource_id = ? AND thread_id = ? AND epoch = ? AND sequence > ?
            ORDER BY sequence ASC
            LIMIT ?`,
      args: [namespace, sessionId, resourceId, threadId, epoch, afterSequence, limit],
    });
    return result.rows.map(row => rowToSessionEvent(row as Record<string, unknown>));
  }

  async resolveOperationAdmissionEvidence({
    harnessName,
    sessionId,
    resourceId,
    threadId,
    kind,
    admissionId,
    attemptedAdmissionHash,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId?: string;
    kind: 'message' | 'queue';
    admissionId: string;
    attemptedAdmissionHash: string;
  }): Promise<{
    status: 'none' | 'duplicate' | 'conflict';
    evidence?: OperationAdmissionEvidence;
    storedAdmissionHash?: string;
  }> {
    const namespace = this.#resolveHarnessName(harnessName);
    if (kind === 'message') await this.#ensureMessageResultsTable();
    if (kind === 'message') {
      const filters = ['harness_name = ?', 'session_id = ?', 'resource_id = ?', 'admission_id = ?'];
      const args = [namespace, sessionId, resourceId, admissionId];
      if (threadId !== undefined) {
        filters.splice(3, 0, 'thread_id = ?');
        args.splice(3, 0, threadId);
      }
      const retained = await this.#client.execute({
        sql: `SELECT * FROM ${TABLE_HARNESS_MESSAGE_RESULTS}
              WHERE ${filters.join(' AND ')}
              LIMIT 1`,
        args,
      });
      const row = retained.rows[0];
      if (row) {
        const evidence = rowToMessageResultEvidence(row as Record<string, unknown>);
        return {
          status: evidence.admissionHash === attemptedAdmissionHash ? 'duplicate' : 'conflict',
          evidence,
          storedAdmissionHash: evidence.admissionHash,
        };
      }
    }
    if (kind === 'queue') {
      const session = await this.loadSession({ harnessName: namespace, sessionId });
      if (session && (session.resourceId !== resourceId || (threadId !== undefined && session.threadId !== threadId))) {
        return { status: 'none' };
      }
      const receipts = Object.values(session?.queueAdmissionReceipts ?? {}) as QueueAdmissionReceipt[];
      for (const receipt of receipts) {
        if (receipt.admissionId !== admissionId) continue;
        return {
          status: receipt.admissionHash === attemptedAdmissionHash ? 'duplicate' : 'conflict',
          evidence: receipt,
          storedAdmissionHash: receipt.admissionHash,
        };
      }
    }

    const tombstoneFilters = ['harness_name = ?', 'session_id = ?', 'resource_id = ?', 'kind = ?', 'admission_id = ?'];
    const tombstoneArgs = [namespace, sessionId, resourceId, kind, admissionId];
    if (threadId !== undefined) {
      tombstoneFilters.splice(3, 0, 'thread_id = ?');
      tombstoneArgs.splice(3, 0, threadId);
    }
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_OPERATION_TOMBSTONES}
            WHERE ${tombstoneFilters.join(' AND ')}
            LIMIT 1`,
      args: tombstoneArgs,
    });
    const row = result.rows[0];
    if (!row) return { status: 'none' };
    const tombstone = rowToTombstone(row as Record<string, unknown>);
    return {
      status: tombstone.admissionHash === attemptedAdmissionHash ? 'duplicate' : 'conflict',
      evidence: tombstone,
      storedAdmissionHash: tombstone.admissionHash,
    };
  }

  async writeOperationAdmissionTombstone(record: OperationAdmissionTombstone): Promise<void> {
    const namespacedRecord = { ...record, harnessName: this.#resolveHarnessName(record.harnessName) };
    const id = tombstoneId(namespacedRecord);
    const tx = await this.#client.transaction('write');
    try {
      const existing = await tx.execute({
        sql: `SELECT * FROM ${TABLE_HARNESS_OPERATION_TOMBSTONES} WHERE id = ? LIMIT 1`,
        args: [id],
      });
      if (existing.rows[0]) {
        const current = rowToTombstone(existing.rows[0] as Record<string, unknown>);
        if (!sameTombstoneIdentity(current, namespacedRecord)) {
          throw new HarnessStorageAdmissionConflictError(
            namespacedRecord.sessionId,
            namespacedRecord.kind,
            namespacedRecord.admissionId ?? id,
          );
        }
        await tx.execute({
          sql: `UPDATE ${TABLE_HARNESS_OPERATION_TOMBSTONES}
                SET expires_at = ?
                WHERE id = ?`,
          args: [namespacedRecord.expiresAt, id],
        });
      } else {
        await tx.execute({
          sql: `INSERT INTO ${TABLE_HARNESS_OPERATION_TOMBSTONES}
                (id, harness_name, session_id, kind, resource_id, thread_id, admission_id, admission_hash,
                 queued_item_id, signal_id, run_id, terminal_at, compacted_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            id,
            namespacedRecord.harnessName,
            namespacedRecord.sessionId,
            namespacedRecord.kind,
            namespacedRecord.resourceId,
            namespacedRecord.threadId,
            namespacedRecord.admissionId ?? null,
            namespacedRecord.admissionHash ?? null,
            namespacedRecord.queuedItemId ?? null,
            namespacedRecord.signalId ?? null,
            namespacedRecord.runId ?? null,
            namespacedRecord.terminalAt,
            namespacedRecord.compactedAt,
            namespacedRecord.expiresAt,
          ],
        });
      }
      await tx.commit();
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
  }

  async compactOperationResultEvidence({
    harnessName,
    sessionId,
    resourceId,
    kind,
    signalId,
    queuedItemId,
    now,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    kind: 'message' | 'queue';
    signalId?: string;
    queuedItemId?: string;
    now: number;
  }): Promise<OperationAdmissionTombstone | null> {
    const namespace = this.#resolveHarnessName(harnessName);
    if (kind === 'message') {
      await this.#ensureMessageResultsTable();
      const result = await this.#client.execute({
        sql: `SELECT * FROM ${TABLE_HARNESS_MESSAGE_RESULTS}
              WHERE harness_name = ? AND session_id = ? AND resource_id = ?
                AND signal_id = ?
              LIMIT 1`,
        args: [namespace, sessionId, resourceId, signalId ?? ''],
      });
      const row = result.rows[0];
      if (!row) return null;
      const retained = rowToMessageResultEvidence(row as Record<string, unknown>);
      if (retained.status === 'pending') return null;
      const tombstone: OperationAdmissionTombstone = {
        kind: 'message',
        harnessName: namespace,
        sessionId,
        resourceId,
        threadId: retained.threadId,
        ...(retained.admissionId !== undefined ? { admissionId: retained.admissionId } : {}),
        ...(retained.admissionHash !== undefined ? { admissionHash: retained.admissionHash } : {}),
        signalId: retained.signalId,
        ...(retained.runId !== undefined ? { runId: retained.runId } : {}),
        terminalAt: retained.updatedAt,
        compactedAt: now,
        expiresAt: now,
      };
      await this.writeOperationAdmissionTombstone(tombstone);
      await this.#client.execute({
        sql: `DELETE FROM ${TABLE_HARNESS_MESSAGE_RESULTS} WHERE id = ?`,
        args: [messageEvidenceId(retained)],
      });
      return tombstone;
    }
    return this.#withCompactionLock(`${namespace}\0${sessionId}`, async () => {
      let lastReceipt: QueueAdmissionReceipt | undefined;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const result = await this.#client.execute({
          sql: `SELECT * FROM ${TABLE_HARNESS_SESSIONS} WHERE harness_name = ? AND id = ?`,
          args: [namespace, sessionId],
        });
        const row = result.rows[0] as Record<string, unknown> | undefined;
        if (!row) return null;
        const session = rowToSession(row);
        if (session.resourceId !== resourceId) return null;
        const receipt = queuedItemId ? session.queueAdmissionReceipts?.[queuedItemId] : undefined;
        if (!receipt || !isTerminalQueueReceipt(receipt)) return null;
        lastReceipt = receipt;
        const tombstone: OperationAdmissionTombstone = {
          kind: 'queue',
          harnessName: namespace,
          sessionId,
          resourceId,
          threadId: session.threadId,
          admissionId: receipt.admissionId,
          admissionHash: receipt.admissionHash,
          queuedItemId: receipt.queuedItemId,
          ...(receipt.signalId !== undefined ? { signalId: receipt.signalId } : {}),
          ...(receipt.runId !== undefined ? { runId: receipt.runId } : {}),
          terminalAt: receipt.completedAt ?? receipt.failedAt ?? receipt.deadAt ?? now,
          compactedAt: now,
          expiresAt: now,
        };
        await this.writeOperationAdmissionTombstone(tombstone);
        const nextReceipts = { ...(session.queueAdmissionReceipts ?? {}) };
        delete nextReceipts[queuedItemId!];
        const nextReceiptJson = Object.keys(nextReceipts).length > 0 ? JSON.stringify(nextReceipts) : null;
        const originalReceiptJson =
          row.queue_admission_receipts == null ? null : JSON.stringify(row.queue_admission_receipts);
        const updateResult = await this.#client.execute({
          sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
                SET queue_admission_receipts = ?
                WHERE harness_name = ? AND id = ?
                  AND ${originalReceiptJson === null ? 'queue_admission_receipts IS NULL' : 'queue_admission_receipts = ?'}`,
          args:
            originalReceiptJson === null
              ? [nextReceiptJson, namespace, sessionId]
              : [nextReceiptJson, namespace, sessionId, originalReceiptJson],
        });
        if (updateResult.rowsAffected > 0) return tombstone;
      }
      const receiptDetails = lastReceipt
        ? `queued item "${lastReceipt.queuedItemId}" admission "${lastReceipt.admissionId}"`
        : `queued item "${queuedItemId ?? '<unknown>'}"`;
      throw new Error(
        `Harness PG queue compaction for harness "${namespace}" session "${sessionId}" resource "${resourceId}" ${receiptDetails} conflicted after retries`,
      );
    });
  }

  async deleteOperationAdmissionTombstonesForSession({
    harnessName,
    sessionId,
    resourceId,
    threadId,
    signalId,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId?: string;
    signalId?: string;
  }): Promise<void> {
    const namespace = this.#resolveHarnessName(harnessName);
    const filters = ['harness_name = ?', 'session_id = ?', 'resource_id = ?'];
    const args: string[] = [namespace, sessionId, resourceId];
    if (threadId !== undefined) {
      filters.push('thread_id = ?');
      args.push(threadId);
    }
    if (signalId !== undefined) {
      filters.push('signal_id = ?');
      args.push(signalId);
    }
    const where = filters.join(' AND ');
    await this.#ensureMessageResultsTable();
    await this.#client.execute({
      sql: `DELETE FROM ${TABLE_HARNESS_MESSAGE_RESULTS}
            WHERE ${where}`,
      args,
    });
    await this.#client.execute({
      sql: `DELETE FROM ${TABLE_HARNESS_OPERATION_TOMBSTONES}
            WHERE ${where}`,
      args,
    });
  }

  // -------------------------------------------------------------------------
  // Channel inbox ledger
  // -------------------------------------------------------------------------

  async saveChannelInboxItem(record: ChannelInboxItem): Promise<void> {
    await this.#ensureChannelInboxTable();
    const namespaced = { ...record, harnessName: this.#resolveHarnessName(record.harnessName) };
    assertValidChannelInboxState(namespaced);
    const existingByKey = await this.loadChannelInboxItemByIdempotencyKey({
      harnessName: namespaced.harnessName,
      channelId: namespaced.channelId,
      idempotencyKey: namespaced.idempotencyKey,
    });
    if (existingByKey && existingByKey.id !== namespaced.id) {
      throw new HarnessStorageChannelInboxTransitionError(
        namespaced.id,
        undefined,
        namespaced.status,
        'idempotency key is already owned by another inbox item',
      );
    }
    const existing = await this.#loadChannelInboxItemById(namespaced.id);
    if (existing) {
      if (channelInboxItemsEqual(existing, namespaced)) return;
      assertLegalChannelInboxUpdate(existing, namespaced);
    }
    const cols = channelInboxColumnValues(namespaced);
    try {
      const result = await this.#client.execute({
        sql: `INSERT INTO ${TABLE_HARNESS_CHANNEL_INBOX}
              (${cols.names.join(', ')})
              VALUES (${cols.names.map(() => '?').join(', ')})
              ON CONFLICT(id) DO UPDATE SET
                ${cols.names
                  .filter(name => name !== 'id')
                  .map(name => `${name} = excluded.${name}`)
                  .join(', ')}
              WHERE ${TABLE_HARNESS_CHANNEL_INBOX}.harness_name = excluded.harness_name
                AND ${TABLE_HARNESS_CHANNEL_INBOX}.channel_id = excluded.channel_id
                AND ${TABLE_HARNESS_CHANNEL_INBOX}.provider_id = excluded.provider_id
                AND ${TABLE_HARNESS_CHANNEL_INBOX}.idempotency_key = excluded.idempotency_key
                AND ${TABLE_HARNESS_CHANNEL_INBOX}.payload_hash = excluded.payload_hash
                AND ${TABLE_HARNESS_CHANNEL_INBOX}.admission_id = excluded.admission_id
                AND ${TABLE_HARNESS_CHANNEL_INBOX}.external_message_id = excluded.external_message_id
                AND ${TABLE_HARNESS_CHANNEL_INBOX}.received_at = excluded.received_at
                AND (
                  (
                    ${TABLE_HARNESS_CHANNEL_INBOX}.status = excluded.status
                    AND ${TABLE_HARNESS_CHANNEL_INBOX}.status NOT IN ('accepted', 'queued', 'dead')
                  )
                  OR (
                    ${TABLE_HARNESS_CHANNEL_INBOX}.status = 'received'
                    AND excluded.status IN ('admitted', 'failed', 'dead')
                  )
                  OR (
                    ${TABLE_HARNESS_CHANNEL_INBOX}.status = 'admitted'
                    AND excluded.status IN ('accepted', 'queued', 'failed', 'dead')
                  )
                  OR (
                    ${TABLE_HARNESS_CHANNEL_INBOX}.status = 'failed'
                    AND excluded.status IN ('received', 'admitted', 'failed', 'dead')
                  )
                )`,
        args: cols.values,
      });
      if (result.rowsAffected === 0) {
        const conflict = await this.#loadChannelInboxItemById(namespaced.id);
        if (conflict && channelInboxItemsEqual(conflict, namespaced)) return;
        if (conflict) assertLegalChannelInboxUpdate(conflict, namespaced);
        throw new HarnessStorageChannelInboxTransitionError(
          namespaced.id,
          conflict?.status,
          namespaced.status,
          'id is already owned by another inbox item',
        );
      }
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
      const conflictingByKey = await this.loadChannelInboxItemByIdempotencyKey({
        harnessName: namespaced.harnessName,
        channelId: namespaced.channelId,
        idempotencyKey: namespaced.idempotencyKey,
      });
      if (conflictingByKey && conflictingByKey.id !== namespaced.id) {
        throw new HarnessStorageChannelInboxTransitionError(
          namespaced.id,
          undefined,
          namespaced.status,
          'idempotency key is already owned by another inbox item',
        );
      }
      throw err;
    }
  }

  async createOrLoadChannelInboxItem(
    record: ChannelInboxItem,
    opts?: { initialClaim?: { claimId: string; now: number; claimTtlMs: number } },
  ): Promise<CreateOrLoadChannelInboxItemResult> {
    await this.#ensureChannelInboxTable();
    const namespace = this.#resolveHarnessName(record.harnessName);
    const incoming: ChannelInboxItem = { ...record, harnessName: namespace };
    assertValidChannelInboxState(incoming);
    const initialClaim = opts?.initialClaim;
    const insertItem =
      initialClaim === undefined
        ? incoming
        : {
            ...incoming,
            claimId: initialClaim.claimId,
            claimExpiresAt: initialClaim.now + initialClaim.claimTtlMs,
            updatedAt: initialClaim.now,
          };
    const cols = channelInboxColumnValues(insertItem);
    try {
      await this.#client.execute({
        sql: `INSERT INTO ${TABLE_HARNESS_CHANNEL_INBOX}
              (${cols.names.join(', ')})
              VALUES (${cols.names.map(() => '?').join(', ')})`,
        args: cols.values,
      });
      return {
        item: insertItem,
        duplicate: false,
        conflict: false,
        claimed: initialClaim !== undefined,
      };
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
    }

    let existing = await this.loadChannelInboxItemByIdempotencyKey({
      harnessName: namespace,
      channelId: incoming.channelId,
      idempotencyKey: incoming.idempotencyKey,
    });
    if (!existing) {
      const existingById = await this.#loadChannelInboxItemById(incoming.id);
      if (existingById) {
        throw new HarnessStorageChannelInboxTransitionError(
          incoming.id,
          existingById.status,
          incoming.status,
          'id is already owned by another inbox item',
        );
      }
    }
    if (!existing) throw new HarnessStorageChannelInboxClaimConflictError(incoming.id);
    const conflict = existing.payloadHash !== incoming.payloadHash;
    let claimed = false;
    if (!conflict && initialClaim && isChannelInboxClaimable(existing, initialClaim.now)) {
      const update = await this.#client.execute({
        sql: `UPDATE ${TABLE_HARNESS_CHANNEL_INBOX}
              SET claim_id = ?, claim_expires_at = ?, updated_at = ?
              WHERE harness_name = ? AND id = ?
                AND (claim_id IS NULL OR claim_expires_at IS NULL OR claim_expires_at <= ?)
                AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
                AND status NOT IN ('accepted', 'queued', 'dead')`,
        args: [
          initialClaim.claimId,
          initialClaim.now + initialClaim.claimTtlMs,
          initialClaim.now,
          namespace,
          existing.id,
          initialClaim.now,
          initialClaim.now,
        ],
      });
      if (update.rowsAffected > 0) {
        claimed = true;
        existing = (await this.#loadChannelInboxItemById(existing.id, namespace)) ?? existing;
      }
    }
    return { item: existing, duplicate: true, conflict, claimed };
  }

  async loadChannelInboxItemByIdempotencyKey({
    harnessName,
    channelId,
    idempotencyKey,
  }: {
    harnessName: string;
    channelId: string;
    idempotencyKey: string;
  }): Promise<ChannelInboxItem | null> {
    await this.#ensureChannelInboxTable();
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_INBOX}
            WHERE harness_name = ? AND channel_id = ? AND idempotency_key = ?
            LIMIT 1`,
      args: [this.#resolveHarnessName(harnessName), channelId, idempotencyKey],
    });
    const row = result.rows[0];
    return row ? rowToChannelInboxItem(row as Record<string, unknown>) : null;
  }

  async claimChannelInboxItems({
    harnessName,
    channelId,
    statuses,
    claimId,
    limit,
    now,
    claimTtlMs,
  }: {
    harnessName: string;
    channelId?: string;
    statuses: Array<'received' | 'admitted' | 'failed'>;
    claimId: string;
    limit: number;
    now: number;
    claimTtlMs: number;
  }): Promise<ChannelInboxItem[]> {
    await this.#ensureChannelInboxTable();
    if (limit <= 0 || statuses.length === 0) return [];
    const namespace = this.#resolveHarnessName(harnessName);
    const filters = [
      'harness_name = ?',
      `status IN (${statuses.map(() => '?').join(', ')})`,
      '(claim_id IS NULL OR claim_expires_at IS NULL OR claim_expires_at <= ?)',
      '(next_attempt_at IS NULL OR next_attempt_at <= ?)',
    ];
    const args: (string | number)[] = [namespace, ...statuses, now, now];
    if (channelId !== undefined) {
      filters.splice(1, 0, 'channel_id = ?');
      args.splice(1, 0, channelId);
    }
    const claimed = await this.#client.execute({
      sql: `WITH candidates AS (
              SELECT id FROM ${TABLE_HARNESS_CHANNEL_INBOX}
              WHERE ${filters.join(' AND ')}
              ORDER BY received_at ASC
              LIMIT ?
              FOR UPDATE SKIP LOCKED
            )
            UPDATE ${TABLE_HARNESS_CHANNEL_INBOX} AS item
            SET claim_id = ?, claim_expires_at = ?, updated_at = ?
            FROM candidates
            WHERE item.id = candidates.id
            RETURNING item.*`,
      args: [...args, limit, claimId, now + claimTtlMs, now],
    });
    return claimed.rows.map(row => rowToChannelInboxItem(row as Record<string, unknown>));
  }

  async renewChannelInboxClaim({
    inboxItemId,
    claimId,
    now,
    claimTtlMs,
  }: {
    inboxItemId: string;
    claimId: string;
    now: number;
    claimTtlMs: number;
  }): Promise<{ claimExpiresAt: number; storageNow: number }> {
    await this.#ensureChannelInboxTable();
    const claimExpiresAt = now + claimTtlMs;
    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_CHANNEL_INBOX}
            SET claim_expires_at = ?, updated_at = ?
            WHERE id = ? AND claim_id = ?
              AND claim_expires_at IS NOT NULL
              AND claim_expires_at > ?
              AND status NOT IN ('accepted', 'queued', 'dead')`,
      args: [claimExpiresAt, now, inboxItemId, claimId, now],
    });
    if (result.rowsAffected === 0) {
      throw new HarnessStorageChannelInboxClaimConflictError(inboxItemId, claimId);
    }
    return { claimExpiresAt, storageNow: now };
  }

  async updateChannelInboxItem(record: ChannelInboxItem, opts: { claimId: string }): Promise<void> {
    await this.#ensureChannelInboxTable();
    const namespace = this.#resolveHarnessName(record.harnessName);
    const current = await this.#loadChannelInboxItemById(record.id, namespace);
    const storageNow = Date.now();
    if (
      !current ||
      current.claimId !== opts.claimId ||
      current.claimExpiresAt === undefined ||
      current.claimExpiresAt <= storageNow ||
      isTerminalChannelInboxStatus(current.status)
    ) {
      throw new HarnessStorageChannelInboxClaimConflictError(record.id, opts.claimId);
    }
    const next = { ...record, harnessName: namespace };
    assertLegalChannelInboxUpdate(current, next);
    const cols = channelInboxColumnValues(next);
    const currentCols = channelInboxColumnValues(current);
    const preservesCurrentClaim = next.claimId === opts.claimId && next.claimExpiresAt !== undefined;
    const updateNames = cols.names.filter(
      name => name !== 'id' && (!preservesCurrentClaim || (name !== 'claim_id' && name !== 'claim_expires_at')),
    );
    const stateCompareNames = cols.names.filter(
      name => name !== 'id' && name !== 'claim_id' && name !== 'claim_expires_at' && name !== 'updated_at',
    );
    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_CHANNEL_INBOX}
            SET ${updateNames.map(name => `${name} = ?`).join(', ')}
            WHERE harness_name = ? AND id = ? AND claim_id = ?
              AND claim_expires_at IS NOT NULL
              AND claim_expires_at > ?
              AND status NOT IN ('accepted', 'queued', 'dead')
              AND ${stateCompareNames.map(name => `${name} IS ?`).join(' AND ')}`,
      args: [
        ...updateNames.map(name => cols.values[cols.names.indexOf(name)]),
        namespace,
        next.id,
        opts.claimId,
        storageNow,
        ...stateCompareNames.map(name => currentCols.values[currentCols.names.indexOf(name)]),
      ],
    });
    if (result.rowsAffected === 0) {
      throw new HarnessStorageChannelInboxClaimConflictError(record.id, opts.claimId);
    }
  }

  // -------------------------------------------------------------------------
  // Channel action token and receipt ledger
  // -------------------------------------------------------------------------

  async createOrLoadChannelActionToken(record: ChannelActionToken): Promise<CreateOrLoadChannelActionTokenResult> {
    await this.#ensureChannelActionTables();
    const token = { ...record, harnessName: this.#resolveHarnessName(record.harnessName) };
    const existing = await this.loadChannelActionTokenById({
      harnessName: token.harnessName,
      channelId: token.channelId,
      actionTokenId: token.actionTokenId,
    });
    if (existing) {
      return { token: existing, duplicate: true, conflict: !channelActionTokensEquivalent(existing, token) };
    }
    const existingByTransport = await this.loadChannelActionTokenByTransportHash({
      harnessName: token.harnessName,
      channelId: token.channelId,
      transportHash: token.transportHash,
    });
    if (existingByTransport) return { token: existingByTransport, duplicate: true, conflict: true };
    const existingByPending = await this.loadChannelActionTokenForPendingItem({
      harnessName: token.harnessName,
      channelId: token.channelId,
      bindingId: token.bindingId,
      bindingGeneration: token.bindingGeneration,
      owningSessionId: token.owningSessionId,
      itemId: token.itemId,
      kind: token.kind,
      runId: token.runId,
      pendingRequestedAt: token.pendingRequestedAt,
      metadataHash: token.metadataHash,
    });
    if (existingByPending) return { token: existingByPending, duplicate: true, conflict: true };
    const cols = channelActionTokenColumnValues(token);
    try {
      await this.#client.execute({
        sql: `INSERT INTO ${TABLE_HARNESS_CHANNEL_ACTION_TOKENS}
              (${cols.names.join(', ')})
              VALUES (${cols.names.map(() => '?').join(', ')})`,
        args: cols.values,
      });
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
      const raced =
        (await this.loadChannelActionTokenById({
          harnessName: token.harnessName,
          channelId: token.channelId,
          actionTokenId: token.actionTokenId,
        })) ??
        (await this.loadChannelActionTokenByTransportHash({
          harnessName: token.harnessName,
          channelId: token.channelId,
          transportHash: token.transportHash,
        })) ??
        (await this.loadChannelActionTokenForPendingItem({
          harnessName: token.harnessName,
          channelId: token.channelId,
          bindingId: token.bindingId,
          bindingGeneration: token.bindingGeneration,
          owningSessionId: token.owningSessionId,
          itemId: token.itemId,
          kind: token.kind,
          runId: token.runId,
          pendingRequestedAt: token.pendingRequestedAt,
          metadataHash: token.metadataHash,
        }));
      if (raced) return { token: raced, duplicate: true, conflict: !channelActionTokensEquivalent(raced, token) };
      throw err;
    }
    return { token, duplicate: false, conflict: false };
  }

  async loadChannelActionTokenById({
    harnessName,
    channelId,
    actionTokenId,
  }: {
    harnessName: string;
    channelId: string;
    actionTokenId: string;
  }): Promise<ChannelActionToken | null> {
    await this.#ensureChannelActionTables();
    const namespace = this.#resolveHarnessName(harnessName);
    const row = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_ACTION_TOKENS}
            WHERE harness_name = ? AND channel_id = ? AND action_token_id = ?
            LIMIT 1`,
      args: [namespace, channelId, actionTokenId],
    });
    return row.rows[0] ? rowToChannelActionToken(row.rows[0] as Record<string, unknown>) : null;
  }

  async loadChannelActionTokenByTransportHash({
    harnessName,
    channelId,
    transportHash,
  }: {
    harnessName: string;
    channelId: string;
    transportHash: string;
  }): Promise<ChannelActionToken | null> {
    await this.#ensureChannelActionTables();
    const namespace = this.#resolveHarnessName(harnessName);
    const row = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_ACTION_TOKENS}
            WHERE harness_name = ? AND channel_id = ? AND transport_hash = ?
            LIMIT 1`,
      args: [namespace, channelId, transportHash],
    });
    return row.rows[0] ? rowToChannelActionToken(row.rows[0] as Record<string, unknown>) : null;
  }

  async loadChannelActionTokenForPendingItem(opts: {
    harnessName: string;
    channelId: string;
    bindingId: string;
    bindingGeneration: number;
    owningSessionId: string;
    itemId: string;
    kind: ChannelActionToken['kind'];
    runId: string;
    pendingRequestedAt: number;
    metadataHash: string;
  }): Promise<ChannelActionToken | null> {
    await this.#ensureChannelActionTables();
    const namespace = this.#resolveHarnessName(opts.harnessName);
    const row = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_ACTION_TOKENS}
            WHERE harness_name = ? AND channel_id = ? AND binding_id = ? AND binding_generation = ?
              AND owning_session_id = ? AND item_id = ? AND kind = ? AND run_id = ?
              AND pending_requested_at = ? AND metadata_hash = ?
            LIMIT 1`,
      args: [
        namespace,
        opts.channelId,
        opts.bindingId,
        opts.bindingGeneration,
        opts.owningSessionId,
        opts.itemId,
        opts.kind,
        opts.runId,
        opts.pendingRequestedAt,
        opts.metadataHash,
      ],
    });
    return row.rows[0] ? rowToChannelActionToken(row.rows[0] as Record<string, unknown>) : null;
  }

  async revokeChannelActionToken(opts: {
    harnessName: string;
    channelId: string;
    actionTokenId: string;
    revokedAt?: number;
    revokedReason?: ChannelActionToken['revokedReason'];
  }): Promise<ChannelActionToken> {
    await this.#ensureChannelActionTables();
    const namespace = this.#resolveHarnessName(opts.harnessName);
    const revokedAt = opts.revokedAt ?? Date.now();
    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_CHANNEL_ACTION_TOKENS}
            SET revoked_at = ?, revoked_reason = ?, updated_at = ?
            WHERE harness_name = ? AND channel_id = ? AND action_token_id = ?`,
      args: [revokedAt, opts.revokedReason ?? null, revokedAt, namespace, opts.channelId, opts.actionTokenId],
    });
    if (result.rowsAffected === 0) {
      throw new HarnessStorageChannelActionTokenConflictError(opts.actionTokenId, 'token was not found');
    }
    return (await this.loadChannelActionTokenById({
      harnessName: namespace,
      channelId: opts.channelId,
      actionTokenId: opts.actionTokenId,
    }))!;
  }

  async saveChannelActionReceipt(record: ChannelActionReceipt): Promise<void> {
    await this.#ensureChannelActionTables();
    const receipt = { ...record, harnessName: this.#resolveHarnessName(record.harnessName) };
    assertValidChannelActionReceiptState(receipt);
    const existing = await this.#loadChannelActionReceiptById(receipt.id);
    if (existing) {
      if (channelActionReceiptsEqual(existing, receipt)) return;
      assertLegalChannelActionReceiptUpdate(existing, receipt);
    }
    const existingByToken = await this.loadChannelActionReceiptByTokenId({
      harnessName: receipt.harnessName,
      channelId: receipt.channelId,
      actionTokenId: receipt.actionTokenId,
    });
    if (existingByToken && existingByToken.id !== receipt.id) {
      throw new HarnessStorageChannelActionReceiptTransitionError(
        receipt.id,
        existingByToken.status,
        receipt.status,
        'action token is already owned by another receipt',
      );
    }
    const cols = channelActionReceiptColumnValues(receipt);
    try {
      const result = await this.#client.execute({
        sql: `INSERT INTO ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}
              (${cols.names.join(', ')})
              VALUES (${cols.names.map(() => '?').join(', ')})
              ON CONFLICT(id) DO UPDATE SET
                ${cols.names
                  .filter(name => name !== 'id')
                  .map(name => `${name} = excluded.${name}`)
                  .join(', ')}
              WHERE ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.harness_name = excluded.harness_name
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.channel_id = excluded.channel_id
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.provider_id = excluded.provider_id
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.action_token_id = excluded.action_token_id
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.action_id = excluded.action_id
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.binding_id = excluded.binding_id
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.binding_generation = excluded.binding_generation
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.resource_id = excluded.resource_id
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.owning_session_id = excluded.owning_session_id
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.item_id = excluded.item_id
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.kind = excluded.kind
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.run_id = excluded.run_id
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.pending_requested_at = excluded.pending_requested_at
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.audience = excluded.audience
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.response_hash = excluded.response_hash
                AND (
                  (
                    ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.status = excluded.status
                    AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.status NOT IN ('applied', 'conflict', 'dead')
                  )
                  OR (
                    ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.status = 'received'
                    AND excluded.status IN ('accepted', 'failed', 'conflict', 'dead')
                  )
                  OR (
                    ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.status = 'accepted'
                    AND excluded.status IN ('applied', 'failed', 'dead')
                  )
                  OR (
                    ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.status = 'failed'
                    AND excluded.status IN ('received', 'accepted', 'failed', 'dead')
                  )
                )`,
        args: cols.values,
      });
      if (result.rowsAffected === 0) {
        const conflict = await this.#loadChannelActionReceiptById(receipt.id);
        if (conflict && channelActionReceiptsEqual(conflict, receipt)) return;
        if (conflict) assertLegalChannelActionReceiptUpdate(conflict, receipt);
        throw new HarnessStorageChannelActionReceiptTransitionError(
          receipt.id,
          conflict?.status,
          receipt.status,
          'receipt upsert did not affect a row',
        );
      }
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
      const conflictingByToken = await this.loadChannelActionReceiptByTokenId({
        harnessName: receipt.harnessName,
        channelId: receipt.channelId,
        actionTokenId: receipt.actionTokenId,
      });
      if (conflictingByToken && conflictingByToken.id !== receipt.id) {
        throw new HarnessStorageChannelActionReceiptTransitionError(
          receipt.id,
          conflictingByToken.status,
          receipt.status,
          'action token is already owned by another receipt',
        );
      }
      throw err;
    }
  }

  async createOrLoadChannelActionReceipt(
    record: ChannelActionReceipt,
    opts?: { initialClaim?: { claimId: string; now: number; claimTtlMs: number } },
  ): Promise<CreateOrLoadChannelActionReceiptResult> {
    await this.#ensureChannelActionTables();
    const namespace = this.#resolveHarnessName(record.harnessName);
    const incoming: ChannelActionReceipt = { ...record, harnessName: namespace };
    assertValidChannelActionReceiptState(incoming);
    let existing = await this.loadChannelActionReceiptByTokenId({
      harnessName: namespace,
      channelId: incoming.channelId,
      actionTokenId: incoming.actionTokenId,
    });
    if (existing) return this.#channelActionReceiptDuplicate(existing, incoming, opts);
    const insertReceipt =
      opts?.initialClaim === undefined
        ? incoming
        : {
            ...incoming,
            claimId: opts.initialClaim.claimId,
            claimExpiresAt: opts.initialClaim.now + opts.initialClaim.claimTtlMs,
            updatedAt: opts.initialClaim.now,
          };
    const cols = channelActionReceiptColumnValues(insertReceipt);
    try {
      await this.#client.execute({
        sql: `INSERT INTO ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}
              (${cols.names.join(', ')})
              VALUES (${cols.names.map(() => '?').join(', ')})`,
        args: cols.values,
      });
      return {
        receipt: insertReceipt,
        duplicate: false,
        conflict: false,
        claimed: opts?.initialClaim !== undefined,
      };
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
    }
    existing = await this.loadChannelActionReceiptByTokenId({
      harnessName: namespace,
      channelId: incoming.channelId,
      actionTokenId: incoming.actionTokenId,
    });
    if (existing) return this.#channelActionReceiptDuplicate(existing, incoming, opts);
    const existingById = await this.#loadChannelActionReceiptById(incoming.id);
    if (existingById) {
      throw new HarnessStorageChannelActionReceiptTransitionError(
        incoming.id,
        existingById.status,
        incoming.status,
        'id is already owned by another action receipt',
      );
    }
    throw new HarnessStorageChannelActionClaimConflictError(incoming.id);
  }

  async #channelActionReceiptDuplicate(
    existing: ChannelActionReceipt,
    incoming: ChannelActionReceipt,
    opts?: { initialClaim?: { claimId: string; now: number; claimTtlMs: number } },
  ): Promise<CreateOrLoadChannelActionReceiptResult> {
    const conflict = !channelActionReceiptsEquivalentForCreate(existing, incoming);
    let receipt = existing;
    let claimed = false;
    if (!conflict && opts?.initialClaim && isChannelActionReceiptClaimable(existing, opts.initialClaim.now)) {
      const update = await this.#client.execute({
        sql: `UPDATE ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}
              SET claim_id = ?, claim_expires_at = ?, updated_at = ?
              WHERE id = ?
                AND (claim_id IS NULL OR claim_expires_at IS NULL OR claim_expires_at <= ?)
                AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
                AND status NOT IN ('applied', 'conflict', 'dead')`,
        args: [
          opts.initialClaim.claimId,
          opts.initialClaim.now + opts.initialClaim.claimTtlMs,
          opts.initialClaim.now,
          existing.id,
          opts.initialClaim.now,
          opts.initialClaim.now,
        ],
      });
      if (update.rowsAffected > 0) {
        claimed = true;
        receipt = (await this.#loadChannelActionReceiptById(existing.id)) ?? existing;
      }
    }
    return { receipt, duplicate: true, conflict, claimed };
  }

  async loadChannelActionReceiptByActionId(opts: {
    harnessName: string;
    channelId: string;
    actionId: string;
  }): Promise<ChannelActionReceipt | null> {
    await this.#ensureChannelActionTables();
    const namespace = this.#resolveHarnessName(opts.harnessName);
    const row = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}
            WHERE harness_name = ? AND channel_id = ? AND action_id = ?
            ORDER BY created_at ASC, id ASC
            LIMIT 1`,
      args: [namespace, opts.channelId, opts.actionId],
    });
    return row.rows[0] ? rowToChannelActionReceipt(row.rows[0] as Record<string, unknown>) : null;
  }

  async loadChannelActionReceiptByTokenId(opts: {
    harnessName: string;
    channelId: string;
    actionTokenId: string;
  }): Promise<ChannelActionReceipt | null> {
    await this.#ensureChannelActionTables();
    const namespace = this.#resolveHarnessName(opts.harnessName);
    const row = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}
            WHERE harness_name = ? AND channel_id = ? AND action_token_id = ?
            LIMIT 1`,
      args: [namespace, opts.channelId, opts.actionTokenId],
    });
    return row.rows[0] ? rowToChannelActionReceipt(row.rows[0] as Record<string, unknown>) : null;
  }

  async #loadChannelActionReceiptById(id: string, harnessName?: string): Promise<ChannelActionReceipt | null> {
    const conditions = ['id = ?'];
    const args: string[] = [id];
    if (harnessName !== undefined) {
      conditions.unshift('harness_name = ?');
      args.unshift(this.#resolveHarnessName(harnessName));
    }
    const row = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}
            WHERE ${conditions.join(' AND ')}
            LIMIT 1`,
      args,
    });
    return row.rows[0] ? rowToChannelActionReceipt(row.rows[0] as Record<string, unknown>) : null;
  }

  async claimChannelActionReceipts(opts: {
    harnessName: string;
    channelId?: string;
    statuses: Array<'received' | 'accepted' | 'failed'>;
    claimId: string;
    limit: number;
    now: number;
    claimTtlMs: number;
  }): Promise<ChannelActionReceipt[]> {
    await this.#ensureChannelActionTables();
    if (opts.limit <= 0 || opts.statuses.length === 0) return [];
    const namespace = this.#resolveHarnessName(opts.harnessName);
    const filters = ['harness_name = ?', `status IN (${opts.statuses.map(() => '?').join(', ')})`];
    const args: any[] = [namespace, ...opts.statuses];
    if (opts.channelId !== undefined) {
      filters.push('channel_id = ?');
      args.push(opts.channelId);
    }
    filters.push('(next_attempt_at IS NULL OR next_attempt_at <= ?)');
    filters.push('(claim_id IS NULL OR claim_expires_at IS NULL OR claim_expires_at <= ?)');
    args.push(opts.now, opts.now, opts.limit);
    const claimed = await this.#client.execute({
      sql: `WITH candidates AS (
              SELECT id FROM ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}
              WHERE ${filters.join(' AND ')}
              ORDER BY created_at ASC, id ASC
              LIMIT ?
              FOR UPDATE SKIP LOCKED
            )
            UPDATE ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS} AS receipt
            SET claim_id = ?, claim_expires_at = ?, updated_at = ?
            FROM candidates
            WHERE receipt.id = candidates.id
            RETURNING receipt.*`,
      args: [...args, opts.claimId, opts.now + opts.claimTtlMs, opts.now],
    });
    return claimed.rows.map(row => rowToChannelActionReceipt(row as Record<string, unknown>));
  }

  async renewChannelActionReceiptClaim(opts: {
    receiptId: string;
    claimId: string;
    now: number;
    claimTtlMs: number;
  }): Promise<{ claimExpiresAt: number; storageNow: number }> {
    await this.#ensureChannelActionTables();
    const claimExpiresAt = opts.now + opts.claimTtlMs;
    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}
            SET claim_expires_at = ?, updated_at = ?
            WHERE id = ? AND claim_id = ?
              AND claim_expires_at IS NOT NULL AND claim_expires_at > ?
              AND status NOT IN ('applied', 'conflict', 'dead')`,
      args: [claimExpiresAt, opts.now, opts.receiptId, opts.claimId, opts.now],
    });
    if (result.rowsAffected === 0) {
      throw new HarnessStorageChannelActionClaimConflictError(opts.receiptId, opts.claimId);
    }
    return { claimExpiresAt, storageNow: opts.now };
  }

  async updateChannelActionReceipt(record: ChannelActionReceipt, opts: { claimId: string }): Promise<void> {
    await this.#ensureChannelActionTables();
    const namespace = this.#resolveHarnessName(record.harnessName);
    const current = await this.#loadChannelActionReceiptById(record.id, namespace);
    const storageNow = Date.now();
    if (
      !current ||
      current.claimId !== opts.claimId ||
      current.claimExpiresAt === undefined ||
      current.claimExpiresAt <= storageNow ||
      isTerminalChannelActionReceiptStatus(current.status)
    ) {
      throw new HarnessStorageChannelActionClaimConflictError(record.id, opts.claimId);
    }
    const next = { ...record, harnessName: namespace };
    assertLegalChannelActionReceiptUpdate(current, next);
    const cols = channelActionReceiptColumnValues(next);
    const currentCols = channelActionReceiptColumnValues(current);
    const preservesCurrentClaim = next.claimId === opts.claimId && next.claimExpiresAt !== undefined;
    const updateNames = cols.names.filter(
      name => name !== 'id' && (!preservesCurrentClaim || (name !== 'claim_id' && name !== 'claim_expires_at')),
    );
    const stateCompareNames = cols.names.filter(
      name => name !== 'id' && name !== 'claim_id' && name !== 'claim_expires_at' && name !== 'updated_at',
    );
    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}
            SET ${updateNames.map(name => `${name} = ?`).join(', ')}
            WHERE harness_name = ? AND id = ? AND claim_id = ?
              AND claim_expires_at IS NOT NULL AND claim_expires_at > ?
              AND status NOT IN ('applied', 'conflict', 'dead')
              AND ${stateCompareNames.map(name => `${name} IS ?`).join(' AND ')}`,
      args: [
        ...updateNames.map(name => cols.values[cols.names.indexOf(name)]),
        namespace,
        next.id,
        opts.claimId,
        storageNow,
        ...stateCompareNames.map(name => currentCols.values[currentCols.names.indexOf(name)]),
      ],
    });
    if (result.rowsAffected === 0) {
      throw new HarnessStorageChannelActionClaimConflictError(record.id, opts.claimId);
    }
  }

  async enqueueChannelOutbox(record: ChannelOutboxItem): Promise<{
    outboxItemId: string;
    duplicate: boolean;
    conflict: boolean;
  }> {
    await this.#ensureChannelOutboxTable();
    const item: ChannelOutboxItem = { ...record, harnessName: this.#resolveHarnessName(record.harnessName) };
    assertValidChannelOutboxState(item);
    const cols = channelOutboxColumnValues(item);
    try {
      await this.#client.execute({
        sql: `INSERT INTO ${TABLE_HARNESS_CHANNEL_OUTBOX}
              (${cols.names.join(', ')})
              VALUES (${cols.names.map(() => '?').join(', ')})`,
        args: cols.values,
      });
      return { outboxItemId: item.id, duplicate: false, conflict: false };
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
    }

    const existing = await this.#loadChannelOutboxByIdempotencyKey({
      harnessName: item.harnessName,
      bindingId: item.bindingId,
      idempotencyKey: item.idempotencyKey,
    });
    if (existing) {
      return {
        outboxItemId: existing.id,
        duplicate: true,
        conflict: !channelOutboxItemsEquivalentForEnqueue(existing, item),
      };
    }
    const existingById = await this.#loadChannelOutboxItemById(item.id);
    if (existingById) {
      throw new HarnessStorageChannelOutboxTransitionError(
        item.id,
        existingById.status,
        item.status,
        'id is already owned by another outbox item',
      );
    }
    throw new HarnessStorageChannelOutboxTransitionError(
      item.id,
      undefined,
      item.status,
      'unique constraint conflict could not be resolved after enqueue',
    );
  }

  async claimChannelOutbox(opts: {
    harnessName: string;
    channelId?: string;
    claimId: string;
    limit: number;
    now: number;
    claimTtlMs: number;
  }): Promise<ChannelOutboxItem[]> {
    await this.#ensureChannelOutboxTable();
    if (opts.limit <= 0) return [];
    const namespace = this.#resolveHarnessName(opts.harnessName);
    const filters = [
      'candidate.harness_name = ?',
      "candidate.status IN ('pending', 'failed', 'claimed')",
      '(candidate.claim_id IS NULL OR candidate.claim_expires_at IS NULL OR candidate.claim_expires_at <= ?)',
      '(candidate.next_attempt_at IS NULL OR candidate.next_attempt_at <= ?)',
      `NOT EXISTS (
        SELECT 1 FROM ${TABLE_HARNESS_CHANNEL_OUTBOX} AS earlier
        WHERE earlier.harness_name = candidate.harness_name
          AND earlier.binding_id = candidate.binding_id
          AND earlier.id != candidate.id
          AND earlier.status NOT IN ('sent', 'dead')
          AND (earlier.created_at < candidate.created_at
            OR (earlier.created_at = candidate.created_at AND earlier.id < candidate.id))
      )`,
    ];
    const args: (string | number)[] = [namespace, opts.now, opts.now];
    if (opts.channelId !== undefined) {
      filters.splice(1, 0, 'candidate.channel_id = ?');
      args.splice(1, 0, opts.channelId);
    }
    const claimed = await this.#client.execute({
      sql: `WITH candidates AS (
              SELECT candidate.id FROM ${TABLE_HARNESS_CHANNEL_OUTBOX} AS candidate
              WHERE ${filters.join(' AND ')}
              ORDER BY candidate.created_at ASC, candidate.id ASC
              LIMIT ?
              FOR UPDATE SKIP LOCKED
            )
            UPDATE ${TABLE_HARNESS_CHANNEL_OUTBOX} AS item
            SET status = 'claimed',
                attempts = item.attempts + 1,
                claim_id = ?,
                claim_expires_at = ?,
                next_attempt_at = NULL,
                failed_at = NULL,
                last_error = NULL,
                updated_at = ?
            FROM candidates
            WHERE item.id = candidates.id
            RETURNING item.*`,
      args: [...args, opts.limit, opts.claimId, opts.now + opts.claimTtlMs, opts.now],
    });
    return claimed.rows.map(row => rowToChannelOutboxItem(row as Record<string, unknown>));
  }

  async renewChannelOutboxClaim(opts: {
    outboxItemId: string;
    claimId: string;
    now: number;
    claimTtlMs: number;
  }): Promise<{ claimExpiresAt: number; storageNow: number }> {
    await this.#ensureChannelOutboxTable();
    const claimExpiresAt = opts.now + opts.claimTtlMs;
    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_CHANNEL_OUTBOX}
            SET claim_expires_at = ?, updated_at = ?
            WHERE id = ? AND status = 'claimed' AND claim_id = ? AND claim_expires_at IS NOT NULL AND claim_expires_at > ?`,
      args: [claimExpiresAt, opts.now, opts.outboxItemId, opts.claimId, opts.now],
    });
    if (result.rowsAffected === 0) {
      throw new HarnessStorageChannelOutboxClaimConflictError(opts.outboxItemId, opts.claimId);
    }
    return { claimExpiresAt, storageNow: opts.now };
  }

  async markChannelOutboxSent(opts: {
    outboxItemId: string;
    claimId: string;
    sentAt?: number;
    providerMessageId?: string;
    providerReceipt?: ChannelProviderDeliveryReceipt;
  }): Promise<void> {
    await this.#ensureChannelOutboxTable();
    const current = await this.#claimedChannelOutboxItem(opts.outboxItemId, opts.claimId);
    const storageNow = Date.now();
    const next: ChannelOutboxItem = {
      ...current,
      status: 'sent',
      claimId: undefined,
      claimExpiresAt: undefined,
      nextAttemptAt: undefined,
      failedAt: undefined,
      deadAt: undefined,
      lastError: undefined,
      sentAt: opts.sentAt ?? storageNow,
      providerMessageId: opts.providerMessageId,
      providerReceipt: opts.providerReceipt,
      updatedAt: storageNow,
    };
    assertLegalChannelOutboxUpdate(current, next);
    const cols = channelOutboxColumnValues(next);
    const update = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_CHANNEL_OUTBOX}
            SET ${cols.names.map(name => `${name} = ?`).join(', ')}
            WHERE id = ? AND status = 'claimed' AND claim_id = ? AND claim_expires_at IS NOT NULL AND claim_expires_at > ?`,
      args: [...cols.values, opts.outboxItemId, opts.claimId, storageNow],
    });
    if (update.rowsAffected === 0) {
      throw new HarnessStorageChannelOutboxClaimConflictError(opts.outboxItemId, opts.claimId);
    }
  }

  async markChannelOutboxFailed(opts: {
    outboxItemId: string;
    claimId: string;
    retryAt?: number;
    dead?: boolean;
    error: NonNullable<ChannelOutboxItem['lastError']>;
  }): Promise<void> {
    await this.#ensureChannelOutboxTable();
    const current = await this.#claimedChannelOutboxItem(opts.outboxItemId, opts.claimId);
    const storageNow = Date.now();
    const terminal = opts.dead === true || opts.error.retryable === false;
    const next: ChannelOutboxItem = {
      ...current,
      status: terminal ? 'dead' : 'failed',
      claimId: undefined,
      claimExpiresAt: undefined,
      nextAttemptAt: terminal ? undefined : opts.retryAt,
      failedAt: terminal ? current.failedAt : storageNow,
      deadAt: terminal ? storageNow : undefined,
      lastError: { ...opts.error, retryable: terminal ? false : (opts.error.retryable ?? true) },
      updatedAt: storageNow,
    };
    assertLegalChannelOutboxUpdate(current, next);
    const cols = channelOutboxColumnValues(next);
    const update = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_CHANNEL_OUTBOX}
            SET ${cols.names.map(name => `${name} = ?`).join(', ')}
            WHERE id = ? AND status = 'claimed' AND claim_id = ? AND claim_expires_at IS NOT NULL AND claim_expires_at > ?`,
      args: [...cols.values, opts.outboxItemId, opts.claimId, storageNow],
    });
    if (update.rowsAffected === 0) {
      throw new HarnessStorageChannelOutboxClaimConflictError(opts.outboxItemId, opts.claimId);
    }
  }

  async listChannelDiagnosticsRows(opts: ListChannelDiagnosticsInput): Promise<ChannelDiagnosticsRows> {
    const namespace = this.#resolveHarnessName(opts.harnessName);
    const limit = opts.limit ?? 50;
    const sessionIds = Array.from(new Set(opts.sessionIds));
    if (limit <= 0 || sessionIds.length === 0) {
      return { inbox: [], actionTokens: [], actionReceipts: [], outbox: [] };
    }
    await this.#ensureChannelInboxTable();
    await this.#ensureChannelActionTables();
    await this.#ensureChannelOutboxTable();

    const sessionPlaceholders = sessionIds.map(() => '?').join(', ');
    const inbox = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_INBOX}
            WHERE harness_name = ? AND resource_id = ? AND session_id IN (${sessionPlaceholders})
            ORDER BY updated_at DESC, id DESC
            LIMIT ?`,
      args: [namespace, opts.resourceId, ...sessionIds, limit],
    });
    const actionTokens = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_ACTION_TOKENS}
            WHERE harness_name = ? AND resource_id = ? AND owning_session_id IN (${sessionPlaceholders})
            ORDER BY updated_at DESC, action_token_id DESC
            LIMIT ?`,
      args: [namespace, opts.resourceId, ...sessionIds, limit],
    });
    const actionReceipts = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}
            WHERE harness_name = ? AND resource_id = ? AND owning_session_id IN (${sessionPlaceholders})
            ORDER BY updated_at DESC, id DESC
            LIMIT ?`,
      args: [namespace, opts.resourceId, ...sessionIds, limit],
    });
    const outbox = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_OUTBOX}
            WHERE harness_name = ? AND resource_id = ?
              AND (session_id IN (${sessionPlaceholders}) OR owning_session_id IN (${sessionPlaceholders}))
            ORDER BY updated_at DESC, id DESC
            LIMIT ?`,
      args: [namespace, opts.resourceId, ...sessionIds, ...sessionIds, limit],
    });

    return {
      inbox: inbox.rows.map(row => rowToChannelInboxItem(row)),
      actionTokens: actionTokens.rows.map(row => rowToChannelActionToken(row)),
      actionReceipts: actionReceipts.rows.map(row => rowToChannelActionReceipt(row)),
      outbox: outbox.rows.map(row => rowToChannelOutboxItem(row)),
    };
  }

  async createOrLoadHarnessWakeupItem(
    record: HarnessWakeupItem,
    opts?: { initialClaim?: { claimId: string; now: number; claimTtlMs: number } },
  ): Promise<CreateOrLoadHarnessWakeupItemResult> {
    await this.#ensureWakeupTable();
    const namespace = this.#resolveHarnessName(record.harnessName);
    const incoming: HarnessWakeupItem = { ...record, harnessName: namespace };
    if (incoming.status !== 'due') {
      throw new HarnessStorageWakeupTransitionError(
        incoming.id,
        undefined,
        incoming.status,
        'new wakeups must start as due',
      );
    }
    assertValidHarnessWakeupState(incoming);
    const canInitialClaim =
      opts?.initialClaim !== undefined && isHarnessWakeupClaimable(incoming, opts.initialClaim.now);
    const insertItem = canInitialClaim
      ? claimHarnessWakeupItem(
          incoming,
          opts.initialClaim!.claimId,
          opts.initialClaim!.now,
          opts.initialClaim!.claimTtlMs,
        )
      : incoming;
    assertValidHarnessWakeupState(insertItem);
    const cols = harnessWakeupColumnValues(insertItem);
    try {
      await this.#client.execute({
        sql: `INSERT INTO ${TABLE_HARNESS_WAKEUPS}
              (${cols.names.join(', ')})
              VALUES (${cols.names.map(() => '?').join(', ')})`,
        args: cols.values,
      });
      return { item: insertItem, duplicate: false, conflict: false, claimed: canInitialClaim };
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
    }
    let existing = await this.loadHarnessWakeupItemByIdempotencyKey({
      harnessName: namespace,
      idempotencyKey: incoming.idempotencyKey,
    });
    if (!existing) {
      existing = await this.loadHarnessWakeupItemBySourceFire({
        harnessName: namespace,
        source: incoming.source,
        sourceId: incoming.sourceId,
        fireId: incoming.fireId,
      });
    }
    if (!existing) {
      const existingById = await this.#loadHarnessWakeupItemById(incoming.id);
      if (existingById) {
        throw new HarnessStorageWakeupTransitionError(
          incoming.id,
          existingById.status,
          incoming.status,
          'id is already owned by another wakeup item',
        );
      }
      throw new HarnessStorageWakeupClaimConflictError(incoming.id);
    }
    const conflict = !harnessWakeupItemsEquivalentForCreate(existing, incoming);
    let item = existing;
    let claimed = false;
    if (!conflict && opts?.initialClaim && isHarnessWakeupClaimable(existing, opts.initialClaim.now)) {
      const update = await this.#client.execute({
        sql: `UPDATE ${TABLE_HARNESS_WAKEUPS}
              SET status = 'claimed',
                  attempts = attempts + 1,
                  claim_id = ?,
                  claim_expires_at = ?,
                  claimed_at = ?,
                  queued_item_id = NULL,
                  queued_at = NULL,
                  completed_at = NULL,
                  dead_at = NULL,
                  run_id = NULL,
                  signal_id = NULL,
                  result = NULL,
                  next_attempt_at = NULL,
                  failed_at = NULL,
                  last_error = NULL,
                  updated_at = ?
              WHERE harness_name = ? AND id = ?
                AND status IN ('due', 'failed', 'claimed')
                AND due_at <= ?
                AND (claim_id IS NULL OR claim_expires_at IS NULL OR claim_expires_at <= ?)
                AND (next_attempt_at IS NULL OR next_attempt_at <= ?)`,
        args: [
          opts.initialClaim.claimId,
          opts.initialClaim.now + opts.initialClaim.claimTtlMs,
          opts.initialClaim.now,
          opts.initialClaim.now,
          namespace,
          existing.id,
          opts.initialClaim.now,
          opts.initialClaim.now,
          opts.initialClaim.now,
        ],
      });
      if (update.rowsAffected > 0) {
        claimed = true;
        item = (await this.#loadHarnessWakeupItemById(existing.id, namespace)) ?? existing;
      }
    }
    return { item, duplicate: true, conflict, claimed };
  }

  async loadHarnessWakeupItemByIdempotencyKey(opts: {
    harnessName: string;
    idempotencyKey: string;
  }): Promise<HarnessWakeupItem | null> {
    await this.#ensureWakeupTable();
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_WAKEUPS}
            WHERE harness_name = ? AND idempotency_key = ?
            LIMIT 1`,
      args: [this.#resolveHarnessName(opts.harnessName), opts.idempotencyKey],
    });
    return result.rows[0] ? rowToHarnessWakeupItem(result.rows[0] as Record<string, unknown>) : null;
  }

  async loadHarnessWakeupItemBySourceFire(opts: {
    harnessName: string;
    source: HarnessWakeupItem['source'];
    sourceId: string;
    fireId: string;
  }): Promise<HarnessWakeupItem | null> {
    await this.#ensureWakeupTable();
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_WAKEUPS}
            WHERE harness_name = ? AND source = ? AND source_id = ? AND fire_id = ?
            LIMIT 1`,
      args: [this.#resolveHarnessName(opts.harnessName), opts.source, opts.sourceId, opts.fireId],
    });
    return result.rows[0] ? rowToHarnessWakeupItem(result.rows[0] as Record<string, unknown>) : null;
  }

  async claimHarnessWakeupItems(opts: {
    harnessName: string;
    source?: HarnessWakeupItem['source'];
    statuses: HarnessWakeupClaimStatus[];
    claimId: string;
    limit: number;
    now: number;
    claimTtlMs: number;
  }): Promise<HarnessWakeupItem[]> {
    await this.#ensureWakeupTable();
    if (opts.limit <= 0 || opts.statuses.length === 0) return [];
    const namespace = this.#resolveHarnessName(opts.harnessName);
    const filters = [
      'harness_name = ?',
      `status IN (${opts.statuses.map(() => '?').join(', ')})`,
      'due_at <= ?',
      '(claim_id IS NULL OR claim_expires_at IS NULL OR claim_expires_at <= ?)',
      '(next_attempt_at IS NULL OR next_attempt_at <= ?)',
    ];
    const args: any[] = [namespace, ...opts.statuses, opts.now, opts.now, opts.now];
    if (opts.source !== undefined) {
      filters.splice(1, 0, 'source = ?');
      args.splice(1, 0, opts.source);
    }
    const claimed = await this.#client.execute({
      sql: `WITH candidates AS (
              SELECT id FROM ${TABLE_HARNESS_WAKEUPS}
              WHERE ${filters.join(' AND ')}
              ORDER BY due_at ASC, created_at ASC, id ASC
              LIMIT ?
              FOR UPDATE SKIP LOCKED
            )
            UPDATE ${TABLE_HARNESS_WAKEUPS} AS wakeup
            SET status = 'claimed',
                attempts = wakeup.attempts + 1,
                claim_id = ?,
                claim_expires_at = ?,
                claimed_at = ?,
                queued_item_id = NULL,
                queued_at = NULL,
                completed_at = NULL,
                dead_at = NULL,
                run_id = NULL,
                signal_id = NULL,
                result = NULL,
                next_attempt_at = NULL,
                failed_at = NULL,
                last_error = NULL,
                updated_at = ?
            FROM candidates
            WHERE wakeup.id = candidates.id
            RETURNING wakeup.*`,
      args: [...args, opts.limit, opts.claimId, opts.now + opts.claimTtlMs, opts.now, opts.now],
    });
    return claimed.rows.map(row => rowToHarnessWakeupItem(row as Record<string, unknown>));
  }

  async renewHarnessWakeupClaim(opts: {
    wakeupItemId: string;
    claimId: string;
    now: number;
    claimTtlMs: number;
  }): Promise<{ claimExpiresAt: number; storageNow: number }> {
    await this.#ensureWakeupTable();
    const claimExpiresAt = opts.now + opts.claimTtlMs;
    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_WAKEUPS}
            SET claim_expires_at = ?, updated_at = ?
            WHERE id = ? AND claim_id = ?
              AND claim_expires_at IS NOT NULL AND claim_expires_at > ?
              AND status = 'claimed'`,
      args: [claimExpiresAt, opts.now, opts.wakeupItemId, opts.claimId, opts.now],
    });
    if (result.rowsAffected === 0) {
      throw new HarnessStorageWakeupClaimConflictError(opts.wakeupItemId, opts.claimId);
    }
    return { claimExpiresAt, storageNow: opts.now };
  }

  async updateHarnessWakeupItem(record: HarnessWakeupItem, opts: { claimId: string }): Promise<void> {
    await this.#ensureWakeupTable();
    const namespace = this.#resolveHarnessName(record.harnessName);
    const current = await this.#loadHarnessWakeupItemById(record.id, namespace);
    const storageNow = Date.now();
    if (
      !current ||
      current.claimId !== opts.claimId ||
      current.claimExpiresAt === undefined ||
      current.claimExpiresAt <= storageNow ||
      current.status !== 'claimed'
    ) {
      throw new HarnessStorageWakeupClaimConflictError(record.id, opts.claimId);
    }
    const next = { ...record, harnessName: namespace };
    assertLegalHarnessWakeupUpdate(current, next);
    const cols = harnessWakeupColumnValues(next);
    const currentCols = harnessWakeupColumnValues(current);
    const preservesCurrentClaim = next.claimId === opts.claimId && next.claimExpiresAt !== undefined;
    const updateNames = cols.names.filter(
      name => name !== 'id' && (!preservesCurrentClaim || (name !== 'claim_id' && name !== 'claim_expires_at')),
    );
    const stateCompareNames = cols.names.filter(
      name => name !== 'id' && name !== 'claim_id' && name !== 'claim_expires_at' && name !== 'updated_at',
    );
    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_WAKEUPS}
	            SET ${updateNames.map(name => `${name} = ?`).join(', ')}
	            WHERE harness_name = ? AND id = ? AND claim_id = ?
	              AND claim_expires_at IS NOT NULL AND claim_expires_at > ?
	              AND status = 'claimed'
	              AND ${stateCompareNames.map(name => `${name} IS ?`).join(' AND ')}`,
      args: [
        ...updateNames.map(name => cols.values[cols.names.indexOf(name)]),
        namespace,
        next.id,
        opts.claimId,
        storageNow,
        ...stateCompareNames.map(name => currentCols.values[currentCols.names.indexOf(name)]),
      ],
    });
    if (result.rowsAffected === 0) {
      throw new HarnessStorageWakeupClaimConflictError(record.id, opts.claimId);
    }
  }

  async #loadHarnessWakeupItemById(id: string, harnessName?: string): Promise<HarnessWakeupItem | null> {
    const conditions = ['id = ?'];
    const args: string[] = [id];
    if (harnessName !== undefined) {
      conditions.unshift('harness_name = ?');
      args.unshift(this.#resolveHarnessName(harnessName));
    }
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_WAKEUPS}
            WHERE ${conditions.join(' AND ')}
            LIMIT 1`,
      args,
    });
    return result.rows[0] ? rowToHarnessWakeupItem(result.rows[0] as Record<string, unknown>) : null;
  }

  async #loadChannelInboxItemById(id: string, harnessName?: string): Promise<ChannelInboxItem | null> {
    const conditions = ['id = ?'];
    const args: string[] = [id];
    if (harnessName !== undefined) {
      conditions.unshift('harness_name = ?');
      args.unshift(this.#resolveHarnessName(harnessName));
    }
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_INBOX}
            WHERE ${conditions.join(' AND ')}
            LIMIT 1`,
      args,
    });
    const row = result.rows[0];
    return row ? rowToChannelInboxItem(row as Record<string, unknown>) : null;
  }

  async #loadChannelOutboxItemById(id: string, harnessName?: string): Promise<ChannelOutboxItem | null> {
    const conditions = ['id = ?'];
    const args: string[] = [id];
    if (harnessName !== undefined) {
      conditions.unshift('harness_name = ?');
      args.unshift(this.#resolveHarnessName(harnessName));
    }
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_OUTBOX}
            WHERE ${conditions.join(' AND ')}
            LIMIT 1`,
      args,
    });
    const row = result.rows[0];
    return row ? rowToChannelOutboxItem(row as Record<string, unknown>) : null;
  }

  async #loadChannelOutboxByIdempotencyKey(opts: {
    harnessName: string;
    bindingId: string;
    idempotencyKey: string;
  }): Promise<ChannelOutboxItem | null> {
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_OUTBOX}
            WHERE harness_name = ? AND binding_id = ? AND idempotency_key = ?
            LIMIT 1`,
      args: [this.#resolveHarnessName(opts.harnessName), opts.bindingId, opts.idempotencyKey],
    });
    const row = result.rows[0];
    return row ? rowToChannelOutboxItem(row as Record<string, unknown>) : null;
  }

  async #claimedChannelOutboxItem(outboxItemId: string, claimId: string): Promise<ChannelOutboxItem> {
    const current = await this.#loadChannelOutboxItemById(outboxItemId);
    const storageNow = Date.now();
    if (
      !current ||
      current.status !== 'claimed' ||
      current.claimId !== claimId ||
      current.claimExpiresAt === undefined ||
      current.claimExpiresAt <= storageNow
    ) {
      throw new HarnessStorageChannelOutboxClaimConflictError(outboxItemId, claimId);
    }
    return current;
  }

  async #backfillHarnessNamespace(): Promise<void> {
    await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
            SET harness_name = ?
            WHERE harness_name IS NULL OR harness_name = ''`,
      args: [this.#harnessName],
    });
    await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_ATTACHMENTS}
            SET harness_name = ?
            WHERE harness_name IS NULL OR harness_name = ''`,
      args: [this.#harnessName],
    });
    await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_ATTACHMENT_REFERENCES}
            SET harness_name = ?
            WHERE harness_name IS NULL OR harness_name = ''`,
      args: [this.#harnessName],
    });
  }

  #resolveHarnessName(input?: string): string {
    return input ?? this.#harnessName;
  }

  #schemaPrefix(): string {
    return this.#schema !== 'public' ? `${this.#schema}_` : '';
  }

  async #createDefaultIndexes(indexNames?: readonly string[]): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    const prefix = this.#schemaPrefix();
    const allowedNames = indexNames === undefined ? undefined : new Set(indexNames.map(name => `${prefix}${name}`));
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      if (allowedNames !== undefined && !allowedNames.has(indexDef.name)) continue;
      await this.#db.createIndex(indexDef);
    }
  }

  async #ensureMessageResultsTable(): Promise<void> {
    const messageResultsConfig = TABLE_CONFIGS[TABLE_HARNESS_MESSAGE_RESULTS];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_MESSAGE_RESULTS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_MESSAGE_RESULTS],
      compositePrimaryKey: messageResultsConfig?.compositePrimaryKey,
    });
  }

  async #ensureOperationTombstonesTable(): Promise<void> {
    const tombstonesConfig = TABLE_CONFIGS[TABLE_HARNESS_OPERATION_TOMBSTONES];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_OPERATION_TOMBSTONES,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_OPERATION_TOMBSTONES],
      compositePrimaryKey: tombstonesConfig?.compositePrimaryKey,
    });
  }

  async #ensureSessionEventsTable(): Promise<void> {
    if (this.#sessionEventsReady !== undefined) {
      return this.#sessionEventsReady;
    }
    this.#sessionEventsReady = (async () => {
      const eventConfig = TABLE_CONFIGS[TABLE_HARNESS_SESSION_EVENTS];
      await this.#db.createTable({
        tableName: TABLE_HARNESS_SESSION_EVENTS,
        schema: TABLE_SCHEMAS[TABLE_HARNESS_SESSION_EVENTS],
        compositePrimaryKey: eventConfig?.compositePrimaryKey,
      });
      await this.#createDefaultIndexes(['idx_harness_session_events_replay']);
    })().catch(error => {
      this.#sessionEventsReady = undefined;
      throw error;
    });
    return this.#sessionEventsReady;
  }

  async #ensureThreadDeleteFencesTable(): Promise<void> {
    const threadDeleteFencesConfig = TABLE_CONFIGS[TABLE_HARNESS_THREAD_DELETE_FENCES];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_THREAD_DELETE_FENCES,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_THREAD_DELETE_FENCES],
      compositePrimaryKey: threadDeleteFencesConfig?.compositePrimaryKey,
    });
    await this.#db.alterTable({
      tableName: TABLE_HARNESS_THREAD_DELETE_FENCES,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_THREAD_DELETE_FENCES],
      ifNotExists: ['lease_id'],
    });
  }

  async #ensureChannelInboxTable(): Promise<void> {
    const inboxConfig = TABLE_CONFIGS[TABLE_HARNESS_CHANNEL_INBOX];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_CHANNEL_INBOX,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_CHANNEL_INBOX],
      compositePrimaryKey: inboxConfig?.compositePrimaryKey,
    });
    await this.#ensureChannelInboxIndexes();
  }

  async #ensureChannelInboxIndexes(): Promise<void> {
    if (this.#channelInboxIndexesReady !== undefined) {
      return this.#channelInboxIndexesReady;
    }
    this.#channelInboxIndexesReady = this.#createChannelInboxIndexes().catch(error => {
      this.#channelInboxIndexesReady = undefined;
      throw error;
    });
    return this.#channelInboxIndexesReady;
  }

  async #createChannelInboxIndexes(): Promise<void> {
    await this.#createDefaultIndexes(['idx_harness_channel_inbox_idempotency', 'idx_harness_channel_inbox_claim']);
  }

  async #ensureChannelActionTables(): Promise<void> {
    const tokenConfig = TABLE_CONFIGS[TABLE_HARNESS_CHANNEL_ACTION_TOKENS];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_CHANNEL_ACTION_TOKENS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_CHANNEL_ACTION_TOKENS],
      compositePrimaryKey: tokenConfig?.compositePrimaryKey,
    });
    const receiptConfig = TABLE_CONFIGS[TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS],
      compositePrimaryKey: receiptConfig?.compositePrimaryKey,
    });
    await this.#ensureChannelActionIndexes();
  }

  async #ensureChannelActionIndexes(): Promise<void> {
    if (this.#channelActionIndexesReady !== undefined) {
      return this.#channelActionIndexesReady;
    }
    this.#channelActionIndexesReady = this.#createChannelActionIndexes().catch(error => {
      this.#channelActionIndexesReady = undefined;
      throw error;
    });
    return this.#channelActionIndexesReady;
  }

  async #createChannelActionIndexes(): Promise<void> {
    await this.#createDefaultIndexes([
      'idx_harness_channel_action_tokens_transport',
      'idx_harness_channel_action_tokens_pending',
      'idx_harness_channel_action_receipts_token',
      'idx_harness_channel_action_receipts_action',
      'idx_harness_channel_action_receipts_claim',
    ]);
  }

  async #ensureChannelOutboxTable(): Promise<void> {
    const outboxConfig = TABLE_CONFIGS[TABLE_HARNESS_CHANNEL_OUTBOX];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_CHANNEL_OUTBOX,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_CHANNEL_OUTBOX],
      compositePrimaryKey: outboxConfig?.compositePrimaryKey,
    });
    await this.#ensureChannelOutboxIndexes();
  }

  async #ensureChannelOutboxIndexes(): Promise<void> {
    if (this.#channelOutboxIndexesReady !== undefined) {
      return this.#channelOutboxIndexesReady;
    }
    this.#channelOutboxIndexesReady = this.#createChannelOutboxIndexes().catch(error => {
      this.#channelOutboxIndexesReady = undefined;
      throw error;
    });
    return this.#channelOutboxIndexesReady;
  }

  async #createChannelOutboxIndexes(): Promise<void> {
    await this.#createDefaultIndexes([
      'idx_harness_channel_outbox_idempotency',
      'idx_harness_channel_outbox_claim',
      'idx_harness_channel_outbox_binding_order',
    ]);
  }

  async #ensureWakeupTable(): Promise<void> {
    const wakeupConfig = TABLE_CONFIGS[TABLE_HARNESS_WAKEUPS];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_WAKEUPS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_WAKEUPS],
      compositePrimaryKey: wakeupConfig?.compositePrimaryKey,
    });
    await this.#ensureWakeupIndexes();
  }

  async #ensureWakeupIndexes(): Promise<void> {
    if (this.#wakeupIndexesReady !== undefined) {
      return this.#wakeupIndexesReady;
    }
    this.#wakeupIndexesReady = this.#createWakeupIndexes().catch(error => {
      this.#wakeupIndexesReady = undefined;
      throw error;
    });
    return this.#wakeupIndexesReady;
  }

  async #createWakeupIndexes(): Promise<void> {
    await this.#createDefaultIndexes([
      'idx_harness_wakeups_idempotency',
      'idx_harness_wakeups_source_fire',
      'idx_harness_wakeups_claim',
    ]);
  }

  async #backfillAttachmentMetadata(): Promise<void> {
    for (;;) {
      const result = await this.#client.execute({
        sql: `SELECT harness_name, session_id, attachment_id, data_b64, sha256, source
              FROM ${TABLE_HARNESS_ATTACHMENTS}
              WHERE sha256 IS NULL OR sha256 = '' OR source IS NULL OR source = ''
              LIMIT 100`,
      });
      if (result.rows.length === 0) return;

      for (const row of result.rows) {
        const sha256 =
          row.sha256 != null && String(row.sha256).length > 0
            ? String(row.sha256)
            : sha256Hex(base64ToBytes(String(row.data_b64)));
        // Legacy rows predate source tracking; they were written through the
        // staged local upload path, so `preupload` is the least lossy default.
        const source =
          row.source != null && String(row.source).length > 0 ? toAttachmentSource(row.source) : 'preupload';
        await this.#client.execute({
          sql: `UPDATE ${TABLE_HARNESS_ATTACHMENTS}
                SET sha256 = ?, source = ?
                WHERE harness_name = ? AND session_id = ? AND attachment_id = ?`,
          args: [
            sha256,
            source,
            String(row.harness_name ?? this.#harnessName),
            String(row.session_id),
            String(row.attachment_id),
          ],
        });
      }
    }
  }

  async #assertNoDuplicateActiveSessions(): Promise<void> {
    const result = await this.#client.execute({
      sql: `SELECT harness_name, resource_id, thread_id, COUNT(*) AS duplicate_count
            FROM ${TABLE_HARNESS_SESSIONS}
            WHERE closed_at IS NULL
            GROUP BY harness_name, resource_id, thread_id
            HAVING COUNT(*) > 1
            LIMIT 5`,
      args: [],
    });
    if (result.rows.length === 0) return;

    const examples = result.rows
      .map(row => {
        const record = row as Record<string, unknown>;
        return `${String(record.harness_name)}:${String(record.resource_id)}:${String(record.thread_id)} (${String(
          record.duplicate_count,
        )})`;
      })
      .join(', ');
    throw new Error(
      `Cannot create Harness active-session uniqueness index while duplicate active rows exist. Close or migrate duplicate active rows for: ${examples}`,
    );
  }

  async #withCompactionLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.#compactionLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => {
      release = resolve;
    });
    const queued = previous.catch(() => undefined).then(() => current);
    this.#compactionLocks.set(key, queued);
    await previous.catch(() => undefined);
    try {
      return await fn();
    } finally {
      release();
      if (this.#compactionLocks.get(key) === queued) {
        this.#compactionLocks.delete(key);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

const SESSION_COLUMN_NAMES = [
  'harness_name',
  'id',
  'resource_id',
  'thread_id',
  'parent_session_id',
  'origin',
  'subagent_depth',
  'owns_thread',
  'mode_id',
  'model_id',
  'subagent_model_overrides',
  'permission_rules',
  'session_grants',
  'token_usage',
  'pending_queue',
  'pending_resume',
  'queue_admission_receipts',
  'inbox_response_receipts',
  'observational_memory',
  'goal',
  'workspace',
  'state',
  'created_at',
  'last_activity_at',
  'closing_at',
  'close_deadline_at',
  'closed_at',
  'version',
  'owner_id',
  'lease_expires_at',
] as const;

function sessionColumnValues(record: SessionRecord, version: number): { names: string[]; values: any[] } {
  const values = [
    record.harnessName,
    record.id,
    record.resourceId,
    record.threadId,
    record.parentSessionId ?? null,
    record.origin,
    record.subagentDepth ?? null,
    record.ownsThread,
    record.modeId,
    record.modelId,
    JSON.stringify(record.subagentModelOverrides ?? {}),
    JSON.stringify(record.permissionRules),
    JSON.stringify(record.sessionGrants),
    JSON.stringify(record.tokenUsage),
    JSON.stringify(record.pendingQueue),
    record.pendingResume ? JSON.stringify(record.pendingResume) : null,
    record.queueAdmissionReceipts ? JSON.stringify(record.queueAdmissionReceipts) : null,
    record.inboxResponseReceipts ? JSON.stringify(record.inboxResponseReceipts) : null,
    record.observationalMemory ? JSON.stringify(record.observationalMemory) : null,
    record.goal ? JSON.stringify(record.goal) : null,
    record.workspace ? JSON.stringify(record.workspace) : null,
    JSON.stringify(record.state ?? {}),
    record.createdAt,
    record.lastActivityAt,
    record.closingAt ?? null,
    record.closeDeadlineAt ?? null,
    record.closedAt ?? null,
    version,
    record.ownerId ?? null,
    record.leaseExpiresAt ?? null,
  ];
  return { names: [...SESSION_COLUMN_NAMES], values };
}

const CHANNEL_INBOX_COLUMN_NAMES = [
  'id',
  'harness_name',
  'channel_id',
  'provider_id',
  'idempotency_key',
  'payload_hash',
  'admission_hash',
  'admission_id',
  'binding_id',
  'resource_id',
  'thread_id',
  'session_id',
  'run_id',
  'signal_id',
  'queued_item_id',
  'external_message_id',
  'received_at',
  'admitted_at',
  'accepted_at',
  'queued_at',
  'failed_at',
  'dead_at',
  'updated_at',
  'status',
  'delivery',
  'mode',
  'model',
  'attempts',
  'claim_id',
  'claim_expires_at',
  'next_attempt_at',
  'request_context',
  'content',
  'attachments',
  'last_error',
] as const;

function channelInboxColumnValues(record: ChannelInboxItem): { names: string[]; values: any[] } {
  const values = [
    record.id,
    record.harnessName,
    record.channelId,
    record.providerId,
    record.idempotencyKey,
    record.payloadHash,
    record.admissionHash ?? null,
    record.admissionId,
    record.bindingId ?? null,
    record.resourceId ?? null,
    record.threadId ?? null,
    record.sessionId ?? null,
    record.runId ?? null,
    record.signalId ?? null,
    record.queuedItemId ?? null,
    record.externalMessageId,
    record.receivedAt,
    record.admittedAt ?? null,
    record.acceptedAt ?? null,
    record.queuedAt ?? null,
    record.failedAt ?? null,
    record.deadAt ?? null,
    record.updatedAt,
    record.status,
    record.delivery ?? null,
    record.mode ?? null,
    record.model ?? null,
    record.attempts,
    record.claimId ?? null,
    record.claimExpiresAt ?? null,
    record.nextAttemptAt ?? null,
    JSON.stringify(record.requestContext),
    record.content,
    JSON.stringify(record.attachments),
    record.lastError ? JSON.stringify(record.lastError) : null,
  ];
  return { names: [...CHANNEL_INBOX_COLUMN_NAMES], values };
}

function rowToChannelInboxItem(row: Record<string, unknown>): ChannelInboxItem {
  return {
    id: String(row.id),
    harnessName: String(row.harness_name),
    channelId: String(row.channel_id),
    providerId: String(row.provider_id),
    idempotencyKey: String(row.idempotency_key),
    payloadHash: String(row.payload_hash),
    admissionHash: row.admission_hash == null ? undefined : String(row.admission_hash),
    admissionId: String(row.admission_id),
    bindingId: row.binding_id == null ? undefined : String(row.binding_id),
    resourceId: row.resource_id == null ? undefined : String(row.resource_id),
    threadId: row.thread_id == null ? undefined : String(row.thread_id),
    sessionId: row.session_id == null ? undefined : String(row.session_id),
    runId: row.run_id == null ? undefined : String(row.run_id),
    signalId: row.signal_id == null ? undefined : String(row.signal_id),
    queuedItemId: row.queued_item_id == null ? undefined : String(row.queued_item_id),
    externalMessageId: String(row.external_message_id),
    receivedAt: Number(row.received_at),
    admittedAt: row.admitted_at == null ? undefined : Number(row.admitted_at),
    acceptedAt: row.accepted_at == null ? undefined : Number(row.accepted_at),
    queuedAt: row.queued_at == null ? undefined : Number(row.queued_at),
    failedAt: row.failed_at == null ? undefined : Number(row.failed_at),
    deadAt: row.dead_at == null ? undefined : Number(row.dead_at),
    updatedAt: Number(row.updated_at),
    status: String(row.status) as ChannelInboxItem['status'],
    delivery: row.delivery == null ? undefined : (String(row.delivery) as ChannelInboxItem['delivery']),
    mode: row.mode == null ? undefined : String(row.mode),
    model: row.model == null ? undefined : String(row.model),
    attempts: Number(row.attempts),
    claimId: row.claim_id == null ? undefined : String(row.claim_id),
    claimExpiresAt: row.claim_expires_at == null ? undefined : Number(row.claim_expires_at),
    nextAttemptAt: row.next_attempt_at == null ? undefined : Number(row.next_attempt_at),
    requestContext: parseJson(row.request_context) ?? {},
    content: String(row.content),
    attachments: parseJson(row.attachments) ?? [],
    lastError: parseJson(row.last_error) ?? undefined,
  };
}

const HARNESS_WAKEUP_COLUMN_NAMES = [
  'id',
  'harness_name',
  'source',
  'source_id',
  'fire_id',
  'idempotency_key',
  'payload_hash',
  'admission_id',
  'admission_hash',
  'resource_id',
  'thread_id',
  'session_id',
  'queued_item_id',
  'run_id',
  'signal_id',
  'due_at',
  'created_at',
  'updated_at',
  'claimed_at',
  'queued_at',
  'completed_at',
  'failed_at',
  'dead_at',
  'status',
  'mode',
  'model',
  'attempts',
  'missed_count',
  'claim_id',
  'claim_expires_at',
  'next_attempt_at',
  'request_context',
  'content',
  'attachments',
  'result',
  'last_error',
] as const;

function harnessWakeupColumnValues(record: HarnessWakeupItem): { names: string[]; values: any[] } {
  const values = [
    record.id,
    record.harnessName,
    record.source,
    record.sourceId,
    record.fireId,
    record.idempotencyKey,
    record.payloadHash,
    record.admissionId,
    record.admissionHash ?? null,
    record.resourceId ?? null,
    record.threadId ?? null,
    record.sessionId ?? null,
    record.queuedItemId ?? null,
    record.runId ?? null,
    record.signalId ?? null,
    record.dueAt,
    record.createdAt,
    record.updatedAt,
    record.claimedAt ?? null,
    record.queuedAt ?? null,
    record.completedAt ?? null,
    record.failedAt ?? null,
    record.deadAt ?? null,
    record.status,
    record.mode ?? null,
    record.model ?? null,
    record.attempts,
    record.missedCount ?? null,
    record.claimId ?? null,
    record.claimExpiresAt ?? null,
    record.nextAttemptAt ?? null,
    record.requestContext === undefined ? null : JSON.stringify(record.requestContext),
    record.content,
    JSON.stringify(record.attachments),
    record.result === undefined ? null : JSON.stringify(record.result),
    record.lastError === undefined ? null : JSON.stringify(record.lastError),
  ];
  return { names: [...HARNESS_WAKEUP_COLUMN_NAMES], values };
}

function rowToHarnessWakeupItem(row: Record<string, unknown>): HarnessWakeupItem {
  return {
    id: String(row.id),
    harnessName: String(row.harness_name),
    source: String(row.source) as HarnessWakeupItem['source'],
    sourceId: String(row.source_id),
    fireId: String(row.fire_id),
    idempotencyKey: String(row.idempotency_key),
    payloadHash: String(row.payload_hash),
    admissionId: String(row.admission_id),
    admissionHash: row.admission_hash == null ? undefined : String(row.admission_hash),
    resourceId: row.resource_id == null ? undefined : String(row.resource_id),
    threadId: row.thread_id == null ? undefined : String(row.thread_id),
    sessionId: row.session_id == null ? undefined : String(row.session_id),
    queuedItemId: row.queued_item_id == null ? undefined : String(row.queued_item_id),
    runId: row.run_id == null ? undefined : String(row.run_id),
    signalId: row.signal_id == null ? undefined : String(row.signal_id),
    dueAt: Number(row.due_at),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    claimedAt: row.claimed_at == null ? undefined : Number(row.claimed_at),
    queuedAt: row.queued_at == null ? undefined : Number(row.queued_at),
    completedAt: row.completed_at == null ? undefined : Number(row.completed_at),
    failedAt: row.failed_at == null ? undefined : Number(row.failed_at),
    deadAt: row.dead_at == null ? undefined : Number(row.dead_at),
    status: String(row.status) as HarnessWakeupItem['status'],
    mode: row.mode == null ? undefined : String(row.mode),
    model: row.model == null ? undefined : String(row.model),
    attempts: Number(row.attempts),
    missedCount: row.missed_count == null ? undefined : Number(row.missed_count),
    claimId: row.claim_id == null ? undefined : String(row.claim_id),
    claimExpiresAt: row.claim_expires_at == null ? undefined : Number(row.claim_expires_at),
    nextAttemptAt: row.next_attempt_at == null ? undefined : Number(row.next_attempt_at),
    requestContext: parseJson(row.request_context) ?? undefined,
    content: String(row.content),
    attachments: parseJson(row.attachments) ?? [],
    result: row.result == null ? undefined : parseJson(row.result),
    lastError: parseJson(row.last_error) ?? undefined,
  };
}

const CHANNEL_ACTION_TOKEN_COLUMN_NAMES = [
  'action_token_id',
  'harness_name',
  'channel_id',
  'provider_id',
  'resource_id',
  'owning_session_id',
  'item_id',
  'kind',
  'binding_id',
  'binding_generation',
  'run_id',
  'pending_requested_at',
  'audience',
  'metadata_hash',
  'transport_hash',
  'key_id',
  'expires_at',
  'revoked_at',
  'revoked_reason',
  'created_at',
  'updated_at',
] as const;

function channelActionTokenColumnValues(record: ChannelActionToken): { names: string[]; values: any[] } {
  const values = [
    record.actionTokenId,
    record.harnessName,
    record.channelId,
    record.providerId,
    record.resourceId,
    record.owningSessionId,
    record.itemId,
    record.kind,
    record.bindingId,
    record.bindingGeneration,
    record.runId,
    record.pendingRequestedAt,
    JSON.stringify(record.audience),
    record.metadataHash,
    record.transportHash,
    record.keyId ?? null,
    record.expiresAt ?? null,
    record.revokedAt ?? null,
    record.revokedReason ?? null,
    record.createdAt,
    record.updatedAt,
  ];
  return { names: [...CHANNEL_ACTION_TOKEN_COLUMN_NAMES], values };
}

function rowToChannelActionToken(row: Record<string, unknown>): ChannelActionToken {
  return {
    actionTokenId: String(row.action_token_id),
    harnessName: String(row.harness_name),
    channelId: String(row.channel_id),
    providerId: String(row.provider_id),
    resourceId: String(row.resource_id),
    owningSessionId: String(row.owning_session_id),
    itemId: String(row.item_id),
    kind: String(row.kind) as ChannelActionToken['kind'],
    bindingId: String(row.binding_id),
    bindingGeneration: Number(row.binding_generation),
    runId: String(row.run_id),
    pendingRequestedAt: Number(row.pending_requested_at),
    audience: parseJson(row.audience),
    metadataHash: String(row.metadata_hash),
    transportHash: String(row.transport_hash),
    keyId: row.key_id == null ? undefined : String(row.key_id),
    expiresAt: row.expires_at == null ? undefined : Number(row.expires_at),
    revokedAt: row.revoked_at == null ? undefined : Number(row.revoked_at),
    revokedReason:
      row.revoked_reason == null ? undefined : (String(row.revoked_reason) as ChannelActionToken['revokedReason']),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

const CHANNEL_ACTION_RECEIPT_COLUMN_NAMES = [
  'id',
  'harness_name',
  'channel_id',
  'provider_id',
  'action_token_id',
  'action_id',
  'binding_id',
  'binding_generation',
  'resource_id',
  'owning_session_id',
  'item_id',
  'kind',
  'run_id',
  'pending_requested_at',
  'audience',
  'verified_actor',
  'response_hash',
  'response',
  'status',
  'conflict_reason',
  'attempts',
  'claim_id',
  'claim_expires_at',
  'next_attempt_at',
  'accepted_at',
  'applied_at',
  'failed_at',
  'dead_at',
  'result',
  'last_error',
  'created_at',
  'updated_at',
] as const;

function channelActionReceiptColumnValues(record: ChannelActionReceipt): { names: string[]; values: any[] } {
  const values = [
    record.id,
    record.harnessName,
    record.channelId,
    record.providerId,
    record.actionTokenId,
    record.actionId,
    record.bindingId,
    record.bindingGeneration,
    record.resourceId,
    record.owningSessionId,
    record.itemId,
    record.kind,
    record.runId,
    record.pendingRequestedAt,
    JSON.stringify(record.audience),
    record.verifiedActor ? JSON.stringify(record.verifiedActor) : null,
    record.responseHash,
    JSON.stringify(record.response),
    record.status,
    record.conflictReason ?? null,
    record.attempts,
    record.claimId ?? null,
    record.claimExpiresAt ?? null,
    record.nextAttemptAt ?? null,
    record.acceptedAt ?? null,
    record.appliedAt ?? null,
    record.failedAt ?? null,
    record.deadAt ?? null,
    record.result === undefined ? null : JSON.stringify(record.result),
    record.lastError ? JSON.stringify(record.lastError) : null,
    record.createdAt,
    record.updatedAt,
  ];
  return { names: [...CHANNEL_ACTION_RECEIPT_COLUMN_NAMES], values };
}

function rowToChannelActionReceipt(row: Record<string, unknown>): ChannelActionReceipt {
  return {
    id: String(row.id),
    harnessName: String(row.harness_name),
    channelId: String(row.channel_id),
    providerId: String(row.provider_id),
    actionTokenId: String(row.action_token_id),
    actionId: String(row.action_id),
    bindingId: String(row.binding_id),
    bindingGeneration: Number(row.binding_generation),
    resourceId: String(row.resource_id),
    owningSessionId: String(row.owning_session_id),
    itemId: String(row.item_id),
    kind: String(row.kind) as ChannelActionReceipt['kind'],
    runId: String(row.run_id),
    pendingRequestedAt: Number(row.pending_requested_at),
    audience: parseJson(row.audience),
    verifiedActor: parseJson(row.verified_actor) ?? undefined,
    responseHash: String(row.response_hash),
    response: parseJson(row.response),
    status: String(row.status) as ChannelActionReceipt['status'],
    conflictReason:
      row.conflict_reason == null ? undefined : (String(row.conflict_reason) as ChannelActionReceipt['conflictReason']),
    attempts: Number(row.attempts),
    claimId: row.claim_id == null ? undefined : String(row.claim_id),
    claimExpiresAt: row.claim_expires_at == null ? undefined : Number(row.claim_expires_at),
    nextAttemptAt: row.next_attempt_at == null ? undefined : Number(row.next_attempt_at),
    acceptedAt: row.accepted_at == null ? undefined : Number(row.accepted_at),
    appliedAt: row.applied_at == null ? undefined : Number(row.applied_at),
    failedAt: row.failed_at == null ? undefined : Number(row.failed_at),
    deadAt: row.dead_at == null ? undefined : Number(row.dead_at),
    result: row.result == null ? undefined : parseJson(row.result),
    lastError: parseJson(row.last_error) ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

const CHANNEL_OUTBOX_COLUMN_NAMES = [
  'id',
  'harness_name',
  'channel_id',
  'provider_id',
  'binding_id',
  'binding_generation',
  'idempotency_key',
  'payload_hash',
  'resource_id',
  'thread_id',
  'session_id',
  'owning_session_id',
  'source',
  'target',
  'kind',
  'operation_kind',
  'operation_name',
  'payload',
  'delivery_semantics',
  'status',
  'attempts',
  'claim_id',
  'claim_expires_at',
  'next_attempt_at',
  'sent_at',
  'failed_at',
  'dead_at',
  'provider_message_id',
  'provider_receipt',
  'last_error',
  'created_at',
  'updated_at',
] as const;

function channelOutboxColumnValues(record: ChannelOutboxItem): { names: string[]; values: any[] } {
  const values = [
    record.id,
    record.harnessName,
    record.channelId,
    record.providerId,
    record.bindingId,
    record.bindingGeneration,
    record.idempotencyKey,
    record.payloadHash,
    record.resourceId,
    record.threadId,
    record.sessionId ?? null,
    record.owningSessionId ?? null,
    record.source ? JSON.stringify(record.source) : null,
    JSON.stringify(record.target),
    record.kind,
    record.operationKind,
    record.operationName ?? null,
    JSON.stringify(record.payload),
    record.deliverySemantics,
    record.status,
    record.attempts,
    record.claimId ?? null,
    record.claimExpiresAt ?? null,
    record.nextAttemptAt ?? null,
    record.sentAt ?? null,
    record.failedAt ?? null,
    record.deadAt ?? null,
    record.providerMessageId ?? null,
    record.providerReceipt ? JSON.stringify(record.providerReceipt) : null,
    record.lastError ? JSON.stringify(record.lastError) : null,
    record.createdAt,
    record.updatedAt,
  ];
  return { names: [...CHANNEL_OUTBOX_COLUMN_NAMES], values };
}

function rowToChannelOutboxItem(row: Record<string, unknown>): ChannelOutboxItem {
  return {
    id: String(row.id),
    harnessName: String(row.harness_name),
    channelId: String(row.channel_id),
    providerId: String(row.provider_id),
    bindingId: String(row.binding_id),
    bindingGeneration: Number(row.binding_generation),
    idempotencyKey: String(row.idempotency_key),
    payloadHash: String(row.payload_hash),
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    sessionId: row.session_id == null ? undefined : String(row.session_id),
    owningSessionId: row.owning_session_id == null ? undefined : String(row.owning_session_id),
    source: parseJson(row.source) ?? undefined,
    target: parseJson(row.target),
    kind: String(row.kind) as ChannelOutboxItem['kind'],
    operationKind: String(row.operation_kind) as ChannelOutboxItem['operationKind'],
    operationName: row.operation_name == null ? undefined : String(row.operation_name),
    payload: parseJson(row.payload),
    deliverySemantics: String(row.delivery_semantics) as ChannelOutboxItem['deliverySemantics'],
    status: String(row.status) as ChannelOutboxItem['status'],
    attempts: Number(row.attempts),
    claimId: row.claim_id == null ? undefined : String(row.claim_id),
    claimExpiresAt: row.claim_expires_at == null ? undefined : Number(row.claim_expires_at),
    nextAttemptAt: row.next_attempt_at == null ? undefined : Number(row.next_attempt_at),
    sentAt: row.sent_at == null ? undefined : Number(row.sent_at),
    failedAt: row.failed_at == null ? undefined : Number(row.failed_at),
    deadAt: row.dead_at == null ? undefined : Number(row.dead_at),
    providerMessageId: row.provider_message_id == null ? undefined : String(row.provider_message_id),
    providerReceipt: parseJson(row.provider_receipt) ?? undefined,
    lastError: parseJson(row.last_error) ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function rowToSession(row: Record<string, unknown>): SessionRecord {
  return {
    harnessName: String(row.harness_name ?? 'default'),
    id: String(row.id),
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    parentSessionId: row.parent_session_id != null ? String(row.parent_session_id) : undefined,
    origin: String(row.origin) as SessionRecord['origin'],
    subagentDepth: row.subagent_depth != null ? Number(row.subagent_depth) : undefined,
    ownsThread: Number(row.owns_thread) === 1,
    modeId: String(row.mode_id),
    modelId: String(row.model_id),
    subagentModelOverrides: parseJson(row.subagent_model_overrides) ?? {},
    permissionRules: parseJson(row.permission_rules) ?? { categories: {}, tools: {} },
    sessionGrants: parseJson(row.session_grants) ?? { categories: [], tools: [] },
    tokenUsage: parseJson(row.token_usage) ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    pendingQueue: parseJson(row.pending_queue) ?? [],
    pendingResume: parseJson(row.pending_resume) ?? undefined,
    queueAdmissionReceipts: parseJson(row.queue_admission_receipts) ?? undefined,
    inboxResponseReceipts: parseJson(row.inbox_response_receipts) ?? undefined,
    observationalMemory: parseJson(row.observational_memory) ?? undefined,
    goal: parseJson(row.goal) ?? undefined,
    workspace: parseJson(row.workspace) ?? undefined,
    state: parseJson(row.state) ?? {},
    createdAt: Number(row.created_at),
    lastActivityAt: Number(row.last_activity_at),
    closingAt: row.closing_at != null ? Number(row.closing_at) : undefined,
    closeDeadlineAt: row.close_deadline_at != null ? Number(row.close_deadline_at) : undefined,
    closedAt: row.closed_at != null ? Number(row.closed_at) : undefined,
    version: Number(row.version),
    ownerId: row.owner_id != null ? String(row.owner_id) : undefined,
    leaseExpiresAt: row.lease_expires_at != null ? Number(row.lease_expires_at) : undefined,
  };
}

function rowToSummary(row: Record<string, unknown>): SessionSummary {
  return {
    harnessName: String(row.harness_name ?? 'default'),
    id: String(row.id),
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    parentSessionId: row.parent_session_id != null ? String(row.parent_session_id) : undefined,
    origin: String(row.origin) as SessionRecord['origin'],
    modeId: String(row.mode_id),
    modelId: String(row.model_id),
    lastActivityAt: Number(row.last_activity_at),
    closingAt: row.closing_at != null ? Number(row.closing_at) : undefined,
    closeDeadlineAt: row.close_deadline_at != null ? Number(row.close_deadline_at) : undefined,
    closedAt: row.closed_at != null ? Number(row.closed_at) : undefined,
  };
}

type DeleteGuardRecord = {
  version: number;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;
  createdAt: number;
  closedAt?: number;
};

function rowToDeleteGuardRecord(row: Record<string, unknown>): DeleteGuardRecord {
  return {
    version: Number(row.version),
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    parentSessionId: row.parent_session_id == null ? undefined : String(row.parent_session_id),
    createdAt: Number(row.created_at),
    closedAt: row.closed_at == null ? undefined : Number(row.closed_at),
  };
}

function getDeleteGuardMismatch(
  record: DeleteGuardRecord,
  opts: DeleteSessionOptions,
): ConstructorParameters<typeof HarnessStorageDeleteGuardConflictError>[1] | undefined {
  if (opts.ifVersion !== undefined && record.version !== opts.ifVersion) return 'ifVersion';
  if (opts.expectedResourceId !== undefined && record.resourceId !== opts.expectedResourceId)
    return 'expectedResourceId';
  if (opts.expectedThreadId !== undefined && record.threadId !== opts.expectedThreadId) return 'expectedThreadId';
  if (opts.expectedParentSessionId !== undefined && (record.parentSessionId ?? null) !== opts.expectedParentSessionId) {
    return 'expectedParentSessionId';
  }
  if (opts.expectedCreatedAt !== undefined && record.createdAt !== opts.expectedCreatedAt) return 'expectedCreatedAt';
  if (opts.requireClosed === true && record.closedAt === undefined) return 'requireClosed';
  return undefined;
}

function parseJson(value: unknown): any {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return value;
}

function rowToAttachmentSemantic(row: Record<string, unknown>): AttachmentSemanticMetadata {
  const semantic: AttachmentSemanticMetadata = { kind: toAttachmentKind(row.kind) };
  if (row.primitive_type != null) {
    semantic.primitiveType = String(row.primitive_type) as AttachmentSemanticMetadata['primitiveType'];
  }
  if (row.element_type != null) semantic.elementType = String(row.element_type);
  if (row.renderer_json != null) semantic.renderer = parseJson(row.renderer_json);
  if (row.schema_id != null) semantic.schemaId = String(row.schema_id);
  if (row.metadata_json != null) semantic.metadata = parseJson(row.metadata_json) as Record<string, JsonValue>;
  if (row.object_json != null) semantic.object = parseJson(row.object_json);
  return semantic;
}

function toAttachmentKind(value: unknown): AttachmentSemanticMetadata['kind'] {
  if (value === 'primitive' || value === 'element' || value === 'file') return value;
  return 'file';
}

function isUniqueConstraintError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err && (err as { code?: unknown }).code === '23505') return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /duplicate key value violates unique constraint/i.test(msg);
}

function bytesToBase64(bytes: Uint8Array): string {
  // Buffer is available in Node and bun; fall back to a manual encoder elsewhere.
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return globalThis.btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = globalThis.atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function toAttachmentSource(value: unknown): AttachmentRecord['source'] {
  if (value === 'inline' || value === 'preupload' || value === 'url' || value === 'provider') {
    return value;
  }
  return 'preupload';
}

function rowToAttachmentReference(row: Record<string, unknown>): AttachmentReference {
  return {
    source: toAttachmentReferenceSource(row.source),
    sourceId: String(row.source_id),
    ...(row.retained_until == null ? {} : { retainedUntil: Number(row.retained_until) }),
  };
}

function rowToTombstone(row: Record<string, unknown>): OperationAdmissionTombstone {
  return {
    kind: String(row.kind) as OperationAdmissionTombstone['kind'],
    harnessName: String(row.harness_name),
    sessionId: String(row.session_id),
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    admissionId: row.admission_id == null ? undefined : String(row.admission_id),
    admissionHash: row.admission_hash == null ? undefined : String(row.admission_hash),
    queuedItemId: row.queued_item_id == null ? undefined : String(row.queued_item_id),
    signalId: row.signal_id == null ? undefined : String(row.signal_id),
    runId: row.run_id == null ? undefined : String(row.run_id),
    terminalAt: Number(row.terminal_at),
    compactedAt: Number(row.compacted_at),
    expiresAt: Number(row.expires_at),
  };
}

function rowToSessionEvent(row: Record<string, unknown>): HarnessSessionEventRecord {
  return {
    harnessName: String(row.harness_name),
    sessionId: String(row.session_id),
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    eventId: String(row.event_id),
    epoch: String(row.epoch),
    sequence: Number(row.sequence),
    event: parseJson(row.event) as JsonValue,
    emittedAt: Number(row.emitted_at),
    storedAt: Number(row.stored_at),
  };
}

function rowToMessageResultEvidence(row: Record<string, unknown>): AgentSignalResultEvidence {
  const base = {
    harnessName: String(row.harness_name),
    sessionId: String(row.session_id),
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    signalId: String(row.signal_id),
    ...(row.run_id == null ? {} : { runId: String(row.run_id) }),
    ...(row.admission_id == null ? {} : { admissionId: String(row.admission_id) }),
    ...(row.admission_hash == null ? {} : { admissionHash: String(row.admission_hash) }),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
  const status = String(row.status);
  if (status === 'completed') {
    const runId = completedMessageEvidenceRunId(base);
    return {
      ...base,
      status: 'completed',
      runId,
      result: parseJson(row.result),
    };
  }
  if (status === 'failed') {
    return {
      ...base,
      status: 'failed',
      error: parseJson(row.error) ?? { code: 'harness.message_failed', message: 'Message failed' },
    };
  }
  return { ...base, status: 'pending' };
}

function tombstoneId(record: OperationAdmissionTombstone): string {
  const publicId = record.kind === 'message' ? record.signalId : record.queuedItemId;
  return stableHarnessRowId([
    record.harnessName,
    record.sessionId,
    record.kind,
    publicId ?? record.admissionId ?? record.compactedAt,
  ]);
}

function messageEvidenceId(record: Pick<AgentSignalResultEvidence, 'harnessName' | 'sessionId' | 'signalId'>): string {
  return stableHarnessRowId([record.harnessName, record.sessionId, record.signalId]);
}

function stableHarnessRowId(parts: unknown[]): string {
  return createHash('sha256')
    .update(parts.map(part => String(part)).join('\u001f'))
    .digest('hex');
}

/** Completed message evidence is only useful for recovery when it preserves the runtime run id. */
function completedMessageEvidenceRunId(record: { runId?: string; sessionId: string; signalId: string }): string {
  if (record.runId !== undefined && record.runId.length > 0) return record.runId;
  throw new Error(
    `Invalid Harness message result evidence for session "${record.sessionId}" signal "${record.signalId}": completed status requires run_id`,
  );
}

function sameTombstoneIdentity(a: OperationAdmissionTombstone, b: OperationAdmissionTombstone): boolean {
  return (
    a.kind === b.kind &&
    a.harnessName === b.harnessName &&
    a.sessionId === b.sessionId &&
    a.resourceId === b.resourceId &&
    a.threadId === b.threadId &&
    a.admissionId === b.admissionId &&
    a.admissionHash === b.admissionHash &&
    a.queuedItemId === b.queuedItemId &&
    a.signalId === b.signalId &&
    a.runId === b.runId
  );
}

function sameMessageEvidenceIdentity(a: AgentSignalResultEvidence, b: AgentSignalResultEvidence): boolean {
  return (
    a.harnessName === b.harnessName &&
    a.sessionId === b.sessionId &&
    a.resourceId === b.resourceId &&
    a.threadId === b.threadId &&
    a.signalId === b.signalId &&
    a.admissionId === b.admissionId &&
    a.admissionHash === b.admissionHash
  );
}

function isTerminalMessageEvidence(record: AgentSignalResultEvidence): boolean {
  return record.status === 'completed' || record.status === 'failed';
}

function isTerminalQueueReceipt(receipt: QueueAdmissionReceipt): boolean {
  return receipt.status === 'completed' || receipt.status === 'failed' || receipt.status === 'dead';
}

function isTerminalChannelInboxStatus(status: ChannelInboxItem['status']): boolean {
  return status === 'accepted' || status === 'queued' || status === 'dead';
}

function isTerminalChannelActionReceiptStatus(status: ChannelActionReceipt['status']): boolean {
  return status === 'applied' || status === 'conflict' || status === 'dead';
}

function isTerminalChannelOutboxStatus(status: ChannelOutboxItem['status']): boolean {
  return status === 'sent' || status === 'dead';
}

function isTerminalHarnessWakeupStatus(status: HarnessWakeupItem['status']): boolean {
  return status === 'queued' || status === 'completed' || status === 'dead';
}

function isChannelInboxClaimable(item: ChannelInboxItem, now: number): boolean {
  if (isTerminalChannelInboxStatus(item.status)) return false;
  if (item.nextAttemptAt !== undefined && item.nextAttemptAt > now) return false;
  return item.claimId === undefined || item.claimExpiresAt === undefined || item.claimExpiresAt <= now;
}

function isChannelActionReceiptClaimable(receipt: ChannelActionReceipt, now: number): boolean {
  if (isTerminalChannelActionReceiptStatus(receipt.status)) return false;
  if (receipt.nextAttemptAt !== undefined && receipt.nextAttemptAt > now) return false;
  return receipt.claimId === undefined || receipt.claimExpiresAt === undefined || receipt.claimExpiresAt <= now;
}

function isHarnessWakeupClaimable(item: HarnessWakeupItem, now: number): boolean {
  if (isTerminalHarnessWakeupStatus(item.status)) return false;
  if (item.dueAt > now) return false;
  if (item.nextAttemptAt !== undefined && item.nextAttemptAt > now) return false;
  return item.claimId === undefined || item.claimExpiresAt === undefined || item.claimExpiresAt <= now;
}

function claimHarnessWakeupItem(
  item: HarnessWakeupItem,
  claimId: string,
  now: number,
  claimTtlMs: number,
): HarnessWakeupItem {
  return {
    ...item,
    status: 'claimed',
    attempts: item.attempts + 1,
    claimId,
    claimExpiresAt: now + claimTtlMs,
    claimedAt: now,
    queuedItemId: undefined,
    queuedAt: undefined,
    completedAt: undefined,
    deadAt: undefined,
    runId: undefined,
    signalId: undefined,
    result: undefined,
    nextAttemptAt: undefined,
    failedAt: undefined,
    lastError: undefined,
    updatedAt: now,
  };
}

function assertLegalChannelInboxUpdate(current: ChannelInboxItem, next: ChannelInboxItem): void {
  const immutableMismatch =
    current.id !== next.id ||
    current.harnessName !== next.harnessName ||
    current.channelId !== next.channelId ||
    current.providerId !== next.providerId ||
    current.idempotencyKey !== next.idempotencyKey ||
    current.payloadHash !== next.payloadHash ||
    current.admissionId !== next.admissionId ||
    current.externalMessageId !== next.externalMessageId ||
    current.receivedAt !== next.receivedAt;
  if (immutableMismatch) {
    throw new HarnessStorageChannelInboxTransitionError(
      current.id,
      current.status,
      next.status,
      'immutable provider identity fields cannot change',
    );
  }
  const allowed =
    current.status === next.status ||
    (current.status === 'received' &&
      (next.status === 'admitted' || next.status === 'failed' || next.status === 'dead')) ||
    (current.status === 'admitted' &&
      (next.status === 'accepted' || next.status === 'queued' || next.status === 'failed' || next.status === 'dead')) ||
    (current.status === 'failed' &&
      (next.status === 'received' || next.status === 'admitted' || next.status === 'failed' || next.status === 'dead'));
  if (!allowed || isTerminalChannelInboxStatus(current.status)) {
    throw new HarnessStorageChannelInboxTransitionError(
      current.id,
      current.status,
      next.status,
      'transition is not legal for channel inbox state machine',
    );
  }
  assertValidChannelInboxState(next, current.status);
}

function assertValidChannelInboxState(record: ChannelInboxItem, currentStatus?: ChannelInboxItem['status']): void {
  if (
    record.status === 'admitted' &&
    (record.delivery === undefined ||
      (record.delivery !== 'message' && record.delivery !== 'queue') ||
      record.admittedAt == null)
  ) {
    throw new HarnessStorageChannelInboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'admitted rows require delivery and admittedAt',
    );
  }
  if (
    record.status === 'accepted' &&
    (record.delivery !== 'message' || !record.runId || !record.signalId || record.acceptedAt == null)
  ) {
    throw new HarnessStorageChannelInboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'accepted rows require message delivery, runId, signalId, and acceptedAt',
    );
  }
  if (record.status === 'queued' && (record.delivery !== 'queue' || !record.queuedItemId || record.queuedAt == null)) {
    throw new HarnessStorageChannelInboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'queued rows require queue delivery, queuedItemId, and queuedAt',
    );
  }
  if ((record.status === 'failed' || record.status === 'dead') && record.lastError == null) {
    throw new HarnessStorageChannelInboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'failed and dead rows require lastError',
    );
  }
}

function assertLegalChannelActionReceiptUpdate(current: ChannelActionReceipt, next: ChannelActionReceipt): void {
  const immutableMismatch =
    current.id !== next.id ||
    current.harnessName !== next.harnessName ||
    current.channelId !== next.channelId ||
    current.providerId !== next.providerId ||
    current.actionTokenId !== next.actionTokenId ||
    current.actionId !== next.actionId ||
    current.bindingId !== next.bindingId ||
    current.bindingGeneration !== next.bindingGeneration ||
    current.resourceId !== next.resourceId ||
    current.owningSessionId !== next.owningSessionId ||
    current.itemId !== next.itemId ||
    current.kind !== next.kind ||
    current.runId !== next.runId ||
    current.pendingRequestedAt !== next.pendingRequestedAt ||
    stableJsonString(current.audience) !== stableJsonString(next.audience) ||
    current.responseHash !== next.responseHash;
  if (immutableMismatch) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      current.id,
      current.status,
      next.status,
      'immutable token, item, and response identity fields cannot change',
    );
  }
  const allowed =
    current.status === next.status ||
    (current.status === 'received' &&
      (next.status === 'accepted' ||
        next.status === 'failed' ||
        next.status === 'conflict' ||
        next.status === 'dead')) ||
    (current.status === 'accepted' &&
      (next.status === 'applied' || next.status === 'failed' || next.status === 'dead')) ||
    (current.status === 'failed' &&
      (next.status === 'received' || next.status === 'accepted' || next.status === 'failed' || next.status === 'dead'));
  if (!allowed || isTerminalChannelActionReceiptStatus(current.status)) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      current.id,
      current.status,
      next.status,
      'transition is not legal for channel action receipt state machine',
    );
  }
  assertValidChannelActionReceiptState(next, current.status);
}

function assertValidChannelActionReceiptState(
  record: ChannelActionReceipt,
  currentStatus?: ChannelActionReceipt['status'],
): void {
  const validStatus =
    record.status === 'received' ||
    record.status === 'accepted' ||
    record.status === 'applied' ||
    record.status === 'conflict' ||
    record.status === 'failed' ||
    record.status === 'dead';
  if (!validStatus) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      record.id,
      currentStatus,
      record.status,
      'status is not a known channel action receipt state',
    );
  }
  if (record.status === 'accepted' && record.acceptedAt == null) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      record.id,
      currentStatus,
      record.status,
      'accepted receipts require acceptedAt',
    );
  }
  if (record.status === 'applied' && (record.appliedAt == null || record.result === undefined)) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      record.id,
      currentStatus,
      record.status,
      'applied receipts require appliedAt and result',
    );
  }
  if (record.status === 'conflict' && record.conflictReason == null) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      record.id,
      currentStatus,
      record.status,
      'conflict receipts require conflictReason',
    );
  }
  if (record.status === 'failed' && (record.failedAt == null || record.lastError == null)) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      record.id,
      currentStatus,
      record.status,
      'failed receipts require failedAt and lastError',
    );
  }
  if (record.status === 'dead' && (record.deadAt == null || record.lastError == null)) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      record.id,
      currentStatus,
      record.status,
      'dead receipts require deadAt and lastError',
    );
  }
  if (
    record.conflictReason !== undefined &&
    record.conflictReason !== 'response_mismatch' &&
    record.conflictReason !== 'stale_item' &&
    record.conflictReason !== 'kind_mismatch' &&
    record.conflictReason !== 'run_mismatch' &&
    record.conflictReason !== 'binding_mismatch' &&
    record.conflictReason !== 'session_closed' &&
    record.conflictReason !== 'actor_not_allowed' &&
    record.conflictReason !== 'token_expired' &&
    record.conflictReason !== 'token_revoked'
  ) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      record.id,
      currentStatus,
      record.status,
      'conflictReason is not a known channel action receipt reason',
    );
  }
}

function assertLegalChannelOutboxUpdate(current: ChannelOutboxItem, next: ChannelOutboxItem): void {
  const immutableMismatch =
    current.id !== next.id ||
    current.harnessName !== next.harnessName ||
    current.channelId !== next.channelId ||
    current.providerId !== next.providerId ||
    current.bindingId !== next.bindingId ||
    current.bindingGeneration !== next.bindingGeneration ||
    current.idempotencyKey !== next.idempotencyKey ||
    current.payloadHash !== next.payloadHash ||
    current.resourceId !== next.resourceId ||
    current.threadId !== next.threadId ||
    current.sessionId !== next.sessionId ||
    current.owningSessionId !== next.owningSessionId ||
    stableJsonString(current.source) !== stableJsonString(next.source) ||
    stableJsonString(current.target) !== stableJsonString(next.target) ||
    current.kind !== next.kind ||
    current.operationKind !== next.operationKind ||
    current.operationName !== next.operationName ||
    stableJsonString(current.payload) !== stableJsonString(next.payload) ||
    current.deliverySemantics !== next.deliverySemantics ||
    current.createdAt !== next.createdAt;
  if (immutableMismatch) {
    throw new HarnessStorageChannelOutboxTransitionError(
      current.id,
      current.status,
      next.status,
      'immutable delivery identity fields cannot change',
    );
  }
  const allowed =
    current.status === next.status ||
    ((current.status === 'pending' || current.status === 'failed' || current.status === 'claimed') &&
      (next.status === 'claimed' || next.status === 'failed' || next.status === 'sent' || next.status === 'dead'));
  if (!allowed || isTerminalChannelOutboxStatus(current.status)) {
    throw new HarnessStorageChannelOutboxTransitionError(
      current.id,
      current.status,
      next.status,
      'transition is not legal for channel outbox state machine',
    );
  }
  assertValidChannelOutboxState(next, current.status);
}

function assertValidChannelOutboxState(record: ChannelOutboxItem, currentStatus?: ChannelOutboxItem['status']): void {
  const validStatus =
    record.status === 'pending' ||
    record.status === 'claimed' ||
    record.status === 'sent' ||
    record.status === 'failed' ||
    record.status === 'dead';
  if (!validStatus) {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'status is not a known channel outbox state',
    );
  }
  if (currentStatus === undefined && record.status !== 'pending') {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'new outbox rows must start pending',
    );
  }
  if (record.status === 'pending' && record.attempts !== 0) {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'new pending rows must start with zero attempts',
    );
  }
  if (
    record.status === 'pending' &&
    (record.claimId !== undefined ||
      record.claimExpiresAt !== undefined ||
      record.nextAttemptAt !== undefined ||
      record.sentAt !== undefined ||
      record.failedAt !== undefined ||
      record.deadAt !== undefined ||
      record.providerMessageId !== undefined ||
      record.providerReceipt !== undefined ||
      record.lastError !== undefined)
  ) {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'pending rows must not include claim, retry, terminal, provider, or error metadata',
    );
  }
  if (record.status === 'claimed' && (!record.claimId || record.claimExpiresAt == null)) {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'claimed rows require claimId and claimExpiresAt',
    );
  }
  if (record.status === 'sent' && record.sentAt == null) {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'sent rows require sentAt',
    );
  }
  if (record.status === 'failed' && (record.failedAt == null || record.lastError == null)) {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'failed rows require failedAt and lastError',
    );
  }
  if (record.status === 'dead' && (record.deadAt == null || record.lastError == null)) {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'dead rows require deadAt and lastError',
    );
  }
}

function channelInboxItemsEqual(a: ChannelInboxItem, b: ChannelInboxItem): boolean {
  const aValues = channelInboxComparableValues(a);
  const bValues = channelInboxComparableValues(b);
  return aValues.length === bValues.length && aValues.every((value, index) => Object.is(value, bValues[index]));
}

function assertLegalHarnessWakeupUpdate(current: HarnessWakeupItem, next: HarnessWakeupItem): void {
  const immutableMismatch =
    current.id !== next.id ||
    current.harnessName !== next.harnessName ||
    current.source !== next.source ||
    current.sourceId !== next.sourceId ||
    current.fireId !== next.fireId ||
    current.idempotencyKey !== next.idempotencyKey ||
    current.payloadHash !== next.payloadHash ||
    current.admissionId !== next.admissionId ||
    current.admissionHash !== next.admissionHash ||
    current.resourceId !== next.resourceId ||
    current.threadId !== next.threadId ||
    current.sessionId !== next.sessionId ||
    current.dueAt !== next.dueAt ||
    current.createdAt !== next.createdAt ||
    current.mode !== next.mode ||
    current.model !== next.model ||
    current.content !== next.content ||
    stableJsonString(current.requestContext) !== stableJsonString(next.requestContext) ||
    stableJsonString(current.attachments) !== stableJsonString(next.attachments);
  if (immutableMismatch) {
    throw new HarnessStorageWakeupTransitionError(
      current.id,
      current.status,
      next.status,
      'immutable wakeup identity fields cannot change',
    );
  }
  const allowed =
    current.status === next.status ||
    (current.status === 'due' && (next.status === 'claimed' || next.status === 'failed' || next.status === 'dead')) ||
    (current.status === 'claimed' &&
      (next.status === 'queued' ||
        next.status === 'completed' ||
        next.status === 'failed' ||
        next.status === 'dead')) ||
    (current.status === 'failed' && (next.status === 'claimed' || next.status === 'failed' || next.status === 'dead'));
  if (!allowed || isTerminalHarnessWakeupStatus(current.status)) {
    throw new HarnessStorageWakeupTransitionError(
      current.id,
      current.status,
      next.status,
      'transition is not legal for wakeup state machine',
    );
  }
  assertValidHarnessWakeupState(next, current.status);
}

function assertValidHarnessWakeupState(record: HarnessWakeupItem, currentStatus?: HarnessWakeupItem['status']): void {
  const hasClaimMetadata = record.claimId != null || record.claimExpiresAt != null || record.claimedAt != null;
  const hasQueueMetadata = record.queuedItemId != null || record.queuedAt != null;
  const hasCompletedMetadata = record.completedAt != null || record.result !== undefined;
  const hasFailedMetadata = record.failedAt != null || record.lastError != null;
  const hasDeadMetadata = record.deadAt != null;

  if (record.source !== 'schedule' && record.source !== 'proactive') {
    throw new HarnessStorageWakeupTransitionError(record.id, currentStatus, record.status, 'source is not supported');
  }
  if (
    record.status !== 'due' &&
    record.status !== 'claimed' &&
    record.status !== 'queued' &&
    record.status !== 'completed' &&
    record.status !== 'failed' &&
    record.status !== 'dead'
  ) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'status is not a known wakeup state',
    );
  }
  if (
    record.status === 'due' &&
    (hasClaimMetadata || hasQueueMetadata || hasCompletedMetadata || hasFailedMetadata || hasDeadMetadata)
  ) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'due wakeups must not include claim, queue, terminal, or error metadata',
    );
  }
  if (
    record.status === 'claimed' &&
    (record.claimId == null || record.claimExpiresAt == null || record.claimedAt == null)
  ) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'claimed wakeups require claimId, claimExpiresAt, and claimedAt',
    );
  }
  if (
    record.status === 'claimed' &&
    (hasQueueMetadata || hasCompletedMetadata || hasFailedMetadata || hasDeadMetadata)
  ) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'claimed wakeups must not include queue, terminal, or error metadata',
    );
  }
  if (record.status !== 'claimed' && hasClaimMetadata) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'only claimed wakeups may carry claim metadata',
    );
  }
  if (record.status === 'queued' && (record.queuedItemId == null || record.queuedAt == null)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'queued wakeups require queuedItemId and queuedAt',
    );
  }
  if (record.status === 'queued' && (hasCompletedMetadata || hasFailedMetadata || hasDeadMetadata)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'queued wakeups must not include terminal or error metadata',
    );
  }
  if (record.status === 'completed' && (record.completedAt == null || record.result === undefined)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'completed wakeups require completedAt and result',
    );
  }
  if (record.status === 'completed' && (hasQueueMetadata || hasFailedMetadata || hasDeadMetadata)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'completed wakeups must not include queue, error, or dead metadata',
    );
  }
  if (record.status === 'failed' && (record.failedAt == null || record.lastError == null)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'failed wakeups require failedAt and lastError',
    );
  }
  if (record.status === 'failed' && (hasQueueMetadata || hasCompletedMetadata || hasDeadMetadata)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'failed wakeups must not include queue, completed, or dead metadata',
    );
  }
  if (record.status === 'dead' && (record.deadAt == null || record.lastError == null)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'dead wakeups require deadAt and lastError',
    );
  }
  if (record.status === 'dead' && (hasQueueMetadata || hasCompletedMetadata || record.failedAt != null)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'dead wakeups must not include queue, completed, or failed metadata',
    );
  }
}

function harnessWakeupItemsEquivalentForCreate(a: HarnessWakeupItem, b: HarnessWakeupItem): boolean {
  return (
    a.harnessName === b.harnessName &&
    a.source === b.source &&
    a.sourceId === b.sourceId &&
    a.fireId === b.fireId &&
    a.idempotencyKey === b.idempotencyKey &&
    a.payloadHash === b.payloadHash &&
    a.admissionId === b.admissionId &&
    a.admissionHash === b.admissionHash &&
    a.resourceId === b.resourceId &&
    a.threadId === b.threadId &&
    a.sessionId === b.sessionId &&
    a.dueAt === b.dueAt &&
    a.mode === b.mode &&
    a.model === b.model &&
    stableJsonString(a.requestContext) === stableJsonString(b.requestContext) &&
    a.content === b.content &&
    stableJsonString(a.attachments) === stableJsonString(b.attachments)
  );
}

function channelActionTokensEquivalent(a: ChannelActionToken, b: ChannelActionToken): boolean {
  return (
    a.actionTokenId === b.actionTokenId &&
    a.harnessName === b.harnessName &&
    a.channelId === b.channelId &&
    a.providerId === b.providerId &&
    a.resourceId === b.resourceId &&
    a.owningSessionId === b.owningSessionId &&
    a.itemId === b.itemId &&
    a.kind === b.kind &&
    a.bindingId === b.bindingId &&
    a.bindingGeneration === b.bindingGeneration &&
    a.runId === b.runId &&
    a.pendingRequestedAt === b.pendingRequestedAt &&
    stableJsonString(a.audience) === stableJsonString(b.audience) &&
    a.metadataHash === b.metadataHash &&
    a.transportHash === b.transportHash &&
    a.keyId === b.keyId &&
    a.expiresAt === b.expiresAt
  );
}

function channelActionReceiptsEquivalentForCreate(a: ChannelActionReceipt, b: ChannelActionReceipt): boolean {
  return (
    a.harnessName === b.harnessName &&
    a.channelId === b.channelId &&
    a.providerId === b.providerId &&
    a.actionTokenId === b.actionTokenId &&
    a.actionId === b.actionId &&
    a.bindingId === b.bindingId &&
    a.bindingGeneration === b.bindingGeneration &&
    a.resourceId === b.resourceId &&
    a.owningSessionId === b.owningSessionId &&
    a.itemId === b.itemId &&
    a.kind === b.kind &&
    a.runId === b.runId &&
    a.pendingRequestedAt === b.pendingRequestedAt &&
    stableJsonString(a.audience) === stableJsonString(b.audience) &&
    a.responseHash === b.responseHash
  );
}

function channelActionReceiptsEqual(a: ChannelActionReceipt, b: ChannelActionReceipt): boolean {
  const aValues = channelActionReceiptComparableValues(a);
  const bValues = channelActionReceiptComparableValues(b);
  return aValues.length === bValues.length && aValues.every((value, index) => Object.is(value, bValues[index]));
}

function channelOutboxItemsEquivalentForEnqueue(a: ChannelOutboxItem, b: ChannelOutboxItem): boolean {
  return (
    a.harnessName === b.harnessName &&
    a.channelId === b.channelId &&
    a.providerId === b.providerId &&
    a.bindingId === b.bindingId &&
    a.bindingGeneration === b.bindingGeneration &&
    a.idempotencyKey === b.idempotencyKey &&
    a.resourceId === b.resourceId &&
    a.threadId === b.threadId &&
    a.sessionId === b.sessionId &&
    a.owningSessionId === b.owningSessionId &&
    stableJsonString(a.source) === stableJsonString(b.source) &&
    stableJsonString(a.target) === stableJsonString(b.target) &&
    a.kind === b.kind &&
    a.payloadHash === b.payloadHash &&
    stableJsonString(a.payload) === stableJsonString(b.payload) &&
    a.operationKind === b.operationKind &&
    a.operationName === b.operationName &&
    a.deliverySemantics === b.deliverySemantics
  );
}

function channelActionReceiptComparableValues(record: ChannelActionReceipt): unknown[] {
  return [
    record.id,
    record.harnessName,
    record.channelId,
    record.providerId,
    record.actionTokenId,
    record.actionId,
    record.bindingId,
    record.bindingGeneration,
    record.resourceId,
    record.owningSessionId,
    record.itemId,
    record.kind,
    record.runId,
    record.pendingRequestedAt,
    stableJsonString(record.audience),
    stableJsonString(record.verifiedActor),
    record.responseHash,
    stableJsonString(record.response),
    record.status,
    record.conflictReason,
    record.attempts,
    record.claimId,
    record.claimExpiresAt,
    record.nextAttemptAt,
    record.acceptedAt,
    record.appliedAt,
    record.failedAt,
    record.deadAt,
    stableJsonString(record.result),
    record.lastError ? stableJsonString(record.lastError) : undefined,
    record.createdAt,
    record.updatedAt,
  ];
}

function channelInboxComparableValues(record: ChannelInboxItem): unknown[] {
  return [
    record.id,
    record.harnessName,
    record.channelId,
    record.providerId,
    record.idempotencyKey,
    record.payloadHash,
    record.admissionHash,
    record.admissionId,
    record.bindingId,
    record.resourceId,
    record.threadId,
    record.sessionId,
    record.runId,
    record.signalId,
    record.queuedItemId,
    record.externalMessageId,
    record.receivedAt,
    record.admittedAt,
    record.acceptedAt,
    record.queuedAt,
    record.failedAt,
    record.deadAt,
    record.updatedAt,
    record.status,
    record.delivery,
    record.mode,
    record.model,
    record.attempts,
    record.claimId,
    record.claimExpiresAt,
    record.nextAttemptAt,
    stableJsonString(record.requestContext),
    record.content,
    stableJsonString(record.attachments),
    record.lastError ? stableJsonString(record.lastError) : undefined,
  ];
}

function stableJsonString(value: unknown): string {
  return JSON.stringify(canonicalJsonValue(value));
}

function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonicalJsonValue(entry)]),
    );
  }
  return value;
}

function toAttachmentReferenceSource(value: unknown): AttachmentReference['source'] {
  if (
    value === 'queued_item' ||
    value === 'queue_receipt' ||
    value === 'current_run' ||
    value === 'message_history' ||
    value === 'channel_inbox' ||
    value === 'wakeup' ||
    value === 'outbox'
  ) {
    return value;
  }
  return 'queued_item';
}
