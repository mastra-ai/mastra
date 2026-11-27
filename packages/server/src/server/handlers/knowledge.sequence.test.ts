import { Knowledge } from '@mastra/core/knowledge';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { MASTRA_KNOWLEDGE_PRINCIPALS_KEY } from '../constants';
import { knowledgeSequenceQuerySchema } from '../schemas/knowledge';
import { deriveAction, extractResource } from '../server-adapter/routes/permissions';
import { GET_KNOWLEDGE_PAGE_ROUTE, GET_KNOWLEDGE_SEQUENCE_ROUTE } from './knowledge';

const provenance = { author: 'agent:alex' };
const writtenBy = 'importer:slack';

/** org:acme ─┬─ team:acme:support ─ #support (a sequence) and Refunds (a page)
 *            └─ team:acme:eng ─ #eng (a sequence) */
async function setup() {
  const knowledge = new Knowledge({ id: 'kb', scopes: {}, storage: new InMemoryStore({ id: 'kb' }) });
  const store = await knowledge.getStorage();
  const sequences = store.sequences!;
  const acme = (
    await store.materializeScope({ address: 'org:acme', declaration: 'org:$orgId', name: 'Acme', provenance })
  ).scope;
  const scope = async (address: string, name: string) =>
    (
      await store.materializeScope({
        address,
        declaration: 'team:$orgId:$teamId',
        name,
        parentId: acme.id,
        provenance,
      })
    ).scope;
  const support = await scope('team:acme:support', 'Support');
  const eng = await scope('team:acme:eng', 'Engineering');
  const channel = await store.createPage({ parentId: support.id, name: '#support', provenance });
  const engChannel = await store.createPage({ parentId: eng.id, name: '#eng', provenance });
  const refunds = await store.createPage({ parentId: support.id, name: 'Refunds', provenance });
  await sequences.markSequence({ pageId: channel.id });
  await sequences.markSequence({ pageId: engChannel.id });
  const post = (sequenceId: string, externalId: string, day: number, body: string, thread?: string) =>
    sequences.upsertItem({
      sequenceId,
      externalId,
      occurredAt: new Date(Date.UTC(2026, 10, day, 12)),
      body,
      writtenBy,
      author: { sourceId: 'U1', name: 'Dana' },
      externalParentId: thread ?? null,
    });
  await post(channel.id, 'm1', 1, 'refund request from Globex');
  await post(channel.id, 'm2', 2, 'looking into it', 'm1');
  await post(channel.id, 'm3', 3, 'refund approved', 'm1');
  await post(channel.id, 'm4', 4, 'unrelated standup notes');
  await post(engChannel.id, 'e1', 2, 'refund service deploy');
  const mastra = new Mastra({ logger: false, knowledge: { main: knowledge } });
  return { mastra, knowledge, channel, engChannel, refunds };
}

const call = (route: { handler: (args: any) => Promise<any> }, args: Record<string, unknown>) => route.handler(args);
const ids = (result: { items: Array<{ externalId: string }> }) => result.items.map(item => item.externalId);

