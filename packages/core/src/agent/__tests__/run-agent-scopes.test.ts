import { describe, expect, it } from 'vitest';
import { MASTRA_SCOPES_KEY, RequestContext } from '../../request-context';
import { getRunAgentScopes, restoreRunAgentScopes, setRunAgentScopes } from '../scopes';

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
});
