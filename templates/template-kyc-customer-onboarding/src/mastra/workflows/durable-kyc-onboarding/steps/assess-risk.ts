import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { riskAssessmentIdSchema } from '../../../../domain/identifiers.js';
import { kycWorkflowRequestContextSchema } from '../../kyc-application-intake.js';
import { contextFrom, riskRouteSchema, systemActor, type DurableKycWorkflowDependencies } from '../contracts.js';
import type { MeasureWorkflowStep, Transition } from '../runtime.js';
import { progressSchema } from './prepare-progress.js';

export const riskProgressSchema = progressSchema
  .extend({
    riskAssessmentId: riskAssessmentIdSchema,
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    riskRoute: riskRouteSchema,
  })
  .strict();

export const createAssessRiskStep = (
  dependencies: DurableKycWorkflowDependencies,
  transition: Transition,
  measureWorkflowStep: MeasureWorkflowStep,
) =>
  createStep({
    id: 'assess-deterministic-risk-v1',
    inputSchema: progressSchema,
    outputSchema: riskProgressSchema,
    requestContextSchema: kycWorkflowRequestContextSchema,
    execute: async ({ inputData, requestContext, runId }) => {
      const context = kycWorkflowRequestContextSchema.parse(requestContext.all);
      const execution = contextFrom(context);
      const round = String(inputData.completedInformationRounds);
      const evidence = await measureWorkflowStep({
        tenantId: context.tenantId,
        eventId: `workflow-step:${inputData.caseId}:evidence:${round}`,
        caseId: inputData.caseId,
        runId,
        stepId: 'aggregate-evidence-v1',
        operation: () =>
          dependencies.evidence.aggregate({
            tenantId: context.tenantId,
            caseId: inputData.caseId,
          }),
      });
      if (inputData.status === 'CHECKING') {
        await transition({
          execution,
          caseId: inputData.caseId,
          command: 'BEGIN_RISK_ASSESSMENT',
          reasonCode: 'EVIDENCE_COMPLETE',
          actor: systemActor,
          evidenceIds: evidence.evidenceIds,
          idempotencyKey: `${inputData.idempotencyKey}:begin-risk`,
        });
      }
      const result = await measureWorkflowStep({
        tenantId: context.tenantId,
        eventId: `workflow-step:${inputData.caseId}:risk:${round}`,
        caseId: inputData.caseId,
        runId,
        stepId: 'assess-deterministic-risk-v1',
        operation: () =>
          dependencies.riskAssessment.assess({
            tenantId: context.tenantId,
            caseId: inputData.caseId,
            completedInformationRounds: inputData.completedInformationRounds,
            idempotencyKey: `${inputData.idempotencyKey}:risk-assessment`,
          }),
      });
      return riskProgressSchema.parse({
        ...inputData,
        status: 'ASSESSING_RISK',
        riskAssessmentId: result.assessment.id,
        riskLevel: result.assessment.level,
        riskRoute: result.assessment.route,
        evidenceIds: result.evidence.evidenceIds,
        automaticSteps: [...inputData.automaticSteps, 'deterministic-risk-assessment'],
      });
    },
  });
