import { z } from 'zod';
import { identifierSchema } from '../billing/contracts/core.js';
export const briefSchema = z.string().trim().min(1).max(2000);
export const artifactSchema = z
  .strictObject({
    id: z.uuid(),
    downloadPath: z.string().max(512).optional(),
    executionId: identifierSchema,
    accountId: identifierSchema,
    workspaceId: identifierSchema,
    creatorId: identifierSchema,
    filename: z.string().regex(/^image-[1-3]\.png$/),
    title: z.string().min(1).max(120),
    mime: z.literal('image/png'),
    width: z.union([z.literal(1024), z.literal(1536)]),
    height: z.union([z.literal(1024), z.literal(1536)]),
    bytes: z
      .number()
      .int()
      .min(1)
      .max(8 * 1024 * 1024),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .refine(value => value.width === 1024 || value.height === 1024)
  .transform(artifact => ({
    ...artifact,
    downloadPath: `/billing/workspaces/${encodeURIComponent(artifact.workspaceId)}/artifacts/${artifact.id}`,
  }));
export type Artifact = z.infer<typeof artifactSchema>;
export const imageOutputSchema = z.strictObject({ artifacts: z.tuple([artifactSchema]) });
export const kitInputSchema = z.strictObject({
  brief: briefSchema
    .max(1800)
    .describe(
      'Only the subject and setting of ONE illustration, for example: A blue bird in a quiet forest. Do not include kits, styles, variants, layouts, multiple panels or image counts. The workflow supplies those.',
    ),
});
export const promptsSchema = z.tuple([briefSchema, briefSchema, briefSchema]);
export const kitStateSchema = z.strictObject({ brief: briefSchema, prompts: promptsSchema });
export const kitOutputSchema = kitStateSchema.extend({
  artifacts: z.tuple([artifactSchema, artifactSchema, artifactSchema]),
});
export const approvalSchema = z.strictObject({ approved: z.literal(true) });
