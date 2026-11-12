vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '600';
});

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, vi } from 'vitest';
import { LibSQLStore } from '../..';
import { describeFinishedOccurrenceCases } from '../../../../../../packages/core/src/workflows/evented/test-utils/finished-occurrence-cases';
import { describeLateDeliveryCases } from '../../../../../../packages/core/src/workflows/evented/test-utils/late-delivery-cases';
import { describeLateEndCases } from '../../../../../../packages/core/src/workflows/evented/test-utils/late-end-cases';

// A local database file shared by every replica, as pods share one database (#28712).
describe('LibSQL evented finished step deliveries', () => {
  let dir: string;
  let url: string;
  let storage: LibSQLStore;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mastra-finished-occurrence-'));
    url = `file:${join(dir, 'runs.db')}`;
    storage = new LibSQLStore({ id: 'finished-occurrence', url });
    await storage.init();
  });
  afterAll(async () => {
    await storage.close?.();
    await rm(dir, { recursive: true, force: true });
  });

  // Each replica opens its own client, as separate pods do.
  const connect = async () => {
    const replica = new LibSQLStore({ id: 'finished-occurrence', url });
    await replica.init();
    return replica;
  };
  describeFinishedOccurrenceCases({ getStorage: () => storage, connect });
  describeLateDeliveryCases({ getStorage: () => storage, connect });
  describeLateEndCases({ getStorage: () => storage, connect });
});
