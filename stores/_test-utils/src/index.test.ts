import { MockStore } from '@mastra/core/storage';
import { createTestSuite } from './factory';
import { createMastraStorageCompositionTests } from './composite-tests';

// Test InMemoryStore (MockStore)
createTestSuite(new MockStore());

// Test MastraStorage composition with InMemoryStore backing
createMastraStorageCompositionTests();
