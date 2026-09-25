import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type {
  CasePolicySnapshotRepository,
  ComplianceReviewRepository,
  InformationRequestRepository,
  WorkflowResumeCommandRepository,
} from '../../contracts/repositories/decision-repositories.js';
import type { ApplicationRepository } from '../../contracts/repositories/application-repository.js';
import type { CaseRepository } from '../../contracts/repositories/case-repository.js';
import type { DocumentRepository } from '../../contracts/repositories/document-repository.js';
import type { StudioCaseLinkRepository } from '../../contracts/repositories/studio-case-link-repository.js';
import type { Clock } from '../../contracts/technical/primitives.js';
import { durableJurisdictionPolicySchema } from '../../contracts/policies/policies.js';
import {
  DomainInvariantError,
  NotFoundError,
  StudioContextError,
  WorkflowExecutionError,
} from '../../domain/errors.js';
import { informationResponseSchema, type InformationRequest, type WorkflowResumeCommand } from '../../domain/hitl.js';
import type { Actor } from '../../domain/context.js';
import type { DocumentType, IdentityDocument } from '../../domain/documents.js';
import {
  applicationCorrectionsSchema,
  applicationSchema,
  type ApplicationCorrections,
} from '../../domain/application.js';
import { getFixtureScenario } from '../../fixtures/provider-scenarios.js';
import { kycTracingOptions } from '../../observability/tracing.js';
import type { ComplianceReviewService } from '../../services/compliance-review.js';
import type { DocumentExtractionService } from '../../services/document-extraction.js';
import type { DocumentIntakeService } from '../../services/document-intake.js';
import { fingerprintValue } from '../../services/stable-identifiers.js';
import {
  durableKycWorkflowOutputSchema,
  type DurableKycOnboardingWorkflow,
} from '../workflows/durable-kyc-onboarding.js';
import {
  createStudioRequestContext,
  deriveStudioThreadKey,
  serializeStudioThread,
  type TrustedKycStudioDefaults,
} from './studio-context.js';
import { parseWorkflowPendingAction, workflowPendingActionSchema } from './workflow-pending-action.js';

const caseReferenceSchema = z.string().regex(/^KYC-[a-z0-9]{12}$/u);
const responseOptionSchema = informationResponseSchema.shape.responseOption;
const fixtureResponseQualitySchema = z.enum(['COMPLETE', 'STILL_INCOMPLETE']).optional();
const resumeIntentSchema = z.enum(['REPLAY_PREVIOUS', 'ANSWER_CURRENT']).optional();

