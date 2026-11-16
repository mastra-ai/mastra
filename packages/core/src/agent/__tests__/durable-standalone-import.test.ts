import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect } from 'vitest';
import { Agent } from '../../agent';

function makeMockModel() {
  return new MockLanguageModelV2({
    doStream: async () =>
      ({
        stream: convertArrayToReadableStream([
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'hi' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }) as any,
  }) as LanguageModelV2;
}

describe('standalone resumable Agent — only `@mastra/core/agent` imported', () => {
  it('executes and replays `.stream()` without a durable execution wrapper', async () => {
    const agent = new Agent({
      id: 'standalone',
      name: 'Standalone',
      instructions: 'test',
      model: makeMockModel(),
      durable: true,
    });

    const output = await agent.stream('hi');
    await output.consumeStream();
    expect(await output.text).toBe('hi');
    const observer = await agent.observe(output.runId);
    await observer.output.consumeStream();
    expect(await observer.output.text).toBe('hi');
    observer.detach();
    await expect(agent.prepare('hi')).rejects.toThrow('createDurableAgent');
  });
});
