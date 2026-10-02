/**
 * Repro for #25372 from a recorded benchmark answer: a long recall loop pushes the thread past the
 * observation threshold partway through the turn, and the user's question is removed from the
 * prompt for the remaining steps.
 *
 * The fixture holds the 18 recall calls a model made while answering one question, two per step,
 * and the result the recall tool returned for each. A real Agent + Memory + InMemoryStore with OM
 * defaults replays them; only the models are mocks. On every step the actor records whether the
 * question is still among the user messages it was given.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';
import recorded from './fixtures/recorded-recall-loop.json';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const STEPS = Math.ceil(recorded.calls.length / recorded.callsPerStep);

/** Observer stand-in: always writes the observation the real Observer wrote for this turn. */
function observer(calls: { n: number }) {
  const text = `<observations>\n${recorded.observerText}\n</observations>`;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      calls.n++;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage,
        content: [{ type: 'text', text }],
        warnings: [],
      } as any;
    },
    doStream: async () => {
      calls.n++;
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'o' },
          { type: 'text-delta', id: 'o', delta: text },
          { type: 'text-end', id: 'o' },
          { type: 'finish', finishReason: 'stop', usage },
        ] as any),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

/** Replays the recorded recall calls two per step, then answers; records whether the question is in each prompt. */
function actor(seen: boolean[]) {
  const respond = (prompt: unknown[]) => {
    const step = seen.length;
    seen.push(JSON.stringify((prompt as any[]).filter(m => m.role === 'user')).includes(recorded.question));
    const calls = recorded.calls.slice(step * recorded.callsPerStep, (step + 1) * recorded.callsPerStep);
    return {
      step,
      toolCalls: calls.map((call, i) => ({
        type: 'tool-call' as const,
        toolCallId: `c${step}-${i}`,
        toolName: 'recall',
        input: JSON.stringify(call.args),
      })),
    };
  };
  return new MockLanguageModelV2({
    doGenerate: async ({ prompt }) => {
      const { step, toolCalls } = respond(prompt);
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        usage,
        finishReason: step < STEPS ? 'tool-calls' : 'stop',
        content: step < STEPS ? toolCalls : [{ type: 'text', text: 'Here is the order.' }],
      } as any;
    },
    doStream: async ({ prompt }) => {
      const { step, toolCalls } = respond(prompt);
      const parts =
        step < STEPS
          ? toolCalls
          : [
              { type: 'text-start', id: 'a' },
              { type: 'text-delta', id: 'a', delta: 'Here is the order.' },
              { type: 'text-end', id: 'a' },
            ];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          ...parts,
          { type: 'finish', finishReason: step < STEPS ? 'tool-calls' : 'stop', usage },
        ] as any),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

/** Returns the recorded results in call order. */
function recall() {
  let n = 0;
  return createTool({
    id: 'recall',
    description: 'Search memory',
    inputSchema: z.object({}).passthrough(),
    execute: async () => recorded.calls[n++]!.result,
  });
}

describe('OM keeps the question through a recorded recall loop (#25372)', () => {
  for (const mode of ['default (async buffering)', 'sync observation only'] as const) {
    it(`question stays in every prompt of the turn — ${mode}`, async () => {
      const observerCalls = { n: 0 };
      const memory = new Memory({
        storage: new InMemoryStore(),
        options: {
          observationalMemory: {
            model: observer(observerCalls) as any,
            ...(mode === 'sync observation only' ? { observation: { bufferTokens: false } } : {}),
          },
        },
      });
      const seen: boolean[] = [];
      const agent = new Agent({
        id: 'a',
        name: 'a',
        instructions: 'Answer.',
        model: actor(seen) as any,
        memory,
        tools: { recall: recall() },
      });

      await agent.generate(recorded.question, {
        memory: { thread: `t-${mode}`, resource: `r-${mode}` },
        maxSteps: 100,
      });

      expect(seen.length).toBe(STEPS + 1);
      // The turn must cross the threshold, or the check below proves nothing.
      expect(observerCalls.n).toBeGreaterThan(0);
      expect(seen.map((present, step) => (present ? step : `step ${step}: question missing`))).toEqual(
        seen.map((_, step) => step),
      );
    });
  }
});
