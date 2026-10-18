import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { durableJurisdictionPolicySchema } from '../../../../contracts/policies/policies.js';
import { loadExtractionQualityPolicy } from '../../../../config/policies/extraction-quality.js';
import { assessExtraction, extractionAssessmentSchema } from '../../../../services/extraction-assessment.js';
import { kycWorkflowRequestContextSchema, type KycApplicationWorkflowDependencies } from '../contracts.js';
import { documentExtractedSchema } from './extract-document.js';

export const extractionAssessedSchema = documentExtractedSchema
  .extend({ assessment: extractionAssessmentSchema })
  .strict();

export const createAssessCompletenessStep = (dependencies: KycApplicationWorkflowDependencies) =>
  createStep({
    id: 'assess-extraction-completeness-v1',
    description: 'Apply versioned quality and required-field policy',
    inputSchema: documentExtractedSchema,
    outputSchema: extractionAssessedSchema,
    requestContextSchema: kycWorkflowRequestContextSchema,
    execute: async ({ inputData, requestContext }) => {
      const context = kycWorkflowRequestContextSchema.parse(requestContext.all);
      const policy = durableJurisdictionPolicySchema.parse(
        await dependencies.jurisdictionPolicy.resolve({
          jurisdiction: z.literal('US').parse(context.jurisdiction),
          profile: context.policyProfile,
        }),
      );
      const persisted = await dependencies.documentExtractions.get({
        tenantId: context.tenantId,
        documentId: inputData.documentId,
      });
      const qualityPolicy = loadExtractionQualityPolicy(context.policyProfile);
      const primaryAssessment = assessExtraction(persisted.result, policy.requiredFields, qualityPolicy);
      const completeness = await dependencies.completeness.evaluate({
        tenantId: context.tenantId,
        caseId: inputData.caseId,
        policy,
        qualityPolicy,
        completedRounds: 0,
      });
      return extractionAssessedSchema.parse({
        ...inputData,
        assessment: {
          route: completeness.status === 'COMPLETE' ? 'READY_FOR_CHECKS' : 'MISSING_INFORMATION',
          quality: primaryAssessment.quality,
          missingFields: completeness.missingFields,
          lowConfidenceFields: completeness.lowConfidenceFields,
          warnings: primaryAssessment.warnings,
        },
      });
    },
  });
