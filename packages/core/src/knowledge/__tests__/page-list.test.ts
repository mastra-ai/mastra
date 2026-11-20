import { describe, expect, it, vi } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';
import { KNOWLEDGE_READ_BODY_TOKENS } from '../page-body';

const memory = knowledgeMemoryScopes();

function setup() {
  const storage = new InMemoryStore();
  const knowledge = new Knowledge({
    storage,
    tools: true,
    scopes: {
      ...memory,
      'docs:$orgId': {
        belongsTo: 'org:$orgId',
        access: [{ principal: 'org:$orgId', role: 'viewer' }],
      },
      'team:$orgId:$teamId': {
        belongsTo: 'docs:$orgId',
        access: [{ principal: 'self', role: 'owner' }],
      },
    },
  });
  const tools = knowledge.createTools();
  const call = (held: string[], tool: string, input: Record<string, unknown>) => {
    const requestContext = new RequestContext();
    setRunAgentScopes(requestContext, held);
    return tools[tool]!.execute!(input as never, { requestContext, agent: { agentId: 'a' } } as never) as Promise<any>;
  };
  return { knowledge, storage, call };
}

const ORG = ['org:acme'];

/** docs:acme with a nested section, a wide section and a private team scope under it. */
async function site() {
  const env = setup();
  const { knowledge, call } = env;
  const write = (path: string, name: string, description?: string) =>
    knowledge.upsertPage({ scope: 'docs:acme', path, name, ...(description ? { description } : {}) });
  await write('guides', 'Guides', 'How-to guides');
  await write('guides/observability', 'Observability');
  await write('guides/observability/logging', 'Logging', 'Structured logs');
  await write('guides/observability/tracing', 'Tracing');
  await write('guides/deploy', 'Deploy');
  await write('reference', 'Reference');
  for (let i = 0; i < 12; i++) await write(`reference/api-${String(i).padStart(2, '0')}`, `API ${i}`);
  // A writing run holding both places the team scope under docs:acme; only its members can read it.
  await call([...ORG, 'docs:acme', 'team:acme:secret'], 'knowledge_page', {
    op: 'write',
    page: 'team:acme:secret',
    body: 'Team notes.',
  });
  await knowledge.upsertPage({ scope: 'team:acme:secret', path: 'plans', name: 'Secret plans' });
  return env;
}

