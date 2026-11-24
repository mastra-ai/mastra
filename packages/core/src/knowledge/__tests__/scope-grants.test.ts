import { describe, expect, it } from 'vitest';
import type { KnowledgeReadScope } from '../../storage/domains/knowledge';
import { InMemoryKnowledgePageStore } from '../../storage/domains/knowledge/pages-inmemory';
import { readKnowledgeScopeGrants } from '../explorer-pages';
import { Knowledge } from '../index';

// The Acme demo's shape: roles grant on policy and runbook; manager is declared but never written to.
const scopes = {
  'org:$orgId': {},
  'role:$orgId:admin': {},
  'role:$orgId:manager': { displayLabel: '$orgId manager' },
  'role:$orgId:support': {},
  'policy:$orgId': {
    belongsTo: 'org:$orgId',
    access: [
      { principal: 'role:$orgId:admin', role: 'owner' as const },
      { principal: 'role:$orgId:manager', role: 'owner' as const },
      { principal: 'role:$orgId:support', role: 'viewer' as const },
      { principal: 'role:$orgId:support', role: 'contributor' as const },
    ],
  },
  'runbook:$orgId': {
    belongsTo: 'org:$orgId',
    access: [
      { principal: 'self', role: 'editor' as const },
      { principal: 'role:$orgId:admin', role: 'owner' as const },
      { principal: 'role:$orgId:support', role: 'viewer' as const },
    ],
  },
};
const host = { author: 'host' };

async function seed() {
  const knowledge = new Knowledge({ scopes, tools: false, instructions: false });
  const store = new InMemoryKnowledgePageStore();
  const scope = async (address: string, declaration: string, parentId?: string) =>
    (await store.materializeScope({ address, declaration, name: address, parentId, provenance: host })).scope;
  const org = await scope('org:acme', 'org:$orgId');
  const policy = await scope('policy:acme', 'policy:$orgId', org.id);
  const runbook = await scope('runbook:acme', 'runbook:$orgId', org.id);
  const admin = await scope('role:acme:admin', 'role:$orgId:admin', org.id);
  const support = await scope('role:acme:support', 'role:$orgId:support', org.id);
  const pages = [org, policy, runbook, admin, support];
  return { knowledge, store, pages, ids: { org, policy, runbook, admin, support } };
}

describe('Knowledge.scopeGrants', () => {
  it('lists each principal the declared rules name on a scope, with its strongest role and no self rule', () => {
    const knowledge = new Knowledge({ scopes, tools: false, instructions: false });
    expect(knowledge.scopeGrants({ address: 'policy:acme' })).toEqual([
      { principal: 'role:acme:admin', role: 'owner' },
      { principal: 'role:acme:manager', role: 'owner' },
      { principal: 'role:acme:support', role: 'contributor' },
    ]);
    expect(knowledge.scopeGrants({ address: 'runbook:acme' })).toEqual([
      { principal: 'role:acme:admin', role: 'owner' },
      { principal: 'role:acme:support', role: 'viewer' },
    ]);
    expect(knowledge.scopeGrants({ address: 'org:acme' })).toEqual([]);
    expect(knowledge.scopeGrants({ address: 'nothing:declared' })).toEqual([]);
  });
});

describe('readKnowledgeScopeGrants', () => {
  it('links granted scopes to principal scope pages, and keeps unwritten principals for an owner view', async () => {
    const { knowledge, store, pages, ids } = await seed();
    const grants = await readKnowledgeScopeGrants(store, {
      pages,
      read: 'all',
      grantsFor: scope => knowledge.scopeGrants(scope),
    });
    expect(grants).toEqual(
      expect.arrayContaining([
        { principal: 'role:acme:admin', principalId: ids.admin.id, target: ids.policy.id, role: 'owner' },
        { principal: 'role:acme:manager', target: ids.policy.id, role: 'owner' },
        { principal: 'role:acme:support', principalId: ids.support.id, target: ids.policy.id, role: 'contributor' },
        { principal: 'role:acme:admin', principalId: ids.admin.id, target: ids.runbook.id, role: 'owner' },
        { principal: 'role:acme:support', principalId: ids.support.id, target: ids.runbook.id, role: 'viewer' },
      ]),
    );
    expect(grants).toHaveLength(5);
  });

  it('keeps only principals the caller can read, and no unwritten ones, under a bound read scope', async () => {
    const { knowledge, store, ids } = await seed();
    const read: KnowledgeReadScope = {
      addresses: ['role:acme:support', 'policy:acme', 'runbook:acme'],
      prefixes: [],
      children: [],
    };
    const grants = await readKnowledgeScopeGrants(store, {
      pages: [ids.policy, ids.runbook, ids.support],
      read,
      grantsFor: scope => knowledge.scopeGrants(scope),
    });
    expect(grants).toEqual([
      { principal: 'role:acme:support', principalId: ids.support.id, target: ids.policy.id, role: 'contributor' },
      { principal: 'role:acme:support', principalId: ids.support.id, target: ids.runbook.id, role: 'viewer' },
    ]);
  });
});
