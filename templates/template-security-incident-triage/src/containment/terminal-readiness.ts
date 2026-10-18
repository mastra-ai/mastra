import { transitionIncident } from '../db/incident-operations.js';
import type { OperationalStore } from '../db/operational-store.js';
import { decisionFingerprint } from '../approval/resume-token.js';
import type { Clock } from '../domain/clock.js';
import { DomainError } from '../domain/errors.js';
import type { IdGenerator } from '../domain/id-generator.js';
import { ApprovalDecisionSchema, type AuthoritativeApprovalResult } from '../schemas/approval.js';
import { ContainmentPlanSchema, type ContainmentActionOutcome, type ContainmentPlan } from '../schemas/containment.js';
import { canonicalizePlanValue, verifyPlanHash } from './plan-canonicalization.js';

export type TerminalReadinessInput =
  | Readonly<{
      status: 'rejected';
      plan: ContainmentPlan;
      authoritative: AuthoritativeApprovalResult;
      workflowRunId: string;
      requestCorrelationId: string;
      terminalCorrelationId: string;
    }>
  | Readonly<{
      status: 'containment-succeeded';
      plan: ContainmentPlan;
      authoritative: AuthoritativeApprovalResult;
      workflowRunId: string;
      requestCorrelationId: string;
      terminalCorrelationId: string;
      outcomes: readonly ContainmentActionOutcome[];
    }>;

export type TerminalReadiness = Readonly<{
  incidentStatus: 'contained' | 'rejected' | 'closed';
  incidentVersion: number;
  closedAt: string | null;
  terminalOccurredAt: string | null;
  terminalCorrelationId: string | null;
  terminalFrom: string | null;
}>;

export async function closeValidatedTerminalIncident(
  store: OperationalStore,
  input: TerminalReadinessInput,
  dependencies: Readonly<{
    clock?: Clock;
    ids?: IdGenerator;
    payload?: Readonly<Record<string, string | number | boolean | null>>;
  }> = {},
): Promise<'closed' | 'replayed'> {
  const readiness = await assertTerminalReadiness(store, input);
  if (readiness.incidentStatus === 'closed') {
    assertClosedEvidence(readiness, input);
    return 'replayed';
  }
  await transitionIncident(
    store,
    {
      tenantId: input.plan.tenantId,
      incidentId: input.plan.incidentId,
      expectedVersion: readiness.incidentVersion,
      to: 'closed',
      runId: input.workflowRunId,
      correlationId: input.terminalCorrelationId,
      causationId: input.authoritative.approvalId,
      ...(dependencies.payload ? { payload: dependencies.payload } : {}),
    },
    {
      ...(dependencies.clock ? { clock: dependencies.clock } : {}),
      ...(dependencies.ids ? { ids: dependencies.ids } : {}),
      assertReady: async tx => {
        const guarded = await assertTerminalReadiness(tx, input);
        if (guarded.incidentStatus === 'closed' || guarded.incidentVersion !== readiness.incidentVersion) {
          throw new DomainError('CONFLICT');
        }
      },
    },
  );
  return 'closed';
}

