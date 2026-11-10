import { Agent } from '@mastra/core/agent';

// Each call reports this fixed usage, so the E2E test knows exactly how many
// tokens the generated server should report to telemetry.
const usage = { inputTokens: 123, outputTokens: 45, totalTokens: 168 };

const usageModel = {
  specificationVersion: 'v2' as const,
  provider: 'e2e-provider',
  modelId: 'e2e-usage-model',
  supportedUrls: {},
  async doGenerate() {
    return {
      content: [{ type: 'text' as const, text: 'ok' }],
      finishReason: 'stop' as const,
      usage,
      warnings: [],
    };
  },
  async doStream() {
    const chunks = [
      { type: 'stream-start', warnings: [] },
      { type: 'response-metadata', id: 'e2e-response', modelId: 'e2e-usage-model', timestamp: new Date() },
      { type: 'text-start', id: 'text' },
      { type: 'text-delta', id: 'text', delta: 'ok' },
      { type: 'text-end', id: 'text' },
      { type: 'finish', finishReason: 'stop', usage },
    ];
    return {
      stream: new ReadableStream({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.close();
        },
      }),
    };
  },
};

export const usageAgent = new Agent({
  id: 'usage-agent',
  name: 'Usage Agent',
  instructions: 'Reply with ok.',
  model: usageModel,
});
