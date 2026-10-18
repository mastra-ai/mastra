import { z } from 'zod';

import { policyReferenceSchema } from '../../domain/context.js';
import {
  caseIdSchema,
  checksumSchema,
  riskAssessmentIdSchema,
  tenantIdSchema,
  timestampSchema,
} from '../../domain/identifiers.js';
import { reasonCodeSchema } from '../../domain/reasons.js';
import { riskLevelSchema, riskRouteSchema } from '../../domain/risk.js';
import type { riskNarrativeSchema } from '../../domain/risk.js';

export const explainRiskAssessmentInputSchema = z
  .object({
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    riskAssessmentId: riskAssessmentIdSchema,
    policy: policyReferenceSchema,
    evidenceFingerprint: checksumSchema,
    signals: z.array(z.object({ code: reasonCodeSchema, weight: z.number().min(0).max(100) }).strict()),
    score: z.number().min(0).max(100),
    level: riskLevelSchema,
    route: riskRouteSchema,
    generatedAt: timestampSchema,
  })
  .strict();

export interface RiskAssessmentProvider {
  explain(input: z.infer<typeof explainRiskAssessmentInputSchema>): Promise<z.infer<typeof riskNarrativeSchema> | null>;
}
