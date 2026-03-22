import type { Event } from '@mastra/core/events';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { GoogleCloudPubSub } from '.';

/**
 * These tests require the Google Cloud PubSub emulator running on localhost:8085.
 *
 * Start it via:
 *   docker compose -f .dev/docker-compose.yaml up -d pubsub-emulator
 *
 * Or directly:
 *   docker run -p 8085:8085 gcr.io/google.com/cloudsdktool/google-cloud-cli:emulators \
 *     gcloud beta emulators pubsub start --host-port=0.0.0.0:8085
 */

const EMULATOR_HOST = process.env.PUBSUB_EMULATOR_HOST ?? 'localhost:8085';

function makeEvent(overrides: Partial<Omit<Event, 'id' | 'createdAt'>> = {}): Omit<Event, 'id' | 'createdAt'> {
  return {
    type: 'test',
    data: {},
    runId: `run-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ...overrides,
  };
}

function waitForMessages(count: number, collected: Event[], timeoutMs = 10_000): Promise<Event[]> {
  return new Promise((resolve, _reject) => {
    const timeout = setTimeout(() => {
      resolve(collected);
    }, timeoutMs);

    const interval = setInterval(() => {
      if (collected.length >= count) {
        clearTimeout(timeout);
        clearInterval(interval);
        resolve(collected);
      }
    }, 100);
  });
}

// Each test gets unique topic names to avoid cross-test interference
let topicCounter = 0;
function uniqueTopic() {
  return `test-group-${Date.now()}-${topicCounter++}`;
}

describe.sequential('GoogleCloudPubSub group support', () => {
  // All instances created during tests, for cleanup
  const instances: GoogleCloudPubSub[] = [];

  function createPubSub(): GoogleCloudPubSub {
    const ps = new GoogleCloudPubSub({
      projectId: 'pubsub-test',
      apiEndpoint: EMULATOR_HOST,
    });
    instances.push(ps);
    return ps;
  }

  afterEach(async () => {
    // Flush all instances
    for (const ps of instances) {
      await ps.flush().catch(() => {});
    }
  });

  afterAll(async () => {
    instances.length = 0;
  });

  describe('fan-out (existing behavior, no group)', () => {
    it('delivers messages to all subscribers on the same instance', async () => {
      const pubsub = createPubSub();
      const topic = uniqueTopic();

      const collected1: Event[] = [];
      const collected2: Event[] = [];

      await pubsub.subscribe(topic, (event, ack) => {
        collected1.push(event);
        ack?.();
      });
      await pubsub.subscribe(topic, (event, ack) => {
        collected2.push(event);
        ack?.();
      });

      await pubsub.publish(topic, makeEvent({ type: 'hello' }));

      const [msgs1, msgs2] = await Promise.all([
        waitForMessages(1, collected1, 5000),
        waitForMessages(1, collected2, 5000),
      ]);

      expect(msgs1.length).toBe(1);
      expect(msgs2.length).toBe(1);
      expect(msgs1[0]!.type).toBe('hello');
      expect(msgs2[0]!.type).toBe('hello');
    });
  });

  describe('group (competing consumers)', () => {
    it('delivers each message exactly once via shared group subscription', async () => {
      // In a single process, two PubSub instances sharing a group subscription
      // means both register callbacks on the same underlying subscription.
      // Messages are delivered once per subscription (not duplicated), which is
      // the key difference from fan-out where each instance gets its own subscription.
      //
      // True multi-process competing consumer distribution requires separate processes,
      // but we can verify the core property: messages are NOT duplicated.
      const pubsub1 = createPubSub();
      const publisher = createPubSub();
      const topic = uniqueTopic();

      const collected: Event[] = [];

      await pubsub1.subscribe(
        topic,
        (event, ack) => {
          collected.push(event);
          ack?.();
        },
        { group: 'workers' },
      );

      // Give subscription time to establish
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Publish multiple messages
      const messageCount = 4;
      for (let i = 0; i < messageCount; i++) {
        await publisher.publish(topic, makeEvent({ type: `task-${i}` }));
      }

      await waitForMessages(messageCount, collected, 10000);

      // Each message received exactly once (no duplicates)
      expect(collected.length).toBe(messageCount);

      // Verify different types received (not the same message repeated)
      const types = collected.map(e => e.type);
      expect(types).toContain('task-0');
      expect(types).toContain('task-3');
    });

    it('group and fan-out subscriptions on same topic use different subscription names', async () => {
      // Verify that a group subscription and a fan-out subscription on the same
      // topic create separate underlying subscriptions (different names), so
      // both independently receive all messages.
      const pubsub = createPubSub();
      const publisher = createPubSub();
      const topic = uniqueTopic();

      const groupCollected: Event[] = [];
      const fanoutCollected: Event[] = [];

      // Group subscription: uses name `${topic}-workers`
      await pubsub.subscribe(
        topic,
        (event, ack) => {
          groupCollected.push(event);
          ack?.();
        },
        { group: 'workers' },
      );

      // Fan-out subscription: uses name `${topic}-${instanceId}`
      await pubsub.subscribe(topic, (event, ack) => {
        fanoutCollected.push(event);
        ack?.();
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const messageCount = 3;
      for (let i = 0; i < messageCount; i++) {
        await publisher.publish(topic, makeEvent({ type: `task-${i}` }));
      }

      // Both should receive all messages since they are separate subscriptions
      await Promise.all([
        waitForMessages(messageCount, groupCollected, 10000),
        waitForMessages(messageCount, fanoutCollected, 10000),
      ]);

      expect(fanoutCollected.length).toBe(messageCount);
      expect(groupCollected.length).toBe(messageCount);
    });

    it('exactly-once delivery is enabled for group subscriptions', async () => {
      const pubsub = createPubSub();
      const topic = uniqueTopic();

      const collected: Event[] = [];

      await pubsub.subscribe(
        topic,
        (event, ack) => {
          collected.push(event);
          ack?.();
        },
        { group: 'exactly-once-test' },
      );

      await new Promise(resolve => setTimeout(resolve, 1000));

      await pubsub.publish(topic, makeEvent({ type: 'unique-msg' }));

      await waitForMessages(1, collected, 5000);

      expect(collected.length).toBe(1);
      expect(collected[0]!.type).toBe('unique-msg');
    });
  });
});
