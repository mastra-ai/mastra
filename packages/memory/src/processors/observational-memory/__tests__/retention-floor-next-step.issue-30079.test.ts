import { MockLanguageModelV3, simulateReadableStream } from '@internal/ai-v6/test';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';

// Issue #30079: after a mid-turn buffered activation, cleanup keeps an activated message as raw
// context to honour the retention floor. The per-step filter on the next step must keep it too.

const MESSAGE_TOKENS = 9500; // floor = 9500 * (1 - default bufferActivation 0.8) = 1900
const TOOL_CALLS = 13;
const SHORT_FROM = 12;

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
const streamOf = (chunks: any[]) => ({
  stream: simulateReadableStream({ chunks: [{ type: 'stream-start', warnings: [] }, ...chunks] }),
});
const finish = (reason: string) => ({ type: 'finish', finishReason: { unified: reason, raw: reason }, usage });
const textStream = (text: string) =>
  streamOf([
    { type: 'text-start', id: 't' },
    { type: 'text-delta', id: 't', delta: text },
    { type: 'text-end', id: 't' },
    finish('stop'),
  ]);

async function runLookups(observation: Record<string, unknown>, toolCalls = TOOL_CALLS, shortFrom = SHORT_FROM) {
  let observerCalls = 0;
  const observerText = () => `<observations>\nDate: Nov 11, 2026\n* 🟡 (10:00) Agent ran a lookup.\n</observations>`;
  const observer = new MockLanguageModelV3({
    doStream: async () => {
      observerCalls++;
      return textStream(observerText()) as any;
    },
    doGenerate: async () => {
      observerCalls++;
      return {
        content: [{ type: 'text', text: observerText() }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage,
        warnings: [],
      } as any;
    },
  });

  const requests: { results: number[]; observerCalls: number }[] = [];
  const actor = new MockLanguageModelV3({
    doStream: async ({ prompt }) => {
      const step = requests.length;
      const rawText = JSON.stringify(prompt.filter(m => m.role !== 'system'));
      requests.push({
        results: [...new Set([...rawText.matchAll(/RESULT-(\d+)/g)].map(m => Number(m[1])))],
        observerCalls,
      });
      if (step < toolCalls) {
        return streamOf([
          {
            type: 'tool-call',
            toolCallId: `call-${step + 1}`,
            toolName: 'lookup',
            input: JSON.stringify({ n: step + 1 }),
          },
          finish('tool-calls'),
        ]) as any;
      }
      return textStream('done') as any;
    },
  });

  const filler = 'alpha bravo charlie delta echo foxtrot golf hotel '.repeat(90);
  const lookup = createTool({
    id: 'lookup',
    description: 'Look up item n.',
    inputSchema: z.object({ n: z.number() }),
    execute: async ({ n }) => {
      // Let the fire-and-forget buffer call store its chunk before the next step.
      await new Promise(resolve => setTimeout(resolve, 300));
      return n >= shortFrom ? `RESULT-${n} ok` : `RESULT-${n} ${filler}`;
    },
  });

  const memory = new Memory({
    storage: new InMemoryStore(),
    options: { observationalMemory: { model: observer as any, observation } },
  });
  const agent = new Agent({
    id: 'issue-30079',
    name: 'issue-30079',
    instructions: 'Look up the items the user asks for.',
    model: actor as any,
    tools: { lookup },
    memory,
  });

  const output = await agent.stream('USER-REQUEST: look up the items one by one.', {
    memory: { thread: 'thread-1', resource: 'resource-1' },
    maxSteps: toolCalls + 2,
  });
  const activatedBeforeRequest = new Set<number>();
  for await (const chunk of output.fullStream as any) {
    if (chunk.type === 'data-om-activation') activatedBeforeRequest.add(requests.length);
  }
  await (memory as any).settled?.();

  return { requests, activatedBeforeRequest };
}

describe('retention floor after a mid-turn activation (#30079)', () => {
  it.each([
    { activations: 1, toolCalls: TOOL_CALLS, shortFrom: SHORT_FROM },
    { activations: 2, toolCalls: 22, shortFrom: 21 },
  ])(
    'keeps the floor-retained tail after $activations mid-turn activation(s)',
    async ({ activations, toolCalls, shortFrom }) => {
      const { requests, activatedBeforeRequest } = await runLookups(
        { messageTokens: MESSAGE_TOKENS },
        toolCalls,
        shortFrom,
      );

      expect(activatedBeforeRequest.size).toBeGreaterThanOrEqual(activations);

      // Between two model calls with no activation and no observer call, nothing the model already
      // saw may leave the prompt: the retention floor that cleanup honoured must still hold.
      for (let i = 1; i < requests.length; i++) {
        const prev = requests[i - 1]!;
        const cur = requests[i]!;
        if (activatedBeforeRequest.has(i) || cur.observerCalls !== prev.observerCalls) continue;
        const dropped = prev.results.filter(n => !cur.results.includes(n));
        expect({ request: i, dropped }).toEqual({ request: i, dropped: [] });
      }
    },
    60_000,
  );

  it('still drops observed messages the model already read when there is no floor', async () => {
    const { requests } = await runLookups({ messageTokens: 3_000, bufferTokens: false });
    // The request that observed kept its newest tool result only because the model had not read it
    // yet. Once read, it leaves the prompt on the next call like the rest of the observed messages.
    const observedAt = requests.findIndex((r, i) => i > 0 && r.observerCalls > requests[i - 1]!.observerCalls);
    expect(observedAt).toBeGreaterThan(0);
    expect(observedAt).toBeLessThan(requests.length - 1);
    const readInFlight = Math.max(...requests[observedAt]!.results);
    expect(requests[observedAt + 1]!.results).not.toContain(readInFlight);
  }, 60_000);
});
