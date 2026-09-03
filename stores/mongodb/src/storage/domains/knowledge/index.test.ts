import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import {
  KNOWLEDGE_STORAGE_CONTRACT_VERSION,
  KNOWLEDGE_STORAGE_SCHEMA_VERSION,
  TABLE_KNOWLEDGE_SCHEMA,
} from '@mastra/core/storage';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { resolveMongoDBConfig } from '../../db';
import { KnowledgeMongoDB } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const connector = resolveMongoDBConfig({
  uri: process.env.MONGODB_URL || 'mongodb://localhost:27017/?replicaSet=rs0',
  dbName: process.env.MONGODB_DB_NAME || 'mastra-test-db',
});

function createStore() {
  return new KnowledgeMongoDB({ connector });
}

createKnowledgeStorageTests(createStore);

describe('MongoDB canonical Knowledge support', () => {
  it('advertises the canonical contract and all managed collections', () => {
    expect(createStore().getCapabilities()).toEqual({
      supported: true,
      contractVersion: KNOWLEDGE_STORAGE_CONTRACT_VERSION,
      schemaVersion: KNOWLEDGE_STORAGE_SCHEMA_VERSION,
    });
    expect(KnowledgeMongoDB.MANAGED_COLLECTIONS).toHaveLength(16);
    expect(KnowledgeMongoDB.MANAGED_COLLECTIONS.every(name => name.startsWith('mastra_knowledge_'))).toBe(true);
  });

  it('persists the schema completion marker', async () => {
    const store = createStore();
    await store.init();
    const schema = await connector.getCollection(TABLE_KNOWLEDGE_SCHEMA);
    expect((await schema.findOne({ id: 'canonical' }))?.version).toBe(KNOWLEDGE_STORAGE_SCHEMA_VERSION);
  });

  it('creates required uniqueness and claim indexes idempotently', async () => {
    const store = createStore();
    await store.init();
    await store.init();
    const nodes = await connector.getCollection('mastra_knowledge_nodes');
    const outbox = await connector.getCollection('mastra_knowledge_semantic_outbox');
    expect(Object.keys(await nodes.indexInformation())).toContain('activeNameScopeKey_1');
    expect(Object.keys(await outbox.indexInformation())).toContain('idempotencyKey_1');
  });
});

afterAll(async () => {
  await connector.close();
});
