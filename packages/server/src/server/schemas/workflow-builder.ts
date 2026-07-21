import { z } from 'zod/v4';
import { builderModelPolicySchema } from './editor-builder';

export const workflowBuilderSettingsResponseSchema = z.object({
  enabled: z.boolean(),
  modelPolicy: builderModelPolicySchema.optional(),
});

export type WorkflowBuilderSettingsResponse = z.infer<typeof workflowBuilderSettingsResponseSchema>;
