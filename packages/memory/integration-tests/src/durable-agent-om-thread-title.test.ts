/**
 * GH #30478, the issue's case C: a DurableAgent with observational memory enabled on both the
 * Memory instance and the call's `memory.options` must title the thread, as the regular Agent does.
 * OM on the instance is what makes OM persist the turn; OM on the call is what makes the durable
 * run treat itself as an OM run. The OM thresholds sit far above the conversation, so the observer
 * never runs and OM only persists the turn.
 *
 * Real Memory, real OM, real LibSQL store; only the models are local mocks.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it, vi } from 'vitest';

const usage = { inputTokens: 10, outputTokens: 5, totalTokens: 15 };

function textModel(modelId: string, text: string, onCall?: () => Promise<void> | void) {
  return new MockLanguageModelV2({
    modelId,
    doGenerate: async () => {
      await onCall?.();
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage,
        content: [{ type: 'text', text }],
        warnings: [],
      };
    },
    doStream: async () => {
      await onCall?.();
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `r-${modelId}`, modelId, timestamp: new Date(0) },
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: text },
          { type: 'text-end', id: 't1' },
          { type: 'finish', finishReason: 'stop', usage },
        ]),
      };
    },
  });
}

const threadId = 'durable-om-title-thread';
const resourceId = 'durable-om-title-user';

type Hook = (memory: Memory) => Promise<void>;

/** Runs one durable turn. Hooks run before the turn and inside the title model call. */
async function runTurn(hooks: { beforeRun?: Hook; duringTitle?: Hook } = {}) {
  let titleCalls = 0;
  let titleModelDone = false;
  const observationalMemory = {
    model: textModel('om-model', 'unused'),
    observation: { messageTokens: 100_000 },
    reflection: { observationTokens: 200_000 },
  };
  const storage = new LibSQLStore({ id: 'durable-om-title', url: ':memory:' });
  const memory: Memory = new Memory({
    storage,
    options: {
      observationalMemory,
      generateTitle: {
        model: textModel('title-model', 'Durable OM title', async () => {
          titleCalls++;
          await hooks.duringTitle?.(memory);
          titleModelDone = true;
        }),
      },
    },
  });
  const base = new Agent({
    id: 'durable-om-title-agent',
    name: 'durable-om-title-agent',
    instructions: 'You are a test agent.',
    model: textModel('main-model', 'Hello from the agent.'),
    memory,
  });
  const mastra = new Mastra({ agents: { agent: createDurableAgent({ agent: base }) as any }, storage, logger: false });
  await hooks.beforeRun?.(memory);
  // The title write starts with an existence check once the title model (and its hook) has
  // returned; count only reads made after that point.
  let readsAfterTitle = 0;
  const getThreadById = memory.getThreadById.bind(memory);
  vi.spyOn(memory, 'getThreadById').mockImplementation(async args => {
    if (titleModelDone) readsAfterTitle++;
    return getThreadById(args);
  });
  try {
    const res: any = await mastra.getAgent('agent').stream('Hi, please say hello.', {
      memory: { thread: threadId, resource: resourceId, options: { observationalMemory } },
    } as any);
    await (res.output ?? res).text;
    res.cleanup?.();
    await vi.waitFor(() => expect(titleCalls).toBe(1));
    await vi.waitFor(() => expect(readsAfterTitle).toBeGreaterThan(0));
    return { memory, titleCalls };
  } finally {
    await mastra.stopWorkers?.();
  }
}

describe('DurableAgent observational-memory thread title (#30478)', () => {
  it('titles the thread and keeps the turn messages stored once', async () => {
    const { memory, titleCalls } = await runTurn();

    await vi.waitFor(async () => expect((await memory.getThreadById({ threadId }))?.title).toBe('Durable OM title'));
    expect(titleCalls).toBe(1);
    const { messages } = await memory.recall({ threadId, resourceId });
    expect(messages.map((m: any) => m.role)).toEqual(['user', 'assistant']);
    expect(new Set(messages.map((m: any) => m.id)).size).toBe(messages.length);
  });

  it('keeps thread metadata written while the title was generating', async () => {
    const { memory } = await runTurn({
      beforeRun: async memory => {
        await memory.createThread({ threadId, resourceId, title: '', metadata: { omCursor: 'cursor-0' } });
      },
      // Stands in for OM advancing its cursor in thread metadata mid-run.
      duringTitle: async memory => {
        await memory.updateThread({ id: threadId, title: '', metadata: { omCursor: 'cursor-1' } });
      },
    });

    await vi.waitFor(async () => expect((await memory.getThreadById({ threadId }))?.title).toBe('Durable OM title'));
    expect((await memory.getThreadById({ threadId }))?.metadata).toMatchObject({ omCursor: 'cursor-1' });
  });

  it('does not re-create a thread deleted while the title was generating', async () => {
    const { memory } = await runTurn({
      duringTitle: async memory => {
        await memory.deleteThread(threadId);
      },
    });

    expect(await memory.getThreadById({ threadId })).toBeNull();
  });
});
