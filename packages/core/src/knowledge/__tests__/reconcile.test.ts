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

  it('materializes built-in uncurated companions with mirrored parent access', () => {
    expect(
      materializeKnowledgeScopePlan(undefined, {
        address: 'resource:project-1:thread:alpha:uncurated',
        contextualScopeAddress: 'resource:project-1:thread:alpha',
        parentAddresses: ['resource:project-1:thread:alpha'],
        parameters: { resourceId: 'project-1', threadId: 'alpha' },
      }),
    ).toMatchObject({
      scopes: [
        {
          address: 'resource:project-1:thread:alpha:uncurated',
          metadata: { description: expect.stringContaining('not yet reviewed or integrated') },
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