describe('knowledge_list', () => {
  it('without a starting point lists the scopes the run can read', async () => {
    const { call } = await site();
    const { entries } = await call([...ORG, 'docs:acme'], 'knowledge_list', {});
    expect(entries.map((entry: any) => entry.ref)).toEqual(['org:acme', 'docs:acme']);
    expect(entries.every((entry: any) => entry.scope === true && entry.depth === 1)).toBe(true);
    expect(entries.find((entry: any) => entry.ref === 'docs:acme').children).toBe(2);
  });

  it('lists children with full refs and child counts, and every ref reads back', async () => {
    const { call } = await site();
    const result = await call(ORG, 'knowledge_list', { from: 'docs:acme#guides', depth: 2 });
    expect(result.from).toEqual({ ref: 'docs:acme#guides', name: 'Guides' });
    expect(result.entries).toEqual([
      { ref: 'docs:acme#guides/observability', name: 'Observability', depth: 1, children: 2 },
      { ref: 'docs:acme#guides/observability/logging', name: 'Logging', depth: 2, children: 0 },
      { ref: 'docs:acme#guides/observability/tracing', name: 'Tracing', depth: 2, children: 0 },
      { ref: 'docs:acme#guides/deploy', name: 'Deploy', depth: 1, children: 0 },
    ]);
    expect(result.more).toBeUndefined();
    for (const entry of result.entries) {
      expect((await call(ORG, 'knowledge_read', { page: entry.ref })).page.name).toBe(entry.name);
    }
  });

  it('adds descriptions only when asked', async () => {
    const { call } = await site();
    const result = await call(ORG, 'knowledge_list', {
      from: 'docs:acme#guides/observability',
      descriptions: true,
    });
    expect(result.entries[0]).toEqual({
      ref: 'docs:acme#guides/observability/logging',
      name: 'Logging',
      description: 'Structured logs',
      depth: 1,
      children: 0,
    });
  });

  it("doesn't show a scope the run can't read, or count its pages", async () => {
    const { call } = await site();
    const outsider = await call(ORG, 'knowledge_list', { from: 'docs:acme' });
    expect(outsider.entries.map((entry: any) => entry.ref)).toEqual(['docs:acme#guides', 'docs:acme#reference']);
    await expect(call(ORG, 'knowledge_list', { from: 'team:acme:secret' })).rejects.toThrow(/not found/);
    await expect(call(ORG, 'knowledge_list', { from: 'team:acme:nope' })).rejects.toThrow(/not found/);

    const member = await call([...ORG, 'team:acme:secret'], 'knowledge_list', { from: 'docs:acme', depth: 2 });
    expect(member.entries.slice(0, 2)).toEqual([
      { ref: 'team:acme:secret', name: 'team:acme:secret', depth: 1, children: 1, scope: true },
      { ref: 'team:acme:secret#plans', name: 'Secret plans', depth: 2, children: 0 },
    ]);
  });

  it('has the store leave out child scopes the run cannot read, instead of reading them all', async () => {
    const { call, storage } = await site();
    for (let i = 0; i < 30; i++) {
      const team = `team:acme:t${String(i).padStart(2, '0')}`;
      await call([...ORG, 'docs:acme', team], 'knowledge_page', { op: 'write', page: team, body: 'Team notes.' });
    }
    const store = (await storage.getStore('knowledge'))!;
    const listed = vi.spyOn(store, 'listChildScopes');

    const member = await call([...ORG, 'team:acme:secret'], 'knowledge_list', { from: 'docs:acme', depth: 2 });
    expect(member.entries.slice(0, 3).map((entry: any) => entry.ref)).toEqual([
      'team:acme:secret',
      'team:acme:secret#plans',
      'docs:acme#guides',
    ]);
    expect(member.entries.filter((entry: any) => entry.scope)).toHaveLength(1);
    // Every scope page the store handed back was one the run can read.
    const returned = await Promise.all(listed.mock.results.map(result => result.value));
    expect(listed.mock.calls.every(([input]) => input.read !== undefined)).toBe(true);
    expect(returned.flatMap(result => result.pages).map(scope => scope.address)).toEqual(['team:acme:secret']);
  });

  it('leaves out unreadable child scopes even when a store ignores read', async () => {
    const { call, storage } = await site();
    for (const team of ['team:acme:secret', 'team:acme:other']) {
      await call([...ORG, 'docs:acme', team], 'knowledge_page', { op: 'write', page: team, body: 'Team notes.' });
    }
    const store = (await storage.getStore('knowledge'))!;
    const list = store.listChildScopes.bind(store);
    vi.spyOn(store, 'listChildScopes').mockImplementation(({ read: _read, ...input }) => list(input));

    const member = await call([...ORG, 'team:acme:secret'], 'knowledge_list', { from: 'docs:acme', depth: 2 });
    const scopes = member.entries.filter((entry: any) => entry.scope).map((entry: any) => entry.ref);
    expect(scopes).toEqual(['team:acme:secret']);
  });

  it('pages through a wide level by cursor without repeats', async () => {
    const { call } = await site();
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await call(ORG, 'knowledge_list', {
        from: 'docs:acme#reference',
        limit: 5,
        ...(cursor ? { cursor } : {}),
      });
      expect(page.entries.length).toBeLessThanOrEqual(5);
      seen.push(...page.entries.map((entry: any) => entry.ref));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(12);
    expect(new Set(seen).size).toBe(12);
    expect(seen[0]).toBe('docs:acme#reference/api-00');
  });

  it('caps the starting level at the limit, child scopes included, and pages on through scopes then pages', async () => {
    const { knowledge, call } = setup();
    const held = ['org:acme', 'docs:acme'];
    for (let i = 0; i < 4; i++) {
      held.push(`team:acme:t${i}`);
      await call([...held], 'knowledge_page', { op: 'write', page: `team:acme:t${i}`, body: 'Team notes.' });
    }
    for (let i = 0; i < 3; i++) await knowledge.upsertPage({ scope: 'docs:acme', path: `p${i}`, name: `P${i}` });
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let turn = 0; turn < 10; turn++) {
      const page = await call(held, 'knowledge_list', { from: 'docs:acme', limit: 3, ...(cursor ? { cursor } : {}) });
      expect(page.entries.length).toBeLessThanOrEqual(3);
      seen.push(...page.entries.map((entry: any) => entry.ref));
      cursor = page.nextCursor;
      if (!cursor) {
        expect(page.more).toBeUndefined();
        break;
      }
      expect(page.more).toEqual([`entries: more at depth 1. List again with from: "docs:acme", cursor: "${cursor}".`]);
    }
    expect(seen).toEqual([
      'team:acme:t0',
      'team:acme:t1',
      'team:acme:t2',
      'team:acme:t3',
      'docs:acme#p0',
      'docs:acme#p1',
      'docs:acme#p2',
    ]);

    const roots = await call(held, 'knowledge_list', { limit: 2 });
    expect(roots.entries.map((entry: any) => entry.ref)).toEqual(['org:acme', 'docs:acme']);
    expect(roots.more).toEqual([`entries: more at depth 1. List again with cursor: "${roots.nextCursor}".`]);
    const rest = await call(held, 'knowledge_list', { limit: 10, cursor: roots.nextCursor });
    expect(rest.entries).toHaveLength(4);
    await expect(call(held, 'knowledge_list', { cursor: 'bogus' })).rejects.toThrow(/did not come from knowledge_list/);
  });

  it('moves on to child pages when the child scopes exactly fill the limit', async () => {
    const { knowledge, call } = setup();
    const held = ['org:acme', 'docs:acme'];
    for (let i = 0; i < 3; i++) {
      held.push(`team:acme:t${i}`);
      await call([...held], 'knowledge_page', { op: 'write', page: `team:acme:t${i}`, body: 'Team notes.' });
    }
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'p0', name: 'P0' });
    const first = await call(held, 'knowledge_list', { from: 'docs:acme', limit: 3 });
    expect(first.entries.map((entry: any) => entry.ref)).toEqual(['team:acme:t0', 'team:acme:t1', 'team:acme:t2']);
    expect(first.nextCursor).toBe('p');
    const second = await call(held, 'knowledge_list', { from: 'docs:acme', limit: 3, cursor: first.nextCursor });
    expect(second.entries.map((entry: any) => entry.ref)).toEqual(['docs:acme#p0']);
    expect(second.nextCursor).toBeUndefined();
  });

  it('says when deeper levels were cut off by the limit', async () => {
    const { call } = await site();
    const result = await call(ORG, 'knowledge_list', { from: 'docs:acme', depth: 3, limit: 6 });
    expect(result.entries).toHaveLength(6);
    expect(result.more).toEqual([expect.stringMatching(/stopped listing deeper levels at 6 entries/)]);
    const reference = result.entries.find((entry: any) => entry.ref === 'docs:acme#reference');
    expect(reference.children).toBe(12);
  });

  it('names a page without a key by its id, and its children too', async () => {
    const { call } = await site();
    const loose = await call(ORG.concat('docs:acme'), 'knowledge_page', {
      op: 'write',
      scope: 'org:acme',
      name: 'Loose',
    });
    await call(ORG, 'knowledge_page', {
      op: 'write',
      scope: 'org:acme',
      parent: loose.page.id,
      name: 'Under',
      key: 'under',
    });
    const { entries } = await call(ORG, 'knowledge_list', { from: 'org:acme' });
    const entry = entries.find((candidate: any) => candidate.name === 'Loose');
    expect(entry).toMatchObject({ ref: loose.page.id, children: 1 });
    const below = await call(ORG, 'knowledge_list', { from: entry.ref });
    expect(below.entries[0].ref).toMatch(/^[^#]+$/);
    expect((await call(ORG, 'knowledge_read', { page: below.entries[0].ref })).page.name).toBe('Under');
  });

  it('stops at about the read token cap of entries and pages through the rest, each entry once, at depth 2', async () => {
    const { knowledge, call } = setup();
    const long = (i: number) => `Section ${i}: ${'detail '.repeat(60).trim()}`;
    const expected: string[] = [];
    for (let i = 0; i < 12; i++) {
      const section = `s${String(i).padStart(2, '0')}`;
      await knowledge.upsertPage({ scope: 'docs:acme', path: section, name: `S${i}`, description: long(i) });
      expected.push(`docs:acme#${section}`);
      for (let j = 0; j < 7; j++) {
        const path = `${section}/c${j}`;
        await knowledge.upsertPage({ scope: 'docs:acme', path, name: `C${i}.${j}`, description: long(j) });
        expected.push(`docs:acme#${path}`);
      }
    }
    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const result = await call(ORG, 'knowledge_list', {
        from: 'docs:acme',
        depth: 2,
        limit: 100,
        descriptions: true,
        ...(cursor ? { cursor } : {}),
      });
      pages++;
      seen.push(...result.entries.map((entry: any) => entry.ref));
      expect(JSON.stringify(result.entries).length).toBeLessThan(KNOWLEDGE_READ_BODY_TOKENS * 6);
      cursor = result.nextCursor;
      if (cursor) {
        expect(result.more).toEqual([
          expect.stringMatching(
            new RegExp(
              `^entries: stopped at about ${KNOWLEDGE_READ_BODY_TOKENS.toLocaleString('en-US')} tokens; \\d+ more entries \\(about [\\d,]+ tokens\\) left out\\. List again with from: "docs:acme", cursor: "${cursor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\.$`,
            ),
          ),
        ]);
      }
    } while (cursor && pages < 200);
    expect(pages).toBeGreaterThan(1);
    expect(seen).toEqual(expected);
  });

  it('pages a token cut that falls inside the count limit through to the depth-1 cursor', async () => {
    const { knowledge, call } = setup();
    const long = 'detail '.repeat(60).trim();
    for (let i = 0; i < 70; i++) {
      await knowledge.upsertPage({
        scope: 'docs:acme',
        path: `p${String(i).padStart(2, '0')}`,
        name: `P${i}`,
        description: long,
      });
    }
    const first = await call(ORG, 'knowledge_list', { from: 'docs:acme', limit: 60, descriptions: true });
    expect(first.entries.length).toBeLessThan(60);
    expect(first.more[0]).toMatch(/^entries: stopped at about [\d,]+ tokens/);
    const seen: string[] = [];
    let cursor: string | undefined;
    let result: any;
    do {
      result = await call(ORG, 'knowledge_list', {
        from: 'docs:acme',
        limit: 60,
        descriptions: true,
        ...(cursor ? { cursor } : {}),
      });
      seen.push(...result.entries.map((entry: any) => entry.ref));
      cursor = result.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(70);
    expect(new Set(seen).size).toBe(70);
    await expect(call(ORG, 'knowledge_list', { from: 'docs:acme', cursor: 't1.5.x.' })).rejects.toThrow(
      /did not come from knowledge_list/,
    );
  });
});
