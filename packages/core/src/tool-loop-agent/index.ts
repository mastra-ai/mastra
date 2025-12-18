import { Agent } from '../agent';
import { type ToolLoopAgentLike } from './utils';
import { ToolLoopAgentProcessor } from './tool-loop-processor';

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
 * import { Memory } from '@mastra/memory';
 *
 * const toolLoopAgent = new ToolLoopAgent({
 *   id: 'weather-agent',
 *   model: openai('gpt-4o'),
 *   instructions: 'You are a helpful weather assistant.',
 *   tools: { weather: weatherTool },
 *   temperature: 0.7,
 * });
 *
 * const mastraAgent = toolLoopAgentToMastraAgent(toolLoopAgent, {
 *   memory: new Memory(),
 * });
 *
 * const result = await mastraAgent.generate({ prompt: 'What is the weather in NYC?' });
 * ```
 *
 * @param agent - The ToolLoopAgent instance
 * @param options - Additional Mastra-specific configuration options
 * @returns A Mastra Agent instance
 */
export function toolLoopAgentToMastraAgent(agent: ToolLoopAgentLike) {
  const processor = new ToolLoopAgentProcessor(agent);
  return new Agent({
    ...processor.getAgentConfig(),
    inputProcessors: [processor],
  });
}
