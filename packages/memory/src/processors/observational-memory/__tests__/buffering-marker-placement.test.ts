/**
 * A buffering cycle's end marker is written from the background, straight to storage, long after
 * the cycle started. By then the agent is usually streaming a newer assistant message, which it
 * saves again (whole, from its own copy) as it streams. Writing the end marker onto that message
 * races the agent: a later save from the agent drops the marker, and an end-marker write that
 * lands after the agent's last save puts back an older copy of the message, dropping content.
 * The end marker belongs on the message that carries the cycle's start marker.
 */
import { randomUUID } from 'node:crypto';

import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

function msg(
  threadId: string,
  resourceId: string,
  role: 'user' | 'assistant',
  createdAt: Date,
  texts: string[],
): MastraDBMessage {
  return {
    id: `${role}-${randomUUID()}`,
    role,
    type: 'text',
    threadId,
    resourceId,
    createdAt,
    content: { format: 2, parts: texts.map(text => ({ type: 'text' as const, text })) },
  };
}

async function setup() {
  const storage = new InMemoryMemory({ db: new InMemoryDB() });
  const threadId = randomUUID();
  const resourceId = randomUUID();
  const t0 = new Date(Date.now() - 60_000);
  await storage.saveThread({ thread: { id: threadId, resourceId, title: 't', createdAt: t0, updatedAt: t0 } });
  const om = new ObservationalMemory({
    storage,
    scope: 'thread',
    observation: { model: 'openai/gpt-4o-mini', messageTokens: 100_000, bufferTokens: 200 },
    reflection: { model: 'openai/gpt-4o-mini', observationTokens: 200_000 },
  });
  const record = await om.getOrCreateRecord(threadId, resourceId);

  const buffered = [
    msg(threadId, resourceId, 'user', new Date(t0.getTime() + 1000), [`question ${'words '.repeat(400)}`]),
    msg(threadId, resourceId, 'assistant', new Date(t0.getTime() + 2000), [`answer ${'words '.repeat(400)}`]),
  ];
  await storage.saveMessages({ messages: buffered });

  const entered = deferred();
  const gate = deferred();
  vi.spyOn(om.observer, 'call').mockImplementation(async () => {
    entered.resolve();
    await gate.promise;
    return { observations: '* BUFFERED_FACT' } as any;
  });

  const cycle = om.buffer({ threadId, resourceId, record, messages: buffered });
  await entered.promise;

  // The agent keeps going while the Observer runs: a newer assistant message starts streaming.
  const streaming = msg(threadId, resourceId, 'assistant', new Date(), ['partial']);
  await storage.saveMessages({ messages: [structuredClone(streaming)] });

  const stored = async () => (await storage.listMessages({ threadId, perPage: false })).messages;
  const markers = async (type: string) =>
    (await stored()).flatMap(m => (m.content.parts as any[]).filter(p => p?.type === type).map(() => m.id));

  return { storage, om, threadId, buffered, streaming, gate, cycle, stored, markers };
}

describe('buffering end marker placement', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('survives the agent re-saving the message it is still streaming', async () => {
    const { storage, buffered, streaming, gate, cycle, markers } = await setup();
    expect(await markers('data-om-buffering-start')).toEqual([buffered[1]!.id]);

    gate.resolve();
    await expect(cycle).resolves.toMatchObject({ buffered: true });

    // The agent's next save of its streaming message is its own copy, which has no end marker.
    streaming.content.parts.push({ type: 'text', text: 'more' });
    await storage.saveMessages({ messages: [structuredClone(streaming)] });

    expect(await markers('data-om-buffering-end')).toEqual([buffered[1]!.id]);
  });

  it('finds the start message even when many messages were saved during the cycle', async () => {
    const { storage, threadId, buffered, gate, cycle, markers } = await setup();
    const resourceId = buffered[0]!.resourceId!;
    for (let i = 0; i < 30; i++) {
      const role = i % 2 ? 'assistant' : 'user';
      await storage.saveMessages({
        messages: [msg(threadId, resourceId, role, new Date(Date.now() + i + 1), [`later ${i}`])],
      });
    }

    gate.resolve();
    await expect(cycle).resolves.toMatchObject({ buffered: true });

    expect(await markers('data-om-buffering-end')).toEqual([buffered[1]!.id]);
  });

  it("never writes back an older copy of the agent's streaming message", async () => {
    const { storage, streaming, gate, cycle, stored } = await setup();

    // The agent's last save of its streaming message lands while the end marker is being written.
    const listMessages = storage.listMessages.bind(storage);
    vi.spyOn(storage, 'listMessages').mockImplementation(async (args: any) => {
      const result = structuredClone(await listMessages(args));
      streaming.content.parts.push({ type: 'text', text: 'FINAL_ANSWER' });
      await storage.saveMessages({ messages: [structuredClone(streaming)] });
      return result;
    });

    gate.resolve();
    await expect(cycle).resolves.toMatchObject({ buffered: true });
    vi.mocked(storage.listMessages).mockRestore();

    const saved = (await stored()).find(m => m.id === streaming.id)!;
    expect(saved.content.parts).toContainEqual({ type: 'text', text: 'FINAL_ANSWER' });
  });
});
