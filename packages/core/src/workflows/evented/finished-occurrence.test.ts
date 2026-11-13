import { describe } from 'vitest';
import { InMemoryStore } from '../../storage/mock';
import { describeFinishedOccurrenceCases } from './test-utils/finished-occurrence-cases';

describe('in-memory store', () => {
  const storage = new InMemoryStore();
  describeFinishedOccurrenceCases({ getStorage: () => storage });
});
