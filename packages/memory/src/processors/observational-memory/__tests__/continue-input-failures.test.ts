import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent, MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';
import { ObservationalMemory } from '../observational-memory';

const filler = Array.from({ length: 400 }, (_, i) => `shipment event ${i} at depot`).join('\n');
let mock: LLMock;

beforeAll(async () => {
  mock = new LLMock({ port: 0 });
  await mock.start();
});
afterEach(() => {
  vi.restoreAllMocks();
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
  overflowAfterTool = false,
  configureMemory?: (memory: Memory) => void,
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
          observeOnContextOverflow: overflowAfterTool,
        },
        reflection: { model: openai.chat('observer'), observationTokens: 100_000 },
      },
    },
  });
  configureMemory?.(memory);
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
  if (overflowAfterTool) {
    mock.on(
      { endpoint: 'chat', model: 'actor', predicate: req => JSON.stringify(req.messages).includes('SHIPPED') },
      {
        error: { message: 'prompt is too long: 210345 tokens > 200000 maximum', code: 'context_length_exceeded' },
        status: 400,
      },
    );
  }
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

  it('retains loaded memory history after a failed input context build', async () => {
    const failedBuild = vi
      .spyOn(ObservationalMemory.prototype, 'buildContextSystemMessages')
      .mockImplementationOnce(async () => {
        throw new Error('context build failed');
      });
    const history: MastraDBMessage = {
      id: 'earlier-order-history',
      role: 'user',
      type: 'text',
      content: { format: 2, parts: [{ type: 'text', text: 'Earlier order HISTORY_MARKER' }] },
      createdAt: new Date(),
    };
    const agent = setup(new InMemoryStore(), undefined, 'continue', false, memory => {
      const getContext = memory.getContext.bind(memory);
      vi.spyOn(memory, 'getContext').mockImplementation(async args => {
        const context = await getContext(args);
        return { ...context, messages: [...context.messages, history] };
      });
    });
    const result = await agent.generate('Find order 4471', {
      memory: { thread: 'history-on-input-failure', resource: 'r' },
      maxSteps: 3,
    });
    expect(result.text).toBe('The order shipped.');
    expect(failedBuild).toHaveBeenCalled();
    const requests = mock.getRequests().filter(entry => (entry.body as { model?: string }).model === 'actor');
    expect(JSON.stringify((requests[0]!.body as { messages: unknown }).messages)).toContain('HISTORY_MARKER');
  });

  it('re-adds unsealed loaded history after an input failure seals it', async () => {
    const history: MastraDBMessage = {
      id: 'history-with-seal',
      role: 'assistant',
      type: 'text',
      content: { format: 2, parts: [{ type: 'text', text: 'Earlier order HISTORY_MARKER' }] },
      createdAt: new Date(),
    };
    const originalAdd = MessageList.prototype.add;
    const readded: Array<{ sealed?: boolean; sealedAt?: unknown }> = [];
    vi.spyOn(MessageList.prototype, 'add').mockImplementation(function (messages, source, options) {
      if (source === 'memory' && !Array.isArray(messages) && messages.id === history.id) {
        readded.push({
          sealed: (messages.content.metadata as { mastra?: { sealed?: boolean } } | undefined)?.mastra?.sealed,
          sealedAt: (messages.content.parts?.[0] as { metadata?: { mastra?: { sealedAt?: unknown } } })?.metadata
            ?.mastra?.sealedAt,
        });
      }
      return originalAdd.call(this, messages, source, options);
    });
    vi.spyOn(ObservationalMemory.prototype, 'buildContextSystemMessages').mockImplementationOnce(async function () {
      this.sealMessagesForBuffering([history]);
      throw new Error('context build failed after seal');
    });
    const agent = setup(new InMemoryStore(), undefined, 'continue', false, memory => {
      const getContext = memory.getContext.bind(memory);
      vi.spyOn(memory, 'getContext').mockImplementation(async args => {
        const context = await getContext(args);
        return { ...context, messages: [...context.messages, history] };
      });
    });
    const result = await agent.generate('Find order 4471', {
      memory: { thread: 'sealed-history-on-input-failure', resource: 'r' },
      maxSteps: 3,
    });
    expect(result.text).toBe('The order shipped.');
    expect(readded).toHaveLength(2);
    expect(readded[1]).toEqual({ sealed: undefined, sealedAt: undefined });
  });

  it('restores message seals when observation fails after mutating the live list', async () => {
    mock.on(
      { endpoint: 'chat', model: 'observer' },
      { content: '<observations>\n## October 22, 2026\n- User asked for order status\n</observations>' },
    );
    const seal = ObservationalMemory.prototype.sealMessagesForBuffering;
    const failedSeal = vi
      .spyOn(ObservationalMemory.prototype, 'sealMessagesForBuffering')
      .mockImplementationOnce(function (messages) {
        seal.call(this, messages);
        throw new Error('seal interrupted');
      });
    const storage = new InMemoryStore();
    const agent = setup(storage);
    const result = await agent.generate('Find order 4471', {
      memory: { thread: 'seal-on-input-failure', resource: 'r' },
      maxSteps: 3,
    });
    expect(result.text).toBe('The order shipped.');
    expect(failedSeal).toHaveBeenCalled();
    const store = (await storage.getStore('memory'))!;
    const { messages } = await store.listMessages({ threadId: 'seal-on-input-failure' });
    const toolResult = messages.find(message => JSON.stringify(message.content).includes('SHIPPED'))!;
    expect((toolResult.content.metadata as { mastra?: { sealed?: boolean } } | undefined)?.mastra?.sealed).not.toBe(
      true,
    );
  });

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

  it.each(['generate', 'stream'] as const)(
    'does not report a successful %s turn when saving its final response fails',
    async method => {
      mock.on(
        { endpoint: 'chat', model: 'observer' },
        { content: '<observations>\n## October 22, 2026\n- User asked for order status\n</observations>' },
      );
      const storage = new InMemoryStore();
      const store = (await storage.getStore('memory'))!;
      const save = store.saveMessages.bind(store);
      vi.spyOn(store, 'saveMessages').mockImplementation(async args => {
        if (JSON.stringify(args.messages).includes('The order shipped.')) {
          throw new Error('final write unavailable');
        }
        return save(args);
      });
      const agent = setup(storage, {
        afterObservation: async () => {
          throw new Error('observation transform failed');
        },
      });
      const options = { memory: { thread: `write-failure-${method}`, resource: 'r' }, maxSteps: 3 };
      if (method === 'generate') {
        await expect(agent.generate('Find order 4471', options)).rejects.toThrow('final write unavailable');
      } else {
        const result = await (await agent.stream('Find order 4471', options)).getFullOutput();
        expect(JSON.stringify(result)).toContain('final write unavailable');
      }
      const { messages } = await store.listMessages({ threadId: `write-failure-${method}` });
      expect(JSON.stringify(messages)).not.toContain('The order shipped.');
    },
  );

  it('does not re-enter observation to recover a context overflow after input OM failed', async () => {
    mock.on(
      { endpoint: 'chat', model: 'observer' },
      { content: '<observations>\n## October 22, 2026\n- User asked for order status\n</observations>' },
    );
    const afterObservation = vi.fn(async () => {
      throw new Error('observation transform failed');
    });
    const agent = setup(new InMemoryStore(), { afterObservation }, 'continue', true);
    await expect(
      agent.generate('Find order 4471', {
        memory: { thread: 'overflow-after-failure', resource: 'r' },
        maxSteps: 3,
      }),
    ).rejects.toThrow('prompt is too long');
    const observerRequests = mock
      .getRequests()
      .filter(entry => (entry.body as { model?: string }).model === 'observer');
    expect(observerRequests).toHaveLength(1);
    expect(afterObservation).toHaveBeenCalledOnce();
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
