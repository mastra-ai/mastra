import { MockStore } from '@mastra/core/storage';
import type { ObservabilityStorage } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { createMastraStorageCompositionTests } from './composite-tests';
import { createAgentSignalsTests } from './domains/agent-signals';
import {
  createKnowledgeImporterHostTests,
  createKnowledgeHostedImporterHostTests,
  createKnowledgeImportersStorageTests,
  createKnowledgePageStoreTests,
} from './domains/knowledge';
import { createObservabilityVNextTests } from './domains/observability-vnext';
import { createTestSuite } from './factory';

// Test InMemoryStore (MockStore)
createTestSuite(new MockStore(), { scopedTraceDeletion: true });

// The shared agent signals contract against the in-memory reference store.
createAgentSignalsTests({ storage: new MockStore() });
describe('Agent signals on InMemoryStore', () => {
  it('is not shared across processes', async () => {
    expect((await new MockStore().getStore('agentSignals'))?.sharedAcrossProcesses).toBe(false);
  });
});

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

// The shared Knowledge schema-4 page-store contract against the in-memory reference store.
createKnowledgePageStoreTests(async () => (await new MockStore().getStore('knowledge'))!);

// The shared importer bookkeeping contract (r347 O2) against the in-memory reference store. One
// process, so the reader is the same store and transactions are serialized.
createKnowledgeImportersStorageTests(async () => {
  const store = (await new MockStore().getStore('knowledge'))!;
  return { store, reader: store, concurrentTransactions: false, cleanup: async () => {} };
});

// The local importer host (r347 O3) through Knowledge, on a fresh in-memory store per test.
createKnowledgeImporterHostTests(async () => ({ storage: new MockStore(), cleanup: async () => {} }));
createKnowledgeHostedImporterHostTests(async () => ({ storage: new MockStore(), cleanup: async () => {} }));
