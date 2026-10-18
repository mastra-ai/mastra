/**
 * In-flight turn preservation (#25372)
 *
 * Observation can fire between steps of a single agent turn. Whatever it
 * observes is then removed from the live prompt. The model must still see the
 * turn's own user message and the tool results it has not read yet — otherwise
 * it answers (or loops) without the request it is working on.
 *
 * These tests drive a real Agent + Memory + ObservationalMemory turn with mock
 * models and assert on the prompt the actor model actually receives.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage } from '@mastra/core/agent';
import { Agent, MessageList } from '@mastra/core/agent';
import { InMemoryDB, InMemoryMemory, InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';
import { ObservationalMemory } from '../observational-memory';

const USER_REQUEST = 'USER_REQUEST_MARKER: look up the order status for order 4471 and report it back.';
const RESULT_MARKER = 'TOOL_RESULT_MARKER';

// Large enough that the tool result alone crosses the observation threshold.
const filler = Array.from({ length: 400 }, (_, i) => `line ${i}: shipment scan event recorded at depot`).join('\n');

function observerModel(calls: { count: number }) {
  const text = `<observations>
## January 28, 2026
- 🔴 User asked to look up an order status
</observations>
<current-task>Look up the order status</current-task>`;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls.count++;
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'obs', modelId: 'observer', timestamp: new Date() },
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: text },
          { type: 'text-end', id: 't' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

/** Actor that calls `lookup` `toolSteps` times, then answers. Records every prompt it receives. */
function actorModel(toolSteps: number) {
  const prompts: unknown[] = [];
  let call = 0;
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(structuredClone(prompt));
      const n = call++;
      if (n < toolSteps) {
        const input = JSON.stringify({ orderId: `4471-${n}` });
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start' as const, warnings: [] },
            { type: 'response-metadata' as const, id: `r-${n}`, modelId: 'actor', timestamp: new Date() },
            { type: 'tool-input-start' as const, id: `call-${n}`, toolName: 'lookup' },
            { type: 'tool-input-delta' as const, id: `call-${n}`, delta: input },
            { type: 'tool-input-end' as const, id: `call-${n}` },
            { type: 'tool-call' as const, toolCallId: `call-${n}`, toolName: 'lookup', input },
            {
              type: 'finish' as const,
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'response-metadata' as const, id: `r-${n}`, modelId: 'actor', timestamp: new Date() },
          { type: 'text-start' as const, id: 't' },
          { type: 'text-delta' as const, id: 't', delta: 'Order 4471 has shipped.' },
          { type: 'text-end' as const, id: 't' },
          {
            type: 'finish' as const,
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
  return { model, prompts };
}

const lookup = createTool({
  id: 'lookup',
  description: 'Look up an order',
  inputSchema: z.object({ orderId: z.string() }),
  execute: async ({ orderId }) => ({ orderId, status: `${RESULT_MARKER}-${orderId}`, log: filler }),
});

function createAgent(toolSteps: number) {
  const observerCalls = { count: 0 };
  const memory = new Memory({
    storage: new InMemoryStore(),
    options: {
      observationalMemory: {
        enabled: true,
        observation: {
          model: observerModel(observerCalls) as any,
          messageTokens: 1000,
          bufferTokens: false,
        },
        reflection: { model: observerModel({ count: 0 }) as any, observationTokens: 100_000 },
      },
    },
  });
  const actor = actorModel(toolSteps);
  const agent = new Agent({
    id: 'inflight-agent',
    name: 'inflight-agent',
    instructions: 'Use the lookup tool.',
    model: actor.model as any,
    tools: { lookup },
    memory,
  });
  return { agent, prompts: actor.prompts, observerCalls };
}

function promptText(prompt: unknown): string {
  return JSON.stringify(prompt);
}

describe('OM preserves the in-flight turn across mid-turn observation (#25372)', () => {
  it('keeps the user message and the unread tool result in the next step prompt', async () => {
    const { agent, prompts } = createAgent(1);

    const stream = await agent.stream(USER_REQUEST, {
      memory: { thread: 'inflight-1', resource: 'r' },
    });
    expect(await stream.text).toContain('shipped');
    expect(prompts).toHaveLength(2);

    // Observation fired between step 0 and step 1 (the tool result crossed the threshold).
    const step1 = promptText(prompts[1]);
    expect(step1).toContain('User asked to look up an order status');

    // The model is about to answer the request using the tool result — both must be visible.
    expect(step1).toContain('USER_REQUEST_MARKER');
    expect(step1).toContain(`${RESULT_MARKER}-4471-0`);
  });

  it('keeps the user message and the newest tool result on every later step', async () => {
    const { agent, prompts, observerCalls } = createAgent(3);

    const stream = await agent.stream(USER_REQUEST, {
      memory: { thread: 'inflight-3', resource: 'r' },
    });
    expect(await stream.text).toContain('shipped');
    expect(prompts).toHaveLength(4);

    for (let step = 1; step < prompts.length; step++) {
      const text = promptText(prompts[step]);
      expect(text, `step ${step} lost the user request`).toContain('USER_REQUEST_MARKER');
      expect(text, `step ${step} lost the unread tool result`).toContain(`${RESULT_MARKER}-4471-${step - 1}`);
    }

    // Mid-turn compaction still works: results the model already read are retired once observed,
    // and the preserved messages do not make every step re-run the Observer.
    const last = promptText(prompts[3]);
    expect(last).not.toContain(`${RESULT_MARKER}-4471-0`);
    expect(last).not.toContain(`${RESULT_MARKER}-4471-1`);
    expect(observerCalls.count).toBe(3);
  });
});

describe('tool result merged in place into an already-drained message', () => {
  it('keeps the merged result in the live prompt when the next step observes', async () => {
    const threadId = 'thread-merged-result';
    const resourceId = 'resource-merged-result';
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    await storage.saveThread({
      thread: { id: threadId, resourceId, title: 'thread', createdAt: new Date(), updatedAt: new Date() },
    });
    const observerCalls = { count: 0 };
    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: { model: observerModel(observerCalls) as any, messageTokens: 1000, bufferTokens: false },
      reflection: { model: observerModel({ count: 0 }) as any, observationTokens: 100_000 },
    });

    const t0 = Date.now() - 60_000;
    const user = {
      id: 'user-1',
      role: 'user',
      content: { format: 2, parts: [{ type: 'text', text: USER_REQUEST }] },
      createdAt: new Date(t0),
      threadId,
      resourceId,
    } as MastraDBMessage;
    // Step 0 output: some reasoning text and a tool call whose result has not arrived yet.
    const assistant = {
      id: 'assistant-1',
      role: 'assistant',
      content: {
        format: 2,
        parts: [
          { type: 'text', text: filler },
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'call', toolCallId: 'call-merged', toolName: 'lookup', args: {} },
          },
        ],
      },
      createdAt: new Date(t0 + 1000),
      threadId,
      resourceId,
    } as MastraDBMessage;

    const messageList = new MessageList({ threadId, resourceId });
    messageList.add(user, 'input');
    messageList.add(assistant, 'response');

    const turn = om.beginTurn({ threadId, resourceId, messageList });
    await turn.start();
    await turn.step(0).prepare();
    // Step 1 drains and observes the call; the model has read the call, not a result.
    await turn.step(1).prepare();
    const callsAfterStep1 = observerCalls.count;

    // The tool result is merged into the existing tool-invocation part: same message, same part count.
    const merged = messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'result',
        toolCallId: 'call-merged',
        toolName: 'lookup',
        args: {},
        result: { status: `${RESULT_MARKER}-merged`, log: filler },
      },
    });
    expect(merged).toBe(true);

    await turn.step(2).prepare();

    expect(observerCalls.count).toBeGreaterThan(callsAfterStep1);
    expect(
      JSON.stringify(messageList.get.all.db()),
      'the merged tool result was removed before the model read it',
    ).toContain(`${RESULT_MARKER}-merged`);
  });
});

