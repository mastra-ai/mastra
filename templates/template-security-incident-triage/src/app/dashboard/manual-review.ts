import type { z } from 'zod';

import { readAuthoritativeTriageResult } from '../../db/triage-result-operations.js';
import { insertTimelineAndOutbox } from '../../db/incident-operations.js';
import type { OperationalStore } from '../../db/operational-store.js';
import { systemClock, type Clock } from '../../domain/clock.js';
import { DomainError } from '../../domain/errors.js';
import { uuidGenerator, type IdGenerator } from '../../domain/id-generator.js';
import type { DashboardPrincipal } from '../auth/dashboard-principal.js';
import type { DashboardManualReviewRequestSchema } from './contracts.js';

/** Records a human triage outcome without creating containment authority. */
export async function decideDashboardManualReview(
  input: Readonly<{
    store: OperationalStore;
    principal: DashboardPrincipal;
    incidentId: string;
    body: z.infer<typeof DashboardManualReviewRequestSchema>;
    correlationId: string;
    clock?: Clock;
    ids?: IdGenerator;
  }>,
) {
  if (input.principal.role === 'viewer') throw new DomainError('NOT_FOUND');
  const clock = input.clock ?? systemClock;
  const ids = input.ids ?? uuidGenerator;

  return input.store.transaction(async tx => {
    const incident = (
      await tx.execute({
        sql: `SELECT status, version, timeline_sequence, current_run_id
          FROM incidents WHERE tenant_id = ? AND id = ?`,
        args: [input.principal.tenantId, input.incidentId],
      })
    ).rows[0];
    if (!incident || incident.status !== 'investigating' || incident.current_run_id !== input.body.workflowRunId)
      throw new DomainError('CONFLICT');

    const triage = await readAuthoritativeTriageResult(tx, {
      tenantId: input.principal.tenantId,
      incidentId: input.incidentId,
      workflowRunId: input.body.workflowRunId,
    });
    if (triage.status !== 'manual-review') throw new DomainError('CONFLICT');

    const prior = await tx.execute({
      sql: `SELECT payload_json FROM timeline_events
        WHERE tenant_id = ? AND incident_id = ?
          AND type = 'triage.manual_review.decided'
          AND json_extract(payload_json, '$.workflowRunId') = ?
        ORDER BY sequence DESC LIMIT 1`,
      args: [input.principal.tenantId, input.incidentId, input.body.workflowRunId],
    });
    const priorDecision = parseDecision(prior.rows[0]?.payload_json);
    const initialDecision =
      !priorDecision && (input.body.decision === 'accepted' || input.body.decision === 'dismissed');
    const completionDecision = priorDecision === 'accepted' && input.body.decision === 'resolved';
    if (!initialDecision && !completionDecision) throw new DomainError('CONFLICT');

    const now = clock.now();
    const nextStatus = input.body.decision === 'accepted' ? 'investigating' : 'closed';
    const updated = await tx.execute({
      sql: `UPDATE incidents SET status = ?, version = version + 1,
        timeline_sequence = timeline_sequence + 1, updated_at = ?,
        closed_at = CASE WHEN ? = 'closed' THEN ? ELSE closed_at END
        WHERE tenant_id = ? AND id = ? AND status = 'investigating'
          AND version = ? AND current_run_id = ? AND updated_at <= ?
        RETURNING timeline_sequence`,
      args: [
        nextStatus,
        now,
        nextStatus,
        now,
        input.principal.tenantId,
        input.incidentId,
        Number(incident.version),
        input.body.workflowRunId,
        now,
      ],
    });
    const sequence = Number(updated.rows[0]?.timeline_sequence);
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw new DomainError('CONFLICT');

    await insertTimelineAndOutbox(tx, {
      timelineId: ids.next(),
      eventId: ids.next(),
      incidentId: input.incidentId,
      tenantId: input.principal.tenantId,
      sequence,
      type: 'triage.manual_review.decided',
      eventType: 'security.incident.updated',
      runId: input.body.workflowRunId,
      correlationId: input.correlationId,
      occurredAt: now,
      payload: {
        status: input.body.decision,
        decision: input.body.decision,
        workflowRunId: input.body.workflowRunId,
        decidedBy: input.principal.userRef,
        decidedByRole: input.principal.role,
        ...(input.body.reason ? { reason: input.body.reason } : {}),
      },
    });

    return {
      incidentId: input.incidentId,
      workflowRunId: input.body.workflowRunId,
      decision: input.body.decision,
      decidedAt: now,
      incidentStatus: nextStatus,
    };
  });
}

function parseDecision(payload: unknown): 'accepted' | 'dismissed' | 'resolved' | undefined {
  if (typeof payload !== 'string') return undefined;
  try {
    const decision = (JSON.parse(payload) as Record<string, unknown>).decision;
    return decision === 'accepted' || decision === 'dismissed' || decision === 'resolved' ? decision : undefined;
  } catch {
    return undefined;
  }
}