export async function assertTerminalReadiness(
  store: Pick<OperationalStore, 'execute'>,
  input: TerminalReadinessInput,
): Promise<TerminalReadiness> {
  const binding = await store.execute({
    sql: `SELECT incident.status AS incident_status,
        incident.version AS incident_version, incident.current_run_id,
        incident.current_plan_id, incident.closed_at,
        approval.id AS approval_id, approval.tenant_id, approval.incident_id,
        approval.plan_id, approval.decision, approval.workflow_run_id,
        approval.plan_hash_version, approval.plan_hash, approval.decided_by,
        approval.decided_by_role, approval.decided_at, approval.decision_reason,
        approval.decision_fingerprint, approval.expires_at,
        plan.expires_at AS plan_expires_at, plan.plan_json,
        (SELECT requested.correlation_id FROM timeline_events requested
          WHERE requested.tenant_id = incident.tenant_id
            AND requested.incident_id = incident.id
            AND requested.type = 'approval.requested'
            AND json_extract(requested.payload_json, '$.approvalId') = approval.id
            AND json_extract(requested.payload_json, '$.planId') = approval.plan_id
          ORDER BY requested.sequence DESC LIMIT 1) AS request_correlation_id,
        (SELECT decided.occurred_at FROM timeline_events decided
          WHERE decided.tenant_id = incident.tenant_id
            AND decided.incident_id = incident.id
            AND decided.type = 'approval.decided'
            AND decided.causation_id = approval.id
            AND json_extract(decided.payload_json, '$.decision') = approval.decision
          ORDER BY decided.sequence DESC LIMIT 1) AS decision_occurred_at,
        (SELECT completed.occurred_at FROM timeline_events completed
          WHERE completed.tenant_id = incident.tenant_id
            AND completed.incident_id = incident.id
            AND completed.type = 'containment.completed'
            AND completed.causation_id = approval.id
            AND json_extract(completed.payload_json, '$.status') = 'contained'
          ORDER BY completed.sequence DESC LIMIT 1) AS containment_occurred_at,
        (SELECT completed.correlation_id FROM timeline_events completed
          WHERE completed.tenant_id = incident.tenant_id
            AND completed.incident_id = incident.id
            AND completed.type = 'containment.completed'
            AND completed.causation_id = approval.id
            AND json_extract(completed.payload_json, '$.status') = 'contained'
          ORDER BY completed.sequence DESC LIMIT 1) AS containment_correlation_id,
        (SELECT terminal.occurred_at FROM timeline_events terminal
          WHERE terminal.tenant_id = incident.tenant_id
            AND terminal.incident_id = incident.id
            AND terminal.type = 'incident.status_changed'
            AND terminal.causation_id = approval.id
            AND json_extract(terminal.payload_json, '$.to') = 'closed'
          ORDER BY terminal.sequence DESC LIMIT 1) AS terminal_occurred_at,
        (SELECT terminal.correlation_id FROM timeline_events terminal
          WHERE terminal.tenant_id = incident.tenant_id
            AND terminal.incident_id = incident.id
            AND terminal.type = 'incident.status_changed'
            AND terminal.causation_id = approval.id
            AND json_extract(terminal.payload_json, '$.to') = 'closed'
          ORDER BY terminal.sequence DESC LIMIT 1) AS terminal_correlation_id,
        (SELECT json_extract(terminal.payload_json, '$.from')
          FROM timeline_events terminal
          WHERE terminal.tenant_id = incident.tenant_id
            AND terminal.incident_id = incident.id
            AND terminal.type = 'incident.status_changed'
            AND terminal.causation_id = approval.id
            AND json_extract(terminal.payload_json, '$.to') = 'closed'
          ORDER BY terminal.sequence DESC LIMIT 1) AS terminal_from
      FROM incidents incident
      JOIN approvals approval
        ON approval.tenant_id = incident.tenant_id
        AND approval.incident_id = incident.id
      JOIN containment_plans plan
        ON plan.tenant_id = approval.tenant_id
        AND plan.incident_id = approval.incident_id
        AND plan.id = approval.plan_id
      WHERE incident.tenant_id = ? AND incident.id = ?
        AND approval.id = ? AND approval.plan_id = ?`,
    args: [input.plan.tenantId, input.plan.incidentId, input.authoritative.approvalId, input.plan.planId],
  });
  const row = binding.rows[0];
  let persistedPlan: ReturnType<typeof ContainmentPlanSchema.parse> | undefined;
  if (typeof row?.plan_json === 'string') {
    try {
      persistedPlan = ContainmentPlanSchema.parse(JSON.parse(row.plan_json));
    } catch {
      persistedPlan = undefined;
    }
  }
  const expectedDecision = input.status === 'rejected' ? 'rejected' : 'approved';
  const expectedPreCloseStatus = input.status === 'rejected' ? 'rejected' : 'contained';
  const persistedDecision = ApprovalDecisionSchema.safeParse({
    schemaVersion: 1,
    approvalId: row?.approval_id,
    planId: row?.plan_id,
    incidentId: row?.incident_id,
    tenantId: row?.tenant_id,
    planHashVersion: Number(row?.plan_hash_version),
    planHash: row?.plan_hash,
    decision: row?.decision,
    decidedBy: row?.decided_by,
    decidedByRole: row?.decided_by_role,
    decidedAt: row?.decided_at,
    ...(typeof row?.decision_reason === 'string' ? { reason: row.decision_reason } : {}),
  });
  const fingerprintMatches =
    persistedDecision.success &&
    decisionFingerprint(persistedDecision.data, String(row?.workflow_run_id)) === row?.decision_fingerprint;
  const incidentVersion = Number(row?.incident_version);
  const incidentStatus = row?.incident_status;
  const isClosed = incidentStatus === 'closed';
  if (
    !row ||
    (incidentStatus !== expectedPreCloseStatus && !isClosed) ||
    !Number.isSafeInteger(incidentVersion) ||
    incidentVersion < 0 ||
    !persistedPlan ||
    !verifyPlanHash(input.plan) ||
    !verifyPlanHash(persistedPlan) ||
    !fingerprintMatches ||
    canonicalizePlanValue(persistedPlan) !== canonicalizePlanValue(input.plan) ||
    row.current_run_id !== input.workflowRunId ||
    row.current_plan_id !== input.plan.planId ||
    (isClosed
      ? typeof row.closed_at !== 'string'
      : row.closed_at !== null ||
        row.terminal_occurred_at !== null ||
        row.terminal_correlation_id !== null ||
        row.terminal_from !== null) ||
    row.approval_id !== input.authoritative.approvalId ||
    row.tenant_id !== input.authoritative.tenantId ||
    row.incident_id !== input.authoritative.incidentId ||
    row.plan_id !== input.authoritative.planId ||
    row.workflow_run_id !== input.workflowRunId ||
    row.workflow_run_id !== input.authoritative.workflowRunId ||
    row.decision !== expectedDecision ||
    row.decision !== input.authoritative.decision ||
    Number(row.plan_hash_version) !== input.plan.planHashVersion ||
    Number(row.plan_hash_version) !== input.authoritative.planHashVersion ||
    row.plan_hash !== input.plan.planHash ||
    row.plan_hash !== input.authoritative.planHash ||
    row.decided_by !== input.authoritative.decidedBy ||
    row.decided_by_role !== input.authoritative.decidedByRole ||
    row.decided_at !== input.authoritative.decidedAt ||
    row.request_correlation_id !== input.requestCorrelationId ||
    row.decision_occurred_at !== row.decided_at ||
    (input.status === 'rejected'
      ? row.containment_occurred_at !== null || row.containment_correlation_id !== null
      : typeof row.containment_occurred_at !== 'string' ||
        row.containment_correlation_id !== input.terminalCorrelationId) ||
    row.expires_at !== input.authoritative.expiresAt ||
    row.plan_expires_at !== input.plan.expiresAt ||
    input.authoritative.tenantId !== input.plan.tenantId ||
    input.authoritative.incidentId !== input.plan.incidentId ||
    input.authoritative.planId !== input.plan.planId ||
    input.authoritative.workflowRunId !== input.workflowRunId ||
    input.authoritative.planHashVersion !== input.plan.planHashVersion ||
    input.authoritative.planHash !== input.plan.planHash ||
    input.authoritative.expiresAt !== input.plan.expiresAt
  ) {
    throw new DomainError('CONFLICT');
  }
  if (input.status === 'rejected') {
    const attempts = await store.execute({
      sql: `SELECT count(*) AS count FROM containment_action_attempts
        WHERE tenant_id = ? AND incident_id = ? AND plan_id = ?`,
      args: [input.plan.tenantId, input.plan.incidentId, input.plan.planId],
    });
    if (Number(attempts.rows[0]?.count) !== 0) {
      throw new DomainError('CONFLICT');
    }
    return terminalReadiness(row, incidentStatus, incidentVersion);
  }
  const actions = await store.execute({
    sql: `SELECT action.action_id, action.action_type, action.ordinal,
        action.input_json, action.idempotency_key, action.status,
        action.result_ref, attempt.verification, attempt.provider_ref
      FROM containment_actions action
      LEFT JOIN containment_action_attempts attempt
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
    args: [input.plan.tenantId, input.plan.incidentId, input.plan.planId],
  });
  if (actions.rows.length !== input.outcomes.length) {
    throw new DomainError('CONFLICT');
  }
  const persisted = new Map(actions.rows.map(action => [String(action.action_id), action]));
  const outcomeIds = new Set(input.outcomes.map(outcome => outcome.actionId));
  if (outcomeIds.size !== input.outcomes.length || outcomeIds.size !== persisted.size) {
    throw new DomainError('CONFLICT');
  }
  for (const [index, outcome] of input.outcomes.entries()) {
    const orderedAction = actions.rows[index];
    const action = persisted.get(outcome.actionId);
    const plannedAction = input.plan.actions[index];
    let persistedInput: unknown;
    try {
      persistedInput = JSON.parse(String(orderedAction?.input_json));
    } catch {
      throw new DomainError('CONFLICT');
    }
    if (
      !action ||
      !plannedAction ||
      orderedAction?.action_id !== outcome.actionId ||
      orderedAction.action_id !== plannedAction.actionId ||
      Number(orderedAction.ordinal) !== index ||
      orderedAction.action_type !== plannedAction.type ||
      canonicalizePlanValue(persistedInput) !== canonicalizePlanValue(plannedAction.input) ||
      orderedAction.idempotency_key !== `${input.plan.planId}:${plannedAction.actionId}` ||
      outcome.status !== 'completed' ||
      outcome.verification !== 'verified' ||
      action.status !== 'completed' ||
      action.verification !== 'verified' ||
      action.provider_ref !== outcome.providerRef ||
      action.result_ref !== outcome.providerRef
    ) {
      throw new DomainError('CONFLICT');
    }
  }
  return terminalReadiness(row, incidentStatus, incidentVersion);
}

function terminalReadiness(
  row: Record<string, unknown>,
  incidentStatus: unknown,
  incidentVersion: number,
): TerminalReadiness {
  return {
    incidentStatus: incidentStatus as TerminalReadiness['incidentStatus'],
    incidentVersion,
    closedAt: typeof row.closed_at === 'string' ? row.closed_at : null,
    terminalOccurredAt: typeof row.terminal_occurred_at === 'string' ? row.terminal_occurred_at : null,
    terminalCorrelationId: typeof row.terminal_correlation_id === 'string' ? row.terminal_correlation_id : null,
    terminalFrom: typeof row.terminal_from === 'string' ? row.terminal_from : null,
  };
}

function assertClosedEvidence(readiness: TerminalReadiness, input: TerminalReadinessInput): void {
  const expectedFrom = input.status === 'rejected' ? 'rejected' : 'contained';
  if (
    readiness.closedAt !== readiness.terminalOccurredAt ||
    readiness.terminalCorrelationId !== input.terminalCorrelationId ||
    readiness.terminalFrom !== expectedFrom
  ) {
    throw new DomainError('CONFLICT');
  }
}
