import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { durableJurisdictionPolicySchema } from '../../../../contracts/policies/policies.js';
import { loadExtractionQualityPolicy } from '../../../../config/policies/extraction-quality.js';
import { DomainInvariantError } from '../../../../domain/errors.js';
import {
  informationRequestIdSchema,
  informationResponseIdSchema,
  resumeCommandIdSchema,
} from '../../../../domain/identifiers.js';
import { kycWorkflowRequestContextSchema } from '../../kyc-application-intake.js';
import { contextFrom, durableKycWorkflowStateSchema, type DurableKycWorkflowDependencies } from '../contracts.js';
import type { Transition } from '../runtime.js';
import { progressSchema } from './prepare-progress.js';

export const missingInformationSuspendSchema = z
  .object({
    action: z.literal('MISSING_INFORMATION'),
    caseReference: z.string().min(1).max(128),
    requestId: informationRequestIdSchema,
    commandId: resumeCommandIdSchema,
    requestedItems: z.array(z.string().min(1).max(100)).min(1),
    safeMessage: z.string().min(1).max(500),
    actionPath: z.string().min(1).max(500),
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const missingInformationResumeSchema = z
  .object({ commandId: resumeCommandIdSchema, responseId: informationResponseIdSchema })
  .strict();

export const createCollectMissingInformationStep = (
  dependencies: DurableKycWorkflowDependencies,
  transition: Transition,
) =>
  createStep({
    id: 'collect-missing-information-v1',
    inputSchema: progressSchema,
    outputSchema: progressSchema,
    stateSchema: durableKycWorkflowStateSchema,
    requestContextSchema: kycWorkflowRequestContextSchema,
    suspendSchema: missingInformationSuspendSchema,
    resumeSchema: missingInformationResumeSchema,
    execute: async stepContext => {
      const { inputData, requestContext, workflowId, runId, resumeData, state } = stepContext;
      const context = kycWorkflowRequestContextSchema.parse(requestContext.all);
      const execution = contextFrom(context);
      const snapshot = await dependencies.snapshots.get({
        tenantId: context.tenantId,
        caseId: inputData.caseId,
      });
      const policy = durableJurisdictionPolicySchema.parse(snapshot.policy);
      if (resumeData === undefined || state.currentAction !== 'MISSING_INFORMATION' || state.currentActionId === null) {
        const completeness = await dependencies.completeness.evaluate({
          tenantId: context.tenantId,
          caseId: inputData.caseId,
          policy,
          qualityPolicy: loadExtractionQualityPolicy(context.policyProfile),
          completedRounds: inputData.completedInformationRounds,
        });
        if (completeness.status !== 'MISSING_INFORMATION') {
          return progressSchema.parse({
            ...inputData,
            completenessStatus: completeness.status,
            documentId: completeness.primaryDocumentId ?? inputData.documentId,
          });
        }
        const currentCase = await dependencies.cases.get({
          tenantId: context.tenantId,
          caseId: inputData.caseId,
        });
        if (currentCase.status === 'EXTRACTING' || currentCase.status === 'CHECKING') {
          const currentEvidence = await dependencies.evidence.aggregate({
            tenantId: context.tenantId,
            caseId: inputData.caseId,
          });
          await transition({
            execution,
            caseId: inputData.caseId,
            command: 'REQUEST_INFORMATION',
            reasonCode: completeness.reasonCodes[0] ?? 'EVIDENCE_INCOMPLETE',
            actor: execution.actor,
            evidenceIds: currentEvidence.evidenceIds,
            idempotencyKey: `${inputData.idempotencyKey}:request-information:${String(completeness.completedRounds + 1)}`,
          });
        }
        const pending = await dependencies.missingInformation.request({
          execution,
          caseId: inputData.caseId,
          workflowId,
          workflowRunId: runId,
          workflowStepId: 'collect-missing-information-v1',
          threadId: inputData.threadId,
          policy: snapshot.policy,
          completeness,
          idempotencyKey: inputData.idempotencyKey,
        });
        await stepContext.setState({
          ...state,
          currentAction: 'MISSING_INFORMATION',
          currentActionId: pending.request.id,
        });
        return stepContext.suspend(
          {
            action: 'MISSING_INFORMATION',
            caseReference: `KYC-${inputData.caseId.slice(-12)}`,
            requestId: pending.request.id,
            commandId: pending.command.id,
            requestedItems: pending.request.requestedItems,
            safeMessage: pending.request.safeMessage,
            actionPath: pending.request.actionPath,
            expiresAt: pending.request.expiresAt,
          },
          { resumeLabel: `missing-information-${pending.request.id}` },
        );
      }

      const command = await dependencies.resumeCommands.get({
        tenantId: context.tenantId,
        commandId: resumeData.commandId,
      });
      const response = await dependencies.informationRequests.getResponse({
        tenantId: context.tenantId,
        responseId: resumeData.responseId,
      });
      const request = await dependencies.informationRequests.get({
        tenantId: context.tenantId,
        requestId: command.targetId,
      });
      if (
        command.status !== 'EXECUTING' ||
        command.actionType !== 'MISSING_INFORMATION' ||
        command.workflowRunId !== runId ||
        command.workflowStepId !== 'collect-missing-information-v1' ||
        command.threadId !== inputData.threadId ||
        command.caseId !== inputData.caseId ||
        command.resumePayloadId !== response.id ||
        response.requestId !== request.id ||
        request.status !== 'RESPONDED'
      ) {
        throw new DomainInvariantError('Persisted missing-information resume binding is invalid');
      }
      const completeness = await dependencies.completeness.evaluate({
        tenantId: context.tenantId,
        caseId: inputData.caseId,
        policy,
        qualityPolicy: loadExtractionQualityPolicy(context.policyProfile),
        completedRounds: request.round,
      });
      const bundle = await dependencies.evidence.aggregate({
        tenantId: context.tenantId,
        caseId: inputData.caseId,
      });
      if (completeness.status === 'COMPLETE') {
        const currentCase = await dependencies.cases.get({
          tenantId: context.tenantId,
          caseId: inputData.caseId,
        });
        if (currentCase.status === 'MISSING_INFORMATION') {
          await transition({
            execution,
            caseId: inputData.caseId,
            command: 'RESUME_EXTRACTION',
            reasonCode: 'EVIDENCE_COMPLETE',
            actor: execution.actor,
            evidenceIds: bundle.evidenceIds,
            idempotencyKey: `${inputData.idempotencyKey}:resume-extraction:${String(request.round)}`,
          });
        } else if (currentCase.status !== 'EXTRACTING') {
          throw new DomainInvariantError('Missing-information response did not return to extraction');
        }
        await transition({
          execution,
          caseId: inputData.caseId,
          command: 'BEGIN_CHECKS',
          reasonCode: 'EVIDENCE_COMPLETE',
          actor: execution.actor,
          evidenceIds: bundle.evidenceIds,
          idempotencyKey: `${inputData.idempotencyKey}:resume-checks:${String(request.round)}`,
        });
      } else if (completeness.status === 'INSUFFICIENT_INFORMATION') {
        const currentCase = await dependencies.cases.get({
          tenantId: context.tenantId,
          caseId: inputData.caseId,
        });
        if (currentCase.status === 'EXTRACTING') {
          await transition({
            execution,
            caseId: inputData.caseId,
            command: 'REQUEST_INFORMATION',
            reasonCode: 'COMPLETENESS_MISSING_INFORMATION_ROUND_LIMIT',
            actor: execution.actor,
            evidenceIds: bundle.evidenceIds,
            idempotencyKey: `${inputData.idempotencyKey}:final-information-request:${String(request.round)}`,
          });
        } else if (currentCase.status !== 'MISSING_INFORMATION') {
          throw new DomainInvariantError('Insufficient-information response did not return to a resumable case state');
        }
        await transition({
          execution,
          caseId: inputData.caseId,
          command: 'EXHAUST_INFORMATION_REQUESTS',
          reasonCode: 'COMPLETENESS_MISSING_INFORMATION_ROUND_LIMIT',
          actor: execution.actor,
          evidenceIds: bundle.evidenceIds,
          idempotencyKey: `${inputData.idempotencyKey}:exhaust-information:${String(request.round)}`,
        });
      }
      await stepContext.setState({
        ...state,
        informationRound: request.round,
        currentAction: 'NONE',
        currentActionId: null,
      });
      return progressSchema.parse({
        ...inputData,
        status:
          completeness.status === 'COMPLETE'
            ? 'CHECKING'
            : completeness.status === 'INSUFFICIENT_INFORMATION'
              ? 'ASSESSING_RISK'
              : 'MISSING_INFORMATION',
        completenessStatus: completeness.status,
        completedInformationRounds: request.round,
        documentId: completeness.primaryDocumentId ?? inputData.documentId,
        missingFields: completeness.missingFields,
        lowConfidenceFields: completeness.lowConfidenceFields,
        evidenceIds: bundle.evidenceIds,
      });
    },
  });
