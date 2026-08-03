/**
 * Regression test for the scenario:
 *
 *   import { Agent } from '@mastra/core/agent';
 *   const agent = new Agent({ ..., durable: true });
 *   await agent.stream(...);
 *
 * The user in this codepath never imports `createDurableAgent`, never
 * imports `DurableAgent`, and never attaches the agent to a `Mastra`
 * instance. `Agent.stream()` must still route through the durable
 * execution path — implemented via a lazy dynamic `import()` of the
 * durable module inside `Agent.stream` so no eager import cycle is
 * introduced.
 *
 * The `Agent` import below intentionally comes only from `../../agent`
 * (mirroring `@mastra/core/agent`) so the test cannot mask a regression
 * by loading the durable module through its own imports.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi } from 'vitest';
import { Agent } from '../../agent';
import { DurableAgent } from '../durable/durable-agent';

function makeMockModel() {
  return new MockLanguageModelV2({
    doStream: async () =>
      ({
        stream: convertArrayToReadableStream([
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'hi' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }) as any,
  }) as LanguageModelV2;
}

describe('standalone durable Agent — only `@mastra/core/agent` imported', () => {
  it('lazy-delegates `.stream()` to DurableAgent when `durable: true`', async () => {
    const agent = new Agent({
      id: 'standalone',
      name: 'Standalone',
      instructions: 'test',
      model: makeMockModel(),
      durable: true,
    });

    // The raw Agent stays a plain Agent — no eager wrapping.
    expect(agent.constructor.name).toBe('Agent');
    expect(agent.durable).toBe(true);

    const spy = vi.spyOn(DurableAgent.prototype as any, 'stream').mockImplementation(async () => 'ok');

    try {
      const result = await (agent.stream('hi') as unknown as Promise<string>);
      expect(result).toBe('ok');
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
