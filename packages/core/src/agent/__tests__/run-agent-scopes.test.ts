import { describe, expect, it } from 'vitest';
import { MASTRA_SCOPES_KEY, RequestContext } from '../../request-context';
import {
  incomingAgentScopes,
  getRunAgentScopes,
  resolveAgentScopes,
  restoreRunAgentScopes,
  setRunAgentScopes,
} from '../scopes';

describe('getRunAgentScopes', () => {
  it('returns the scopes Core wrote for the run', () => {
    const context = new RequestContext();
    setRunAgentScopes(context, ['org:acme', 'team:acme:support']);
    expect(getRunAgentScopes(context)).toEqual(['org:acme', 'team:acme:support']);
  });

  it('returns nothing for scopes a caller wrote into the request context itself', () => {
    const context = new RequestContext();
    context.set(MASTRA_SCOPES_KEY, ['org:acme']);
    expect(getRunAgentScopes(context)).toEqual([]);
    expect(getRunAgentScopes(undefined)).toEqual([]);
  });

  it('trusts scopes again after Core restores them from its own persisted state', () => {
    const context = new RequestContext();
    context.set(MASTRA_SCOPES_KEY, JSON.parse(JSON.stringify(['org:acme'])));
    restoreRunAgentScopes(context);
    expect(getRunAgentScopes(context)).toEqual(['org:acme']);
  });

  it('keeps the run scopes after a durable round-trip of its context', () => {
    const context = new RequestContext();
    setRunAgentScopes(context, ['org:self', 'team:self:x']);
    const persisted = new RequestContext(
      Object.entries(JSON.parse(JSON.stringify(Object.fromEntries(context.entries())))),
    );
    restoreRunAgentScopes(persisted);
    expect(getRunAgentScopes(persisted)).toEqual(['org:self', 'team:self:x']);
  });
});

describe('plain-string agent scopes', () => {
  it('a static list adds to the incoming scopes', () => {
    const callScopes = ['org:self', 'agent:alex', 'resource:u1'];
    const resolved = resolveAgentScopes({
      agentScopes: [...incomingAgentScopes({ callScopes }), 'org:self', 'team:self:x'],
      callScopes,
    });
    expect(resolved.scopes).toEqual(['org:self', 'agent:alex', 'resource:u1', 'team:self:x']);
    expect(resolved).not.toHaveProperty('readOnly');
  });

  it('refuses object entries, including the removed { scope, access } shape', () => {
    expect(() => resolveAgentScopes({ callScopes: [{ scope: 'org:a', access: 'write' } as any] })).toThrow(
      'must be an array of "<type>:<value>" strings',
    );
    expect(() =>
      resolveAgentScopes({ requestContext: new RequestContext([[MASTRA_SCOPES_KEY, [{ scope: 'org:a' }]]]) }),
    ).toThrow('must be an array of "<type>:<value>" strings');
  });
});
