import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const RESOURCE = 'om-count-writeback-resource';
const DRIFT = 1_000;

function stubModel(text: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => {
      throw new Error('stream only');
    },
    doStream: async () =>
      ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'r', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: text },
          { type: 'text-end', id: 't' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ] as any),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }) as any,
  });
}

/** A fresh store, Memory and Agent on the same database file, as a new process would open. */
function open(dbPath: string) {
  const storage = new LibSQLStore({ id: randomUUID(), url: `file:${dbPath}` });
  const memory = new Memory({
    storage,
    options: {
      lastMessages: false,
      observationalMemory: {
        scope: 'thread',
        observation: { model: stubModel('unused'), messageTokens: 5_000_000, bufferTokens: false },
        reflection: { model: stubModel('unused'), observationTokens: 5_000_000 },
      },
    },
  });
  const agent = new Agent({
    id: 'writeback',
    name: 'writeback',
    instructions: 'Be brief.',
    model: stubModel('OK.'),
    memory,
  });
  return { storage, memory, agent };
}

function trustedEntries(part: any): { key: string; tokens: number }[] {
  const estimate = part?.providerMetadata?.mastra?.tokenEstimate;
  if (!estimate) return [];
  const entries = 'source' in estimate ? [estimate] : Object.values(estimate);
  return (entries as any[]).filter(entry => entry?.v === 9);
}

