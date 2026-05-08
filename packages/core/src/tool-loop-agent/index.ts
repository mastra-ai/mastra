import { generateId } from '@internal/ai-sdk-v5';
import { Agent } from '../agent';
import { ToolLoopAgentProcessor } from './tool-loop-processor';
import type { ToolLoopAgentLike } from './utils';
export { type ToolLoopAgentLike, isToolLoopAgentLike, getSettings } from './utils';

/**
 * Converts an AI SDK v6 ToolLoopAgent instance into a Mastra Agent.
 *
 * This enables users to create a ToolLoopAgent using AI SDK's API
 * while gaining access to Mastra features like memory, processors, scorers, and observability.
 *
 * @example
 * ```typescript
 * import { ToolLoopAgent, tool } from 'ai';
 * import { openai } from '@ai-sdk/openai';
 * import { toolLoopAgentToMastraAgent } from '@mastra/core/tool-loop-agent';
 *
 * const toolLoopAgent = new ToolLoopAgent({
 *   id: 'weather-agent',
 *   model: openai('gpt-4o'),
 *   instructions: 'You are a helpful weather assistant.',
 *   tools: { weather: weatherTool },
 *   temperature: 0.7,
 * });
 *
 * const mastraAgent = toolLoopAgentToMastraAgent(toolLoopAgent);
 *
 * const result = await mastraAgent.generate({ prompt: 'What is the weather in NYC?' });
 * ```
 *
 * @param agent - The ToolLoopAgent instance
 * @param options - Optional name fallback since Mastra Agent requires id/name but ToolLoopAgent doesn't
 * @returns A Mastra Agent instance
 */
export function toolLoopAgentToMastraAgent(agent: ToolLoopAgentLike, options?: { fallbackName?: string }) {
  const processor = new ToolLoopAgentProcessor(agent);
  const agentConfig = processor.getAgentConfig();
  const id = agentConfig.id || options?.fallbackName || `tool-loop-agent-${generateId()}`;

  return new Agent({
    ...agentConfig,
    id,
    name: agentConfig.name || id,
    inputProcessors: [processor],
  });
}
