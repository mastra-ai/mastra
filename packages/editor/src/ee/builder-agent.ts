import { Agent } from '@mastra/core/agent';

/**
 * Pre-built agent registered on the user's Mastra instance when the
 * agent builder feature is enabled via MastraEditor config.
 *
 * Hardcoded for now — model, instructions and tools are intended to be
 * overridden / refined separately.
 */
export const builderAgent = new Agent({
  id: 'agent-builder',
  name: 'agent-builder',
  description: 'Mastra agent builder — generates agents, tools and workflows from natural language.',
  model: 'anthropic/claude-sonnet-4-5',
  instructions: '// TODO: replace with real instructions',
});
