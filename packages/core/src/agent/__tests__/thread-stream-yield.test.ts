/**
 * Yield-on-demand for claimed thread ownership.
 *
 * Ownership is remote-first-wins: a process that loads a thread another live
 * process already claimed never advertises it. Sessions keep every thread they
 * have loaded claimed, so an instance that merely *visited* a thread blocks the
 * instance the user is actually in. A claim request now carries
 * `intent: 'claim'`; the owner consults `yieldOwnership` and, when it agrees,
 * releases the thread and stays silent so the requester's discovery finds no
 * owner and takes it.
 */
import { describe, expect, it, vi } from 'vitest';

import type { AgentThreadStreamRuntime } from '../thread-stream-runtime';
import type { LeasePubSub } from './thread-stream-test-utils';
import { AGENT_THREAD_KEY_SEPARATOR, createHarness, nextTicks, setupRuntime } from './thread-stream-test-utils';

const OWNER_DISCOVERY_TOPIC = 'agent.thread-owner-discovery';

const harness = createHarness('yield');
const { resourceId, threadId } = harness;
const key = [resourceId, threadId].join(AGENT_THREAD_KEY_SEPARATOR);

const deliveriesOn = (pubsub: LeasePubSub, t: string) => pubsub.deliveries.filter(d => d.topic === t);

const claim = (runtime: AgentThreadStreamRuntime, pubsub: LeasePubSub, yieldOwnership?: () => boolean) =>
  runtime.claimThreadOwnership(
    harness.agent,
    { resourceId, threadId, peer: { id: `${harness.agent.id}-peer` }, yieldOwnership },
    pubsub,
  );

async function requestOwner(pubsub: LeasePubSub, requestId: string, intent?: 'claim') {
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
      expiresAt: Date.now() + 1_000,
      ...(intent ? { intent } : {}),
    },
  });
  await nextTicks();
  return replyTopic;
}

describe('claimed thread ownership yields on demand', () => {
  it('releases the claim and stays silent when the owner agrees to yield', async () => {
    const { runtime, pubsub } = setupRuntime(harness);
    const yieldOwnership = vi.fn(() => true);
    await claim(runtime, pubsub, yieldOwnership);

    const replyTopic = await requestOwner(pubsub, 'claim-1', 'claim');

    expect(yieldOwnership).toHaveBeenCalledOnce();
    expect(deliveriesOn(pubsub, replyTopic)).toEqual([]);
    // The thread is no longer advertised by this process.
    const peers = await runtime.discoverThreadPeers({ timeoutMs: 10 }, pubsub, harness.agent);
    expect(peers.some(peer => peer.threadId === threadId)).toBe(false);
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
});
