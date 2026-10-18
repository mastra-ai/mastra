import type { OperationalStore } from '../db/operational-store.js';
import { systemClock, type Clock } from '../domain/clock.js';
import { DomainError } from '../domain/errors.js';
import { canonicalJson } from './canonicalize.js';
import type { Correlation } from './contracts.js';
import { sha256 } from './hashes.js';

export async function appendCorrelationTimeline(
  store: OperationalStore,
  correlation: Correlation,
  dependencies: Readonly<{ clock?: Clock }> = {},
) {
  const occurredAt = (dependencies.clock ?? systemClock).now();
  const payload = canonicalJson({
    evidenceCount: correlation.orderedEvents.length,
    relationCount: correlation.relations.length,
    contradictionCount: correlation.contradictions.length,
    missingSourceCount: correlation.missingData.length,
    missingData: correlation.missingData,
  });
  const eventId = `cor_${sha256(
    canonicalJson({
      namespace: 'evidence-correlation-v1',
      tenantId: correlation.context.tenantId,
      incidentId: correlation.context.incidentId,
      workflowRunId: correlation.context.workflowRunId,
      causationId: correlation.context.eventId,
    }),
  )}`;
  try {
    await store.transaction(async tx => {
      const existing = await tx.execute({
        sql: 'SELECT * FROM timeline_events WHERE id = ?',
        args: [eventId],
      });
      if (existing.rows[0]) {
        verifyCorrelationEvent(existing.rows[0], correlation, payload);
        return;
      }
      const updated = await tx.execute({
        sql: `UPDATE incidents SET timeline_sequence = timeline_sequence + 1, updated_at = ?
          WHERE tenant_id = ? AND id = ? AND current_run_id = ?
          RETURNING timeline_sequence`,
        args: [
          occurredAt,
          correlation.context.tenantId,
          correlation.context.incidentId,
          correlation.context.workflowRunId,
        ],
      });
      const sequence = Number(updated.rows[0]?.timeline_sequence);
      if (!Number.isInteger(sequence)) throw new DomainError('CONFLICT');
      await tx.execute({
        sql: `INSERT INTO timeline_events(
          id, incident_id, tenant_id, sequence, type, category, correlation_id,
          causation_id, payload_json, schema_version, occurred_at
        ) VALUES (?, ?, ?, ?, 'evidence.correlated', 'domain', ?, ?, ?, 1, ?)`,
        args: [
          eventId,
          correlation.context.incidentId,
          correlation.context.tenantId,
          sequence,
          correlation.context.correlationId,
          correlation.context.eventId,
          payload,
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
    verifyCorrelationEvent(existing.rows[0], correlation, payload);
  }
}

function verifyCorrelationEvent(row: Record<string, unknown>, correlation: Correlation, payload: string) {
  if (
    row.incident_id !== correlation.context.incidentId ||
    row.tenant_id !== correlation.context.tenantId ||
    row.type !== 'evidence.correlated' ||
    row.category !== 'domain' ||
    row.correlation_id !== correlation.context.correlationId ||
    row.causation_id !== correlation.context.eventId ||
    row.payload_json !== payload ||
    Number(row.schema_version) !== 1
  ) {
    throw new DomainError('CONFLICT');
  }
}
