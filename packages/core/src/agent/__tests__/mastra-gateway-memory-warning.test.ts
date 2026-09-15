import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';

describe('mastra gateway memory warning', () => {
  // The warning used to be suppressed for Mastra gateway models, because the
  // gateway supplied memory itself. It no longer does, so passing a thread and
  // resource without configuring memory has to say so for gateway models too.
  it('warns when a mastra gateway model is used with a thread and resource but no memory', async () => {
    const warn = vi.fn();

    const duckTypedGatewayModel = {
      specificationVersion: 'v2' as const,
      provider: 'openrouter',
      modelId: 'openai/gpt-4o',
      defaultObjectGenerationMode: 'json' as const,
      supportsStructuredOutputs: true,
      supportsImageUrls: true,
      gatewayId: 'mastra',
      async doGenerate() {
        return {
          content: [{ type: 'text' as const, text: 'ok' }],
          finishReason: 'stop' as const,
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
      async doStream() {
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'text-start', id: 'text-1' });
              controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'ok' });
              controller.enqueue({ type: 'text-end', id: 'text-1' });
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    };

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: duckTypedGatewayModel as any,
    });

    agent.__setLogger({
      debug: vi.fn(),
      info: vi.fn(),
      warn,
      error: vi.fn(),
      trace: vi.fn(),
    } as any);

    const result = await agent.generate('hello', {
      memory: {
        thread: { id: 'thread-1' },
        resource: 'resource-1',
      },
    });

    expect(result.text).toBe('ok');
    expect(warn).toHaveBeenCalledWith(
      'No memory is configured but resourceId and threadId were passed in args',
      expect.anything(),
    );
  });
});
