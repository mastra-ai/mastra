import { createKnowledgePageStoreTests } from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import { describe, expect, it } from 'vitest';
import { KnowledgeLibSQL } from './index';

createKnowledgePageStoreTests(async () => {
  const store = new KnowledgeLibSQL({ client: createClient({ url: ':memory:' }) });
  await store.init();
  return store;
});

const who = { author: 'host' };

describe('KnowledgeLibSQL schema 4 wiring', () => {
  it('inits, serves pages, and resets', async () => {
    const store = new KnowledgeLibSQL({ client: createClient({ url: ':memory:' }) });
    await store.init();
    await store.init();
    const { scope } = await store.materializeScope({
      address: 'org:acme',
      declaration: 'org:$orgId',
      name: 'Acme',
      provenance: who,
    });
    const page = await store.createPage({ parentId: scope.id, name: 'Policy', provenance: who });
    expect((await store.getPage({ id: page.id, read: 'all' }))?.name).toBe('Policy');
    await store.dangerouslyReset();
    expect(await store.getPage({ id: page.id, read: 'all' })).toBeNull();
  });

  it('refuses a database that holds schema-2 tables until reset', async () => {
    const client = createClient({ url: ':memory:' });
    await client.execute('CREATE TABLE mastra_knowledge_nodes (id TEXT PRIMARY KEY)');
    const store = new KnowledgeLibSQL({ client });
    await expect(store.init()).rejects.toThrow(/reset/i);
    await store.dangerouslyReset();
    expect((await store.getScopesByAddress(['org:x'])).length).toBe(0);
  });
});
