import { canonicalizePlanValue, verifyPlanHash } from '../containment/plan-canonicalization.js';
import { systemClock, type Clock } from '../domain/clock.js';
import { DomainError, parseDomainSchema } from '../domain/errors.js';
import { uuidGenerator, type IdGenerator } from '../domain/id-generator.js';
import { ApprovalRequestSchema, type ApprovalRequest } from '../schemas/approval.js';
import { utcTimestamp } from '../schemas/common.js';
import { ContainmentPlanSchema, type ContainmentPlan } from '../schemas/containment.js';
import { CONTAINMENT_PLAN_TTL_MS } from '../triage/decision-contracts.js';
import { insertTimelineAndOutbox } from './incident-operations.js';
import type { OperationalStore } from './operational-store.js';
import { readAuthoritativeTriageResult } from './triage-result-operations.js';

export async function requestApproval(
  store: OperationalStore,
  input: Readonly<{
    plan: ContainmentPlan;
    approval: ApprovalRequest;
    expectedIncidentVersion: number;
    runId: string;
    correlationId: string;
  }>,
  dependencies: Readonly<{ clock?: Clock; ids?: IdGenerator }> = {},
): Promise<void> {
  const plan = parseDomainSchema(ContainmentPlanSchema, input.plan);
  const approval = parseDomainSchema(ApprovalRequestSchema, input.approval);
  const nowResult = utcTimestamp.safeParse((dependencies.clock ?? systemClock).now());
  if (
    !nowResult.success ||
    plan.planHashVersion !== 1 ||
    !verifyPlanHash(plan) ||
    Date.parse(plan.expiresAt) - Date.parse(plan.createdAt) !== CONTAINMENT_PLAN_TTL_MS ||
    approval.planId !== plan.planId ||
    approval.incidentId !== plan.incidentId ||
    approval.tenantId !== plan.tenantId ||
    approval.planHash !== plan.planHash ||
    approval.planHashVersion !== plan.planHashVersion ||
    approval.expiresAt !== plan.expiresAt ||
    plan.createdAt > approval.requestedAt ||
    approval.requestedAt > nowResult.data ||
    nowResult.data >= approval.expiresAt
  )
    throw new DomainError('VALIDATION_FAILED');
  const ids = dependencies.ids ?? uuidGenerator;
  await store.transaction(async tx => {
    const run = await tx.execute({
      sql: `SELECT 1 FROM workflow_runs w JOIN incidents i
        ON i.tenant_id = w.tenant_id AND i.id = w.incident_id
        WHERE w.tenant_id = ? AND w.incident_id = ? AND w.run_id = ?
          AND i.current_run_id = w.run_id`,
      args: [plan.tenantId, plan.incidentId, input.runId],
    });
    if (!run.rows[0]) throw new DomainError('CONFLICT');
    const triageResult = await readAuthoritativeTriageResult(tx, {
      tenantId: plan.tenantId,
      incidentId: plan.incidentId,
      workflowRunId: input.runId,
    });
    if (
      triageResult.status !== 'ready-for-approval' ||
      triageResult.decision.workflowRunId !== input.runId ||
      canonicalizePlanValue(triageResult.plan) !== canonicalizePlanValue(plan)
    )
      throw new DomainError('CONFLICT');
    const existing = await tx.execute({
      sql: `SELECT a.*, p.plan_json FROM approvals a JOIN containment_plans p
        ON p.id = a.plan_id WHERE a.tenant_id = ? AND a.incident_id = ? AND a.plan_id = ?`,
      args: [plan.tenantId, plan.incidentId, plan.planId],
    });
    if (existing.rows[0]) {
      const row = existing.rows[0];
      if (
        row.id === approval.approvalId &&
        row.workflow_run_id === input.runId &&
        row.plan_hash_version === approval.planHashVersion &&
        row.plan_hash === approval.planHash &&
        row.requested_at === approval.requestedAt &&
        row.expires_at === approval.expiresAt &&
        row.plan_json === JSON.stringify(plan)
      )
        return;
      throw new DomainError('CONFLICT');
    }
    const updated = await tx.execute({
      sql: `UPDATE incidents SET status = 'awaiting_approval', version = version + 1,
        timeline_sequence = timeline_sequence + 1, current_plan_id = ?, updated_at = ?
        WHERE tenant_id = ? AND id = ? AND status = 'investigating' AND version = ?
          AND updated_at <= ? RETURNING timeline_sequence`,
      args: [
        plan.planId,
        approval.requestedAt,
        plan.tenantId,
        plan.incidentId,
        input.expectedIncidentVersion,
        approval.requestedAt,
      ],
    });
    const row = updated.rows[0];
    if (!row) throw new DomainError('CONFLICT');
    await tx.execute({
      sql: `INSERT INTO containment_plans(id, incident_id, tenant_id, schema_version,
        plan_version, plan_hash_version, plan_hash, plan_json, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        plan.planId,
        plan.incidentId,
        plan.tenantId,
        plan.schemaVersion,
        plan.planVersion,
        plan.planHashVersion,
        plan.planHash,
        JSON.stringify(plan),
        plan.expiresAt,
        plan.createdAt,
      ],
    });
    await tx.batch(
      plan.actions.map((action, ordinal) => ({
        sql: `INSERT INTO containment_actions(id, plan_id, incident_id, tenant_id,
        action_id, action_type, target_id, ordinal, input_json, idempotency_key, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        args: [
          ids.next(),
          plan.planId,
          plan.incidentId,
          plan.tenantId,
          action.actionId,
          action.type,
          action.targetId,
          ordinal,
          JSON.stringify(action.input),
          `${plan.planId}:${action.actionId}`,
        ],
      })),
    );
    await tx.execute({
      sql: `INSERT INTO approvals(id, plan_id, incident_id, tenant_id,
        plan_hash_version, plan_hash, requested_at, expires_at, workflow_run_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        approval.approvalId,
        approval.planId,
        approval.incidentId,
        approval.tenantId,
        approval.planHashVersion,
        approval.planHash,
        approval.requestedAt,
        approval.expiresAt,
        input.runId,
      ],
    });
    await insertTimelineAndOutbox(tx, {
      timelineId: ids.next(),
      eventId: ids.next(),
      incidentId: plan.incidentId,
      tenantId: plan.tenantId,
      sequence: Number(row.timeline_sequence),
      type: 'approval.requested',
      eventType: 'security.approval.requested',
      runId: input.runId,
      correlationId: input.correlationId,
      occurredAt: approval.requestedAt,
      payload: { approvalId: approval.approvalId, planId: plan.planId },
    });
  });
}
