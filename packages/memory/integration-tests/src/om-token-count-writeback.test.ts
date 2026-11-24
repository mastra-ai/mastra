import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { TokenCounter } from '@mastra/memory/processors';
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
function open(dbPath: string, scope: 'thread' | 'resource' = 'thread') {
  const storage = new LibSQLStore({ id: randomUUID(), url: `file:${dbPath}` });
  const memory = new Memory({
    storage,
    options: {
      lastMessages: false,
      observationalMemory: {
        scope,
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
  return (entries as any[]).filter(entry => entry?.v === 8);
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
  const report = 'Quarterly "figures"\nand notes. '.repeat(1_000);
  class Report {
    toJSON() {
      return { report };
    }
  }
  const serializers: [string, () => unknown][] = [
    ['returns an object', () => ({ toJSON: () => ({ report }) })],
    ['is a class method', () => new Report()],
    ['returns a string', () => ({ toJSON: () => report })],
    // JSON.stringify calls toJSON() once: the returned object's own toJSON() is not called.
    ['returns an object with its own toJSON()', () => ({ toJSON: () => ({ report, toJSON: () => 'small' }) })],
    ['is nested in the result', () => ({ summary: 'Q3', when: new Date(0), body: { toJSON: () => report } })],
  ];
  // Boxed primitives, typed arrays and Maps hold no toJSON() but still serialize differently from their own entries.
  const nonPlainValues: [string, () => unknown][] = [
    ['a boxed string', () => new String(report)],
    ['a nested boxed string', () => ({ body: new String(report) })],
    ['a nested boxed number and boolean', () => ({ body: report, pages: new Number(12), draft: new Boolean(false) })],
    [
      'a nested Map and typed array',
      () => ({ body: report, index: new Map([['a', 1]]), bytes: new Uint8Array([1, 2]) }),
    ],
    // Redaction must see the boxed string: storage unboxes it to a plain string, which a fresh count redacts.
    ['a boxed encryptedContent', () => ({ summary: 'ok', encryptedContent: new String(report) })],
    // JSON.stringify reads an array by index; a custom iterator must not change what is counted.
    [
      'an array with a custom iterator',
      () =>
        Object.assign([report, report], {
          *[Symbol.iterator]() {
            yield 'short';
          },
        }),
    ],
    [
      'an array subclass with a custom iterator',
      () => {
        class Pages extends Array<string> {
          *[Symbol.iterator]() {
            yield 'short';
          }
        }
        return { pages: Pages.from([report, report]) };
      },
    ],
  ];
  it.each([
    ...serializers.map(([name, make]) => [`whose toJSON() ${name}`, make] as const),
    ...nonPlainValues.map(([name, make]) => [`that is ${name}`, make] as const),
  ])(
    'stores the same count a fresh count of the stored message gives, for a tool result %s',
    async (_name, makeResult) => {
      const { storage, memory } = open(join(dbDir, `to-json-${randomUUID()}.db`));
      const threadId = randomUUID();
      await memory.saveThread({
        thread: { id: threadId, resourceId: RESOURCE, title: 't', createdAt: new Date(), updatedAt: new Date() },
      });
      const lookup = createTool({
        id: 'lookup',
        description: 'Look up the report.',
        execute: async () => makeResult(),
      });
      let step = 0;
      const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
      const model = new MockLanguageModelV2({
        doStream: async () =>
          ({
            stream: convertArrayToReadableStream(
              step++ === 0
                ? [
                    { type: 'stream-start', warnings: [] },
                    { type: 'tool-call', toolCallId: 'call-1', toolName: 'lookup', input: '{}' },
                    { type: 'finish', finishReason: 'tool-calls', usage },
                  ]
                : [
                    { type: 'stream-start', warnings: [] },
                    { type: 'text-start', id: 't' },
                    { type: 'text-delta', id: 't', delta: 'OK.' },
                    { type: 'text-end', id: 't' },
                    { type: 'finish', finishReason: 'stop', usage },
                  ],
            ) as any,
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          }) as any,
      });
      const agent = new Agent({
        id: 'to-json',
        name: 'to-json',
        instructions: 'Be brief.',
        model,
        tools: { lookup },
        memory,
      });

      const turn = await agent.stream('Get the report.', { memory: { thread: threadId, resource: RESOURCE } });
      await turn.consumeStream();
      expect(await turn.text).toBe('OK.');

      const { messages } = await (await storage.getStore('memory'))!.listMessages({ threadId, perPage: false });
      const toolMessage = messages.find(message =>
        message.content.parts.some(
          (part: any) => part.type === 'tool-invocation' && part.toolInvocation.state === 'result',
        ),
      )!;
      const toolPart = toolMessage.content.parts.find((part: any) => part.type === 'tool-invocation') as any;
      expect(trustedEntries(toolPart).filter(entry => entry.key.includes('tool-result'))).toHaveLength(1);

      const withoutCounts = structuredClone(toolMessage);
      for (const part of withoutCounts.content.parts as any[]) delete part.providerMetadata?.mastra?.tokenEstimate;
      const counter = new TokenCounter();
      expect(counter.countMessage(toolMessage)).toBe(counter.countMessage(withoutCounts));
    },
  );
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
  // A marker OM writes to a stored message while the turn runs must survive the counts saved at the end of it.
  it.each([true, false])(
    'keeps a marker written during the turn when counts are saved for a stored message (sealed: %s)',
    async sealed => {
      const { storage, memory } = open(join(dbDir, `marker-during-turn-${sealed}.db`));
      const threadId = randomUUID();
      const id = `${threadId}-history`;
      await memory.saveThread({
        thread: { id: threadId, resourceId: RESOURCE, title: 't', createdAt: new Date(), updatedAt: new Date() },
      });
      await memory.saveMessages({
        messages: [
          {
            id,
            threadId,
            resourceId: RESOURCE,
            role: 'user',
            createdAt: new Date(0),
            content: {
              format: 2,
              parts: [{ type: 'text', text: 'Uncounted history. '.repeat(40) }],
              metadata: { mastra: { sealed } },
            },
          },
        ],
      });
      const memoryStore = (await storage.getStore('memory'))!;
      // The turn loads the message and counts it...
      const [live] = (await memoryStore.listMessagesById({ messageIds: [id] })).messages;
      new TokenCounter().countMessage(live!);
      // ...then a marker lands on the stored copy, which the loaded copy does not have.
      const [fresh] = (await memoryStore.listMessagesById({ messageIds: [id] })).messages;
      await memoryStore.updateMessages({
        messages: [
          {
            id,
            content: {
              ...fresh!.content,
              parts: [
                ...fresh!.content.parts,
                { type: 'data-om-buffering-start', data: { cycleId: 'during-turn' } } as any,
              ],
            },
          },
        ],
      });

      // The end of the turn saves the counts it made.
      const om = (await memory.omEngine)!;
      await om.persistMessages([live!], threadId, RESOURCE, new Set([id]));

      const [saved] = (await memoryStore.listMessagesById({ messageIds: [id] })).messages;
      expect(saved!.content.parts.some(part => part.type === 'data-om-buffering-start')).toBe(true);
      expect(trustedEntries(saved!.content.parts[0])).toHaveLength(1);
    },
  );

  it('does not bring back a remembered message that was deleted during the turn', async () => {
    const { storage, memory } = open(join(dbDir, 'deleted-mid-turn.db'));
    const threadId = randomUUID();
    const keptId = `${threadId}-kept`;
    const deletedId = `${threadId}-deleted`;
    await memory.saveThread({
      thread: { id: threadId, resourceId: RESOURCE, title: 't', createdAt: new Date(), updatedAt: new Date() },
    });
    const build = (id: string, createdAt: Date): MastraDBMessage => ({
      id,
      threadId,
      resourceId: RESOURCE,
      role: 'user',
      createdAt,
      content: { format: 2, parts: [{ type: 'text', text: `${id} `.repeat(40) }] },
    });
    await memory.saveMessages({ messages: [build(keptId, new Date(0)), build(deletedId, new Date(1000))] });
    // Both were loaded at turn start and counted during it; one is then deleted.
    const kept = build(keptId, new Date(0));
    const deleted = build(deletedId, new Date(1000));
    new TokenCounter().countMessage(kept);
    new TokenCounter().countMessage(deleted);
    await memory.deleteMessages([deletedId]);

    const om = (await memory.omEngine)!;
    await om.persistMessages([kept, deleted], threadId, RESOURCE, new Set([keptId, deletedId]));

    const memoryStore = (await storage.getStore('memory'))!;
    const rows = (await memoryStore.listMessagesById({ messageIds: [keptId, deletedId] })).messages;
    expect(rows.map(row => row.id)).toEqual([keptId]);
    expect(trustedEntries(rows[0]!.content.parts[0])).toHaveLength(1);
  });

  it('saves a sealed message holding a completed boundary whole, so its end marker and count both reach storage', async () => {
    const { storage, memory } = open(join(dbDir, 'resave-boundary.db'));
    const threadId = randomUUID();
    const id = `${threadId}-boundary`;
    await memory.saveThread({
      thread: { id: threadId, resourceId: RESOURCE, title: 't', createdAt: new Date(), updatedAt: new Date() },
    });
    const sealed = { mastra: { sealed: true } };
    await memory.saveMessages({
      messages: [
        {
          id,
          threadId,
          resourceId: RESOURCE,
          role: 'assistant',
          createdAt: new Date(0),
          content: { format: 2, parts: [{ type: 'text', text: 'Observed words. '.repeat(40) }], metadata: sealed },
        },
      ],
    });
    const memoryStore = (await storage.getStore('memory'))!;
    const [live] = (await memoryStore.listMessagesById({ messageIds: [id] })).messages;
    // The end marker exists only on the in-memory copy, which then gains a count.
    live!.content.parts.push({
      type: 'data-om-observation-end',
      data: { cycleId: 'c', operationType: 'observation' },
    } as any);
    new TokenCounter().countMessage(live!);
    const om = (await memory.omEngine)!;
    await om.persistMessages([live!], threadId, RESOURCE, new Set([id]));

    const [saved] = (await memoryStore.listMessagesById({ messageIds: [id] })).messages;
    expect(saved!.content.parts.some(part => part.type === 'data-om-observation-end')).toBe(true);
    expect(trustedEntries(saved!.content.parts[0])).toHaveLength(1);
  });

  it('patches the counts onto stored history instead of saving it whole', async () => {
    const { storage, memory, agent } = open(join(dbDir, 'normal-save.db'));
    const threadId = randomUUID();
    await memory.saveThread({
      thread: { id: threadId, resourceId: RESOURCE, title: 't', createdAt: new Date(), updatedAt: new Date() },
    });
    const ids = Array.from({ length: 4 }, (_, i) => `${threadId}-n${i}`);
    await memory.saveMessages({
      messages: ids.map((id, i) => ({
        id,
        threadId,
        resourceId: RESOURCE,
        role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
        createdAt: new Date(Date.UTC(2026, 10, 1, 0, 0, i)),
        content: { format: 2 as const, parts: [{ type: 'text' as const, text: `Note ${i}. ${'Plan. '.repeat(40)}` }] },
      })),
    });
    const memoryStore = (await storage.getStore('memory'))!;
    const saved: MastraDBMessage[][] = [];
    const originalSave = memoryStore.saveMessages.bind(memoryStore);
    vi.spyOn(memoryStore, 'saveMessages').mockImplementation(async (args: any) => {
      saved.push(args.messages);
      return originalSave(args);
    });
    const updatedIds: string[] = [];
    const originalUpdate = memoryStore.updateMessages.bind(memoryStore);
    vi.spyOn(memoryStore, 'updateMessages').mockImplementation(async (args: any) => {
      updatedIds.push(...args.messages.map((m: any) => m.id));
      return originalUpdate(args);
    });

    const turn = await agent.stream('Question.', { memory: { thread: threadId, resource: RESOURCE } });
    await turn.consumeStream();
    expect(await turn.text).toBe('OK.');

    // The history is not saved whole, which could overwrite markers written since it was loaded...
    expect(saved.flat().filter(message => ids.includes(message.id))).toEqual([]);
    // ...its counts are patched onto the stored copies.
    expect([...new Set(updatedIds.filter(id => ids.includes(id)))].sort()).toEqual([...ids].sort());
    const rows = (await memory.recall({ threadId, resourceId: RESOURCE, perPage: false })).messages.filter(m =>
      ids.includes(m.id),
    );
    expect(rows.every(row => trustedEntries(row.content.parts[0]).length === 1)).toBe(true);
  });

  it('keeps a count made after the last save in memory, and the next turn saves it', async () => {
    const dbPath = join(dbDir, 'after-final-drain.db');
    const first = open(dbPath);
    const threadId = randomUUID();
    await first.memory.saveThread({
      thread: { id: threadId, resourceId: RESOURCE, title: 't', createdAt: new Date(), updatedAt: new Date() },
    });
    const id = `${threadId}-late`;
    await first.memory.saveMessages({
      messages: [
        {
          id,
          threadId,
          resourceId: RESOURCE,
          role: 'user',
          createdAt: new Date(Date.UTC(2026, 10, 1)),
          content: { format: 2, parts: [{ type: 'text', text: `Late ${'words '.repeat(60)}` }] },
        },
      ],
    });
    // A count made outside any save (the Agent has already drained its last save) is not stored.
    const [live] = (await first.memory.recall({ threadId, resourceId: RESOURCE, perPage: false })).messages;
    (await first.memory.omEngine)!.getTokenCounter().countMessages([live!]);
    const readStored = async () =>
      (await first.memory.recall({ threadId, resourceId: RESOURCE, perPage: false })).messages.find(m => m.id === id);
    expect(trustedEntries((await readStored())!.content.parts[0])).toEqual([]);

    // The next turn loads the message without a count, counts it again and saves it.
    const second = open(dbPath);
    const turn = await second.agent.stream('Next.', { memory: { thread: threadId, resource: RESOURCE } });
    await turn.consumeStream();
    expect(await turn.text).toBe('OK.');
    expect(trustedEntries((await readStored())!.content.parts[0])).toHaveLength(1);
  });

  it("does not touch another thread's messages or updatedAt when the resource has several threads", async () => {
    const { storage, memory, agent } = open(join(dbDir, 'resource.db'), 'resource');
    const current = randomUUID();
    const other = randomUUID();
    const seed = async (threadId: string, updatedAt: Date) => {
      await memory.saveThread({
        thread: { id: threadId, resourceId: RESOURCE, title: threadId, createdAt: updatedAt, updatedAt },
      });
      await memory.saveMessages({
        messages: Array.from({ length: 4 }, (_, i) => ({
          id: `${threadId}-h${i}`,
          threadId,
          resourceId: RESOURCE,
          role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
          createdAt: new Date(updatedAt.getTime() + i * 1000),
          content: {
            format: 2 as const,
            parts: [{ type: 'text' as const, text: `${threadId} message ${i}. ${'Notes. '.repeat(40)}` }],
          },
        })),
      });
    };
    await seed(other, new Date(Date.UTC(2026, 10, 1)));
    await seed(current, new Date(Date.UTC(2026, 10, 2)));
    const memoryStore = (await storage.getStore('memory'))!;
    const otherBefore = (await memory.getThreadById({ threadId: other }))!.updatedAt.getTime();
    const currentIds = Array.from({ length: 4 }, (_, i) => `${current}-h${i}`);

    const turn = await agent.stream('Question.', { memory: { thread: current, resource: RESOURCE } });
    await turn.consumeStream();
    expect(await turn.text).toBe('OK.');

    // The current thread's history gets its counts back (so the write-back ran)...
    await vi.waitFor(async () => {
      const rows = (await memory.recall({ threadId: current, resourceId: RESOURCE, perPage: false })).messages.filter(
        m => currentIds.includes(m.id),
      );
      expect(rows.every(row => trustedEntries(row.content.parts[0]).length === 1)).toBe(true);
    });
    // ...and the other thread is left exactly as it was, so it keeps its place in the recent-thread order.
    expect((await memory.getThreadById({ threadId: other }))!.updatedAt.getTime()).toBe(otherBefore);
    const otherRows = (
      await memoryStore.listMessagesById({ messageIds: Array.from({ length: 4 }, (_, i) => `${other}-h${i}`) })
    ).messages;
    expect(otherRows.flatMap(row => row.content.parts.flatMap(trustedEntries))).toEqual([]);
  });
});
