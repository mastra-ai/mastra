import { openai } from '@ai-sdk/openai-v7';
import { stepCountIs, streamText, tool } from '@internal/ai-v7';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { actionsFromAISDKStream } from './from-ai-sdk';
import { InMemoryActionStorage } from './storage';
import { toModelMessages } from './to-model-messages';
import type { MastraAction, TextAction } from './types';
import { createUlid } from './ulid';

const MODEL_ID = 'gpt-4o-mini';
const THREAD_ID = 'thread-1';
const RESOURCE_ID = 'user-1';

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

describe.skipIf(!process.env.OPENAI_API_KEY)('new-message-format: AI SDK v7 + OpenAI → InMemoryActionStorage', () => {
  let storage: InMemoryActionStorage;
  let generateId: () => string;

  beforeEach(() => {
    storage = new InMemoryActionStorage();
    generateId = createUlid();
  });

  /** One run: persist the user prompt, stream the model, persist every resulting action. */
  async function run(prompt: string, options: { runId: string; tools?: Parameters<typeof streamText>[0]['tools'] }) {
    const userText: TextAction = {
      id: generateId(),
      threadId: THREAD_ID,
      resourceId: RESOURCE_ID,
      runId: options.runId,
      createdAt: new Date(),
      type: 'text',
      role: 'user',
      text: prompt,
    };

    const result = streamText({
      model: openai(MODEL_ID),
      prompt,
      tools: options.tools,
      stopWhen: stepCountIs(4),
      temperature: 0,
    });

    const actions = await actionsFromAISDKStream(result.fullStream, {
      threadId: THREAD_ID,
      resourceId: RESOURCE_ID,
      runId: options.runId,
      modelId: MODEL_ID,
      generateId,
    });
    await storage.record([userText, ...actions]);
    return { actions: [userText, ...actions], finalText: await result.text };
  }

  const types = (actions: MastraAction[]) => actions.map(a => a.type);

  it('plain text: user text → turn-start → assistant text', async () => {
    const { finalText } = await run('Reply with exactly the word: pong', { runId: 'run-text' });

    const stored = await storage.listActions({ threadId: THREAD_ID });
    expect(types(stored)).toEqual(['text', 'turn-start', 'text', 'turn-end', 'run-end']);
    expect(stored[0]).toMatchObject({ role: 'user', text: 'Reply with exactly the word: pong' });
    expect(stored[1]).toMatchObject({ modelId: MODEL_ID, runId: 'run-text' });
    expect(stored[2]).toMatchObject({ role: 'assistant', text: finalText });
    expect(stored[3]).toMatchObject({
      finishReason: 'stop',
      modelId: expect.stringContaining(MODEL_ID),
      usage: { inputTokens: expect.any(Number), outputTokens: expect.any(Number) },
    });
    expect(stored[4]).toMatchObject({ finishReason: 'stop', usage: (stored[3] as { usage: unknown }).usage });
    expect(finalText.toLowerCase()).toContain('pong');
  }, 30_000);

  it('tool call: each turn and tool transition is its own action, linked by toolCallId', async () => {
    await run('What is the weather in Paris? Use the tool.', { runId: 'run-tool', tools: { weather } });

    const stored = await storage.listActions({ threadId: THREAD_ID, runId: 'run-tool' });
    expect(types(stored)).toEqual([
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

    const call = stored.find(a => a.type === 'tool-call')!;
    const result = stored.find(a => a.type === 'tool-result')!;
    expect(call).toMatchObject({ toolName: 'weather', input: { city: expect.stringMatching(/paris/i) } });
    expect(result).toMatchObject({
      toolCallId: (call as { toolCallId: string }).toolCallId,
      output: { tempC: 21, conditions: 'sunny' },
    });
  }, 30_000);

  it('replay: a stored tool-run log projects to a prompt the model accepts and remembers', async () => {
    await run('What is the weather in Paris? Use the tool.', { runId: 'run-tool', tools: { weather } });
    const history = toModelMessages(await storage.listActions({ threadId: THREAD_ID }));
    expect(history.map(m => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant']);

    const followUp = streamText({
      model: openai(MODEL_ID),
      tools: { weather },
      messages: [
        ...history,
        { role: 'user', content: 'Without calling any tool: what temperature in C did the tool report?' },
      ],
      temperature: 0,
    });
    expect(await followUp.text).toContain('21');
    expect((await followUp.toolCalls).length).toBe(0);
  }, 30_000);

  it('tool failure is persisted as tool-error, not a run error', async () => {
    await run('Look up order A-42 with the tool. If it fails, say so briefly.', {
      runId: 'run-tool-error',
      tools: { lookupOrder: failing },
    });

    const stored = await storage.listActions({ threadId: THREAD_ID });
    const toolError = stored.find(a => a.type === 'tool-error');
    expect(toolError).toMatchObject({ toolName: 'lookupOrder', errorText: 'order service unavailable' });
    expect(stored.some(a => a.type === 'error')).toBe(false);
    expect(stored.findLast(a => a.type === 'text')).toMatchObject({ role: 'assistant' });
  }, 30_000);

  it('query API: runs share a thread and are read back by runId, type, and ULID cursor', async () => {
    await run('Reply with exactly: one', { runId: 'run-a' });
    await run('What is the weather in Tokyo? Use the tool.', { runId: 'run-b', tools: { weather } });

    const all = await storage.listActions({ threadId: THREAD_ID });
    const ids = all.map(a => a.id);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);

    // Grouping by run reconstructs each run in order.
    const runA = await storage.listActions({ threadId: THREAD_ID, runId: 'run-a' });
    const runB = await storage.listActions({ threadId: THREAD_ID, runId: 'run-b' });
    expect(types(runA)).toEqual(['text', 'turn-start', 'text', 'turn-end', 'run-end']);
    expect(runA.length + runB.length).toBe(all.length);
    expect(runA.at(-1)!.id < runB[0]!.id).toBe(true);

    // Type filter across runs.
    const userTexts = await storage.listActions({ threadId: THREAD_ID, types: ['text'] });
    expect(userTexts.filter(a => a.type === 'text' && a.role === 'user').map(a => (a as TextAction).text)).toEqual([
      'Reply with exactly: one',
      'What is the weather in Tokyo? Use the tool.',
    ]);

    // Cursor pagination walks the whole thread with no gaps or repeats.
    const paged: string[] = [];
    let after: string | undefined;
    for (;;) {
      const page = await storage.listActions({ threadId: THREAD_ID, after, limit: 2 });
      if (page.length === 0) break;
      paged.push(...page.map(a => a.id));
      after = page.at(-1)!.id;
    }
    expect(paged).toEqual(ids);

    // Other threads are isolated.
    expect(await storage.listActions({ threadId: 'other-thread' })).toEqual([]);
  }, 60_000);
});
