import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent, createSignal } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { datasetItemsFromThread, rebuildWorkingMemory, runExperiment } from '@mastra/core/datasets';
import { Mastra } from '@mastra/core/mastra';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { Memory } from './index';

const message = (
  index: number,
  role: MastraDBMessage['role'],
  text: string,
  parts: MastraDBMessage['content']['parts'] = [],
): MastraDBMessage => ({
  id: `source-${index}`,
  threadId: 'golden',
  resourceId: 'customer',
  role,
  type: 'text',
  createdAt: new Date(index * 1000),
  content: { format: 2, parts: [...parts, ...(text ? [{ type: 'text' as const, text }] : [])] },
});
const call = (
  name: string,
  args: Record<string, unknown>,
  result: unknown,
): MastraDBMessage['content']['parts'][number] => ({
  type: 'tool-invocation',
  toolInvocation: { toolCallId: name, toolName: name, args, state: 'result', result },
});

async function fixture() {
  const storage = new InMemoryStore();
  const memory = new Memory({
    storage,
    options: { lastMessages: 4, workingMemory: { enabled: true, template: '# Customer' } },
  });
  await memory.createThread({ threadId: 'golden', resourceId: 'customer' });
  const messages = [
    message(0, 'system', 'Recorded system message'),
    message(1, 'user', 'My name is Ada'),
    message(2, 'assistant', 'Hello Ada', [
      call('updateWorkingMemory', { memory: '# Customer\nAda' }, { success: true }),
    ]),
    message(3, 'user', 'Find my order'),
    message(4, 'assistant', 'Order 42 is ready', [
      call('lookup', { id: 42 }, { status: 'ready' }),
      call('agent-support', { prompt: 'Help Ada' }, 'Resolved'),
    ]),
    message(5, 'user', 'Thanks'),
    message(6, 'assistant', 'You are welcome', [
      {
        type: 'tool-invocation',
        toolInvocation: { state: 'call', toolCallId: 'interrupted', toolName: 'send', args: {} },
      },
    ]),
    message(7, 'user', 'Still typing'),
  ];
  const store = (await storage.getStore('memory'))!;
  await store.saveMessages({ messages });
  return { storage, memory, messages, store };
}

