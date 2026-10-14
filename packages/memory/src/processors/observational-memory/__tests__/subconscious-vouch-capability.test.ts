import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

// Simulate an older Core that ships the Knowledge API but not the vouch hook: no capability
// marker, and materializeScope clones its whole input.
vi.mock('@mastra/core/knowledge', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { KNOWLEDGE_VOUCH_RUN_SCOPES: _marker, ...rest } = actual;
  return { ...rest, KNOWLEDGE_VOUCH_RUN_SCOPES: undefined };
});

import { resolveKnowledgeScopeIds } from '../subconscious/knowledge-tools';

describe('Knowledge vouch capability', () => {
  it('does not hand a live request context to a Core without the vouch hook', async () => {
    const materializeScope = vi.fn(async (input: { address: string }) => {
      structuredClone(input);
      return { scopes: { [input.address]: `id:${input.address}` } };
    });
    const memory = { getKnowledgeInstance: () => ({ materializeScope }) } as any;
    const requestContext = new RequestContext<any>([
      ['organizationId', 'acme'],
      ['onEvent', () => undefined],
    ]);

    await expect(
      resolveKnowledgeScopeIds(memory, { agent: { resourceId: 'r1', threadId: 't1' }, requestContext }),
    ).resolves.toHaveLength(3);
    for (const [input] of materializeScope.mock.calls) expect(input).not.toHaveProperty('requestContext');
  });
});
