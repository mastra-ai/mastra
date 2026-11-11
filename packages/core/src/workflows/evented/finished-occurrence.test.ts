vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '600';
});

import { describe, vi } from 'vitest';
import { InMemoryStore } from '../../storage/mock';
import { describeFinishedOccurrenceCases } from './test-utils/finished-occurrence-cases';

describe('in-memory store', () => {
  const storage = new InMemoryStore();
  describeFinishedOccurrenceCases({ getStorage: () => storage });
});
