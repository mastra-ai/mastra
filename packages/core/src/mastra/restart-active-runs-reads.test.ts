/**
 * What a workflow recovery pass reads from the in-memory store (#28712).
 */
import { describe } from 'vitest';
import { InMemoryStore } from '../storage/mock';
import { describeRecoveryReadCases } from './test-utils/recovery-read-cases';

describe('in-memory store', () => {
  const storage = new InMemoryStore();
  describeRecoveryReadCases({ getStorage: () => storage });
});
