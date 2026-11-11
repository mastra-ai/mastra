import { z } from 'zod';
import { identifierSchema } from '../billing/contracts.js';
export const briefSchema = z.string().trim().min(1).max(2000);
export const imageProfile = Object.freeze({
  model: 'gpt-image-2.5-flare',
  n: 1,
  size: '1024x1024',
  quality: 'low',
  output_format: 'png',
} as const);
export const artifactSchema = z.strictObject({
  id: z.uuid(),
  executionId: identifierSchema,
  accountId: identifierSchema,
  workspaceId: identifierSchema,
  creatorId: identifierSchema,
  filename: z.string().regex(/^image-[1-3]\.png$/),
  title: z.string().min(1).max(120),
  mime: z.literal('image/png'),
  width: z.literal(1024),
  height: z.literal(1024),
  bytes: z
    .number()
    .int()
    .min(1)
    .max(8 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export type Artifact = z.infer<typeof artifactSchema>;
export const imageOutputSchema = z.strictObject({ artifacts: z.tuple([artifactSchema]) });
export const kitInputSchema = z.strictObject({ brief: briefSchema.max(1800) });
export const promptsSchema = z.tuple([briefSchema, briefSchema, briefSchema]);
export const kitStateSchema = z.strictObject({ brief: briefSchema, prompts: promptsSchema });
export const kitOutputSchema = kitStateSchema.extend({
  artifacts: z.tuple([artifactSchema, artifactSchema, artifactSchema]),
});
export const approvalSchema = z.strictObject({ approved: z.boolean() });
