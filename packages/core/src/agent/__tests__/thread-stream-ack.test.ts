/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/24348
 *
 * `AgentThreadStreamRuntime` subscribes to the thread topic and to the
 * owner/peer discovery topics directly through `pubsub.subscribe`. A durable
 * backend (Redis consumer groups, GCP Pub/Sub) keeps every delivery that is
 * never acked in its pending set and redelivers it. These callbacks take only
 * the event, so they dropped the `ack` handle and every delivery stayed pending.
 *
 * `LeasePubSub` records ack/nack per delivery, so these assertions observe the
 * contract directly instead of inferring it from behaviour. They fail when the
 * callbacks ignore `ack`.
 */
import { describe, expect, it } from 'vitest';

import type { AgentThreadStreamRuntime } from '../thread-stream-runtime';
import type { LeasePubSub } from './thread-stream-test-utils';
import { AGENT_THREAD_KEY_SEPARATOR, createHarness, nextTicks, setupRuntime } from './thread-stream-test-utils';

// Module-local to thread-stream-runtime; not part of the public topics surface.
const OWNER_DISCOVERY_TOPIC = 'agent.thread-owner-discovery';
const PEER_DISCOVERY_TOPIC = 'agent.thread-peer-discovery';

const harness = createHarness('ack');
const { resourceId, threadId } = harness;
const key = [resourceId, threadId].join(AGENT_THREAD_KEY_SEPARATOR);
const threadTopic = harness.topic;

const setup = () => setupRuntime(harness);

/** Deliveries recorded for a topic, in publish order. */
const deliveriesOn = (pubsub: LeasePubSub, t: string) => pubsub.deliveries.filter(d => d.topic === t);

/** Claims ownership, which is what registers the thread and discovery subscriptions. */
const claim = (runtime: AgentThreadStreamRuntime, pubsub: LeasePubSub, peer?: boolean) =>
  runtime.claimThreadOwnership(
    harness.agent,
    { resourceId, threadId, ...(peer ? { peer: { id: `${harness.agent.id}-peer` } } : {}) },
    pubsub,
  );

