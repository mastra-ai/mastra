import { randomUUID } from 'node:crypto';
import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import {
  KNOWLEDGE_STORAGE_CONTRACT_VERSION,
  KNOWLEDGE_STORAGE_SCHEMA_VERSION,
  TABLE_KNOWLEDGE_RECORDS,
  TABLE_KNOWLEDGE_RECORD_SCOPES,
  TABLE_KNOWLEDGE_SCHEMA,
  TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
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

  it('lists and claims scoped semantic work beyond a larger unrelated prefix', async () => {
    const store = createStore();
    await store.init();
    const collection = await connector.getCollection(TABLE_KNOWLEDGE_SEMANTIC_OUTBOX);
    const suffix = randomUUID();
    const hiddenScopeId = '00000000-0000-4000-8000-000000000091';
    const visibleScopeId = '00000000-0000-4000-8000-000000000092';
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const entries = Array.from({ length: 1001 }, (_, index) => ({
      id: `${suffix}-hidden-${String(index).padStart(4, '0')}`,
      idempotencyKey: `${suffix}-hidden-${index}`,
      documentId: `knowledge:node:${suffix}-hidden-${index}`,
      documentType: 'node',
      operation: 'delete',
      scopeIds: [hiddenScopeId],
      status: 'pending',
      attempts: 0,
      availableAt: createdAt,
      createdAt,
    }));
    const visibleId = `${suffix}-visible-after-prefix`;
    entries.push({
      id: visibleId,
      idempotencyKey: visibleId,
      documentId: `knowledge:node:${visibleId}`,
      documentType: 'node',
      operation: 'delete',
      scopeIds: [visibleScopeId],
      status: 'pending',
      attempts: 0,
      availableAt: createdAt,
      createdAt: new Date(createdAt.getTime() + 1),
    });
    try {
      await collection.insertMany(entries);
      await expect(store.listSemanticOutbox({ scopeIds: [visibleScopeId], limit: 1 })).resolves.toEqual([
        expect.objectContaining({ id: visibleId }),
      ]);
      await expect(
        store.claimSemanticOutbox({ workerId: 'scoped-worker', scopeIds: [visibleScopeId], limit: 1, now: createdAt }),
      ).resolves.toEqual([expect.objectContaining({ id: visibleId, claimedBy: 'scoped-worker' })]);
    } finally {
      await collection.deleteMany({ id: { $regex: `^${suffix}` } });
    }
  });

  it('filters current owner visibility before limiting scoped semantic work', async () => {
    const store = createStore();
    await store.init();
    const suffix = randomUUID();
    const hiddenScopeId = randomUUID();
    const visibleScopeId = randomUUID();
    const hiddenNodeId = randomUUID();
    const visibleNodeId = randomUUID();
    const visibleRecordId = randomUUID();
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const records = await connector.getCollection(TABLE_KNOWLEDGE_RECORDS);
    const recordScopes = await connector.getCollection(TABLE_KNOWLEDGE_RECORD_SCOPES);
    const outbox = await connector.getCollection(TABLE_KNOWLEDGE_SEMANTIC_OUTBOX);
    const nodes = await connector.getCollection('mastra_knowledge_nodes');
    const nodeScopes = await connector.getCollection('mastra_knowledge_node_scopes');
    const hiddenRecords = Array.from({ length: 1001 }, (_, index) => ({
      id: randomUUID(),
      nodeId: hiddenNodeId,
      text: `hidden ${index}`,
      metadata: {},
      version: 1,
      createdAt,
      updatedAt: createdAt,
    }));
    const recordIds = [...hiddenRecords.map(record => record.id), visibleRecordId];
    try {
      await store.createNode({ id: hiddenScopeId, name: `${suffix} hidden scope`, isScope: true, scopeIds: [] });
      await store.createNode({ id: visibleScopeId, name: `${suffix} visible scope`, isScope: true, scopeIds: [] });
      await store.createNode({ id: hiddenNodeId, name: `${suffix} hidden owner`, scopeIds: [hiddenScopeId] });
      await store.createNode({ id: visibleNodeId, name: `${suffix} visible owner`, scopeIds: [visibleScopeId] });
      await outbox.deleteMany({
        documentId: {
          $in: [hiddenScopeId, visibleScopeId, hiddenNodeId, visibleNodeId].map(id => `knowledge:node:${id}`),
        },
      });
      await records.insertMany([
        ...hiddenRecords,
        {
          id: visibleRecordId,
          nodeId: visibleNodeId,
          text: 'visible',
          metadata: {},
          version: 1,
          createdAt,
          updatedAt: createdAt,
        },
      ]);
      await recordScopes.insertMany(recordIds.map(recordId => ({ recordId, scopeNodeId: visibleScopeId })));
      await outbox.insertMany(
        recordIds.map((recordId, index) => ({
          id: `${suffix}-outbox-${String(index).padStart(4, '0')}`,
          idempotencyKey: `${suffix}-outbox-${recordId}`,
          documentId: `knowledge:record:${recordId}`,
          documentType: 'record',
          operation: 'upsert',
          scopeIds: [visibleScopeId],
          status: 'pending',
          attempts: 0,
          availableAt: createdAt,
          createdAt: new Date(createdAt.getTime() + index),
        })),
      );

      await expect(store.listSemanticOutbox({ scopeIds: [visibleScopeId], limit: 1 })).resolves.toEqual([
        expect.objectContaining({ documentId: `knowledge:record:${visibleRecordId}` }),
      ]);
      await expect(
        store.claimSemanticOutbox({
          workerId: 'owner-aware-worker',
          scopeIds: [visibleScopeId],
          limit: 1,
          now: new Date(createdAt.getTime() + 2000),
        }),
      ).resolves.toEqual([
        expect.objectContaining({ documentId: `knowledge:record:${visibleRecordId}`, claimedBy: 'owner-aware-worker' }),
      ]);
    } finally {
      await outbox.deleteMany({ id: { $regex: `^${suffix}` } });
      await recordScopes.deleteMany({ recordId: { $in: recordIds } });
      await records.deleteMany({ id: { $in: recordIds } });
      await nodeScopes.deleteMany({ nodeId: { $in: [hiddenScopeId, visibleScopeId, hiddenNodeId, visibleNodeId] } });
      await nodes.deleteMany({ id: { $in: [hiddenScopeId, visibleScopeId, hiddenNodeId, visibleNodeId] } });
    }
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
