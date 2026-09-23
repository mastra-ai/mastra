import { ContainmentActionOutcomeSchema, ContainmentPlanSchema } from '../schemas/containment.js';
import { AuthoritativeApprovalResultSchema } from '../schemas/approval.js';
import { DomainError, parseDomainSchema } from '../domain/errors.js';
import type { Clock } from '../domain/clock.js';
import { systemClock } from '../domain/clock.js';
import type { IdGenerator } from '../domain/id-generator.js';
import type { OperationalStore } from '../db/operational-store.js';
import { getIncident, transitionIncident } from '../db/incident-operations.js';
import { recordContainmentOutcome } from '../db/containment-outcome-operations.js';
import { ContainmentGateway } from './gateway.js';
import type { LocalContainmentState } from './local-state.js';
import type { IdentityProvider } from '../providers/identity-provider.js';
import { closeValidatedTerminalIncident } from './terminal-readiness.js';

export async function retryPartialContainment(
  store: OperationalStore,
  input: Readonly<{
    tenantId: string;
    incidentId: string;
    workflowRunId: string;
    approvalId: string;
    correlationId: string;
    state: LocalContainmentState;
    mode: 'local' | 'staging' | 'production';
    timeoutMs: number;
    rateLimit: number;
    identityProvider?: IdentityProvider;
  }>,
  dependencies: Readonly<{ clock?: Clock; ids?: IdGenerator }> = {},
) {
  const clock = dependencies.clock ?? systemClock;
  const binding = await store.execute({
    sql: `SELECT i.status, i.current_plan_id, i.current_run_id,
      a.plan_id, a.plan_hash, a.plan_hash_version, a.expires_at,
      a.decision, a.decided_by, a.decided_by_role, a.decided_at, p.plan_json,
      (SELECT requested.correlation_id FROM timeline_events requested
        WHERE requested.tenant_id = i.tenant_id
          AND requested.incident_id = i.id
          AND requested.type = 'approval.requested'
          AND json_extract(requested.payload_json, '$.approvalId') = a.id
          AND json_extract(requested.payload_json, '$.planId') = a.plan_id
        ORDER BY requested.sequence DESC LIMIT 1) AS request_correlation_id
      FROM incidents i JOIN approvals a
        ON a.tenant_id = i.tenant_id AND a.incident_id = i.id
      JOIN containment_plans p
        ON p.tenant_id = a.tenant_id AND p.incident_id = a.incident_id
        AND p.id = a.plan_id
      WHERE i.tenant_id = ? AND i.id = ? AND a.id = ?
        AND a.workflow_run_id = ?`,
    args: [input.tenantId, input.incidentId, input.approvalId, input.workflowRunId],
  });
  const row = binding.rows[0];
  if (
    !row ||
    !['failed', 'containing', 'contained'].includes(String(row.status)) ||
    row.current_plan_id !== row.plan_id ||
    row.current_run_id !== input.workflowRunId ||
    row.decision !== 'approved' ||
    row.decided_by_role !== 'soc_manager' ||
    (row.status !== 'contained' && String(row.expires_at) <= clock.now())
  ) {
    throw new DomainError('CONFLICT');
  }
  let plan: unknown;
  try {
    plan = JSON.parse(String(row.plan_json));
  } catch {
    throw new DomainError('VALIDATION_FAILED');
  }
  const parsedPlan = parseDomainSchema(ContainmentPlanSchema, plan);
  const authoritative = parseDomainSchema(AuthoritativeApprovalResultSchema, {
    approvalId: input.approvalId,
    planId: row.plan_id,
    incidentId: input.incidentId,
    tenantId: input.tenantId,
    workflowRunId: input.workflowRunId,
    planHashVersion: Number(row.plan_hash_version),
    planHash: row.plan_hash,
    decision: row.decision,
    decidedBy: row.decided_by,
    decidedByRole: row.decided_by_role,
    decidedAt: row.decided_at,
    expiresAt: row.expires_at,
  });
  const requestCorrelationId = String(row.request_correlation_id);
  if (row.status === 'contained') {
    const outcomes = await readPersistedOutcomes(store, input.tenantId, input.incidentId, parsedPlan.planId);
    await closeValidatedTerminalIncident(
      store,
      {
        status: 'containment-succeeded',
        plan: parsedPlan,
        authoritative,
        workflowRunId: input.workflowRunId,
        requestCorrelationId,
        terminalCorrelationId: input.correlationId,
        outcomes,
      },
      {
        ...dependencies,
        payload: { recovery: 'partial-retry-complete' },
      },
    );
    return Object.freeze({ status: 'contained' as const, outcomes });
  }
  if (row.status === 'failed') {
    const before = await getIncident(store, input.tenantId, input.incidentId);
    await transitionIncident(
      store,
      {
        tenantId: input.tenantId,
        incidentId: input.incidentId,
        expectedVersion: before.version,
        to: 'containing',
        runId: input.workflowRunId,
        correlationId: input.correlationId,
        causationId: input.approvalId,
        payload: { recovery: 'partial-retry' },
      },
      dependencies,
    );
  }
  const gateway = new ContainmentGateway({
    store,
    state: input.state,
    mode: input.mode,
    timeoutMs: input.timeoutMs,
    rateLimit: input.rateLimit,
    ...(input.identityProvider ? { identityProvider: input.identityProvider } : {}),
    ...dependencies,
  });
  const outcomes = [];
  for (const action of parsedPlan.actions) {
    const outcome = await gateway.executeApprovedAction({
      tenantId: input.tenantId,
      incidentId: input.incidentId,
      workflowRunId: input.workflowRunId,
      approvalId: input.approvalId,
      plan: parsedPlan,
      action,
    });
    outcomes.push(outcome);
    if (outcome.status !== 'completed' || outcome.verification !== 'verified') {
      break;
    }
  }
  const failed = outcomes.some(outcome => outcome.status !== 'completed' || outcome.verification !== 'verified');
  const completedCount = outcomes.filter(
    outcome => outcome.status === 'completed' && outcome.verification === 'verified',
  ).length;
  const current = await getIncident(store, input.tenantId, input.incidentId);
  await recordContainmentOutcome(
    store,
    {
      tenantId: input.tenantId,
      incidentId: input.incidentId,
      workflowRunId: input.workflowRunId,
      correlationId: input.correlationId,
      approvalId: input.approvalId,
      expectedVersion: current.version,
      status: failed ? 'failed' : 'contained',
      partial: failed && completedCount > 0,
      completedCount,
      failedCount: failed ? 1 : 0,
    },
    dependencies,
  );
  if (!failed) {
    await closeValidatedTerminalIncident(
      store,
      {
        status: 'containment-succeeded',
        plan: parsedPlan,
        authoritative,
        workflowRunId: input.workflowRunId,
        requestCorrelationId,
        terminalCorrelationId: input.correlationId,
        outcomes,
      },
      {
        ...dependencies,
        payload: { recovery: 'partial-retry-complete' },
      },
    );
  }
  return Object.freeze({ status: failed ? 'failed' : 'contained', outcomes });
}

async function readPersistedOutcomes(store: OperationalStore, tenantId: string, incidentId: string, planId: string) {
  const result = await store.execute({
    sql: `SELECT action.action_id, attempt.status, attempt.verification,
        attempt.provider_ref, attempt.error_code
      FROM containment_actions action
      JOIN containment_action_attempts attempt
        ON attempt.tenant_id = action.tenant_id
        AND attempt.plan_id = action.plan_id
        AND attempt.action_id = action.action_id
        AND attempt.attempt = (
          SELECT max(latest.attempt) FROM containment_action_attempts latest
          WHERE latest.tenant_id = action.tenant_id
            AND latest.plan_id = action.plan_id
            AND latest.action_id = action.action_id
        )
      WHERE action.tenant_id = ? AND action.incident_id = ? AND action.plan_id = ?
      ORDER BY action.ordinal`,
    args: [tenantId, incidentId, planId],
  });
  return result.rows.map(row =>
    parseDomainSchema(ContainmentActionOutcomeSchema, {
      actionId: row.action_id,
      status: row.status,
      verification: row.verification,
      ...(row.provider_ref ? { providerRef: row.provider_ref } : {}),
      ...(row.error_code ? { errorCode: row.error_code } : {}),
    }),
  );
}
