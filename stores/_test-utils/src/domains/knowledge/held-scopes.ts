import { Knowledge, knowledgeMemoryScopes } from '@mastra/core/knowledge';
import { MastraCompositeStore } from '@mastra/core/storage';
import type { KnowledgeStorage } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * `knowledge_read` and `knowledge_list` without a target list every scope the caller holds, with its
 * role and what it can do there, before any page exists in it. Before this, a held scope showed only
 * once something had written there, so a model on its first turn concluded it had nowhere to write.
 * `createStore` returns a fresh or cleared store each time.
 */
export function createKnowledgeHeldScopeTests(createStore: () => Promise<KnowledgeStorage> | KnowledgeStorage): void {
  describe('Knowledge held scopes before any page exists (schema 4)', () => {
    let tools: Record<string, { execute?: (input: never, context: never) => unknown }>;
    const call = (tool: string, input: Record<string, unknown> = {}) =>
      tools[tool]!.execute!(input as never, {} as never) as Promise<any>;

    beforeEach(async () => {
      const store = await createStore();
      await store.init();
      await store.dangerouslyClearAll();
      const storage = new MastraCompositeStore({ id: 'held-scopes', domains: { knowledge: store } });
      const knowledge = new Knowledge({
        storage,
        tools: true,
        scopes: {
          ...knowledgeMemoryScopes(),
          // An identity with no role anywhere: held, but nothing to do there.
          'agent:$agentId': { access: [] },
          'docs:$orgId': { belongsTo: 'org:$orgId', access: [{ principal: 'org:$orgId', role: 'viewer' }] },
        },
      });
      tools = knowledge.createTools({
        principals: ['org:acme', 'agent:support', 'docs:acme', 'resource:user-abhi', 'thread:t-abhi-1'],
      }) as typeof tools;
    });

    it('knowledge_read lists every held scope with its role and what the caller can do there', async () => {
      const { scopes } = await call('knowledge_read');
      expect(scopes).toEqual([
        { address: 'org:acme', role: 'editor', can: 'write', empty: true },
        { address: 'agent:support', can: 'none', empty: true },
        { address: 'docs:acme', role: 'viewer', can: 'read', empty: true },
        { address: 'resource:user-abhi', role: 'owner', can: 'write', empty: true },
        { address: 'thread:t-abhi-1', role: 'owner', can: 'write', empty: true },
      ]);
    });

    it('knowledge_list lists them too, and a written scope then shows its name and pages', async () => {
      const before = await call('knowledge_list');
      expect(before.entries.map((entry: any) => [entry.ref, entry.role, entry.can, entry.empty])).toEqual([
        ['org:acme', 'editor', 'write', true],
        ['agent:support', undefined, 'none', true],
        ['docs:acme', 'viewer', 'read', true],
        ['resource:user-abhi', 'owner', 'write', true],
        ['thread:t-abhi-1', 'owner', 'write', true],
      ]);

      await call('knowledge_page', { op: 'write', name: 'Plan', scope: 'thread:t-abhi-1', body: 'Ship it.' });
      const { scopes } = await call('knowledge_read');
      const thread = scopes.find((scope: any) => scope.address === 'thread:t-abhi-1');
      expect(thread).toMatchObject({ role: 'owner', can: 'write', name: expect.any(String) });
      expect(thread.empty).toBeUndefined();
      const after = await call('knowledge_list');
      expect(after.entries.find((entry: any) => entry.ref === 'thread:t-abhi-1')).toMatchObject({
        children: 1,
        scope: true,
        role: 'owner',
        can: 'write',
      });
      expect(after.entries.find((entry: any) => entry.ref === 'thread:t-abhi-1').empty).toBeUndefined();
    });
  });
}