describe('Observational Memory token counts for stored history', () => {
  let dbDir: string;

  beforeEach(async () => {
    dbDir = await mkdtemp(join(tmpdir(), 'om-count-writeback-'));
  });

  afterEach(async () => {
    await rm(dbDir, { recursive: true, force: true });
  });

  it('writes counts back for history saved without them, so the next request reads them instead of counting', async () => {
    const dbPath = join(dbDir, 'test.db');
    const threadId = randomUUID();
    const history: MastraDBMessage[] = Array.from({ length: 6 }, (_, i) => ({
      id: `${threadId}-h${i}`,
      threadId,
      resourceId: RESOURCE,
      role: i % 2 === 0 ? 'user' : 'assistant',
      createdAt: new Date(Date.UTC(2026, 10, 1, 0, 0, i)),
      content: {
        format: 2,
        parts: [{ type: 'text', text: `History message ${i}. ${'Notes on the plan. '.repeat(30).trim()}` }],
      },
    }));
    const historyIds = new Set(history.map(message => message.id));

    // History written without counts: before upgrading, or by a writer other than an Agent.
    const first = open(dbPath);
    await first.memory.saveThread({
      thread: { id: threadId, resourceId: RESOURCE, title: 't', createdAt: new Date(), updatedAt: new Date() },
    });
    await first.memory.saveMessages({ messages: history });
    const before = await first.memory.recall({ threadId, resourceId: RESOURCE, perPage: false });
    expect(before.messages.flatMap(m => m.content.parts.flatMap(trustedEntries))).toEqual([]);

    // Turn 1 counts the history and writes the counts back.
    const turn1 = await first.agent.stream('First question.', { memory: { thread: threadId, resource: RESOURCE } });
    await turn1.consumeStream();
    expect(await turn1.text).toBe('OK.');
    // The write-back runs after the step, off the request's path.
    const readHistory = async () =>
      (await first.memory.recall({ threadId, resourceId: RESOURCE, perPage: false })).messages.filter(message =>
        historyIds.has(message.id),
      );
    await vi.waitFor(async () => {
      const rows = await readHistory();
      expect(rows.every(row => trustedEntries(row.content.parts[0]).length === 1)).toBe(true);
    });
    const stored = await readHistory();
    expect(stored).toHaveLength(history.length);
    for (const message of stored) {
      expect(trustedEntries(message.content.parts[0])).toHaveLength(1);
      // The text itself is untouched.
      expect(message.content.parts[0]).toMatchObject({
        type: 'text',
        text: history.find(h => h.id === message.id)!.content.parts[0]!.text,
      });
    }

    // Make every stored history count wrong by DRIFT. A request that reads the stored counts carries the drift into
    // OM's pending total; one that counts the text again does not.
    const memoryStore = (await first.storage.getStore('memory'))!;
    const trueTotal = stored.reduce((sum, m) => sum + trustedEntries(m.content.parts[0])[0]!.tokens, 0);
    await memoryStore.updateMessages({
      messages: stored.map(message => {
        const part = message.content.parts[0] as any;
        const estimate = part.providerMetadata.mastra.tokenEstimate;
        const entry = 'source' in estimate ? estimate : Object.values(estimate)[0];
        return {
          id: message.id,
          content: {
            ...message.content,
            parts: [
              {
                ...part,
                providerMetadata: {
                  ...part.providerMetadata,
                  mastra: {
                    ...part.providerMetadata.mastra,
                    tokenEstimate: { ...entry, tokens: entry.tokens + DRIFT },
                  },
                },
              },
            ],
          },
        };
      }),
    });

    // Turn 2 on a fresh store, Memory and Agent.
    const second = open(dbPath);
    const turn2 = await second.agent.stream('Second question.', { memory: { thread: threadId, resource: RESOURCE } });
    await turn2.consumeStream();
    expect(await turn2.text).toBe('OK.');
    const record = await (await second.memory.omEngine)!.getRecord(threadId, RESOURCE);
    const pending = record?.pendingMessageTokens ?? 0;
    expect(pending).toBeGreaterThan(trueTotal + history.length * DRIFT);
  });
  it("saves the Agent's final reply with its token counts", async () => {
    const { memory, agent } = open(join(dbDir, 'reply.db'));
    const threadId = randomUUID();
    await memory.saveThread({
      thread: { id: threadId, resourceId: RESOURCE, title: 't', createdAt: new Date(), updatedAt: new Date() },
    });
    const turn = await agent.stream('Hello there.', { memory: { thread: threadId, resource: RESOURCE } });
    await turn.consumeStream();
    expect(await turn.text).toBe('OK.');

    const stored = (await memory.recall({ threadId, resourceId: RESOURCE, perPage: false })).messages;
    const reply = stored.find(message => message.role === 'assistant');
    const textPart = reply?.content.parts.find(part => part.type === 'text');
    expect(textPart).toMatchObject({ type: 'text', text: 'OK.' });
    expect(trustedEntries(textPart)).toHaveLength(1);
  });
  it('does not copy a count onto a tool result that was edited after OM counted it', async () => {
    const { memory } = open(join(dbDir, 'tool-edit.db'));
    const threadId = randomUUID();
    await memory.saveThread({
      thread: { id: threadId, resourceId: RESOURCE, title: 't', createdAt: new Date(), updatedAt: new Date() },
    });
    const toolPart = (result: string) => ({
      type: 'tool-invocation' as const,
      toolInvocation: { state: 'result' as const, toolCallId: 'call-1', toolName: 'lookup', args: { q: 'x' }, result },
    });
    const id = `${threadId}-tool`;
    await memory.saveMessages({
      messages: [
        {
          id,
          threadId,
          resourceId: RESOURCE,
          role: 'assistant',
          createdAt: new Date(Date.UTC(2026, 10, 1)),
          content: { format: 2, parts: [toolPart('original result')] },
        },
      ],
    });

    // OM loads and counts the message.
    const engine = (await memory.omEngine)!;
    const [live] = (await memory.recall({ threadId, resourceId: RESOURCE, perPage: false })).messages;
    engine.getTokenCounter().countMessages([live!]);
    expect(trustedEntries(live!.content.parts[0]).length).toBeGreaterThan(0);

    // The result is edited in storage before the write-back runs. Same message, same tool call ID.
    await memory.updateMessages({
      messages: [{ id, content: { format: 2, parts: [toolPart('a much longer edited result '.repeat(20))] } } as any],
    });

    await engine.persistTokenEstimates([live!]);

    const [stored] = (await memory.recall({ threadId, resourceId: RESOURCE, perPage: false })).messages;
    expect((stored!.content.parts[0] as any).toolInvocation.result).toContain('edited result');
    expect(trustedEntries(stored!.content.parts[0])).toEqual([]);
  });
});
