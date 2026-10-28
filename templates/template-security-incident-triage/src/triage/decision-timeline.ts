import type { OperationalStore } from '../db/operational-store.js';
import { DomainError } from '../domain/errors.js';
import { canonicalJson } from '../evidence/canonicalize.js';
import { sha256 } from '../mastra/knowledge/hashes.js';
import type { DecisionContext } from './decision-context.js';

export async function appendTriageTimeline(
  store: OperationalStore,
  context: DecisionContext,
  stage: 'classification' | 'summary' | 'proposal' | 'validation' | 'triage',
  status: 'completed' | 'manual-review' | 'blocked',
  payload: Readonly<Record<string, string | number | boolean | null>>,
) {
  const scope = context.correlation.context;
  const eventId = `p5_${sha256(
    canonicalJson({
      // Persisted namespace: changing it would generate duplicate timeline entries
      // for incidents created by earlier template versions.
      namespace: 'triage-timeline-v1',
      tenantId: scope.tenantId,
      incidentId: scope.incidentId,
      workflowRunId: scope.workflowRunId,
      stage,
    }),
  )}`;
  const eventPayload = canonicalJson({
    stage,
    status,
    policyVersion: 1,
    planHashVersion: 1,
    ...payload,
  });
  const type = stage === 'triage' ? 'triage.completed' : `triage.${stage}.${status}`;
  try {
    await store.transaction(async tx => {
      const existing = await tx.execute({
        sql: 'SELECT * FROM timeline_events WHERE id = ?',
        args: [eventId],
      });
      if (existing.rows[0]) {
        verify(existing.rows[0], context, type, eventPayload);
        return;
      }
      const latest = await tx.execute({
        sql: `SELECT max(occurred_at) AS occurred_at FROM timeline_events
          WHERE tenant_id = ? AND incident_id = ?`,
        args: [scope.tenantId, scope.incidentId],
      });
      const occurredAt = String(latest.rows[0]?.occurred_at ?? context.startedAt);
      const updated = await tx.execute({
        sql: `UPDATE incidents SET timeline_sequence = timeline_sequence + 1, updated_at = ?
          WHERE tenant_id = ? AND id = ? AND current_run_id = ?
          RETURNING timeline_sequence`,
        args: [occurredAt, scope.tenantId, scope.incidentId, scope.workflowRunId],
      });
      const sequence = Number(updated.rows[0]?.timeline_sequence);
      if (!Number.isInteger(sequence)) throw new DomainError('CONFLICT');
      await tx.execute({
        sql: `INSERT INTO timeline_events(
          id, incident_id, tenant_id, sequence, type, category, correlation_id,
          causation_id, payload_json, schema_version, occurred_at
        ) VALUES (?, ?, ?, ?, ?, 'domain', ?, ?, ?, 1, ?)`,
        args: [
          eventId,
          scope.incidentId,
          scope.tenantId,
          sequence,
          type,
          scope.correlationId,
          scope.eventId,
          eventPayload,
          occurredAt,
        ],
      });
    });
  } catch (error) {
    const existing = await store.execute({
      sql: 'SELECT * FROM timeline_events WHERE id = ?',
      args: [eventId],
    });
    if (!existing.rows[0]) throw error;
    verify(existing.rows[0], context, type, eventPayload);
  }
}

function verify(row: Record<string, unknown>, context: DecisionContext, type: string, payload: string) {
  const scope = context.correlation.context;
  if (
    row.incident_id !== scope.incidentId ||
    row.tenant_id !== scope.tenantId ||
    row.type !== type ||
    row.category !== 'domain' ||
    row.correlation_id !== scope.correlationId ||
    row.causation_id !== scope.eventId ||
    row.payload_json !== payload ||
    Number(row.schema_version) !== 1
  )
    throw new DomainError('CONFLICT');
}
