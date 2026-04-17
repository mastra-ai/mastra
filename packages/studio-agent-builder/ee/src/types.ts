/**
 * Configuration types for the Mastra Studio Agent Builder.
 *
 * These mirror the canonical types in `@mastra/core/agent-builder/ee` so
 * packages that only depend on `@mastra/core` can type-check against the
 * same shape without depending on this EE package.
 *
 * @license Mastra Enterprise License — see ../../LICENSE.md
 */
export type {
  IMastraAgentBuilder,
  MastraAgentBuilderConfig,
  AgentBuilderEnabledSection,
  AgentBuilderMarketplaceConfig,
  AgentBuilderConfigureConfig,
  AgentBuilderRecentsConfig,
} from '@mastra/core/agent-builder/ee';
