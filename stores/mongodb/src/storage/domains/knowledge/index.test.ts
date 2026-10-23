import { KnowledgeUnsupportedError } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { resolveMongoDBConfig } from '../../db';
import { KnowledgeMongoDB } from '.';

const connector = resolveMongoDBConfig({
  uri: process.env.MONGODB_URL || 'mongodb://localhost:27017',
  dbName: process.env.MONGODB_DB_NAME || 'mastra-test-db',
});

function createStore() {
  return new KnowledgeMongoDB({ connector });
}

describe('MongoDB canonical Knowledge support', () => {
  it('reports unsupported without initializing legacy Knowledge collections', async () => {
    const store = createStore();

    expect(store.getCapabilities()).toEqual({ supported: false, contractVersion: 1, schemaVersion: null });
    await expect(store.createNode({ name: 'Unsupported', scopeIds: [], isScope: false })).rejects.toBeInstanceOf(
      KnowledgeUnsupportedError,
    );
    await expect(store.dangerouslyClearAll()).rejects.toThrow('MongoDB does not support Knowledge.');
    expect(KnowledgeMongoDB.MANAGED_COLLECTIONS).toEqual([]);
  });
});
