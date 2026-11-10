/**
 * A parked run must not abort the resume that took its lease (#29974).
 *
 * A durable run that suspends stays registered on the process that started
 * it, which keeps renewing its thread lease so a same-process resume can
 * reattach. When another process resumes the run, it takes that lease over
 * under the same run id. The starting process's next renewal then fails; it
 * must drop its parked copy locally instead of aborting the run by id, which
 * reaches the live resume on the other process and kills its stream.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '300';
});

import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { createDurableAgent } from '../durable';
import { globalRunRegistry } from '../durable/run-registry';

const THREAD = 'parked-resume-thread';
const RESOURCE = 'parked-resume-user';
const LEASE_KEY = [RESOURCE, THREAD].join('\u0000');

/** One lease table shared with the other process, like Redis. */
class SharedLeasePubSub extends EventEmitterPubSub {
  leases = new Map<string, { owner: string; expiresAt: number }>();
  renewals = 0;

  owner(key: string) {
    const lease = this.leases.get(key);
    return lease && lease.expiresAt > Date.now() ? lease.owner : undefined;
  }

  override async acquireLease(key: string, owner: string, ttlMs: number) {
    const current = this.owner(key);
    if (current && current !== owner) return { acquired: false, owner: current };
    this.leases.set(key, { owner, expiresAt: Date.now() + ttlMs });
    return { acquired: true, owner };
  }
  override async getLeaseOwner(key: string) {
    return this.owner(key);
  }
  override async releaseLease(key: string, owner: string) {
    if (this.leases.get(key)?.owner === owner) this.leases.delete(key);
  }
  override async renewLease(key: string, owner: string, ttlMs: number) {
    if (this.owner(key) !== owner) return false;
    this.leases.set(key, { owner, expiresAt: Date.now() + ttlMs });
    if (key === LEASE_KEY) this.renewals++;
    return true;
  }
  override async transferLease(key: string, fromOwner: string, toOwner: string) {
    if (this.owner(key) !== fromOwner) return false;
    this.leases.set(key, { ...this.leases.get(key)!, owner: toOwner });
    return true;
  }
}

function toolCallModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start' as const, warnings: [] },
        { type: 'response-metadata' as const, id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
        {
          type: 'tool-call' as const,
          toolCallType: 'function' as const,
          toolCallId: 'call-1',
          toolName: 'archive',
          input: JSON.stringify({ item: 'a' }),
          providerExecuted: false,
        },
        {
          type: 'finish' as const,
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

describe('thread lease loss while parked (#29974)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    globalRunRegistry.clear();
  });

  it('drops the parked run locally instead of aborting the resume that took its lease on another process', async () => {
    const pubsub = new SharedLeasePubSub();
    const archive = createTool({
      id: 'archive',
      description: 'Archive an item',
      inputSchema: z.object({ item: z.string() }),
      requireApproval: true,
      execute: async () => ({ ok: true }),
    });
    const durableAgent = createDurableAgent({
      agent: new Agent({
        id: 'parked-agent',
        name: 'Parked Agent',
        instructions: 'You archive items.',
        model: toolCallModel(),
        memory: new MockMemory(),
        tools: { archive },
      }),
      pubsub,
    });
    new Mastra({ agents: { 'parked-agent': durableAgent as any }, logger: false, pubsub });
    const abortRunStream = vi.spyOn(durableAgent, 'abortRunStream');
    const requestRemoteAbort = vi.spyOn(durableAgent as any, 'requestRemoteAbort');

    let suspended = false;
    const { runId } = await durableAgent.stream('Archive a', {
      requireToolApproval: true,
      memory: { thread: THREAD, resource: RESOURCE },
      onSuspended: () => {
        suspended = true;
      },
    });
    await vi.waitFor(() => expect(suspended).toBe(true));

    // The parked run keeps its lease warm for a same-process resume.
    const renewalsWhileParked = pubsub.renewals;
    await vi.waitFor(() => expect(pubsub.renewals).toBeGreaterThan(renewalsWhileParked), { timeout: 2_000 });
    const parkedOwner = pubsub.owner(LEASE_KEY);
    expect(parkedOwner).toBeDefined();

    // Another process resumes the same run and takes the lease under a newer generation.
    const resumedOwner = `mastra:thread-lease:${JSON.stringify([runId, 'generation', 2])}`;
    expect(await pubsub.transferLease(LEASE_KEY, parkedOwner!, resumedOwner)).toBe(true);
    let resumedRenewals = 0;
    const resumedRenewal = setInterval(() => {
      void pubsub.renewLease(LEASE_KEY, resumedOwner, 300).then(renewed => {
        if (renewed) resumedRenewals++;
      });
    }, 50);

    try {
      // Several renewal intervals (TTL/3 = 100ms) for the parked copy to notice it lost the lease.
      await new Promise(resolve => setTimeout(resolve, 600));

      expect(requestRemoteAbort).not.toHaveBeenCalled();
      expect(abortRunStream).not.toHaveBeenCalled();
      expect(pubsub.owner(LEASE_KEY)).toBe(resumedOwner);
      // The parked copy stopped renewing: every renewal now is the resume's.
      const renewalsAfterLoss = pubsub.renewals - resumedRenewals;
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(pubsub.renewals - resumedRenewals).toBe(renewalsAfterLoss);
    } finally {
      clearInterval(resumedRenewal);
    }
  }, 15_000);
});
