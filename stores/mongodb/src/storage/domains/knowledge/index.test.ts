import { createKnowledgeLegacyUpgradeTests, createKnowledgePageStoreTests } from '@internal/storage-test-utils';
import { MongoClient } from 'mongodb';
import { afterAll, vi } from 'vitest';

import { KnowledgeMongoDB } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const uri =
  process.env.MONGODB_URL ||
  process.env.MONGODB_RS_URL ||
  'mongodb://mongodb:mongodb@localhost:27018/?authSource=admin&directConnection=true&serverSelectionTimeoutMS=2000';

createKnowledgePageStoreTests(() => new KnowledgeMongoDB({ uri, dbName: 'knowledge_contract_test' }));

const LEGACY_DB = 'knowledge_legacy_test';
const client = new MongoClient(uri);
const db = client.db(LEGACY_DB);
afterAll(() => client.close());
const knowledgeCollections = async () =>
  (await db.listCollections({}, { nameOnly: true }).toArray())
    .map(collection => collection.name)
    .filter(name => name.startsWith('mastra_knowledge_'));

createKnowledgeLegacyUpgradeTests({
  createStore: () => new KnowledgeMongoDB({ uri, dbName: LEGACY_DB }),
  clear: async () => {
    await db.dropDatabase();
    await db.collection('existing_domain').insertOne({ id: 'preserved' });
  },
  // The collections @mastra/mongodb 1.24.1 created; documents only where rows are asked for.
  createPublishedLayout: async ({ rows }) => {
    for (const name of [
      'mastra_knowledge_nodes',
      'mastra_knowledge_records',
      'mastra_knowledge_semantic_outbox',
      'mastra_knowledge_mentions',
      'mastra_knowledge_activity',
      'mastra_knowledge_access_state',
    ]) {
      await db.createCollection(name);
    }
    await db
      .collection('mastra_knowledge_nodes')
      .createIndex({ type: 1, scopeKey: 1, canonicalName: 1 }, { unique: true });
    if (!rows) return;
    await db.collection('mastra_knowledge_access_state').insertOne({ id: 'knowledge', epoch: 1, schemaVersion: 2 });
    await db.collection('mastra_knowledge_nodes').insertOne({ id: '01LEGACY', name: 'Legacy' });
    await db.collection('mastra_knowledge_records').insertOne({ id: '01REC', node: '01LEGACY' });
    await db
      .collection('mastra_knowledge_mentions')
      .insertOne({ sourceType: 'record', sourceId: '01REC', recordId: '01REC' });
    await db.collection('mastra_knowledge_activity').insertOne({ id: '01ACT', action: 'create', recordType: 'node' });
  },
  recreateLegacyTables: async () => {
    await db.collection('mastra_knowledge_records').createIndex({ node: 1 });
    await db.collection('mastra_knowledge_semantic_outbox').createIndex({ id: 1 });
    await db.collection('mastra_knowledge_nodes').insertOne({ id: '01OLD', name: 'Old' });
  },
  knowledgeTables: knowledgeCollections,
  otherTableRows: () => db.collection('existing_domain').countDocuments(),
});