describe('Knowledge sequence route', () => {
  it('reads newest first and pages with nextCursor', async () => {
    const { mastra, channel } = await setup();
    const args = { mastra, knowledgeKey: 'main', pageId: channel.id };
    const first = await call(GET_KNOWLEDGE_SEQUENCE_ROUTE, { ...args, limit: 3 });
    expect(ids(first)).toEqual(['m4', 'm3', 'm2']);
    expect(first.items[0]).toMatchObject({ body: 'unrelated standup notes', author: { name: 'Dana' } });
    expect(first.nextCursor).toEqual(expect.any(String));
    const rest = await call(GET_KNOWLEDGE_SEQUENCE_ROUTE, { ...args, limit: 3, cursor: first.nextCursor });
    expect(ids(rest)).toEqual(['m1']);
    expect(rest.nextCursor).toBeNull();
  });

  it('reads a date range oldest first, and one thread', async () => {
    const { mastra, channel } = await setup();
    const args = { mastra, knowledgeKey: 'main', pageId: channel.id };
    const range = await call(GET_KNOWLEDGE_SEQUENCE_ROUTE, {
      ...args,
      since: '2026-11-02T00:00:00Z',
      until: '2026-11-04T00:00:00Z',
      order: 'asc',
    });
    expect(ids(range)).toEqual(['m2', 'm3']);
    const thread = await call(GET_KNOWLEDGE_SEQUENCE_ROUTE, { ...args, parent: 'm1', order: 'asc' });
    expect(ids(thread)).toEqual(['m1', 'm2', 'm3']);
  });

  it("searches one sequence's items by keyword, inside the date range", async () => {
    const { mastra, channel } = await setup();
    const args = { mastra, knowledgeKey: 'main', pageId: channel.id };
    const hits = await call(GET_KNOWLEDGE_SEQUENCE_ROUTE, { ...args, q: 'refund' });
    expect(ids(hits)).toEqual(['m3', 'm1']);
    expect(hits.nextCursor).toBeNull();
    const ranged = await call(GET_KNOWLEDGE_SEQUENCE_ROUTE, { ...args, q: 'refund', since: '2026-11-02T00:00:00Z' });
    expect(ids(ranged)).toEqual(['m3']);
  });

  it('rejects malformed sequence cursors at the HTTP boundary', () => {
    for (const cursor of ['bad', 'tNaN_id', 't9007199254740992_id', 't0_']) {
      expect(knowledgeSequenceQuerySchema.safeParse({ cursor }).success).toBe(false);
    }
    for (const cursor of ['bad', 'p_id', 'pA_id', 'p1_']) {
      expect(knowledgeSequenceQuerySchema.safeParse({ cursor }).success).toBe(false);
    }
    for (const cursor of ['t0_id', 't-1_item:with_underscores', 't9007199254740991_id', 'p1_id', 'pa0z_x_y']) {
      expect(knowledgeSequenceQuerySchema.safeParse({ cursor }).success).toBe(true);
    }
  });

  it('lists deleted items as body-free tombstones', async () => {
    const { mastra, knowledge, channel } = await setup();
    const store = await knowledge.getStorage();
    await store.sequences!.removeItem({ sequenceId: channel.id, externalId: 'm2', writtenBy });
    const result = await call(GET_KNOWLEDGE_SEQUENCE_ROUTE, { mastra, knowledgeKey: 'main', pageId: channel.id });
    expect(result.items.find((item: { externalId: string }) => item.externalId === 'm2')).toMatchObject({
      body: null,
      deletedAt: expect.any(Date),
    });
  });

  it("returns each item's title, type, links and properties, and the sequence's declaration", async () => {
    const { mastra, knowledge, channel } = await setup();
    const sequences = (await knowledge.getStorage()).sequences!;
    const itemTypes = {
      deploy: { label: 'Deploy', propertiesSchema: { type: 'object', properties: { env: { type: 'string' } } } },
    } as const;
    await sequences.markSequence({ pageId: channel.id, itemTypes });
    await sequences.upsertItem({
      sequenceId: channel.id,
      externalId: 'd1',
      occurredAt: new Date(Date.UTC(2026, 10, 5, 12)),
      type: 'deploy',
      title: 'Deploy 1.84',
      links: [{ url: 'https://example.com/run/1', title: 'Run 1' }],
      properties: { env: 'prod' },
      writtenBy,
    });
    const result = await call(GET_KNOWLEDGE_SEQUENCE_ROUTE, { mastra, knowledgeKey: 'main', pageId: channel.id });
    expect(result.items[0]).toMatchObject({
      externalId: 'd1',
      type: 'deploy',
      title: 'Deploy 1.84',
      body: null,
      links: [{ url: 'https://example.com/run/1', title: 'Run 1' }],
      properties: { env: 'prod' },
    });
    const page = await call(GET_KNOWLEDGE_PAGE_ROUTE, { mastra, knowledgeKey: 'main', pageId: channel.id });
    expect(page.sequence).toEqual({ orderBy: 'timeline', propertiesSchema: null, itemTypes });
  });

  it('filters by type and untyped, for reads and searches', async () => {
    const { mastra, knowledge, channel } = await setup();
    const sequences = (await knowledge.getStorage()).sequences!;
    const typed = (externalId: string, type: string, day: number) =>
      sequences.upsertItem({
        sequenceId: channel.id,
        externalId,
        occurredAt: new Date(Date.UTC(2026, 10, day, 13)),
        type,
        body: `refund ${type}`,
        writtenBy,
      });
    await typed('d1', 'deploy', 5);
    await typed('i1', 'incident', 6);
    const args = { mastra, knowledgeKey: 'main', pageId: channel.id };
    expect(ids(await call(GET_KNOWLEDGE_SEQUENCE_ROUTE, { ...args, type: ['deploy'] }))).toEqual(['d1']);
    expect(ids(await call(GET_KNOWLEDGE_SEQUENCE_ROUTE, { ...args, type: ['deploy', 'incident'] }))).toEqual([
      'i1',
      'd1',
    ]);
    expect(ids(await call(GET_KNOWLEDGE_SEQUENCE_ROUTE, { ...args, untyped: true }))).toEqual(['m4', 'm3', 'm2', 'm1']);
    expect(ids(await call(GET_KNOWLEDGE_SEQUENCE_ROUTE, { ...args, q: 'refund', type: ['incident'] }))).toEqual(['i1']);
    expect(ids(await call(GET_KNOWLEDGE_SEQUENCE_ROUTE, { ...args, q: 'refund', untyped: true }))).toEqual([
      'm3',
      'm1',
    ]);
    expect(knowledgeSequenceQuerySchema.parse({ type: 'deploy', untyped: 'true' })).toMatchObject({
      type: ['deploy'],
      untyped: true,
    });
    expect(knowledgeSequenceQuerySchema.safeParse({ type: 'Deploy' }).success).toBe(false);
    expect(knowledgeSequenceQuerySchema.safeParse({ untyped: 'yes' }).success).toBe(false);
  });

  it('reads a position sequence in position order and 400s a date range or a timeline cursor', async () => {
    const { mastra, knowledge, refunds } = await setup();
    const store = await knowledge.getStorage();
    const sequences = store.sequences!;
    await sequences.markSequence({ pageId: refunds.id, orderBy: 'position' });
    for (const [externalId, title] of [
      ['s1', 'Check the order'],
      ['s2', 'Issue the refund'],
      ['s3', 'Email the customer'],
    ] as const) {
      await sequences.upsertItem({ sequenceId: refunds.id, externalId, title, writtenBy });
    }
    const args = { mastra, knowledgeKey: 'main', pageId: refunds.id };
    const first = await call(GET_KNOWLEDGE_SEQUENCE_ROUTE, { ...args, limit: 2 });
    expect(ids(first)).toEqual(['s1', 's2']);
    expect(first.nextCursor).toMatch(/^p/);
    expect(ids(await call(GET_KNOWLEDGE_SEQUENCE_ROUTE, { ...args, cursor: first.nextCursor }))).toEqual(['s3']);
    await expect(call(GET_KNOWLEDGE_SEQUENCE_ROUTE, { ...args, since: '2026-11-02T00:00:00Z' })).rejects.toMatchObject({
      status: 400,
    });
    await expect(call(GET_KNOWLEDGE_SEQUENCE_ROUTE, { ...args, cursor: 't0_id' })).rejects.toMatchObject({
      status: 400,
    });
  });

  it("lists child pages as items that carry the page's id and current name", async () => {
    const { mastra, knowledge, refunds } = await setup();
    const store = await knowledge.getStorage();
    await store.sequences!.markSequence({ pageId: refunds.id, orderBy: 'position' });
    const step = await store.createPage({ parentId: refunds.id, name: 'Approve the refund', provenance });
    await store.updatePage({
      id: step.id,
      expectedVersion: step.version,
      name: 'Approve or deny the refund',
      provenance,
    });
    const result = await call(GET_KNOWLEDGE_SEQUENCE_ROUTE, { mastra, knowledgeKey: 'main', pageId: refunds.id });
    expect(result.items).toEqual([
      expect.objectContaining({ externalId: `page:${step.id}`, pageId: step.id, title: 'Approve or deny the refund' }),
    ]);
  });

  it('404s a page that is not a sequence, and an unknown page', async () => {
    const { mastra, refunds } = await setup();
    const args = { mastra, knowledgeKey: 'main' };
    await expect(call(GET_KNOWLEDGE_SEQUENCE_ROUTE, { ...args, pageId: refunds.id })).rejects.toMatchObject({
      status: 404,
    });
    await expect(call(GET_KNOWLEDGE_SEQUENCE_ROUTE, { ...args, pageId: 'nope' })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('marks sequence pages on the page route', async () => {
    const { mastra, channel, refunds } = await setup();
    const args = { mastra, knowledgeKey: 'main' };
    expect((await call(GET_KNOWLEDGE_PAGE_ROUTE, { ...args, pageId: channel.id })).sequence).toEqual({
      orderBy: 'timeline',
      propertiesSchema: null,
      itemTypes: null,
    });
    expect((await call(GET_KNOWLEDGE_PAGE_ROUTE, { ...args, pageId: refunds.id })).sequence).toBeUndefined();
  });

  it("404s a sequence outside what the caller's principals can read", async () => {
    const { mastra, knowledge, channel, engChannel } = await setup();
    (knowledge as unknown as Record<string, unknown>).readScopeFor = vi.fn(async (principals: string[]) => ({
      addresses: principals,
      prefixes: [],
      children: [],
    }));
    (mastra as any).getServer = () => ({ auth: { authenticateToken: async () => ({ id: 'u1' }) } });
    const requestContext = new RequestContext();
    requestContext.set('user', { id: 'u1' });
    requestContext.set(MASTRA_KNOWLEDGE_PRINCIPALS_KEY, ['team:acme:support']);
    const args = { mastra, requestContext, knowledgeKey: 'main' };
    expect(ids(await call(GET_KNOWLEDGE_SEQUENCE_ROUTE, { ...args, pageId: channel.id }))).toHaveLength(4);
    await expect(call(GET_KNOWLEDGE_SEQUENCE_ROUTE, { ...args, pageId: engChannel.id })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('bounds its query values and is a knowledge:read GET', () => {
    expect(knowledgeSequenceQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(knowledgeSequenceQuerySchema.safeParse({ since: 'yesterday' }).success).toBe(false);
    expect(knowledgeSequenceQuerySchema.safeParse({ order: 'sideways' }).success).toBe(false);
    expect(
      knowledgeSequenceQuerySchema.safeParse({ type: Array.from({ length: 21 }, (_, i) => `t${i}`) }).success,
    ).toBe(false);
    expect(knowledgeSequenceQuerySchema.parse({ limit: '5', since: '2026-11-02T00:00:00Z' })).toMatchObject({
      limit: 5,
    });
    const route = GET_KNOWLEDGE_SEQUENCE_ROUTE;
    expect(route.method).toBe('GET');
    expect(route.requiresAuth).toBe(true);
    expect(`${extractResource(route.path)}:${deriveAction(route.method, route.path)}`).toBe('knowledge:read');
  });
});
