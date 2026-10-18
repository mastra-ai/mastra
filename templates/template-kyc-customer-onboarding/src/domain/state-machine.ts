import { z } from 'zod';

import { kycCaseSchema, type KycCase, type KycCaseStatus } from './case.js';
import { actorSchema, policyReferenceSchema } from './context.js';
import { DomainInvariantError, InvalidStateTransitionError } from './errors.js';
import {
  caseStatusTransitionedEventSchema,
  transitionCommandSchema,
  type CaseStatusTransitionedEvent,
  type TransitionCommand,
} from './events.js';
import {
  correlationIdSchema,
  eventIdSchema,
  evidenceIdSchema,
  idempotencyKeySchema,
  timestampSchema,
  workflowRunIdSchema,
} from './identifiers.js';

const transitionInputSchema = z
  .object({
    command: transitionCommandSchema.exclude(['CREATE_CASE']),
    eventId: eventIdSchema,
    reasonCode: z.string().min(1).max(100),
    actor: actorSchema,
    occurredAt: timestampSchema,
    correlationId: correlationIdSchema,
    policy: policyReferenceSchema,
    evidenceIds: z.array(evidenceIdSchema).default([]),
    idempotencyKey: idempotencyKeySchema,
    workflowRunId: workflowRunIdSchema.optional(),
  })
  .strict();

export type TransitionCaseInput = z.input<typeof transitionInputSchema>;

const transitions = {
  DRAFT: { SUBMIT_APPLICATION: 'SUBMITTED' },
  SUBMITTED: { BEGIN_EXTRACTION: 'EXTRACTING' },
  EXTRACTING: {
    ADD_DOCUMENT: 'EXTRACTING',
    BEGIN_CHECKS: 'CHECKING',
    REQUEST_INFORMATION: 'MISSING_INFORMATION',
  },
  CHECKING: {
    REQUEST_INFORMATION: 'MISSING_INFORMATION',
    BEGIN_RISK_ASSESSMENT: 'ASSESSING_RISK',
  },
  MISSING_INFORMATION: {
    RESUME_EXTRACTION: 'EXTRACTING',
    EXHAUST_INFORMATION_REQUESTS: 'ASSESSING_RISK',
  },
  ASSESSING_RISK: { REQUEST_COMPLIANCE_REVIEW: 'COMPLIANCE_REVIEW' },
  COMPLIANCE_REVIEW: { APPROVE: 'APPROVED', REJECT: 'REJECTED', ESCALATE: 'ESCALATED' },
  ESCALATED: { RETURN_TO_COMPLIANCE_REVIEW: 'COMPLIANCE_REVIEW' },
  APPROVED: { BEGIN_PROVISIONING: 'PROVISIONING' },
  REJECTED: {},
  PROVISIONING: { ACTIVATE: 'ACTIVE', FAIL_PROVISIONING: 'PROVISIONING_FAILED' },
  ACTIVE: {},
  PROVISIONING_FAILED: {},
} as const satisfies Record<KycCaseStatus, Partial<Record<TransitionCommand, KycCaseStatus>>>;

export const allowedTransitions = transitions;

const commandsRequiringEvidence = new Set<TransitionCommand>([
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
]);

const assertTransitionGuards = (
  command: TransitionCommand,
  actor: z.infer<typeof actorSchema>,
  evidenceIds: string[],
): void => {
  if (commandsRequiringEvidence.has(command) && evidenceIds.length === 0) {
    throw new DomainInvariantError(`${command} requires evidence`);
  }
  if (['APPROVE', 'REJECT', 'ESCALATE'].includes(command) && actor.type !== 'reviewer') {
    throw new DomainInvariantError(`${command} requires a reviewer actor`);
  }
  if (
    command === 'RETURN_TO_COMPLIANCE_REVIEW' &&
    (actor.type !== 'reviewer' || !actor.roles.includes('senior-reviewer'))
  ) {
    throw new DomainInvariantError('RETURN_TO_COMPLIANCE_REVIEW requires a senior reviewer');
  }
};

export const transitionCase = (
  current: KycCase,
  rawInput: TransitionCaseInput,
): Readonly<{ case: KycCase; event: CaseStatusTransitionedEvent }> => {
  const input = transitionInputSchema.parse(rawInput);
  if (
    current.policy.id !== input.policy.id ||
    current.policy.version !== input.policy.version ||
    current.policy.checksum !== input.policy.checksum
  ) {
    throw new DomainInvariantError('Transition policy does not match the policy pinned to the case');
  }
  if (new Date(input.occurredAt).getTime() < new Date(current.updatedAt).getTime()) {
    throw new DomainInvariantError('Transition time cannot precede the current case update time');
  }
  const nextStatus = transitions[current.status][input.command as keyof (typeof transitions)[typeof current.status]] as
    | KycCaseStatus
    | undefined;
  if (nextStatus === undefined) {
    throw new InvalidStateTransitionError(current.status, input.command);
  }

  assertTransitionGuards(input.command, input.actor, input.evidenceIds);
  if (input.workflowRunId !== undefined && input.command !== 'SUBMIT_APPLICATION') {
    throw new DomainInvariantError('A workflow run can only be bound while submitting a case');
  }
  if (input.workflowRunId !== undefined && current.workflowRunId !== null) {
    throw new DomainInvariantError('The case is already bound to a workflow run');
  }
  const nextCase = kycCaseSchema.parse({
    ...current,
    status: nextStatus,
    workflowRunId: input.workflowRunId ?? current.workflowRunId,
    updatedAt: input.occurredAt,
    version: current.version + 1,
  });
  const event = caseStatusTransitionedEventSchema.parse({
    type: 'CASE_STATUS_TRANSITIONED',
    id: input.eventId,
    tenantId: current.tenantId,
    caseId: current.id,
    previousStatus: current.status,
    nextStatus,
    command: input.command,
    reasonCode: input.reasonCode,
    actor: input.actor,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    policy: input.policy,
    evidenceIds: input.evidenceIds,
    idempotencyKey: input.idempotencyKey,
    caseVersion: nextCase.version,
  });
  return Object.freeze({ case: nextCase, event });
};
