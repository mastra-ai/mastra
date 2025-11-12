import type { KVNamespace } from '@cloudflare/workers-types';
import { createTestSuite } from '@internal/storage-test-utils';
import {
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_SCORERS,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
import dotenv from 'dotenv';
import { Miniflare } from 'miniflare';
import { vi } from 'vitest';
import type { CloudflareWorkersConfig } from './types';
import { CloudflareStore } from '.';

export interface Env {
  [TABLE_THREADS]: KVNamespace;
  [TABLE_MESSAGES]: KVNamespace;
  [TABLE_WORKFLOW_SNAPSHOT]: KVNamespace;
  [TABLE_TRACES]: KVNamespace;
  [TABLE_SCORERS]: KVNamespace;
  [TABLE_RESOURCES]: KVNamespace;
}

dotenv.config();

// Increase timeout for namespace creation and cleanup
vi.setConfig({ testTimeout: 80000, hookTimeout: 80000 });

// Initialize Miniflare with minimal worker
const mf = new Miniflare({
  script: 'export default {};',
  modules: true,
  kvNamespaces: [TABLE_THREADS, TABLE_MESSAGES, TABLE_WORKFLOW_SNAPSHOT, TABLE_TRACES, TABLE_RESOURCES, TABLE_SCORERS],
});

const TEST_CONFIG: CloudflareWorkersConfig = {
  id: 'cloudflare-binding-test',
  bindings: {} as Env, // Will be populated in beforeAll
  keyPrefix: 'mastra-test', // Fixed prefix for test isolation
};

// Get KV namespaces from Miniflare
const kvBindings = {
  [TABLE_THREADS]: (await mf.getKVNamespace(TABLE_THREADS)) as KVNamespace,
  [TABLE_MESSAGES]: (await mf.getKVNamespace(TABLE_MESSAGES)) as KVNamespace,
  [TABLE_WORKFLOW_SNAPSHOT]: (await mf.getKVNamespace(TABLE_WORKFLOW_SNAPSHOT)) as KVNamespace,
  [TABLE_TRACES]: (await mf.getKVNamespace(TABLE_TRACES)) as KVNamespace,
  [TABLE_RESOURCES]: (await mf.getKVNamespace(TABLE_RESOURCES)) as KVNamespace,
  [TABLE_SCORERS]: (await mf.getKVNamespace(TABLE_SCORERS)) as KVNamespace,
};

// Set bindings in test config
TEST_CONFIG.bindings = kvBindings;

createTestSuite(new CloudflareStore(TEST_CONFIG));
