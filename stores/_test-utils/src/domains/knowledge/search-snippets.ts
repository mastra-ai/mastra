import { Knowledge, knowledgeMemoryScopes } from '@mastra/core/knowledge';
import type { MastraCompositeStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

type Result = Record<string, any>;

/**
 * r397: `knowledge_search` page results carry a bounded snippet of the body around the matched words,
 * so a page that matches only in its body shows why. Runs the real tool on a real store.
 * `createStorage` returns a store; each test uses fresh resource ids, so stores may be shared.
 */
export function createKnowledgeSearchSnippetTests(
  createStorage: () => Promise<MastraCompositeStore> | MastraCompositeStore,
): void {
  describe('knowledge_search body snippets (r397)', () => {
    const run = async () => {
      const storage = await createStorage();
      const knowledge = new Knowledge({ storage, scopes: knowledgeMemoryScopes(), tools: true });
      const tools = knowledge.createTools();
      const id = Math.random().toString(36).slice(2, 10);
      const as =
        (resourceId: string) =>
        async (tool: string, input: Record<string, unknown>): Promise<Result> =>
          (await tools[tool]!.execute!(
            input as never,
            {
              agent: { agentId: 'a', resourceId, threadId: `t-${resourceId}` },
            } as never,
          )) as Result;
      return { mine: as(`u-${id}`), other: as(`o-${id}`), me: `resource:u-${id}`, them: `resource:o-${id}` };
    };

    it('shows the body text around a word only the body contains', async () => {
      const { mine, me } = await run();
      await mine('knowledge_page', {
        op: 'write',
        scope: me,
        name: 'Finance handbook',
        description: 'How the finance team works.',
        body: `Office hours are 9 to 5. ${'Parking is free. '.repeat(30)}Any reimbursement over $500 needs a manager's sign-off. ${'Lunch is at noon. '.repeat(30)}`,
      });

      const result = await mine('knowledge_search', { query: 'reimbursement' });
      expect(result.results).toHaveLength(1);
      const { page } = result.results[0];
      expect(page.name).toBe('Finance handbook');
      expect(page.snippet).toContain("reimbursement over $500 needs a manager's sign-off");
      expect(page.snippet.replace(/^…|…$/g, '').length).toBeLessThanOrEqual(240);
      expect(page.body).toBeUndefined();
    });

    it('never returns a page or its body text from a scope the run cannot read', async () => {
      const { mine, other, me, them } = await run();
      await mine('knowledge_page', { op: 'write', scope: me, name: 'Mine', body: 'The escalation path is on-call.' });
      await other('knowledge_page', {
        op: 'write',
        scope: them,
        name: 'Theirs',
        body: 'OTHER-SECRET escalation path for someone else.',
      });

      const result = await mine('knowledge_search', { query: 'escalation' });
      expect(result.results.map((hit: Result) => hit.page.name)).toEqual(['Mine']);
      expect(result.results[0].page.snippet).toContain('escalation path is on-call');
      expect(JSON.stringify(result)).not.toContain('OTHER-SECRET');
    });

    it('omits the snippet when only the name or description matches', async () => {
      const { mine, me } = await run();
      await mine('knowledge_page', {
        op: 'write',
        scope: me,
        name: 'Escalation',
        description: 'Escalation rules.',
        body: 'Call the duty manager.',
      });
      const result = await mine('knowledge_search', { query: 'escalation' });
      expect(result.results[0].page.name).toBe('Escalation');
      expect(result.results[0].page.snippet).toBeUndefined();
    });
  });
}
