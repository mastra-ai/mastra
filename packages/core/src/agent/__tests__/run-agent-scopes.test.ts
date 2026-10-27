import { describe, expect, it } from 'vitest';
import { MASTRA_SCOPES_KEY, RequestContext } from '../../request-context';
import {
  getRunAgentScopes,
  MASTRA_SCOPE_ACCESS_KEY,
  resolveAgentScopes,
  restoreRunAgentScopes,
  setRunAgentScopes,
} from '../scopes';

describe('getRunAgentScopes', () => {
  it('returns the scopes Core wrote for the run', () => {
    const context = new RequestContext();
    setRunAgentScopes(context, ['org:acme', 'team:acme:support']);
    expect(getRunAgentScopes(context).map(scope => scope.scope)).toEqual(['org:acme', 'team:acme:support']);
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
    expect(getRunAgentScopes(context).map(scope => scope.scope)).toEqual(['org:acme']);
  });
});

describe('read-only scope entries', () => {
  it('holds plain scopes read-only and { scope, access: "write" } writable; any source holding one read-only wins', () => {
    const resolved = resolveAgentScopes({
      agentScopes: ['org:self', { scope: 'team:self:x', access: 'write' }],
      callScopes: [{ scope: 'org:self', access: 'write' }, { scope: 'agent:alex', access: 'read' }, 'resource:u1'],
    });
    expect(resolved.scopes).toEqual(['org:self', 'team:self:x', 'agent:alex', 'resource:u1']);
    // resource:/thread: are the run's Memory identity: always writable, even as plain strings.
    expect(resolved.readOnly).toEqual(['org:self', 'agent:alex']);
  });

  it('refuses entries with another access or the old { tag } shape', () => {
    expect(() => resolveAgentScopes({ callScopes: [{ scope: 'org:a', access: 'readwrite' } as any] })).toThrow(
      "{ scope, access: 'read' | 'write' }",
    );
    expect(() => resolveAgentScopes({ callScopes: [{ tag: 'org:a', access: 'read' } as any] })).toThrow(
      "{ scope, access: 'read' | 'write' }",
    );
  });

  it('reads a host-set request-context key like any entries, but trusts the access map Core wrote', () => {
    const host = new RequestContext([[MASTRA_SCOPES_KEY, ['org:self', { scope: 'team:self:x', access: 'write' }]]]);
    expect(resolveAgentScopes({ requestContext: host }).readOnly).toEqual(['org:self']);

    const fromRun = new RequestContext();
    setRunAgentScopes(fromRun, ['org:self', 'team:self:x'], ['org:self']);
    expect(resolveAgentScopes({ requestContext: fromRun }).readOnly).toEqual(['org:self']);
  });

  it('refuses read-only identity scopes', () => {
    expect(() => resolveAgentScopes({ callScopes: [{ scope: 'thread:t1', access: 'read' }] })).toThrow(
      "can't be read-only",
    );
  });

  it('carries read-only tags to the run and back through a durable restore', () => {
    const context = new RequestContext();
    setRunAgentScopes(context, ['org:self', 'team:self:x'], ['org:self']);
    expect(getRunAgentScopes(context)).toEqual([
      { scope: 'org:self', access: 'read' },
      { scope: 'team:self:x', access: 'write' },
    ]);

    const persisted = new RequestContext(
      Object.entries(JSON.parse(JSON.stringify(Object.fromEntries(context.entries())))),
    );
    restoreRunAgentScopes(persisted);
    expect(getRunAgentScopes(persisted)).toEqual(getRunAgentScopes(context));
  });

  it('treats a run as holding nothing when its access map was not written by Core', () => {
    const context = new RequestContext();
    setRunAgentScopes(context, ['org:self']);
    context.set(MASTRA_SCOPE_ACCESS_KEY, {});
    expect(getRunAgentScopes(context)).toEqual([]);
  });

  it('treats a run as holding nothing when its access map is deleted, so read-only never widens', () => {
    const context = new RequestContext();
    setRunAgentScopes(context, ['org:self', 'team:self:x'], ['org:self']);
    context.delete(MASTRA_SCOPE_ACCESS_KEY);
    expect(getRunAgentScopes(context)).toEqual([]);

    const plain = new RequestContext();
    setRunAgentScopes(plain, ['team:self:x']);
    plain.delete(MASTRA_SCOPE_ACCESS_KEY);
    expect(getRunAgentScopes(plain)).toEqual([]);
  });

  it("refuses another run's marked access map", () => {
    const member = new RequestContext();
    setRunAgentScopes(member, ['org:self'], ['org:self']);
    const director = new RequestContext();
    setRunAgentScopes(director, ['org:self']);
    member.set(MASTRA_SCOPE_ACCESS_KEY, director.get(MASTRA_SCOPE_ACCESS_KEY));
    expect(getRunAgentScopes(member)).toEqual([]);
  });

  it('keeps a run with no read-only tags readable after copying its context', () => {
    const context = new RequestContext();
    setRunAgentScopes(context, ['team:self:x']);
    const copy = new RequestContext([...context.entries()]);
    expect(getRunAgentScopes(copy)).toEqual([{ scope: 'team:self:x', access: 'write' }]);
  });

  it('lets a resumed run narrow a tag to read but not widen a read-only one', () => {
    const snapshot = { scopes: ['org:self', 'team:self:x'], readOnly: ['org:self'] };
    expect(
      resolveAgentScopes({ snapshot, callScopes: [{ scope: 'team:self:x', access: 'read' }] }).readOnly.sort(),
    ).toEqual(['org:self', 'team:self:x']);
    expect(resolveAgentScopes({ snapshot, callScopes: ['org:self'] }).readOnly).toContain('org:self');
    expect(() => resolveAgentScopes({ snapshot, callScopes: [{ scope: 'org:self', access: 'write' }] })).toThrow(
      "can't widen",
    );
  });
});
