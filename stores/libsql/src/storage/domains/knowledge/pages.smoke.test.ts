import { createClient } from '@libsql/client';
import { describe, expect, it } from 'vitest';
import { KNOWLEDGE_PAGE_DDL, LibSQLKnowledgePages } from './pages';

async function setup() {
  const client = createClient({ url: ':memory:' });
  for (const sql of KNOWLEDGE_PAGE_DDL) await client.execute(sql);
  const store = new LibSQLKnowledgePages({
    read: client,
    transaction: async op => {
      const tx = await client.transaction('write');
      try {
        const r = await op(tx);
        await tx.commit();
        return r;
      } catch (e) {
        await tx.rollback();
        throw e;
      }
    },
  });
  return store;
}
const who = { author: 'host' };

describe('libsql page store smoke', () => {
  it('scopes, pages, notes, pins, visibility', async () => {
    const s = await setup();
    const org = (await s.materializeScope({ address: 'org:acme', declaration: 'org:$orgId', name: 'Acme', provenance: who })).scope;
    const team = (await s.materializeScope({ address: 'team:acme:a', declaration: 'team:$orgId:$teamId', name: 'A', parentId: org.id, provenance: who })).scope;
    const p = await s.createPage({ parentId: org.id, key: 'k', name: 'Policy', provenance: who });
    const q = await s.createPage({ parentId: p.id, name: 'Sub', provenance: who });
    const readOrg = { addresses: ['org:acme'], prefixes: [], children: [] };
    const readNone = { addresses: ['org:globex'], prefixes: [], children: [] };
    expect((await s.getPage({ id: p.id, read: readOrg }))?.name).toBe('Policy');
    expect(await s.getPage({ id: p.id, read: readNone })).toBeNull();
    expect((await s.getPageByKey({ scopeId: org.id, key: 'k', read: readOrg }))?.id).toBe(p.id);
    expect((await s.findPagesByName({ name: ' policy ', read: readOrg })).length).toBe(1);
    expect((await s.listChildPages({ parentId: p.id, read: readOrg })).pages.map(x => x.id)).toEqual([q.id]);
    const pref = { addresses: [], prefixes: [{ declaration: 'team:$orgId:$teamId', prefix: 'team:acme:' }], children: [] };
    expect((await s.getScopesByAddress(['team:acme:a']))[0]!.id).toBe(team.id);
    expect((await s.listChildScopes({ parentId: org.id })).pages.length).toBe(1);
    const tp = await s.createPage({ parentId: team.id, name: 'Playbook', provenance: who });
    expect((await s.getPage({ id: tp.id, read: pref }))?.name).toBe('Playbook');
    expect(await s.getPage({ id: p.id, read: pref })).toBeNull();
    const n = await s.addNote({ pageId: p.id, text: 'hello [[Sub]]', stampScopeIds: [org.id], mentions: [q.id], provenance: who });
    expect((await s.listNotes({ pageId: p.id, read: readOrg })).notes.length).toBe(1);
    expect((await s.listNotesMentioning({ pageId: q.id, read: readOrg })).notes[0]!.id).toBe(n.id);
    expect((await s.searchPages({ query: 'hello', read: readOrg })).length).toBe(1);
    expect((await s.searchPages({ query: 'hello', read: readNone })).length).toBe(0);
    await s.addPinAudience({ pageId: p.id, audience: ['role:acme:support'], createdBy: 'a' });
    expect((await s.listPins({ audience: ['role:acme:support'], read: readOrg })).pins.length).toBe(1);
    expect(await s.removePinAudience({ pageId: p.id, audience: ['role:acme:support'], removedBy: 'a' })).toBeNull();
    const moved = await s.movePage({ id: q.id, expectedVersion: 1, parentId: tp.id, provenance: who });
    expect(moved.scopeId).toBe(team.id);
    expect((await s.getNote({ id: n.id, read: readOrg })) ).toBeNull(); // mention now in unreadable scope
    const ev = await s.listPageActivity({ read: 'all' });
    expect(ev.events.length).toBeGreaterThan(5);
    await expect(s.updatePage({ id: p.id, expectedVersion: 9, provenance: who })).rejects.toThrow();
    const merged = await s.mergePages({ sourceId: tp.id, sourceVersion: 1, targetId: p.id, provenance: who });
    expect(merged.mergedInto).toBe(p.id);
    expect((await s.getPage({ id: q.id, read: 'all' }))!.scopeId).toBe(org.id);
  });
});
