import { Agent } from '@mastra/core/agent';
import { createMockModel, MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';

const safeModerationModel = createMockModel({
  objectGenerationMode: 'json',
  mockText: {
    category_scores: [],
    reason: null,
  },
});

const streamingText = 'First sentence. Next sentence. Final sentence.';

const streamingResponseModel = new MastraLanguageModelV2Mock({
  provider: 'mock',
  modelId: 'mock-guardrails-streaming-response',
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [{ type: 'text', text: streamingText }],
    warnings: [],
  }),
  doStream: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'stream-start', warnings: [] });
        controller.enqueue({
          type: 'response-metadata',
          id: 'guardrails-streaming-response',
          modelId: 'mock-guardrails-streaming-response',
          timestamp: new Date(0),
        });
        controller.enqueue({ type: 'text-start', id: 'text-guardrails-demo' });
        controller.enqueue({ type: 'text-delta', id: 'text-guardrails-demo', delta: 'First sentence. Nex' });
        controller.enqueue({ type: 'text-delta', id: 'text-guardrails-demo', delta: 't sentence. Final sentence.' });
        controller.enqueue({ type: 'text-end', id: 'text-guardrails-demo' });
        controller.enqueue({
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        });
        controller.close();
      },
    }),
  }),
});

export const guardrailsInputDemoAgent = new Agent({
  id: 'guardrails-input-demo-agent',
  name: 'Guardrails Input Demo Agent',
  instructions: 'Return a short friendly confirmation.',
  model: createMockModel({ mockText: 'Input accepted.' }),
  guardrails: {
    privacy: {
      secrets: {
        action: 'block',
        applyTo: 'input',
      },
    },
    cost: {
      tokenLimit: 50,
    },
  },
});

export const guardrailsStreamingDemoAgent = new Agent({
  id: 'guardrails-streaming-demo-agent',
  name: 'Guardrails Streaming Demo Agent',
  instructions:
    'Return the deterministic streaming response from the mock model. This agent demonstrates sentence windowing and lookback for output guardrails.',
  model: streamingResponseModel,
  guardrails: {
    model: safeModerationModel,
    sensitivity: 'medium',
    streaming: {
      checkEvery: 'sentence',
      lookback: 'medium',
    },
    content: {
      moderation: {
        applyTo: 'output',
        action: 'block',
      },
    },
  },
});
