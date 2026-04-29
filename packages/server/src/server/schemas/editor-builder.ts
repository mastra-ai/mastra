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
  browser: z.boolean().optional(),
  /**
   * Whether the model picker is visible in the Agent Builder.
   * Omitted/`false` ⇒ picker hidden (locked mode); `models.default` is applied.
   */
  model: z.boolean().optional(),
});

/**
 * Allowlist + default-model entries for {@link agentModelsSchema}.
 *
 * Four standalone schemas (known × custom × entry × default) joined with `z.union`.
 * The schema does NOT validate `provider` against the runtime registry — invalid strings
 * surface as warnings during Phase 4 config validation.
 *
 * NOTE: `z.union(...).extend()` does not exist; that's why these are separate schemas.
 */
// All four schemas are `.strict()` so typos like `modelID` or `Provider` are
// rejected up-front instead of silently widening the policy.
const knownProviderEntrySchema = z
  .object({
    provider: z.string().min(1),
    modelId: z.string().min(1).optional(),
  })
  .strict();

const customProviderEntrySchema = z
  .object({
    kind: z.literal('custom'),
    provider: z.string().min(1),
    modelId: z.string().min(1).optional(),
  })
  .strict();

const knownDefaultModelEntrySchema = z
  .object({
    provider: z.string().min(1),
    modelId: z.string().min(1),
  })
  .strict();

const customDefaultModelEntrySchema = z
  .object({
    kind: z.literal('custom'),
    provider: z.string().min(1),
    modelId: z.string().min(1),
  })
  .strict();

// Custom-tagged variants must come first so the discriminator (`kind: 'custom'`)
// wins over the more permissive known-provider schemas. Otherwise the union
// silently drops the `kind` field on matching inputs.
export const providerModelEntrySchema = z.union([customProviderEntrySchema, knownProviderEntrySchema]);
export const defaultModelEntrySchema = z.union([customDefaultModelEntrySchema, knownDefaultModelEntrySchema]);

/**
 * Admin-controlled model allowlist + default for the Agent Builder.
 */
export const agentModelsSchema = z.object({
  allowed: z.array(providerModelEntrySchema).optional(),
  default: defaultModelEntrySchema.optional(),
});

/**
 * Agent configuration (pinned, non-overridable settings).
 *
 * Known structured field: `models` (Phase 1 contracts).
 * Other keys flow through unchanged for forward compatibility.
 */
export const agentConfigurationSchema = z
  .object({
    models: agentModelsSchema.optional(),
  })
  .catchall(z.unknown());

/**
 * Derived `BuilderModelPolicy`. Server-owned shape so the playground hook is a
 * thin selector and the UI never re-derives policy from `features` / `configuration`.
 *
 * Mirrors `BuilderModelPolicy` from `@mastra/core/agent-builder/ee`:
 * - `active: false` ⇒ all other fields ignored.
 * - `active: true` + `pickerVisible: false` (locked) ⇒ `default` set in valid configs.
 * - `allowed`/`default` are passed through verbatim when present.
 */
export const builderModelPolicySchema = z.object({
  active: z.boolean(),
  pickerVisible: z.boolean().optional(),
  allowed: z.array(providerModelEntrySchema).optional(),
  default: defaultModelEntrySchema.optional(),
});

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
  modelPolicy: builderModelPolicySchema.optional(),
  /**
   * Non-fatal warnings produced by `EditorAgentBuilder`'s constructor-time
   * validation (e.g. allowlist entries with unknown provider strings). UI
   * surfaces these as a banner in the Builder admin view.
   */
  modelPolicyWarnings: z.array(z.string()).optional(),
});

export type AgentFeatures = z.infer<typeof agentFeaturesSchema>;
export type AgentConfiguration = z.infer<typeof agentConfigurationSchema>;
export type BuilderSettingsResponse = z.infer<typeof builderSettingsResponseSchema>;
export type ProviderModelEntrySchema = z.infer<typeof providerModelEntrySchema>;
export type DefaultModelEntrySchema = z.infer<typeof defaultModelEntrySchema>;
export type AgentModelsSchema = z.infer<typeof agentModelsSchema>;
export type BuilderModelPolicySchema = z.infer<typeof builderModelPolicySchema>;
