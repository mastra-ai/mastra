import type { GetAgentResponse } from '@mastra/client-js';

export function createAgentList(count: number): Record<string, GetAgentResponse> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => {
      const id = `agent-${index + 1}`;
      const agent: GetAgentResponse = {
        id,
        name: `Agent ${index + 1}`,
        instructions: 'Help with product questions.',
        provider: 'openai.chat',
        modelId: 'gpt-5',
        modelVersion: 'v2',
        modelList: undefined,
        tools: {},
        workflows: {},
        agents: {},
        defaultOptions: {},
        defaultGenerateOptionsLegacy: {},
        defaultStreamOptionsLegacy: {},
      };
      return [id, agent];
    }),
  );
}
