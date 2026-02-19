import { z } from 'zod';

export const STORED_SCORER_TYPES = ['llm-judge'] as const;

export type StoredScorerType = (typeof STORED_SCORER_TYPES)[number];

const samplingConfigSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('ratio'), rate: z.number().min(0).max(1) }),
]);

export const scorerFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less'),
  type: z.enum(STORED_SCORER_TYPES),
  model: z.object({
    provider: z.string(),
    name: z.string(),
  }),
  instructions: z.string(),
  scoreRange: z.object({
    min: z.number(),
    max: z.number(),
  }),
  defaultSampling: samplingConfigSchema.optional(),
});

export type ScorerFormValues = z.infer<typeof scorerFormSchema>;
