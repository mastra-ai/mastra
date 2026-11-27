import { beforeEach, describe, expect, it } from 'vitest';
import type { KnowledgeStorage, KnowledgeSequencesStorage } from '../../storage/domains/knowledge';
import { InMemoryStore } from '../../storage/mock';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';
import { agentRunContext } from './agent-run-context';
import { conceptEmbedder, MemoryVector } from './semantic-fixtures';

type Result = Record<string, any>;
const at = (minute: number) => new Date(Date.UTC(2026, 10, 23, 12, minute));
const importer = 'importer:slack';

describe('Knowledge sequence reads through the agent tools', () => {
  let store: KnowledgeStorage;
  let sequences: KnowledgeSequencesStorage;
  let knowledge: Knowledge;

  const as = (held: string[]) => {
    const tools = knowledge.createTools();
    return async (tool: string, input: Record<string, unknown>): Promise<Result> =>
      (await tools[tool]!.execute!(input as never, agentRunContext('a', held) as never)) as Result;
  };
  const acme = () => as(['org:acme', 'resource:u-acme']);
  const globex = () => as(['org:globex', 'resource:u-globex']);

  async function sequence(scope: string, name: string) {
    const org = scope.split(':')[1];
    const written = await as([scope, `resource:u-${org}`])('knowledge_page', {
      op: 'write',
      scope,
      name,
      body: `The ${name} channel.`,
    });
    await sequences.markSequence({ pageId: written.page.id });
    return written.page.id as string;
  }
  const post = (sequenceId: string, externalId: string, minute: number, body: string, extra = {}) =>
    sequences.upsertItem({ sequenceId, externalId, occurredAt: at(minute), body, writtenBy: importer, ...extra });

  beforeEach(async () => {
    const storage = new InMemoryStore();
    store = (await storage.getStore('knowledge'))!;
    sequences = store.sequences!;
    knowledge = new Knowledge({
      storage,
      scopes: knowledgeMemoryScopes(),
      tools: true,
      vector: new MemoryVector(),
      embedder: conceptEmbedder({ fail: false, calls: 0 }),
    });
    (knowledge as any).logger = { warn() {}, debug() {}, info() {}, error() {} };
  });

  it('reads a sequence page with its latest items, newest first, and how to page on', async () => {
    const id = await sequence('org:acme', 'general');
    for (let minute = 0; minute < 25; minute++) await post(id, `m${minute}`, minute, `message ${minute}`);

    const read = await acme()('knowledge_read', { page: 'general' });
    expect(read.page.body).toBe('The general channel.');
    expect(read.sequence.items).toHaveLength(20);
    expect(read.sequence.items[0]).toMatchObject({
      externalId: 'm24',
      occurredAt: at(24).toISOString(),
      body: 'message 24',
    });
    expect(read.sequence.items[0].ref).toMatch(new RegExp(`^${read.page.ref}@[0-9A-Z]{26}$`));
    expect(read.sequence.nextCursor).toEqual(expect.any(String));
    expect(read.more.join('\n')).toContain('sequence');

    const next = await acme()('knowledge_read', { page: 'general', sequence: { cursor: read.sequence.nextCursor } });
    expect(next.sequence.items.map((e: Result) => e.externalId)).toEqual(['m4', 'm3', 'm2', 'm1', 'm0']);
    expect(next.sequence.nextCursor).toBeUndefined();
    // A range read comes without the page body.
    expect(next.page.body).toBeUndefined();
  });

  it('reads a range oldest first, with since, until and a limit, and one thread', async () => {
    const id = await sequence('org:acme', 'general');
    await post(id, 'root', 1, 'deploy is broken');
    await post(id, 'other', 2, 'lunch?');
    await post(id, 'reply', 3, 'fixed it', { externalParentId: 'root' });
    await post(id, 'late', 9, 'all good');

    const range = await acme()('knowledge_read', {
      page: 'general',
      sequence: { since: at(1).toISOString(), until: at(9).toISOString(), order: 'asc', limit: 2 },
    });
    expect(range.sequence.items.map((e: Result) => e.externalId)).toEqual(['root', 'other']);
    const rest = await acme()('knowledge_read', {
      page: 'general',
      sequence: {
        since: at(1).toISOString(),
        until: at(9).toISOString(),
        order: 'asc',
        limit: 2,
        cursor: range.sequence.nextCursor,
      },
    });
    expect(rest.sequence.items.map((e: Result) => e.externalId)).toEqual(['reply']);
    expect(rest.sequence.items[0].parent).toBe('root');

    const thread = await acme()('knowledge_read', { page: 'general', sequence: { parent: 'root', order: 'asc' } });
    expect(thread.sequence.items.map((e: Result) => e.externalId)).toEqual(['root', 'reply']);

    await expect(acme()('knowledge_read', { page: 'general', sequence: { since: 'yesterday' } })).rejects.toThrow(
      /since/,
    );
    await acme()('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Plain', body: 'Not a sequence.' });
    await expect(acme()('knowledge_read', { page: 'Plain', sequence: {} })).rejects.toThrow(/not a sequence/);
  });

  it("shows an item's title, type, links and properties, and leaves out a body it hasn't", async () => {
    const id = await sequence('org:acme', 'deploys');
    await sequences.upsertItem({
      sequenceId: id,
      externalId: 'd1',
      occurredAt: at(1),
      title: 'Deploy 1.2.0',
      type: 'deploy',
      links: [{ url: 'https://ci.example.com/runs/1', title: 'CI run' }],
      properties: { env: 'prod', ok: true },
      writtenBy: importer,
    });

    const [item] = (await acme()('knowledge_read', { page: 'deploys' })).sequence.items;
    expect(item).toMatchObject({
      externalId: 'd1',
      title: 'Deploy 1.2.0',
      type: 'deploy',
      links: [{ url: 'https://ci.example.com/runs/1', title: 'CI run' }],
      properties: { env: 'prod', ok: true },
    });
    expect(item).not.toHaveProperty('body');
    expect(item).not.toHaveProperty('position');
  });

  it('reads a position sequence first-by-position, with its child pages as items, and refuses a time range', async () => {
    const written = await acme()('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Runbook', body: 'Steps.' });
    await sequences.markSequence({ pageId: written.page.id, orderBy: 'position' });
    await sequences.upsertItem({ sequenceId: written.page.id, externalId: 's1', title: 'Drain', writtenBy: importer });
    const child = await acme()('knowledge_page', {
      op: 'write',
      scope: 'org:acme',
      parent: written.page.ref,
      name: 'Restart the workers',
      body: 'Run the restart script.',
    });
    await sequences.upsertItem({ sequenceId: written.page.id, externalId: 's3', title: 'Verify', writtenBy: importer });

    const read = await acme()('knowledge_read', { page: 'Runbook', sequence: {} });
    expect(read.sequence.items.map((item: Result) => item.title)).toEqual(['Drain', 'Restart the workers', 'Verify']);
    expect(read.sequence.items[0].position).toEqual(expect.any(String));
    expect(read.sequence.items[1].page).toBe(child.page.ref);
    expect(read.sequence.items[0]).not.toHaveProperty('page');

    const whole = await acme()('knowledge_read', { page: 'Runbook' });
    expect(whole.sequence.items.map((item: Result) => item.title)).toEqual(['Drain', 'Restart the workers', 'Verify']);
    expect(whole.more.join('\n')).toContain('by position');

    await expect(
      acme()('knowledge_read', { page: 'Runbook', sequence: { since: at(1).toISOString() } }),
    ).rejects.toThrow(/position/);
  });

  it('reads and searches items of some types, or untyped ones', async () => {
    const id = await sequence('org:acme', 'builds');
    await post(id, 'b1', 1, 'build failed on main', { type: 'build' });
    await post(id, 'd1', 2, 'deploy failed on prod', { type: 'deploy' });
    await post(id, 'n1', 3, 'note: failed twice today');

    const ids = (read: Result) => read.sequence.items.map((item: Result) => item.externalId);
    expect(ids(await acme()('knowledge_read', { page: 'builds', sequence: { types: ['build'] } }))).toEqual(['b1']);
    expect(ids(await acme()('knowledge_read', { page: 'builds', sequence: { untyped: true } }))).toEqual(['n1']);
    expect(
      ids(await acme()('knowledge_read', { page: 'builds', sequence: { types: ['deploy'], untyped: true } })),
    ).toEqual(['n1', 'd1']);

    const found = await acme()('knowledge_search', { query: 'failed', in: 'builds', types: ['deploy', 'build'] });
    expect(found.results.map((hit: Result) => hit.item.externalId)).toEqual(['d1', 'b1']);
    const untyped = await acme()('knowledge_search', { query: 'failed', untyped: true });
    expect(untyped.results.map((hit: Result) => hit.item?.externalId)).toEqual(['n1']);
  });

  it('reads one item back by its ref, and nothing through an unreadable sequence', async () => {
    const id = await sequence('org:acme', 'general');
    await post(id, 'root', 1, 'deploy is broken', { author: { id: 'U1', name: 'Ana' } });
    const [hit] = (await acme()('knowledge_read', { page: 'general' })).sequence.items;

    const read = await acme()('knowledge_read', { page: hit.ref });
    expect(read.item).toMatchObject({ ref: hit.ref, externalId: 'root', body: 'deploy is broken', author: 'Ana' });
    expect(read.page.id).toBe(id);
    expect(read.page.body).toBeUndefined();

    await expect(globex()('knowledge_read', { page: `${id}@${hit.ref.split('@')[1]}` })).rejects.toThrow();
  });

  it('finds items by keyword beside pages, narrowed by in, since and until, and never from a hidden sequence', async () => {
    const general = await sequence('org:acme', 'general');
    const ops = await sequence('org:acme', 'ops');
    const secret = await sequence('org:globex', 'secret');
    await post(general, 'g1', 1, 'the refund went through');
    await post(ops, 'o1', 2, 'refund queue is stuck');
    await post(ops, 'o2', 8, 'refund queue drained');
    await post(secret, 's1', 3, 'refund for globex');
    await acme()('knowledge_page', {
      op: 'write',
      scope: 'org:acme',
      name: 'Refund policy',
      body: 'Refunds within 30 days.',
    });

    const all = await acme()('knowledge_search', { query: 'refund' });
    const items = all.results.filter((hit: Result) => hit.type === 'item');
    expect(items.map((hit: Result) => hit.item.externalId).sort()).toEqual(['g1', 'o1', 'o2']);
    expect(items[0].page.ref).toEqual(expect.any(String));
    expect(all.results.some((hit: Result) => hit.type === 'page' && hit.page.name === 'Refund policy')).toBe(true);

    const inOps = await acme()('knowledge_search', { query: 'refund', in: 'ops' });
    expect(inOps.results.map((hit: Result) => hit.item.externalId)).toEqual(['o2', 'o1']);

    const early = await acme()('knowledge_search', { query: 'refund', until: at(5).toISOString() });
    expect(early.results.map((hit: Result) => hit.item?.externalId)).toEqual(['o1', 'g1']);
    const late = await acme()('knowledge_search', { query: 'refund', since: at(5).toISOString() });
    expect(late.results.map((hit: Result) => hit.item?.externalId)).toEqual(['o2']);

    await expect(acme()('knowledge_search', { query: 'refund', in: 'Refund policy' })).rejects.toThrow(
      /not a sequence/,
    );
  });

  it('finds an item by a word in its body but not by a paraphrase, until items are embedded', async () => {
    const general = await sequence('org:acme', 'general');
    await post(general, 'g1', 1, 'the refund went through');

    const byWord = await acme()('knowledge_search', { query: 'refund', in: 'general' });
    expect(byWord.results.map((hit: Result) => hit.item.externalId)).toEqual(['g1']);
    // "reimbursement" sits beside "refund" for this embedder; items have no vectors yet (step 5).
    const byMeaning = await acme()('knowledge_search', { query: 'reimbursement', in: 'general' });
    expect(byMeaning.results).toEqual([]);
  });
});
