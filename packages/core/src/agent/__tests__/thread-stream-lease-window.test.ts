/**
 * Regression test for #26474: after the suspended-run TTL sweep evicts a parked
 * run, the thread lease stays held until it expires. A sendMessage to that
 * thread inside the remaining lease window was acknowledged as
 * `{ action: 'deliver', runId: <swept run> }` — but no run existed to receive
 * it: the model was never called and the message was never persisted.
 *
 * The send must not claim delivery to a run that no longer exists. It returns
 * `blocked` (the thread lease is genuinely held) so the caller can act, and a
 * send after the lease frees wakes a new run as usual.
 *
 * Determinism: the sweep is driven by fake system time (no sleeps), and the
 * LeasePubSub lease provider never expires leases on its own, so the "inside
 * the lease window" state holds exactly until the test releases it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';
import { AGENT_THREAD_KEY_SEPARATOR, LeasePubSub } from './thread-stream-test-utils';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const SUSPENDED_RUN_TTL_MS = 30 * 60 * 1000; // default MASTRA_SUSPENDED_RUN_TTL_MS

/** First call suspends on tool approval; every later call answers in text. */
function parkThenAnswerModel() {
  let calls = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      if (calls === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start' as const, warnings: [] },
            { type: 'response-metadata' as const, id: 'r1', modelId: 'mock', timestamp: new Date(0) },
            { type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'lookup', input: '{"q":"x"}' },
            { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
          ]),
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'response-metadata' as const, id: `r${calls}`, modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start' as const, id: 't' },
          { type: 'text-delta' as const, id: 't', delta: 'ok' },
          { type: 'text-end' as const, id: 't' },
          { type: 'finish' as const, finishReason: 'stop' as const, usage },
        ]),
      };
    },
  });
  return { model, modelCalls: () => calls };
}