describe('background task result merged over its placeholder', () => {
  it('keeps the real result in the live prompt when the next step observes', async () => {
    const threadId = 'thread-bg-placeholder';
    const resourceId = 'resource-bg-placeholder';
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    await storage.saveThread({
      thread: { id: threadId, resourceId, title: 'thread', createdAt: new Date(), updatedAt: new Date() },
    });
    const observerCalls = { count: 0 };
    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: { model: observerModel(observerCalls) as any, messageTokens: 1000, bufferTokens: false },
      reflection: { model: observerModel({ count: 0 }) as any, observationTokens: 100_000 },
    });

    const t0 = Date.now() - 60_000;
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add(
      {
        id: 'user-1',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: USER_REQUEST }] },
        createdAt: new Date(t0),
        threadId,
        resourceId,
      } as MastraDBMessage,
      'input',
    );
    // A background tool dispatch: the tool part is already `result`, holding the placeholder.
    messageList.add(
      {
        id: 'assistant-1',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            { type: 'text', text: filler },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call-bg',
                toolName: 'lookup',
                args: {},
                result: 'Background task started. The result will be delivered when it completes.',
              },
            },
          ],
        },
        createdAt: new Date(t0 + 1000),
        threadId,
        resourceId,
      } as MastraDBMessage,
      'response',
    );

    const turn = om.beginTurn({ threadId, resourceId, messageList });
    await turn.start();
    await turn.step(0).prepare();
    // Step 1 drains and observes the placeholder; the model has read only the placeholder.
    await turn.step(1).prepare();
    const callsAfterStep1 = observerCalls.count;

    // The background task finishes: the real result replaces the placeholder in place, as
    // background-task-result-core does. Same message, same part, state stays `result`.
    const merged = messageList.updateToolInvocation(
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'call-bg',
          toolName: 'lookup',
          args: {},
          result: { status: `${RESULT_MARKER}-bg`, log: filler },
        },
        providerMetadata: {
          mastra: { modelOutput: null, backgroundTask: { taskId: 'task-bg', status: 'completed' } },
        },
      },
      {
        mode: 'stream',
        backgroundTasks: { 'call-bg': { startedAt: new Date(t0), completedAt: new Date(), taskId: 'task-bg' } },
      },
    );
    expect(merged).toBe(true);
    // More output in a second response message pushes step 2 over the threshold again.
    messageList.add(
      {
        id: 'assistant-2',
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: filler }] },
        createdAt: new Date(t0 + 2000),
        threadId,
        resourceId,
      } as MastraDBMessage,
      'response',
    );

    await turn.step(2).prepare();

    expect(observerCalls.count).toBeGreaterThan(callsAfterStep1);
    expect(
      JSON.stringify(messageList.get.all.db()),
      'the background task result was removed before the model read it',
    ).toContain(`${RESULT_MARKER}-bg`);
  });
});

