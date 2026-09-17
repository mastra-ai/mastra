import type { TransitionCommand } from '../domain/events.js';
import { kycCaseSchema } from '../domain/case.js';
import { transitionCase } from '../domain/state-machine.js';
import { demoDefaultPolicy } from '../config/policies/demo-default.js';

export type KycEvalReviewAction = 'APPROVE' | 'REJECT' | 'ESCALATE' | 'NONE';

export type KycEvalAutomaticCommand = Exclude<
  TransitionCommand,
  | 'CREATE_CASE'
  | 'APPROVE'
  | 'REJECT'
  | 'ESCALATE'
  | 'RETURN_TO_COMPLIANCE_REVIEW'
  | 'BEGIN_PROVISIONING'
  | 'ACTIVATE'
  | 'FAIL_PROVISIONING'
>;

const reviewCommands = (action: KycEvalReviewAction): Exclude<TransitionCommand, 'CREATE_CASE'>[] =>
  action === 'APPROVE' ? ['APPROVE', 'BEGIN_PROVISIONING', 'ACTIVATE'] : action === 'NONE' ? [] : [action];

export const applyKycEvalReviewHarness = (
  input: Readonly<{
    scenarioId: string;
    automaticCommands: readonly KycEvalAutomaticCommand[];
    reviewAction: KycEvalReviewAction;
  }>,
) => {
  const policy = {
    id: demoDefaultPolicy.id,
    version: demoDefaultPolicy.version,
    checksum: demoDefaultPolicy.checksum,
  };
  let current = kycCaseSchema.parse({
    id: `eval-case-${input.scenarioId}`,
    tenantId: 'eval',
    applicationId: `eval-application-${input.scenarioId}`,
    jurisdiction: 'US',
    policyProfile: 'demo-default',
    policy,
    status: 'DRAFT',
    workflowRunId: null,
    createdAt: '2026-08-22T12:00:00.000Z',
    updatedAt: '2026-08-22T12:00:00.000Z',
    version: 1,
  });
  const trajectory: string[] = [];
  const commands = [...input.automaticCommands, ...reviewCommands(input.reviewAction)];
  for (const [index, command] of commands.entries()) {
    const reviewerCommand = ['APPROVE', 'REJECT', 'ESCALATE'].includes(command);
    const needsEvidence = [
      'BEGIN_CHECKS',
      'BEGIN_RISK_ASSESSMENT',
      'EXHAUST_INFORMATION_REQUESTS',
      'REQUEST_COMPLIANCE_REVIEW',
      'APPROVE',
      'REJECT',
      'ESCALATE',
      'RETURN_TO_COMPLIANCE_REVIEW',
      'ACTIVATE',
      'FAIL_PROVISIONING',
    ].includes(command);
    current = transitionCase(current, {
      command,
      eventId: `eval-event-${input.scenarioId}-${String(index + 1)}`,
      reasonCode: `EVAL_${command}`,
      actor: reviewerCommand
        ? { type: 'reviewer', id: 'eval-reviewer', roles: ['reviewer'] }
        : { type: 'system', id: 'eval-runtime', roles: [] },
      occurredAt: '2026-08-22T12:00:00.000Z',
      correlationId: `eval-correlation-${input.scenarioId}`,
      policy,
      evidenceIds: needsEvidence ? [`eval-evidence-${input.scenarioId}`] : [],
      idempotencyKey: `eval-${input.scenarioId}-${String(index + 1).padStart(4, '0')}`,
    }).case;
    trajectory.push(current.status);
  }
  return Object.freeze({
    trajectory,
    decision: current.status,
    escalated: trajectory.includes('ESCALATED'),
  });
};
