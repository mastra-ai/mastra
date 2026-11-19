import { Knowledge, knowledgeMemoryScopes } from '@mastra/core/knowledge';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { knowledgeSessionTags, resolveKnowledgeSessionScopes } from './knowledge-scope.js';

describe('resolveKnowledgeSessionScopes', () => {
  it("acts with the host's scopes as given in a local session, adding no org", () => {
    expect(resolveKnowledgeSessionScopes(undefined)).toEqual({ resolved: true, scopes: [] });
    expect(resolveKnowledgeSessionScopes({ projectPath: '/tmp/p' } as never, ['resource:u1'])).toEqual({
      resolved: true,
      scopes: ['resource:u1'],
    });
    const member = ['org:self', 'team:self:x'];
    expect(resolveKnowledgeSessionScopes(undefined, member)).toEqual({ resolved: true, scopes: member });
  });

  it('requires the Factory org and project tags, trimmed the way the seeder stores them', () => {
    expect(resolveKnowledgeSessionScopes({ factoryOrgId: ' org-1 ', factoryProjectId: 'proj-1' } as never)).toEqual({
      resolved: true,
      scopes: ['org:org-1', 'project:proj-1'],
    });
    expect(resolveKnowledgeSessionScopes({ factoryOrgId: 'org-1' } as never, ['agent:a'])).toEqual({
      resolved: true,
      scopes: ['agent:a', 'org:org-1'],
    });
  });

  it('encodes Factory org and project ids into one canonical segment', () => {
    expect(resolveKnowledgeSessionScopes({ factoryOrgId: 'acme:eu', factoryProjectId: 'p/1' } as never)).toEqual({
      resolved: true,
      scopes: ['org:acme%3Aeu', 'project:p%2F1'],
    });
    expect(resolveKnowledgeSessionScopes({ factoryOrgId: 'acme:eu' } as never, ['org:acme%3Aeu'])).toEqual({
      resolved: true,
      scopes: ['org:acme%3Aeu'],
    });
  });

  it('keeps two Factory projects apart and refuses a host tag that names another project', () => {
    const a = resolveKnowledgeSessionScopes({ factoryOrgId: 'o', factoryProjectId: 'a' } as never);
    const b = resolveKnowledgeSessionScopes({ factoryOrgId: 'o', factoryProjectId: 'b' } as never);
    expect(a.resolved && knowledgeSessionTags(a.scopes)).toEqual(['org:o', 'project:a']);
    expect(b.resolved && knowledgeSessionTags(b.scopes)).toEqual(['org:o', 'project:b']);

    expect(resolveKnowledgeSessionScopes({ factoryOrgId: 'o', factoryProjectId: 'a' } as never, ['project:b'])).toEqual(
      { resolved: false, reason: "Scope project:b conflicts with this Factory session's project:a." },
    );
  });

  it('fails closed for Factory-owned sessions without a resolved org', () => {
    const closed = { resolved: false, reason: 'This Factory session has no resolved organization.' };
    expect(resolveKnowledgeSessionScopes({ factoryProjectId: 'proj-1' } as never)).toEqual(closed);
    expect(resolveKnowledgeSessionScopes({ factoryProjectId: 'proj-1', factoryOrgId: '   ' } as never)).toEqual(closed);
    expect(resolveKnowledgeSessionScopes({ factoryOrgUnresolved: true } as never)).toEqual(closed);
  });

  it("acts with the host's org scope alone, so a session compiles and reads on an instance that declares only that org", async () => {
    const storage = new InMemoryStore();
    const knowledge = new Knowledge({
      storage,
      scopes: { ...knowledgeMemoryScopes(), 'org:$orgId': { access: [{ principal: 'self', role: 'editor' }] } },
    });
    const store = (await storage.getStore('knowledge'))!;
    const provenance = { author: 'host' };
    const org = (
      await store.materializeScope({ address: 'org:plat', declaration: 'org:$orgId', name: 'Org', provenance })
    ).scope;
    await store.createPage({ parentId: org.id, name: 'Handbook', provenance });
    const state = { factoryOrgId: 'fac', factoryProjectId: 'p1' } as never;

    const session = resolveKnowledgeSessionScopes(state, ['org:plat']);
    expect(session).toEqual({ resolved: true, scopes: ['org:plat'] });
    const read = await knowledge.readScopeFor(session.resolved ? session.scopes : []);
    const { pages } = await store.listPages({ read, scopeId: org.id });
    expect(pages.map(page => page.name)).toEqual(['Handbook']);

    // Without it, the session's own project: tag is undeclared there and every run fails to compile.
    const own = resolveKnowledgeSessionScopes(state);
    await expect(knowledge.readScopeFor(own.resolved ? own.scopes : [])).rejects.toThrow(/project:p1/);
  });

  it("refuses a host resource: or thread: tag, and a host project: beside the host's org scope", () => {
    const state = { factoryOrgId: 'fac', factoryProjectId: 'p1' } as never;
    expect(resolveKnowledgeSessionScopes(state, ['org:plat', 'project:p1'])).toEqual({
      resolved: false,
      reason: "Scope project:p1 can't be held with the host's org:plat.",
    });
    // A host resource: or thread: tag is refused with or without a host org, so it never reaches a read.
    for (const host of [['org:plat'], []]) {
      for (const tag of ['resource:u1', 'thread:t1']) {
        expect(resolveKnowledgeSessionScopes(state, [...host, tag])).toEqual({
          resolved: false,
          reason: `Scope ${tag} is a run's identity and can't be a host scope.`,
        });
      }
    }
    // Local sessions keep taking the host's scopes as given.
    expect(resolveKnowledgeSessionScopes(undefined, ['org:plat', 'project:p1'])).toEqual({
      resolved: true,
      scopes: ['org:plat', 'project:p1'],
    });
  });
});
