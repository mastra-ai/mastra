import { beforeEach, describe, expect, it } from 'vitest';
import type { KnowledgeReadScope, KnowledgeStorage } from '../../storage/domains/knowledge';
import { InMemoryStore } from '../../storage/mock';
import { knowledgeReadScopeFor, knowledgeRoleOn } from '../access';
import { compileKnowledgeScopes, knowledgeMemoryScopes } from '../declarations';

const declarations = {
  ...knowledgeMemoryScopes(),
  'team:$orgId:$teamId': {
    access: [
      { principal: 'self', role: 'editor' as const },
      { principal: 'org:$orgId', role: 'viewer' as const },
    ],
    belongsTo: 'org:$orgId',
  },
  'role:$orgId:admin': {},
  'policy:$orgId': {
    access: [
      { principal: 'org:$orgId', role: 'viewer' as const },
      { principal: 'role:$orgId:admin', role: 'owner' as const },
    ],
  },
  'account:$orgId:$accountId': {
    access: [{ principal: 'self', role: 'editor' as const }],
    children: [{ name: 'internal', access: [{ principal: 'role:$orgId:admin', role: 'editor' as const }] }],
  },
  'project:$projectId': {
    belongsTo: 'team:$orgId:$teamId',
    access: [{ principal: 'team:$orgId:$teamId', role: 'contributor' as const }],
  },
  'feature:$orgId:$featureId': {},
  'feature:acme:a': {
    access: [
      { principal: 'team:acme:eng', role: 'editor' as const },
      { principal: 'role:$orgId:admin', role: 'viewer' as const },
    ],
  },
};

const compiled = compileKnowledgeScopes(declarations);
const host = { author: 'host' };

describe('knowledge one-hop access', () => {
  let store: KnowledgeStorage;

  beforeEach(async () => {
    store = (await new InMemoryStore().getStore('knowledge'))!;
    await store.init();
  });

  const scope = async (address: string, parentId?: string) => {
    const match = compiled.match(address)!;
    const { scope } = await store.materializeScope({
      address,
      declaration: match.declaration,
      name: address,
      parentId,
      provenance: host,
    });
    return scope;
  };
  const readScope = (principals: string[]) =>
    knowledgeReadScopeFor(compiled, principals, addresses => store.getScopesByAddress(addresses));
  const readable = async (read: KnowledgeReadScope, ids: string[]) => {
    const out: string[] = [];
    for (const id of ids) {
      const page = await store.getPage({ id, read });
      if (page) out.push(page.address!);
    }
    return out.sort();
  };

  it('reads exactly the scopes declared rules give the held scopes a role on, and nothing more', async () => {
    const acme = await scope('org:acme');
    const globex = await scope('org:globex');
    const eng = await scope('team:acme:eng', acme.id);
    const sales = await scope('team:acme:sales', acme.id);
    const globexEng = await scope('team:globex:eng', globex.id);
    const policy = await scope('policy:acme');
    const globexPolicy = await scope('policy:globex');
    const account = await scope('account:acme:1');
    const internal = await scope('account:acme:1/internal', account.id);
    const all = [acme, globex, eng, sales, globexEng, policy, globexPolicy, account, internal].map(page => page.id);

    // org:acme holds itself (self editor), every acme team by prefix, and acme's policy.
    expect(await readable(await readScope(['org:acme']), all)).toEqual([
      'org:acme',
      'policy:acme',
      'team:acme:eng',
      'team:acme:sales',
    ]);
    // An admin role reaches the policy and the internal child, not the account itself or the org.
    expect(await readable(await readScope(['role:acme:admin']), all)).toEqual([
      'account:acme:1/internal',
      'policy:acme',
    ]);
    expect(await readable(await readScope(['account:acme:1']), all)).toEqual(['account:acme:1']);
  });

  it('never chains: a scope reached through a rule does not act as a principal', async () => {
    const acme = await scope('org:acme');
    const eng = await scope('team:acme:eng', acme.id);
    const project = await scope('project:p1', eng.id);
    // org:acme reaches team:acme:eng, and team:acme:eng would reach project:p1, but only one hop counts.
    expect(await readable(await readScope(['org:acme']), [eng.id, project.id])).toEqual(['team:acme:eng']);
    expect(await readable(await readScope(['team:acme:eng']), [eng.id, project.id])).toEqual([
      'project:p1',
      'team:acme:eng',
    ]);
  });

  it('reaches belongsTo children through the bound parent scope page only', async () => {
    const acme = await scope('org:acme');
    const eng = await scope('team:acme:eng', acme.id);
    const sales = await scope('team:acme:sales', acme.id);
    const p1 = await scope('project:p1', eng.id);
    const p2 = await scope('project:p2', sales.id);
    const read = await readScope(['team:acme:eng']);
    expect(read).toMatchObject({ children: [{ declaration: 'project:$projectId', parentId: eng.id }] });
    expect(await readable(read, [p1.id, p2.id])).toEqual(['project:p1']);
  });

  it('applies concrete-address rules to that address only', async () => {
    const a = await scope('feature:acme:a');
    const b = await scope('feature:acme:b');
    expect(await readable(await readScope(['team:acme:eng']), [a.id, b.id])).toEqual(['feature:acme:a']);
    expect(await readable(await readScope(['team:acme:sales']), [a.id, b.id])).toEqual([]);
    // A parameterized principal on a concrete address binds from that address: acme's admins, not globex's.
    expect(await readable(await readScope(['role:acme:admin']), [a.id, b.id])).toEqual(['feature:acme:a']);
    expect(await readable(await readScope(['role:globex:admin']), [a.id, b.id])).toEqual([]);
  });

  it('reads nothing for no principals or undeclared ones', async () => {
    const acme = await scope('org:acme');
    for (const principals of [[], ['user:acme:42'], ['nonsense']]) {
      const read = await readScope(principals);
      expect(read).toEqual({ addresses: [], prefixes: [], children: [] });
      expect(await readable(read, [acme.id])).toEqual([]);
    }
  });

  it('gives Memory identity scopes to their own holder only', async () => {
    const acme = await scope('org:acme');
    const u1 = await scope('resource:u1', acme.id);
    const u2 = await scope('resource:u2', acme.id);
    const t1 = await scope('thread:t1', u1.id);
    expect(await readable(await readScope(['resource:u1', 'thread:t1']), [acme.id, u1.id, u2.id, t1.id])).toEqual([
      'resource:u1',
      'thread:t1',
    ]);
  });
});

