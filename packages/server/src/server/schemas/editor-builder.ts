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

export type AgentFeatures = z.infer<typeof agentFeaturesSchema>;
