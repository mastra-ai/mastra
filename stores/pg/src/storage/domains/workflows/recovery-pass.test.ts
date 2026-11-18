vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '600';
});

import { afterAll, beforeAll, describe, vi } from 'vitest';
import { PostgresStore } from '../..';
import { describeRecoveryExitCases } from '../../../../../../packages/core/src/mastra/test-utils/recovery-exit-cases';
import { TEST_CONFIG } from '../../test-utils';

// Instances on one schema, as pods share one database (#28712).
describe('Postgres workflow recovery passes', () => {
  const schemaName = `recovery_pass_${Date.now()}`;
  const open = () => new PostgresStore({ ...TEST_CONFIG, id: 'recovery-pass', schemaName });
  const storage = open();
  beforeAll(async () => {
    await storage.init();
  });
  afterAll(async () => {
    await storage.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await storage.close();
  });

  // Each instance opens its own connection pool, as separate pods do.
  const connect = async () => {
    const instance = open();
    await instance.init();
    return instance;
  };
  // The in-memory suite runs the in-process rows; here pods share a broker.
  describeRecoveryExitCases({
    getStorage: () => storage,
    connect,
    cases: [
      { pubsub: 'broker', exit: 'crashes' },
      { pubsub: 'broker', exit: 'shuts down' },
    ],
  });
});