describe('knowledgeRoleOn', () => {
  it('returns the strongest role any held principal gets on the scope', () => {
    expect(knowledgeRoleOn(compiled, ['org:acme'], { address: 'policy:acme' })).toBe('viewer');
    expect(knowledgeRoleOn(compiled, ['org:acme', 'role:acme:admin'], { address: 'policy:acme' })).toBe('owner');
    expect(knowledgeRoleOn(compiled, ['org:globex', 'role:globex:admin'], { address: 'policy:acme' })).toBeNull();
    expect(knowledgeRoleOn(compiled, ['org:acme'], { address: 'org:acme' })).toBe('editor');
    expect(knowledgeRoleOn(compiled, ['team:acme:eng', 'org:acme'], { address: 'team:acme:eng' })).toBe('editor');
  });

  it('binds template-child and concrete rules from the address', () => {
    expect(knowledgeRoleOn(compiled, ['role:acme:admin'], { address: 'account:acme:1/internal' })).toBe('editor');
    expect(knowledgeRoleOn(compiled, ['account:acme:1'], { address: 'account:acme:1/internal' })).toBeNull();
    expect(knowledgeRoleOn(compiled, ['team:acme:eng'], { address: 'feature:acme:a' })).toBe('editor');
    expect(knowledgeRoleOn(compiled, ['team:acme:eng'], { address: 'feature:acme:b' })).toBeNull();
    expect(knowledgeRoleOn(compiled, ['role:acme:admin'], { address: 'feature:acme:a' })).toBe('viewer');
    expect(knowledgeRoleOn(compiled, ['role:globex:admin'], { address: 'feature:acme:a' })).toBeNull();
  });

  it('binds belongsTo rules from the scope page parent address', () => {
    const p1 = { address: 'project:p1', parentAddress: 'team:acme:eng' };
    expect(knowledgeRoleOn(compiled, ['team:acme:eng'], p1)).toBe('contributor');
    expect(knowledgeRoleOn(compiled, ['team:acme:sales'], p1)).toBeNull();
    expect(knowledgeRoleOn(compiled, ['team:acme:eng'], { address: 'project:p1' })).toBeNull();
  });

  it('returns null for undeclared scopes', () => {
    expect(knowledgeRoleOn(compiled, ['org:acme'], { address: 'nonsense:x' })).toBeNull();
  });
});
