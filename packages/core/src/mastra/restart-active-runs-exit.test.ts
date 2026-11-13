/**
 * Recovery of a default-engine run whose instance crashed or shut down, on
 * the in-memory store (#28712). Leases use a short TTL here, read when core
 * loads.
 */
vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '600';
});

import { describe, vi } from 'vitest';
import { InMemoryStore } from '../storage/mock';
import { describeRecoveryExitCases } from './test-utils/recovery-exit-cases';

describe('in-memory store', () => {
  const storage = new InMemoryStore();
  describeRecoveryExitCases({ getStorage: () => storage });
});
