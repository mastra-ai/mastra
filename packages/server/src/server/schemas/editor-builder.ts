import { z } from 'zod/v4';

/**
 * Agent feature flags for the builder.
 * Omitted keys default to `false` (blocklist model).
 */
export const agentFeaturesSchema = z.object({
  tools: z.boolean().optional(),
  agents: z.boolean().optional(),
  workflows: z.boolean().optional(),
  scorers: z.boolean().optional(),
  skills: z.boolean().optional(),
  memory: z.boolean().optional(),
  variables: z.boolean().optional(),
  stars: z.boolean().optional(),
  avatarUpload: z.boolean().optional(),
});

/**
 * Agent configuration (pinned, non-overridable settings).
 */
export const agentConfigurationSchema = z.record(z.string(), z.unknown());

/**
 * Response schema for GET /editor/builder/settings
 */
export const builderSettingsResponseSchema = z.object({
  enabled: z.boolean(),
  features: z
    .object({
      agent: agentFeaturesSchema.optional(),
    })
    .optional(),
  configuration: z
    .object({
      agent: agentConfigurationSchema.optional(),
    })
    .optional(),
});

export type AgentFeatures = z.infer<typeof agentFeaturesSchema>;
export type AgentConfiguration = z.infer<typeof agentConfigurationSchema>;
export type BuilderSettingsResponse = z.infer<typeof builderSettingsResponseSchema>;
