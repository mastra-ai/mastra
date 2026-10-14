import * as coreKnowledge from '@mastra/core/knowledge';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { knowledgeRunContext, resolveKnowledgeScopeIds } from '../subconscious/knowledge-tools';

describe('Knowledge vouch capability', () => {
  const requestContext = new RequestContext<any>([
    ['organizationId', 'acme'],
    ['onEvent', () => undefined],
  ]);

  it('does not hand a live request context to a Core without the vouch hook', () => {
    // An older Core: the Knowledge API without the capability marker. It clones its input.
    const { KNOWLEDGE_VOUCH_RUN_SCOPES: _marker, ...olderCore } = coreKnowledge as Record<string, unknown>;
    const input = { address: 'org:acme', ...knowledgeRunContext(requestContext, olderCore) };

    expect(input).not.toHaveProperty('requestContext');
    expect(() => structuredClone(input)).not.toThrow();
  });

  it('passes the request context to a Core that advertises the vouch capability', () => {
    expect(knowledgeRunContext(requestContext, coreKnowledge as Record<string, unknown>)).toEqual({ requestContext });
  });

  it('resolveKnowledgeScopeIds withholds the request context from an older Core', async () => {
    const { KNOWLEDGE_VOUCH_RUN_SCOPES: _marker, ...olderCore } = coreKnowledge as Record<string, unknown>;
    const materializeScope = vi.fn(async (input: { address: string }) => {
      structuredClone(input);
      return { scopes: { [input.address]: `id:${input.address}` } };
    });
    const memory = { getKnowledgeInstance: () => ({ materializeScope }) } as any;

    await resolveKnowledgeScopeIds(memory, { agent: { resourceId: 'r1', threadId: 't1' }, requestContext }, olderCore);

    expect(materializeScope).toHaveBeenCalledTimes(3);
    for (const [input] of materializeScope.mock.calls) expect(input).not.toHaveProperty('requestContext');
  });
});
