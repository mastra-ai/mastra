import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { screeningCheckOutputSchema, verificationCheckOutputSchema } from '../../../../services/check-execution.js';
import { kycApplicationWorkflowOutputSchema } from '../contracts.js';
import { extractionAssessedSchema } from './assess-completeness.js';

const aggregateChecksInputSchema = z
  .object({
    'identity-verification-v1': verificationCheckOutputSchema,
    'address-verification-v1': verificationCheckOutputSchema,
    'sanctions-screening-v1': screeningCheckOutputSchema,
    'pep-screening-v1': screeningCheckOutputSchema,
  })
  .strict();

export const createAggregateChecksStep = () =>
  createStep({
    id: 'aggregate-verification-checks-v1',
    inputSchema: aggregateChecksInputSchema,
    outputSchema: kycApplicationWorkflowOutputSchema,
    execute: context => {
      const { inputData } = context;
      const initial = extractionAssessedSchema.parse(context.getInitData());
      const checks = {
        identity: inputData['identity-verification-v1'],
        address: inputData['address-verification-v1'],
        sanctions: inputData['sanctions-screening-v1'],
        pep: inputData['pep-screening-v1'],
      };
      return Promise.resolve(
        kycApplicationWorkflowOutputSchema.parse({
          caseId: initial.caseId,
          documentId: initial.documentId,
          status: 'CHECKING',
          route: initial.assessment.route,
          quality: initial.assessment.quality,
          missingFields: initial.assessment.missingFields,
          lowConfidenceFields: initial.assessment.lowConfidenceFields,
          warnings: initial.assessment.warnings,
          providerId: initial.providerId,
          readiness: 'READY_FOR_RISK_ASSESSMENT',
          checks,
          evidenceIds: [
            checks.identity.evidence.id,
            checks.address.evidence.id,
            checks.sanctions.evidence.id,
            checks.pep.evidence.id,
          ],
          automaticSteps: [
            'application-intake',
            'document-validation',
            'document-storage',
            'structured-extraction',
            'completeness-assessment',
            'identity-verification',
            'address-verification',
            'sanctions-screening',
            'pep-screening',
            'evidence-aggregation',
          ],
          message:
            'Application intake, extraction, and four parallel verification checks completed; the case is ready for risk assessment.',
        }),
      );
    },
  });
