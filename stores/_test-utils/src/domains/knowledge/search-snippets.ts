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
      expect(page.snippet.replace(/^ *\d+│/gm, '').replace(/^…|…$/g, '').length).toBeLessThanOrEqual(240);
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

    it('shows where the matches are: the heading above the excerpt, the first line, the line count and a read-on hint', async () => {
      const { mine, me } = await run();
      const body = [
        '# Finance handbook',
        '',
        '## Payments',
        'Invoices are paid on the first of the month. '.repeat(12),
        '',
        '## Expenses',
        'Receipts are due within 30 days.',
        'Parking is free. '.repeat(40),
        'Any reimbursement over $500 needs a manager.',
        'Lunch is at noon. '.repeat(40),
        '## Travel',
        'Book flights early. '.repeat(40),
        'A travel reimbursement needs the receipt.',
      ].join('\n');
      await mine('knowledge_page', { op: 'write', scope: me, name: 'Finance handbook', body });
      const result = await mine('knowledge_search', { query: 'reimbursement' });
      const page = result.results[0].page;
      expect(page.line).toBe(9);
      expect(page.matchingLines).toBe(2);
      expect(page.snippet).toMatch(/^ *6│## Expenses\n/);
      expect(page.snippet).toContain('reimbursement over $500 needs a manager');
      expect(result.more).toHaveLength(1);
      expect(result.more[0]).toContain('knowledge_read { page, from: { line } }');
      expect(result.more[0]).toContain('knowledge_read { page, match: ["reimbursement"] }');
    });

    it('reports the line its excerpt is centred on, with every excerpt line numbered like knowledge_read', async () => {
      const { mine, me } = await run();
      const body = [
        'alpha is mentioned alone up here',
        ...Array.from({ length: 30 }, (_, i) => `Filler line number ${i} about nothing much at all.`),
        'The dense part: alpha beta gamma are together here',
        'closing line',
      ].join('\n');
      await mine('knowledge_page', { op: 'write', scope: me, name: 'Dense page', body });
      const result = await mine('knowledge_search', { query: 'alpha beta gamma' });
      const page = result.results[0].page;
      expect(page.line).toBe(32);
      expect(page.matchingLines).toBe(2);
      const rows = page.snippet.split('\n');
      for (const row of rows) expect(row).toMatch(/^ *\d+│/);
      expect(rows.some((row: string) => /^ *32│.*alpha beta gamma/.test(row))).toBe(true);
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
      expect(result.results[0].page.line).toBeUndefined();
      expect(result.more).toBeUndefined();
    });
  });
}
