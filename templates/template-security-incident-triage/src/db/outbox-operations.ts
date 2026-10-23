import { createHash } from 'node:crypto';

import { DomainError } from '../domain/errors.js';
import { DomainEventSchema, type DomainEvent } from '../schemas/domain-event.js';
import type { OperationalStore, SqlResult } from './operational-store.js';

export type ClaimedOutboxEvent =
  | Readonly<{
      valid: true;
      event: DomainEvent;
      leaseToken: string;
      attemptCount: number;
    }>
  | Readonly<{
      valid: false;
      id: string;
      leaseToken: string;
      attemptCount: number;
    }>;

export async function claimOutboxBatch(
  store: OperationalStore,
  input: Readonly<{ now: string; leaseUntil: string; limit: number }>,
): Promise<readonly ClaimedOutboxEvent[]> {
  return store.transaction(async tx => {
    const result = await tx.execute({
      sql: `UPDATE outbox_events SET available_at = ?
        WHERE id IN (
          SELECT o.id FROM outbox_events o
          WHERE o.published_at IS NULL AND o.available_at <= ?
            AND NOT EXISTS (
              SELECT 1 FROM dead_letter_events d
              WHERE d.source_outbox_id = o.id AND d.resolved_at IS NULL
            )
          ORDER BY o.occurred_at, o.id LIMIT ?
        ) AND published_at IS NULL AND available_at <= ?
        RETURNING *`,
      args: [input.leaseUntil, input.now, input.limit, input.now],
    });
    return result.rows.map(row => claimedFromRow(row, input.leaseUntil));
  });
}

export async function markOutboxPublished(
  store: OperationalStore,
  input: Readonly<{ id: string; leaseToken: string; publishedAt: string }>,
): Promise<boolean> {
  const result = await store.execute({
    sql: `UPDATE outbox_events SET published_at = ?, error_code = NULL
      WHERE id = ? AND published_at IS NULL AND available_at = ?`,
    args: [input.publishedAt, input.id, input.leaseToken],
  });
  return result.rowsAffected === 1;
}