describe('drained output whose save failed', () => {
  it('still treats the output as unread when the next step retries the save', async () => {
    const threadId = 'thread-failed-save';
    const resourceId = 'resource-failed-save';
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    await storage.saveThread({
      thread: { id: threadId, resourceId, title: 'thread', createdAt: new Date(), updatedAt: new Date() },
    });
    const observerCalls = { count: 0 };
    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: { model: observerModel(observerCalls) as any, messageTokens: 1000, bufferTokens: false },
      reflection: { model: observerModel({ count: 0 }) as any, observationTokens: 100_000 },
    });

    const t0 = Date.now() - 60_000;
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add(
      {
        id: 'user-1',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: USER_REQUEST }] },
        createdAt: new Date(t0),
        threadId,
        resourceId,
      } as MastraDBMessage,
      'input',
    );

    const turn = om.beginTurn({ threadId, resourceId, messageList });
    await turn.start();
    await turn.step(0).prepare();

    // Step 0 output: a finished tool call the model has not read yet.
    messageList.add(
      {
        id: 'assistant-1',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call-failed-save',
                toolName: 'lookup',
                args: {},
                result: { status: `${RESULT_MARKER}-failed-save`, log: filler },
              },
            },
          ],
        },
        createdAt: new Date(t0 + 1000),
        threadId,
        resourceId,
      } as MastraDBMessage,
      'response',
    );

    const saveSpy = vi.spyOn(storage, 'saveMessages').mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(turn.step(1).prepare()).rejects.toThrow('storage unavailable');
    saveSpy.mockRestore();

    // The retry saves and observes; the result is still unread, so it must stay in the prompt.
    await turn.step(2).prepare();

    expect(observerCalls.count).toBeGreaterThan(0);
    expect(
      JSON.stringify(messageList.get.all.db()),
      'the tool result was removed after a failed save marked it as read',
    ).toContain(`${RESULT_MARKER}-failed-save`);
  });
});
