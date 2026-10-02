import type { NotificationProvider } from '../contracts/communications/notifications.js';
import type {
  InformationRequestRepository,
  WorkflowResumeCommandRepository,
} from '../contracts/repositories/decision-repositories.js';
import type { Clock } from '../contracts/technical/primitives.js';
import { durableJurisdictionPolicySchema } from '../contracts/policies/policies.js';
import { executionContextSchema } from '../domain/context.js';
import { DomainInvariantError } from '../domain/errors.js';
import { informationRequestSchema, workflowResumeCommandSchema } from '../domain/hitl.js';
import type { CompletenessAssessment } from './completeness-assessment.js';
import { createStableIdentifier, fingerprintValue } from './stable-identifiers.js';

export class MissingInformationService {
  constructor(
    private readonly requests: InformationRequestRepository,
    private readonly commands: WorkflowResumeCommandRepository,
    private readonly notifications: NotificationProvider,
    private readonly clock: Clock,
  ) {}

  async request(
    input: Readonly<{
      execution: unknown;
      caseId: string;
      workflowId: string;
      workflowRunId: string;
      workflowStepId: string;
      threadId: string;
      policy: unknown;
      completeness: CompletenessAssessment;
      idempotencyKey: string;
    }>,
  ) {
    const execution = executionContextSchema.parse(input.execution);
    const policy = durableJurisdictionPolicySchema.parse(input.policy);
    if (
      execution.policy.id !== policy.id ||
      execution.policy.version !== policy.version ||
      execution.policy.checksum !== policy.checksum
    ) {
      throw new DomainInvariantError('Missing-information context does not match pinned policy');
    }
    if (input.completeness.status !== 'MISSING_INFORMATION') {
      throw new DomainInvariantError('Information can be requested only for an incomplete case');
    }
    if (!execution.actor.roles.includes('applicant')) {
      throw new DomainInvariantError('Missing-information request requires a trusted applicant actor');
    }
    const createdAt = this.clock.now().toISOString();
    const expiresAt = new Date(
      this.clock.now().getTime() + policy.missingInformation.resumeTtlHours * 60 * 60 * 1000,
    ).toISOString();
    const round = input.completeness.completedRounds + 1;
    const requestId = createStableIdentifier(
      'information-request',
      execution.tenantId,
      `${input.idempotencyKey}:round:${String(round)}`,
    );
    const responseId = createStableIdentifier('information-response', execution.tenantId, requestId);
    const commandId = createStableIdentifier('resume-command', execution.tenantId, requestId);
    const caseReference = `KYC-${input.caseId.slice(-12)}`;
    const safeMessage = `Additional information is required for case ${caseReference}.`;
    const actionPath = 'Continue this Studio task to provide the requested information.';
    const request = informationRequestSchema.parse({
      id: requestId,
      tenantId: execution.tenantId,
      caseId: input.caseId,
      workflowId: input.workflowId,
      workflowRunId: input.workflowRunId,
      workflowStepId: input.workflowStepId,
      threadId: input.threadId,
      round,
      maxRounds: policy.missingInformation.maxRounds,
      requestedItems: input.completeness.requestedItems,
      reasonCodes: input.completeness.reasonCodes,
      safeMessage,
      actionPath,
      status: 'PENDING',
      policy: execution.policy,
      expiresAt,
      respondedAt: null,
      createdAt,
      updatedAt: createdAt,
      version: 1,
    });
    const requestFingerprint = fingerprintValue({
      tenantId: execution.tenantId,
      caseId: input.caseId,
      requestId,
      responseId,
      policy: execution.policy,
      actionType: 'MISSING_INFORMATION',
    });
    const command = workflowResumeCommandSchema.parse({
      id: commandId,
      tenantId: execution.tenantId,
      caseId: input.caseId,
      workflowId: input.workflowId,
      workflowRunId: input.workflowRunId,
      workflowStepId: input.workflowStepId,
      threadId: input.threadId,
      actionType: 'MISSING_INFORMATION',
      targetId: requestId,
      authorizedActorId: execution.actor.id,
      requiredRole: 'applicant',
      requestFingerprint,
      payloadFingerprint: null,
      idempotencyKey: `${input.idempotencyKey}:resume-command:${String(round)}`,
      resumePayloadId: responseId,
      status: 'PENDING',
      expiresAt,
      executionStartedAt: null,
      consumedAt: null,
      resultReference: null,
      completedOutcome: null,
      resultFingerprint: null,
      createdAt,
      updatedAt: createdAt,
      version: 1,
    });
    const persistedRequest = await this.requests.create({
      request,
      idempotencyKey: `${input.idempotencyKey}:information-request:${String(round)}`,
    });
    const persistedCommand = await this.commands.create({ command });
    const notificationId = createStableIdentifier('notification', execution.tenantId, requestId);
    await this.notifications.send(
      {
        notification: {
          id: notificationId,
          tenantId: execution.tenantId,
          caseId: input.caseId,
          type: 'INFORMATION_REQUIRED',
          safeMessage,
          actionPath,
          createdAt: persistedRequest.createdAt,
        },
        idempotencyKey: `${input.idempotencyKey}:notification:${String(round)}`,
      },
      {
        execution,
        deadlineAt: persistedRequest.expiresAt,
        attempt: 1,
        idempotencyKey: input.idempotencyKey,
      },
    );
    return { request: persistedRequest, command: persistedCommand };
  }
}
