import type { Provider, ModelForProvider } from '../../llm/model';
import type { SerializedMemoryConfig } from '../../memory/types';
import type { StorageBrowserRef, StorageWorkspaceRef } from '../../storage/types';

/**
 * Allowlist entry for a known provider (one of the generated `Provider` strings).
 * `modelId` narrows to the union of model ids declared for that provider.
 * Omitting `modelId` is the **provider wildcard** — every model under the provider is allowed.
 */
export type KnownProviderEntry = {
  [P in Provider]: { provider: P; modelId?: ModelForProvider<P> };
}[Provider];

/**
 * Allowlist entry for a custom / gateway provider that isn't in the generated registry.
 *
 * The `kind: 'custom'` discriminant is **required** — without it, an arbitrary string
 * provider would silently bypass the typo protection that `KnownProviderEntry` gives.
 * `modelId` is `string` (with the `& {}` escape hatch keeping autocomplete usable).
 */
export type CustomProviderEntry = {
  kind: 'custom';
  provider: string;
  // string & {} preserves IDE autocomplete on call sites that still pass known model
  // strings, while making the type accept arbitrary gateway model ids.
  modelId?: string & {};
};

/**
 * Allowlist entry. Either a typed known-provider entry, or a tagged custom-provider entry.
 */
export type ProviderModelEntry = KnownProviderEntry | CustomProviderEntry;

/**
 * Default model entry. Same shape as {@link ProviderModelEntry} but `modelId` is required —
 * a default needs to point at a specific model, not a whole provider.
 */
export type DefaultModelEntry =
  | { [P in Provider]: { provider: P; modelId: ModelForProvider<P> } }[Provider]
  | { kind: 'custom'; provider: string; modelId: string & {} };

/**
 * Admin-controlled model policy for the Agent Builder.
 * Owned here; re-exported from `@mastra/core/agent-builder/ee` and the SDK.
 *
 * Invariants (enforced in Phase 4):
 * - `active: false` → all other fields ignored.
 * - `active: true` + `pickerVisible: false` (locked) → `default` MUST be set.
 * - When `allowed` is non-empty, `default` (if set) MUST satisfy `isModelAllowed(allowed, default)`.
 */
export interface BuilderModelPolicy {
  active: boolean;
  pickerVisible?: boolean;
  allowed?: ProviderModelEntry[];
  default?: DefaultModelEntry;
}

/**
 * Default values for agents created via the builder.
 * Used as fallbacks when the user doesn't specify a value.
 */
export interface BuilderAgentDefaults extends Record<string, unknown> {
  /** Default memory configuration for new agents */
  memory?: SerializedMemoryConfig;
  /** Default workspace reference for new agents */
  workspace?: StorageWorkspaceRef;
  /** Default browser configuration for new agents */
  browser?: StorageBrowserRef;
  /**
   * Admin-controlled model allowlist + default applied to new agents.
   * `allowed` empty/undefined ⇒ no restriction. `default` (if set) is preselected on create.
   * See parent RFC for full semantics (wildcards, custom gateways, deny-by-default).
   */
  models?: {
    allowed?: ProviderModelEntry[];
    default?: DefaultModelEntry;
  };
  /**
   * Admin-controlled allowlist of tool IDs visible in the builder tools picker.
   *
   * Semantics:
   * - omitted (`undefined`) ⇒ unrestricted; show all registered tools.
   * - `allowed: []` ⇒ empty picker (explicit lockdown).
   * - `allowed: [...ids]` ⇒ show only the listed tool IDs.
   *
   * IDs are `tool.id` (preferred — what you see in the UI, URLs and traces)
   * but the registration key (the property name under `Mastra({ tools: {…} })`)
   * is also accepted as an alias. Matched against the registered tools at
   * request time. Unknown IDs are dropped and surfaced as warnings.
   */
  tools?: {
    allowed?: string[];
  };
  /**
   * Admin-controlled allowlist of agent IDs visible in the builder sub-agents picker.
   *
   * Semantics:
   * - omitted (`undefined`) ⇒ unrestricted; show all registered agents.
   * - `allowed: []` ⇒ empty picker (explicit lockdown).
   * - `allowed: [...ids]` ⇒ show only the listed agent IDs.
   *
   * IDs are `Agent.id` (preferred — what you see in the UI, URLs and traces)
   * but the registration key (the property name under `Mastra({ agents: {…} })`)
   * is also accepted as an alias. Matched against the registered agents at
   * request time. Unknown IDs are dropped and surfaced as warnings.
   */
  agents?: {
    allowed?: string[];
  };
  /**
   * Admin-controlled allowlist of workflow IDs visible in the builder workflows picker.
   *
   * Semantics:
   * - omitted (`undefined`) ⇒ unrestricted; show all registered workflows.
   * - `allowed: []` ⇒ empty picker (explicit lockdown).
   * - `allowed: [...ids]` ⇒ show only the listed workflow IDs.
   *
   * IDs are `workflow.id` (preferred — what you see in the UI, URLs and traces)
   * but the registration key (the property name under `Mastra({ workflows: {…} })`)
   * is also accepted as an alias. Matched against the registered workflows at
   * request time. Unknown IDs are dropped and surfaced as warnings.
   */
  workflows?: {
    allowed?: string[];
  };
}

