import { DomainError } from '../domain/errors.js';
import type { Evidence } from '../schemas/evidence.js';
import type { ContainmentAction, ContainmentActionType } from '../schemas/containment.js';
import type { DecisionContext } from '../triage/decision-context.js';
import {
  ContainmentAnalysisCandidateSchema,
  type ContainmentAnalysisCandidate,
  type SeverityDecision,
} from '../triage/decision-contracts.js';
import { assertSeverityDecision } from '../triage/decision-validation.js';
import { evaluateSeverityPolicy, resolveTrustedFact } from '../triage/policy.js';
import { normalizeContainmentCandidate } from './candidate-normalization.js';
import { assertSingleTarget } from './target-validation.js';

export { normalizeContainmentCandidate } from './candidate-normalization.js';

const targetToken: Readonly<Record<ContainmentActionType, 'target-1' | 'target-2' | 'target-3'>> = {
  restore_previous_role: 'target-1',
  require_reauthentication: 'target-1',
  revoke_session: 'target-2',
  mark_device_for_review: 'target-3',
};

const inputToken: Readonly<Record<ContainmentActionType, 'input-1' | 'input-2' | 'input-3' | 'input-4'>> = {
  restore_previous_role: 'input-1',
  revoke_session: 'input-2',
  mark_device_for_review: 'input-3',
  require_reauthentication: 'input-4',
};

export function createContainmentCandidate(
  context: DecisionContext,
  decision: SeverityDecision,
  supportedActionTypes?: readonly ContainmentActionType[],
): ContainmentAnalysisCandidate {
  assertContainmentEligible(context, decision);
  const supported = supportedActionTypes ? new Set(supportedActionTypes) : undefined;
  return ContainmentAnalysisCandidateSchema.parse({
    schemaVersion: 1,
    actions: context.allowedActions.flatMap(actionType =>
      (!supported || supported.has(actionType)) && canResolveAction(context, actionType)
        ? [
            {
              actionType,
              targetToken: targetToken[actionType],
              inputToken: inputToken[actionType],
            },
          ]
        : [],
    ),
  });
}

export function resolveContainmentActions(
  context: DecisionContext,
  decision: SeverityDecision,
  candidateValue: unknown,
  supportedActionTypes?: readonly ContainmentActionType[],
): readonly Omit<ContainmentAction, 'actionId'>[] {
  assertContainmentEligible(context, decision);
  const candidate = ContainmentAnalysisCandidateSchema.safeParse(candidateValue);
  if (!candidate.success) throw new DomainError('VALIDATION_FAILED');
  const allowed = new Set(context.allowedActions);
  const seen = new Set<string>();
  const actions: Omit<ContainmentAction, 'actionId'>[] = [];
  for (const item of normalizeContainmentCandidate(candidate.data).actions) {
    if (!allowed.has(item.actionType)) throw new DomainError('VALIDATION_FAILED');
    if (seen.has(item.actionType)) throw new DomainError('CONFLICT');
    seen.add(item.actionType);
    if (item.targetToken !== targetToken[item.actionType] || item.inputToken !== inputToken[item.actionType])
      throw new DomainError('VALIDATION_FAILED');
    actions.push(resolveAction(context, item.actionType));
  }
  if (
    normalizeContainmentCandidate(candidate.data)
      .actions.map(item => item.actionType)
      .join('\0') !==
    normalizeContainmentCandidate(createContainmentCandidate(context, decision, supportedActionTypes))
      .actions.map(item => item.actionType)
      .join('\0')
  )
    throw new DomainError('VALIDATION_FAILED');
  return Object.freeze(actions);
}

function canResolveAction(context: DecisionContext, actionType: ContainmentActionType): boolean {
  const { sessionId, deviceId, subjectId } = context.correlation.context;
  if (actionType === 'restore_previous_role') {
    const prior = trustedFact(context, 'role.previous')?.fact.value;
    return prior === 'member' || prior === 'viewer';
  }
  if (actionType === 'revoke_session' || actionType === 'require_reauthentication')
    return Boolean(sessionId && trustedFact(context, 'session.subject')?.fact.value === subjectId);
  return Boolean(
    deviceId &&
    trustedFact(context, 'device.signatureValid')?.fact.value === true &&
    trustedFact(context, 'device.authorized')?.fact.value === false,
  );
}

