/**
 * Yield-on-demand for claimed thread ownership.
 *
 * Ownership is remote-first-wins: a process that loads a thread another live
 * process already claimed never advertises it. Sessions keep every thread they
 * have loaded claimed, so an instance that merely *visited* a thread blocks the
 * instance the user is actually in. A claim request now carries
 * `intent: 'claim'`; the owner consults `yieldOwnership` and, when it agrees,
 * atomically transfers the claim lease before acknowledging the requester.
 */
import { describe, expect, it, vi } from 'vitest';

import { AgentThreadStreamRuntime } from '../thread-stream-runtime';
import type { LeasePubSub } from './thread-stream-test-utils';
import { AGENT_THREAD_KEY_SEPARATOR, createHarness, nextTicks, setupRuntime } from './thread-stream-test-utils';

const OWNER_DISCOVERY_TOPIC = 'agent.thread-owner-discovery';

const harness = createHarness('yield');
const { resourceId, threadId } = harness;
const key = [resourceId, threadId].join(AGENT_THREAD_KEY_SEPARATOR);

const deliveriesOn = (pubsub: LeasePubSub, t: string) => pubsub.deliveries.filter(d => d.topic === t);

const claim = (
  runtime: AgentThreadStreamRuntime,
  pubsub: LeasePubSub,
  yieldOwnership?: () => boolean,
  onOwnershipYielded?: () => void,
  onOwnershipLost?: () => void,
) =>
  runtime.claimThreadOwnership(
    harness.agent,
    {
      resourceId,
      threadId,
      peer: { id: `${harness.agent.id}-peer` },
      yieldOwnership,
      onOwnershipYielded,
      onOwnershipLost,
    },
    pubsub,
  );

async function requestOwner(
  pubsub: LeasePubSub,
  requestId: string,
  intent?: 'claim',
  targetSourceId?: string,
  expiresAt = Date.now() + 1_000,
) {
  const replyTopic = `${OWNER_DISCOVERY_TOPIC}.${requestId}`;
  await pubsub.subscribe(replyTopic, () => {});
  await pubsub.publish(OWNER_DISCOVERY_TOPIC, {
    type: 'thread-owner-request',
    runId: requestId,
    data: {
      type: 'thread-owner-request',
      key,
      requestId,
      replyTopic,
      sourceId: 'elsewhere',
      expiresAt,
      ...(intent ? { intent } : {}),
      ...(targetSourceId ? { targetSourceId } : {}),
    },
  });
  await nextTicks();
  return replyTopic;
}

