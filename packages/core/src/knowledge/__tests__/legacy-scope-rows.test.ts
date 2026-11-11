import { describe, expect, it } from 'vitest';
import type { KnowledgeStorage } from '../../storage/domains/knowledge';
import { InMemoryStore } from '../../storage/mock';
import type { KnowledgeScopeDeclarations } from '../declarations';
import { KnowledgeDeclarationError } from '../declarations';
import { KnowledgeScopeRuntime } from '../scope-runtime';

const host = { author: 'host' };

// Before scope params matched exactly one segment, `org:acme:viewer` was an `org:$orgId` address
// (orgId "acme:viewer"), so scope rows like this one exist in stores written by older versions.
async function legacyStore() {
  const store: KnowledgeStorage = (await new InMemoryStore().getStore('knowledge'))!;
  await store.init();
  const { scope } = await store.materializeScope({
    address: 'org:acme:viewer',
    declaration: 'org:$orgId',
    name: 'org:acme:viewer',
    provenance: host,
  });
  await store.createPage({ parentId: scope.id, name: 'Legacy secret', provenance: host });
  return store;
}

const SIDE_TYPE: KnowledgeScopeDeclarations = {
  'org:$orgId': { access: [{ principal: 'self', role: 'editor' }] },
  'org:$orgId:viewer': { access: [{ principal: 'org:$orgId', role: 'viewer' }] },
};

describe('Knowledge scope rows stored under a different declaration than their address now matches', () => {
  it('grants nothing on them and keeps their pages out of reads', async () => {
    const store = await legacyStore();
    const runtime = new KnowledgeScopeRuntime(
      SIDE_TYPE,
      async () => store,
      () => {},
    );

    const read = await runtime.readScopeFor(['org:acme']);
    expect(read.addresses).not.toContain('org:acme:viewer');
    const { pages } = await store.listPages({ read });
    expect(pages.map(page => page.name)).not.toContain('Legacy secret');

    const [legacy] = await store.getScopesByAddress(['org:acme:viewer']);
    expect(await runtime.roleOn(['org:acme'], legacy!)).toBeNull();
    expect((await runtime.explainAccess(['org:acme'], { scope: 'org:acme:viewer' })).role).toBeNull();
  });

  it('refuses to adopt one as a scope of the new declaration', async () => {
    const store = await legacyStore();
    const runtime = new KnowledgeScopeRuntime(
      SIDE_TYPE,
      async () => store,
      () => {},
    );
    const error = await runtime.materializeScope('org:acme:viewer', ['org:acme'], host).catch(e => e);
    expect(error).toBeInstanceOf(KnowledgeDeclarationError);
    expect(error.message).toMatch(/"org:acme:viewer" was created from "org:\$orgId"/);
  });

  it('never resolves one as a belongsTo parent of the declaration that now matches it', async () => {
    const store = await legacyStore();
    const runtime = new KnowledgeScopeRuntime(
      {
        ...SIDE_TYPE,
        'doc:$docId': { belongsTo: 'org:$orgId:viewer', access: [{ principal: 'org:$orgId', role: 'viewer' }] },
      },
      async () => store,
      () => {},
    );
    const read = await runtime.readScopeFor(['org:acme']);
    expect(read !== 'all' && read.children).toEqual([]);
  });

  it('never lets one give belongsTo roles to a child placed under it', async () => {
    const store = await legacyStore();
    const [legacy] = await store.getScopesByAddress(['org:acme:viewer']);
    const { scope: doc } = await store.materializeScope({
      address: 'doc:d1',
      declaration: 'doc:$docId',
      name: 'doc:d1',
      parentId: legacy!.id,
      provenance: host,
    });
    const runtime = new KnowledgeScopeRuntime(
      {
        ...SIDE_TYPE,
        'doc:$docId': { belongsTo: 'org:$orgId:viewer', access: [{ principal: 'org:$orgId', role: 'editor' }] },
      },
      async () => store,
      () => {},
    );
    expect(await runtime.roleOn(['org:acme'], doc)).toBeNull();
    expect((await runtime.explainAccess(['org:acme'], { scope: 'doc:d1' })).role).toBeNull();
  });

  it('keeps reads its own declaration still grants by prefix, but no role', async () => {
    // A prefix grant on org:$orgId covered this row when it was written; reads under that grant stay,
    // as with any data written before the change. Nothing of org:$orgId:viewer reaches it.
    const store = await legacyStore();
    const runtime = new KnowledgeScopeRuntime(
      {
        ...SIDE_TYPE,
        'agent:$agentId': {},
        'org:$orgId': {
          access: [
            { principal: 'self', role: 'editor' },
            { principal: 'agent:support', role: 'viewer' },
          ],
        },
        'org:$orgId:viewer': { access: [{ principal: 'agent:other', role: 'viewer' }] },
      },
      async () => store,
      () => {},
    );
    const support = await runtime.readScopeFor(['agent:support']);
    expect((await store.listPages({ read: support })).pages.map(page => page.name)).toContain('Legacy secret');
    const [legacy] = await store.getScopesByAddress(['org:acme:viewer']);
    expect(await runtime.roleOn(['agent:support'], legacy!)).toBeNull();

    const other = await runtime.readScopeFor(['agent:other']);
    expect((await store.listPages({ read: other })).pages.map(page => page.name)).not.toContain('Legacy secret');
  });
});
