vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '600';
});

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, vi } from 'vitest';
import { LibSQLStore } from '../..';
import { describeRecoveryExitCases } from '../../../../../../packages/core/src/mastra/test-utils/recovery-exit-cases';
import { describeRecoveryReadCases } from '../../../../../../packages/core/src/mastra/test-utils/recovery-read-cases';

// A local database file shared by every instance, as pods share one database (#28712).
describe('LibSQL workflow recovery passes', () => {
  let dir: string;
  let url: string;
  let storage: LibSQLStore;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mastra-recovery-pass-'));
    url = `file:${join(dir, 'runs.db')}`;
    storage = new LibSQLStore({ id: 'recovery-pass', url });
    await storage.init();
  });
  afterAll(async () => {
    await storage.close?.();
    await rm(dir, { recursive: true, force: true });
  });

  // Each instance opens its own client, as separate pods do.
  const connect = async () => {
    const instance = new LibSQLStore({ id: 'recovery-pass', url });
    await instance.init();
    return instance;
  };
  describeRecoveryReadCases({ getStorage: () => storage, connect });
  describeRecoveryExitCases({ getStorage: () => storage, connect });
});
