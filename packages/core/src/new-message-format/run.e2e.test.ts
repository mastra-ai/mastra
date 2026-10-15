import { openai } from '@ai-sdk/openai-v7';
import { tool } from '@internal/ai-v7';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { RunAgentOptions } from './run';
import { runAgent } from './run';
import { InMemoryActionStorage } from './storage';
import type { MastraAction } from './types';
import { isPersistable } from './types';

const model = openai('gpt-4o-mini');
const THREAD_ID = 'thread-run';

const weather = tool({
  description: 'Get the current weather for a city',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => ({ city, tempC: 21, conditions: 'sunny' }),
});

const failing = tool({
  description: 'Look up an order by id',
  inputSchema: z.object({ orderId: z.string() }),
  execute: async () => {
    throw new Error('order service unavailable');
  },
});

describe.skipIf(!process.env.OPENAI_API_KEY)('runAgent (live gpt-4o-mini, in-memory actions)', () => {
  let memory: InMemoryActionStorage;
  beforeEach(() => {
    memory = new InMemoryActionStorage();
  });

  async function collect(options: Omit<RunAgentOptions, 'model' | 'threadId' | 'memory'>) {
    const streamed: MastraAction[] = [];
    for await (const action of runAgent({ model, threadId: THREAD_ID, memory, ...options })) streamed.push(action);
    return streamed;
  }

  /** Storage holds exactly the non-transient stream actions, in order. */
  async function expectStoredMatchesStream(streamed: MastraAction[], runId: string) {
    const stored = await memory.listActions({ threadId: THREAD_ID, runId });
    expect(stored.map(a => a.id)).toEqual(streamed.filter(isPersistable).map(a => a.id));
    expect(stored.some(a => a.transient)).toBe(false);
    return stored;
  }

  it('plain text: deltas stream before the closing text action', async () => {
    const streamed = await collect({ runId: 'r1', input: 'Reply with exactly: hello there' });
    const types = streamed.map(a => a.type);

    const start = types.indexOf('text-start');
    const end = types.lastIndexOf('text');
    expect(types[0]).toBe('text'); // user input
    expect(start).toBeGreaterThan(0);
    expect(types.slice(start + 1, end).every(t => t === 'text-delta')).toBe(true);
    expect(types.slice(-2)).toEqual(['turn-end', 'run-end']);

    const deltas = streamed
      .filter(a => a.type === 'text-delta')
      .map(a => a.delta)
      .join('');
    const text = streamed[end]!;
    expect(text).toMatchObject({ role: 'assistant', text: deltas });

    const stored = await expectStoredMatchesStream(streamed, 'r1');
    expect(stored.map(a => a.type)).toEqual(['text', 'turn-start', 'text', 'turn-end', 'run-end']);
  });

  it('tools: tool input deltas then tool-call, tool-result, and a second turn', async () => {
    const streamed = await collect({
      runId: 'r2',
      input: [{ role: 'user', content: 'What is the weather in Paris? Use the tool.' }],
      tools: { weather },
    });
    const types = streamed.map(a => a.type);
    expect(types.indexOf('tool-input-start')).toBeLessThan(types.indexOf('tool-call'));
    expect(types).toContain('tool-input-delta');

    const stored = await expectStoredMatchesStream(streamed, 'r2');
    expect(stored.map(a => a.type)).toEqual([
      'text',
      'turn-start',
      'tool-call',
      'tool-result',
      'turn-end',
      'turn-start',
      'text',
      'turn-end',
      'run-end',
    ]);
    expect(stored.find(a => a.type === 'tool-result')).toMatchObject({ output: { tempC: 21 } });
  });

  it('tool error is stored as tool-error', async () => {
    const streamed = await collect({ runId: 'r3', input: 'Look up order 42 using the tool.', tools: { failing } });
    const stored = await expectStoredMatchesStream(streamed, 'r3');
    expect(stored.find(a => a.type === 'tool-error')).toMatchObject({ errorText: 'order service unavailable' });
    expect(stored.some(a => a.type === 'error')).toBe(false);
  });

  it('recall: a second run sees the first run from storage', async () => {
    await collect({ runId: 'a', input: 'My favourite colour is teal. Reply "ok".' });
    const streamed = await collect({ runId: 'b', input: 'What is my favourite colour? One word.' });
    const answer = streamed.findLast(a => a.type === 'text');
    expect(answer?.type === 'text' && answer.text.toLowerCase()).toContain('teal');
    expect((await memory.listActions({ threadId: THREAD_ID })).map(a => a.runId)).toContain('a');
  });

  it('abort: run ends with run-aborted and what streamed so far is stored', async () => {
    const controller = new AbortController();
    const streamed: MastraAction[] = [];
    for await (const action of runAgent({
      model,
      threadId: THREAD_ID,
      memory,
      runId: 'r5',
      input: 'Count from 1 to 200, one number per line.',
      abortSignal: controller.signal,
    })) {
      streamed.push(action);
      if (action.type === 'text-delta') controller.abort();
    }
    expect(streamed.at(-1)?.type).toBe('run-aborted');
    expect(streamed.some(a => a.type === 'run-end')).toBe(false);
    await expectStoredMatchesStream(streamed, 'r5');
  });
});
