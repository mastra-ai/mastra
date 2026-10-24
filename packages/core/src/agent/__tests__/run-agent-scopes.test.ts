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
    expect(getRunAgentScopes(context).map(scope => scope.tag)).toEqual(['org:acme', 'team:acme:support']);
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
    expect(getRunAgentScopes(context).map(scope => scope.tag)).toEqual(['org:acme']);
  });
});

describe('read-only scope entries', () => {
  it('resolves { tag, access: "read" } entries; any source holding a tag read-only makes it read-only', () => {
    const resolved = resolveAgentScopes({
      agentScopes: [{ tag: 'org:self', access: 'read' }, 'team:self:x'],
      callScopes: ['org:self', 'agent:alex'],
    });
    expect(resolved.scopes).toEqual(['org:self', 'team:self:x', 'agent:alex']);
    expect(resolved.readOnly).toEqual(['org:self']);
  });

  it('refuses read-only identity scopes', () => {
    expect(() => resolveAgentScopes({ callScopes: [{ tag: 'thread:t1', access: 'read' }] })).toThrow(
      "can't be read-only",
    );
  });

  it('carries read-only tags to the run and back through a durable restore', () => {
    const context = new RequestContext();
    setRunAgentScopes(context, ['org:self', 'team:self:x'], ['org:self']);
    expect(getRunAgentScopes(context)).toEqual([
      { tag: 'org:self', access: 'read' },
      { tag: 'team:self:x', access: 'readwrite' },
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

  it('lets a resumed run narrow a tag to read but not widen a read-only one', () => {
    const snapshot = { scopes: ['org:self', 'team:self:x'], readOnly: ['org:self'] };
    expect(
      resolveAgentScopes({ snapshot, callScopes: [{ tag: 'team:self:x', access: 'read' }] }).readOnly.sort(),
    ).toEqual(['org:self', 'team:self:x']);
    expect(() => resolveAgentScopes({ snapshot, callScopes: ['org:self'] })).toThrow("can't widen");
  });
});