describe('Golden thread replay', () => {
  it('imports the full conversation as one item with only user inputs and the initial seed', async () => {
    const { memory } = await fixture();
    const items = await datasetItemsFromThread({ memory, threadId: 'golden', mode: 'conversation' });
    expect(items).toHaveLength(1);
    expect(items[0]!.input).toMatchObject({
      type: 'conversation',
      turns: [
        { input: [{ role: 'user' }], groundTruth: 'Hello Ada', toolMocks: [] },
        { input: [{ role: 'user' }], groundTruth: 'Order 42 is ready' },
        { input: [{ role: 'user' }], groundTruth: 'You are welcome' },
      ],
    });
    expect(items[0]!.input.turns.every(turn => turn.input.length === 1)).toBe(true);
    expect(items[0]!.memorySeed).toBeUndefined();
    expect(items[0]).not.toHaveProperty('toolMocks');
    expect(items[0]).not.toHaveProperty('groundTruth');
    expect(items[0]!.metadata.replay.turnCount).toBe(3);
    expect(items[0]!.metadata.replay.turns[2]).toMatchObject({
      sourceMessageId: 'source-5',
      unresolvedToolCalls: ['interrupted'],
    });
  });

  it('rejects a history window for a continuous conversation', async () => {
    const { memory } = await fixture();
    await expect(
      datasetItemsFromThread({ memory, threadId: 'golden', mode: 'conversation', historyLimit: 0 }),
    ).rejects.toThrow('historyLimit');
  });

  it('captures completed turns, tool results, history and provenance without carrying source identities', async () => {
    const { memory, messages, store } = await fixture();
    const items = await datasetItemsFromThread({ memory, threadId: 'golden' });
    expect(items).toHaveLength(3);
    expect(items.map(item => item.groundTruth)).toEqual(['Hello Ada', 'Order 42 is ready', 'You are welcome']);
    expect(items[0]!.input[0]!.role).toBe('system');
    expect(items[0]!.memorySeed).toBeUndefined();
    expect(items[1]!.memorySeed).toEqual({ workingMemory: '# Customer\nAda' });
    expect(items[0]!.toolMocks).toEqual([]);
    expect(items[1]!.toolMocks).toEqual([
      { toolName: 'lookup', args: { id: 42 }, output: { status: 'ready' } },
      { toolName: 'agent-support', args: { prompt: 'Help Ada' }, output: 'Resolved', matchArgs: 'ignore' },
    ]);
    expect(items[1]!.expectedTrajectory?.steps).toMatchObject([
      { toolArgs: { id: 42 }, toolResult: { status: 'ready' } },
      { toolResult: 'Resolved' },
    ]);
    expect(items[2]!.metadata.replay).toEqual({
      sourceThreadId: 'golden',
      sourceResourceId: 'customer',
      turnIndex: 2,
      turnCount: 3,
      sourceMessageId: 'source-5',
      unresolvedToolCalls: ['interrupted'],
    });
    for (const item of items) {
      expect(item.source).toEqual({ type: 'thread', referenceId: 'golden' });
      expect(item.unmockedToolPolicy).toBe('deny');
      expect(item.toolMockMatchMode).toBe('lookup');
      expect(item.requestContext).toBeUndefined();
      for (const input of item.input) {
        expect(input).not.toHaveProperty('id');
        expect(input).not.toHaveProperty('threadId');
        expect(input).not.toHaveProperty('resourceId');
      }
    }
    expect(
      (
        await store.listMessages({
          threadId: 'golden',
          perPage: false,
          orderBy: { field: 'createdAt', direction: 'ASC' },
        })
      ).messages,
    ).toEqual(messages);
    expect((await datasetItemsFromThread({ memory, threadId: 'golden', historyLimit: 0 }))[2]!.input).toHaveLength(1);
    expect((await datasetItemsFromThread({ memory, threadId: 'golden', historyLimit: false }))[2]!.input).toHaveLength(
      6,
    );
    await expect(datasetItemsFromThread({ memory, threadId: 'golden', resourceId: 'someone-else' })).rejects.toThrow(
      'not found',
    );
  });

  it('pages through a long recorded ten-turn conversation without losing messages', async () => {
    const { memory, store } = await fixture();
    await memory.createThread({ threadId: 'long', resourceId: 'customer' });
    const messages = Array.from({ length: 10 }, (_, turn) => [
      message(turn * 20, 'user', `Question ${turn}`),
      ...Array.from({ length: 10 }, (_, i) =>
        message(turn * 20 + i + 1, 'assistant', '', [call('lookup', { i }, { i })]),
      ),
      message(turn * 20 + 11, 'assistant', `Answer ${turn}`),
    ])
      .flat()
      .map(m => ({ ...m, id: `long-${m.id}`, threadId: 'long' }));
    await store.saveMessages({ messages });
    const items = await datasetItemsFromThread({ memory, threadId: 'long', historyLimit: false });
    expect(items).toHaveLength(10);
    expect(items.map(i => i.toolMocks?.length)).toEqual(Array(10).fill(10));
    expect(items[9]!.input).toHaveLength(109);
    expect(items[9]!.groundTruth).toBe('Answer 9');
  });

  it('reuses schema merge semantics and prefers recorded state snapshots', () => {
    const messages = [
      message(1, 'assistant', '', [
        call('updateWorkingMemory', { memory: { person: { name: 'Ada', city: 'Paris' }, tags: ['old'] } }, {}),
      ]),
      message(2, 'assistant', '', [
        call('updateWorkingMemory', { memory: { person: { city: null }, tags: ['new'] } }, {}),
      ]),
    ];
    expect(JSON.parse(rebuildWorkingMemory(messages, 2, { mode: 'schema' })!)).toEqual({
      person: { name: 'Ada' },
      tags: ['new'],
    });
    const signal = createSignal({
      type: 'state',
      contents: 'Rendered',
      tagName: 'working-memory',
      metadata: { state: { id: 'working-memory', mode: 'snapshot' }, value: '{"name":"Grace"}' },
    }).toDBMessage();
    expect(rebuildWorkingMemory([...messages, signal], 3, { mode: 'schema' })).toBe('{"name":"Grace"}');
    expect(rebuildWorkingMemory(messages, 0, { mode: 'schema' })).toBeUndefined();
  });

  it.each(['thread', 'resource'] as const)(
    'seeds %s memory, lets memory tools write, and preserves production messages and state',
    async scope => {
      const storage = new InMemoryStore();
      const memory = new Memory({
        storage,
        options: { lastMessages: 10, workingMemory: { enabled: true, scope, template: '# Customer' } },
      });
      await memory.createThread({ threadId: 'golden', resourceId: 'customer' });
      await memory.updateWorkingMemory({ threadId: 'golden', resourceId: 'customer', workingMemory: 'production' });
      const prompts: string[] = [];
      let step = 0;
      const model = new MockLanguageModelV2({
        doGenerate: async options => {
          prompts.push(JSON.stringify(options.prompt));
          return {
            content:
              step++ === 0
                ? [
                    {
                      type: 'tool-call',
                      toolCallId: 'wm',
                      toolName: 'updateWorkingMemory',
                      input: JSON.stringify({ memory: 'candidate' }),
                    },
                  ]
                : [{ type: 'text', text: 'Done' }],
            finishReason: step === 1 ? 'tool-calls' : 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            warnings: [],
          };
        },
      });
      const agent = new Agent({ id: 'replay', name: 'Replay', model, instructions: 'Help the customer', memory });
      const mastra = new Mastra({ agents: { replay: agent }, storage, logger: false });
      const result = await runExperiment(mastra, {
        targetType: 'agent',
        targetId: 'replay',
        data: [
          {
            input: 'Update my details',
            memorySeed: { workingMemory: 'seed Ada' },
            toolMockMatchMode: 'lookup',
            unmockedToolPolicy: 'deny',
          },
        ],
      });
      expect(result.succeededCount).toBe(1);
      expect(prompts[0]).toContain('seed Ada');
      expect(result.results[0]!.output).toMatchObject({ text: 'Done', workingMemory: 'candidate' });
      expect(await memory.getWorkingMemory({ threadId: 'golden', resourceId: 'customer' })).toBe('production');
      const threads = await memory.listThreads({});
      expect(threads.threads.filter(t => t.id !== 'golden')).toHaveLength(1);
      expect(threads.threads.find(t => t.id !== 'golden')!.resourceId).not.toBe('customer');
      for (const key of [MASTRA_THREAD_ID_KEY, MASTRA_RESOURCE_ID_KEY]) {
        const rejected = await runExperiment(mastra, {
          targetType: 'agent',
          targetId: 'replay',
          data: [
            {
              input: 'Unsafe seed',
              memorySeed: { workingMemory: 'overwrite' },
              requestContext: { [key]: key === MASTRA_THREAD_ID_KEY ? 'golden' : 'customer' },
            },
          ],
        });
        expect(rejected.results[0]!.error?.message).toContain('isolated experiment thread');
      }
    },
  );
});
