import type { KVNamespace } from '@cloudflare/workers-types';
import {
  createTestSuite,
  createClientAcceptanceTests,
  createDomainDirectTests,
  createConfigValidationTests,
} from '@internal/storage-test-utils';
import {
  TABLE_AGENTS,
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_SCORERS,
  TABLE_SPANS,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
import dotenv from 'dotenv';
import { Miniflare } from 'miniflare';
import { vi } from 'vitest';

import { MemoryStorageCloudflare } from './domains/memory';
import { ScoresStorageCloudflare } from './domains/scores';
import { WorkflowsStorageCloudflare } from './domains/workflows';
import type { CloudflareWorkersConfig } from './types';
import { CloudflareStore } from '.';

export interface Env {
  [TABLE_THREADS]: KVNamespace;
  [TABLE_MESSAGES]: KVNamespace;
  [TABLE_WORKFLOW_SNAPSHOT]: KVNamespace;
  [TABLE_TRACES]: KVNamespace;
  [TABLE_SCORERS]: KVNamespace;
  [TABLE_RESOURCES]: KVNamespace;
  [TABLE_SPANS]: KVNamespace;
  [TABLE_AGENTS]: KVNamespace;
}

dotenv.config();

// Increase timeout for namespace creation and cleanup
vi.setConfig({ testTimeout: 80000, hookTimeout: 80000 });

// Initialize Miniflare with minimal worker
const mf = new Miniflare({
  script: 'export default {};',
  modules: true,
  kvNamespaces: [
    TABLE_THREADS,
    TABLE_MESSAGES,
    TABLE_WORKFLOW_SNAPSHOT,
    TABLE_TRACES,
    TABLE_RESOURCES,
    TABLE_SCORERS,
    TABLE_SPANS,
    TABLE_AGENTS,
  ],
});

// Get KV namespaces from Miniflare (async at top level)
const kvBindings = {
  [TABLE_THREADS]: (await mf.getKVNamespace(TABLE_THREADS)) as KVNamespace,
  [TABLE_MESSAGES]: (await mf.getKVNamespace(TABLE_MESSAGES)) as KVNamespace,
  [TABLE_WORKFLOW_SNAPSHOT]: (await mf.getKVNamespace(TABLE_WORKFLOW_SNAPSHOT)) as KVNamespace,
  [TABLE_TRACES]: (await mf.getKVNamespace(TABLE_TRACES)) as KVNamespace,
  [TABLE_RESOURCES]: (await mf.getKVNamespace(TABLE_RESOURCES)) as KVNamespace,
  [TABLE_SCORERS]: (await mf.getKVNamespace(TABLE_SCORERS)) as KVNamespace,
  [TABLE_SPANS]: (await mf.getKVNamespace(TABLE_SPANS)) as KVNamespace,
  [TABLE_AGENTS]: (await mf.getKVNamespace(TABLE_AGENTS)) as KVNamespace,
};

const TEST_CONFIG: CloudflareWorkersConfig = {
  id: 'cloudflare-binding-test',
  bindings: kvBindings,
  keyPrefix: 'mastra-test',
};

createTestSuite(new CloudflareStore(TEST_CONFIG));

// Pre-configured client acceptance tests (using bindings)
createClientAcceptanceTests({
  storeName: 'CloudflareStore',
  expectedStoreName: 'Cloudflare',
  createStoreWithClient: () =>
    new CloudflareStore({
      id: 'cloudflare-bindings-test',
      bindings: kvBindings,
      keyPrefix: `test-prefix-${Date.now()}`,
    }),
  createStoreWithClientAndOptions: () =>
    new CloudflareStore({
      id: 'cloudflare-bindings-opts-test',
      bindings: kvBindings,
      keyPrefix: 'test-prefix',
    }),
});

// Domain-level pre-configured client tests
createDomainDirectTests({
  storeName: 'Cloudflare',
  createMemoryDomain: () =>
    new MemoryStorageCloudflare({
      bindings: kvBindings,
      keyPrefix: `test-memory-domain-${Date.now()}`,
    }),
  createWorkflowsDomain: () =>
    new WorkflowsStorageCloudflare({
      bindings: kvBindings,
      keyPrefix: `test-workflows-domain-${Date.now()}`,
    }),
  createScoresDomain: () =>
    new ScoresStorageCloudflare({
      bindings: kvBindings,
      keyPrefix: `test-scores-domain-${Date.now()}`,
    }),
});

// Configuration validation tests
createConfigValidationTests({
  storeName: 'CloudflareStore',
  createStore: config => new CloudflareStore(config as any),
  validConfigs: [
    { description: 'bindings config', config: { id: 'test-store', bindings: kvBindings } },
    {
      description: 'bindings with keyPrefix',
      config: { id: 'test-store', bindings: kvBindings, keyPrefix: 'custom-prefix' },
    },
    {
      description: 'REST API config',
      config: { id: 'test-store', accountId: 'test-account', apiToken: 'test-token' },
    },
    { description: 'disableInit with bindings', config: { id: 'test-store', bindings: kvBindings, disableInit: true } },
  ],
  invalidConfigs: [
    {
      description: 'bindings missing required tables',
      config: { id: 'test-store', bindings: { [TABLE_THREADS]: kvBindings[TABLE_THREADS] } },
      expectedError: /Missing KV binding/,
    },
    {
      description: 'empty accountId in REST API config',
      config: { id: 'test-store', accountId: '', apiToken: 'test-token' },
      expectedError: /accountId is required/,
    },
    {
      description: 'empty apiToken in REST API config',
      config: { id: 'test-store', accountId: 'test-account', apiToken: '' },
      expectedError: /apiToken is required/,
    },
  ],
});
