import { z } from 'zod';

export const extractionQualityPolicySchema = z
  .object({
    id: z.literal('extraction-quality'),
    version: z.literal('1.0.0'),
    minimumFieldConfidence: z.number().min(0).max(1),
    enforceMinimumFieldConfidence: z.boolean(),
    unreadableRoute: z.literal('MISSING_INFORMATION'),
  })
  .strict();

export const extractionQualityPolicy = Object.freeze(
  extractionQualityPolicySchema.parse({
    id: 'extraction-quality',
    version: '1.0.0',
    minimumFieldConfidence: 0.8,
    enforceMinimumFieldConfidence: true,
    unreadableRoute: 'MISSING_INFORMATION',
  }),
);

const policies = Object.freeze({
  'demo-default': extractionQualityPolicySchema.parse({
    ...extractionQualityPolicy,
    enforceMinimumFieldConfidence: false,
  }),
  'demo-strict': extractionQualityPolicy,
});

const extractionQualityProfileSchema = z.enum(['demo-default', 'demo-strict']);

export const loadExtractionQualityPolicy = (profile: keyof typeof policies) =>
  policies[extractionQualityProfileSchema.parse(profile)];
