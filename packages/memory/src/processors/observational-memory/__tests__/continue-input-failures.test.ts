import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';

const filler = Array.from({ length: 400 }, (_, i) => `shipment event ${i} at depot`).join('\n');
let mock: LLMock;

beforeAll(async () => {
  mock = new LLMock({ port: 0 });
  await mock.start();
});
afterEach(() => {
  mock.clearFixtures();
  mock.clearRequests();
  mock.resetMatchCounts();
});
afterAll(async () => {
  await mock.stop();
});

function setup(
  storage = new InMemoryStore(),
  hooks?: { afterObservation: () => Promise<never> },
  failurePolicy: 'abort' | 'continue' = 'continue',
) {
  const openai = createOpenAI({ apiKey: 'test', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
  const memory = new Memory({
    storage,
    options: {
      observationalMemory: {
        enabled: true,
        hooks,
        observation: {
          model: openai.chat('observer'),
          messageTokens: 1000,
          bufferTokens: false,
          maxRetries: 0,
          failurePolicy,
        },
        reflection: { model: openai.chat('observer'), observationTokens: 100_000 },
      },
    },
  });
  const agent = new Agent({
    id: 'observation-failure',
    name: 'observation-failure',
    instructions: 'Use lookup.',
    model: openai.chat('actor'),
    memory,
    tools: {
      lookup: createTool({
        id: 'lookup',
        description: 'Look up an order',
        inputSchema: z.object({ orderId: z.string() }),
        execute: async () => ({ status: 'SHIPPED', log: filler }),
      }),
    },
  });
  mock.on(
    { endpoint: 'chat', model: 'actor', predicate: req => req.messages.at(-1)?.role === 'user' },
    { toolCalls: [{ id: 'lookup-call', name: 'lookup', arguments: '{"orderId":"4471"}' }] },
  );
  mock.on({ endpoint: 'chat', model: 'actor' }, { content: 'The order shipped.' });
  return agent;
}

describe('OM continue policy for input failures', () => {
  it.each(['generate', 'stream'] as const)(
    'continues %s after an observation transform fails without dropping the live prompt',
    async method => {
      mock.on(
        { endpoint: 'chat', model: 'observer' },
        { content: '<observations>\n## October 22, 2026\n- User asked for order status\n</observations>' },
      );
      const afterObservation = vi.fn(async () => {
        throw new Error('observation transform failed');
      });
      const agent = setup(new InMemoryStore(), { afterObservation });
      const options = { memory: { thread: `transform-failure-${method}`, resource: 'r' }, maxSteps: 3 };
      const text =
        method === 'generate'
          ? (await agent.generate('Find order 4471', options)).text
          : await (
              await agent.stream('Find order 4471', options)
            ).text;
      expect(text).toBe('The order shipped.');
      const requests = mock.getRequests().filter(entry => (entry.body as { model?: string }).model === 'actor');
      expect(requests).toHaveLength(2);
      const secondPrompt = JSON.stringify((requests[1]!.body as { messages: unknown }).messages);
      expect(secondPrompt).toContain('SHIPPED');
      expect(secondPrompt).toContain('Find order 4471');
      expect(mock.getRequests().some(entry => (entry.body as { model?: string }).model === 'observer')).toBe(true);
      expect(afterObservation).toHaveBeenCalledOnce();
    },
  );

  it('still fails the turn when the observation policy is abort', async () => {
    mock.on(
      { endpoint: 'chat', model: 'observer' },
      { content: '<observations>\n## October 22, 2026\n- User asked for order status\n</observations>' },
    );
    const agent = setup(
      new InMemoryStore(),
      {
        afterObservation: async () => {
          throw new Error('observation transform failed');
        },
      },
      'abort',
    );
    const result = await agent.generate('Find order 4471', {
      memory: { thread: 'abort-transform', resource: 'r' },
      maxSteps: 3,
    });
    expect(result.tripwire?.reason).toContain('observation transform failed');
    const requests = mock.getRequests().filter(entry => (entry.body as { model?: string }).model === 'actor');
    expect(requests).toHaveLength(1);
  });

  it('continues when loading the observation record fails', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('memory'))!;
    vi.spyOn(store, 'getObservationalMemory').mockRejectedValueOnce(new Error('observation storage unavailable'));
    const agent = setup(storage);
    const result = await agent.generate('Find order 4471', {
      memory: { thread: 'storage-unavailable', resource: 'r' },
      maxSteps: 3,
    });
    expect(result.text).toBe('The order shipped.');
    const requests = mock.getRequests().filter(entry => (entry.body as { model?: string }).model === 'actor');
    expect(requests).toHaveLength(2);
    expect(JSON.stringify((requests[1]!.body as { messages: unknown }).messages)).toContain('SHIPPED');
  });
});
