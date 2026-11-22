/**
 * #30478: a durable or evented agent never titled the thread of an observational-memory run. A regular
 * Agent with the same Memory titles it on the first turn.
 *
 * OM is passed on the call's `memory.options` as well as on the Memory instance: that is what makes the
 * durable engine treat the run as an OM run today. Thresholds sit far above the conversation, so the
 * observer never runs and no model other than the agent's and the title model is called.
 */
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

function textModel(text: string) {
  const calls: unknown[] = [];
  const model = new MockLanguageModelV2({
    doGenerate: async options => {
      calls.push(options);
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        content: [{ type: 'text', text }],
        warnings: [],
      };
    },
    doStream: async options => {
      calls.push(options);
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: randomUUID(), modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: text },
          { type: 'text-end', id: 't1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
  return { model, calls };
}

/**
 * Steps 0 and 1 call `lookupWeather`, step 2 answers in prose. OM keeps the request while it is
 * still unread (step 0, and step 1 when it is first drained); from step 2 on, an observation prunes it.
 */
function toolThenTextModel() {
  let call = 0;
  const finish = (finishReason: 'tool-calls' | 'stop') =>
    ({ type: 'finish', finishReason, usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } }) as const;
  return new MockLanguageModelV2({
    doStream: async () => {
      const step = call++;
      const chunks =
        step < 2
          ? [
              { type: 'tool-call', toolCallId: `call-${step}`, toolName: 'lookupWeather', input: '{"city":"Lisbon"}' },
              finish('tool-calls'),
            ]
          : [
              { type: 'text-start', id: 't1' },
              { type: 'text-delta', id: 't1', delta: 'It is sunny in Lisbon.' },
              { type: 'text-end', id: 't1' },
              finish('stop'),
            ];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: randomUUID(), modelId: 'mock', timestamp: new Date(0) },
          ...chunks,
        ] as any),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

const lookupWeather = createTool({
  id: 'lookupWeather',
  description: 'Look up the weather for a city.',
  inputSchema: z.object({ city: z.string() }),
  execute: async () => ({ forecast: 'sunny', highC: 23 }),
});

const ENGINES = { durable: createDurableAgent, evented: createEventedAgent } as const;

describe.each(Object.entries(ENGINES))('#30478 durable OM thread title — %s engine', (engine, wrap) => {
  let dbDir: string;
  let storage: LibSQLStore;

  beforeEach(async () => {
    dbDir = await mkdtemp(join(tmpdir(), `om-title-${engine}-`));
    storage = new LibSQLStore({ id: randomUUID(), url: `file:${join(dbDir, 'memory.db')}` });
  });

  afterEach(async () => {
    await rm(dbDir, { recursive: true, force: true });
  });

  async function runTurn({ readOnly = false, observeMidTurn = false } = {}) {
    const title = textModel('Lisbon Weather');
    const observer = textModel('<observations>\n- User asked about the weather in Lisbon.\n</observations>');
    const observationalMemory = {
      enabled: true,
      model: observer.model,
      scope: 'thread',
      // Mid-turn: observe as soon as anything is unobserved, synchronously, so step 0's request is
      // observed before step 1 and pruned from the run's message list.
      observation: observeMidTurn ? { messageTokens: 1, bufferTokens: false } : { messageTokens: 1_000_000 },
      reflection: { observationTokens: 1_000_000 },
    };
    const memory = new Memory({
      storage,
      options: {
        lastMessages: 10,
        semanticRecall: false,
        workingMemory: { enabled: false },
        generateTitle: { model: title.model },
        observationalMemory,
      } as any,
    });
    const agent = new Agent({
      id: `om-title-${engine}`,
      name: 'OM Title Agent',
      instructions: 'Answer briefly.',
      model: observeMidTurn ? toolThenTextModel() : textModel('It is sunny in Lisbon.').model,
      tools: observeMidTurn ? { lookupWeather } : undefined,
      memory,
    });
    const runner = wrap({ agent });
    const mastra = new Mastra({ agents: { runner: runner as any }, storage, logger: false });

    const thread = `om-title-thread-${randomUUID()}`;
    const resource = 'om-title-resource';
    const result = await (runner as any).stream('What is the weather in Lisbon today?', {
      memory: { thread, resource, options: { observationalMemory, readOnly } },
      maxSteps: 5,
    });
    for await (const _chunk of result.fullStream as AsyncIterable<unknown>) {
    }
    return { memory, mastra, thread, result, title, observer };
  }

  it('titles the thread of an OM run, and the row holds the turn', async () => {
    const { memory, mastra, thread, result, title, observer } = await runTurn();

    await vi.waitFor(async () => {
      expect((await memory.getThreadById({ threadId: thread }))?.title).toBe('Lisbon Weather');
    });
    const { messages } = await memory.recall({ threadId: thread });
    expect(messages.map(m => m.role)).toEqual(['user', 'assistant']);
    expect(title.calls).toHaveLength(1);
    expect(observer.calls).toHaveLength(0);

    result.cleanup?.();
    await mastra.stopWorkers?.();
  });

  // The observer runs on every step, so by the last step OM has dropped the turn's request from the
  // run's message list: the observations stand in for it. The title must still come from it.
  it('titles the thread when the turn was observed mid-turn', async () => {
    const { memory, mastra, thread, result, title, observer } = await runTurn({ observeMidTurn: true });

    await vi.waitFor(async () => {
      expect((await memory.getThreadById({ threadId: thread }))?.title).toBe('Lisbon Weather');
    });
    expect(observer.calls.length).toBeGreaterThan(0);
    expect(title.calls).toHaveLength(1);
    expect(JSON.stringify(title.calls[0])).toContain('What is the weather in Lisbon today?');

    result.cleanup?.();
    await mastra.stopWorkers?.();
  });

  it('does not title an OM run with read-only memory', async () => {
    const { memory, mastra, thread, result, title } = await runTurn({ readOnly: true });
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(title.calls).toHaveLength(0);
    expect((await memory.getThreadById({ threadId: thread }))?.title ?? '').toBe('');

    result.cleanup?.();
    await mastra.stopWorkers?.();
  });
});
