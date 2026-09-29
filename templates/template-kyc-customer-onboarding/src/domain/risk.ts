import { z } from 'zod';

import {
  caseIdSchema,
  checksumSchema,
  evidenceIdSchema,
  policyIdSchema,
  providerIdSchema,
  riskAssessmentIdSchema,
  semanticVersionSchema,
  tenantIdSchema,
  timestampSchema,
} from './identifiers.js';
import { reasonCodeSchema } from './reasons.js';

export const riskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const riskRouteSchema = z.enum([
  'AUTO_REVIEW',
  'REJECT_RECOMMENDED',
  'ESCALATE_RECOMMENDED',
  'INSUFFICIENT_INFORMATION',
]);

export const riskFactorSchema = z
  .object({
    code: reasonCodeSchema,
    weight: z.number().min(0),
    evidenceIds: z.array(evidenceIdSchema).min(1),
  })
  .strict();

export const riskNarrativeSchema = z
  .object({
    summary: z.string().min(1).max(1000),
    providerId: providerIdSchema,
    providerVersion: semanticVersionSchema,
    modelId: z.string().min(1).max(128),
    promptId: z.string().min(1).max(128),
    promptVersion: semanticVersionSchema,
    promptChecksum: checksumSchema,
    schemaVersion: semanticVersionSchema,
    inputChecksum: checksumSchema,
    outputChecksum: checksumSchema,
    generatedAt: timestampSchema,
  })
  .strict();

export const riskAssessmentSchema = z
  .object({
    id: riskAssessmentIdSchema,
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    evidenceCompleteness: z.enum(['COMPLETE', 'INCOMPLETE']),
    level: riskLevelSchema,
    score: z.number().min(0).max(100),
    route: riskRouteSchema,
    factors: z.array(riskFactorSchema),
    evidenceIds: z.array(evidenceIdSchema).min(1),
    policyId: policyIdSchema,
    policyVersion: semanticVersionSchema,
    policyChecksum: checksumSchema,
    engine: z.object({ id: providerIdSchema, version: semanticVersionSchema }).strict(),
    narrative: riskNarrativeSchema.nullable(),
    assessedAt: timestampSchema,
  })
  .strict();

export type RiskFactor = z.infer<typeof riskFactorSchema>;
export type RiskNarrative = z.infer<typeof riskNarrativeSchema>;
export type RiskAssessment = z.infer<typeof riskAssessmentSchema>;
