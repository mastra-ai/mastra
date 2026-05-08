import type { Client } from '@libsql/client';
import {
  HarnessStorage,
  HarnessStorageLeaseConflictError,
  HarnessStorageSessionNotFoundError,
  HarnessStorageVersionConflictError,
  TABLE_CONFIGS,
  TABLE_HARNESS_ATTACHMENTS,
  TABLE_HARNESS_SESSIONS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  AcquireSessionLeaseInput,
  AttachmentRecord,
  ListSessionsInput,
  LoadedAttachment,
  ReleaseSessionLeaseInput,
  RenewSessionLeaseInput,
  SaveAttachmentInput,
  SaveSessionOptions,
  SaveSessionResult,
  SessionLeaseResult,
  SessionRecord,
  SessionSummary,
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
 * key on `(session_id, attachment_id)`. Bytes are stored base64-encoded in
 * `data_b64` for now; see the schema comment in core for the rationale.
 */
export class HarnessLibSQL extends HarnessStorage {
  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({
      client,
      maxRetries: config.maxRetries,
      initialBackoffMs: config.initialBackoffMs,
    });
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_HARNESS_SESSIONS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_SESSIONS],
    });
    const attachmentsConfig = TABLE_CONFIGS[TABLE_HARNESS_ATTACHMENTS];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_ATTACHMENTS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_ATTACHMENTS],
      compositePrimaryKey: attachmentsConfig?.compositePrimaryKey,
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_ATTACHMENTS}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_SESSIONS}`);
  }

  // -------------------------------------------------------------------------
  // Session records
  // -------------------------------------------------------------------------

  async loadSession({ sessionId }: { sessionId: string }): Promise<SessionRecord | null> {
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_SESSIONS} WHERE id = ?`,
      args: [sessionId],
    });
    const row = result.rows[0];
    return row ? rowToSession(row as Record<string, unknown>) : null;
  }

  async loadSessionByThread({
    threadId,
    resourceId,
  }: {
    threadId: string;
    resourceId: string;
  }): Promise<SessionRecord | null> {
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_SESSIONS}
            WHERE thread_id = ? AND resource_id = ? AND closed_at IS NULL
            ORDER BY last_activity_at DESC
            LIMIT 1`,
      args: [threadId, resourceId],
    });
    const row = result.rows[0];
    return row ? rowToSession(row as Record<string, unknown>) : null;
  }

  async listSessions({
    resourceId,
    includeClosed = false,
    parentSessionId,
  }: ListSessionsInput): Promise<SessionSummary[]> {
    const conditions: string[] = ['resource_id = ?'];
    const args: (string | number)[] = [resourceId];

    if (!includeClosed) conditions.push('closed_at IS NULL');
    if (parentSessionId !== undefined) {
      conditions.push('parent_session_id = ?');
      args.push(parentSessionId);
    }

    const result = await this.#client.execute({
      sql: `SELECT id, resource_id, thread_id, parent_session_id, origin, mode_id, model_id,
                   last_activity_at, closed_at
            FROM ${TABLE_HARNESS_SESSIONS}
            WHERE ${conditions.join(' AND ')}
            ORDER BY last_activity_at DESC`,
      args,
    });

    return result.rows.map(row => rowToSummary(row as Record<string, unknown>));
  }

  async saveSession(record: SessionRecord, opts: SaveSessionOptions): Promise<SaveSessionResult> {
    const nextVersion = opts.ifVersion + 1;
    const cols = sessionColumnValues(record, nextVersion);

    if (opts.ifVersion === 0) {
      // First insert. Race with another writer is caught by the PRIMARY KEY
      // constraint — translate that into the same conflict error.
      try {
        await this.#client.execute({
          sql: `INSERT INTO ${TABLE_HARNESS_SESSIONS}
                (${cols.names.join(', ')})
                VALUES (${cols.names.map(() => '?').join(', ')})`,
          args: cols.values,
        });
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          const existing = await this.loadSession({ sessionId: record.id });
          throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, existing?.version ?? 0);
        }
        throw err;
      }
      return { version: nextVersion };
    }

    // Update path. Single statement does both the lease check and the CAS so
    // two concurrent writers cannot both succeed on the same predecessor.
    // We exclude owner_id and lease_expires_at from the update set — those
    // belong to the lease lifecycle methods.
    const updateNames = cols.names.filter(n => n !== 'owner_id' && n !== 'lease_expires_at' && n !== 'id');
    const updateValues = updateNames.map(n => cols.values[cols.names.indexOf(n)]);

    const setClause = updateNames.map(n => `${n} = ?`).join(', ');
    const updateResult = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
            SET ${setClause}
            WHERE id = ?
              AND version = ?
              AND (
                owner_id IS NULL
                OR lease_expires_at IS NULL
                OR lease_expires_at <= ?
                OR owner_id = ?
              )`,
      args: [...updateValues, record.id, opts.ifVersion, Date.now(), opts.ownerId],
    });

    if (updateResult.rowsAffected === 0) {
      // Distinguish lease conflict from version conflict by re-reading the row.
      const existing = await this.loadSession({ sessionId: record.id });
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

  async deleteSession({ sessionId }: { sessionId: string }): Promise<void> {
    // Cascade attachments first; we don't rely on FK cascades because the
    // schema deliberately doesn't declare a FK (sessions can be hard-deleted
    // independently of how attachments were uploaded).
    await this.deleteAttachmentsForSession({ sessionId });
    await this.#client.execute({
      sql: `DELETE FROM ${TABLE_HARNESS_SESSIONS} WHERE id = ?`,
      args: [sessionId],
    });
  }

  // -------------------------------------------------------------------------
  // Session leases
  // -------------------------------------------------------------------------

  async acquireSessionLease({ sessionId, ownerId, ttlMs }: AcquireSessionLeaseInput): Promise<SessionLeaseResult> {
    const now = Date.now();
    const expiresAt = now + ttlMs;

    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
            SET owner_id = ?, lease_expires_at = ?
            WHERE id = ?
              AND (
                owner_id IS NULL
                OR lease_expires_at IS NULL
                OR lease_expires_at <= ?
                OR owner_id = ?
              )
            RETURNING version`,
      args: [ownerId, expiresAt, sessionId, now, ownerId],
    });

    if (result.rows.length === 0) {
      const existing = await this.loadSession({ sessionId });
      if (!existing) throw new HarnessStorageSessionNotFoundError(sessionId);
      throw new HarnessStorageLeaseConflictError(
        sessionId,
        existing.ownerId ?? '<unowned>',
        existing.leaseExpiresAt ?? 0,
      );
    }

    return { version: Number(result.rows[0]!.version), expiresAt };
  }

  async renewSessionLease({ sessionId, ownerId, ttlMs }: RenewSessionLeaseInput): Promise<SessionLeaseResult> {
    const now = Date.now();
    const expiresAt = now + ttlMs;

    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
            SET lease_expires_at = ?
            WHERE id = ?
              AND owner_id = ?
              AND lease_expires_at IS NOT NULL
              AND lease_expires_at > ?
            RETURNING version`,
      args: [expiresAt, sessionId, ownerId, now],
    });

    if (result.rows.length === 0) {
      const existing = await this.loadSession({ sessionId });
      if (!existing) throw new HarnessStorageSessionNotFoundError(sessionId);
      throw new HarnessStorageLeaseConflictError(
        sessionId,
        existing.ownerId ?? '<unowned>',
        existing.leaseExpiresAt ?? 0,
      );
    }

    return { version: Number(result.rows[0]!.version), expiresAt };
  }

  async releaseSessionLease({ sessionId, ownerId }: ReleaseSessionLeaseInput): Promise<void> {
    const exists = await this.#client.execute({
      sql: `SELECT 1 FROM ${TABLE_HARNESS_SESSIONS} WHERE id = ? LIMIT 1`,
      args: [sessionId],
    });
    if (exists.rows.length === 0) {
      throw new HarnessStorageSessionNotFoundError(sessionId);
    }

    // No-op if we're not the current owner.
    await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
            SET owner_id = NULL, lease_expires_at = NULL
            WHERE id = ? AND owner_id = ?`,
      args: [sessionId, ownerId],
    });
  }

  // -------------------------------------------------------------------------
  // Attachments
  // -------------------------------------------------------------------------

  async saveAttachment({ sessionId, attachmentId, name, mimeType, data }: SaveAttachmentInput): Promise<void> {
    const dataB64 = bytesToBase64(data);
    await this.#client.execute({
      sql: `INSERT INTO ${TABLE_HARNESS_ATTACHMENTS}
            (session_id, attachment_id, name, mime_type, size_bytes, created_at, data_b64)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id, attachment_id) DO UPDATE SET
              name = excluded.name,
              mime_type = excluded.mime_type,
              size_bytes = excluded.size_bytes,
              created_at = excluded.created_at,
              data_b64 = excluded.data_b64`,
      args: [sessionId, attachmentId, name, mimeType, data.byteLength, Date.now(), dataB64],
    });
  }

  async loadAttachment({
    sessionId,
    attachmentId,
  }: {
    sessionId: string;
    attachmentId: string;
  }): Promise<LoadedAttachment | null> {
    const result = await this.#client.execute({
      sql: `SELECT name, mime_type, data_b64 FROM ${TABLE_HARNESS_ATTACHMENTS}
            WHERE session_id = ? AND attachment_id = ?`,
      args: [sessionId, attachmentId],
    });
    const row = result.rows[0];
    if (!row) return null;
    return {
      name: String(row.name),
      mimeType: String(row.mime_type),
      data: base64ToBytes(String(row.data_b64)),
    };
  }

  async deleteAttachment({ sessionId, attachmentId }: { sessionId: string; attachmentId: string }): Promise<void> {
    await this.#client.execute({
      sql: `DELETE FROM ${TABLE_HARNESS_ATTACHMENTS}
            WHERE session_id = ? AND attachment_id = ?`,
      args: [sessionId, attachmentId],
    });
  }

  async deleteAttachmentsForSession({ sessionId }: { sessionId: string }): Promise<void> {
    await this.#client.execute({
      sql: `DELETE FROM ${TABLE_HARNESS_ATTACHMENTS} WHERE session_id = ?`,
      args: [sessionId],
    });
  }

  async getAttachmentRecord({
    sessionId,
    attachmentId,
  }: {
    sessionId: string;
    attachmentId: string;
  }): Promise<AttachmentRecord | null> {
    const result = await this.#client.execute({
      sql: `SELECT session_id, attachment_id, name, mime_type, size_bytes, created_at
            FROM ${TABLE_HARNESS_ATTACHMENTS}
            WHERE session_id = ? AND attachment_id = ?`,
      args: [sessionId, attachmentId],
    });
    const row = result.rows[0];
    if (!row) return null;
    return {
      sessionId: String(row.session_id),
      attachmentId: String(row.attachment_id),
      name: String(row.name),
      mimeType: String(row.mime_type),
      sizeBytes: Number(row.size_bytes),
      createdAt: Number(row.created_at),
    };
  }
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

const SESSION_COLUMN_NAMES = [
  'id',
  'resource_id',
  'thread_id',
  'parent_session_id',
  'origin',
  'owns_thread',
  'mode_id',
  'model_id',
  'subagent_model_overrides',
  'permission_rules',
  'session_grants',
  'token_usage',
  'pending_queue',
  'pending_approval',
  'pending_suspension',
  'pending_question',
  'pending_plan',
  'observational_memory',
  'goal',
  'workspace',
  'state',
  'created_at',
  'last_activity_at',
  'closed_at',
  'version',
] as const;

function sessionColumnValues(record: SessionRecord, version: number): { names: string[]; values: any[] } {
  const values = [
    record.id,
    record.resourceId,
    record.threadId,
    record.parentSessionId ?? null,
    record.origin,
    record.ownsThread ? 1 : 0,
    record.modeId,
    record.modelId,
    JSON.stringify(record.subagentModelOverrides ?? {}),
    JSON.stringify(record.permissionRules),
    JSON.stringify(record.sessionGrants),
    JSON.stringify(record.tokenUsage),
    JSON.stringify(record.pendingQueue),
    record.pendingApproval ? JSON.stringify(record.pendingApproval) : null,
    record.pendingSuspension ? JSON.stringify(record.pendingSuspension) : null,
    record.pendingQuestion ? JSON.stringify(record.pendingQuestion) : null,
    record.pendingPlan ? JSON.stringify(record.pendingPlan) : null,
    record.observationalMemory ? JSON.stringify(record.observationalMemory) : null,
    record.goal ? JSON.stringify(record.goal) : null,
    record.workspace ? JSON.stringify(record.workspace) : null,
    JSON.stringify(record.state ?? {}),
    record.createdAt,
    record.lastActivityAt,
    record.closedAt ?? null,
    version,
  ];
  return { names: [...SESSION_COLUMN_NAMES], values };
}

function rowToSession(row: Record<string, unknown>): SessionRecord {
  return {
    id: String(row.id),
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    parentSessionId: row.parent_session_id != null ? String(row.parent_session_id) : undefined,
    origin: String(row.origin) as SessionRecord['origin'],
    ownsThread: Number(row.owns_thread) === 1,
    modeId: String(row.mode_id),
    modelId: String(row.model_id),
    subagentModelOverrides: parseJson(row.subagent_model_overrides) ?? {},
    permissionRules: parseJson(row.permission_rules) ?? { categories: {}, tools: {} },
    sessionGrants: parseJson(row.session_grants) ?? { categories: [], tools: [] },
    tokenUsage: parseJson(row.token_usage) ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    pendingQueue: parseJson(row.pending_queue) ?? [],
    pendingApproval: parseJson(row.pending_approval) ?? undefined,
    pendingSuspension: parseJson(row.pending_suspension) ?? undefined,
    pendingQuestion: parseJson(row.pending_question) ?? undefined,
    pendingPlan: parseJson(row.pending_plan) ?? undefined,
    observationalMemory: parseJson(row.observational_memory) ?? undefined,
    goal: parseJson(row.goal) ?? undefined,
    workspace: parseJson(row.workspace) ?? undefined,
    state: parseJson(row.state) ?? {},
    createdAt: Number(row.created_at),
    lastActivityAt: Number(row.last_activity_at),
    closedAt: row.closed_at != null ? Number(row.closed_at) : undefined,
    version: Number(row.version),
    ownerId: row.owner_id != null ? String(row.owner_id) : undefined,
    leaseExpiresAt: row.lease_expires_at != null ? Number(row.lease_expires_at) : undefined,
  };
}

function rowToSummary(row: Record<string, unknown>): SessionSummary {
  return {
    id: String(row.id),
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    parentSessionId: row.parent_session_id != null ? String(row.parent_session_id) : undefined,
    origin: String(row.origin) as SessionRecord['origin'],
    modeId: String(row.mode_id),
    modelId: String(row.model_id),
    lastActivityAt: Number(row.last_activity_at),
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