export const pendingKycActionSummarySchema = z
  .object({
    caseReference: caseReferenceSchema,
    action: z.enum(['MISSING_INFORMATION', 'COMPLIANCE_REVIEW']),
    level: z.enum(['INITIAL', 'SENIOR']).nullable(),
    requestedItems: z.array(z.string().min(1).max(100)),
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).nullable(),
    safeMessage: z.string().min(1).max(500),
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const listPendingKycActionsOutputSchema = z
  .object({ actions: z.array(pendingKycActionSummarySchema), requiresSelection: z.boolean() })
  .strict();

export const resumeKycApplicationOutputSchema = z
  .object({
    caseReference: caseReferenceSchema,
    workflowStatus: z.enum(['SUSPENDED', 'COMPLETED']),
    pendingAction: workflowPendingActionSchema.nullable(),
    result: durableKycWorkflowOutputSchema.nullable(),
    message: z.string().min(1).max(500),
  })
  .strict();

export type ResumeKycDependencies = Readonly<{
  workflow: DurableKycOnboardingWorkflow;
  cases: CaseRepository;
  applications: ApplicationRepository;
  snapshots: CasePolicySnapshotRepository;
  informationRequests: InformationRequestRepository;
  reviews: ComplianceReviewRepository;
  commands: WorkflowResumeCommandRepository;
  documents: DocumentRepository;
  studioCaseLinks: StudioCaseLinkRepository;
  documentIntake: DocumentIntakeService;
  documentExtraction: DocumentExtractionService;
  complianceReview: ComplianceReviewService;
  clock: Clock;
  modelId: string;
  schemaVersion: string;
  timeoutMs: number;
  trustedDefaults: TrustedKycStudioDefaults;
}>;

const caseReference = (caseId: string): z.infer<typeof caseReferenceSchema> =>
  caseReferenceSchema.parse(`KYC-${caseId.slice(-12)}`);

const reviewerFor = (level: 'INITIAL' | 'SENIOR'): Actor =>
  level === 'SENIOR'
    ? { type: 'reviewer', id: 'studio-senior-reviewer', roles: ['senior-reviewer'] }
    : {
        type: 'reviewer',
        id: 'studio-reviewer',
        roles: ['reviewer', 'senior-reviewer'],
      };

const correctionItemByField = Object.freeze({
  fullName: 'FULL_NAME',
  dateOfBirth: 'DATE_OF_BIRTH',
  documentNumber: 'DOCUMENT_NUMBER',
  expirationDate: 'EXPIRATION_DATE',
  residentialAddress: 'RESIDENTIAL_ADDRESS',
} as const);

type InformationResponseDocument = Readonly<{
  documentType: Exclude<DocumentType, 'UNKNOWN'>;
  side: IdentityDocument['side'];
}>;

export const resolveInformationResponseDocument = (
  responseOption: z.infer<typeof responseOptionSchema>,
  fallbackDocumentType: Exclude<DocumentType, 'UNKNOWN'>,
  documents: readonly IdentityDocument[],
  policy: z.infer<typeof durableJurisdictionPolicySchema>,
): InformationResponseDocument => {
  if (responseOption === 'PROOF_OF_ADDRESS') {
    return { documentType: 'PROOF_OF_ADDRESS', side: 'SINGLE' };
  }
  const identityDocuments = documents
    .filter(document => policy.identityDocumentRequirements.some(requirement => requirement.type === document.type))
    .toSorted((left, right) =>
      [left.createdAt, left.id].join('\0').localeCompare([right.createdAt, right.id].join('\0')),
    );
  if (responseOption === 'IDENTITY_DOCUMENT_BACK') {
    const document = identityDocuments.find(
      candidate =>
        candidate.side === 'FRONT' &&
        policy.identityDocumentRequirements.some(
          requirement => requirement.type === candidate.type && requirement.sides.includes('BACK'),
        ),
    );
    if (document === undefined || document.type === 'UNKNOWN') {
      throw new DomainInvariantError('No compatible identity document requires a back side');
    }
    return { documentType: document.type, side: 'BACK' };
  }
  if (responseOption === 'READABLE_DOCUMENT') {
    const document = identityDocuments.at(0);
    if (document === undefined || document.type === 'UNKNOWN') {
      throw new DomainInvariantError('No compatible identity document can be replaced');
    }
    return { documentType: document.type, side: document.side };
  }
  return { documentType: fallbackDocumentType, side: 'SINGLE' };
};

export const validateInformationResponse = (
  request: InformationRequest,
  responseOption: z.infer<typeof responseOptionSchema>,
  applicationCorrections: ApplicationCorrections | null,
): void => {
  const requested = new Set(request.requestedItems);
  if (responseOption === 'CORRECTED_APPLICATION') {
    const corrections = normalizeApplicationCorrections(applicationCorrections);
    if (corrections === null) {
      throw new DomainInvariantError('Application corrections are required');
    }
    const incompatible = Object.keys(corrections).some(
      field => !requested.has(correctionItemByField[field as keyof typeof correctionItemByField]),
    );
    if (incompatible) {
      throw new DomainInvariantError('Application correction does not match the requested information');
    }
    return;
  }
  if (applicationCorrections !== null) {
    throw new DomainInvariantError('Application corrections require CORRECTED_APPLICATION');
  }
  const expectedItem = responseOption === 'READABLE_DOCUMENT' ? 'DOCUMENT_READABILITY' : responseOption;
  if (!requested.has(expectedItem)) {
    throw new DomainInvariantError('Information response does not match the requested items');
  }
};

const normalizeApplicationCorrections = (corrections: ApplicationCorrections | null): ApplicationCorrections | null => {
  if (corrections === null) return null;
  return applicationCorrectionsSchema.parse(
    Object.fromEntries(Object.entries(corrections).filter(([, value]) => value !== undefined)),
  );
};

const loadPending = async (dependencies: ResumeKycDependencies, threadId: string) =>
  dependencies.commands.listPending({
    tenantId: dependencies.trustedDefaults.tenantId,
    threadId,
    now: dependencies.clock.now().toISOString(),
  });

const loadForThread = (dependencies: ResumeKycDependencies, threadId: string) =>
  dependencies.commands.listForThread({
    tenantId: dependencies.trustedDefaults.tenantId,
    threadId,
  });

const chooseCommand = (
  commands: readonly WorkflowResumeCommand[],
  requestedReference: string | undefined,
): WorkflowResumeCommand => {
  const matching =
    requestedReference === undefined
      ? commands
      : commands.filter(command => caseReference(command.caseId) === requestedReference);
  if (matching.length === 0) throw new StudioContextError('No matching pending action was found');
  if (matching.length > 1) {
    throw new StudioContextError('More than one action is pending; select a case reference');
  }
  const selected = matching.at(0);
  if (selected === undefined) throw new StudioContextError('No matching pending action was found');
  return selected;
};

const chooseCommandWithAudit = async (
  dependencies: ResumeKycDependencies,
  commands: readonly WorkflowResumeCommand[],
  requestedReference: string | undefined,
  threadId: string,
  actionType: WorkflowResumeCommand['actionType'],
  actor: Actor,
  payloadFingerprint: string,
): Promise<WorkflowResumeCommand> => {
  try {
    return chooseCommand(commands, requestedReference);
  } catch (error) {
    const opaque = fingerprintValue({
      tenantId: dependencies.trustedDefaults.tenantId,
      threadId,
      actionType,
      requestedReference: requestedReference ?? null,
      payloadFingerprint,
    });
    await dependencies.commands.auditRejected({
      tenantId: dependencies.trustedDefaults.tenantId,
      commandId: `resume-command-${opaque.slice(0, 32)}`,
      caseId: `case-${opaque.slice(0, 32)}`,
      workflowId: 'kyc-application',
      workflowRunId: `workflow-${opaque.slice(0, 32)}`,
      workflowStepId: `studio-${actionType.toLowerCase()}`,
      threadId,
      actorId: actor.id,
      actorRoles: actor.roles,
      requestFingerprint: opaque,
      payloadFingerprint,
      acquiredAt: dependencies.clock.now().toISOString(),
      reasonCode: commands.length === 0 ? 'COMMAND_NOT_FOUND' : 'BINDING_INVALID',
    });
    throw error;
  }
};

const auditCommandRejection = (
  dependencies: ResumeKycDependencies,
  command: WorkflowResumeCommand,
  actor: Actor,
  payloadFingerprint: string,
  reasonCode: 'BINDING_INVALID' | 'COMMAND_EXPIRED' | 'STATE_CONFLICT',
) =>
  dependencies.commands.auditRejected({
    tenantId: command.tenantId,
    commandId: command.id,
    caseId: command.caseId,
    workflowId: command.workflowId,
    workflowRunId: command.workflowRunId,
    workflowStepId: command.workflowStepId,
    threadId: command.threadId,
    actorId: actor.id,
    actorRoles: actor.roles,
    requestFingerprint: command.requestFingerprint,
    payloadFingerprint,
    acquiredAt: dependencies.clock.now().toISOString(),
    reasonCode,
  });

const selectCommandForPayload = async (
  dependencies: ResumeKycDependencies,
  commands: readonly WorkflowResumeCommand[],
  requestedReference: string | undefined,
  threadId: string,
  actionType: WorkflowResumeCommand['actionType'],
  actor: Actor,
  intent: 'REPLAY_PREVIOUS' | 'ANSWER_CURRENT' | undefined,
  payloadFingerprintFor: (command: WorkflowResumeCommand) => string,
): Promise<{ command: WorkflowResumeCommand; payloadFingerprint: string }> => {
  const scoped = commands.filter(
    command =>
      command.actionType === actionType &&
      (requestedReference === undefined || caseReference(command.caseId) === requestedReference),
  );
  const current = scoped.filter(command => command.status === 'PENDING' || command.status === 'EXECUTING');
  const completed = scoped.filter(
    command => command.status === 'COMPLETED' && command.payloadFingerprint === payloadFingerprintFor(command),
  );
  if (intent === undefined && current.length > 0 && completed.length > 0) {
    const command = current.at(0);
    if (command !== undefined) {
      await auditCommandRejection(dependencies, command, actor, payloadFingerprintFor(command), 'BINDING_INVALID');
    }
    throw new StudioContextError(
      'The same response can replay the previous action or answer the current action; select a safe intent',
    );
  }
  if (intent !== 'ANSWER_CURRENT' && completed.length > 0) {
    const command = completed.at(-1);
    if (command !== undefined) {
      return { command, payloadFingerprint: payloadFingerprintFor(command) };
    }
  }
  if (intent !== 'REPLAY_PREVIOUS' && current.length > 0) {
    const command = chooseCommand(current, requestedReference);
    return { command, payloadFingerprint: payloadFingerprintFor(command) };
  }
  const preflightFingerprint = fingerprintValue({
    actionType,
    requestedReference: requestedReference ?? null,
    intent: intent ?? null,
  });
  const command = await chooseCommandWithAudit(
    dependencies,
    [],
    requestedReference,
    threadId,
    actionType,
    actor,
    preflightFingerprint,
  );
  return { command, payloadFingerprint: payloadFingerprintFor(command) };
};

export const contextForCommand = async (
  dependencies: ResumeKycDependencies,
  command: WorkflowResumeCommand,
  actor: Actor,
) => {
  const snapshot = await dependencies.snapshots.get({
    tenantId: command.tenantId,
    caseId: command.caseId,
  });
  const policy = durableJurisdictionPolicySchema.parse(snapshot.policy);
  return createStudioRequestContext(
    {
      ...dependencies.trustedDefaults,
      jurisdiction: policy.jurisdiction,
      piiMode: policy.profile,
      policyProfile: policy.profile,
      policy: { id: policy.id, version: policy.version, checksum: policy.checksum },
    },
    actor,
  );
};

const outcomeFromResult = (
  command: WorkflowResumeCommand,
  result: unknown,
): z.infer<typeof resumeKycApplicationOutputSchema> => {
  const record = z.looseObject({ status: z.string() }).parse(result);
  if (record.status === 'success') {
    return resumeKycApplicationOutputSchema.parse({
      caseReference: caseReference(command.caseId),
      workflowStatus: 'COMPLETED',
      pendingAction: null,
      result: durableKycWorkflowOutputSchema.parse(record.result),
      message: 'The durable onboarding workflow completed exactly once.',
    });
  }
  if (record.status === 'suspended') {
    return resumeKycApplicationOutputSchema.parse({
      caseReference: caseReference(command.caseId),
      workflowStatus: 'SUSPENDED',
      pendingAction: parseWorkflowPendingAction(record),
      result: null,
      message: 'The response was recorded and the workflow is waiting for its next bounded action.',
    });
  }
  throw new WorkflowExecutionError();
};

const resultReferenceFor = (
  command: WorkflowResumeCommand,
  outcome: z.infer<typeof resumeKycApplicationOutputSchema>,
) =>
  `${command.workflowRunId}:${outcome.workflowStatus}:${outcome.pendingAction?.commandId ?? outcome.result?.status ?? 'UNKNOWN'}`;

const completeCommand = async (
  dependencies: ResumeKycDependencies,
  command: WorkflowResumeCommand,
  outcome: z.infer<typeof resumeKycApplicationOutputSchema>,
) => {
  const completedAt = dependencies.clock.now().toISOString();
  const resultFingerprint = fingerprintValue(outcome);
  const completed = await dependencies.commands.complete({
    tenantId: command.tenantId,
    commandId: command.id,
    expectedVersion: command.version,
    resultReference: resultReferenceFor(command, outcome),
    completedOutcome: outcome,
    resultFingerprint,
    completedAt,
  });
  if (outcome.workflowStatus === 'COMPLETED') {
    await dependencies.studioCaseLinks.complete({
      tenantId: command.tenantId,
      workflowRunId: command.workflowRunId,
      completedAt,
    });
  }
  return completed;
};

export const outcomeFromCompletedCommand = async (
  dependencies: ResumeKycDependencies,
  command: WorkflowResumeCommand,
  actor: Actor,
): Promise<z.infer<typeof resumeKycApplicationOutputSchema>> => {
  if (command.completedOutcome === null || command.resultFingerprint === null) {
    const stored = await dependencies.workflow.getWorkflowRunById(command.workflowRunId, {
      fields: ['result', 'steps', 'suspendedPaths', 'resumeLabels'],
    });
    if (stored?.status !== 'success' && stored?.status !== 'suspended') {
      await auditCommandRejection(
        dependencies,
        command,
        actor,
        command.payloadFingerprint ?? command.requestFingerprint,
        'STATE_CONFLICT',
      );
      throw new WorkflowExecutionError();
    }
    const recovered = outcomeFromResult(command, stored);
    if (resultReferenceFor(command, recovered) !== command.resultReference) {
      await auditCommandRejection(
        dependencies,
        command,
        actor,
        command.payloadFingerprint ?? command.requestFingerprint,
        'STATE_CONFLICT',
      );
      throw new WorkflowExecutionError();
    }
    await completeCommand(dependencies, command, recovered);
    return recovered;
  }
  const outcome = resumeKycApplicationOutputSchema.parse(command.completedOutcome);
  if (fingerprintValue(outcome) !== command.resultFingerprint) throw new WorkflowExecutionError();
  return outcome;
};

export const acquireCommand = (
  dependencies: ResumeKycDependencies,
  command: WorkflowResumeCommand,
  actor: Actor,
  payloadFingerprint: string,
) =>
  dependencies.commands.acquire({
    tenantId: command.tenantId,
    commandId: command.id,
    caseId: command.caseId,
    workflowId: command.workflowId,
    workflowRunId: command.workflowRunId,
    workflowStepId: command.workflowStepId,
    threadId: command.threadId,
    actorId: actor.id,
    actorRoles: actor.roles,
    requestFingerprint: command.requestFingerprint,
    payloadFingerprint,
    expectedVersion: command.version,
    acquiredAt: dependencies.clock.now().toISOString(),
  });

export const resumeAcquired = async (
  dependencies: ResumeKycDependencies,
  acquired: WorkflowResumeCommand,
  actor: Actor,
  resumeData: unknown,
) => {
  const run = await dependencies.workflow.createRun({ runId: acquired.workflowRunId });
  const existing = await dependencies.workflow.getWorkflowRunById(acquired.workflowRunId, {
    fields: ['result', 'steps', 'suspendedPaths', 'resumeLabels'],
  });
  if (existing?.status === 'success') {
    const outcome = outcomeFromResult(acquired, existing);
    await completeCommand(dependencies, acquired, outcome);
    return outcome;
  }
  if (existing?.status === 'suspended') {
    const currentAction = parseWorkflowPendingAction(existing);
    if (currentAction.commandId !== acquired.id) {
      const outcome = outcomeFromResult(acquired, existing);
      await completeCommand(dependencies, acquired, outcome);
      return outcome;
    }
  }
  const studio = await contextForCommand(dependencies, acquired, actor);
  const label =
    acquired.actionType === 'MISSING_INFORMATION'
      ? `missing-information-${acquired.targetId}`
      : `compliance-review-${acquired.targetId}`;
  const result = await run.resume({
    label,
    resumeData,
    requestContext: studio.requestContext,
    tracingOptions: kycTracingOptions({
      operation: 'kyc.studio.workflow.resume',
      tenantId: acquired.tenantId,
      caseId: acquired.caseId,
      correlationId: studio.value.correlationId,
    }),
  });
  const outcome = outcomeFromResult(acquired, result);
  await completeCommand(dependencies, acquired, outcome);
  return outcome;
};

export const createListPendingKycActionsTool = (dependencies: ResumeKycDependencies) =>
  createTool({
    id: 'list-pending-kyc-actions-v1',
    description: 'List redacted KYC actions pending in the current trusted Studio thread',
    inputSchema: z.object({}).strict(),
    outputSchema: listPendingKycActionsOutputSchema,
    strict: true,
    execute: async (_input, context) => {
      const threadId = deriveStudioThreadKey(dependencies.trustedDefaults.tenantId, context.agent?.threadId);
      const commands = await loadPending(dependencies, threadId);
      const actions = await Promise.all(
        commands.map(async command => {
          if (command.actionType === 'MISSING_INFORMATION') {
            const request = await dependencies.informationRequests.get({
              tenantId: command.tenantId,
              requestId: command.targetId,
            });
            return pendingKycActionSummarySchema.parse({
              caseReference: caseReference(command.caseId),
              action: command.actionType,
              level: null,
              requestedItems: request.requestedItems,
              riskLevel: null,
              safeMessage: request.safeMessage,
              expiresAt: request.expiresAt,
            });
          }
          const review = await dependencies.reviews.get({
            tenantId: command.tenantId,
            reviewId: command.targetId,
          });
          return pendingKycActionSummarySchema.parse({
            caseReference: review.caseReference,
            action: command.actionType,
            level: review.level,
            requestedItems: [],
            riskLevel: review.riskLevel,
            safeMessage: `${review.level === 'INITIAL' ? 'An' : 'A'} ${review.level.toLowerCase()} compliance decision is required.`,
            expiresAt: review.expiresAt,
          });
        }),
      );
      return { actions, requiresSelection: actions.length > 1 };
    },
  });

export const createSubmitKycInformationTool = (dependencies: ResumeKycDependencies) =>
  createTool({
    id: 'submit-kyc-information-v1',
    description:
      'Submit one response to a missing-information action in this Studio thread. A corrected application is a partial update containing only fields requested by the pending action; do not request or repeat application data already stored.',
    inputSchema: z
      .object({
        caseReference: caseReferenceSchema.optional(),
        responseOption: responseOptionSchema,
        fixtureResponseQuality: fixtureResponseQualitySchema,
        applicationCorrections: applicationCorrectionsSchema
          .describe('Partial application update containing only fields requested by the pending action')
          .nullable()
          .optional(),
        intent: resumeIntentSchema,
      })
      .strict(),
    outputSchema: resumeKycApplicationOutputSchema,
    strict: true,
    execute: async (input, context) => {
      const threadId = deriveStudioThreadKey(dependencies.trustedDefaults.tenantId, context.agent?.threadId);
      return serializeStudioThread(`${dependencies.trustedDefaults.tenantId}:${threadId}`, async () => {
        const auditActor: Actor = {
          type: 'applicant',
          id: 'studio-applicant',
          roles: ['applicant'],
        };
        const applicationCorrections = normalizeApplicationCorrections(input.applicationCorrections ?? null);
        const responseQuality = input.fixtureResponseQuality ?? 'COMPLETE';
        const selected = await selectCommandForPayload(
          dependencies,
          await loadForThread(dependencies, threadId),
          input.caseReference,
          threadId,
          'MISSING_INFORMATION',
          auditActor,
          input.intent,
          candidate =>
            fingerprintValue({
              actionType: candidate.actionType,
              commandId: candidate.id,
              responseOption: input.responseOption,
              responseQuality,
              applicationCorrections,
            }),
        );
        const { command, payloadFingerprint } = selected;
        const request = await dependencies.informationRequests.get({
          tenantId: command.tenantId,
          requestId: command.targetId,
        });
        const actor: Actor = {
          type: 'applicant',
          id: command.authorizedActorId,
          roles: [command.requiredRole],
        };
        try {
          validateInformationResponse(request, input.responseOption, applicationCorrections);
        } catch (error) {
          await auditCommandRejection(dependencies, command, actor, payloadFingerprint, 'BINDING_INVALID');
          throw error;
        }
        const fixture = getFixtureScenario(responseQuality === 'STILL_INCOMPLETE' ? 'unreadable' : 'low-risk');
        let responseDocument: InformationResponseDocument;
        try {
          const snapshot = await dependencies.snapshots.get({
            tenantId: command.tenantId,
            caseId: command.caseId,
          });
          responseDocument = resolveInformationResponseDocument(
            input.responseOption,
            fixture.documentType,
            await dependencies.documents.list({
              tenantId: command.tenantId,
              caseId: command.caseId,
            }),
            durableJurisdictionPolicySchema.parse(snapshot.policy),
          );
        } catch (error) {
          await auditCommandRejection(dependencies, command, actor, payloadFingerprint, 'BINDING_INVALID');
          throw error;
        }
        const acquired = await acquireCommand(dependencies, command, actor, payloadFingerprint);
        if (acquired.status === 'COMPLETED') {
          return outcomeFromCompletedCommand(dependencies, acquired, actor);
        }
        let response;
        try {
          response = await dependencies.informationRequests.getResponse({
            tenantId: acquired.tenantId,
            responseId: acquired.resumePayloadId,
          });
        } catch (error) {
          if (!(error instanceof NotFoundError)) throw error;
          const studio = await contextForCommand(dependencies, acquired, actor);
          const execution = {
            tenantId: studio.value.tenantId,
            jurisdiction: studio.value.jurisdiction,
            piiMode: studio.value.piiMode,
            policy: studio.value.policy,
            locale: studio.value.locale,
            correlationId: studio.value.correlationId,
            actor: studio.value.actor,
          };
          let applicationVersion: number | null = null;
          if (input.responseOption === 'CORRECTED_APPLICATION') {
            const currentCase = await dependencies.cases.get({
              tenantId: acquired.tenantId,
              caseId: acquired.caseId,
            });
            const currentApplication = await dependencies.applications.get({
              tenantId: acquired.tenantId,
              applicationId: currentCase.applicationId,
            });
            const correctedApplication = applicationSchema.parse({
              ...currentApplication,
              data: {
                ...currentApplication.data,
                ...applicationCorrectionsSchema.parse(applicationCorrections),
              },
              updatedAt: dependencies.clock.now().toISOString(),
              version: currentApplication.version + 1,
            });
            const persistedApplication = await dependencies.applications.put({
              application: correctedApplication,
              idempotencyKey: `${acquired.idempotencyKey}:application-correction`,
              requestFingerprint: payloadFingerprint,
            });
            applicationVersion = persistedApplication.version;
          }
          const intake = await dependencies.documentIntake.intake({
            execution,
            caseId: acquired.caseId,
            documentType: responseDocument.documentType,
            side: responseDocument.side,
            declaredMimeType: fixture.mimeType,
            bytes: fixture.bytes,
            idempotencyKey: `${acquired.idempotencyKey}:response-document:${input.responseOption}`,
          });
          await dependencies.documentExtraction.extract({
            execution,
            document: intake.document,
            modelId: dependencies.modelId,
            schemaVersion: dependencies.schemaVersion,
            timeoutMs: dependencies.timeoutMs,
            idempotencyKey: `${acquired.idempotencyKey}:response-extraction:${input.responseOption}`,
            workflowRunId: acquired.workflowRunId,
          });
          const submittedAt = dependencies.clock.now().toISOString();
          const created = informationResponseSchema.parse({
            id: acquired.resumePayloadId,
            tenantId: acquired.tenantId,
            caseId: acquired.caseId,
            requestId: request.id,
            responseOption: input.responseOption,
            responseQuality,
            applicationCorrections,
            applicationVersion,
            documentIds: [intake.document.id],
            responseFingerprint: payloadFingerprint,
            actor,
            submittedAt,
          });
          await dependencies.informationRequests.respond({
            response: created,
            expectedVersion: request.version,
            idempotencyKey: `${acquired.idempotencyKey}:response`,
          });
          response = created;
        }
        return resumeAcquired(dependencies, acquired, actor, {
          commandId: acquired.id,
          responseId: response.id,
        });
      });
    },
  });

export const createDecideKycReviewTool = (dependencies: ResumeKycDependencies) =>
  createTool({
    id: 'decide-kyc-review-v1',
    description: 'Record and resume one authorized synthetic compliance decision in this Studio thread',
    inputSchema: z
      .object({
        caseReference: caseReferenceSchema.optional(),
        decision: z.enum(['APPROVE', 'REJECT', 'ESCALATE']),
        safeNote: z.string().min(1).max(500).nullable().default(null),
        intent: resumeIntentSchema,
      })
      .strict(),
    outputSchema: resumeKycApplicationOutputSchema,
    strict: true,
    execute: async (input, context) => {
      const threadId = deriveStudioThreadKey(dependencies.trustedDefaults.tenantId, context.agent?.threadId);
      return serializeStudioThread(`${dependencies.trustedDefaults.tenantId}:${threadId}`, async () => {
        const auditActor = reviewerFor('INITIAL');
        const selected = await selectCommandForPayload(
          dependencies,
          await loadForThread(dependencies, threadId),
          input.caseReference,
          threadId,
          'COMPLIANCE_REVIEW',
          auditActor,
          input.intent,
          candidate =>
            fingerprintValue({
              actionType: candidate.actionType,
              commandId: candidate.id,
              decision: input.decision,
              safeNote: input.safeNote,
            }),
        );
        const { command, payloadFingerprint } = selected;
        const review = await dependencies.reviews.get({
          tenantId: command.tenantId,
          reviewId: command.targetId,
        });
        const actor = reviewerFor(review.level);
        const decisionInput = {
          tenantId: command.tenantId,
          reviewId: review.id,
          reviewer: actor,
          decision: input.decision,
          reasonCode:
            input.decision === 'APPROVE'
              ? ('REVIEW_APPROVED' as const)
              : input.decision === 'REJECT'
                ? ('REVIEW_REJECTED' as const)
                : ('REVIEW_ESCALATED' as const),
          safeNote: input.safeNote,
        };
        if (command.status === 'COMPLETED') {
          const acquired = await acquireCommand(dependencies, command, actor, payloadFingerprint);
          return outcomeFromCompletedCommand(dependencies, acquired, actor);
        }
        try {
          await dependencies.complianceReview.validateDecision(decisionInput);
        } catch (error) {
          await auditCommandRejection(
            dependencies,
            command,
            actor,
            payloadFingerprint,
            error instanceof Error && error.message.includes('expired') ? 'COMMAND_EXPIRED' : 'BINDING_INVALID',
          );
          throw error;
        }
        const acquired = await acquireCommand(dependencies, command, actor, payloadFingerprint);
        let decided;
        try {
          decided = {
            decision: await dependencies.reviews.getDecision({
              tenantId: acquired.tenantId,
              reviewId: review.id,
            }),
          };
        } catch (error) {
          if (!(error instanceof NotFoundError)) throw error;
          decided = await dependencies.complianceReview.decide({
            ...decisionInput,
            idempotencyKey: `${command.idempotencyKey}:decision:${input.decision}`,
          });
        }
        if (decided.decision.decision !== input.decision) {
          throw new StudioContextError('The retry decision does not match the persisted decision');
        }
        return resumeAcquired(dependencies, acquired, actor, {
          commandId: acquired.id,
          decisionId: decided.decision.id,
        });
      });
    },
  });

export type ListPendingKycActionsTool = ReturnType<typeof createListPendingKycActionsTool>;
export type SubmitKycInformationTool = ReturnType<typeof createSubmitKycInformationTool>;
export type DecideKycReviewTool = ReturnType<typeof createDecideKycReviewTool>;

export type StudioKycActions = Readonly<{
  listPendingKycActions: ListPendingKycActionsTool;
  submitKycInformation: SubmitKycInformationTool;
  decideKycReview: DecideKycReviewTool;
}>;
