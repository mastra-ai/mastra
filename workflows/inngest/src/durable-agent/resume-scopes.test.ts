import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';
import { keepSuspendedRunScopes } from './resume-scopes';

const snapshot = (scopes?: string[]) => ({
  requestContext: scopes ? { mastra__scopes: scopes } : {},
  context: { input: { messageListState: { memoryInfo: { resourceId: 'u1', threadId: 't1' } } } },
});

describe('keepSuspendedRunScopes', () => {
  it('keeps the saved scopes when the resume supplies a subset or the run identity', () => {
    const merged: Record<string, any> = { mastra__scopes: ['org:a'] };
    keepSuspendedRunScopes(snapshot(['org:a', 'team:core']), merged, {
      requestContext: new RequestContext([['mastra__scopes', ['org:a', 'resource:u1']]]),
    });
    expect(merged.mastra__scopes).toEqual(['org:a', 'team:core']);
  });

  it('throws when the resume adds a scope the run did not hold', () => {
    expect(() => keepSuspendedRunScopes(snapshot(['org:a']), {}, { scopes: ['org:b'] })).toThrow(
      expect.objectContaining({ id: 'AGENT_SCOPES_CONFLICT' }),
    );
    expect(() =>
      keepSuspendedRunScopes(snapshot(), {}, { requestContext: new RequestContext([['mastra__scopes', ['org:x']]]) }),
    ).toThrow(expect.objectContaining({ id: 'AGENT_SCOPES_CONFLICT' }));
  });

  it('leaves runs without scopes unchanged', () => {
    const merged: Record<string, any> = { tenant: 'acme' };
    keepSuspendedRunScopes(snapshot(), merged, { requestContext: new RequestContext() });
    expect(merged).toEqual({ tenant: 'acme' });
  });
});
