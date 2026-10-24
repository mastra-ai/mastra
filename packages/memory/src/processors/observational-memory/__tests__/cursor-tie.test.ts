import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { Memory } from '../../../index';
import { filterObservedMessages } from '../message-utils';

const threadId = 't-tie';
const resourceId = 'r-tie';
const earlier = new Date('2026-01-01T00:00:00.000Z');
const tie = new Date('2026-01-01T00:00:01.000Z');

const fact = `## January 1, 2026
- 🔴 User mentioned the tied fact`;

// Resource scope asks for one <thread id> block per thread, using the obscured id it put in the prompt.
function observerReply(prompt: string) {
  const threadIdInPrompt = [...prompt.matchAll(/<thread id=\\"([^\\"]+)\\">/g)]
    .map(m => m[1])
    .findLast(id => id !== '...');
  const body = threadIdInPrompt ? `<thread id="${threadIdInPrompt}">\n${fact}\n</thread>` : fact;
  return `<observations>\n${body}\n</observations>`;
}

// Mock observer model: aimock is not wired into @mastra/memory, and these tests only need the prompt it received.
function observerModel() {
  const prompts: string[] = [];
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const serialized = JSON.stringify(prompt);
      prompts.push(serialized);
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'text-start' as const, id: 't1' },
          { type: 'text-delta' as const, id: 't1', delta: observerReply(serialized) },
          { type: 'text-end' as const, id: 't1' },
          {
            type: 'finish' as const,
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
  return { model, prompts };
}

function msg(id: string, createdAt: Date, threadIdOverride = threadId): MastraDBMessage {
  return {
    id,
    role: 'user',
    threadId: threadIdOverride,
    resourceId,
    createdAt,
    content: { format: 2, parts: [{ type: 'text', text: `text of ${id}` }] },
  } as MastraDBMessage;
}

/**
 * Stores a record whose cursor sits on `tie`, as left by an observation that covered `before` and `observed`
 * but not `unobserved` (all three of the latter two share the cursor millisecond).
 */
async function setup(scope: 'thread' | 'resource', observedMessageIds: string[] | undefined) {
  const store = new InMemoryStore();
  const { model, prompts } = observerModel();
  const memory = new Memory({
    storage: store,
    options: {
      observationalMemory: {
        enabled: true,
        scope,
        observation: { model: model as any, messageTokens: 100_000, bufferTokens: false },
        reflection: { model: model as any, observationTokens: 100_000 },
      },
    },
  });
  await memory.createThread({
    threadId,
    resourceId,
    metadata: { mastra: { om: { lastObservedAt: tie.toISOString() } } },
  });
  await memory.saveMessages({ messages: [msg('before', earlier), msg('observed', tie), msg('unobserved', tie)] });

  const om = (await memory.omEngine)!;
  const record = await om.getOrCreateRecord(threadId, resourceId);
  const memoryStore = (await store.getStore('memory'))!;
  await memoryStore.updateActiveObservations({
    id: record.id,
    observations: '- base',
    tokenCount: 2,
    lastObservedAt: tie,
    ...(observedMessageIds ? { observedMessageIds } : {}),
  });
  const readRecord = async () =>
    (await memoryStore.getObservationalMemory(scope === 'resource' ? null : threadId, resourceId))!;
  return { memory, om, prompts, readRecord };
}

describe('observation cursor millisecond ties (#27261)', () => {
  describe.each(['thread', 'resource'] as const)('%s scope', scope => {
    it('keeps an unobserved message that shares the cursor millisecond in context', async () => {
      const { memory } = await setup(scope, ['before', 'observed']);

      const context = await memory.getContext({ threadId, resourceId });

      expect(context.messages.map(m => m.id)).toEqual(['unobserved']);
    });

    it('records without observed ids keep the exclusive cursor, as before', async () => {
      const { memory } = await setup(scope, undefined);

      const context = await memory.getContext({ threadId, resourceId });

      expect(context.messages.map(m => m.id)).toEqual([]);
    });

    it('observes the tied unobserved message once and never replays observed ones', async () => {
      const { om, prompts, readRecord } = await setup(scope, ['before', 'observed']);

      await om.observe({ threadId, resourceId, force: true });

      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toContain('text of unobserved');
      expect(prompts[0]).not.toContain('text of observed');
      expect(prompts[0]).not.toContain('text of before');
      const record = await readRecord();
      expect(record.observedMessageIds).toEqual(expect.arrayContaining(['before', 'observed', 'unobserved']));
      expect(record.activeObservations).toContain('User mentioned the tied fact');
    });
  });

  it('resource scope: observes a tied unobserved message on another thread of the resource', async () => {
    const { memory, om, prompts, readRecord } = await setup('resource', ['before', 'observed', 'sibling-observed']);
    await memory.createThread({
      threadId: 't-sibling',
      resourceId,
      metadata: { mastra: { om: { lastObservedAt: tie.toISOString() } } },
    });
    await memory.saveMessages({
      messages: [msg('sibling-observed', tie, 't-sibling'), msg('sibling-unobserved', tie, 't-sibling')],
    });

    // As in an agent turn: the current thread passes its live messages, so other threads load from their own cursors.
    await om.observe({ threadId, resourceId, force: true, messages: [msg('unobserved', tie)] });

    expect(prompts[0]).toContain('text of sibling-unobserved');
    expect(prompts[0]).not.toContain('text of sibling-observed');
    expect((await readRecord()).observedMessageIds).toContain('sibling-unobserved');
  });

  it('in-turn filter keeps a tied unobserved message and drops the tied observed one', () => {
    const live = (ids: string[]) => {
      const list = new MessageList({ threadId, resourceId });
      for (const id of ids) list.add(msg(id, tie), 'memory');
      return list;
    };
    const remaining = (list: MessageList) => list.get.all.db().map(m => m.id);

    const tracked = live(['observed', 'unobserved']);
    filterObservedMessages({
      messageList: tracked,
      record: { lastObservedAt: tie, observedMessageIds: ['observed'] } as any,
    });
    expect(remaining(tracked)).toEqual(['unobserved']);

    // Without observed ids the cursor millisecond stays exclusive, as before the fix.
    const untracked = live(['observed', 'unobserved']);
    filterObservedMessages({ messageList: untracked, record: { lastObservedAt: tie } as any });
    expect(remaining(untracked)).toEqual([]);
  });
});
