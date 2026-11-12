vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '600';
});

import { describe, vi } from 'vitest';
import { InMemoryStore } from '../../storage/mock';
import { describeFinishedOccurrenceCases } from './test-utils/finished-occurrence-cases';
import { describeLateDeliveryCases } from './test-utils/late-delivery-cases';

describe('in-memory store', () => {
  const storage = new InMemoryStore();
  describeFinishedOccurrenceCases({ getStorage: () => storage });
  describeLateDeliveryCases({ getStorage: () => storage });
});
