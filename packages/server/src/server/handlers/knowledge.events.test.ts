import { Knowledge } from '@mastra/core/knowledge';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { MASTRA_KNOWLEDGE_PRINCIPALS_KEY } from '../constants';
import { deriveAction, extractResource } from '../server-adapter/routes/permissions';
import { STREAM_KNOWLEDGE_EVENTS_ROUTE } from './knowledge';

const provenance = { author: 'agent:alex' };

/** org:acme ─┬─ team:acme:support ─ Refunds
 *            └─ team:acme:eng ─ Roadmap */
async function setup() {
  const knowledge = new Knowledge({ id: 'kb', scopes: {}, storage: new InMemoryStore({ id: 'kb' }) });
  const store = await knowledge.getStorage();
  const acme = (
    await store.materializeScope({ address: 'org:acme', declaration: 'org:$orgId', name: 'Acme', provenance })
  ).scope;
  const team = async (address: string, name: string) =>
    (
      await store.materializeScope({
        address,
        declaration: 'team:$orgId:$teamId',
        name,
        parentId: acme.id,
        provenance,
      })
    ).scope;
  const support = await team('team:acme:support', 'Support');
  const eng = await team('team:acme:eng', 'Engineering');
  const refunds = await store.createPage({ parentId: support.id, name: 'Refunds', provenance });
  const roadmap = await store.createPage({ parentId: eng.id, name: 'Roadmap', provenance });
  const mastra = new Mastra({ logger: false, knowledge: { main: knowledge } });
  return { mastra, knowledge, store, support, eng, refunds, roadmap };
}

/** Each principal reads the scope at its own address, as `Knowledge.readScopeFor` would for team scopes. */
function withAuth(mastra: Mastra, knowledge: Knowledge) {
  (knowledge as unknown as Record<string, unknown>).readScopeFor = vi.fn(async (principals: string[]) => ({
    addresses: principals,
    prefixes: [],
    children: [],
  }));
  (mastra as any).getServer = () => ({ auth: { authenticateToken: async () => ({ id: 'u1' }) } });
}

function asCaller(principals: unknown) {
  const requestContext = new RequestContext();
  requestContext.set('user', { id: 'u1' });
  if (principals !== undefined) requestContext.set(MASTRA_KNOWLEDGE_PRINCIPALS_KEY, principals);
  return requestContext;
}

async function open(mastra: Mastra, requestContext?: RequestContext) {
  const abort = new AbortController();
  const stream: ReadableStream = await STREAM_KNOWLEDGE_EVENTS_ROUTE.handler({
    mastra,
    requestContext,
    knowledgeKey: 'main',
    abortSignal: abort.signal,
  } as any);
  const reader = stream.getReader();
  return { abort, next: async () => (await reader.read()).value, read: () => reader.read() };
}