export async function recordOutboxFailure(
  store: OperationalStore,
  input: Readonly<{
    id: string;
    leaseToken: string;
    now: string;
    errorCode: 'PUBSUB_UNAVAILABLE' | 'EVENT_INVALID';
    maxAttempts: number;
    backoffBaseMs: number;
    backoffCapMs: number;
  }>,
): Promise<'retry' | 'dead_letter' | 'fence_lost' | 'workflow_run_exists'> {
  return store.transaction(async tx => {
    const current = await tx.execute({
      sql: `SELECT * FROM outbox_events
        WHERE id = ? AND published_at IS NULL AND available_at = ?`,
      args: [input.id, input.leaseToken],
    });
    const row = current.rows[0];
    if (!row) return 'fence_lost';
    const workflowRun = await tx.execute({
      sql: 'SELECT 1 FROM workflow_runs WHERE run_id = ?',
      args: [input.id],
    });
    if (workflowRun.rows.length > 0) {
      const completed = await tx.execute({
        sql: `UPDATE outbox_events SET published_at = ?, error_code = NULL
          WHERE id = ? AND published_at IS NULL AND available_at = ?`,
        args: [input.now, input.id, input.leaseToken],
      });
      return completed.rowsAffected === 1 ? 'workflow_run_exists' : 'fence_lost';
    }
    const attempts = Number(row.attempt_count) + 1;
    if (attempts >= input.maxAttempts) {
      await tx.execute({
        sql: `UPDATE outbox_events SET attempt_count = ?, error_code = ?
          WHERE id = ? AND published_at IS NULL AND available_at = ?`,
        args: [attempts, input.errorCode, input.id, input.leaseToken],
      });
      await tx.execute({
        sql: `INSERT OR IGNORE INTO dead_letter_events(
          id, source_outbox_id, event_type, event_ref, tenant_id, incident_id,
          error_code, attempt_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `dead_${input.id}`,
          input.id,
          String(row.type),
          `outbox:${input.id}`,
          String(row.tenant_id),
          String(row.incident_id),
          input.errorCode,
          attempts,
          input.now,
        ],
      });
      return 'dead_letter';
    }
    const delay = backoffWithDeterministicJitter(input.id, attempts, input.backoffBaseMs, input.backoffCapMs);
    const availableAt = new Date(Date.parse(input.now) + delay).toISOString();
    const updated = await tx.execute({
      sql: `UPDATE outbox_events SET attempt_count = ?, error_code = ?, available_at = ?
        WHERE id = ? AND published_at IS NULL AND available_at = ?`,
      args: [attempts, input.errorCode, availableAt, input.id, input.leaseToken],
    });
    return updated.rowsAffected === 1 ? 'retry' : 'fence_lost';
  });
}

export async function reconcilePublishedAlertsWithoutRun(
  store: OperationalStore,
  input: Readonly<{ now: string; olderThan: string }>,
): Promise<number> {
  const result = await store.execute({
    sql: `UPDATE outbox_events SET published_at = NULL, available_at = ?, error_code = NULL
      WHERE type = 'security.alert.received' AND published_at IS NOT NULL
        AND published_at <= ? AND NOT EXISTS (
          SELECT 1 FROM workflow_runs w WHERE w.run_id = outbox_events.id
        ) AND NOT EXISTS (
          SELECT 1 FROM dead_letter_events d
          WHERE d.source_outbox_id = outbox_events.id AND d.resolved_at IS NULL
        )`,
    args: [input.now, input.olderThan],
  });
  return result.rowsAffected;
}

export async function persistOutboxDeadLetter(
  store: OperationalStore,
  input: Readonly<{
    outboxId: string;
    errorCode: string;
    attemptCount: number;
    createdAt: string;
  }>,
): Promise<'dead_letter' | 'workflow_run_exists' | 'outbox_missing'> {
  return store.transaction(async tx => {
    const source = await tx.execute({
      sql: `SELECT id, type, run_id, tenant_id, incident_id, schema_version,
        correlation_id FROM outbox_events WHERE id = ?`,
      args: [input.outboxId],
    });
    const sourceRow = source.rows[0];
    if (!sourceRow) return 'outbox_missing';
    const workflowRun = await tx.execute({
      sql: 'SELECT 1 FROM workflow_runs WHERE run_id = ?',
      args: [input.outboxId],
    });
    if (workflowRun.rows.length > 0) return 'workflow_run_exists';
    const inserted = await tx.execute({
      sql: `INSERT OR IGNORE INTO dead_letter_events(
        id, source_outbox_id, event_type, event_ref, tenant_id, incident_id,
        error_code, attempt_count, created_at
      ) SELECT ?, id, type, ?, tenant_id, incident_id, ?, ?, ?
        FROM outbox_events
        WHERE id = ? AND NOT EXISTS (
          SELECT 1 FROM workflow_runs w WHERE w.run_id = outbox_events.id
        )`,
      args: [
        `dead_${input.outboxId}`,
        `outbox:${input.outboxId}`,
        input.errorCode,
        input.attemptCount,
        input.createdAt,
        input.outboxId,
      ],
    });
    if (inserted.rowsAffected === 1) {
      const deadLetterOutboxId = `dlq_${createHash('sha256').update(input.outboxId).digest('hex')}`;
      await tx.execute({
        sql: `INSERT OR IGNORE INTO outbox_events(
          id, type, run_id, incident_id, tenant_id, schema_version,
          correlation_id, causation_id, payload_json, occurred_at, available_at
        ) VALUES (?, 'security.dead-letter', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          deadLetterOutboxId,
          String(sourceRow.run_id),
          String(sourceRow.incident_id),
          String(sourceRow.tenant_id),
          Number(sourceRow.schema_version),
          String(sourceRow.correlation_id),
          input.outboxId,
          JSON.stringify({
            sourceEventId: input.outboxId,
            errorCode: input.errorCode,
          }),
          input.createdAt,
          input.createdAt,
        ],
      });
      return 'dead_letter';
    }
    const existing = await tx.execute({
      sql: `SELECT 1 FROM dead_letter_events
        WHERE source_outbox_id = ? AND resolved_at IS NULL`,
      args: [input.outboxId],
    });
    if (existing.rows.length > 0) return 'dead_letter';
    return workflowRun.rows.length > 0 ? 'workflow_run_exists' : 'outbox_missing';
  });
}

export async function hasUnresolvedOutboxDeadLetter(store: OperationalStore, outboxId: string): Promise<boolean> {
  const result = await store.execute({
    sql: `SELECT 1 FROM dead_letter_events
      WHERE source_outbox_id = ? AND resolved_at IS NULL`,
    args: [outboxId],
  });
  return result.rows.length > 0;
}

function claimedFromRow(row: SqlResult['rows'][number], leaseToken: string): ClaimedOutboxEvent {
  let payload: unknown;
  try {
    payload = JSON.parse(String(row.payload_json)) as unknown;
  } catch {
    return invalidClaim(row, leaseToken);
  }
  const event = DomainEventSchema.safeParse({
    type: row.type,
    runId: row.run_id,
    data: {
      eventId: row.id,
      schemaVersion: Number(row.schema_version),
      occurredAt: row.occurred_at,
      incidentId: row.incident_id,
      tenantId: row.tenant_id,
      correlationId: row.correlation_id,
      ...(row.causation_id === null ? {} : { causationId: row.causation_id }),
      payload,
    },
  });
  if (!event.success) return invalidClaim(row, leaseToken);
  return {
    valid: true,
    event: event.data,
    leaseToken,
    attemptCount: Number(row.attempt_count),
  };
}

function invalidClaim(row: SqlResult['rows'][number], leaseToken: string): ClaimedOutboxEvent {
  const id = row.id;
  if (typeof id !== 'string') throw new DomainError('VALIDATION_FAILED');
  return {
    valid: false,
    id,
    leaseToken,
    attemptCount: Number(row.attempt_count),
  };
}

function backoffWithDeterministicJitter(id: string, attempt: number, baseMs: number, capMs: number): number {
  const exponential = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt - 1));
  const seed = createHash('sha256').update(id).digest().readUInt16BE(0);
  const jitter = 0.75 + (seed / 65_535) * 0.5;
  return Math.max(1, Math.floor(exponential * jitter));
}