function resolveAction(
  context: DecisionContext,
  actionType: ContainmentActionType,
): Omit<ContainmentAction, 'actionId'> {
  const { subjectId, sessionId, deviceId } = context.correlation.context;
  const runbookPrecondition = `Action is allowlisted by [runbook:${context.runbook.metadata.id}@${context.runbook.metadata.version}].`;
  if (actionType === 'restore_previous_role') {
    const prior = trustedFact(context, 'role.previous');
    if (prior?.fact.value !== 'member' && prior?.fact.value !== 'viewer') fail();
    assertSingleTarget(subjectId);
    return {
      type: actionType,
      targetId: subjectId,
      input: { role: prior.fact.value },
      impact: 'Restores the previously persisted non-administrative role.',
      preconditions: [`Previous role is integrity-verified [evidence:${prior.evidenceId}].`, runbookPrecondition],
      rollback: 'Stop and require a separately approved identity-administration plan.',
      verification: 'Confirm only the scoped subject has the preserved previous role.',
    };
  }
  if (actionType === 'revoke_session') {
    const sessionEvidence = trustedFact(context, 'session.subject');
    if (!sessionId || sessionEvidence?.fact.value !== subjectId) fail();
    assertSingleTarget(sessionId);
    return {
      type: actionType,
      targetId: sessionId,
      input: {},
      impact: 'Revokes only the explicitly scoped session.',
      preconditions: [
        `Session ownership is integrity-verified [evidence:${sessionEvidence.evidenceId}].`,
        runbookPrecondition,
      ],
      rollback: 'Session revocation is irreversible; normal authentication creates a new session.',
      verification: 'Confirm the scoped session is revoked and unrelated sessions are unchanged.',
    };
  }
  if (actionType === 'mark_device_for_review') {
    const signature = trustedFact(context, 'device.signatureValid');
    const authorization = trustedFact(context, 'device.authorized');
    if (!deviceId || signature?.fact.value !== true || authorization?.fact.value !== false) fail();
    assertSingleTarget(deviceId);
    return {
      type: actionType,
      targetId: deviceId,
      input: { reviewState: 'pending' },
      impact: 'Marks only the scoped application-issued device for human review.',
      preconditions: [
        `Device signature is valid [evidence:${signature.evidenceId}].`,
        `Device is not authorized [evidence:${authorization.evidenceId}].`,
        runbookPrecondition,
      ],
      rollback: 'A separate authenticated review may clear the marker.',
      verification: 'Confirm only the scoped device has a pending review marker.',
    };
  }
  const sessionEvidence = trustedFact(context, 'session.subject');
  if (!sessionId || sessionEvidence?.fact.value !== subjectId) fail();
  assertSingleTarget(subjectId);
  return {
    type: actionType,
    targetId: subjectId,
    input: { sessionId },
    impact: 'Requires reauthentication only for the scoped subject and session context.',
    preconditions: [
      `Session ownership is integrity-verified [evidence:${sessionEvidence.evidenceId}].`,
      runbookPrecondition,
    ],
    rollback: 'A separate authenticated policy decision is required to change this requirement.',
    verification: 'Confirm reauthentication is required only for the scoped subject.',
  };
}

function trustedFact(
  context: DecisionContext,
  factType: 'role.previous' | 'session.subject' | 'device.signatureValid' | 'device.authorized',
): Evidence | undefined {
  return resolveTrustedFact(context.correlation.context, context.evidence, factType);
}

function assertContainmentEligible(context: DecisionContext, decision: SeverityDecision): void {
  assertSeverityDecision(context, decision);
  const evaluation = evaluateSeverityPolicy(
    context.correlation.context,
    context.evidence,
    context.correlation.contradictions.length,
  );
  if (
    evaluation.outcome !== 'classified' ||
    evaluation.rationaleCode !== 'central-event' ||
    evaluation.severity !== decision.severity
  )
    fail();
}

function fail(): never {
  throw new DomainError('VALIDATION_FAILED');
}
