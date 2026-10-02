/**
 * Repro for #25372: during a single agent turn, a tool loop pushes Observational Memory past
 * its observation threshold, and the cleanup that follows removes the user's message from the
 * prompt for the rest of the turn. Step 0 protects the in-flight input by id; later steps of
 * the same turn do not.
 *
 * Real Agent + Memory + InMemoryStore with OM defaults (threshold scaled down). The actor is a
 * mock that calls a search tool SEARCHES times before answering and records, on every step,
 * whether the question is still among the user messages it was given.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Memory } from '../../../index';

const QUESTION = 'How much total delay have I noted across the three subsystems?';
const SEARCHES = 8;

function observer(calls: { n: number }) {
  const text = '<observations>\n## Today\n- 🔴 User asked about total delay\n</observations>';
  return new MockLanguageModelV2({
    doGenerate: async () =>
      (calls.n++,
      {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content: [{ type: 'text', text }],
        warnings: [],
      }) as any,
    doStream: async () => (
      calls.n++,
      {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'obs', modelId: 'mock-observer', timestamp: new Date() },
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: text },
          { type: 'text-end', id: 't' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }
    ),
  });
}

/** Calls the search tool SEARCHES times, then answers; records whether the question is in each prompt. */
function actor(seen: boolean[]) {
  const record = (prompt: any[]) => {
    seen.push(JSON.stringify(prompt.filter(m => m.role === 'user')).includes(QUESTION));
    return seen.length - 1;
  };
  return new MockLanguageModelV2({
    doGenerate: async ({ prompt }) => {
      const step = record(prompt as any[]);
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        finishReason: step < SEARCHES ? 'tool-calls' : 'stop',
        content:
          step < SEARCHES
            ? [
                {
                  type: 'tool-call',
                  toolCallId: `c${step}`,
                  toolName: 'search',
                  input: JSON.stringify({ q: `query ${step}` }),
                },
              ]
            : [{ type: 'text', text: 'The total is 1,050 ms.' }],
      } as any;
    },
    doStream: async ({ prompt }) => {
      const step = record(prompt as any[]);
      const parts =
        step < SEARCHES
          ? [
              { type: 'tool-input-start', id: `c${step}`, toolName: 'search' },
              { type: 'tool-input-delta', id: `c${step}`, delta: JSON.stringify({ q: `query ${step}` }) },
              { type: 'tool-input-end', id: `c${step}` },
            ]
          : [
              { type: 'text-start', id: 'a' },
              { type: 'text-delta', id: 'a', delta: 'The total is 1,050 ms.' },
              { type: 'text-end', id: 'a' },
            ];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `r${step}`, modelId: 'mock-actor', timestamp: new Date() },
          ...parts,
          {
            type: 'finish',
            finishReason: step < SEARCHES ? 'tool-calls' : 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          },
        ] as any),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

// Each search returns ~500 tokens, a fifth of the threshold per step, so the turn crosses it at step 7.
const search = createTool({
  id: 'search',
  description: 'search memory',
  inputSchema: z.object({ q: z.string() }),
  execute: async ({ q }) => ({ results: `${q}: ` + 'observation text '.repeat(120) }),
});

describe('OM keeps the question across a tool loop', () => {
  for (const mode of ['default (async buffering)', 'sync only'] as const) {
    it(`question stays in every prompt of the turn — ${mode}`, async () => {
      const observerCalls = { n: 0 };
      const memory = new Memory({
        storage: new InMemoryStore(),
        options: {
          observationalMemory: {
            observation: {
              model: observer(observerCalls) as any,
              messageTokens: 2500,
              ...(mode === 'sync only' ? { bufferTokens: false } : {}),
            },
            reflection: { model: observer({ n: 0 }) as any, observationTokens: 100_000 },
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
        tools: { search },
      });
      await agent.generate(QUESTION, { memory: { thread: `thread-${mode}`, resource: `user-${mode}` }, maxSteps: 20 });
      console.log(`${mode}: question present per step = ${JSON.stringify(seen)}`);
      expect(seen.length).toBe(SEARCHES + 1);
      // The turn must actually cross the threshold, or the check below proves nothing.
      expect(observerCalls.n).toBeGreaterThan(0);
      expect(seen.every(Boolean)).toBe(true);
    });
  }
});
