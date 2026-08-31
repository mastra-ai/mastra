import { describe, expect, it } from 'vitest';
import {
  materializeKnowledgeScopePlan,
  validateKnowledgeScopeTypes,
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
        { 'org:$orgId': { children: [{ address: '$self', name: 'Self' }] } },
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
      materializeKnowledgeScopePlan(undefined, {
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

  it('rejects invalid roles and mirror suggest overrides in every scope type', () => {
    expect(() =>
      validateKnowledgeScopeTypes({
        custom: { access: [{ principal: 'self', role: 'admin' }] },
      } as never),
    ).toThrow('Invalid Knowledge grant role: admin');
    expect(() =>
      validateKnowledgeScopeTypes({
        custom: { access: [{ principal: 'self', role: 'mirror', canSuggest: true }] },
      }),
    ).toThrow('Knowledge mirror grant in custom cannot override suggest capability');
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
});
