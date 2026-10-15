import { setRunAgentScopes } from '@mastra/core/agent';
import { MASTRA_SCOPES_KEY, RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';

import { resolveKnowledgeOrgId, resolveKnowledgeResourceId } from '../subconscious/scope';

function ctx(entries: Record<string, unknown>, markedScopes?: string[]): RequestContext {
  const requestContext = new RequestContext();
  for (const [key, value] of Object.entries(entries)) requestContext.set(key, value);
  if (markedScopes) setRunAgentScopes(requestContext, markedScopes);
  return requestContext;
}

describe('Subconscious knowledge identity from agent scopes', () => {
  it('reads the org from an org: scope, falling back to the legacy organizationId key', () => {
    expect(resolveKnowledgeOrgId(ctx({ [MASTRA_SCOPES_KEY]: ['org:acme'] }))).toBe('acme');
    expect(resolveKnowledgeOrgId(ctx({ organizationId: 'legacy' }))).toBe('legacy');
    expect(resolveKnowledgeOrgId(ctx({ organizationId: 'acme', [MASTRA_SCOPES_KEY]: ['org:acme'] }))).toBe('acme');
    expect(resolveKnowledgeOrgId(ctx({}))).toBeUndefined();
  });

  it('refuses an org: scope that disagrees with the legacy organizationId key', () => {
    expect(() => resolveKnowledgeOrgId(ctx({ organizationId: 'other', [MASTRA_SCOPES_KEY]: ['org:acme'] }))).toThrow(
      'needs one org',
    );
  });

  it('refuses a run holding more than one org scope', () => {
    expect(() => resolveKnowledgeOrgId(ctx({ [MASTRA_SCOPES_KEY]: ['org:acme', 'org:other'] }))).toThrow(
      'needs one org',
    );
  });

  it('refuses an org id containing a colon', () => {
    expect(() => resolveKnowledgeOrgId(ctx({ organizationId: 'acme:evil' }))).toThrow(':');
    expect(() => resolveKnowledgeOrgId(ctx({ [MASTRA_SCOPES_KEY]: ['org:acme:evil'] }))).toThrow(':');
  });

  it('anchors the resource rung on a Core-marked project: scope', () => {
    expect(resolveKnowledgeResourceId(ctx({}, ['org:acme', 'project:p1']), 'user-1')).toBe('p1');
  });

  it('ignores a project: scope Core did not mark, and the removed knowledgeResourceId override', () => {
    expect(resolveKnowledgeResourceId(ctx({ [MASTRA_SCOPES_KEY]: ['project:forged'] }), 'user-1')).toBe('user-1');
    expect(resolveKnowledgeResourceId(ctx({ knowledgeResourceId: 'override' }), 'user-1')).toBe('user-1');
  });
});
