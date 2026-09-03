import { describe, expect, it, vi } from 'vitest';

import { InMemoryStore } from '../../../storage/mock';
import { Knowledge } from '../../index';
import {
  hashKnowledgeDescription,
  instantiateKnowledgeScopeTypePlan,
  validateCompiledKnowledgePlan,
  type KnowledgeDescriptionCompiler,
} from '../compiler';

describe('Knowledge description compiler', () => {
  it('hashes normalized compiler inputs deterministically', () => {
    expect(hashKnowledgeDescription({ description: '  Shared structure  ', level: 'instance' })).toBe(
      hashKnowledgeDescription({ description: 'Shared structure', level: 'instance' }),
    );
    expect(
      hashKnowledgeDescription({ description: 'Shared structure', level: 'scope-type', scopeType: 'project' }),
    ).not.toBe(hashKnowledgeDescription({ description: 'Shared structure', level: 'instance' }));
  });

  it('rejects ambiguous compiler output and expands declared scope templates', () => {
    expect(() =>
      validateCompiledKnowledgePlan(
        {
          scopes: [
            { address: 'org:acme', name: 'Acme', parentAddresses: ['org:missing'] },
            { address: 'team:acme', name: 'Team' },
          ],
        },
        { level: 'instance' },
      ),
    ).toThrow('references undeclared parent scope');
    expect(() =>
      validateCompiledKnowledgePlan(
        {
          scopes: [
            { address: 'root:first', name: 'Shared' },
            { address: 'root:second', name: 'shared' },
          ],
        },
        { level: 'instance' },
      ),
    ).toThrow('ambiguous sibling name');

    const template = validateCompiledKnowledgePlan(
      {
        scopes: [
          { address: '$scope:$section:decisions', name: 'Decisions', parentAddresses: ['$scope'] },
          {
            address: '$scope:docs',
            name: 'Docs',
            parentAddresses: ['$scope'],
            grants: [{ scopeRefAddress: '$self', role: 'owner' }],
          },
        ],
      },
      { level: 'scope-type' },
    );
    expect(
      instantiateKnowledgeScopeTypePlan({
        plan: template,
        address: 'project:shipyard',
        contextualScopeAddress: 'org:acme',
        parameters: { section: 'product' },
      }),
    ).toEqual({
      scopes: [
        { address: 'project:shipyard:product:decisions', name: 'Decisions', parentAddresses: ['project:shipyard'] },
        {
          address: 'project:shipyard:docs',
          name: 'Docs',
          parentAddresses: ['project:shipyard'],
          grants: [{ scopeRefAddress: 'org:acme', role: 'owner' }],
        },
      ],
    });
  });

  it('persists one compiled instance plan across concurrent awaiters and restarts', async () => {
    const storage = new InMemoryStore({ id: 'description-cache' });
    const compile = vi.fn(async () => ({ scopes: [{ address: 'org:acme', name: 'Acme' }] }));
    const knowledge = new Knowledge({
      id: 'mastra',
      storage,
      description: 'Create the Acme root.',
      compiler: { compile },
    });

    const [first, second] = await Promise.all([knowledge.reconcile(), knowledge.reconcile()]);
    expect(first.scopes).toEqual(second.scopes);
    expect(compile).toHaveBeenCalledTimes(1);

    const restartedCompiler: KnowledgeDescriptionCompiler = {
      compile: vi.fn(async () => {
        throw new Error('unchanged descriptions must use the persisted plan');
      }),
    };
    const restarted = new Knowledge({
      id: 'mastra',
      storage,
      description: 'Create the Acme root.',
      compiler: restartedCompiler,
    });
    await expect(restarted.reconcile()).resolves.toMatchObject({ changed: true });
    expect(restartedCompiler.compile).not.toHaveBeenCalled();
  });

  it('keeps direct structure as the deterministic escape hatch', async () => {
    const compile = vi.fn(async () => ({ scopes: [{ address: 'root:compiled', name: 'Compiled' }] }));
    const knowledge = new Knowledge({
      id: 'direct-plan',
      storage: new InMemoryStore({ id: 'direct-plan' }),
      description: 'Create a compiled root.',
      compiler: { compile },
      structure: { scopes: [{ address: 'root:direct', name: 'Direct' }] },
    });

    await knowledge.reconcile();
    expect(compile).not.toHaveBeenCalled();
    expect(await knowledge.resolveScopeAddress('root:direct')).not.toBeNull();
    expect(await knowledge.resolveScopeAddress('root:compiled')).toBeNull();
  });

  it('adds compiled scopes without mutating declarations that already exist', async () => {
    const storage = new InMemoryStore({ id: 'description-additive' });
    const direct = new Knowledge({
      id: 'direct',
      storage,
      structure: {
        scopes: [
          { address: 'identity:host', name: 'Host' },
          {
            address: 'org:acme',
            name: 'Acme',
            parentAddresses: ['identity:host'],
            grants: [{ scopeRefAddress: 'identity:host', role: 'owner' }],
          },
        ],
      },
    });
    await direct.reconcile();
    const root = await direct.resolveScopeAddress('org:acme');

    const compiled = new Knowledge({
      id: 'compiled',
      storage,
      description: 'Add shared knowledge to Acme.',
      compiler: {
        compile: async () => ({
          scopes: [
            { address: 'identity:host', name: 'Changed host' },
            { address: 'org:acme', name: 'Changed Acme' },
            { address: 'org:acme:shared', name: 'Shared', parentAddresses: ['org:acme'] },
          ],
        }),
      },
    });
    await compiled.reconcile();

    const domain = await compiled.getStorageInternal();
    const rootNode = await domain.getNode(root!.scopeNodeId);
    expect(rootNode?.name).toBe('Acme');
    expect(await domain.getNodeScopeIds(root!.scopeNodeId)).toEqual([
      (await compiled.resolveScopeAddress('identity:host'))!.scopeNodeId,
    ]);
    expect((await domain.listScopeGrants()).filter(grant => grant.scopeNodeId === root!.scopeNodeId)).toHaveLength(1);
    expect(await compiled.resolveScopeAddress('org:acme:shared')).not.toBeNull();
  });

  it('resumes compiler checkpoints after a process failure', async () => {
    const storage = new InMemoryStore({ id: 'description-checkpoint' });
    const input = { description: 'Create the Acme root.', level: 'instance' as const };
    const stateStore = await storage.getStore('threadState');
    await stateStore!.setState({
      threadId: 'knowledge:mastra',
      type: `description-plan:${hashKnowledgeDescription(input)}`,
      value: { version: 1, attempts: 1, checkpoint: { nextScope: 1 }, lastError: 'compiler process stopped' },
    });

    const resumedCompile = vi.fn(async (_input, context) => {
      expect(context.checkpoint).toEqual({ nextScope: 1 });
      return { scopes: [{ address: 'org:acme', name: 'Acme' }] };
    });
    const restarted = new Knowledge({
      id: 'mastra',
      storage,
      description: input.description,
      compiler: { compile: resumedCompile },
    });
    await expect(restarted.reconcile()).resolves.toMatchObject({ changed: true });
    expect(resumedCompile).toHaveBeenCalledOnce();
  });

  it('keeps scope-type structure as a creation snapshot without retrofitting existing scopes', async () => {
    const storage = new InMemoryStore({ id: 'scope-template-snapshot' });
    const roots = new Knowledge({
      id: 'roots',
      storage,
      structure: {
        scopes: [
          { address: 'org:first', name: 'First' },
          { address: 'org:second', name: 'Second' },
        ],
      },
    });
    await roots.reconcile();

    const first = new Knowledge({
      id: 'mastra',
      storage,
      compiler: {
        compile: async () => ({
          scopes: [{ address: '$scope:decisions', name: 'Decisions', parentAddresses: ['$scope'] }],
        }),
      },
      scopes: {
        'project:$projectId': {
          description: 'Each project starts with decisions.',
          access: [{ principal: 'parent', role: 'owner' }],
        },
      },
    });
    await first.materializeScope({
      address: 'project:one',
      contextualScopeAddress: 'org:first',
      parentAddresses: ['org:first'],
      parameters: { projectId: 'one' },
    });

    const changed = new Knowledge({
      id: 'mastra',
      storage,
      compiler: {
        compile: async () => ({ scopes: [{ address: '$scope:docs', name: 'Docs', parentAddresses: ['$scope'] }] }),
      },
      scopes: {
        'project:$projectId': {
          description: 'Each project starts with docs.',
          access: [{ principal: 'parent', role: 'readonly' }],
        },
      },
    });
    await changed.materializeScope({
      address: 'project:one',
      contextualScopeAddress: 'org:second',
      parentAddresses: ['org:second'],
      parameters: { projectId: 'one' },
    });
    await changed.materializeScope({
      address: 'project:two',
      contextualScopeAddress: 'org:second',
      parentAddresses: ['org:second'],
      parameters: { projectId: 'two' },
    });

    expect(await changed.resolveScopeAddress('project:one:decisions')).not.toBeNull();
    expect(await changed.resolveScopeAddress('project:one:docs')).toBeNull();
    expect(await changed.resolveScopeAddress('project:two:docs')).not.toBeNull();

    const projectOne = await changed.resolveScopeAddress('project:one');
    const projectTwo = await changed.resolveScopeAddress('project:two');
    const projectTwoDocs = await changed.resolveScopeAddress('project:two:docs');
    const firstRoot = await changed.resolveScopeAddress('org:first');
    const secondRoot = await changed.resolveScopeAddress('org:second');
    const domain = await changed.getStorageInternal();
    expect(await domain.getNodeScopeIds(projectOne!.scopeNodeId)).toEqual([firstRoot!.scopeNodeId]);
    expect((await domain.listScopeGrants()).filter(grant => grant.scopeNodeId === projectOne!.scopeNodeId)).toEqual([
      expect.objectContaining({ scopeRefId: firstRoot!.scopeNodeId, role: 'owner' }),
    ]);
    expect(await domain.getNodeScopeIds(projectTwo!.scopeNodeId)).toEqual([secondRoot!.scopeNodeId]);
    expect((await domain.listScopeGrants()).filter(grant => grant.scopeNodeId === projectTwo!.scopeNodeId)).toEqual([
      expect.objectContaining({ scopeRefId: secondRoot!.scopeNodeId, role: 'readonly' }),
    ]);
    await domain.deleteNode({ id: projectTwoDocs!.scopeNodeId, version: 1, deletedBy: 'host' });
    await domain.deleteNode({ id: projectTwo!.scopeNodeId, version: 1, deletedBy: 'host' });
    await expect(
      changed.materializeScope({
        address: 'project:two',
        contextualScopeAddress: 'org:second',
        parentAddresses: ['org:second'],
        parameters: { projectId: 'two' },
      }),
    ).rejects.toThrow('explicitly deleted and cannot be recreated lazily');
  });

  it('does not recreate explicitly deleted compiled structure', async () => {
    const storage = new InMemoryStore({ id: 'description-deletion' });
    const knowledge = new Knowledge({
      id: 'mastra',
      storage,
      description: 'Create a temporary root.',
      compiler: { compile: async () => ({ scopes: [{ address: 'root:temporary', name: 'Temporary' }] }) },
    });
    await knowledge.reconcile();
    const address = await knowledge.resolveScopeAddress('root:temporary');
    expect(address).not.toBeNull();
    const domain = await knowledge.getStorageInternal();
    await domain.deleteNode({ id: address!.scopeNodeId, version: 1, deletedBy: 'host' });

    const changed = new Knowledge({
      id: 'mastra',
      storage,
      description: 'Create a temporary root and a permanent root.',
      compiler: {
        compile: async () => ({
          scopes: [
            { address: 'root:temporary', name: 'Temporary' },
            { address: 'root:permanent', name: 'Permanent' },
          ],
        }),
      },
    });
    const result = await changed.reconcile();
    expect(result.deletedScopeAddresses).toContain('root:temporary');
    expect(await changed.resolveScopeAddress('root:permanent')).not.toBeNull();
    expect(await changed.resolveScopeAddress('root:temporary')).toBeNull();
  });
});
