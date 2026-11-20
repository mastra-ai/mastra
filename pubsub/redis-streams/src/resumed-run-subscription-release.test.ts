/**
 * #30479 on a real Redis: every PubSub subscription holds a dedicated blocking
 * connection, so a resumed run that kept its subscriptions until
 * `cleanupTimeoutMs` kept those connections open too. Counts the server's
 * connections while the run is paused and after it finishes.
 */
import { randomUUID } from 'node:crypto';

import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { afterAll, beforeAll } from 'vitest';
// The shared scenario lives with @mastra/core's tests; there is no public export.
import { defineResumedRunReleaseSuite } from '../../../packages/core/src/agent/durable/__tests__/resumed-run-subscription-release.suite';
import { REDIS_URL } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

let admin: RedisClientType;

beforeAll(async () => {
  admin = createClient({ url: REDIS_URL }) as RedisClientType;
  await admin.connect();
});

afterAll(async () => {
  await admin.quit();
});

defineResumedRunReleaseSuite('RedisStreamsPubSub', {
  createPubSub: () => new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix: `issue-30479-${randomUUID()}` }),
  openConnections: async () => (await admin.sendCommand<string>(['CLIENT', 'LIST'])).trim().split('\n').length,
});
