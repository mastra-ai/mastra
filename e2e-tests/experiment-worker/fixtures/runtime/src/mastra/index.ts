import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';

const responseText = 'hello from experiment worker';
const model = {
  specificationVersion: 'v2' as const,
  provider: 'experiment-e2e',
  modelId: 'deterministic-model',
  supportedUrls: {},
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop' as const,
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [{ type: 'text' as const, text: responseText }],
    warnings: [],
  }),
  doStream: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
    stream: new ReadableStream({
      start(controller) {
        for (const event of [
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'response-1', modelId: 'deterministic-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: responseText },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]) {
          controller.enqueue(event);
        }
        controller.close();
      },
    }),
  }),
};

const minimalAgent = new Agent({
  id: 'minimal-agent',
  name: 'Minimal Agent',
  instructions: 'Return the deterministic model response.',
  model,
});

console.error('minimal experiment fixture initialized');

export const mastra = new Mastra({ agents: { minimalAgent } });
