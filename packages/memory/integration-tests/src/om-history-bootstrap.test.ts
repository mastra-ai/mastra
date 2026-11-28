import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { expect, it, vi } from 'vitest';

it.each([false, true])('preserves activated LibSQL coverage and later parts (partial boundary: %s)', async partial => {
  const directory = await mkdtemp(join(tmpdir(), 'om-clone-activated-'));
  const storage = new LibSQLStore({ id: 'clone-activated', url: `file:${join(directory, 'history.db')}` });
  const prompts: string[] = [];
  const model = new MockLanguageModelV2({
    doStream: async options => {
      prompts.push(JSON.stringify(options.prompt));
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'obs' },
          { type: 'text-delta', id: 'obs', delta: '<observations>- Activated fact preserved.</observations>' },
          { type: 'text-end', id: 'obs' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      };
    },
  });
  try {
    const memory = new Memory({
      storage,
      options: {
        semanticRecall: false,
        generateTitle: false,
        workingMemory: { enabled: false },
        observationalMemory: {
          scope: 'thread',
          observation: { model, messageTokens: 100_000, bufferTokens: 0.2 },
          reflection: { model, observationTokens: 100_000 },
        },
      },
    });
    const threadId = 'clone-activated';
    const resourceId = 'clone-resource';
    await memory.createThread({ threadId, resourceId, title: 'Activated history' });
    const rows = ['Activated source fact.', 'Unread source fact.'].map((text, index) => ({
      id: `clone-fact-${index}`,
      threadId,
      resourceId,
      role: 'user' as const,
      createdAt: new Date(Date.UTC(2026, 0, 1) + index * 1000),
      content: { format: 2 as const, parts: [{ type: 'text' as const, text }] },
    }));
    await memory.saveMessages({ messages: rows });
    const om = (await memory.omEngine)!;
    expect(
      (await om.buffer({ threadId, resourceId, messages: [rows[0]!], skipMinimumTokenCheck: true })).buffered,
    ).toBe(true);
    const activated = await om.activate({ threadId, resourceId, pendingTokens: 100_000 });
    expect(activated.activatedMessageIds).toEqual([rows[0]!.id]);
    expect(activated.record.bufferedObservationChunks ?? []).toHaveLength(0);
    if (partial) {
      await memory.saveMessages({
        messages: [
          {
            ...rows[0]!,
            content: {
              format: 2,
              parts: [
                ...rows[0]!.content.parts,
                {
                  type: 'data-om-observation-start',
                  data: { cycleId: 'covered-prefix', operationType: 'observation' },
                },
                { type: 'data-om-observation-end', data: { cycleId: 'covered-prefix', operationType: 'observation' } },
                { type: 'text', text: 'New content appended to the activated message.' },
              ],
            },
          },
        ],
      });
    }
    prompts.length = 0;
    const { thread, messageIdMap } = await memory.cloneThread({ sourceThreadId: threadId });
    const store = (await storage.getStore('memory'))!;
    const clonedMessage = (await store.listMessagesById({ messageIds: [messageIdMap![rows[0]!.id]!] })).messages[0]!;
    await memory.saveMessages({
      messages: [
        {
          ...clonedMessage,
          content: {
            ...clonedMessage.content,
            parts: [...clonedMessage.content.parts, { type: 'text', text: 'Appended after cloning.' }],
          },
        },
      ],
    });
    const result = await om.observe({ threadId: thread.id, resourceId, force: true });
    expect(result.observed).toBe(true);
    expect(prompts.join('\n')).toContain('Unread source fact.');
    expect(prompts.join('\n')).not.toContain('Activated source fact.');
    expect(prompts.join('\n')).toContain('Appended after cloning.');
    if (partial) expect(prompts.join('\n')).toContain('New content appended to the activated message.');
  } finally {
    await storage.close();
    await rm(directory, { recursive: true, force: true });
  }
});

it('bootstraps and observes more than one reverse page of LibSQL history', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'om-bootstrap-pages-'));
  const storage = new LibSQLStore({ id: 'bootstrap-pages', url: `file:${join(directory, 'history.db')}` });
  const prompts: string[] = [];
  const model = new MockLanguageModelV2({
    doStream: async options => {
      prompts.push(JSON.stringify(options.prompt));
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'obs' },
          {
            type: 'text-delta',
            id: 'obs',
            delta: '<observations>Date: Jan 1, 2026\n- Bootstrap facts preserved.</observations>',
          },
          { type: 'text-end', id: 'obs' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      };
    },
  });
  try {
    const memory = new Memory({
      storage,
      options: {
        semanticRecall: false,
        generateTitle: false,
        workingMemory: { enabled: false },
        observationalMemory: {
          scope: 'thread',
          observation: { model, messageTokens: 100_000, bufferTokens: false },
          reflection: { model, observationTokens: 100_000 },
        },
      },
    });
    const threadId = 'bootstrap-thread';
    const resourceId = 'bootstrap-resource';
    await memory.createThread({ threadId, resourceId, title: 'Bootstrap' });
    const rows = Array.from({ length: 85 }, (_, index) => ({
      id: `fact-${String(index).padStart(3, '0')}`,
      threadId,
      resourceId,
      role: 'user' as const,
      createdAt: new Date(Date.UTC(2026, 0, 1) + index),
      content: {
        format: 2 as const,
        parts: [{ type: 'text' as const, text: `Bootstrap fact ${String(index).padStart(3, '0')}.` }],
      },
    }));
    await memory.saveMessages({ messages: rows });
    const store = (await storage.getStore('memory'))!;
    const reads = vi.spyOn(store, 'listObservationHistory');
    const result = await (await memory.omEngine)!.observe({ threadId, resourceId, force: true });
    expect(result.observed).toBe(true);
    const reverseReads = reads.mock.calls
      .map(([input]) => input)
      .filter(input => input.order === 'desc' && input.limit === 40);
    expect(reverseReads.length).toBeGreaterThanOrEqual(3);
    expect(reverseReads[0]!.before).toBeUndefined();
    expect(reverseReads[1]!.before?.id).toBe(rows[45]!.id);
    expect(reverseReads[2]!.before?.id).toBe(rows[5]!.id);
    expect(prompts).toHaveLength(1);
    for (const row of rows) expect(prompts[0]).toContain(row.content.parts[0]!.text);
    const positions = rows.map(row => prompts[0]!.indexOf(row.content.parts[0]!.text));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(new Set(result.record.observedMessageIds)).toEqual(new Set(rows.map(row => row.id)));
  } finally {
    await storage.close();
    await rm(directory, { recursive: true, force: true });
  }
});
