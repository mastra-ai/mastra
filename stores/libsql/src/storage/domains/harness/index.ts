import { createHash } from 'node:crypto';

import type { Client } from '@libsql/client';
import {
  HarnessStorage,
  HarnessStorageAdmissionConflictError,
  HarnessStorageAttachmentInUseError,
  HarnessStorageAttachmentUnavailableError,
  HarnessStorageLeaseConflictError,
  HarnessStorageParentSessionUnavailableError,
  HarnessStorageSessionNotFoundError,
  HarnessStorageThreadDeleteFenceConflictError,
  HarnessStorageVersionConflictError,
  TABLE_CONFIGS,
  TABLE_HARNESS_ATTACHMENT_REFERENCES,
  TABLE_HARNESS_ATTACHMENTS,
  TABLE_HARNESS_MESSAGE_RESULTS,
  TABLE_HARNESS_OPERATION_TOMBSTONES,
  TABLE_HARNESS_SESSIONS,
  TABLE_HARNESS_THREAD_DELETE_FENCES,
  TABLE_SCHEMAS,
  getSqlType,
} from '@mastra/core/storage';
import type {
  AcquireSessionLeaseInput,
  AgentSignalResultEvidence,
  AgentSignalResultStatus,
  AttachmentReference,
  AttachmentRecord,
  CreateOrLoadActiveSessionOptions,
  CreateOrLoadActiveSessionResult,
  ListActiveSessionsByThreadInput,
  ListSessionsByThreadInput,
  ListSessionsInput,
  LoadedAttachment,
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
  StorageColumn,
  ThreadDeleteFenceLease,
  WithThreadDeleteFenceInput,
} from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';

