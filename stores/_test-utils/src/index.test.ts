import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FilesystemStore, MockStore } from '@mastra/core/storage';
import type { AgentsStorage, ObservabilityStorage } from '@mastra/core/storage';
import { afterAll, beforeAll, describe } from 'vitest';

import { createTestSuite } from './factory';
import { createMastraStorageCompositionTests } from './composite-tests';
import { createVersionLabelTests } from './domains/agents/version-labels';
import { createObservabilityVNextTests } from './domains/observability-vnext';

// Test InMemoryStore (MockStore)
createTestSuite(new MockStore(), { versionLabels: 'supported' });

describe('FilesystemStore version-label conformance', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mastra-version-labels-'));
  const store = new FilesystemStore({ dir });
  let agentsStorage: AgentsStorage;

  beforeAll(async () => {
    await store.init();
    const storeDomain = await store.getStore('agents');
    if (!storeDomain) throw new Error('Filesystem agents storage not found');
    agentsStorage = storeDomain;
  });

  afterAll(async () => {
    await agentsStorage?.dangerouslyClearAll();
    rmSync(dir, { recursive: true, force: true });
  });

  createVersionLabelTests({
    getAgentsStorage: () => agentsStorage,
    expectedSupport: 'supported',
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
