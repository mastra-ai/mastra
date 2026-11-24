import { describe, expect, it } from 'vitest';
import { InMemoryStore } from '../../storage/mock';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';

type Result = Record<string, any>;

// r397: the in-memory twin of `createKnowledgeSearchSnippetTests` in `@internal/storage-test-utils`,
// which runs the same checks on LibSQL and PostgreSQL.
describe('knowledge_search body snippets (r397, in-memory store)', () => {
  const run = () => {
    const knowledge = new Knowledge({ storage: new InMemoryStore(), scopes: knowledgeMemoryScopes(), tools: true });
    const tools = knowledge.createTools();
    const as =
      (resourceId: string) =>
      async (tool: string, input: Record<string, unknown>): Promise<Result> =>
        (await tools[tool]!.execute!(
          input as never,
          {
            agent: { agentId: 'a', resourceId, threadId: `t-${resourceId}` },
          } as never,
        )) as Result;
    return { mine: as('u-1'), other: as('u-2') };
  };

  it('shows the body text around a word only the body contains', async () => {
    const { mine } = run();
    await mine('knowledge_page', {
      op: 'write',
      scope: 'resource:u-1',
      name: 'Finance handbook',
      description: 'How the finance team works.',
      body: `Office hours are 9 to 5. ${'Parking is free. '.repeat(30)}Any reimbursement over $500 needs a manager's sign-off. ${'Lunch is at noon. '.repeat(30)}`,
    });
    const result = await mine('knowledge_search', { query: 'reimbursement' });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].page.snippet).toContain("reimbursement over $500 needs a manager's sign-off");
    expect(result.results[0].page.body).toBeUndefined();
  });

  it('shows where the matches are: the heading above the excerpt, the first line, the line count and a read-on hint', async () => {
    const { mine } = run();
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
    await mine('knowledge_page', { op: 'write', scope: 'resource:u-1', name: 'Finance handbook', body });
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

  it('only puts a match array in the read-on hint that knowledge_read accepts (at most 10 words)', async () => {
    const { mine } = run();
    await mine('knowledge_page', {
      op: 'write',
      scope: 'resource:u-1',
      name: 'Long query',
      body: 'alpha bravo charlie\nnothing\n',
    });
    const query = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima';
    const result = await mine('knowledge_search', { query });
    expect(result.results[0].page.line).toBe(1);
    const hint = result.more.join('\n');
    expect(hint).toContain('knowledge_read { page, from: { line } }');
    const arrays = [...hint.matchAll(/match: (\[[^\]]*\])/g)].map(m => JSON.parse(m[1]));
    expect(arrays.length).toBeGreaterThan(0);
    const words = query.split(' ');
    for (const a of arrays) {
      expect(a.length).toBeLessThanOrEqual(10);
      expect(a).toEqual(words.slice(0, a.length));
    }
    expect(hint).toContain('the first 10 of your 12 search words');
  });

  it('never returns a page or its body text from a scope the run cannot read', async () => {
    const { mine, other } = run();
    await mine('knowledge_page', {
      op: 'write',
      scope: 'resource:u-1',
      name: 'Mine',
      body: 'The escalation path is on-call.',
    });
    await other('knowledge_page', {
      op: 'write',
      scope: 'resource:u-2',
      name: 'Theirs',
      body: 'OTHER-SECRET escalation path for someone else.',
    });
    const result = await mine('knowledge_search', { query: 'escalation' });
    expect(result.results.map((hit: Result) => hit.page.name)).toEqual(['Mine']);
    expect(result.results[0].page.snippet).toContain('escalation path is on-call');
    expect(JSON.stringify(result)).not.toContain('OTHER-SECRET');
  });

  it('cuts snippets from the quote-normalized query the store searched', async () => {
    const { mine } = run();
    await mine('knowledge_page', {
      op: 'write',
      scope: 'resource:u-1',
      name: 'Rules',
      body: 'Our refund policy is simple.',
    });
    const result = await mine('knowledge_search', { query: '"refund"' });
    expect(result.results[0].page.snippet).toBe('1│Our refund policy is simple.');
  });

  // The snippet matches exactly as keyword search does (`toLowerCase()` substrings), so a body the
  // store matched always gets one and a body it did not match never does.
  it('shows a snippet when the body matched only because lowercasing İ yields i̇', async () => {
    const { mine } = run();
    await mine('knowledge_page', {
      op: 'write',
      scope: 'resource:u-1',
      name: 'Turkey',
      body: 'Flew to İSTANBUL in May.',
    });
    for (const query of ['İstanbul', 'i']) {
      const result = await mine('knowledge_search', { query });
      expect(
        result.results.map((hit: Result) => hit.page.name),
        query,
      ).toEqual(['Turkey']);
      expect(result.results[0].page.snippet, query).toBe('1│Flew to İSTANBUL in May.');
    }
  });

  it('shows no snippet when the body only case-folds to the word, as keyword search did not match it', async () => {
    const { mine } = run();
    await mine('knowledge_page', {
      op: 'write',
      scope: 'resource:u-1',
      name: 'κόσμοσ glossary',
      body: 'Ο κόσμος είναι μεγάλος.',
    });
    await mine('knowledge_page', {
      op: 'write',
      scope: 'resource:u-1',
      name: 'Mass schedule',
      body: 'Old spelling: Maſs at noon.',
    });
    for (const [query, name] of [
      ['κόσμοσ', 'κόσμοσ glossary'],
      ['mass', 'Mass schedule'],
    ] as const) {
      const result = await mine('knowledge_search', { query });
      expect(
        result.results.map((hit: Result) => hit.page.name),
        query,
      ).toEqual([name]);
      expect(result.results[0].page.snippet, query).toBeUndefined();
    }
  });

  it('keeps total snippet cost bounded at the result limit on large bodies', async () => {
    const { mine } = run();
    const big = `${'İ'.repeat(5_000)} ${'filler text '.repeat(40_000)}`;
    for (let i = 0; i < 50; i++) {
      await mine('knowledge_page', {
        op: 'write',
        scope: 'resource:u-1',
        name: `Large ${i}`,
        body: `${big} needle-${i} at the end`,
      });
    }
    const started = performance.now();
    const result = await mine('knowledge_search', { query: 'needle', limit: 50 });
    const ms = performance.now() - started;
    expect(result.results).toHaveLength(50);
    for (const hit of result.results) expect(hit.page.snippet).toMatch(/needle-\d+ at the end/);
    // Reported in the r397 proof; a generous ceiling so CI noise doesn't flake it.
    console.info(`[r397] 50 × ${big.length}-char bodies, knowledge_search limit 50: ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(10_000);
  });
});
