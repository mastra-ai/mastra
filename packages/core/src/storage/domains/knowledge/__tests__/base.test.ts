import { describe, expect, it } from 'vitest';

import { InMemoryDB } from '../../inmemory-db';
import {
  assertKnowledgeSchemaCompatible,
  createKnowledgeUlid,
  inspectKnowledgeSchema,
  KnowledgeSchemaResetRequiredError,
  KNOWLEDGE_STORAGE_CONTRACT_VERSION,
  KNOWLEDGE_STORAGE_SCHEMA_VERSION,
} from '../base';
import { InMemoryKnowledgeStorage } from '../inmemory';

const host = { author: 'host' };

async function seedPage(store: InMemoryKnowledgeStorage) {
  const { scope } = await store.materializeScope({
    address: 'resource:mastra',
    declaration: 'resource:$resourceId',
    name: 'resource:mastra',
    parentId: null,
    provenance: host,
  });
  return store.createPage({ parentId: scope.id, name: 'Keep me', provenance: host });
}

describe('Knowledge storage base', () => {
  it('keeps knowledge ULIDs monotonic when the clock moves backwards', () => {
    const first = createKnowledgeUlid(2);
    const second = createKnowledgeUlid(1);

    expect(second > first).toBe(true);
  });

  it('reports the schema-4 contract and inspects schema without mutating Knowledge data', async () => {
    const store = new InMemoryKnowledgeStorage({ db: new InMemoryDB() });
    const page = await seedPage(store);

    expect(store.getCapabilities()).toEqual({
      contractVersion: KNOWLEDGE_STORAGE_CONTRACT_VERSION,
      schemaVersion: KNOWLEDGE_STORAGE_SCHEMA_VERSION,
      supportsSchemaInspection: true,
      supportsExplicitReset: true,
    });
    expect(KNOWLEDGE_STORAGE_SCHEMA_VERSION).toBe(4);
    expect(await store.inspectSchema()).toEqual({
      status: 'compatible',
      schemaVersion: KNOWLEDGE_STORAGE_SCHEMA_VERSION,
    });
    expect(await store.getPage({ id: page.id, read: 'all' })).toEqual(page);
  });

  it('classifies incompatible schema snapshots without mutating probe results', () => {
    const tableNames = Object.freeze(['mastra_knowledge_nodes', 'mastra_knowledge_records']);
    const snapshot = Object.freeze({
      available: true,
      tableNames,
      schemaVersion: 2,
      reason: 'schema-2 node tables detected',
    });

    const inspection = inspectKnowledgeSchema(snapshot);

    expect(inspection).toEqual({
      status: 'incompatible-reset-required',
      schemaVersion: 2,
      reason: 'schema-2 node tables detected',
    });
    expect(snapshot.tableNames).toBe(tableNames);
    expect(() => assertKnowledgeSchemaCompatible(inspection)).toThrow(KnowledgeSchemaResetRequiredError);
    expect(() => assertKnowledgeSchemaCompatible(inspection)).toThrow(
      'Knowledge schema reset required: schema-2 node tables detected. Existing Knowledge data is not migrated. To replace it, call `await storage.stores?.knowledge?.dangerouslyReset()`, which deletes every Knowledge row and nothing else.',
    );
    expect(inspectKnowledgeSchema({ available: true, tableNames: [] })).toEqual({
      status: 'uninitialized',
      schemaVersion: null,
    });
    expect(
      inspectKnowledgeSchema({
        available: true,
        tableNames: ['mastra_knowledge_pages'],
        schemaVersion: KNOWLEDGE_STORAGE_SCHEMA_VERSION,
      }),
    ).toEqual({ status: 'compatible', schemaVersion: KNOWLEDGE_STORAGE_SCHEMA_VERSION });
    expect(inspectKnowledgeSchema({ available: false, tableNames: [], reason: 'adapter offline' })).toEqual({
      status: 'unavailable',
      schemaVersion: null,
      reason: 'adapter offline',
    });
    expect(() => assertKnowledgeSchemaCompatible({ status: 'uninitialized', schemaVersion: null })).not.toThrow();
  });

  it('resets only Knowledge-owned state', async () => {
    const db = new InMemoryDB();
    const store = new InMemoryKnowledgeStorage({ db });
    const now = new Date();
    db.threads.set('thread-1', { id: 'thread-1', resourceId: 'resource-1', createdAt: now, updatedAt: now });
    const page = await seedPage(store);

    await store.dangerouslyReset();

    expect(await store.getPage({ id: page.id, read: 'all' })).toBeNull();
    expect(await store.getScopesByAddress(['resource:mastra'])).toEqual([]);
    expect(db.threads.has('thread-1')).toBe(true);
  });
});
