import { definePublishLagSuite } from './thread-stream-publish-lag.suite';
import type { LeasePubSub } from './thread-stream-test-utils';
import { LeasePubSub as Lease } from './thread-stream-test-utils';

definePublishLagSuite('in-memory', {
  create(delayMs) {
    const pubsub = new Lease();
    pubsub.retain = true;
    pubsub.streamPartDelayMs = delayMs;
    return pubsub;
  },
  topicParts(pubsub) {
    const lease = pubsub as LeasePubSub;
    return lease
      .retainedTopics()
      .flatMap(topic => lease.retainedEvents(topic))
      .filter(e => e.data?.type === 'stream-part')
      .map(e => e.data.part.type as string);
  },
});
