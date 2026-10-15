import type { MastraDBMessage } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { filterObservedMessages } from '../message-utils';
import { ObservationalMemory } from '../observational-memory';

// Coverage must be decided by what was observed, not by millisecond timestamps: content
// created in the same millisecond as the cursor is unseen until it reaches the Observer, and
// content the Observer already saw must never be replayed.

const threadId = 'same-ms';
const resourceId = 'same-ms-resource';
const T0 = Date.parse('2026-10-14T00:00:00.000Z');

function msg(id: string, role: 'user' | 'assistant', at: number, text = id): MastraDBMessage {
  return {
    id,
    role,
    content: { format: 2, parts: [{ type: 'text', text: `${text} ${'data '.repeat(300)}` }] },
    type: 'text',
    createdAt: new Date(at),
    threadId,
    resourceId,
  } as MastraDBMessage;
}

async function setup() {
  const storage = new InMemoryMemory({ db: new InMemoryDB() });
  await storage.saveThread({
    thread: { id: threadId, resourceId, title: 'thread', createdAt: new Date(T0), updatedAt: new Date(T0) },
  });
  const om = new ObservationalMemory({
    storage,
    scope: 'thread',
    observation: { model: 'openai/gpt-4o-mini', messageTokens: 10_000, bufferTokens: 2_000, blockAfter: 1.2 },
    reflection: { model: 'openai/gpt-4o-mini', observationTokens: 50_000 },
  });
  const seen: string[][] = [];
  vi.spyOn(om.observer, 'call').mockImplementation(async (...args: unknown[]) => {
    const messages = args.find(a => Array.isArray(a)) as MastraDBMessage[] | undefined;
    seen.push((messages ?? []).map(m => m.id));
    return {
      observations: `- observation ${seen.length}`,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    } as Awaited<ReturnType<typeof om.observer.call>>;
  });
  vi.spyOn(om.reflector, 'call').mockResolvedValue({
    observations: '- reflected',
  } as Awaited<ReturnType<typeof om.reflector.call>>);
  const observedOnce = (id: string) => seen.flat().filter(x => x === id).length;
  const prune = (record: Parameters<typeof filterObservedMessages>[0]['record'], messages: MastraDBMessage[]) => {
    const list = new MessageList({ threadId, resourceId });
    list.add(messages, 'memory');
    filterObservedMessages({ messageList: list, record });
    return list.get.all.db().map(m => m.id);
  };
  return { storage, om, seen, observedOnce, prune };
}

describe('same-millisecond coverage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('unseen same-ms content survives activation and reaches the Observer exactly once', async () => {
    const { storage, om, observedOnce, prune } = await setup();
    const observed = msg('observed', 'assistant', T0);
    await storage.saveMessages({ messages: [observed] });
    await om.buffer({ threadId, resourceId, messages: [observed], skipMinimumTokenCheck: true });

    const sibling = msg('sibling', 'user', T0);
    await storage.saveMessages({ messages: [sibling] });
    const activation = await om.activate({ threadId, resourceId });
    expect(activation.activated).toBe(true);

    expect(prune(activation.record, [observed, sibling])).toEqual(['sibling']);

    await om.buffer({ threadId, resourceId, skipMinimumTokenCheck: true });
    await om.buffer({ threadId, resourceId, skipMinimumTokenCheck: true });
    expect(observedOnce('sibling')).toBe(1);
    expect(observedOnce('observed')).toBe(1);
  });

  it('does not replay activated content to the Observer', async () => {
    const { storage, om, observedOnce } = await setup();
    const a = msg('a', 'user', T0);
    const b = msg('b', 'assistant', T0);
    await storage.saveMessages({ messages: [a, b] });
    await om.buffer({ threadId, resourceId, messages: [a, b], skipMinimumTokenCheck: true });
    await om.activate({ threadId, resourceId });

    await om.buffer({ threadId, resourceId, skipMinimumTokenCheck: true });
    expect(observedOnce('a')).toBe(1);
    expect(observedOnce('b')).toBe(1);
  });

  it('durably commits a chunk whose newest content shares the cursor millisecond', async () => {
    const { storage, om } = await setup();
    const first = msg('first', 'assistant', T0);
    await storage.saveMessages({ messages: [first] });
    await om.observe({ threadId, resourceId, force: true });

    const sameMs = msg('same-ms', 'user', T0);
    await storage.saveMessages({ messages: [sameMs] });
    await om.buffer({ threadId, resourceId, skipMinimumTokenCheck: true });

    const record = await om.getRecord(threadId, resourceId);
    const chunkIds = (record?.bufferedObservationChunks ?? []).flatMap(c => c.messageIds);
    expect(chunkIds).toContain('same-ms');
  });

  it('sends unseen same-ms content to the Observer after a sync observation', async () => {
    const { storage, om, observedOnce } = await setup();
    const first = msg('first', 'assistant', T0);
    await storage.saveMessages({ messages: [first] });
    await om.observe({ threadId, resourceId, force: true });

    const sameMs = msg('same-ms', 'user', T0);
    await storage.saveMessages({ messages: [sameMs] });
    await om.observe({ threadId, resourceId, force: true });
    await om.observe({ threadId, resourceId, force: true });

    expect(observedOnce('same-ms')).toBe(1);
    expect(observedOnce('first')).toBe(1);
  });

  it('keeps unseen same-ms content observable across reflection', async () => {
    const { storage, om, observedOnce } = await setup();
    const first = msg('first', 'assistant', T0);
    await storage.saveMessages({ messages: [first] });
    await om.observe({ threadId, resourceId, force: true });
    const reflected = await om.reflect(threadId, resourceId);
    expect(reflected.reflected).toBe(true);

    const sameMs = msg('same-ms', 'user', T0);
    await storage.saveMessages({ messages: [sameMs] });
    await om.observe({ threadId, resourceId, force: true });

    expect(observedOnce('same-ms')).toBe(1);
    expect(observedOnce('first')).toBe(1);
  });

  it('observes a part appended to an already-observed message once, without replaying the old part', async () => {
    const { storage, om, seen } = await setup();
    const assistant = msg('assistant-1', 'assistant', T0, 'old-part');
    await storage.saveMessages({ messages: [assistant] });
    await om.observe({ threadId, resourceId, force: true });

    const appended = {
      ...assistant,
      content: {
        ...assistant.content,
        parts: [...assistant.content.parts, { type: 'text' as const, text: `new-part ${'data '.repeat(300)}` }],
      },
    } as MastraDBMessage;
    await storage.saveMessages({ messages: [appended] });
    const sent: string[] = [];
    vi.mocked(om.observer.call).mockImplementation(async (...args: unknown[]) => {
      const messages = (args.find(a => Array.isArray(a)) as MastraDBMessage[] | undefined) ?? [];
      seen.push(messages.map(m => m.id));
      for (const m of messages) for (const p of m.content.parts) if (p.type === 'text') sent.push(p.text.split(' ')[0]!);
      return { observations: '- appended', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as Awaited<
        ReturnType<typeof om.observer.call>
      >;
    });
    await om.observe({ threadId, resourceId, force: true });

    expect(sent).toEqual(['new-part']);
  });
});
