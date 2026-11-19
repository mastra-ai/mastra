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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../../streams/constants';
import type { AgentStreamEvent } from '../../streams/types';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';
import { createDurableAgentStream } from '../stream-adapter';
import type { DurableAgentStreamResult } from '../stream-adapter';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

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

/** Read `stream` in the background so a test can act on the run while it streams. */
function startCollecting(stream: ReadableStream<any>) {
  const chunks: any[] = [];
  const done = (async () => {
    for await (const chunk of stream) chunks.push(chunk);
  })();
  void done.catch(() => {});
  return { chunks, done };
}

/** Resolve once `chunks` holds a chunk of `type`, so nothing depends on a fixed sleep. */
async function waitForChunk(chunks: any[], type: string, ms = 5_000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const found = chunks.find(chunk => chunk.type === type);
    if (found) return found;
    await delay(10);
  }
  throw new Error(`timed out waiting for a "${type}" chunk`);
}

/** `true` when `p` settles within `ms`, `false` while it is still pending. */
function settledWithin(p: Promise<unknown>, ms: number) {
  return Promise.race([
    p.then(
      () => true,
      () => true,
    ),
    delay(ms).then(() => false),
  ]);
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

  it('keeps the observed stream open by default so a resume continues on it', async () => {
    const runId = await suspendRun();

    const observed = await durableAgent.observe(runId);
    const reader = startCollecting(observed.fullStream);

    await waitForChunk(reader.chunks, 'tool-call-approval');
    // Still open at the suspension boundary, with no terminal frame yet...
    expect(await settledWithin(reader.done, 300)).toBe(false);
    expect(reader.chunks.some(chunk => chunk.type === 'finish')).toBe(false);

    // ...and the resume streams the rest of the run to that same reader.
    const resumed = await durableAgent.resume(runId, { approved: true }, { toolCallId: 'tc-1', maxSteps: 3 });
    expect(await settledWithin(reader.done, 5_000)).toBe(true);
    expect(
      reader.chunks.some(chunk => chunk.type === 'text-delta' && chunk.payload?.text === 'approved and done'),
    ).toBe(true);
    expect(reader.chunks.some(chunk => chunk.type === 'finish')).toBe(true);

    resumed.cleanup();
    observed.detach();
  }, 30_000);

  it('does not close on a suspension the run has already been approved past', async () => {
    const runId = await suspendRun();

    // Approve the gate and let the run finish, so the log now holds that
    // suspension followed by the output the resume produced. The stream keeps its
    // run log until cleanup(), which is what the observer below reads.
    const resumed = await durableAgent.resume(runId, { approved: true }, { toolCallId: 'tc-1', maxSteps: 3 });
    expect((await collectWithin(resumed.fullStream, 5_000)).outcome).toBe('done');

    // A reader replaying the run from its start must not stop at a suspension
    // the run has moved past: it is no longer where the run is parked.
    const onSuspended = vi.fn();
    const observed = await durableAgent.observe(runId, { closeOnSuspend: true, onSuspended });
    const { outcome, chunks } = await collectWithin(observed.fullStream, 2_000);

    expect(outcome).toBe('done');
    expect(chunks.some(chunk => chunk.type === 'text-delta' && chunk.payload?.text === 'approved and done')).toBe(true);
    // The past suspension is still delivered, as it is to a default observer; it just does not close the stream.
    expect(onSuspended).toHaveBeenCalledTimes(1);
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

describe('createDurableAgentStream attachedAtLogIndex', () => {
  // Plain EventEmitterPubSub passes `index` through, so each case controls the
  // log position directly, including a log that restarts numbering at 0.
  const open = (runId: string, attachedAt: number) => {
    const pubsub = new EventEmitterPubSub();
    const onSuspended = vi.fn();
    const stream = createDurableAgentStream({
      pubsub,
      runId,
      messageId: `msg-${runId}`,
      model: { modelId: 'test', provider: 'test', version: 'v3' },
      closeOnSuspend: true,
      attachedAtLogIndex: () => attachedAt,
      onSuspended,
    }) as DurableAgentStreamResult<any>;
    let closed = false;
    const done = (async () => {
      for await (const _chunk of stream.output.fullStream) {
        // drain
      }
      closed = true;
    })();
    const publish = (type: AgentStreamEvent['type'], index: number) =>
      pubsub.publish(AGENT_STREAM_TOPIC(runId), {
        type,
        runId,
        data:
          type === AgentStreamEventTypes.SUSPENDED
            ? { type: 'suspension' }
            : { type: 'text-delta', payload: { id: 't', text: 'x' } },
        index,
      } as any);
    return { stream, onSuspended, done, publish, isClosed: () => closed };
  };

  it('delivers a suspension below the attach point without closing, then closes on the current one', async () => {
    const reader = open('past-suspension', 2);
    await reader.stream.ready;
    await reader.publish(AgentStreamEventTypes.SUSPENDED, 0);
    await delay(20);
    expect(reader.onSuspended).toHaveBeenCalledTimes(1);
    expect(reader.isClosed()).toBe(false);

    await reader.publish(AgentStreamEventTypes.SUSPENDED, 3);
    await reader.done;
    expect(reader.onSuspended).toHaveBeenCalledTimes(2);
    expect(reader.isClosed()).toBe(true);
  });

  it('closes on a suspension from a log that restarted numbering at 0', async () => {
    const reader = open('restarted-log', 2);
    await reader.stream.ready;
    await reader.publish(AgentStreamEventTypes.CHUNK, 2);
    await reader.publish(AgentStreamEventTypes.CHUNK, 0);
    await reader.publish(AgentStreamEventTypes.SUSPENDED, 1);
    await reader.done;
    expect(reader.isClosed()).toBe(true);
  });
});
