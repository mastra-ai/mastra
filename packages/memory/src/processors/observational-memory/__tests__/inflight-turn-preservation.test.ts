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
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';

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
