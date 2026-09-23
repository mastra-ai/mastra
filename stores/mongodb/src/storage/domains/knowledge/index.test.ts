import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { resolveMongoDBConfig } from '../../db';
import { KnowledgeMongoDB } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const connector = resolveMongoDBConfig({
  uri: process.env.MONGODB_URL || 'mongodb://localhost:27017',
  dbName: process.env.MONGODB_DB_NAME || 'mastra-test-db',
});

const createStore = () => new KnowledgeMongoDB({ connector });
createKnowledgeStorageTests(createStore);

describe('MongoDB knowledge legacy documents', () => {
  it('reads documents written without the description field as undefined', async () => {
    const store = createStore();
    await store.init();
    await store.dangerouslyClearAll();
    const nodes = await connector.getCollection('mastra_knowledge_nodes');
    const legacyId = `legacy-${Date.now()}`;
    const now = new Date();
    await nodes.insertOne({
      id: legacyId,
      type: 'node',
      name: `Legacy ${legacyId}`,
      canonicalName: `legacy ${legacyId}`,
      kind: 'task',
      content: 'legacy body',
      scope: ['org:legacy-upgrade'],
      scopeKey: 'org:legacy-upgrade',
      version: 1,
      mergedInto: null,
      createdAt: now,
      updatedAt: now,
    });

    const legacy = await store.getNode(legacyId);
    expect(legacy?.description).toBeUndefined();
    expect(legacy?.content).toBe('legacy body');
  });
});

describe('MongoDB knowledge concurrency and indexes', () => {
  it('creates required uniqueness and claim indexes idempotently', async () => {
    const store = createStore();
    await store.init();
    await store.init();
    const nodes = await connector.getCollection('mastra_knowledge_nodes');
    const outbox = await connector.getCollection('mastra_knowledge_semantic_outbox');
    expect(Object.keys(await nodes.indexInformation())).toContain('type_1_scopeKey_1_canonicalName_1');
    expect(Object.keys(await outbox.indexInformation())).toContain('idempotencyKey_1');
  });

  it('allows only one concurrent CAS update', async () => {
    const store = createStore();
    await store.init();
    await store.dangerouslyClearAll();
    const node = await store.createNode({ name: 'CAS', kind: 'test', scope: ['org:acme'] });
    const results = await Promise.allSettled([
      store.updateNode({ id: node.id, version: 1, name: 'CAS one' }),
      store.updateNode({ id: node.id, version: 1, name: 'CAS two' }),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
  });

  it('advances concurrent cursors monotonically', async () => {
    const store = createStore();
    await store.init();
    await store.dangerouslyClearAll();
    await Promise.all([
      store.advanceCurationCursor({ sourceThreadId: 'thread', agent: 'curate', lastKnowledgeId: '01A' }),
      store.advanceCurationCursor({ sourceThreadId: 'thread', agent: 'curate', lastKnowledgeId: '01C' }),
      store.advanceCurationCursor({ sourceThreadId: 'thread', agent: 'curate', lastKnowledgeId: '01B' }),
    ]);
    expect((await store.getCurationCursor({ sourceThreadId: 'thread', agent: 'curate' }))?.lastKnowledgeId).toBe('01C');
  });
});

afterAll(async () => {
  await connector.close();
});
