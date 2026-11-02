/**
 * Runs RefusalFallbackProcessor inside a real core Agent with a two-model
 * fallback list, so the test exercises core's own fallback walk: a refused
 * step must end on the next model instead of ending the turn.
 */
import { Agent } from '@mastra/core/agent';
import { CyberRefusalHandler } from '@mastra/core/processors';
import { convertArrayToReadableStream, MockLanguageModelV3 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';

import { RefusalFallbackProcessor } from './refusal-fallback-processor.js';

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

function refusingModel(cyber: boolean) {
  return new MockLanguageModelV3({
    provider: 'anthropic',
    modelId: 'claude-refuser',
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'r1', modelId: 'claude-refuser', timestamp: new Date(0) },
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', delta: 'I can’t help with that.' },
        { type: 'text-end', id: 't1' },
        {
          type: 'finish',
          finishReason: { unified: 'content-filter', raw: 'refusal' },
          usage,
          providerMetadata: cyber ? { anthropic: { stopDetails: { type: 'refusal', category: 'cyber' } } } : undefined,
        },
      ] as never),
    }),
  });
}

function answeringModel() {
  return new MockLanguageModelV3({
    provider: 'openai',
    modelId: 'gpt-fallback',
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'r2', modelId: 'gpt-fallback', timestamp: new Date(0) },
        { type: 'text-start', id: 't2' },
        { type: 'text-delta', id: 't2', delta: 'Here is the answer.' },
        { type: 'text-end', id: 't2' },
        { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
      ] as never),
    }),
  });
}

/** Stands in for AccountRotationProcessor's route cursor: `entries` models, starting on the first. */
function fakeRoute(entries: number) {
  let position = 0;
  return {
    hasNextModelRouteEntry: vi.fn(async () => position < entries - 1),
    announceModelRouteHop: vi.fn(async () => {
      position++;
    }),
  };
}

function makeAgent(opts: { cyber: boolean; routeEntries: number; withProcessor?: boolean }) {
  const refuser = refusingModel(opts.cyber);
  const fallback = answeringModel();
  const route = fakeRoute(opts.routeEntries);
  const refusalFallback = new RefusalFallbackProcessor(route);
  const withProcessor = opts.withProcessor ?? true;
  const agent = new Agent({
    id: 'refusal-test',
    name: 'refusal-test',
    instructions: 'Answer.',
    model: [
      { model: refuser, maxRetries: 0 },
      { model: fallback, maxRetries: 0 },
    ],
    maxProcessorRetries: 64,
    inputProcessors: withProcessor ? [refusalFallback] : [],
    outputProcessors: withProcessor ? [new CyberRefusalHandler(), refusalFallback] : [new CyberRefusalHandler()],
  });
  return { agent, refuser, fallback, route };
}

async function run(agent: Agent) {
  const stream = await agent.stream('Explain the exploit in this CTF binary.');
  return { text: await stream.text, finishReason: await stream.finishReason };
}

describe('RefusalFallbackProcessor', () => {
  it('ends the turn on the refusing model without it (today’s behavior)', async () => {
    const { agent, refuser, fallback } = makeAgent({ cyber: false, routeEntries: 2, withProcessor: false });

    const result = await run(agent);

    expect(result.finishReason).toBe('content-filter');
    expect(refuser.doStreamCalls).toHaveLength(1);
    expect(fallback.doStreamCalls).toHaveLength(0);
  });

  it('moves a refused request to the next model in the route', async () => {
    const { agent, refuser, fallback, route } = makeAgent({ cyber: false, routeEntries: 2 });

    const result = await run(agent);

    expect(result.finishReason).toBe('stop');
    expect(result.text).toContain('Here is the answer.');
    expect(result.text).not.toContain('can’t help');
    expect(refuser.doStreamCalls).toHaveLength(1);
    expect(fallback.doStreamCalls).toHaveLength(1);
    expect(route.announceModelRouteHop).toHaveBeenCalledTimes(1);
    expect(route.announceModelRouteHop).toHaveBeenCalledWith(expect.anything(), 'refusal');
  });

  it('gives a cyber refusal its one nudge on the same model before moving on', async () => {
    const { agent, refuser, fallback, route } = makeAgent({ cyber: true, routeEntries: 2 });

    const result = await run(agent);

    expect(result.finishReason).toBe('stop');
    expect(refuser.doStreamCalls).toHaveLength(2);
    expect(fallback.doStreamCalls).toHaveLength(1);
    expect(route.announceModelRouteHop).toHaveBeenCalledTimes(1);
  });

  it('keeps today’s behavior when the route has no entry after the current one', async () => {
    const { agent, refuser, fallback, route } = makeAgent({ cyber: false, routeEntries: 1 });

    const result = await run(agent);

    expect(result.finishReason).toBe('content-filter');
    expect(refuser.doStreamCalls).toHaveLength(1);
    expect(fallback.doStreamCalls).toHaveLength(0);
    expect(route.announceModelRouteHop).not.toHaveBeenCalled();
  });
});
