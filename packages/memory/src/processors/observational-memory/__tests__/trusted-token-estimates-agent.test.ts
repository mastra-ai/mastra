import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { Memory } from '../../../index';
import { TokenCounter } from '../token-counter';

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

const THREAD = 'trusted-thread';
const RESOURCE = 'trusted-resource';

function createAgent(store: InMemoryStore) {
  const openai = createOpenAI({ apiKey: 'test', baseURL: `${mock.url}/v1` });
  const memory = new Memory({
    storage: store,
    options: {
      observationalMemory: {
        enabled: true,
        scope: 'thread',
        observation: { model: openai.chat('observer'), messageTokens: 500_000, bufferTokens: false },
        reflection: { observationTokens: 60_000 },
      },
    },
  });
  const agent = new Agent({
    id: 'trusted',
    name: 'trusted',
    instructions: 'Be brief.',
    model: openai.chat('main'),
    memory,
  });
  return { agent, memory };
}

type StoredPart = { type: string; text?: string; providerMetadata?: { mastra?: { tokenEstimate?: unknown } } };

function trustedEntries(part: StoredPart): unknown[] {
  const estimate = part.providerMetadata?.mastra?.tokenEstimate;
  if (!estimate || typeof estimate !== 'object') return [];
  // Look at the top level and every nested value, whatever shape the top level has.
  return [estimate, ...Object.values(estimate)].filter(entry => (entry as { v?: unknown } | null)?.v === 9);
}

async function storedTextParts(memory: Memory) {
  const { messages } = await memory.recall({ threadId: THREAD, resourceId: RESOURCE });
  return messages.flatMap(message => (message.content.parts as StoredPart[]).filter(part => part.type === 'text'));
}

