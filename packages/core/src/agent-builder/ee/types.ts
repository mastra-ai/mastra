/**
 * @license Mastra Enterprise License — see `ee/LICENSE` at the repo root.
 *
 * Type contracts for the Mastra Studio Agent Builder surface.
 *
 * These types live in `@mastra/core` so that packages (including the server)
 * can refer to the shape of an attached `agentBuilder` without depending on
 * the `@mastra/studio-agent-builder` implementation package. The concrete
 * implementation (and license enforcement) lives in the EE package and in
 * `@mastra/server`.
 */

/**
 * Which capability sections the end-user Agent Builder exposes on a stored
 * agent's create/edit form. Admins curate this list to match what their
 * non-engineer users need.
 */
export type AgentBuilderEnabledSection =
  | 'tools'
  | 'agents'
  | 'workflows'
  | 'scorers'
  | 'skills'
  | 'memory'
  | 'variables';

/**
 * Configuration for the "Marketplace" sidebar section where end-users discover
 * agents and skills built by other members of the team.
 */
export interface AgentBuilderMarketplaceConfig {
  /** Master switch for the entire Marketplace section. */
  enabled?: boolean;
  /** Whether the Agents tab is visible inside the Marketplace. */
  showAgents?: boolean;
  /** Whether the Skills tab is visible inside the Marketplace. */
  showSkills?: boolean;
  /** Whether end-users may star marketplace items to pin them to their own sidebar. */
  allowStarring?: boolean;
  /** Whether authors may flip a private item to public via "Share to Marketplace". */
  allowSharing?: boolean;
}

/**
 * Configuration for the "Configure" sidebar section (settings-style surface).
 */
export interface AgentBuilderConfigureConfig {
  /** Whether end-users may publish skills to the team marketplace. */
  allowSkillCreation?: boolean;
  /** Whether the light/dark appearance toggle is offered. */
  allowAppearance?: boolean;
  /** Whether authors may upload an avatar image for an agent. */
  allowAvatarUpload?: boolean;
}

/**
 * Configuration for the "Recents" quick list in the Agents sidebar section.
 */
export interface AgentBuilderRecentsConfig {
  /** Maximum number of recent agents to display in the sidebar. */
  maxItems?: number;
}

/**
 * User-provided configuration for an Agent Builder instance.
 */
export interface MastraAgentBuilderConfig {
  enabledSections?: AgentBuilderEnabledSection[];
  marketplace?: AgentBuilderMarketplaceConfig;
  configure?: AgentBuilderConfigureConfig;
  recents?: AgentBuilderRecentsConfig;
}

/**
 * Resolved (non-optional) variant of `AgentBuilderMarketplaceConfig`.
 * Returned by `IMastraAgentBuilder.getMarketplaceConfig()` after defaults.
 */
export interface ResolvedAgentBuilderMarketplaceConfig {
  enabled: boolean;
  showAgents: boolean;
  showSkills: boolean;
  allowStarring: boolean;
  allowSharing: boolean;
}

/**
 * Resolved (non-optional) variant of `AgentBuilderConfigureConfig`.
 */
export interface ResolvedAgentBuilderConfigureConfig {
  allowSkillCreation: boolean;
  allowAppearance: boolean;
  allowAvatarUpload: boolean;
}

/**
 * Resolved (non-optional) variant of `AgentBuilderRecentsConfig`.
 */
export interface ResolvedAgentBuilderRecentsConfig {
  maxItems: number;
}

/**
 * Minimal interface a Mastra instance depends on when an agentBuilder is
 * attached. Implementations (see `@mastra/studio-agent-builder`) may expose
 * additional methods.
 */
export interface IMastraAgentBuilder {
  readonly enabledSections: AgentBuilderEnabledSection[];
  readonly marketplace: ResolvedAgentBuilderMarketplaceConfig;
  readonly configure: ResolvedAgentBuilderConfigureConfig;
  readonly recents: ResolvedAgentBuilderRecentsConfig;

  getEnabledSections(): AgentBuilderEnabledSection[];
  getMarketplaceConfig(): ResolvedAgentBuilderMarketplaceConfig;
  getConfigureConfig(): ResolvedAgentBuilderConfigureConfig;
  getRecentsConfig(): ResolvedAgentBuilderRecentsConfig;
}