/**
 * LibSQL `HarnessStorage` adapter.
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
export class HarnessLibSQL extends HarnessStorage {
  #db: LibSQLDB;
  #client: Client;
  #harnessName: string;
  #compactionLocks = new Map<string, Promise<void>>();
  #localThreadDeleteFences = new Map<string, { ownerId: string; ttlMs: number }>();

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#harnessName = (config as LibSQLDomainConfig & { harnessName?: string }).harnessName ?? 'default';
    this.#db = new LibSQLDB({
      client,
      maxRetries: config.maxRetries,
      initialBackoffMs: config.initialBackoffMs,
    });
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
      ifNotExists: ['harness_name', 'sha256', 'source'],
    });
    await this.#db.alterTable({
      tableName: TABLE_HARNESS_ATTACHMENT_REFERENCES,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_ATTACHMENT_REFERENCES],
      ifNotExists: ['harness_name'],
    });
    await this.#backfillHarnessNamespace();
    await this.#assertNoDuplicateActiveSessions();
    await this.#backfillAttachmentMetadata();
    await this.#ensureHarnessPrimaryKeys();
    await this.#client.execute({
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_harness_sessions_active_key
            ON "${TABLE_HARNESS_SESSIONS}" ("harness_name", "resource_id", "thread_id")
            WHERE "closed_at" IS NULL`,
      args: [],
    });
    await this.#client.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_harness_sessions_thread_scope
            ON "${TABLE_HARNESS_SESSIONS}" ("harness_name", "resource_id", "thread_id", "last_activity_at")`,
      args: [],
    });
    await this.#client.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_harness_sessions_thread_global
            ON "${TABLE_HARNESS_SESSIONS}" ("thread_id", "last_activity_at")`,
      args: [],
    });
    await this.#client.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_harness_sessions_active_thread
            ON "${TABLE_HARNESS_SESSIONS}" ("harness_name", "thread_id", "last_activity_at")
            WHERE "closed_at" IS NULL`,
      args: [],
    });
    await this.#client.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_harness_sessions_active_thread_global
            ON "${TABLE_HARNESS_SESSIONS}" ("thread_id", "last_activity_at")
            WHERE "closed_at" IS NULL`,
      args: [],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#ensureMessageResultsTable();
    await this.#ensureOperationTombstonesTable();
    await this.#ensureThreadDeleteFencesTable();
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_ATTACHMENT_REFERENCES}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_ATTACHMENTS}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_MESSAGE_RESULTS}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_OPERATION_TOMBSTONES}`);
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
    for (;;) {
      const now = Date.now();
      const expiresAt = now + ttlMs;
      await this.#client.execute({
        sql: `DELETE FROM ${TABLE_HARNESS_THREAD_DELETE_FENCES}
              WHERE expires_at <= ?`,
        args: [now],
      });
      const result = await this.#client.execute({
        sql: `INSERT INTO ${TABLE_HARNESS_THREAD_DELETE_FENCES}
                (thread_id, owner_id, created_at, expires_at)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(thread_id) DO UPDATE SET
                owner_id = excluded.owner_id,
                created_at = excluded.created_at,
                expires_at = excluded.expires_at
              WHERE ${TABLE_HARNESS_THREAD_DELETE_FENCES}.expires_at <= ?`,
        args: [threadId, ownerId, now, expiresAt, now],
      });
      if (result.rowsAffected !== 0) break;
      const existing = await this.#client.execute({
        sql: `SELECT owner_id FROM ${TABLE_HARNESS_THREAD_DELETE_FENCES}
              WHERE thread_id = ? AND expires_at > ?
              LIMIT 1`,
        args: [threadId, now],
      });
      const existingOwnerId = (existing.rows[0] as any)?.owner_id as string | undefined;
      if (existingOwnerId === undefined) continue;
      throw new HarnessStorageThreadDeleteFenceConflictError(threadId, existingOwnerId);
    }
    this.#localThreadDeleteFences.set(threadId, { ownerId, ttlMs });
    const renewalIntervalMs = Math.max(1, Math.floor(ttlMs / 3));
    let renewals = Promise.resolve();
    let renewalFailure: unknown;
    const renewal = setInterval(() => {
      renewals = renewals
        .catch(err => {
          renewalFailure ??= err;
        })
        .then(async () => {
          await this.#renewLocalThreadDeleteFence(threadId);
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
      await this.#renewLocalThreadDeleteFence(threadId);
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
      if (localFence?.ownerId === ownerId) {
        this.#localThreadDeleteFences.delete(threadId);
      }
      await this.#client.execute({
        sql: `DELETE FROM ${TABLE_HARNESS_THREAD_DELETE_FENCES}
              WHERE thread_id = ? AND owner_id = ?`,
        args: [threadId, ownerId],
      });
    }
  }

  async #renewLocalThreadDeleteFence(threadId: string): Promise<void> {
    const fence = this.#localThreadDeleteFences.get(threadId);
    if (!fence) return;
    const now = Date.now();
    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_THREAD_DELETE_FENCES}
            SET expires_at = ?
            WHERE thread_id = ? AND owner_id = ? AND expires_at > ?`,
      args: [now + fence.ttlMs, threadId, fence.ownerId, now],
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
                LIMIT 1`,
          args: [harnessName, ref.sessionId, ref.attachmentId],
        });
        if (attachment.rows.length === 0) {
          throw new HarnessStorageAttachmentUnavailableError(ref.sessionId, ref.attachmentId);
        }
        await tx.execute({
          sql: `INSERT INTO ${TABLE_HARNESS_ATTACHMENT_REFERENCES}
                (harness_name, session_id, attachment_id, source, source_id, retained_until, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT DO UPDATE SET
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
    const storageNow = Date.now();
    const tx = await this.#client.transaction('write');
    try {
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

  async deleteSession({ sessionId, harnessName }: { sessionId: string; harnessName?: string }): Promise<void> {
    const namespace = this.#resolveHarnessName(harnessName);
    const existing = await this.loadSession({ harnessName: namespace, sessionId });
    if (existing) {
      await this.deleteOperationAdmissionTombstonesForSession({
        harnessName: namespace,
        sessionId,
        resourceId: existing.resourceId,
      });
    }
    await this.#client.execute({
      sql: `DELETE FROM ${TABLE_HARNESS_ATTACHMENT_REFERENCES}
            WHERE harness_name = ? AND session_id = ?`,
      args: [namespace, sessionId],
    });
    // Cascade attachments first; we don't rely on FK cascades because the
    // schema deliberately doesn't declare a FK (sessions can be hard-deleted
    // independently of how attachments were uploaded).
    await this.deleteAttachmentsForSession({ harnessName: namespace, sessionId });
    await this.#client.execute({
      sql: `DELETE FROM ${TABLE_HARNESS_SESSIONS} WHERE harness_name = ? AND id = ?`,
      args: [namespace, sessionId],
    });
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
  }: SaveAttachmentInput): Promise<SaveAttachmentResult> {
    const namespace = this.#resolveHarnessName(harnessName);
    const sha256 = sha256Hex(data);
    const bytes = data.byteLength;
    const dataB64 = bytesToBase64(data);
    await this.#client.execute({
      sql: `INSERT INTO ${TABLE_HARNESS_ATTACHMENTS}
            (harness_name, session_id, attachment_id, name, mime_type, size_bytes, sha256, source, created_at, data_b64)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT DO UPDATE SET
              name = excluded.name,
              mime_type = excluded.mime_type,
              size_bytes = excluded.size_bytes,
              sha256 = excluded.sha256,
              source = excluded.source,
              created_at = excluded.created_at,
              data_b64 = excluded.data_b64`,
      args: [namespace, sessionId, attachmentId, name, mimeType, bytes, sha256, source, Date.now(), dataB64],
    });
    return { attachmentId, bytes, sha256 };
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
      sql: `SELECT name, mime_type, size_bytes, sha256, data_b64 FROM ${TABLE_HARNESS_ATTACHMENTS}
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
      sql: `SELECT session_id, attachment_id, name, mime_type, size_bytes, sha256, source, created_at
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
      createdAt: Number(row.created_at),
    };
  }

  async recordAttachmentReferences(references: SaveAttachmentReferenceInput[]): Promise<void> {
    const createdAt = Date.now();
    for (const ref of references) {
      await this.#client.execute({
        sql: `INSERT INTO ${TABLE_HARNESS_ATTACHMENT_REFERENCES}
              (harness_name, session_id, attachment_id, source, source_id, retained_until, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT DO UPDATE SET
                retained_until = excluded.retained_until`,
        args: [
          this.#resolveHarnessName(ref.harnessName),
          ref.sessionId,
          ref.attachmentId,
          ref.source,
          ref.sourceId,
          ref.retainedUntil ?? null,
          createdAt,
        ],
      });
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

  async writeMessageResultEvidence(record: AgentSignalResultEvidence): Promise<{ created: boolean }> {
    await this.#ensureMessageResultsTable();
    const namespacedRecord = { ...record, harnessName: this.#resolveHarnessName(record.harnessName) };
    const id = messageEvidenceId(namespacedRecord);
    const loadCurrent = async () => {
      const current = await this.loadMessageResultEvidence({
        harnessName: namespacedRecord.harnessName,
        sessionId: namespacedRecord.sessionId,
        resourceId: namespacedRecord.resourceId,
        threadId: namespacedRecord.threadId,
        signalId: namespacedRecord.signalId,
      });
      return current && 'status' in current ? current : null;
    };
    const tx = await this.#client.transaction('write');
    let created = false;
    try {
      const existing = await tx.execute({
        sql: `SELECT * FROM ${TABLE_HARNESS_MESSAGE_RESULTS} WHERE id = ? LIMIT 1`,
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
          return { created: false };
        }
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
          return { created: false };
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

  async resolveOperationAdmissionEvidence({
    harnessName,
    sessionId,
    resourceId,
    kind,
    admissionId,
    attemptedAdmissionHash,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
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
      const retained = await this.#client.execute({
        sql: `SELECT * FROM ${TABLE_HARNESS_MESSAGE_RESULTS}
              WHERE harness_name = ? AND session_id = ? AND resource_id = ?
                AND admission_id = ?
              LIMIT 1`,
        args: [namespace, sessionId, resourceId, admissionId],
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
      if (session && session.resourceId !== resourceId) return { status: 'none' };
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

    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_OPERATION_TOMBSTONES}
            WHERE harness_name = ? AND session_id = ? AND resource_id = ?
              AND kind = ? AND admission_id = ?
            LIMIT 1`,
      args: [namespace, sessionId, resourceId, kind, admissionId],
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
        const originalReceiptJson = row.queue_admission_receipts == null ? null : String(row.queue_admission_receipts);
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
      throw new Error(`Harness LibSQL compaction for session "${sessionId}" conflicted after retries`);
    });
  }

  async deleteOperationAdmissionTombstonesForSession({
    harnessName,
    sessionId,
    resourceId,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
  }): Promise<void> {
    await this.#ensureMessageResultsTable();
    await this.#client.execute({
      sql: `DELETE FROM ${TABLE_HARNESS_MESSAGE_RESULTS}
            WHERE harness_name = ? AND session_id = ? AND resource_id = ?`,
      args: [this.#resolveHarnessName(harnessName), sessionId, resourceId],
    });
    await this.#client.execute({
      sql: `DELETE FROM ${TABLE_HARNESS_OPERATION_TOMBSTONES}
            WHERE harness_name = ? AND session_id = ? AND resource_id = ?`,
      args: [this.#resolveHarnessName(harnessName), sessionId, resourceId],
    });
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

  async #ensureThreadDeleteFencesTable(): Promise<void> {
    const threadDeleteFencesConfig = TABLE_CONFIGS[TABLE_HARNESS_THREAD_DELETE_FENCES];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_THREAD_DELETE_FENCES,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_THREAD_DELETE_FENCES],
      compositePrimaryKey: threadDeleteFencesConfig?.compositePrimaryKey,
    });
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

  async #ensureHarnessPrimaryKeys(): Promise<void> {
    await this.#rebuildTableIfPrimaryKeyMismatch(TABLE_HARNESS_SESSIONS, ['harness_name', 'id']);
    await this.#rebuildTableIfPrimaryKeyMismatch(TABLE_HARNESS_ATTACHMENTS, [
      'harness_name',
      'session_id',
      'attachment_id',
    ]);
    await this.#rebuildTableIfPrimaryKeyMismatch(TABLE_HARNESS_ATTACHMENT_REFERENCES, [
      'harness_name',
      'session_id',
      'attachment_id',
      'source',
      'source_id',
    ]);
  }

  async #rebuildTableIfPrimaryKeyMismatch(tableName: string, primaryKey: string[]): Promise<void> {
    const currentPrimaryKey = await this.#primaryKeyColumns(tableName);
    if (arraysEqual(currentPrimaryKey, primaryKey)) return;

    // createTable() plus the alterTable() calls in init() must bring managed
    // Harness tables to the current column set before this PK-only rebuild.
    const schema = TABLE_SCHEMAS[tableName as keyof typeof TABLE_SCHEMAS];
    const tempTableName = `__${tableName}_pf442_rebuild`;
    const columns = Object.keys(schema);
    const quotedColumns = columns.map(quoteIdentifier).join(', ');

    await this.#client.batch(
      [
        { sql: `DROP TABLE IF EXISTS ${quoteIdentifier(tempTableName)}`, args: [] },
        { sql: buildCreateTableSql(tempTableName, schema, primaryKey), args: [] },
        {
          sql: `INSERT INTO ${quoteIdentifier(tempTableName)} (${quotedColumns})
                SELECT ${quotedColumns} FROM ${quoteIdentifier(tableName)}`,
          args: [],
        },
        { sql: `DROP TABLE ${quoteIdentifier(tableName)}`, args: [] },
        {
          sql: `ALTER TABLE ${quoteIdentifier(tempTableName)} RENAME TO ${quoteIdentifier(tableName)}`,
          args: [],
        },
      ],
      'write',
    );
  }

  async #primaryKeyColumns(tableName: string): Promise<string[]> {
    const result = await this.#client.execute({
      sql: `PRAGMA table_info(${quoteIdentifier(tableName)})`,
      args: [],
    });
    return result.rows
      .map(row => ({ name: String(row.name), order: Number(row.pk ?? 0) }))
      .filter(row => row.order > 0)
      .sort((a, b) => a.order - b.order)
      .map(row => row.name);
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
    record.ownsThread ? 1 : 0,
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

function isUniqueConstraintError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /UNIQUE constraint failed|SQLITE_CONSTRAINT_PRIMARYKEY|SQLITE_CONSTRAINT_UNIQUE/i.test(msg);
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
    return {
      ...base,
      status: 'completed',
      runId: base.runId ?? '',
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
  return `${record.harnessName}\u0000${record.sessionId}\u0000${record.kind}\u0000${publicId ?? record.admissionId ?? record.compactedAt}`;
}

function messageEvidenceId(record: Pick<AgentSignalResultEvidence, 'harnessName' | 'sessionId' | 'signalId'>): string {
  return `${record.harnessName}\u0000${record.sessionId}\u0000${record.signalId}`;
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

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function buildCreateTableSql(
  tableName: string,
  schema: Record<string, StorageColumn>,
  compositePrimaryKey: string[],
): string {
  const compositePrimaryKeySet = new Set(compositePrimaryKey);
  const columnDefinitions = Object.entries(schema).map(([columnName, column]) => {
    const parts = [
      quoteIdentifier(columnName),
      getSqlType(column.type),
      column.nullable === false ? 'NOT NULL' : '',
      column.primaryKey && !compositePrimaryKeySet.has(columnName) ? 'PRIMARY KEY' : '',
    ].filter(Boolean);
    return parts.join(' ');
  });
  const primaryKey = `PRIMARY KEY (${compositePrimaryKey.map(quoteIdentifier).join(', ')})`;
  return `CREATE TABLE ${quoteIdentifier(tableName)} (\n  ${[...columnDefinitions, primaryKey].join(',\n  ')}\n)`;
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