describe('claimed thread ownership acknowledges every delivery', () => {
  describe('when a claim is active', () => {
    it('acks an idle signal that it filters out', async () => {
      const { runtime, pubsub } = setup();
      const owner = await claim(runtime, pubsub);

      // Addressed to a different thread owner, so the handler inspects and drops
      // it. It still has to be acked, or a durable backend keeps it pending.
      await pubsub.publish(threadTopic, {
        type: 'agent.thread-stream',
        runId: 'signal-1',
        data: {
          type: 'idle-signal-enqueued',
          requestId: 'signal-1',
          runId: 'signal-1',
          sourceId: 'elsewhere',
          targetSourceId: 'someone-else',
          replyTopic: `${threadTopic}.reply`,
          timeoutMs: 1_000,
          signal: {},
        },
      });
      await nextTicks();

      const deliveries = deliveriesOn(pubsub, threadTopic);
      expect(deliveries.length).toBeGreaterThan(0);
      expect(deliveries.every(d => d.acked)).toBe(true);

      owner.unsubscribe();
      await nextTicks();
    });

    it('acks an owner discovery request that it filters out', async () => {
      const { runtime, pubsub } = setup();
      const owner = await claim(runtime, pubsub);

      // Addressed to a different thread, so the handler drops it.
      await pubsub.publish(OWNER_DISCOVERY_TOPIC, {
        type: 'thread-owner-request',
        runId: 'request-1',
        data: {
          type: 'thread-owner-request',
          key: 'some-other-thread',
          requestId: 'request-1',
          replyTopic: `${OWNER_DISCOVERY_TOPIC}.request-1`,
          sourceId: 'elsewhere',
        },
      });
      await nextTicks();

      const deliveries = deliveriesOn(pubsub, OWNER_DISCOVERY_TOPIC);
      expect(deliveries.length).toBeGreaterThan(0);
      expect(deliveries.every(d => d.acked)).toBe(true);

      owner.unsubscribe();
      await nextTicks();
    });

    it('acks an owner discovery request that it answers', async () => {
      const { runtime, pubsub } = setup();
      const owner = await claim(runtime, pubsub);

      const replyTopic = `${OWNER_DISCOVERY_TOPIC}.request-2`;
      // LeasePubSub only records a delivery when something is subscribed, so
      // subscribe to the reply topic to observe the handler's response.
      await pubsub.subscribe(replyTopic, () => {});
      await pubsub.publish(OWNER_DISCOVERY_TOPIC, {
        type: 'thread-owner-request',
        runId: 'request-2',
        data: {
          type: 'thread-owner-request',
          key,
          requestId: 'request-2',
          replyTopic,
          sourceId: 'elsewhere',
        },
      });
      await nextTicks();

      // The handler published a response, so the request really was handled.
      expect(deliveriesOn(pubsub, replyTopic).length).toBeGreaterThan(0);
      expect(deliveriesOn(pubsub, OWNER_DISCOVERY_TOPIC).every(d => d.acked)).toBe(true);

      owner.unsubscribe();
      await nextTicks();
    });

    it('acks a peer discovery request that it answers', async () => {
      const { runtime, pubsub } = setup();
      const owner = await claim(runtime, pubsub, true);

      const replyTopic = `${PEER_DISCOVERY_TOPIC}.request-3`;
      await pubsub.subscribe(replyTopic, () => {});
      await pubsub.publish(PEER_DISCOVERY_TOPIC, {
        type: 'thread-peer-request',
        runId: 'request-3',
        data: {
          type: 'thread-peer-request',
          requestId: 'request-3',
          replyTopic,
          sourceId: 'elsewhere',
        },
      });
      await nextTicks();

      expect(deliveriesOn(pubsub, replyTopic).length).toBeGreaterThan(0);
      expect(deliveriesOn(pubsub, PEER_DISCOVERY_TOPIC).every(d => d.acked)).toBe(true);

      owner.unsubscribe();
      await nextTicks();
    });

    it('leaves an owner discovery request unacked when its reply publish fails', async () => {
      const { runtime, pubsub } = setup();
      const owner = await claim(runtime, pubsub);

      // A reply that never reaches the backend must not ack the request: the caller's
      // discovery would time out with nothing to redeliver against. The rejection also
      // has to surface, so a backend can nack and redeliver the request.
      const replyTopic = `${OWNER_DISCOVERY_TOPIC}.request-fail`;
      pubsub.failPublish.add(replyTopic);

      await expect(
        pubsub.publish(OWNER_DISCOVERY_TOPIC, {
          type: 'thread-owner-request',
          runId: 'request-fail',
          data: {
            type: 'thread-owner-request',
            key,
            requestId: 'request-fail',
            replyTopic,
            sourceId: 'elsewhere',
          },
        }),
      ).rejects.toThrow(`publish to ${replyTopic} failed`);

      const deliveries = deliveriesOn(pubsub, OWNER_DISCOVERY_TOPIC);
      expect(deliveries.length).toBeGreaterThan(0);
      expect(deliveries.some(d => d.acked)).toBe(false);

      owner.unsubscribe();
      await nextTicks();
    });

    it('leaves a peer discovery request unacked when its reply publish fails', async () => {
      const { runtime, pubsub } = setup();
      const owner = await claim(runtime, pubsub, true);

      const replyTopic = `${PEER_DISCOVERY_TOPIC}.request-fail`;
      pubsub.failPublish.add(replyTopic);

      await expect(
        pubsub.publish(PEER_DISCOVERY_TOPIC, {
          type: 'thread-peer-request',
          runId: 'request-fail',
          data: {
            type: 'thread-peer-request',
            requestId: 'request-fail',
            replyTopic,
            sourceId: 'elsewhere',
          },
        }),
      ).rejects.toThrow(`publish to ${replyTopic} failed`);

      const deliveries = deliveriesOn(pubsub, PEER_DISCOVERY_TOPIC);
      expect(deliveries.length).toBeGreaterThan(0);
      expect(deliveries.some(d => d.acked)).toBe(false);

      owner.unsubscribe();
      await nextTicks();
    });
  });
});
