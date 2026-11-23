/**
 * A regular Agent with observational memory titled the thread from OM's continuation reminder instead of
 * the user's question. Once a turn is observed mid-turn, OM drops the request from the run's message list
 * and adds its `om-continuation` reminder, which has role `user`, so it became the "most recent user
 * message" the title was generated from. The durable engine had the same bug (#30478).
 */
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const QUESTION = 'What is the weather in Lisbon today?';

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

/** The first `toolSteps` steps call `lookupWeather`; the next answers in prose. */
function toolThenTextModel(toolSteps: number) {
  let call = 0;
  const finish = (finishReason: 'tool-calls' | 'stop') =>
    ({ type: 'finish', finishReason, usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } }) as const;
  return new MockLanguageModelV2({
    doStream: async () => {
      const step = call++;
      const chunks =
        step < toolSteps
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

describe('regular Agent OM thread title', () => {
  let dbDir: string;
  let storage: LibSQLStore;

  beforeEach(async () => {
    dbDir = await mkdtemp(join(tmpdir(), 'agent-om-title-'));
    storage = new LibSQLStore({ id: randomUUID(), url: `file:${join(dbDir, 'memory.db')}` });
  });

  afterEach(async () => {
    await rm(dbDir, { recursive: true, force: true });
  });

  async function runTurn({ toolSteps }: { toolSteps: number }) {
    const title = textModel('Lisbon Weather');
    const observer = textModel('<observations>\n- User asked about the weather in Lisbon.\n</observations>');
    const memory = new Memory({
      storage,
      options: {
        lastMessages: 10,
        semanticRecall: false,
        workingMemory: { enabled: false },
        generateTitle: { model: title.model },
        // Observe as soon as anything is unobserved, synchronously, so the request is observed early in
        // the turn and pruned from the run's message list.
        observationalMemory: {
          enabled: true,
          model: observer.model,
          scope: 'thread',
          observation: { messageTokens: 1, bufferTokens: false },
          reflection: { observationTokens: 1_000_000 },
        },
      } as any,
    });
    const agent = new Agent({
      id: 'agent-om-title',
      name: 'OM Title Agent',
      instructions: 'Answer briefly.',
      model: toolThenTextModel(toolSteps),
      tools: { lookupWeather },
      memory,
    });

    const thread = `agent-om-title-${randomUUID()}`;
    const result = await agent.stream(QUESTION, {
      memory: { thread, resource: 'agent-om-title-resource' },
      maxSteps: toolSteps + 2,
    });
    await result.consumeStream();
    return { memory, thread, title, observer };
  }

  it.each([2, 4])('titles from the user question after a %i-tool-call turn observed mid-turn', async toolSteps => {
    const { memory, thread, title, observer } = await runTurn({ toolSteps });

    await vi.waitFor(async () => {
      expect((await memory.getThreadById({ threadId: thread }))?.title).toBe('Lisbon Weather');
    });
    expect(observer.calls.length).toBeGreaterThan(0);
    expect(title.calls).toHaveLength(1);
    const titlePrompt = JSON.stringify(title.calls[0]);
    expect(titlePrompt).toContain(QUESTION);
    expect(titlePrompt).not.toContain('system-reminder');
  });

  // Each tool-call step stores an assistant message after the request, so 45 steps put it past the first
  // page of stored messages and 210 put it past the 200-message limit.
  it('pages back to a request more than one page behind the newest stored message', async () => {
    const { memory, thread, title } = await runTurn({ toolSteps: 45 });
    const { messages } = await memory.recall({ threadId: thread, perPage: false });
    expect(messages.length).toBeGreaterThan(40);

    await vi.waitFor(async () => {
      expect((await memory.getThreadById({ threadId: thread }))?.title).toBe('Lisbon Weather');
    });
    expect(JSON.stringify(title.calls[0])).toContain(QUESTION);
  });

  it('gives up without a title when the request is more than 200 stored messages back', async () => {
    const { memory, thread, title } = await runTurn({ toolSteps: 210 });
    const { messages } = await memory.recall({ threadId: thread, perPage: false });
    expect(messages.length).toBeGreaterThan(200);

    await new Promise(resolve => setTimeout(resolve, 200));
    expect(title.calls).toHaveLength(0);
    expect((await memory.getThreadById({ threadId: thread }))?.title ?? '').toBe('');
  });
});
