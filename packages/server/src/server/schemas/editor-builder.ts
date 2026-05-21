import { z } from 'zod/v4';

/**
 * Agent feature flags for the builder.
 *
 * Wire format: each key is an optional boolean. The server normalizes admin
 * input via `resolveAgentFeatures` (default-on semantics): any omitted key
 * resolves to `true`; admins opt out by setting a key to `false`. The
 * `GET /editor/builder/settings` response always carries a fully-resolved
 * object — clients should still use strict `=== true` checks.
 *
 * Special cases:
 * - `browser`: only resolves to `true` when `configuration.agent.browser` is
 *   provided. Omitted with no config ⇒ silently `false` (no warning).
 *   Explicit `true` with no config ⇒ warns and downgrades to `false`.
 */
export const agentFeaturesSchema = z.object({
  tools: z.boolean().optional(),
  agents: z.boolean().optional(),
  workflows: z.boolean().optional(),
  scorers: z.boolean().optional(),
  skills: z.boolean().optional(),
  memory: z.boolean().optional(),
  variables: z.boolean().optional(),
  favorites: z.boolean().optional(),
  avatarUpload: z.boolean().optional(),
  browser: z.boolean().optional(),
  /**
   * Whether the model picker is visible in the Agent Builder.
   * Omitted ⇒ picker visible (default-on). Explicit `false` ⇒ picker hidden
   * (locked mode); `models.default` is required and applied.
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
 * Admin-controlled allowlist for one of the builder pickers (tools/agents/workflows).
 *
 * Semantics:
 * - omitted ⇒ unrestricted (all registered IDs shown in the picker).
 * - `allowed: []` ⇒ empty picker (explicit lockdown).
 * - `allowed: [...ids]` ⇒ only the listed IDs are shown.
 */
export const pickerAllowlistSchema = z
  .object({
    allowed: z.array(z.string()).optional(),
  })
  .strict();

/**
 * Agent configuration (pinned, non-overridable settings).
 *
 * Known structured field: `models` (Phase 1 contracts).
 * Other keys flow through unchanged for forward compatibility.
 */
export const agentConfigurationSchema = z
  .object({
    models: agentModelsSchema.optional(),
    tools: pickerAllowlistSchema.optional(),
    agents: pickerAllowlistSchema.optional(),
    workflows: pickerAllowlistSchema.optional(),
  })
  .catchall(z.unknown());

/**
 * Resolved picker visibility returned in `BuilderSettingsResponse`.
 *
 * Per kind:
 * - `null` ⇒ unrestricted (show all registered entries).
 * - `string[]` ⇒ explicit allowlist (may be empty to show none).
 */
export const builderPickerSchema = z.object({
  visibleTools: z.array(z.string()).nullable(),
  visibleAgents: z.array(z.string()).nullable(),
  visibleWorkflows: z.array(z.string()).nullable(),
});

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
 * Canonical surface-agnostic model policy schema. `builderModelPolicySchema`
 * is preserved as an alias for backward compatibility but new call sites
 * should consume this.
 */
export const modelPolicySchema = builderModelPolicySchema;

/**
 * UI surface that consumes a model policy. Mirrors `ModelPolicySurface`
 * from `@mastra/core/agent-builder/ee`. Used as the `?surface=` query
 * parameter on `GET /editor/settings/model-policy`.
 */
export const modelPolicySurfaceSchema = z.enum(['builder', 'editor']);

/**
 * Query schema for `GET /editor/settings/model-policy`.
 *
 * `surface` is required so the response is unambiguous; the server returns a
 * different policy slice per surface (today only `'builder'` has a real
 * source; `'editor'` resolves to `{ active: false }`).
 */
export const modelPolicyQuerySchema = z.object({
  surface: modelPolicySurfaceSchema,
});

/**
 * Response schema for `GET /editor/settings/model-policy`. Always returns a
 * fully-resolved `ModelPolicy` (never undefined) so clients can render
 * deterministically.
 */
export const modelPolicyResponseSchema = modelPolicySchema;

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
   * Resolved picker visibility for tools/agents/workflows. Always present when
   * the builder is enabled. Omitted when the builder is disabled.
   */
  picker: builderPickerSchema.optional(),
  /**
   * Non-fatal warnings produced by `EditorAgentBuilder`'s constructor-time
   * validation (e.g. allowlist entries with unknown provider strings, or
   * picker allowlist entries that don't match a registered ID). UI surfaces
   * these as a banner in the Builder admin view.
   */
  modelPolicyWarnings: z.array(z.string()).optional(),
});

/**
 * Infrastructure status response for Agent Builder admin diagnostics.
 *
 * Reports the Agent Builder-specific primitive configuration plus lightweight
 * runtime resolution state where useful.
 */
export const infrastructureStatusResponseSchema = z.object({
  channels: z.object({
    providers: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        isConfigured: z.boolean(),
        routeCount: z.number(),
      }),
    ),
  }),
  browser: z.object({
    type: z.string().nullable(),
    provider: z.string().nullable(),
    env: z.string().nullable(),
    registered: z.boolean(),
    availableProviders: z.array(z.string()),
    config: z.array(z.object({ key: z.string(), value: z.string() })),
  }),
  workspace: z.object({
    type: z.string().nullable(),
    workspaceId: z.string().nullable(),
    name: z.string().nullable(),
    source: z.string().nullable(),
    registered: z.boolean(),
    hasFilesystem: z.boolean(),
    hasSandbox: z.boolean(),
    filesystemProvider: z.string().nullable(),
    sandboxProvider: z.string().nullable(),
    config: z.array(z.object({ key: z.string(), value: z.string() })),
  }),
  registries: z.object({
    skillsSh: z.object({
      enabled: z.boolean(),
    }),
  }),
});

export type InfrastructureStatus = z.infer<typeof infrastructureStatusResponseSchema>;

export type AgentFeatures = z.infer<typeof agentFeaturesSchema>;
export type AgentConfiguration = z.infer<typeof agentConfigurationSchema>;
export type BuilderSettingsResponse = z.infer<typeof builderSettingsResponseSchema>;
export type ProviderModelEntrySchema = z.infer<typeof providerModelEntrySchema>;
export type DefaultModelEntrySchema = z.infer<typeof defaultModelEntrySchema>;
export type AgentModelsSchema = z.infer<typeof agentModelsSchema>;
export type BuilderModelPolicySchema = z.infer<typeof builderModelPolicySchema>;
export type ModelPolicySchema = z.infer<typeof modelPolicySchema>;
export type ModelPolicySurfaceSchema = z.infer<typeof modelPolicySurfaceSchema>;
export type ModelPolicyQuerySchema = z.infer<typeof modelPolicyQuerySchema>;
export type PickerAllowlistSchema = z.infer<typeof pickerAllowlistSchema>;
export type BuilderPickerSchema = z.infer<typeof builderPickerSchema>;
