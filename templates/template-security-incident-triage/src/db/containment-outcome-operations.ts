import { insertTimelineAndOutbox } from './incident-operations.js';
import type { OperationalStore } from './operational-store.js';
import type { Clock } from '../domain/clock.js';
import { systemClock } from '../domain/clock.js';
import { DomainError } from '../domain/errors.js';
import type { IdGenerator } from '../domain/id-generator.js';
import { uuidGenerator } from '../domain/id-generator.js';

export async function recordContainmentOutcome(
  store: OperationalStore,
  input: Readonly<{
    tenantId: string;
    incidentId: string;
    workflowRunId: string;
    correlationId: string;
    approvalId: string;
    expectedVersion: number;
    status: 'contained' | 'failed';
    partial: boolean;
    completedCount: number;
    failedCount: number;
  }>,
  dependencies: Readonly<{ clock?: Clock; ids?: IdGenerator }> = {},
): Promise<void> {
  const clock = dependencies.clock ?? systemClock;
  const ids = dependencies.ids ?? uuidGenerator;
  const now = clock.now();
  await store.transaction(async tx => {
    const current = await tx.execute({
      sql: `SELECT status FROM incidents WHERE tenant_id = ? AND id = ?
        AND current_run_id = ?`,
      args: [input.tenantId, input.incidentId, input.workflowRunId],
    });
    if (current.rows[0]?.status === input.status) return;
    const updated = await tx.execute({
      sql: `UPDATE incidents SET status = ?, version = version + 1,
        timeline_sequence = timeline_sequence + 1, updated_at = ?
        WHERE tenant_id = ? AND id = ? AND current_run_id = ?
          AND status = 'containing' AND version = ?
        RETURNING timeline_sequence`,
      args: [input.status, now, input.tenantId, input.incidentId, input.workflowRunId, input.expectedVersion],
    });
    const row = updated.rows[0];
    if (!row) throw new DomainError('CONFLICT');
    await insertTimelineAndOutbox(tx, {
      timelineId: ids.next(),
      eventId: ids.next(),
      incidentId: input.incidentId,
      tenantId: input.tenantId,
      sequence: Number(row.timeline_sequence),
      type: 'containment.completed',
      eventType: 'security.containment.completed',
      runId: input.workflowRunId,
      correlationId: input.correlationId,
      causationId: input.approvalId,
      occurredAt: now,
      payload: {
        status: input.status,
        partial: input.partial,
        completedCount: input.completedCount,
        failedCount: input.failedCount,
      },
    });
  });
}
