import { MockStore } from '@mastra/core/storage';
import type { ObservabilityStorage } from '@mastra/core/storage';
import { createTestSuite } from './factory';
import { createMastraStorageCompositionTests } from './composite-tests';
import { createObservabilityVNextTests } from './domains/observability-vnext';

// Test InMemoryStore (MockStore)
createTestSuite(new MockStore());

// Test MastraStorage composition with InMemoryStore backing
createMastraStorageCompositionTests();

// Test the shared observability vNext suite against the in-memory adapter.
// Each test gets a fresh store so delta cursors / feature-flag state don't
// leak between tests.
createObservabilityVNextTests({
  capabilities: {
    label: 'InMemoryStore',
    preferredStrategy: 'batch-with-updates',
  },
  getStorage: async () => {
    const store = new MockStore();
    return (await store.getStore('observability')) as ObservabilityStorage;
  },
});