/**
 * Feature toggles for the agent editor surface.
 * Each key controls visibility of that section in the builder UI.
 *
 * **Semantic: omitted = false (blocklist model)**
 * - `true` — feature is visible to users
 * - `false` or omitted — feature is hidden
 *
 * Consumer code should use strict equality:
 * ```ts
 * const showTools = builder.getFeatures()?.agent?.tools === true;
 * ```
 */
export interface AgentFeatures {
  tools?: boolean;
  agents?: boolean;
  workflows?: boolean;
  scorers?: boolean;
  skills?: boolean;
  memory?: boolean;
  variables?: boolean;
  /** Star (favorite) agents and skills with per-user state and aggregate counts. */
  stars?: boolean;
  avatarUpload?: boolean;
  /** Allow end-users to enable browser access for their agents. */
  browser?: boolean;
  /**
   * Whether the model picker is visible to end-users in the Agent Builder.
   * Omitted/`false` ⇒ picker hidden (locked mode); admin's `models.default` is applied.
   * `true` ⇒ picker visible; choices are filtered by `models.allowed` if set.
   */
  model?: boolean;
}

/**
 * Configuration for the Agent Builder EE feature.
 * Passed to `MastraEditorConfig.builder`.
 *
 * All fields are optional. JSON-safe (no functions, no class instances).
 */
export interface AgentBuilderOptions {
  /**
   * Whether the builder is enabled. Default: true.
   * Set to false to disable the builder without removing the config.
   */
  enabled?: boolean;

  /**
   * Deployment-level feature toggles.
   * Key presence means "this surface exists for this deployment."
   */
  features?: {
    agent?: AgentFeatures;
  };

  /**
   * Admin-pinned values applied to every artifact the builder produces.
   * Not overridable by end-users.
   *
   * Known fields are typed explicitly; additional fields allowed for extensibility.
   */
  configuration?: {
    agent?: BuilderAgentDefaults;
  };
}

/**
 * Public interface for the Agent Builder.
 * Implemented by EditorAgentBuilder in @mastra/editor/ee.
 */
export interface IAgentBuilder {
  readonly enabled: boolean;
  getFeatures(): AgentBuilderOptions['features'];
  getConfiguration(): AgentBuilderOptions['configuration'];
  /**
   * Optional warnings produced during construction-time validation
   * (e.g. allowlist entries with unknown providers that lack `kind: 'custom'`).
   * Surfaced via `GET /editor/builder/settings.modelPolicyWarnings` for admin UI display.
   */
  getModelPolicyWarnings?(): string[];
}
