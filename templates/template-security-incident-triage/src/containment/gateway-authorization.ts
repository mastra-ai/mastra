import type { OperationalStore } from '../db/operational-store.js';
import { systemClock, type Clock } from '../domain/clock.js';
import { DomainError, parseDomainSchema } from '../domain/errors.js';
import { uuidGenerator, type IdGenerator } from '../domain/id-generator.js';
import {
  ContainmentActionOutcomeSchema,
  ContainmentActionSchema,
  ContainmentPlanSchema,
  type ContainmentAction,
  type ContainmentActionOutcome,
  type ContainmentPlan,
} from '../schemas/containment.js';
import { auditGatewayAttempt, claimContainmentAction } from './execution-claims.js';
import { canonicalizePlanValue, verifyPlanHash } from './plan-canonicalization.js';
import { assertSingleTarget } from './target-validation.js';

export type GatewayActionInput = Readonly<{
  tenantId: string;
  incidentId: string;
  workflowRunId: string;
  approvalId: string;
  plan: ContainmentPlan;
  action: ContainmentAction;
}>;

export async function authorizeGatewayAction(
  store: OperationalStore,
  input: GatewayActionInput,
  config: Readonly<{
    mode: 'local' | 'staging' | 'production';
    timeoutMs: number;
    rateLimit: number;
    identityEffectsEnabled?: boolean;
    clock?: Clock;
    ids?: IdGenerator;
  }>,
): Promise<
  | Readonly<{ state: 'replayed'; outcome: ContainmentActionOutcome }>
  | Readonly<{
      state: 'claimed';
      plan: ContainmentPlan;
      action: ContainmentAction;
      fenceToken: string;
      attempt: number;
      subjectId: string;
      idempotencyKey: string;
    }>
