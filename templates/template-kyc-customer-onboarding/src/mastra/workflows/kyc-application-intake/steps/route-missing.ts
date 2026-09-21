import { createStep } from '@mastra/core/workflows';

import {
  contextFrom,
  kycApplicationWorkflowOutputSchema,
  kycWorkflowRequestContextSchema,
  type KycApplicationWorkflowDependencies,
} from '../contracts.js';
import { extractionAssessedSchema } from './assess-completeness.js';

export const createRouteMissingStep = (dependencies: KycApplicationWorkflowDependencies) =>
  createStep({
    id: 'route-missing-information-v1',
    inputSchema: extractionAssessedSchema,
    outputSchema: kycApplicationWorkflowOutputSchema,
    requestContextSchema: kycWorkflowRequestContextSchema,
    execute: async ({ inputData, requestContext }) => {
      const context = kycWorkflowRequestContextSchema.parse(requestContext.all);
      const result = await dependencies.extractionRouting.route({
        execution: contextFrom(context),
        caseId: inputData.caseId,
        evidenceId: inputData.evidenceId,
        assessment: inputData.assessment,
        idempotencyKey: `${inputData.idempotencyKey}:routing`,
      });
      return kycApplicationWorkflowOutputSchema.parse({
        caseId: inputData.caseId,
        documentId: inputData.documentId,
        status: result.status,
        route: inputData.assessment.route,
        quality: inputData.assessment.quality,
        missingFields: inputData.assessment.missingFields,
        lowConfidenceFields: inputData.assessment.lowConfidenceFields,
        warnings: inputData.assessment.warnings,
        providerId: inputData.providerId,
        readiness: 'AWAITING_INFORMATION',
        checks: null,
        evidenceIds: inputData.extractionEvidenceIds,
        automaticSteps: [
          'application-intake',
          'document-validation',
          'document-storage',
          'structured-extraction',
          'completeness-assessment',
        ],
        message: 'The case requires document information; conversational resume is intentionally deferred.',
      });
    },
  });
