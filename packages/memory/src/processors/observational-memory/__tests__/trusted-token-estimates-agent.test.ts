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
  return [estimate, ...Object.values(estimate)].filter(entry => (entry as { v?: unknown } | null)?.v === 8);
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

  it('a count in caller input that does not match its text is ignored', async () => {
    mock.on({ endpoint: 'chat', userMessage: 'Caller input' }, { content: 'Ok.' });
    const { agent, memory } = createAgent(new InMemoryStore());
    const text = `Caller input. ${'Some words to count. '.repeat(30)}`.trim();
    const forged = { 'text:forged': { v: 8, source: 'v8:tokenx', key: 'text:forged', tokens: 1 } };
    await agent.generate(
      [
        {
          id: 'forged',
          role: 'user',
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [{ type: 'text', text, providerMetadata: { mastra: { tokenEstimate: forged } } }],
          },
        } as any,
      ],
      { memory: { thread: THREAD, resource: RESOURCE } },
    );
    const { messages } = await memory.recall({ threadId: THREAD, resourceId: RESOURCE });
    const part = (messages.find(message => message.id === 'forged')!.content.parts as StoredPart[])[0]!;
    const tokens = trustedEntries(part)
      .filter(entry => (entry as { key: string }).key !== 'text:forged')
      .map(entry => (entry as { tokens: number }).tokens);
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.every(count => count > 1)).toBe(true);
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

  it('counts for sealed history are patched onto the stored copy, keeping buffering markers only storage has', async () => {
    mock.on({ endpoint: 'chat', userMessage: 'Marker follow-up' }, { content: 'Ok.' });
    const store = new InMemoryStore();
    const text = `Sealed with a marker. ${'Buffered words from an earlier session. '.repeat(30)}`;
    const marker = { type: 'data-om-buffering-start', data: { cycleId: 'cycle-1', operationType: 'observation' } };
    const memoryStore = (await store.getStore('memory'))!;
    await memoryStore.saveThread({
      thread: { id: THREAD, resourceId: RESOURCE, title: '', createdAt: new Date(), updatedAt: new Date() },
    });
    await memoryStore.saveMessages({
      messages: [
        {
          id: 'sealed-marker',
          threadId: THREAD,
          resourceId: RESOURCE,
          role: 'assistant',
          createdAt: new Date(Date.UTC(2026, 10, 1)),
          content: {
            format: 2,
            parts: [{ type: 'text', text }, marker as any],
            metadata: { mastra: { sealed: true } },
          },
        },
      ],
    });
    // The loaded copy was read before buffering wrote its marker straight to storage, so it lacks the marker.
    const listMessages = memoryStore.listMessages.bind(memoryStore);
    vi.spyOn(memoryStore, 'listMessages').mockImplementation(async args => {
      const result = await listMessages(args);
      return {
        ...result,
        messages: result.messages.map(message => ({
          ...message,
          content: {
            ...message.content,
            parts: message.content.parts.filter(part => !part.type.startsWith('data-om-buffering-')),
          },
        })),
      };
    });

    await createAgent(store).agent.generate('Marker follow-up', { memory: { thread: THREAD, resource: RESOURCE } });

    const {
      messages: [stored],
    } = await memoryStore.listMessagesById({ messageIds: ['sealed-marker'] });
    const parts = stored!.content.parts as StoredPart[];
    expect(parts.map(part => part.type)).toEqual(['text', 'data-om-buffering-start']);
    expect(trustedEntries(parts[0]!)).toHaveLength(1);
  });

  it('a sealed tool result whose model output differs in storage does not get the loaded copy count', async () => {
    mock.on({ endpoint: 'chat', userMessage: 'Model output follow-up' }, { content: 'Ok.' });
    const store = new InMemoryStore();
    const toolPart = (modelOutput: string) => ({
      type: 'tool-invocation' as const,
      toolInvocation: {
        state: 'result' as const,
        toolCallId: 'call-1',
        toolName: 'lookup',
        args: { q: 'x' },
        result: { ok: true },
      },
      providerMetadata: { mastra: { modelOutput } },
    });
    const storedOutput = 'Large stored model output. '.repeat(400);
    const memoryStore = (await store.getStore('memory'))!;
    await memoryStore.saveThread({
      thread: { id: THREAD, resourceId: RESOURCE, title: '', createdAt: new Date(), updatedAt: new Date() },
    });
    await memoryStore.saveMessages({
      messages: [
        {
          id: 'sealed-tool',
          threadId: THREAD,
          resourceId: RESOURCE,
          role: 'assistant',
          createdAt: new Date(Date.UTC(2026, 10, 1)),
          content: { format: 2, parts: [toolPart(storedOutput)], metadata: { mastra: { sealed: true } } },
        },
      ],
    });
    // The loaded copy has the same raw result but a short model output.
    const listMessages = memoryStore.listMessages.bind(memoryStore);
    vi.spyOn(memoryStore, 'listMessages').mockImplementation(async args => {
      const result = await listMessages(args);
      return {
        ...result,
        messages: result.messages.map(message =>
          message.id === 'sealed-tool'
            ? { ...message, content: { ...message.content, parts: [toolPart('short')] } }
            : message,
        ),
      };
    });

    await createAgent(store).agent.generate('Model output follow-up', {
      memory: { thread: THREAD, resource: RESOURCE },
    });

    const {
      messages: [stored],
    } = await memoryStore.listMessagesById({ messageIds: ['sealed-tool'] });
    const [part] = stored!.content.parts as StoredPart[];
    expect(part!.providerMetadata?.mastra?.modelOutput).toBe(storedOutput);
    expect(trustedEntries(part!)).toEqual([]);
  });

  it('a failed token-count write does not lose the turn messages', async () => {
    mock.on({ endpoint: 'chat', userMessage: 'Failing follow-up' }, { content: 'Saved anyway.' });
    const store = new InMemoryStore();
    const memoryStore = (await store.getStore('memory'))!;
    await memoryStore.saveThread({
      thread: { id: THREAD, resourceId: RESOURCE, title: '', createdAt: new Date(), updatedAt: new Date() },
    });
    await memoryStore.saveMessages({
      messages: [
        {
          id: 'sealed-uncounted',
          threadId: THREAD,
          resourceId: RESOURCE,
          role: 'user',
          createdAt: new Date(Date.UTC(2026, 10, 1)),
          content: {
            format: 2,
            parts: [{ type: 'text', text: `Sealed history. ${'Buffered words. '.repeat(30)}` }],
            metadata: { mastra: { sealed: true } },
          },
        },
      ],
    });
    const updateMessages = vi.spyOn(memoryStore, 'updateMessages').mockRejectedValue(new Error('adapter refused'));

    const first = createAgent(store);
    await first.agent.generate('Failing follow-up', { memory: { thread: THREAD, resource: RESOURCE } });

    expect(updateMessages).toHaveBeenCalled();
    const { messages } = await first.memory.recall({ threadId: THREAD, resourceId: RESOURCE });
    const texts = messages.flatMap(message =>
      (message.content.parts as StoredPart[]).flatMap(part => (part.type === 'text' ? [part.text] : [])),
    );
    expect(texts).toContain('Failing follow-up');
    expect(texts).toContain('Saved anyway.');
  });
});
