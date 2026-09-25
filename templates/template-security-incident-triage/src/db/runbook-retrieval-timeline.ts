import { DomainError } from '../domain/errors.js';
import type { StoreTransaction } from './operational-store.js';
import type { RetrievalScope } from './runbook-retrieval-types.js';

export async function appendRetrievalTimeline(
  tx: StoreTransaction,
  event: Readonly<{
    timelineId: string;
    type: 'runbook.retrieved' | 'runbook.retrieval_failed';
    now: string;
    input: Pick<RetrievalScope, 'tenantId' | 'incidentId' | 'workflowRunId' | 'correlationId'>;
    payload: Record<string, unknown>;
  }>,
): Promise<void> {
  const updated = await tx.execute({
    sql: `UPDATE incidents SET timeline_sequence = timeline_sequence + 1,
      updated_at = ? WHERE tenant_id = ? AND id = ? AND updated_at <= ?
      RETURNING timeline_sequence`,
    args: [event.now, event.input.tenantId, event.input.incidentId, event.now],
  });
  if (!updated.rows[0]) throw new DomainError('CONFLICT');
  await tx.execute({
    sql: `INSERT INTO timeline_events(
      id, incident_id, tenant_id, sequence, type, category, correlation_id,
      causation_id, payload_json, schema_version, occurred_at
    ) VALUES (?, ?, ?, ?, ?, 'domain', ?, ?, ?, 1, ?)`,
    args: [
      event.timelineId,
      event.input.incidentId,
      event.input.tenantId,
      Number(updated.rows[0].timeline_sequence),
      event.type,
      event.input.correlationId,
      event.input.workflowRunId,
      JSON.stringify(event.payload),
      event.now,
    ],
  });
}
