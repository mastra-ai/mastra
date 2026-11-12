vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '600';
});

import { describe, vi } from 'vitest';
import { InMemoryStore } from '../../storage/mock';
import { describeFinishedOccurrenceCases } from './test-utils/finished-occurrence-cases';
import { describeLateDeliveryCases } from './test-utils/late-delivery-cases';
import { describeLateEndCases } from './test-utils/late-end-cases';

describe('in-memory store', () => {
  const storage = new InMemoryStore();
  describeFinishedOccurrenceCases({ getStorage: () => storage });
  // The in-memory store doesn't move `updatedAt` when a step result is written.
  describeLateDeliveryCases({ getStorage: () => storage, updatedAtMovesOnEveryWrite: false });
  describeLateEndCases({ getStorage: () => storage });
});
