import { describe, expect, it } from 'vitest';

import { InMemoryDB } from '../../inmemory-db';
import { KnowledgeStorage, KnowledgeUnsupportedCapabilityError } from '../base';
import { InMemoryKnowledgeStorage } from '../inmemory';
import { KnowledgePageKeyConflictError } from '../pages';

const who = { author: 'importer:test' };

async function setup() {
  const store = new InMemoryKnowledgeStorage({ db: new InMemoryDB() });
  const { scope } = await store.materializeScope({
    address: 'org:acme',
    declaration: 'org:$orgId',
    name: 'Acme',
    provenance: who,
  });
  const keys = async () =>
    (await store.listChildPages({ parentId: scope.id, read: 'all' })).pages.map(page => page.key).sort();
  return { store, scopeId: scope.id, keys };
}

// The real-database contract (a second reader, importer rows in the same transaction) runs against
// LibSQL and Postgres in stores/_test-utils. In memory, transactions roll back by snapshot.
describe('InMemoryKnowledgeStorage.transaction', () => {
  it('commits every write when the operation resolves', async () => {
    const { store, scopeId, keys } = await setup();
    await store.transaction(async tx => {
      await tx.createPage({ parentId: scopeId, key: 'alpha', name: 'Alpha', provenance: who });
      await tx.createPage({ parentId: scopeId, key: 'beta', name: 'Beta', provenance: who });
    });
    expect(await keys()).toEqual(['alpha', 'beta']);
  });

  it('rolls every write back when the operation throws after writing', async () => {
    const { store, scopeId, keys } = await setup();
    await store.createPage({ parentId: scopeId, key: 'before', name: 'Before', provenance: who });
    await expect(
      store.transaction(async tx => {
        const page = await tx.createPage({ parentId: scopeId, key: 'alpha', name: 'Alpha', provenance: who });
        await tx.updatePage({ id: page.id, expectedVersion: page.version, body: 'changed', provenance: who });
        throw new Error('crash after the page write');
      }),
    ).rejects.toThrow('crash after the page write');
    expect(await keys()).toEqual(['before']);
  });

  it('undoes only a refused write inside the transaction, and the rest commits', async () => {
    const { store, scopeId, keys } = await setup();
    await store.createPage({ parentId: scopeId, key: 'beta', name: 'Written by a person', provenance: who });
    await store.transaction(async tx => {
      await tx.createPage({ parentId: scopeId, key: 'alpha', name: 'Alpha', provenance: who });
      await expect(
        tx.createPage({ parentId: scopeId, key: 'beta', name: 'Imported', provenance: who }),
      ).rejects.toBeInstanceOf(KnowledgePageKeyConflictError);
    });
    expect(await keys()).toEqual(['alpha', 'beta']);
    const kept = await store.getPageByPath({ scopeId, path: ['beta'], read: 'all' });
    expect(kept?.name).toBe('Written by a person');
  });

  it('joins a transaction started inside it', async () => {
    const { store, scopeId, keys } = await setup();
    await expect(
      store.transaction(async tx => {
        await tx.transaction(inner =>
          inner.createPage({ parentId: scopeId, key: 'alpha', name: 'A', provenance: who }),
        );
        throw new Error('roll back the outer one');
      }),
    ).rejects.toThrow('roll back the outer one');
    expect(await keys()).toEqual([]);
  });

  it('runs transactions one at a time', async () => {
    const { store, scopeId, keys } = await setup();
    const order: string[] = [];
    const first = store.transaction(async tx => {
      order.push('first:start');
      await new Promise(resolve => setTimeout(resolve, 10));
      await tx.createPage({ parentId: scopeId, key: 'alpha', name: 'A', provenance: who });
      order.push('first:end');
      throw new Error('first fails');
    });
    const second = store.transaction(async tx => {
      order.push('second:start');
      await tx.createPage({ parentId: scopeId, key: 'beta', name: 'B', provenance: who });
    });
    await expect(first).rejects.toThrow('first fails');
    await second;
    expect(order).toEqual(['first:start', 'first:end', 'second:start']);
    expect(await keys()).toEqual(['beta']);
  });
});

describe('InMemoryKnowledgeStorage.transaction: known limits', () => {
  // One process, no second connection: a write made on the store itself (not the view) while a
  // transaction is open shares that transaction's state. It is visible at once and is undone if the
  // transaction rolls back. Real stores isolate it; only in-memory tests may rely on this.
  it('does not isolate a write made outside the view while a transaction is open', async () => {
    const { store, scopeId, keys } = await setup();
    let release!: () => void;
    const held = new Promise<void>(resolve => (release = resolve));
    let opened!: () => void;
    const open = new Promise<void>(resolve => (opened = resolve));
    const failing = store.transaction(async tx => {
      await tx.createPage({ parentId: scopeId, key: 'inside', name: 'Inside', provenance: who });
      opened();
      await held;
      throw new Error('roll back');
    });
    await open;
    expect(await keys()).toEqual(['inside']);
    await store.createPage({ parentId: scopeId, key: 'outside', name: 'Outside', provenance: who });
    release();
    await expect(failing).rejects.toThrow('roll back');
    expect(await keys()).toEqual([]);
  });

  it('rolls importer rows back with the pages', async () => {
    const { store, scopeId, keys } = await setup();
    await store.importers.registerBinding({ id: 'b1', importer: 'notion', target: 'org:acme#notion' });
    await expect(
      store.transaction(async tx => {
        await tx.createPage({ parentId: scopeId, key: 'alpha', name: 'Alpha', provenance: who });
        await tx.importers!.setState('b1', { cursor: 'c1' });
        throw new Error('crash');
      }),
    ).rejects.toThrow('crash');
    expect(await keys()).toEqual([]);
    expect(await store.importers.getState('b1')).toEqual({});
  });
});

describe('KnowledgeStorage.transaction on an adapter without it', () => {
  it('refuses rather than run the operation without a transaction', async () => {
    // Like a MySQL or MongoDB Knowledge store today.
    class NoTransactions extends KnowledgeStorage {
      async init() {}
      async dangerouslyClearAll() {}
    }
    const store = new NoTransactions();
    let ran = false;
    await expect(
      store.transaction(async () => {
        ran = true;
      }),
    ).rejects.toBeInstanceOf(KnowledgeUnsupportedCapabilityError);
    expect(ran).toBe(false);
    expect(store.getCapabilities().supportsTransactions).toBeFalsy();
  });
});
