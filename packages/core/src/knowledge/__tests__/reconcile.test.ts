import { describe, expect, it } from 'vitest';
import { InMemoryKnowledgeStorage, InMemoryStore, MastraCompositeStore } from '../../storage';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { Knowledge } from '../index';
import {
  materializeKnowledgeScopePlan,
  memoryScopeTypes,
  planKnowledgeRunScopes,
  validateKnowledgeStructurePlan,
} from '../reconcile';

describe('Knowledge structure reconciliation', () => {
  it('validates unique addresses and rejects hierarchy cycles', () => {
    expect(() =>
      validateKnowledgeStructurePlan({
        scopes: [
          { address: 'scope:a', name: 'A', parentAddresses: ['scope:b'] },
          { address: 'scope:b', name: 'B', parentAddresses: ['scope:a'] },
        ],
      }),
    ).toThrow('Knowledge scope hierarchy contains a cycle');

    expect(() =>
      validateKnowledgeStructurePlan({
        scopes: [
          { address: 'scope:a', name: 'A' },
          { address: 'scope:a', name: 'Other A' },
        ],
      }),
    ).toThrow('Duplicate Knowledge scope address: scope:a');
  });

  it('applies the node description bound to scope descriptions', () => {
    expect(() =>
      validateKnowledgeStructurePlan({
        scopes: [{ address: 'scope:a', name: 'A', metadata: { description: 'x'.repeat(401) } }],
      }),
    ).toThrow('Knowledge node description exceeds the 400 UTF-16 code unit limit');
    expect(() =>
      validateKnowledgeStructurePlan({
        scopes: [{ address: 'scope:a', name: 'A', metadata: { description: 'x'.repeat(400) } }],
      }),
    ).not.toThrow();
  });

  it('materializes a configured pattern from host-vouched parameters', () => {
    expect(
      materializeKnowledgeScopePlan(
        {
          'agent:$agentId:public': {
            description: 'Public agent knowledge',
            access: [
              { principal: 'self', role: 'owner' },
              { principal: 'team:$orgId', role: 'readonly', canSuggest: true },
              { principal: 'parent', role: 'mirror' },
            ],
          },
        },
        {
          address: 'agent:weather:public',
          contextualScopeAddress: 'resource:weather',
          parentAddresses: ['org:acme'],
          parameters: { agentId: 'weather', orgId: 'acme' },
        },
      ),
    ).toEqual({
      retrofit: false,
      scopes: [
        {
          address: 'agent:weather:public',
          name: 'public',
          metadata: { description: 'Public agent knowledge' },
          parentAddresses: ['org:acme'],
          grants: [
            { scopeRefAddress: 'resource:weather', role: 'owner', canSuggest: undefined },
            { scopeRefAddress: 'team:acme', role: 'readonly', canSuggest: true },
            { scopeRefAddress: 'org:acme', role: 'mirror', canSuggest: undefined },
          ],
        },
      ],
    });
  });

  it('emits templated children with parent edges and grants for the materialized scope', () => {
    const scopeTypes = {
      'org:$orgId': {
        children: [
          { address: '$self:shared', name: 'Shared', description: 'Shared org knowledge' },
          {
            address: 'machines:$orgId',
            name: 'Machines',
            access: [
              { principal: 'parent', role: 'mirror' as const },
              { principal: 'team:$orgId', role: 'readonly' as const },
            ],
          },
        ],
      },
    };
    for (const orgId of ['a', 'b']) {
      const org = `org:${orgId}`;
      expect(materializeKnowledgeScopePlan(scopeTypes, { address: org, contextualScopeAddress: org }).scopes).toEqual([
        { address: org, name: orgId, metadata: undefined, parentAddresses: undefined, grants: [] },
        {
          address: `${org}:shared`,
          name: 'Shared',
          metadata: { description: 'Shared org knowledge' },
          parentAddresses: [org],
          grants: [{ scopeRefAddress: org, role: 'owner', canSuggest: undefined }],
        },
        {
          address: `machines:${orgId}`,
          name: 'Machines',
          metadata: undefined,
          parentAddresses: [org],
          grants: [
            { scopeRefAddress: org, role: 'mirror', canSuggest: undefined },
            { scopeRefAddress: `team:${orgId}`, role: 'readonly', canSuggest: undefined },
          ],
        },
      ]);
    }

    expect(() =>
      materializeKnowledgeScopePlan(
        { 'org:$orgId': { children: [{ address: 'x:$missing', name: 'X' }] } },
        { address: 'org:a', contextualScopeAddress: 'org:a' },
      ),
    ).toThrow('Missing host-vouched Knowledge scope parameter: missing');
    expect(() =>
      materializeKnowledgeScopePlan(
        { 'org:$orgId': { identity: true, children: [{ address: '$self', name: 'Self' }] } },
        { address: 'org:a', contextualScopeAddress: 'org:a' },
      ),
    ).toThrow('Knowledge child scope template cannot create identity scope org:a');
    expect(() =>
      materializeKnowledgeScopePlan(
        { 'org:$orgId': { children: [{ address: 'thread:$orgId', name: 'Session' }] } },
        { address: 'org:a', contextualScopeAddress: 'org:a' },
      ),
    ).toThrow('Knowledge child scope template cannot create identity scope thread:a');
    expect(() =>
      materializeKnowledgeScopePlan(
        {
          'org:$orgId': { children: [{ address: 'team:$orgId', name: 'Team' }] },
          'team:$teamId': { access: [{ principal: 'org:x', role: 'reader' }] },
        },
        { address: 'org:a', contextualScopeAddress: 'org:a' },
      ),
    ).toThrow(
      'Knowledge child scope template cannot create team:a: it matches configured scope type team:$teamId, so materialize it through that type',
    );
    expect(() =>
      materializeKnowledgeScopePlan(
        { 'org:$orgId': { children: [{ address: '$self::bad', name: 'Bad' }] } },
        { address: 'org:a', contextualScopeAddress: 'org:a' },
      ),
    ).toThrow('Invalid Knowledge scope address: org:a::bad');
  });

  it('treats provisional companions as optional explicit host configuration', () => {
    const input = {
      address: 'resource:project-1:thread:alpha:uncurated',
      contextualScopeAddress: 'resource:project-1:thread:alpha',
      parentAddresses: ['resource:project-1:thread:alpha'],
      parameters: { resourceId: 'project-1', threadId: 'alpha' },
    };

    const unconfigured = materializeKnowledgeScopePlan(undefined, input).scopes[0]!;
    expect(unconfigured.metadata).toBeUndefined();
    expect(unconfigured.grants).not.toContainEqual(expect.objectContaining({ role: 'mirror' }));

    expect(
      materializeKnowledgeScopePlan(
        {
          'resource:$resourceId:thread:$threadId:uncurated': {
            access: [{ principal: 'resource:$resourceId:thread:$threadId', role: 'mirror' }],
            description: 'Provisional session findings awaiting review.',
          },
        },
        input,
      ),
    ).toMatchObject({
      scopes: [
        {
          address: 'resource:project-1:thread:alpha:uncurated',
          metadata: { description: 'Provisional session findings awaiting review.' },
          parentAddresses: ['resource:project-1:thread:alpha'],
          grants: [{ scopeRefAddress: 'resource:project-1:thread:alpha', role: 'mirror' }],
        },
      ],
    });
  });

  it('rejects mismatched host-vouched parameters and ambiguous patterns', () => {
    expect(() =>
      materializeKnowledgeScopePlan(memoryScopeTypes, {
        address: 'org:acme',
        contextualScopeAddress: 'org:acme',
        parameters: { orgId: 'other' },
      }),
    ).toThrow('Host-vouched Knowledge scope parameter orgId does not match address org:acme');

    expect(() =>
      materializeKnowledgeScopePlan(
        {
          'agent:$id': {},
          '$kind:weather': {},
        },
        { address: 'agent:weather', contextualScopeAddress: 'org:acme' },
      ),
    ).toThrow('Knowledge scope patterns overlap');
  });

  it('uses the custom template for an opaque unmatched address', () => {
    expect(
      materializeKnowledgeScopePlan(
        { custom: { access: [{ principal: 'self', role: 'owner' }] } },
        { address: 'slack:workspace-123', contextualScopeAddress: 'org:acme' },
      ),
    ).toMatchObject({
      scopes: [
        {
          address: 'slack:workspace-123',
          name: 'workspace-123',
          grants: [{ scopeRefAddress: 'org:acme', role: 'owner' }],
        },
      ],
    });
  });

  describe('custom scope ownership', () => {
    const ownerGrants = (plan: ReturnType<typeof materializeKnowledgeScopePlan>, address: string) =>
      plan.scopes.find(scope => scope.address === address)!.grants?.filter(grant => grant.role === 'owner') ?? [];

    it('grants no owner on a custom scope materialized from its own address', () => {
      const plan = materializeKnowledgeScopePlan(undefined, {
        address: 'team:core',
        contextualScopeAddress: 'team:core',
      });
      expect(ownerGrants(plan, 'team:core')).toEqual([]);
    });

    it('grants no owner to the context that vouched a custom scope', () => {
      const plan = materializeKnowledgeScopePlan(undefined, {
        address: 'team:core',
        contextualScopeAddress: 'resource:alice',
      });
      expect(ownerGrants(plan, 'team:core')).toEqual([]);
    });

    it("keeps the owner grant on Memory's opt-in identity scope types", () => {
      for (const address of ['org:acme', 'resource:alice', 'thread:t-1']) {
        const plan = materializeKnowledgeScopePlan(memoryScopeTypes, { address, contextualScopeAddress: address });
        expect(ownerGrants(plan, address)).toEqual([expect.objectContaining({ scopeRefAddress: address })]);
      }
    });
  });

  describe('run scopes', () => {
    const factoryScopeTypes = {
      'org:$orgId': { identity: true, access: [{ principal: 'self', role: 'owner' as const }] },
      'project:$projectId': {
        identity: true,
        parent: 'org:$orgId',
        access: [{ principal: 'self', role: 'owner' as const }],
      },
      'thread:$threadId': {
        identity: true,
        parent: 'project:$projectId',
        access: [{ principal: 'self', role: 'owner' as const }],
      },
      'team:$teamId': { access: [{ principal: 'self', role: 'append' as const }] },
    };

    it('holds no scopes when the host configures no scope types', () => {
      expect(planKnowledgeRunScopes(undefined, ['org:acme', 'resource:u1', 'thread:t1'])).toEqual([]);
    });

    it("plans Memory's opt-in org, resource and thread chain parent-first from a run's scopes", () => {
      const plans = planKnowledgeRunScopes(memoryScopeTypes, ['thread:t1', 'resource:u1', 'org:acme', 'team:payments']);
      expect(plans).toEqual([
        {
          pattern: 'org:$orgId',
          address: 'org:acme',
          contextualScopeAddress: 'org:acme',
          parameters: { orgId: 'acme' },
        },
        {
          pattern: 'resource:$resourceId',
          address: 'resource:u1',
          contextualScopeAddress: 'resource:u1',
          parameters: { resourceId: 'u1' },
          parentAddress: 'org:acme',
          parentAddresses: ['org:acme'],
        },
        {
          pattern: 'thread:$threadId',
          address: 'thread:t1',
          contextualScopeAddress: 'thread:t1',
          parameters: { threadId: 't1' },
          parentAddress: 'resource:u1',
          parentAddresses: ['resource:u1'],
        },
      ]);
    });

    it('holds only the host-configured types and ignores scopes no type names', () => {
      const plans = planKnowledgeRunScopes(factoryScopeTypes, [
        'org:acme',
        'project:p1',
        'resource:factory',
        'thread:t1',
        'team:payments',
      ]);
      expect(plans.map(plan => [plan.address, plan.parentAddress])).toEqual([
        ['org:acme', undefined],
        ['team:payments', undefined],
        ['project:p1', 'org:acme'],
        ['thread:t1', 'project:p1'],
      ]);
    });

    it('does not hold a scope type whose parent the run lacks', () => {
      expect(planKnowledgeRunScopes(memoryScopeTypes, ['resource:u1', 'thread:t1'])).toEqual([]);
    });

    it('refuses a run holding two values of a configured type', () => {
      expect(() => planKnowledgeRunScopes(memoryScopeTypes, ['org:a', 'org:b'])).toThrow(
        'Knowledge run scopes hold more than one org: org:a, org:b',
      );
    });

    it('rejects a parent that is not a configured scope type', () => {
      expect(() => planKnowledgeRunScopes({ 'project:$projectId': { parent: 'workspace:$workspaceId' } }, [])).toThrow(
        'Knowledge scope type project:$projectId names parent workspace:$workspaceId, which is not a configured scope type',
      );
    });

    it("stops child templates minting a run's resource or thread, even with no scope types for them", () => {
      for (const address of ['resource:$teamId', 'thread:$teamId']) {
        expect(() =>
          materializeKnowledgeScopePlan(
            { 'team:$teamId': { children: [{ address, name: 'Child' }] } },
            { address: 'team:a', contextualScopeAddress: 'team:a' },
          ),
        ).toThrow(`Knowledge child scope template cannot create identity scope ${address.replace('$teamId', 'a')}`);
      }
    });

    it('stops child templates minting a host-configured identity type', () => {
      expect(() =>
        materializeKnowledgeScopePlan(
          {
            'project:$projectId': { identity: true },
            'team:$teamId': { children: [{ address: 'project:$teamId', name: 'Project' }] },
          },
          { address: 'team:a', contextualScopeAddress: 'team:a' },
        ),
      ).toThrow('Knowledge child scope template cannot create identity scope project:a');
    });

    it('materializes held scopes under their parents and reuses them on later runs', async () => {
      const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'run-scopes' }), scopes: factoryScopeTypes });
      const first = await knowledge.materializeRunScopes({ scopes: ['org:acme', 'project:p1', 'thread:t1'] });
      const second = await knowledge.materializeRunScopes({ scopes: ['org:acme', 'project:p1', 'thread:t1'] });
      expect(second.map(scope => scope.scopeId)).toEqual(first.map(scope => scope.scopeId));
      const storage = await knowledge.getStorage();
      const [org, project, thread] = first;
      expect(await storage.getNodeScopeIds(project!.scopeId)).toEqual([org!.scopeId]);
      expect(await storage.getNodeScopeIds(thread!.scopeId)).toEqual([project!.scopeId]);
    });

    it('makes each held identity scope its own owner, never its parent', async () => {
      const db = new InMemoryDB();
      const storage = new MastraCompositeStore({
        id: 'run-scopes',
        domains: { knowledge: new InMemoryKnowledgeStorage({ db }) },
      });
      const knowledge = new Knowledge({ storage, scopes: memoryScopeTypes });
      const held = await knowledge.materializeRunScopes({ scopes: ['org:acme', 'resource:u1', 'thread:t1'] });
      for (const scope of held) {
        const owners = [...db.knowledgeScopeGrants.values()]
          .filter(grant => grant.scopeNodeId === scope.scopeId && grant.role === 'owner')
          .map(grant => grant.scopeRefId);
        expect(owners).toEqual([scope.scopeId]);
      }
    });

    it('refuses to move an existing scope under a different parent', async () => {
      const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'run-scopes' }), scopes: factoryScopeTypes });
      await knowledge.materializeRunScopes({ scopes: ['org:acme', 'project:p1', 'thread:t1'] });
      await expect(knowledge.materializeRunScopes({ scopes: ['org:acme', 'project:p2', 'thread:t1'] })).rejects.toThrow(
        'Knowledge scope thread:t1 already exists under a parent other than project:p2',
      );
    });
  });
});
