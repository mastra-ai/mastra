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
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  async function runTurn({ readOnly = false } = {}) {
    const title = textModel('Lisbon Weather');
    const observer = textModel('<observations></observations>');
    const observationalMemory = {
      enabled: true,
      model: observer.model,
      scope: 'thread',
      observation: { messageTokens: 1_000_000 },
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
      model: textModel('It is sunny in Lisbon.').model,
      memory,
    });
    const runner = wrap({ agent });
    const mastra = new Mastra({ agents: { runner: runner as any }, storage, logger: false });

    const thread = `om-title-thread-${randomUUID()}`;
    const resource = 'om-title-resource';
    const result = await (runner as any).stream('What is the weather in Lisbon today?', {
      memory: { thread, resource, options: { observationalMemory, readOnly } },
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

  it('does not title an OM run with read-only memory', async () => {
    const { memory, mastra, thread, result, title } = await runTurn({ readOnly: true });
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(title.calls).toHaveLength(0);
    expect((await memory.getThreadById({ threadId: thread }))?.title ?? '').toBe('');

    result.cleanup?.();
    await mastra.stopWorkers?.();
  });
});
