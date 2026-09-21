import { systemClock, type Clock } from '../domain/clock.js';
import { uuidGenerator, type IdGenerator } from '../domain/id-generator.js';
import { insertTimelineAndOutbox } from './incident-operations.js';
import type { OperationalStore } from './operational-store.js';

export type ExpiredApprovalWork = Readonly<{
  tenantId: string;
  incidentId: string;
  approvalId: string;
  workflowRunId: string;
  correlationId: string;
}>;

export async function expirePendingApproval(
  store: OperationalStore,
  input: ExpiredApprovalWork,
  dependencies: Readonly<{ clock?: Clock; ids?: IdGenerator }> = {},
): Promise<boolean> {
  const now = (dependencies.clock ?? systemClock).now();
  const ids = dependencies.ids ?? uuidGenerator;
  return store.transaction(async tx => {
    const current = await tx.execute({
      sql: `SELECT a.expires_at, a.decision, i.version
        FROM approvals a JOIN incidents i
          ON i.tenant_id = a.tenant_id AND i.id = a.incident_id
        WHERE a.tenant_id = ? AND a.incident_id = ? AND a.id = ?
          AND a.workflow_run_id = ? AND i.current_run_id = a.workflow_run_id`,
      args: [input.tenantId, input.incidentId, input.approvalId, input.workflowRunId],
    });
    const row = current.rows[0];
    if (!row || row.decision !== null || String(row.expires_at) > now) return false;
    const updated = await tx.execute({
      sql: `UPDATE incidents SET status = 'failed', version = version + 1,
        timeline_sequence = timeline_sequence + 1, updated_at = ?
        WHERE tenant_id = ? AND id = ? AND current_run_id = ?
          AND status = 'awaiting_approval' AND version = ?
        RETURNING timeline_sequence`,
      args: [now, input.tenantId, input.incidentId, input.workflowRunId, Number(row.version)],
    });
    const incident = updated.rows[0];
    if (!incident) return false;
    await insertTimelineAndOutbox(tx, {
      timelineId: ids.next(),
      eventId: ids.next(),
      incidentId: input.incidentId,
      tenantId: input.tenantId,
      sequence: Number(incident.timeline_sequence),
      type: 'approval.expired',
      eventType: 'security.approval.decided',
      runId: input.workflowRunId,
      correlationId: input.correlationId,
      causationId: input.approvalId,
      occurredAt: now,
      payload: { approvalId: input.approvalId, decision: 'expired' },
    });
    return true;
  });
}
