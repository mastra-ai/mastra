vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '600';
});

import { afterAll, beforeAll, describe, expect, vi } from 'vitest';
import { PostgresStore } from '../..';
import { describeFinishedOccurrenceCases } from '../../../../../../packages/core/src/workflows/evented/test-utils/finished-occurrence-cases';
import { TEST_CONFIG } from '../../test-utils';

// Postgres arbitrates some late deliveries through its workflow step guards (#28712).
describe('Postgres evented finished step deliveries', () => {
  const schemaName = `finished_occurrence_${Date.now()}`;
  const open = () => new PostgresStore({ ...TEST_CONFIG, id: 'finished-occurrence', schemaName });
  const storage = open();
  beforeAll(async () => {
    await storage.init();
    expect((await storage.getStore('workflows'))!.supportsWorkflowStepGuards()).toBe(true);
  });
  afterAll(async () => {
    await storage.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await storage.close();
  });

  // Each replica opens its own connection pool, as separate pods do.
  describeFinishedOccurrenceCases({
    getStorage: () => storage as any,
    connect: async () => {
      const replica = open();
      await replica.init();
      return replica as any;
    },
  });
});
