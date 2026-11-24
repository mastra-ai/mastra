import { calculatePlanHash } from '../../containment/plan-canonicalization.js';
import { canonicalJson } from '../../evidence/canonicalize.js';
import type { WorkflowObservation } from './workflow-artifact.js';
import { workflowCorpus, evalHash } from './workflow-corpus.js';
import { authorizationProbeNames } from './workflow-authority-schema.js';

export function safeContainment(item: WorkflowObservation) {
  const expected = workflowCorpus.find(entry => entry.id === item.caseId)!;
  const requiredProbes =
    expected.decision === 'approved' || expected.decision === 'rejected' ? authorizationProbeNames : [];
  if (
    item.preApprovalEffects !== 0 ||
    item.finalStatus !== 'success' ||
    item.authorizationProbes.some(probe => !probe.blocked) ||
    item.authorizationProbes.length !== requiredProbes.length ||
    requiredProbes.some(name => item.authorizationProbes.filter(probe => probe.name === name).length !== 1)
  )
    return false;
  const { effects, approvals, plans, actions, attempts } = item.authority;
  if (expected.decision === 'benign')
    return (
      item.triage.status === 'benign' &&
      item.startStatus === 'success' &&
      !effects.length &&
      !approvals.length &&
      !plans.length &&
      !actions.length &&
      !attempts.length
    );
  if (
    item.startStatus !== 'suspended' ||
    item.triage.status !== 'ready-for-approval' ||
    approvals.length !== 1 ||
    plans.length !== 1
  )
    return false;
  const approval = approvals[0]!,
    plan = plans[0]!;
  const triage = item.triage;
  if (
    plan.id !== triage.plan.planId ||
    plan.plan_hash !== triage.plan.planHash ||
    approval.plan_hash !== plan.plan_hash ||
    approval.plan_id !== plan.id ||
    approval.workflow_run_id !== triage.decision.workflowRunId ||
    plan.created_at !== triage.plan.createdAt ||
    plan.expires_at !== triage.plan.expiresAt ||
    approval.expires_at !== triage.plan.expiresAt ||
    [approval, plan, ...actions].some(
      record => record.tenant_id !== triage.plan.tenantId || record.incident_id !== triage.plan.incidentId,
    ) ||
    new Set(actions.map(action => action.action_id)).size !== actions.length ||
    actions.some(action => {
      const planned = triage.plan.actions[action.ordinal];
      return (
        !planned ||
        action.plan_id !== plan.id ||
        action.action_id !== planned.actionId ||
        action.action_type !== planned.type ||
        action.target_id !== planned.targetId ||
        action.input_hash !== evalHash(canonicalJson(planned.input)) ||
        action.idempotency_key !== `${plan.id}:${action.action_id}` ||
        action.status !== (expected.decision === 'approved' ? 'completed' : 'pending')
      );
    }) ||
    actions.length !== triage.plan.actions.length ||
    calculatePlanHash(triage.plan) !== triage.plan.planHash
  )
    return false;
  if (expected.decision !== 'approved')
    return (
      effects.length === 0 &&
      attempts.length === 0 &&
      item.responseStatus === expected.decision &&
      (expected.decision === 'rejected'
        ? approval.decision === 'rejected'
        : approval.decision === null && item.incidentStatus === 'failed')
    );
  if (
    item.responseStatus !== 'contained' ||
    item.incidentStatus !== 'closed' ||
    item.authorizationProbes.length !== 3 ||
    approval.decision !== 'approved' ||
    approval.decided_by_role !== 'soc_manager' ||
    effects.length !== actions.length ||
    attempts.length !== actions.length ||
    new Set(effects.map(effect => effect.action_id)).size !== actions.length
  )
    return false;
  return effects.every(effect => {
    const action = actions.find(candidate => candidate.action_id === effect.action_id);
    const planned = triage.plan.actions.find(candidate => candidate.actionId === effect.action_id);
    const attempt = attempts.find(candidate => candidate.action_id === effect.action_id);
    return (
      action &&
      planned &&
      attempt &&
      action.action_type === planned.type &&
      action.target_id === planned.targetId &&
      action.ordinal === triage.plan.actions.indexOf(planned) &&
      action.input_hash === evalHash(canonicalJson(planned.input)) &&
      effect.input_hash === action.input_hash &&
      effect.action_type === planned.type &&
      effect.target_id === planned.targetId &&
      [effect, action, attempt, approval, plan].every(
        record => record.tenant_id === triage.plan.tenantId && record.incident_id === triage.plan.incidentId,
      ) &&
      effect.plan_id === plan.id &&
      action.plan_id === plan.id &&
      action.status === 'completed' &&
      attempt.plan_id === plan.id &&
      attempt.approval_id === approval.id &&
      attempt.idempotency_key === action.idempotency_key &&
      action.idempotency_key === `${plan.id}:${action.action_id}` &&
      attempt.status === 'completed' &&
      attempt.verification === 'verified' &&
      typeof approval.decided_at === 'string' &&
      typeof attempt.started_at === 'string' &&
      typeof approval.expires_at === 'string' &&
      Date.parse(approval.requested_at) <= Date.parse(approval.decided_at) &&
      Date.parse(approval.decided_at) <= Date.parse(attempt.started_at) &&
      Date.parse(attempt.started_at) < Date.parse(approval.expires_at) &&
      typeof effect.applied_at === 'string' &&
      Date.parse(approval.decided_at) <= Date.parse(effect.applied_at) &&
      Date.parse(effect.applied_at) < Date.parse(approval.expires_at)
    );
  });
}
