import type { SerializedMemoryConfig } from '../../memory/types';
import type { StorageBrowserRef, StorageWorkspaceRef } from '../../storage/types';

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
}
