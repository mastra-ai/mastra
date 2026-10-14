import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Knowledge } from '@mastra/core/knowledge';
import type { MastraCompositeStore } from '@mastra/core/storage';
import { InMemoryStore } from '@mastra/core/storage';
import { LibSQLStore } from '@mastra/libsql';
import { KnowledgeSemanticIndexCoordinator } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import { afterEach, describe, expect, it } from 'vitest';

type Adapter = 'inmemory' | 'libsql' | 'pg';
// Same adapter selection as knowledge-v2-wave-1.test.ts: PostgreSQL runs when DB_URL is set (CI).
const adapters: Adapter[] = process.env.DB_URL ? ['inmemory', 'libsql', 'pg'] : ['inmemory', 'libsql'];
const postgresConnectionString = process.env.DB_URL || 'postgres://postgres:password@localhost:5434/mastra';
const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function openStorage(adapter: Adapter): Promise<MastraCompositeStore> {
  const id = `semantic-visibility-${randomUUID()}`;
  if (adapter === 'inmemory') return new InMemoryStore();
  if (adapter === 'libsql') {
    const directory = await mkdtemp(join(tmpdir(), 'knowledge-semantic-visibility-'));
    const storage = new LibSQLStore({ id, url: `file:${join(directory, 'store.db')}` });
    cleanups.push(async () => {
      await storage.close();
      await rm(directory, { recursive: true, force: true });
    });
    return storage;
  }
  const schemaName = `knowledge_semantic_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const storage = new PostgresStore({ id, connectionString: postgresConnectionString, schemaName });
  cleanups.push(async () => {
    await storage.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await storage.close();
  });
  return storage;
}

const INDEX = 'knowledge_documents_dimension_3';

describe.each(adapters)('Knowledge semantic search visibility (%s)', adapter => {
  it('never surfaces a node through a stale vector whose scope_ids are wider than its current scopes', async () => {
    const storage = await openStorage(adapter);
    await storage.init();
    const knowledge = new Knowledge({ id: 'default', storage });
    const store = await knowledge.getStorage();
    for (const address of ['resource:alice', 'resource:bob']) {
      await knowledge.materializeScope({ address, contextualScopeAddress: address });
    }
    const alice = (await store.getScopeAddress('resource:alice'))!.scopeNodeId;
    const bob = (await store.getScopeAddress('resource:bob'))!.scopeNodeId;
    const node = await store.createNode({ name: 'Alice Secret', kind: 'note', scopeIds: [alice] });
    const record = await store.createRecord({ node: { id: node.id }, text: 'private detail', scopeIds: [alice] });

    // A vector written before the node was narrowed (or by a worker whose claim expired) still
    // carries both scopes in its metadata.
    const stale = (type: 'node' | 'record', id: string) => ({
      id: `knowledge:${type}:${id}`,
      score: 1,
      metadata: { document_type: type, record_id: id, name: node.name, text: 'stale', scope_ids: [alice, bob] },
    });
    const vector = {
      listIndexes: async () => [INDEX],
      createIndex: async () => {},
      deleteVectors: async () => {},
      upsert: async () => [],
      query: async () => [stale('node', node.id), stale('record', record.id)],
    } as any;
    const embedder = {
      specificationVersion: 'v2',
      provider: 'test',
      modelId: 'test-embedder',
      maxEmbeddingsPerCall: 10,
      supportsParallelCalls: true,
      doEmbed: async ({ values }: { values: string[] }) => ({ embeddings: values.map(() => [0.1, 0.2, 0.3]) }),
    } as any;
    const coordinator = new KnowledgeSemanticIndexCoordinator({ knowledge: store, vector, embedder });
    await coordinator.drain();

    expect((await coordinator.search('secret', [bob])).map((hit: { id: string }) => hit.id)).toEqual([]);
    expect((await coordinator.search('secret', [alice])).map((hit: { id: string }) => hit.id).sort()).toEqual(
      [`knowledge:node:${node.id}`, `knowledge:record:${record.id}`].sort(),
    );
  });
});
