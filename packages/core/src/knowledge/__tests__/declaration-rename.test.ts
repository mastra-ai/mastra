import { describe, expect, it, vi } from 'vitest';
import { InMemoryStore } from '../../storage';
import type { KnowledgeStorage } from '../../storage/domains/knowledge';
import { knowledgeMemoryScopes, KnowledgeDeclarationError } from '../declarations';
import type { KnowledgeScopeDeclarations } from '../declarations';
import { Knowledge } from '../index';

const memory = knowledgeMemoryScopes();
const host = { author: 'host' };

const OLD: KnowledgeScopeDeclarations = {
  ...memory,
  'team:$org:$team': {
    access: [{ principal: 'org:$org', role: 'viewer' }],
    children: [{ name: 'internal' }],
  },
};
const RENAMED: KnowledgeScopeDeclarations = {
  ...memory,
  'team:$orgId:$teamId': {
    access: [{ principal: 'org:$orgId', role: 'viewer' }],
    children: [{ name: 'internal' }],
  },
};

/** Creates team:acme:eng (and its internal child) with a page in it under the old declaration key. */
async function seedOld(store = new InMemoryStore()) {
  const knowledge = new Knowledge({ storage: store, scopes: OLD });
  const storage = await knowledge.getStorage();
  await knowledge.readScopeFor(['org:acme']);
  const team = (
    await storage.materializeScope({
      address: 'team:acme:eng',
      declaration: 'team:$org:$team',
      name: 'Eng',
      provenance: host,
      children: [{ address: 'team:acme:eng/internal', declaration: 'team:$org:$team/internal', name: 'Internal' }],
    })
  ).scope;
  await storage.createPage({ parentId: team.id, name: 'Runbook', provenance: host });
  return { store, storage };
}

const orgSees = async (knowledge: Knowledge, storage: KnowledgeStorage) =>
  (await storage.listPages({ read: await knowledge.readScopeFor(['org:acme']) })).pages.map(page => page.name);

describe('Knowledge renamed scope declaration keys', () => {
  it('fails loudly at first use when stored scopes carry a key the config no longer declares', async () => {
    const { store } = await seedOld();
    const knowledge = new Knowledge({ storage: store, scopes: RENAMED });
    const error = await knowledge.readScopeFor(['org:acme']).catch(e => e);
    expect(error).toBeInstanceOf(KnowledgeDeclarationError);
    expect(error.message).toBe(
      `Knowledge storage has scopes created from declarations this config doesn't declare: "team:$org:$team" (1 scope), "team:$org:$team/internal" (1 scope). ` +
        'Restore each key in scopes, rename it with knowledge.renameScopeDeclaration(from, to), or keep the key with no access rules to retire it.',
    );
  });

  it('accepts a retired key: still declared, with no access rules', async () => {
    const { store, storage } = await seedOld();
    const knowledge = new Knowledge({
      storage: store,
      scopes: { ...memory, 'team:$org:$team': { children: [{ name: 'internal' }] } },
    });
    expect(await orgSees(knowledge, storage)).toEqual([]);
  });

  it('renames stored scopes and their template children, restoring prefix reach', async () => {
    const { store, storage } = await seedOld();
    const knowledge = new Knowledge({ storage: store, scopes: RENAMED });
    expect(await knowledge.renameScopeDeclaration('team:$org:$team', 'team:$orgId:$teamId')).toBe(2);
    expect(await storage.listScopeDeclarations()).toEqual(
      expect.arrayContaining([
        { declaration: 'team:$orgId:$teamId', scopes: 1 },
        { declaration: 'team:$orgId:$teamId/internal', scopes: 1 },
      ]),
    );
    expect(await orgSees(knowledge, storage)).toEqual(['Runbook']);
  });

  it('refuses a rename whose stored addresses do not match the new pattern, changing nothing', async () => {
    const { store, storage } = await seedOld();
    const knowledge = new Knowledge({ storage: store, scopes: { ...memory, 'squad:$orgId:$teamId': {} } });
    const before = await storage.listScopeDeclarations();
    await expect(knowledge.renameScopeDeclaration('team:$org:$team', 'squad:$orgId:$teamId')).rejects.toThrow(
      `Can't rename scope declaration "team:$org:$team" to "squad:$orgId:$teamId": "team:acme:eng" doesn't match "squad:$orgId:$teamId", "team:acme:eng/internal" doesn't match "squad:$orgId:$teamId/internal". Nothing was renamed.`,
    );
    expect(await storage.listScopeDeclarations()).toEqual(before);
  });

  it('refuses a rename from a key still declared or to a key not declared', async () => {
    const { store } = await seedOld();
    await expect(
      new Knowledge({ storage: store, scopes: OLD }).renameScopeDeclaration('team:$org:$team', 'team:$orgId:$teamId'),
    ).rejects.toThrow(`Can't rename scope declaration "team:$org:$team": it is still declared.`);
    await expect(
      new Knowledge({ storage: store, scopes: memory }).renameScopeDeclaration(
        'team:$org:$team',
        'team:$orgId:$teamId',
      ),
    ).rejects.toThrow(`Can't rename scope declaration to "team:$orgId:$teamId": it isn't declared in scopes.`);
  });

  it('checks once per instance, and retries after a store error', async () => {
    const store = new InMemoryStore();
    const knowledge = new Knowledge({ storage: store, scopes: OLD });
    const storage = await knowledge.getStorage();
    const list = vi.spyOn(storage, 'listScopeDeclarations').mockRejectedValueOnce(new Error('store down'));
    await expect(knowledge.readScopeFor(['org:acme'])).rejects.toThrow('store down');
    await knowledge.readScopeFor(['org:acme']);
    await knowledge.readScopeFor(['org:acme']);
    expect(list).toHaveBeenCalledTimes(2);
  });
});