describe('trusted token counts across requests', () => {
  it('a fresh Agent reads the counts the previous request stored, without recounting', async () => {
    const longUser = `Here are my notes. ${'The quarterly plan covers hiring and budget. '.repeat(40)}`;
    const longReply = `Summary: ${'Hiring slows in Q3 and the budget holds. '.repeat(40)}`;
    mock.on({ endpoint: 'chat', userMessage: 'Here are my notes' }, { content: longReply });
    mock.on({ endpoint: 'chat', userMessage: 'Anything else?' }, { content: 'No.' });

    const store = new InMemoryStore();
    const first = createAgent(store);
    await first.agent.generate(longUser, { memory: { thread: THREAD, resource: RESOURCE } });

    const stored = await storedTextParts(first.memory);
    expect(stored.map(part => part.text)).toEqual([longUser, longReply]);
    // The input and the final reply are both counted before they're saved, so their counts are stored with them.
    expect(trustedEntries(stored[0]!)).toHaveLength(1);
    expect(trustedEntries(stored[1]!)).toHaveLength(1);

    const counted: string[] = [];
    const original = TokenCounter.prototype.countString;
    vi.spyOn(TokenCounter.prototype, 'countString').mockImplementation(function (this: TokenCounter, text: string) {
      counted.push(text);
      return original.call(this, text);
    });

    const second = createAgent(store);
    await second.agent.generate('Anything else?', { memory: { thread: THREAD, resource: RESOURCE } });

    expect(counted).not.toContain(longUser);
    expect(counted).not.toContain(longReply);
  });

  // A cache map whose top level also has an unrelated `source` field, with a trusted entry nested
  // under the key the reader looks up.
  const mixedShape = (tokens: number) => ({
    source: 'importer',
    'trusted:text': { v: 9, source: 'v9:tokenx', key: 'trusted:text', tokens },
  });

  async function storedCount(memory: Memory, id: string) {
    const { messages } = await memory.recall({ threadId: THREAD, resourceId: RESOURCE });
    return new TokenCounter().countMessage(messages.find(message => message.id === id)!);
  }

  const freshCount = (text: string) =>
    new TokenCounter().countMessage({
      id: 'fresh',
      role: 'user',
      createdAt: new Date(),
      content: { format: 2, parts: [{ type: 'text', text }] },
    });

  it('a count saved directly with memory.saveMessages is stored and read back', async () => {
    const { memory } = createAgent(new InMemoryStore());
    await memory.saveThread({
      thread: { id: THREAD, resourceId: RESOURCE, title: 't', createdAt: new Date(), updatedAt: new Date() },
    });
    const message = {
      id: 'saved-1',
      threadId: THREAD,
      resourceId: RESOURCE,
      role: 'user' as const,
      createdAt: new Date(),
      content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'Saved by the app. '.repeat(30).trim() }] },
    };
    const counted = new TokenCounter().countMessage(message);
    await memory.saveMessages({ messages: [message] });

    const [part] = await storedTextParts(memory);
    expect(trustedEntries(part!)).toHaveLength(1);
    const spy = vi.spyOn(TokenCounter.prototype, 'countString');
    expect(await storedCount(memory, 'saved-1')).toBe(counted);
    expect(spy.mock.calls.map(call => call[0])).toEqual(['user']);
  });

  it('a count in caller input to the Agent is kept, in either shape', async () => {
    mock.on({ endpoint: 'chat', userMessage: 'Caller input' }, { content: 'Ok.' });
    const { agent, memory } = createAgent(new InMemoryStore());
    const text = `Caller input. ${'Some words to count. '.repeat(30)}`.trim();
    for (const [id, tokenEstimate] of [
      ['flat', { v: 9, source: 'v9:tokenx', key: 'trusted:text', tokens: 1 }],
      ['mixed', mixedShape(1)],
    ] as const) {
      await agent.generate(
        [
          {
            id,
            role: 'user',
            createdAt: new Date(),
            content: { format: 2, parts: [{ type: 'text', text, providerMetadata: { mastra: { tokenEstimate } } }] },
          } as any,
        ],
        { memory: { thread: THREAD, resource: RESOURCE } },
      );
      const { messages } = await memory.recall({ threadId: THREAD, resourceId: RESOURCE });
      const part = (messages.find(message => message.id === id)!.content.parts as StoredPart[])[0]!;
      expect(trustedEntries(part).map(entry => (entry as { tokens: number }).tokens)).toEqual([1]);
    }
  });

  it('a client that resends its history with counts gets no recount of that history', async () => {
    mock.on({ endpoint: 'chat', userMessage: 'Next question' }, { content: 'Ok.' });
    const { agent, memory } = createAgent(new InMemoryStore());
    // Counts the way an earlier request stored them, then made wrong for the text: if the Agent counted the
    // history again, they would be replaced.
    const withCount = (id: string, role: 'user' | 'assistant', at: number, text: string) => {
      const message = {
        id,
        role,
        createdAt: new Date(Date.UTC(2026, 10, 1, 0, 0, at)),
        content: { format: 2 as const, parts: [{ type: 'text' as const, text }] },
      };
      new TokenCounter().countMessage(message as any);
      for (const part of message.content.parts as StoredPart[]) {
        const estimate = part.providerMetadata!.mastra!.tokenEstimate as { tokens: number };
        estimate.tokens = 1;
      }
      return message;
    };
    const history = [
      withCount('resent-0', 'user', 0, `First message. ${'Resent history words. '.repeat(30)}`),
      withCount('resent-1', 'assistant', 1, `Second message. ${'Resent history words. '.repeat(30)}`),
    ];

    await agent.generate([...(history as any[]), { id: 'next', role: 'user', content: 'Next question' }], {
      memory: { thread: THREAD, resource: RESOURCE },
    });

    const { messages } = await memory.recall({ threadId: THREAD, resourceId: RESOURCE });
    for (const id of ['resent-0', 'resent-1']) {
      const part = (messages.find(message => message.id === id)!.content.parts as StoredPart[])[0]!;
      expect(trustedEntries(part).map(entry => (entry as { tokens: number }).tokens)).toEqual([1]);
    }
  });

  // Most stored history in a thread OM has buffered is sealed (metadata.mastra.sealed). Sealed messages are
  // normally skipped on save because buffering already stored them, but the counts OM adds to them must still
  // be written, or every later request counts that history again.
  it('counts added to sealed stored history are saved, so the next request does not recount it', async () => {
    mock.on({ endpoint: 'chat', userMessage: 'First follow-up' }, { content: 'Ok.' });
    mock.on({ endpoint: 'chat', userMessage: 'Second follow-up' }, { content: 'Ok.' });
    const store = new InMemoryStore();
    const sealedText = (n: number) => `Sealed history ${n}. ${'Buffered words from an earlier session. '.repeat(30)}`;
    const sealed = [0, 1, 2, 3].map(n => ({
      id: `sealed-${n}`,
      threadId: THREAD,
      resourceId: RESOURCE,
      role: (n % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      createdAt: new Date(Date.UTC(2026, 10, 1, 0, 0, n)),
      content: {
        format: 2 as const,
        parts: [{ type: 'text' as const, text: sealedText(n) }],
        metadata: { mastra: { sealed: true } },
      },
    }));
    // Written straight to storage, as history from before stored counts existed: no counts on any part.
    const memoryStore = (await store.getStore('memory'))!;
    await memoryStore.saveThread({
      thread: { id: THREAD, resourceId: RESOURCE, title: '', createdAt: new Date(), updatedAt: new Date() },
    });
    await memoryStore.saveMessages({ messages: sealed });

    const first = createAgent(store);
    await first.agent.generate('First follow-up', { memory: { thread: THREAD, resource: RESOURCE } });

    const { messages } = await first.memory.recall({ threadId: THREAD, resourceId: RESOURCE });
    for (const n of [0, 1, 2, 3]) {
      const part = (messages.find(message => message.id === `sealed-${n}`)!.content.parts as StoredPart[])[0]!;
      expect(trustedEntries(part)).toHaveLength(1);
    }

    const counted: string[] = [];
    const original = TokenCounter.prototype.countString;
    vi.spyOn(TokenCounter.prototype, 'countString').mockImplementation(function (this: TokenCounter, text: string) {
      counted.push(text);
      return original.call(this, text);
    });
    await createAgent(store).agent.generate('Second follow-up', { memory: { thread: THREAD, resource: RESOURCE } });
    for (const n of [0, 1, 2, 3]) expect(counted).not.toContain(sealedText(n));
  });
});
