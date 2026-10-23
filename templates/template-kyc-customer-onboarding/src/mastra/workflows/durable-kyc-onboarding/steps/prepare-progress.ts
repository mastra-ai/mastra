import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { durableJurisdictionPolicySchema } from '../../../../contracts/policies/policies.js';
import { loadExtractionQualityPolicy } from '../../../../config/policies/extraction-quality.js';
import { threadIdSchema } from '../../../../domain/identifiers.js';
import { kycApplicationWorkflowOutputSchema, kycWorkflowRequestContextSchema } from '../../kyc-application-intake.js';
import {
  contextFrom,
  durableKycWorkflowInputSchema,
  durableKycWorkflowStateSchema,
  type DurableKycWorkflowDependencies,
} from '../contracts.js';
import type { Transition } from '../runtime.js';

export const progressSchema = kycApplicationWorkflowOutputSchema
  .omit({ status: true })
  .extend({
    status: z.enum(['CHECKING', 'MISSING_INFORMATION', 'ASSESSING_RISK']),
    idempotencyKey: z.string().min(8).max(256),
    threadId: threadIdSchema,
    completedInformationRounds: z.number().int().nonnegative(),
    completenessStatus: z.enum(['COMPLETE', 'MISSING_INFORMATION', 'INSUFFICIENT_INFORMATION']),
  })
  .strict();

export const createPrepareProgressStep = (dependencies: DurableKycWorkflowDependencies, transition: Transition) =>
  createStep({
    id: 'prepare-durable-progress-v1',
    inputSchema: kycApplicationWorkflowOutputSchema,
    outputSchema: progressSchema,
    stateSchema: durableKycWorkflowStateSchema,
    requestContextSchema: kycWorkflowRequestContextSchema,
    execute: async stepContext => {
      const { inputData, requestContext, state } = stepContext;
      const init = durableKycWorkflowInputSchema.parse(stepContext.getInitData());
      const context = kycWorkflowRequestContextSchema.parse(requestContext.all);
      const execution = contextFrom(context);
      const snapshot = await dependencies.snapshots.get({
        tenantId: context.tenantId,
        caseId: inputData.caseId,
      });
      const policy = durableJurisdictionPolicySchema.parse(snapshot.policy);
      const completeness = await dependencies.completeness.evaluate({
        tenantId: context.tenantId,
        caseId: inputData.caseId,
        policy,
        qualityPolicy: loadExtractionQualityPolicy(context.policyProfile),
        completedRounds: 0,
      });
      if (completeness.status === 'MISSING_INFORMATION' && inputData.status === 'CHECKING') {
        const evidence = await dependencies.evidence.aggregate({
          tenantId: context.tenantId,
          caseId: inputData.caseId,
        });
        await transition({
          execution,
          caseId: inputData.caseId,
          command: 'REQUEST_INFORMATION',
          reasonCode: completeness.reasonCodes[0] ?? 'EVIDENCE_INCOMPLETE',
          actor: execution.actor,
          evidenceIds: evidence.evidenceIds,
          idempotencyKey: `${init.idempotencyKey}:policy-completeness`,
        });
      }
      await stepContext.setState({
        ...state,
        caseId: inputData.caseId,
        policy: context.policy,
        currentAction: 'NONE',
        currentActionId: null,
      });
      return progressSchema.parse({
        ...inputData,
        idempotencyKey: init.idempotencyKey,
        threadId: init.studioThreadKey,
        completedInformationRounds: 0,
        status: completeness.status === 'MISSING_INFORMATION' ? 'MISSING_INFORMATION' : inputData.status,
        completenessStatus: completeness.status,
        missingFields: completeness.missingFields,
        lowConfidenceFields: completeness.lowConfidenceFields,
      });
    },
  });
