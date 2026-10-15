import { getRunAgentScopes, setRunAgentScopes } from '@mastra/core/agent';
import { KNOWLEDGE_VOUCH_RUN_SCOPES } from '@mastra/core/knowledge';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { resolveKnowledgeScopeIds } from '../subconscious/knowledge-tools';

describe('Knowledge vouch pass-through', () => {
  it('passes the run request context to a Core that advertises the vouch capability', async () => {
    expect(KNOWLEDGE_VOUCH_RUN_SCOPES).toBe(true);
    const materializeScope = vi.fn(async (input: { address: string; requestContext?: unknown }) => ({
      scopes: { [input.address]: `id:${input.address}` },
    }));
    const memory = { getKnowledgeInstance: () => ({ materializeScope }) } as any;
    const requestContext = new RequestContext<any>([['organizationId', 'acme']]);
    setRunAgentScopes(requestContext, ['org:acme', 'project:p1']);

    await resolveKnowledgeScopeIds(memory, { agent: { resourceId: 'r1', threadId: 't1' }, requestContext });

    expect(materializeScope).toHaveBeenCalledTimes(3);
    for (const [input] of materializeScope.mock.calls) {
      expect(input.requestContext).toBe(requestContext);
      expect(getRunAgentScopes(input.requestContext as RequestContext)).toEqual(['org:acme', 'project:p1']);
    }
  });
});
