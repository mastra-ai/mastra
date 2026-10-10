import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';

function model(fail: boolean) {
  return {
    specificationVersion: 'v2' as const,
    provider: 'mock',
    modelId: 'mock',
    supportedUrls: {},
    async doGenerate(): Promise<never> {
      throw new Error('unused');
    },
    async doStream() {
      await new Promise(r => setTimeout(r, 300));
      if (fail) throw Object.assign(new Error('Headers Timeout Error'), { isRetryable: false });
      return {
        stream: new ReadableStream({
          start(c) {
            c.enqueue({ type: 'stream-start', warnings: [] });
            c.enqueue({ type: 'text-start', id: 't' });
            c.enqueue({ type: 'text-delta', id: 't', delta: 'hi' });
            c.enqueue({ type: 'text-end', id: 't' });
            c.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            });
            c.close();
          },
        }),
      };
    },
  };
}

describe('DurableAgent cleanup() before the run ends (#25974)', () => {
  it.each([
    ['fails', true, 'onError'],
    ['finishes', false, 'onFinish'],
  ])('releases the thread and fires callbacks when the run %s', async (_label, fail, expected) => {
    const storage = new InMemoryStore();
    const agent = new Mastra({
      storage,
      logger: false,
      agents: {
        a: new Agent({
          id: 'a',
          name: 'a',
          instructions: 'x',
          model: model(fail) as any,
          memory: new MockMemory({ storage }),
          durable: true,
        }),
      },
    }).getAgent('a');
    const thread = { resourceId: 'user-1', threadId: `thread-${expected}` };
    const fired: string[] = [];
    const res: any = await agent.stream('hello', {
      memory: { thread: thread.threadId, resource: thread.resourceId },
      modelSettings: { maxRetries: 0 },
      onFinish: () => void fired.push('onFinish'),
      onError: () => void fired.push('onError'),
    });
    res.cleanup();

    await vi.waitFor(() => expect(agent.getActiveThreadRunId(thread)).toBeUndefined(), { timeout: 5000 });
    expect(fired).toContain(expected);
  });
});