> {
  const clock = config.clock ?? systemClock;
  const ids = config.ids ?? uuidGenerator;
  const claimed = claimedGatewayScope(input as unknown);
  let plan: ContainmentPlan;
  let action: ContainmentAction;
  try {
    plan = parseDomainSchema(ContainmentPlanSchema, input.plan);
    action = parseDomainSchema(ContainmentActionSchema, input.action);
  } catch (error) {
    await auditGatewayAttempt(
      store,
      {
        ...claimed,
        outcome: 'invalid',
        reasonCode: 'BINDING_INVALID',
      },
      { clock, ids },
    );
    throw error;
  }
  const deny = async (
    outcome: 'invalid' | 'blocked' | 'expired',
    reasonCode: 'BINDING_INVALID' | 'MODE_BLOCKED' | 'APPROVAL_EXPIRED',
  ): Promise<never> => {
    await auditGatewayAttempt(
      store,
      {
        tenantId: input.tenantId,
        incidentId: input.incidentId,
        planId: plan.planId,
        approvalId: input.approvalId,
        actionId: action.actionId,
        outcome,
        reasonCode,
      },
      { clock, ids },
    );
    throw new DomainError('VALIDATION_FAILED');
  };
  if (
    (config.mode !== 'local' && !config.identityEffectsEnabled) ||
    (config.mode !== 'local' && action.type !== 'revoke_session' && action.type !== 'restore_previous_role')
  )
    return deny('blocked', 'MODE_BLOCKED');
  try {
    assertSingleTarget(action.targetId);
  } catch {
    return deny('invalid', 'BINDING_INVALID');
  }
  if (!verifyPlanHash(plan) || plan.planHashVersion !== 1) return deny('invalid', 'BINDING_INVALID');
  if (clock.now() >= plan.expiresAt) return deny('expired', 'APPROVAL_EXPIRED');
  const persisted = await store.execute({
    sql: `SELECT i.status AS incident_status, i.subject_id, i.current_plan_id, i.current_run_id,
      a.decision, a.decided_by, a.decided_by_role, a.decision_provenance,
      a.expires_at AS approval_expires_at, a.workflow_run_id,
      a.plan_hash, a.plan_hash_version, p.plan_json, ca.action_type,
      ca.ordinal, ca.input_json, ca.idempotency_key
      FROM approvals a JOIN incidents i
        ON i.tenant_id = a.tenant_id AND i.id = a.incident_id
      JOIN containment_plans p ON p.tenant_id = a.tenant_id
        AND p.incident_id = a.incident_id AND p.id = a.plan_id
      JOIN containment_actions ca ON ca.tenant_id = a.tenant_id
        AND ca.incident_id = a.incident_id AND ca.plan_id = a.plan_id
      WHERE a.tenant_id = ? AND a.incident_id = ? AND a.id = ?
        AND a.plan_id = ? AND ca.action_id = ?`,
    args: [input.tenantId, input.incidentId, input.approvalId, plan.planId, action.actionId],
  });
  const row = persisted.rows[0];
  if (!row) return deny('invalid', 'BINDING_INVALID');
  let persistedPlan: unknown;
  let persistedInput: unknown;
  try {
    persistedPlan = JSON.parse(String(row.plan_json));
    persistedInput = JSON.parse(String(row.input_json));
  } catch {
    return deny('invalid', 'BINDING_INVALID');
  }
  const ordinal = plan.actions.findIndex(item => item.actionId === action.actionId);
  const decidedBy = typeof row.decided_by === 'string' ? row.decided_by : undefined;
  const validDecisionPrincipal =
    row.decision_provenance === 'dashboard'
      ? Boolean(decidedBy && (config.mode === 'local' || decidedBy !== 'studio-soc-manager'))
      : config.mode === 'local' && decidedBy === 'studio-soc-manager';
  if (
    input.tenantId !== plan.tenantId ||
    input.incidentId !== plan.incidentId ||
    input.workflowRunId !== row.workflow_run_id ||
    row.current_run_id !== input.workflowRunId ||
    row.current_plan_id !== plan.planId ||
    row.decision !== 'approved' ||
    row.decided_by_role !== 'soc_manager' ||
    !validDecisionPrincipal ||
    !['approved', 'containing'].includes(String(row.incident_status)) ||
    String(row.approval_expires_at) <= clock.now() ||
    row.plan_hash !== plan.planHash ||
    Number(row.plan_hash_version) !== plan.planHashVersion ||
    canonicalizePlanValue(persistedPlan) !== canonicalizePlanValue(plan) ||
    ordinal < 0 ||
    Number(row.ordinal) !== ordinal ||
    row.action_type !== action.type ||
    canonicalizePlanValue(persistedInput) !== canonicalizePlanValue(action.input) ||
    canonicalizePlanValue(plan.actions[ordinal]) !== canonicalizePlanValue(action)
  )
    return deny('invalid', 'BINDING_INVALID');
  const claim = await claimContainmentAction(
    store,
    {
      tenantId: input.tenantId,
      incidentId: input.incidentId,
      planId: plan.planId,
      approvalId: input.approvalId,
      actionId: action.actionId,
      idempotencyKey: String(row.idempotency_key),
      ownerId: input.workflowRunId,
      leaseMs: config.timeoutMs * 2,
      rateLimit: config.rateLimit,
    },
    { clock, ids },
  );
  if (claim.state === 'denied') throw new DomainError('CONFLICT');
  if (claim.state === 'replayed') {
    return {
      state: 'replayed',
      outcome: ContainmentActionOutcomeSchema.parse({
        actionId: action.actionId,
        status: 'completed',
        verification: 'verified',
        ...(claim.providerRef ? { providerRef: claim.providerRef } : {}),
      }),
    };
  }
  return {
    state: 'claimed',
    plan,
    action,
    fenceToken: claim.fenceToken,
    attempt: claim.attempt,
    subjectId: String(row.subject_id),
    idempotencyKey: String(row.idempotency_key),
  };
}

function claimedGatewayScope(value: unknown) {
  const input = asRecord(value);
  return {
    tenantId: claimedId(input?.tenantId, 'invalid-tenant'),
    incidentId: claimedId(input?.incidentId, 'invalid-incident'),
    planId: claimedId(asRecord(input?.plan)?.planId, 'invalid-plan'),
    approvalId: claimedId(input?.approvalId, 'invalid-approval'),
    actionId: claimedId(asRecord(input?.action)?.actionId, 'invalid-action'),
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function claimedId(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : fallback;
}