describe('Knowledge change stream', () => {
  it('sends each committed write to the owner, in order', async () => {
    const { mastra, store, support, refunds } = await setup();
    const events = await open(mastra);

    const page = await store.createPage({ parentId: support.id, name: 'Chargebacks', provenance });
    await store.addNote({
      pageId: refunds.id,
      text: 'Over $100 needs a manager.',
      stampScopeIds: [support.id],
      mentions: [],
      provenance,
    });
    await store.updatePage({ id: page.id, expectedVersion: page.version, body: 'Dispute within 30 days.', provenance });

    expect(await events.next()).toMatchObject({ kind: 'page', op: 'create', pageId: page.id, scopeId: support.id });
    expect(await events.next()).toMatchObject({ kind: 'note', op: 'add', pageId: refunds.id });
    expect(await events.next()).toMatchObject({ kind: 'page', op: 'update', pageId: page.id });
    events.abort.abort();
  });

  it("drops changes the caller can't read and never names pages outside their scopes", async () => {
    const { mastra, knowledge, store, support, eng, refunds, roadmap } = await setup();
    withAuth(mastra, knowledge);
    const events = await open(mastra, asCaller(['team:acme:support']));

    await store.updatePage({ id: roadmap.id, expectedVersion: roadmap.version, body: 'Ship Q3.', provenance });
    await store.addNote({
      pageId: roadmap.id,
      text: 'Moved to Q4.',
      stampScopeIds: [eng.id],
      mentions: [],
      provenance,
    });
    const updated = await store.updatePage({
      id: refunds.id,
      expectedVersion: refunds.version,
      body: 'Over $100 needs a manager.',
      provenance,
    });
    const first = await events.next();
    expect(first).toEqual({
      kind: 'page',
      op: 'update',
      pageId: refunds.id,
      scopeId: support.id,
      at: expect.any(String),
    });

    // Refunds leaves Support: the caller saw it before, so they hear it went, but not where.
    await store.movePage({ id: refunds.id, expectedVersion: updated.version, parentId: eng.id, provenance });
    const moved = await events.next();
    expect(moved).toEqual({ kind: 'page', op: 'move', at: expect.any(String) });
    expect(JSON.stringify([first, moved])).not.toContain(roadmap.id);
    expect(JSON.stringify(moved)).not.toContain(eng.id);
    events.abort.abort();
  });

  it('stops listening when the client disconnects', async () => {
    const { mastra, knowledge, store, refunds } = await setup();
    const onChange = vi.spyOn(knowledge, 'onChange');
    const events = await open(mastra);
    const unsubscribe = onChange.mock.results[0]!.value as () => void;
    expect(typeof unsubscribe).toBe('function');

    events.abort.abort();
    expect(await events.read()).toEqual({ done: true, value: undefined });
    await store.updatePage({ id: refunds.id, expectedVersion: refunds.version, body: 'After disconnect.', provenance });
  });

  it('ends after five minutes so the client reconnects and its read scope is resolved again', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    try {
      const { mastra } = await setup();
      const events = await open(mastra);
      // Keepalive comments arrive meanwhile; only the end matters.
      const ended = (async () => {
        while (!(await events.read()).done);
        return true;
      })();
      await vi.advanceTimersByTimeAsync(5 * 60_000 - 1);
      expect(await Promise.race([ended, Promise.resolve('open')])).toBe('open');
      await vi.advanceTimersByTimeAsync(1);
      expect(await ended).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuses an unknown instance with 404 and an unmapped caller with 403', async () => {
    const { mastra, knowledge } = await setup();
    await expect(
      STREAM_KNOWLEDGE_EVENTS_ROUTE.handler({
        mastra,
        knowledgeKey: 'nope',
        abortSignal: new AbortController().signal,
      } as any),
    ).rejects.toMatchObject({ status: 404 });
    withAuth(mastra, knowledge);
    await expect(
      STREAM_KNOWLEDGE_EVENTS_ROUTE.handler({
        mastra,
        requestContext: asCaller(undefined),
        knowledgeKey: 'main',
        abortSignal: new AbortController().signal,
      } as any),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('answers 501 on a core whose Knowledge has no change events', async () => {
    const { mastra, knowledge } = await setup();
    (knowledge as unknown as Record<string, unknown>).onChange = undefined;
    await expect(
      STREAM_KNOWLEDGE_EVENTS_ROUTE.handler({
        mastra,
        knowledgeKey: 'main',
        abortSignal: new AbortController().signal,
      } as any),
    ).rejects.toMatchObject({ status: 501, message: 'Knowledge change events need @mastra/core 1.81.0 or later.' });
  });

  it('is a GET gated by knowledge:read', () => {
    expect(STREAM_KNOWLEDGE_EVENTS_ROUTE.method).toBe('GET');
    expect(STREAM_KNOWLEDGE_EVENTS_ROUTE.requiresAuth).toBe(true);
    const { path, method } = STREAM_KNOWLEDGE_EVENTS_ROUTE;
    expect(`${extractResource(path)}:${deriveAction(method, path)}`).toBe('knowledge:read');
  });
});
