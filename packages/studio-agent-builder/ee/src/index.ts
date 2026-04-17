/**
 * @mastra/studio-agent-builder
 *
 * Enterprise end-user Agent Builder surface for Mastra Studio.
 * Attach a `MastraAgentBuilder` instance to `new Mastra({ agentBuilder })`
 * to unlock the end-user UI.
 *
 * @license Mastra Enterprise License — see ../../LICENSE.md
 */

export { MastraAgentBuilder } from './agent-builder';
export { assertAgentBuilderLicense } from './license';
export type {
  IMastraAgentBuilder,
  MastraAgentBuilderConfig,
  AgentBuilderEnabledSection,
  AgentBuilderMarketplaceConfig,
  AgentBuilderConfigureConfig,
  AgentBuilderRecentsConfig,
} from './types';
