import { describe, expect, it } from 'vitest';
import { materializeKnowledgeScopePlan, validateKnowledgeStructurePlan } from '../reconcile';

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
      validateKnowledgeStructurePlan({ scopes: [{ address: 'scope:a', name: 'A', description: 'x'.repeat(401) }] }),
    ).toThrow('Knowledge node description exceeds the 400 UTF-16 code unit limit');
    expect(() =>
      validateKnowledgeStructurePlan({ scopes: [{ address: 'scope:a', name: 'A', description: 'x'.repeat(400) }] }),
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
          description: 'Public agent knowledge',
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

  it('treats provisional companions as optional explicit host configuration', () => {
    const input = {
      address: 'thread:alpha:uncurated',
      contextualScopeAddress: 'thread:alpha',
      parentAddresses: ['thread:alpha'],
      parameters: { threadId: 'alpha' },
    };

    const unconfigured = materializeKnowledgeScopePlan(undefined, input).scopes[0]!;
    expect(unconfigured.description).toBeUndefined();
    expect(unconfigured.grants).not.toContainEqual(expect.objectContaining({ role: 'mirror' }));

    expect(
      materializeKnowledgeScopePlan(
        {
          'thread:$threadId:uncurated': {
            access: [{ principal: 'thread:$threadId', role: 'mirror' }],
            description: 'Provisional session findings awaiting review.',
          },
        },
        input,
      ),
    ).toMatchObject({
      scopes: [
        {
          address: 'thread:alpha:uncurated',
          description: 'Provisional session findings awaiting review.',
          parentAddresses: ['thread:alpha'],
          grants: [{ scopeRefAddress: 'thread:alpha', role: 'mirror' }],
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
