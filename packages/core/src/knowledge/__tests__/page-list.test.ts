import { describe, expect, it } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';

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
  // A run holding both places the team scope under docs:acme; only its members can read it.
  await call([...ORG, 'docs:acme', 'team:acme:secret'], 'knowledge_read', { page: 'team:acme:secret' });
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

  it('lists children with full refs, descriptions and child counts, and every ref reads back', async () => {
    const { call } = await site();
    const result = await call(ORG, 'knowledge_list', { from: 'docs:acme#guides', depth: 2 });
    expect(result.from).toEqual({ ref: 'docs:acme#guides', name: 'Guides' });
    expect(result.entries).toEqual([
      { ref: 'docs:acme#guides/observability', name: 'Observability', depth: 1, children: 2 },
      {
        ref: 'docs:acme#guides/observability/logging',
        name: 'Logging',
        description: 'Structured logs',
        depth: 2,
        children: 0,
      },
      { ref: 'docs:acme#guides/observability/tracing', name: 'Tracing', depth: 2, children: 0 },
      { ref: 'docs:acme#guides/deploy', name: 'Deploy', depth: 1, children: 0 },
    ]);
    expect(result.more).toBeUndefined();
    for (const entry of result.entries) {
      expect((await call(ORG, 'knowledge_read', { page: entry.ref })).page.name).toBe(entry.name);
    }
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
      await call([...held], 'knowledge_read', { page: `team:acme:t${i}` });
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
});