describe('thread stream: send inside the post-sweep lease window (#26474)', () => {
  afterEach(() => {
    vi.useRealTimers();
    agentThreadStreamRuntime.resetForTests();
  });

  it('does not acknowledge deliver to a swept run; wakes once the lease frees', async () => {
    const pubsub = new LeasePubSub();
    pubsub.retain = true;
    const { model, modelCalls } = parkThenAnswerModel();
    const agent = new Agent({
      id: 'lease-window-agent',
      name: 'Lease Window Agent',
      instructions: 'test',
      model,
      memory: new MockMemory({ storage: new InMemoryStore() }),
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'l',
          inputSchema: z.object({ q: z.string() }),
          requireApproval: true,
          execute: async () => ({ found: true }),
        }),
      },
    });
    const mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false, pubsub });
    const registered = mastra.getAgent('agent');
    const resourceId = 'user-1';
    const threadId = 'parked';
    const key = `${resourceId}${AGENT_THREAD_KEY_SEPARATOR}${threadId}`;

    // 1. Park a run: it suspends on tool approval and holds the thread lease.
    const output = await registered.stream('start', { memory: { thread: threadId, resource: resourceId } });
    for await (const _chunk of output.fullStream) {
      // drain
    }
    expect(output.status).toBe('suspended');
    const parkedRunId = registered.getActiveThreadRunId({ threadId, resourceId });
    expect(parkedRunId).toBeDefined();
    expect(pubsub.owners.get(key)).toBe(parkedRunId);

    // The runtime stamps the record's suspendedAt when it publishes
    // run-suspended (asynchronously, after the drain). The sweep only evicts
    // stamped records, so wait for the publish before advancing time.
    await vi.waitFor(() =>
      expect(
        pubsub
          .retainedTopics()
          .flatMap(topic => pubsub.retainedEvents(topic))
          .some(event => event.data?.type === 'run-suspended'),
      ).toBe(true),
    );

    // 2. Advance virtual time past the suspended-run TTL and trigger the sweep
    //    by registering a run on another thread.
    vi.useFakeTimers({ shouldAdvanceTime: true, now: Date.now() });
    vi.setSystemTime(Date.now() + SUSPENDED_RUN_TTL_MS + 1);
    const other = await registered.stream('trigger the sweep', {
      memory: { thread: 'other', resource: resourceId },
    });
    for await (const _chunk of other.fullStream) {
      // drain
    }

    // The sweep evicted the parked run but — by design — left its lease.
    expect(registered.getActiveThreadRunId({ threadId, resourceId })).toBeUndefined();
    expect(pubsub.owners.get(key)).toBe(parkedRunId);

    // 3. Send inside the lease window. The run is gone, so `deliver` would be
    //    a lie: nothing receives the message and the model is never called.
    const callsBefore = modelCalls();
    const inWindow = registered.sendMessage('message inside the lease window', { threadId, resourceId });
    const inWindowAccepted = await inWindow.accepted;
    expect(inWindowAccepted.action).toBe('blocked');
    if (inWindowAccepted.action === 'blocked') {
      expect(inWindowAccepted.runId).toBe(parkedRunId);
    }
    expect(modelCalls()).toBe(callsBefore);

    // 4. Once the lease frees (TTL expiry in production; explicit release in
    //    this deterministic harness), a send wakes a new run.
    pubsub.owners.delete(key);
    const after = registered.sendMessage('message after the lease expired', { threadId, resourceId });
    const afterAccepted = await after.accepted;
    expect(afterAccepted.action).toBe('wake');
    if (afterAccepted.action === 'wake' && afterAccepted.output) {
      for await (const _chunk of afterAccepted.output.fullStream) {
        // drain
      }
    }
    expect(modelCalls()).toBe(callsBefore + 1);
  }, 30000);

  it('keeps the swept-run marker alive when an in-flight renewal extends the lease', async () => {
    const pubsub = new LeasePubSub();
    pubsub.retain = true;
    const { model, modelCalls } = parkThenAnswerModel();
    const agent = new Agent({
      id: 'lease-renewal-agent',
      name: 'Lease Renewal Agent',
      instructions: 'test',
      model,
      memory: new MockMemory({ storage: new InMemoryStore() }),
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'l',
          inputSchema: z.object({ q: z.string() }),
          requireApproval: true,
          execute: async () => ({ found: true }),
        }),
      },
    });
    const mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false, pubsub });
    const registered = mastra.getAgent('agent');
    const resourceId = 'user-1';
    const threadId = 'parked';
    const key = `${resourceId}${AGENT_THREAD_KEY_SEPARATOR}${threadId}`;
    const LEASE_TTL_MS = 15_000; // default MASTRA_AGENT_THREAD_LEASE_TTL_MS
    const RENEW_INTERVAL_MS = Math.floor(LEASE_TTL_MS / 3);

    // Fake timers from the start so the renewal interval is mocked.
    vi.useFakeTimers({ shouldAdvanceTime: true, now: Date.now() });

    // 1. Park a run holding the lease; its renewal timer is live.
    const output = await registered.stream('start', { memory: { thread: threadId, resource: resourceId } });
    for await (const _chunk of output.fullStream) {
      // drain
    }
    expect(output.status).toBe('suspended');
    const parkedRunId = registered.getActiveThreadRunId({ threadId, resourceId });
    expect(parkedRunId).toBeDefined();
    await vi.waitFor(() =>
      expect(
        pubsub
          .retainedTopics()
          .flatMap(topic => pubsub.retainedEvents(topic))
          .some(event => event.data?.type === 'run-suspended'),
      ).toBe(true),
    );

    // 2. Put a renewal in flight: gate renewLease so it stays pending while the
    //    sweep runs — the exact race #stopLeaseRenewal cannot cancel.
    let resolveRenewal!: (renewed: boolean) => void;
    const renewSpy = vi
      .spyOn(pubsub, 'renewLease')
      .mockImplementation(() => new Promise<boolean>(resolve => (resolveRenewal = resolve)));
    vi.advanceTimersByTime(RENEW_INTERVAL_MS);
    await vi.waitFor(() => expect(renewSpy).toHaveBeenCalled());

    // 3. Trigger the sweep with the renewal still pending.
    vi.setSystemTime(Date.now() + SUSPENDED_RUN_TTL_MS + 1);
    const other = await registered.stream('trigger the sweep', {
      memory: { thread: 'other', resource: resourceId },
    });
    for await (const _chunk of other.fullStream) {
      // drain
    }
    expect(registered.getActiveThreadRunId({ threadId, resourceId })).toBeUndefined();
    expect(pubsub.owners.get(key)).toBe(parkedRunId);

    // 4. The late renewal succeeds AFTER the sweep stamped the marker — the
    //    lease now outlives `sweptAt + LEASE_TTL`.
    vi.setSystemTime(Date.now() + 10_000);
    resolveRenewal(true);
    await Promise.resolve();
    await Promise.resolve();

    // 5. Move past the ORIGINAL marker's TTL but inside the extended lease.
    //    Without the re-stamp the marker is considered stale and the send is
    //    acknowledged as `deliver` to a run with no receiver.
    vi.setSystemTime(Date.now() + 10_000); // sweptAt + 20s: > 15s from sweep, < 15s from renewal
    const callsBefore = modelCalls();
    const inWindow = registered.sendMessage('message inside the extended lease window', { threadId, resourceId });
    const inWindowAccepted = await inWindow.accepted;
    expect(inWindowAccepted.action).toBe('blocked');
    if (inWindowAccepted.action === 'blocked') {
      expect(inWindowAccepted.runId).toBe(parkedRunId);
    }
    expect(modelCalls()).toBe(callsBefore);
  }, 30000);
});
