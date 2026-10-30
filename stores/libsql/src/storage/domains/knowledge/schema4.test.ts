import { createClient } from '@libsql/client';
import { describe, expect, it } from 'vitest';
import { KnowledgeLibSQL } from './index';

const who = { author: 'host' };

async function makeStore() {
  const store = new KnowledgeLibSQL({ client: createClient({ url: ':memory:' }) });
  await store.init();
  return store;
}

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

  it('rehomes a merged source into the target scope with its history', async () => {
    const store = await makeStore();
    const a = (
      await store.materializeScope({ address: 'org:a', declaration: 'org:$orgId', name: 'A', provenance: who })
    ).scope;
    const b = (
      await store.materializeScope({ address: 'org:b', declaration: 'org:$orgId', name: 'B', provenance: who })
    ).scope;
    const source = await store.createPage({ parentId: b.id, name: 'Source', provenance: who });
    const target = await store.createPage({ parentId: a.id, name: 'Target', provenance: who });
    await store.mergePages({ sourceId: source.id, sourceVersion: 1, targetId: target.id, provenance: who });
    expect((await store.getPage({ id: source.id, read: 'all', includeDeleted: true }))?.scopeId).toBe(a.id);
    const readA = { addresses: ['org:a'], prefixes: [], children: [] };
    const readB = { addresses: ['org:b'], prefixes: [], children: [] };
    expect((await store.listPageActivity({ pageId: source.id, read: readA })).events.length).toBeGreaterThan(0);
    expect((await store.listPageActivity({ pageId: source.id, read: readB })).events.length).toBe(0);
  });

  it('links an unlinked scope on its first later run and keeps that parent afterwards', async () => {
    const store = await makeStore();
    const p1 = (
      await store.materializeScope({ address: 'org:p1', declaration: 'org:$orgId', name: 'P1', provenance: who })
    ).scope;
    const p2 = (
      await store.materializeScope({ address: 'org:p2', declaration: 'org:$orgId', name: 'P2', provenance: who })
    ).scope;
    const first = await store.materializeScope({
      address: 'team:x',
      declaration: 'team:$orgId',
      name: 'X',
      provenance: who,
    });
    expect(first.scope.parentId).toBeNull();
    const linked = await store.materializeScope({
      address: 'team:x',
      declaration: 'team:$orgId',
      name: 'X',
      parentId: p1.id,
      provenance: who,
    });
    expect(linked.scope.parentId).toBe(p1.id);
    expect(linked.parentConflict).toBeUndefined();
    const again = await store.materializeScope({
      address: 'team:x',
      declaration: 'team:$orgId',
      name: 'X',
      parentId: p2.id,
      provenance: who,
    });
    expect(again.scope.parentId).toBe(p1.id);
    expect(again.parentConflict).toEqual({ existingParentId: p1.id, requestedParentId: p2.id });
  });

  it('reads a prefix as an exact code-point range, including the highest code points', async () => {
    const store = await makeStore();
    const addresses = ['p:\u{10FFFF}x', 'p:\u{1F600}x', 'p:ax', 'p:Ax', 'q:ax'];
    const pageByAddress: Record<string, string> = {};
    for (const address of addresses) {
      const { scope } = await store.materializeScope({ address, declaration: 'p:$id', name: address, provenance: who });
      const page = await store.createPage({ parentId: scope.id, name: `in ${address}`, provenance: who });
      pageByAddress[address] = page.name;
    }
    const names = async (prefix: string) =>
      (
        await store.listPages({
          read: { addresses: [], prefixes: [{ declaration: 'p:$id', prefix }], children: [] },
          limit: 50,
        })
      ).pages
        .map(page => page.name)
        .sort();
    expect(await names('p:')).toEqual(['in p:\u{10FFFF}x', 'in p:\u{1F600}x', 'in p:Ax', 'in p:ax'].sort());
    expect(await names('p:\u{10FFFF}')).toEqual(['in p:\u{10FFFF}x']);
    expect(await names('p:\u{1F600}')).toEqual(['in p:\u{1F600}x']);
    expect(await names('p:a')).toEqual(['in p:ax']);
    expect(await names('')).toHaveLength(5);
    await store.dangerouslyReset();
  });

  it('keeps the pin audience index in step with add, remove, merge and delete', async () => {
    const store = await makeStore();
    const { scope } = await store.materializeScope({
      address: 'org:acme',
      declaration: 'org:$orgId',
      name: 'Acme',
      provenance: who,
    });
    const a = await store.createPage({ parentId: scope.id, name: 'A', body: 'x', provenance: who });
    const b = await store.createPage({ parentId: scope.id, name: 'B', body: 'y', provenance: who });
    const c = await store.createPage({ parentId: scope.id, name: 'C', body: 'z', provenance: who });
    const listed = async (audience: string[]) =>
      (await store.listPins({ audience, read: 'all', limit: 50 })).pins.map(pin => pin.pageName).sort();
    await store.addPinAudience({ pageId: a.id, audience: ['r:1', 'r:2'], createdBy: 'host' });
    await store.addPinAudience({ pageId: b.id, audience: ['r:3'], createdBy: 'host' });
    await store.addPinAudience({ pageId: c.id, audience: ['r:2'], createdBy: 'host' });
    expect(await listed(['r:2'])).toEqual(['A', 'C']);
    await store.removePinAudience({ pageId: a.id, audience: ['r:2'], removedBy: 'host' });
    expect(await listed(['r:2'])).toEqual(['C']);
    expect(await listed(['r:1', 'r:3'])).toEqual(['A', 'B']);
    await store.mergePages({ sourceId: b.id, targetId: a.id, sourceVersion: b.version, provenance: who });
    expect(await listed(['r:3'])).toEqual(['A']);
    await store.deletePage({ id: c.id, expectedVersion: c.version, deletedBy: 'host' });
    expect(await listed(['r:2'])).toEqual([]);
    await store.removePinAudience({ pageId: a.id, audience: ['r:1', 'r:3'], removedBy: 'host' });
    expect(await listed(['r:1', 'r:3'])).toEqual([]);
    await store.dangerouslyReset();
  });
});
