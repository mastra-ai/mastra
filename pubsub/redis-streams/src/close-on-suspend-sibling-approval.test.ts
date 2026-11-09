/**
 * #28479 on a real Redis: a resumed subscriber gets the retained backlog
 * redelivered ahead of the resumed segment's frames, so `closeOnSuspend` must
 * wait for those frames before closing. Repeated because it is a race.
 */
import { randomUUID } from 'node:crypto';

// The shared scenario lives with @mastra/core's tests; there is no public export.
import { defineSiblingApprovalSuite } from '../../../packages/core/src/agent/durable/__tests__/close-on-suspend-sibling-approval.suite';
import { REDIS_URL } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

defineSiblingApprovalSuite('RedisStreamsPubSub', {
  createPubSub: () => new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix: `issue-28479-${randomUUID()}` }),
  repeat: 10,
});
