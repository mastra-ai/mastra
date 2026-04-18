/**
 * @mastra/core/agent-builder/ee
 *
 * Type contracts for the Studio Agent Builder EE feature.
 * The concrete implementation lives in `@mastra/studio-agent-builder`.
 *
 * @license Mastra Enterprise License — see `ee/LICENSE`.
 * @packageDocumentation
 */

export type {
  IMastraAgentBuilder,
  MastraAgentBuilderConfig,
  AgentBuilderEnabledSection,
  AgentBuilderMarketplaceConfig,
  AgentBuilderConfigureConfig,
  AgentBuilderRecentsConfig,
  ResolvedAgentBuilderMarketplaceConfig,
  ResolvedAgentBuilderConfigureConfig,
  ResolvedAgentBuilderRecentsConfig,
} from './types';

export {
  PROJECT_TOOL_IDS,
  addTaskTool,
  updateTaskTool,
  listTasksTool,
  searchMarketplaceTool,
  proposeAgentTool,
  getProjectTools,
} from './tools';
