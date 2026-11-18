/**
 * #29692: `DurableAgent.observe()` must be able to terminate when the observed
 * run suspends.
 *
 * A run that suspends (e.g. for tool approval) publishes a SUSPENDED event but
 * no terminal FINISH. By default `observe()` keeps the observer's stream open
 * across that suspension so a later resume can continue on the same reader, so
 * an observer that attaches to an already-suspended run — a reconnecting
 * client, or another replica — hangs forever. Passing `closeOnSuspend: true`
 * ends the observed stream at the suspension boundary so
 * `fullStream`/`text`/`getFullOutput()` resolve, while keeping the run's
 * registry entry and replay history so it can still be resumed.
 *
 * The observer attaches *after* the run has suspended, so it replays the run's
 * cached log (CachingPubSub + InMemoryServerCache) — the same path a
 * cross-process observer takes. Every read is bounded by a Promise.race guard
 * so a regression that reintroduces the hang fails fast instead of stalling.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function drain(stream: ReadableStream<any>) {
  const chunks: any[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

/**
 * Read `stream` to completion, but never wait longer than `ms`. A `'timeout'`
 * outcome means the stream hung — the anti-hang guard that turns the #29692
 * regression into a hard failure instead of a stuck test.
 */
async function collectWithin(stream: ReadableStream<any>, ms: number) {
  const chunks: any[] = [];
  let outcome: 'done' | 'timeout' = 'timeout';
  const reading = (async () => {
    for await (const chunk of stream) chunks.push(chunk);
    outcome = 'done';
  })();
  void reading.catch(() => {});
  await Promise.race([reading, delay(ms)]);
  return { outcome, chunks };
}

/**
 * Calls `searchTool` until the model sees its tool result, then answers with
 * text — so the same model drives both the initial (suspending) run and the
 * post-approval resume.
 */
function createApprovalModel() {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const hasResult = JSON.stringify(prompt).includes('"type":"tool-result"');
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream<any>([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'm', modelId: 'mock-model', timestamp: new Date(0) },
          ...(hasResult
            ? [
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'approved and done' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: 'stop', usage },
              ]
            : [
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'tc-1',
                  toolName: 'searchTool',
                  input: JSON.stringify({ query: 'test' }),
                },
                { type: 'finish', finishReason: 'tool-calls', usage },
              ]),
        ]),
      };
    },
  });
}

describe('DurableAgent.observe() closeOnSuspend (#29692)', () => {
  let innerPubsub: EventEmitterPubSub;
  let pubsub: CachingPubSub;
  let durableAgent: ReturnType<typeof createDurableAgent>;
  let producer: { runId: string; cleanup: () => void } | undefined;

  beforeEach(() => {
    innerPubsub = new EventEmitterPubSub();
    pubsub = new CachingPubSub(innerPubsub, new InMemoryServerCache());
    const agent = new Agent({
      id: 'observe-close-on-suspend-agent',
      name: 'Observe Close On Suspend Agent',
      instructions: 'Search for information when asked.',
      model: createApprovalModel() as LanguageModelV2,
      tools: {
        searchTool: createTool({
          id: 'searchTool',
          description: 'Search for information',
          inputSchema: z.object({ query: z.string() }),
          requireApproval: true,
          execute: async () => ({ results: ['result1'] }),
        }),
      },
    });
    // A long cleanup timeout keeps the suspended run's registry entry and
    // replay log alive while the observer attaches and the run is resumed.
    durableAgent = createDurableAgent({ agent, pubsub, cleanupTimeoutMs: 60_000 });
    new Mastra({
      agents: { 'observe-close-on-suspend-agent': durableAgent },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });
  });

  afterEach(async () => {
    producer?.cleanup();
    producer = undefined;
    globalRunRegistry.clear();
    await innerPubsub.close();
  });

  /** Drive a run to its approval gate and let the producer stream end there. */
  async function suspendRun() {
    const stream = await durableAgent.stream('Search for test', { maxSteps: 3, closeOnSuspend: true });
    producer = { runId: stream.runId, cleanup: stream.cleanup };
    const { outcome } = await collectWithin(stream.fullStream, 5_000);
    expect(outcome).toBe('done');
    return stream.runId;
  }

  it('ends the observed stream at the suspension boundary when closeOnSuspend is true', async () => {
    const runId = await suspendRun();

    const observed = await durableAgent.observe(runId, { closeOnSuspend: true });
    const { outcome, chunks } = await collectWithin(observed.fullStream, 2_000);

    expect(outcome).toBe('done');
    expect(chunks.some(chunk => chunk.type === 'tool-call-approval')).toBe(true);
    observed.detach();
  }, 30_000);

  it('keeps the observed stream open by default so a resume can continue on it', async () => {
    const runId = await suspendRun();

    const observed = await durableAgent.observe(runId);
    const { outcome, chunks } = await collectWithin(observed.fullStream, 500);

    expect(outcome).toBe('timeout');
    expect(chunks.some(chunk => chunk.type === 'tool-call-approval')).toBe(true);
    expect(chunks.some(chunk => chunk.type === 'finish')).toBe(false);
    observed.detach();
  }, 30_000);

  it('leaves the run resumable after the observer closes', async () => {
    const runId = await suspendRun();

    const observed = await durableAgent.observe(runId, { closeOnSuspend: true });
    const closed = await collectWithin(observed.fullStream, 2_000);
    expect(closed.outcome).toBe('done');
    observed.detach();

    const resumed = await durableAgent.resume(runId, { approved: true }, { toolCallId: 'tc-1', maxSteps: 3 });
    const resumedRun = await collectWithin(resumed.fullStream, 2_000);

    expect(resumedRun.outcome).toBe('done');
    expect(
      resumedRun.chunks.some(chunk => chunk.type === 'text-delta' && chunk.payload?.text === 'approved and done'),
    ).toBe(true);
    resumed.cleanup();
  }, 30_000);
});
