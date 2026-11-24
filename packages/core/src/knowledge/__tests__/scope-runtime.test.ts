import { beforeEach, describe, expect, it } from 'vitest';
import type { KnowledgeStorage } from '../../storage/domains/knowledge';
import { InMemoryStore } from '../../storage/mock';
import { knowledgeMemoryScopes } from '../declarations';
import { KnowledgeScopeRuntime } from '../scope-runtime';

const provenance = { author: 'agent:alex', sourceThreadId: 't1' };

describe('Knowledge scope materialization', () => {
  let store: KnowledgeStorage;
  let runtime: KnowledgeScopeRuntime;
  let warnings: string[];

  beforeEach(async () => {
    store = (await new InMemoryStore().getStore('knowledge'))!;
    await store.init();
    warnings = [];
    runtime = new KnowledgeScopeRuntime(
      {
        ...knowledgeMemoryScopes(),
        'role:$orgId:admin': {},
        'project:$projectId': {
          belongsTo: 'org:$orgId',
          access: [
            { principal: 'self', role: 'editor' },
            { principal: 'role:$orgId:admin', role: 'owner' },
          ],
          children: [{ name: 'internal', access: [{ principal: 'self', role: 'owner' }] }],
          pages: [{ key: 'overview', name: 'Overview' }],
        },
      },
      async () => store,
      message => warnings.push(message),
    );
  });

  it('creates an unlinked scope, links it later, and preserves its first parent against conflicting runs', async () => {
    const project = await runtime.materializeScope('project:p1', ['project:p1'], provenance);
    expect(project.parentId).toBeNull();
    const adminRead = await runtime.readScopeFor(['role:acme:admin']);
    expect(await store.getPage({ id: project.id, read: adminRead })).toBeNull();

    const linked = await runtime.materializeScope('project:p1', ['project:p1', 'org:acme'], provenance);
    const [acme] = await store.getScopesByAddress(['org:acme']);
    expect(linked.parentId).toBe(acme!.id);
    expect(
      await store.getPage({ id: project.id, read: await runtime.readScopeFor(['role:acme:admin']) }),
    ).not.toBeNull();
    expect(await runtime.roleOn(['role:acme:admin'], linked)).toBe('owner');
    expect(await runtime.roleOn(['role:globex:admin'], linked)).toBeNull();

    const conflict = await runtime.materializeScope('project:p1', ['project:p1', 'org:globex'], provenance);
    expect(conflict.parentId).toBe(acme!.id);
    expect(await store.getPage({ id: project.id, read: await runtime.readScopeFor(['role:globex:admin']) })).toBeNull();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/already belongs/);
  });

  it('warns for ambiguous held parents but creates the scope and permits a normal write', async () => {
    const project = await runtime.materializeScope('project:p1', ['project:p1', 'org:acme', 'org:globex'], provenance);
    expect(project.parentId).toBeNull();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/ambiguous/);
    expect(await runtime.roleOn(['project:p1'], project)).toBe('editor');
    const page = await store.createPage({ parentId: project.id, name: 'Notes', provenance });
    expect(await store.getPage({ id: page.id, read: await runtime.readScopeFor(['project:p1']) })).not.toBeNull();
    expect(await store.getPage({ id: page.id, read: await runtime.readScopeFor(['role:acme:admin']) })).toBeNull();
  });

  it('materializes template children and pages without granting the parent access to its child scope', async () => {
    const child = await runtime.materializeScope('project:p1/internal', ['project:p1/internal'], provenance);
    const [parent] = await store.getScopesByAddress(['project:p1']);
    expect(child.parentId).toBe(parent!.id);
    expect(await store.getPageByPath({ scopeId: parent!.id, path: ['overview'], read: 'all' })).not.toBeNull();
    expect(await store.getPage({ id: child.id, read: await runtime.readScopeFor(['project:p1']) })).toBeNull();
    expect(await runtime.roleOn(['project:p1/internal'], child)).toBe('owner');
  });

  it('rejects undeclared run scopes and does not implicitly hold resource or thread identities', async () => {
    await expect(runtime.readScopeFor(['unknown:value'])).rejects.toThrow(/does not match a declared/);
    expect(await runtime.readScopeFor([])).toEqual({ addresses: [], prefixes: [], children: [] });
    const resource = await runtime.materializeScope('resource:u1', ['resource:u1'], provenance);
    expect(await store.getPage({ id: resource.id, read: await runtime.readScopeFor([]) })).toBeNull();
  });
});
