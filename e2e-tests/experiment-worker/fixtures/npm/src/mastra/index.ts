import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';

const model = {
  specificationVersion: 'v2' as const,
  provider: 'experiment-e2e',
  modelId: 'npm-model',
  supportedUrls: {},
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop' as const,
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    content: [{ type: 'text' as const, text: 'hello from npm fixture' }],
    warnings: [],
  }),
};

export const mastra = new Mastra({
  agents: {
    'shape-agent': new Agent({
      id: 'shape-agent',
      name: 'Package manager shape agent',
      instructions: 'Return the deterministic response.',
      model,
    }),
  },
});
