import { Knowledge } from '@mastra/core/knowledge';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { MASTRA_KNOWLEDGE_PRINCIPALS_KEY } from '../constants';
import { knowledgeTimelineQuerySchema } from '../schemas/knowledge';
import { deriveAction, extractResource } from '../server-adapter/routes/permissions';
import { GET_KNOWLEDGE_PAGE_ROUTE, GET_KNOWLEDGE_TIMELINE_ROUTE } from './knowledge';

const provenance = { author: 'agent:alex' };
const writtenBy = 'importer:slack';

/** org:acme ─┬─ team:acme:support ─ #support (a timeline) and Refunds (a page)
 *            └─ team:acme:eng ─ #eng (a timeline) */
async function setup() {
  const knowledge = new Knowledge({ id: 'kb', scopes: {}, storage: new InMemoryStore({ id: 'kb' }) });
  const store = await knowledge.getStorage();
  const timelines = store.timelines!;
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
  await timelines.markTimeline({ pageId: channel.id });
  await timelines.markTimeline({ pageId: engChannel.id });
  const post = (timelineId: string, externalId: string, day: number, body: string, thread?: string) =>
    timelines.upsertEntry({
      timelineId,
      externalId,
      occurredAt: new Date(Date.UTC(2026, 10, day, 12)),
      body,
      writtenBy,
      author: { sourceId: 'U1', name: 'Dana' },
      threadExternalId: thread ?? null,
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
const ids = (result: { entries: Array<{ externalId: string }> }) => result.entries.map(entry => entry.externalId);

describe('Knowledge timeline route', () => {
  it('reads newest first and pages with nextCursor', async () => {
    const { mastra, channel } = await setup();
    const args = { mastra, knowledgeKey: 'main', pageId: channel.id };
    const first = await call(GET_KNOWLEDGE_TIMELINE_ROUTE, { ...args, limit: 3 });
    expect(ids(first)).toEqual(['m4', 'm3', 'm2']);
    expect(first.entries[0]).toMatchObject({ body: 'unrelated standup notes', author: { name: 'Dana' } });
    expect(first.nextCursor).toEqual(expect.any(String));
    const rest = await call(GET_KNOWLEDGE_TIMELINE_ROUTE, { ...args, limit: 3, cursor: first.nextCursor });
    expect(ids(rest)).toEqual(['m1']);
    expect(rest.nextCursor).toBeNull();
  });

  it('reads a date range oldest first, and one thread', async () => {
    const { mastra, channel } = await setup();
    const args = { mastra, knowledgeKey: 'main', pageId: channel.id };
    const range = await call(GET_KNOWLEDGE_TIMELINE_ROUTE, {
      ...args,
      since: '2026-11-02T00:00:00Z',
      until: '2026-11-04T00:00:00Z',
      order: 'asc',
    });
    expect(ids(range)).toEqual(['m2', 'm3']);
    const thread = await call(GET_KNOWLEDGE_TIMELINE_ROUTE, { ...args, thread: 'm1', order: 'asc' });
    expect(ids(thread)).toEqual(['m1', 'm2', 'm3']);
  });

  it("searches one timeline's entries by keyword, inside the date range", async () => {
    const { mastra, channel } = await setup();
    const args = { mastra, knowledgeKey: 'main', pageId: channel.id };
    const hits = await call(GET_KNOWLEDGE_TIMELINE_ROUTE, { ...args, q: 'refund' });
    expect(ids(hits)).toEqual(['m3', 'm1']);
    expect(hits.nextCursor).toBeNull();
    const ranged = await call(GET_KNOWLEDGE_TIMELINE_ROUTE, { ...args, q: 'refund', since: '2026-11-02T00:00:00Z' });
    expect(ids(ranged)).toEqual(['m3']);
  });

  it('rejects malformed timeline cursors at the HTTP boundary', () => {
    for (const cursor of ['bad', 'tNaN_id', 't9007199254740992_id', 't0_']) {
      expect(knowledgeTimelineQuerySchema.safeParse({ cursor }).success).toBe(false);
    }
    expect(knowledgeTimelineQuerySchema.safeParse({ cursor: 't0_id' }).success).toBe(true);
  });

  it('lists deleted entries as body-free tombstones', async () => {
    const { mastra, knowledge, channel } = await setup();
    const store = await knowledge.getStorage();
    await store.timelines!.removeEntry({ timelineId: channel.id, externalId: 'm2', writtenBy });
    const result = await call(GET_KNOWLEDGE_TIMELINE_ROUTE, { mastra, knowledgeKey: 'main', pageId: channel.id });
    expect(result.entries.find((entry: { externalId: string }) => entry.externalId === 'm2')).toMatchObject({
      body: '',
      deletedAt: expect.any(Date),
    });
  });

  it('404s a page that is not a timeline, and an unknown page', async () => {
    const { mastra, refunds } = await setup();
    const args = { mastra, knowledgeKey: 'main' };
    await expect(call(GET_KNOWLEDGE_TIMELINE_ROUTE, { ...args, pageId: refunds.id })).rejects.toMatchObject({
      status: 404,
    });
    await expect(call(GET_KNOWLEDGE_TIMELINE_ROUTE, { ...args, pageId: 'nope' })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('marks timeline pages on the page route', async () => {
    const { mastra, channel, refunds } = await setup();
    const args = { mastra, knowledgeKey: 'main' };
    expect((await call(GET_KNOWLEDGE_PAGE_ROUTE, { ...args, pageId: channel.id })).timeline).toBe(true);
    expect((await call(GET_KNOWLEDGE_PAGE_ROUTE, { ...args, pageId: refunds.id })).timeline).toBeUndefined();
  });

  it("404s a timeline outside what the caller's principals can read", async () => {
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
    expect(ids(await call(GET_KNOWLEDGE_TIMELINE_ROUTE, { ...args, pageId: channel.id }))).toHaveLength(4);
    await expect(call(GET_KNOWLEDGE_TIMELINE_ROUTE, { ...args, pageId: engChannel.id })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('bounds its query values and is a knowledge:read GET', () => {
    expect(knowledgeTimelineQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(knowledgeTimelineQuerySchema.safeParse({ since: 'yesterday' }).success).toBe(false);
    expect(knowledgeTimelineQuerySchema.safeParse({ order: 'sideways' }).success).toBe(false);
    expect(knowledgeTimelineQuerySchema.parse({ limit: '5', since: '2026-11-02T00:00:00Z' })).toMatchObject({
      limit: 5,
    });
    const route = GET_KNOWLEDGE_TIMELINE_ROUTE;
    expect(route.method).toBe('GET');
    expect(route.requiresAuth).toBe(true);
    expect(`${extractResource(route.path)}:${deriveAction(route.method, route.path)}`).toBe('knowledge:read');
  });
});
