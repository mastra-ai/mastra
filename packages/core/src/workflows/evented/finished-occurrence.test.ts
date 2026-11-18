import { beforeAll, describe } from 'vitest';
import { InMemoryStore } from '../../storage/mock';
import { describeFinishedOccurrenceCases } from './test-utils/finished-occurrence-cases';
import { withStepGuards } from './test-utils/step-guards';

describe('in-memory store', () => {
  const storage = new InMemoryStore();
  describeFinishedOccurrenceCases({ getStorage: () => storage });
});

// Enforces the workflow step guards the way Postgres does, so the guarded paths run without a database.
describe('in-memory store with workflow step guards', () => {
  const storage = new InMemoryStore();
  beforeAll(() => withStepGuards(storage));
  describeFinishedOccurrenceCases({ getStorage: () => storage });
});
