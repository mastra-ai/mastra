import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '300';
});

import type { Agent } from '../agent';
import { createDurableAgentStream, emitChunkEvent, emitFinishEvent } from '../durable/stream-adapter';
import { verifyRunLease } from '../run-lease-fence';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';
import { LeasePubSub } from './thread-stream-test-utils';

/** Once cut, the run's renewals hang, as they do while a process stalls, so its lease lapses here. */
class StallingLeasePubSub extends LeasePubSub {
  cut = false;
  override async renewLease(key: string, owner: string): Promise<boolean> {
    if (this.cut) await new Promise(() => {});
    return super.renewLease(key, owner);
  }
}

const agent = { id: 'late-generation-agent', getMemory: async () => undefined } as unknown as Agent<any, any, any, any>;
const options = { memory: { thread: 'late-generation-thread', resource: 'late-generation-user' } } as any;
const key = 'late-generation-user\u0000late-generation-thread';

describe('thread stream: a durable run whose claim generation arrives after it took the thread lease', () => {
  it('keeps the owner it took the lease with through renewal, fence and retake', async () => {
    const pubsub = new StallingLeasePubSub();
    const runtime = new AgentThreadStreamRuntime();
    const runId = 'late-generation-run';
    const makeStream = () =>
      createDurableAgentStream({
        pubsub,
        runId,
        messageId: crypto.randomUUID(),
        model: { modelId: 'mock', provider: 'mock', version: 'v3' },
      });

    const first = makeStream();
    await first.ready;
    await runtime.registerRun(agent, first.output, options, pubsub, { continuation: 'across-suspension' });
    expect(await pubsub.getLeaseOwner(key)).toBe(runId);

    await emitChunkEvent(pubsub, runId, {
      type: 'tool-call-approval',
      payload: { toolCallId: 'call-1', toolName: 'one', args: {} },
      runId,
      from: 'AGENT',
    } as any);
    await vi.waitFor(() => expect(first.output.status).toBe('suspended'));

    // The resume learns the claim's generation only now, after the lease was taken under the bare run id.
    const resumed = makeStream();
    await resumed.ready;
    expect(
      runtime.continueRun(agent, resumed.output, { ...options, toolCallId: 'call-1' } as any, pubsub, {
        generation: 1,
      }),
    ).toBe(true);

    // The run's renewals stall past the lease deadline, so it takes the thread back. Nobody else holds it.
    pubsub.cut = true;
    await new Promise(resolve => setTimeout(resolve, 600));
    pubsub.cut = false;
    await new Promise(resolve => setTimeout(resolve, 300));

    await expect(verifyRunLease(runId)).resolves.toBeUndefined();
    expect(await pubsub.getLeaseOwner(key)).toBe(runId);
    expect(await runtime.isRunHoldingThreadLease(pubsub, runId, options.memory.thread, options.memory.resource)).toBe(
      true,
    );

    await emitFinishEvent(pubsub, runId, {
      output: { text: 'answer', steps: [] },
      stepResult: { reason: 'stop' },
    } as any);
    await vi.waitFor(async () => expect(await pubsub.getLeaseOwner(key)).toBeUndefined());
  });
});
