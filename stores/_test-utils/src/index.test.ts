import { MockStore } from '@mastra/core/storage';
import { createTestSuite } from './factory';
import { createCompositeStorageTests } from './composite-tests';

// Test InMemoryStore (MockStore)
createTestSuite(new MockStore());

// Test CompositeStorage with InMemoryStore backing
createCompositeStorageTests();
