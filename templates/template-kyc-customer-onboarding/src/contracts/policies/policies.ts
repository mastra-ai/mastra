import { z } from 'zod';

import { documentSideSchema, documentTypeSchema } from '../../domain/documents.js';
import { evidenceItemSchema } from '../../domain/evidence.js';
import { policyIdSchema, semanticVersionSchema } from '../../domain/identifiers.js';
import type { riskAssessmentSchema } from '../../domain/risk.js';
import { reasonTaxonomyVersionSchema } from '../../domain/reasons.js';
import { piiCategorySchema } from '../shared/provider.js';

const documentRequirementSchema = z
  .object({
    type: documentTypeSchema.exclude(['UNKNOWN']),
    sides: z.array(documentSideSchema).min(1),
  })
  .strict();

const riskWeightsSchema = z
  .object({
    identityMismatch: z.number().int().min(0).max(100),
    addressMismatch: z.number().int().min(0).max(100),
    sanctionsPossible: z.number().int().min(0).max(100),
    sanctionsStrong: z.number().int().min(0).max(100),
    pepPossible: z.number().int().min(0).max(100),
    pepStrong: z.number().int().min(0).max(100),
    inconclusive: z.number().int().min(0).max(100),
    unavailable: z.number().int().min(0).max(100),
  })
  .strict();

const riskThresholdsSchema = z
  .object({
    lowMax: z.number().int().min(0).max(99),
    mediumMax: z.number().int().min(1).max(99),
  })
  .strict()
  .refine(value => value.lowMax < value.mediumMax, {
    message: 'low risk maximum must be lower than medium risk maximum',
  });

const jurisdictionPolicyV1BaseSchema = z.object({
  id: policyIdSchema,
  version: semanticVersionSchema,
  checksum: z.string().regex(/^[a-f0-9]{64}$/u),
  jurisdiction: z.literal('US'),
  profile: z.enum(['demo-default', 'demo-strict']),
  acceptedDocuments: z.array(documentTypeSchema.exclude(['UNKNOWN'])).min(1),
  requiredFields: z.array(z.string().min(1).max(100)).min(1),
  requiredChecks: z.array(z.enum(['IDENTITY', 'ADDRESS', 'SANCTIONS', 'PEP'])).min(1),
  requiredReviewerRole: z.string().min(1).max(64),
  escalationThreshold: z.number().min(0).max(100),
});

export const jurisdictionPolicyV1Schema = jurisdictionPolicyV1BaseSchema
  .extend({ version: z.literal('1.0.0') })
  .strict();

export const durableJurisdictionPolicySchema = jurisdictionPolicyV1BaseSchema
  .extend({
    version: z.literal('1.1.0'),
    identityDocumentRequirements: z.array(documentRequirementSchema).min(1),
    supplementalDocumentRequirements: z.array(documentRequirementSchema),
    seniorReviewerRole: z.string().min(1).max(64),
    requireDistinctSeniorReviewer: z.literal(true),
    missingInformation: z
      .object({
        maxRounds: z.number().int().min(1).max(10),
        resumeTtlHours: z.literal(24),
        exhaustedRoute: z.literal('INSUFFICIENT_INFORMATION'),
      })
      .strict(),
    risk: z.object({ weights: riskWeightsSchema, thresholds: riskThresholdsSchema }).strict(),
    reasonTaxonomyVersion: reasonTaxonomyVersionSchema,
  })
  .strict();

export const jurisdictionPolicySchema = z.discriminatedUnion('version', [
  jurisdictionPolicyV1Schema,
  durableJurisdictionPolicySchema,
]);

export const resolveJurisdictionPolicyInputSchema = z
  .object({ jurisdiction: z.literal('US'), profile: z.enum(['demo-default', 'demo-strict']) })
  .strict();

export const evaluateRiskInputSchema = z
  .object({
    tenantId: z.string().min(1),
    caseId: z.string().min(1),
    policy: durableJurisdictionPolicySchema,
    evidence: z.array(evidenceItemSchema).min(1),
    evidenceCompleteness: z.enum(['COMPLETE', 'INCOMPLETE']).default('COMPLETE'),
    missingInformationExhausted: z.boolean().default(false),
    assessedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const piiTransmissionInputSchema = z
  .object({
    mode: z.enum(['demo-default', 'demo-strict']),
    providerId: z.string().min(1),
    externalNetwork: z.boolean(),
    categories: z.array(piiCategorySchema),
    explicitAllowlist: z.array(z.string()),
  })
  .strict();

export interface JurisdictionPolicyProvider {
  resolve(
    input: z.infer<typeof resolveJurisdictionPolicyInputSchema>,
  ): Promise<z.infer<typeof jurisdictionPolicySchema>>;
}

export interface RiskPolicyProvider {
  evaluate(input: z.input<typeof evaluateRiskInputSchema>): Promise<z.infer<typeof riskAssessmentSchema>>;
}

export interface PiiProtectionPolicy {
  allowsTransmission(input: z.infer<typeof piiTransmissionInputSchema>): boolean;
  mask(category: z.infer<typeof piiCategorySchema>, value: string): string;
}