describe('claimed thread ownership yields on demand', () => {
  it('transfers the claim before acknowledging when the owner agrees to yield', async () => {
    const { runtime, pubsub } = setupRuntime(harness);
    const yieldOwnership = vi.fn(() => true);
    const onOwnershipYielded = vi.fn();
    await claim(runtime, pubsub, yieldOwnership, onOwnershipYielded);

    const replyTopic = await requestOwner(pubsub, 'claim-1', 'claim');

    expect(yieldOwnership).toHaveBeenCalledOnce();
    expect(onOwnershipYielded).toHaveBeenCalledOnce();
    expect(deliveriesOn(pubsub, replyTopic)).toHaveLength(1);
    expect(await pubsub.getLeaseOwner(`thread-claim:${key}`)).toBe('elsewhere');
    // The thread is no longer advertised by this process.
    const peers = await runtime.discoverThreadPeers({ timeoutMs: 10 }, pubsub, harness.agent);
    expect(peers.some(peer => peer.threadId === threadId)).toBe(false);
  });

  it('lets the requester adopt a transferred lease during the same claim attempt', async () => {
    const { runtime, pubsub } = setupRuntime(harness);
    const acquireLease = vi.spyOn(pubsub, 'acquireLease');
    const owner = await claim(runtime, pubsub, () => true);
    const initialSourceId = await pubsub.getLeaseOwner(`thread-claim:${key}`);
    const contenderRuntime = new AgentThreadStreamRuntime();

    const contender = await claim(contenderRuntime, pubsub);

    expect(contender.claimed).toBe(true);
    expect(await pubsub.getLeaseOwner(`thread-claim:${key}`)).not.toBe(initialSourceId);
    expect(acquireLease.mock.calls.at(-2)?.[1]).toBe(acquireLease.mock.calls.at(-1)?.[1]);
    owner.unsubscribe();
    contender.unsubscribe();
  });

  it('does not transfer after the requester claim deadline has passed', async () => {
    const { runtime, pubsub } = setupRuntime(harness);
    const yieldOwnership = vi.fn(() => true);
    const owner = await claim(runtime, pubsub, yieldOwnership);
    const initialSourceId = await pubsub.getLeaseOwner(`thread-claim:${key}`);

    await requestOwner(pubsub, 'expired-claim', 'claim', initialSourceId, Date.now() - 1);

    expect(yieldOwnership).not.toHaveBeenCalled();
    expect(await pubsub.getLeaseOwner(`thread-claim:${key}`)).toBe(initialSourceId);
    owner.unsubscribe();
  });

  it('keeps answering when the owner refuses to yield', async () => {
    const { runtime, pubsub } = setupRuntime(harness);
    const yieldOwnership = vi.fn(() => false);
    const owner = await claim(runtime, pubsub, yieldOwnership);

    const replyTopic = await requestOwner(pubsub, 'claim-2', 'claim');

    expect(yieldOwnership).toHaveBeenCalledOnce();
    expect(deliveriesOn(pubsub, replyTopic).length).toBeGreaterThan(0);
    const peers = await runtime.discoverThreadPeers({ timeoutMs: 10 }, pubsub, harness.agent);
    expect(peers.some(peer => peer.threadId === threadId)).toBe(true);

    owner.unsubscribe();
    await nextTicks();
  });

  it('ignores a claim request targeted at a different lease owner', async () => {
    const { runtime, pubsub } = setupRuntime(harness);
    const yieldOwnership = vi.fn(() => true);
    const owner = await claim(runtime, pubsub, yieldOwnership);

    const replyTopic = await requestOwner(pubsub, 'claim-wrong-owner', 'claim', 'different-owner');

    expect(yieldOwnership).not.toHaveBeenCalled();
    expect(deliveriesOn(pubsub, replyTopic)).toHaveLength(0);
    expect(await pubsub.getLeaseOwner(`thread-claim:${key}`)).not.toBe('elsewhere');

    owner.unsubscribe();
    await nextTicks();
  });

  it('never yields to a plain owner lookup used for signal delivery', async () => {
    const { runtime, pubsub } = setupRuntime(harness);
    const yieldOwnership = vi.fn(() => true);
    const owner = await claim(runtime, pubsub, yieldOwnership);

    const replyTopic = await requestOwner(pubsub, 'lookup-1');

    expect(yieldOwnership).not.toHaveBeenCalled();
    expect(deliveriesOn(pubsub, replyTopic).length).toBeGreaterThan(0);

    owner.unsubscribe();
    await nextTicks();
  });

  it('reacquires an expired claim after a stalled renewal when no contender owns it', async () => {
    vi.useFakeTimers();
    try {
      const { runtime, pubsub } = setupRuntime(harness);
      const renewLease = vi.spyOn(pubsub, 'renewLease').mockResolvedValueOnce(false);
      const acquireLease = vi.spyOn(pubsub, 'acquireLease');
      const onOwnershipLost = vi.fn();
      const owner = await claim(runtime, pubsub, undefined, undefined, onOwnershipLost);
      const claimLeaseKey = `thread-claim:${key}`;
      const sourceId = await pubsub.getLeaseOwner(claimLeaseKey);

      await vi.advanceTimersByTimeAsync(5_000);

      expect(renewLease).toHaveBeenCalledOnce();
      expect(acquireLease).toHaveBeenCalledTimes(2);
      expect(await pubsub.getLeaseOwner(claimLeaseKey)).toBe(sourceId);
      expect(onOwnershipLost).not.toHaveBeenCalled();
      owner.unsubscribe();
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports ownership loss when another owner wins before renewal can reacquire', async () => {
    vi.useFakeTimers();
    try {
      const { runtime, pubsub } = setupRuntime(harness);
      const onOwnershipLost = vi.fn();
      await claim(runtime, pubsub, undefined, undefined, onOwnershipLost);
      const claimLeaseKey = `thread-claim:${key}`;
      pubsub.owners.set(claimLeaseKey, 'elsewhere');

      await vi.advanceTimersByTimeAsync(5_000);

      expect(onOwnershipLost).toHaveBeenCalledOnce();
      expect(await pubsub.getLeaseOwner(claimLeaseKey)).toBe('elsewhere');
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops the displaced claim renewal timer when the same runtime reclaims a thread', async () => {
    vi.useFakeTimers();
    try {
      const { runtime, pubsub } = setupRuntime(harness);
      const renewLease = vi.spyOn(pubsub, 'renewLease');
      const first = await claim(runtime, pubsub);
      const second = await claim(runtime, pubsub);

      await vi.advanceTimersByTimeAsync(5_000);

      expect(renewLease).toHaveBeenCalledOnce();
      first.unsubscribe();
      second.unsubscribe();
    } finally {
      vi.useRealTimers();
    }
  });
});
