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
});
