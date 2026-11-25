import { describe, expect, it, vi } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import type { KnowledgeStorage } from '../../storage/domains/knowledge';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';

const memory = knowledgeMemoryScopes();
const host = { author: 'host' };
const alex = { author: 'agent:alex' };

/**
 * Each test writes at its own later base time: the in-memory store's clock never steps back, and the
 * scope rows it creates land just before the base, out of the ranges the tests ask for.
 */
let base = Date.UTC(2031, 0, 1);

async function at<T>(ms: number, write: () => Promise<T>): Promise<T> {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(ms);
  try {
    return await write();
  } finally {
    vi.useRealTimers();
  }
}

async function setup(config: { maxTokens?: number } = {}) {
  base += 10_000_000;
  const T0 = base;
  const storage = new InMemoryStore();
  const knowledge = new Knowledge({
    storage,
    tools: { read: config.maxTokens ? { maxTokens: config.maxTokens } : true, write: true },
    scopes: { ...memory, 'org:$orgId': { ...memory['org:$orgId'], access: [{ principal: 'self', role: 'owner' }] } },
  });
  const store = (await knowledge.getStorage()) as KnowledgeStorage;
  const tools = knowledge.createTools();
  const call = (input: Record<string, unknown>, held = ['org:acme']) => {
    const requestContext = new RequestContext();
    setRunAgentScopes(requestContext, held);
    return tools.knowledge_activity!.execute!(
      input as never,
      { requestContext, agent: { agentId: 'a' } } as never,
    ) as Promise<any>;
  };
  const scope = (address: string) =>
    at(T0 - 60_000, async () => {
      const declaration = address.startsWith('resource:') ? 'resource:$resourceId' : 'org:$orgId';
      return (await store.materializeScope({ address, declaration, name: address, provenance: host })).scope;
    });
  const acme = await scope('org:acme');
  const secret = await scope('org:secret');
  const user = await scope('resource:u1');
  const page = (ms: number, parentId: string, name: string) =>
    at(ms, () => store.createPage({ parentId, name, provenance: alex }));
  const note = (ms: number, pageId: string, text: string, stampScopeIds = [acme.id]) =>
    at(ms, () => store.addNote({ pageId, text, stampScopeIds, mentions: [], provenance: alex }));
  return { T0, knowledge, store, call, acme, secret, user, page, note };
}

const day = (ms: number) => new Date(ms).toISOString();
const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (error: unknown) => error as Error,
  );

describe('knowledge_activity: what changed over a period', () => {
  it('returns page and note changes in range, newest first, with current note text', async () => {
    const { T0, store, call, acme, page, note } = await setup();
    const old = await page(T0 - 5000, acme.id, 'Old plan');
    const pricing = await page(T0 + 1000, acme.id, 'Pricing');
    await note(T0 + 2000, pricing.id, '[2026-08-02] Enterprise plan discontinued');
    await at(T0 + 3000, () =>
      store.updatePage({ id: pricing.id, expectedVersion: 1, body: 'PAYG only', provenance: alex }),
    );

    const result = await call({ since: day(T0) });
    expect(result.changes.map((change: any) => [change.action, change.page.name])).toEqual([
      ['page-updated', 'Pricing'],
      ['note-added', 'Pricing'],
      ['page-created', 'Pricing'],
    ]);
    // The reference store stamps its activity row a millisecond after the write.
    expect(Date.parse(result.changes[1].at) - (T0 + 2000)).toBeLessThanOrEqual(1);
    expect(result.changes[1]).toMatchObject({
      author: 'agent:alex',
      // Unkeyed pages are read by id; the ref is what knowledge_read takes.
      page: { ref: pricing.id, name: 'Pricing' },
      note: { text: '[2026-08-02] Enterprise plan discontinued', current: true },
    });
    expect(result.more).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain(old.id);
  });

  it('marks a removed note as removed and shows no text', async () => {
    const { T0, store, call, acme, page, note } = await setup();
    const p = await page(T0 + 1000, acme.id, 'SOC');
    const n = await note(T0 + 2000, p.id, 'SOC verified on 2026-09-01');
    await at(T0 + 3000, () => store.removeNote({ id: n.id, deletedBy: 'agent:alex', provenance: alex }));
    const { changes } = await call({ since: day(T0) });
    const noteChanges = changes.filter((change: any) => change.note);
    expect(noteChanges.map((change: any) => change.action)).toEqual(['note-removed', 'note-added']);
    for (const change of noteChanges) expect(change.note).toEqual({ ref: n.id, removed: true });
    expect(JSON.stringify(changes)).not.toContain('SOC verified');
  });

  it('shows a deleted page change with the page name and deleted: true', async () => {
    const { T0, store, call, acme, page } = await setup();
    const p = await page(T0 + 1000, acme.id, 'Retired plan');
    await at(T0 + 2000, () => store.deletePage({ id: p.id, expectedVersion: p.version, deletedBy: 'agent:alex' }));
    const { changes } = await call({ since: day(T0) });
    expect(changes.map((change: any) => change.action)).toEqual(['page-deleted', 'page-created']);
    for (const change of changes) expect(change.page).toMatchObject({ name: 'Retired plan', deleted: true });
  });

  it('never shows changes the run cannot read, and treats an unreadable from as not found', async () => {
    const { T0, call, acme, secret, user, page, note } = await setup();
    const visible = await page(T0 + 1000, acme.id, 'Visible');
    const hidden = await page(T0 + 2000, secret.id, 'Hidden plan');
    await note(T0 + 3000, visible.id, 'private aside', [user.id]);
    const result = await call({ since: day(T0), limit: 1 });
    expect(result.changes.map((change: any) => change.page.name)).toEqual(['Visible']);
    expect(result.more).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/Hidden plan|private aside/);
    await expect(call({ since: day(T0), from: hidden.id })).rejects.toThrow(/not found/i);
    await expect(call({ since: day(T0), from: 'org:secret' })).rejects.toThrow(/not found/i);
  });

  it('narrows to one page or scope with from', async () => {
    const { T0, call, acme, page } = await setup();
    const a = await page(T0 + 1000, acme.id, 'A');
    await page(T0 + 2000, acme.id, 'B');
    const result = await call({ since: day(T0), from: a.id });
    expect(result.from).toMatchObject({ name: 'A' });
    expect(result.changes.map((change: any) => change.page.name)).toEqual(['A']);
    expect((await call({ since: day(T0), from: 'org:acme' })).changes).toHaveLength(2);
  });

  it('omits a change whose note was restamped out of reach after listing, and still moves past it', async () => {
    const { T0, store, call, acme, user, page, note } = await setup();
    const p = await page(T0 + 1000, acme.id, 'Accounts');
    const n = await note(T0 + 2000, p.id, 'about to go private');
    const original = store.getNote.bind(store);
    // Armed, the next lookup of the note first restamps it to a scope the run can't read.
    let armed = true;
    vi.spyOn(store, 'getNote').mockImplementation(async input => {
      if (armed && input.id === n.id) {
        armed = false;
        const current = (await original({ id: n.id, read: 'all' }))!;
        await store.restampNote({
          id: n.id,
          expectedVersion: current.version,
          stampScopeIds: [user.id],
          provenance: host,
        });
      }
      return original(input);
    });
    const restore = async () => {
      const current = (await original({ id: n.id, read: 'all' }))!;
      await at(T0 + 2600, () =>
        store.restampNote({ id: n.id, expectedVersion: current.version, stampScopeIds: [acme.id], provenance: host }),
      );
    };

    // Only the note change is in range: it is consumed and left out, with nothing to resume.
    expect(await call({ since: day(T0 + 1500), until: day(T0 + 2500) })).toEqual({ changes: [] });

    // With the page change in range too, a limit of 1 walks past the omitted note change to it.
    await restore();
    armed = true;
    const walked = await call({ since: day(T0), until: day(T0 + 2500), limit: 1 });
    expect(walked.changes.map((change: any) => change.action)).toEqual(['page-created']);
    expect(JSON.stringify(walked)).not.toMatch(/removed|about to go private/);
  });

  it('omits a change whose page moved out of reach after listing, without naming it', async () => {
    const { T0, store, call, acme, secret, page } = await setup();
    const keep = await page(T0 + 1000, acme.id, 'Keep');
    const leaving = await page(T0 + 2000, acme.id, 'Leaving');
    const original = store.getPage.bind(store);
    let fired = false;
    vi.spyOn(store, 'getPage').mockImplementation(async input => {
      if (!fired && input.id === leaving.id) {
        fired = true;
        await store.movePage({ id: leaving.id, expectedVersion: 1, parentId: secret.id, provenance: host });
      }
      return original(input);
    });
    const result = await call({ since: day(T0) });
    expect(result.changes.map((change: any) => change.page.name)).toEqual(['Keep']);
    expect(JSON.stringify(result)).not.toContain('Leaving');
    expect(keep).toBeDefined();
  });
});

describe('knowledge_activity: continuation', () => {
  it('bounds the batches one call reads when changes turn out unreadable, and resumes past them without gaps', async () => {
    const { T0, store, call, acme, page } = await setup();
    const visible = await page(T0 + 1000, acme.id, 'Still visible');
    const hidden: string[] = [];
    for (let index = 0; index < 30; index++) {
      hidden.push((await page(T0 + 2000 + index * 10, acme.id, `Gone ${index}`)).id);
    }
    // Listed under the run's read, then unreadable by the time they're hydrated.
    const original = store.getPage.bind(store);
    vi.spyOn(store, 'getPage').mockImplementation(async input =>
      hidden.includes(input.id) ? undefined : original(input),
    );
    const list = vi.spyOn(store, 'listPageActivity');

    const seen: any[] = [];
    let cursor: string | undefined;
    let calls = 0;
    do {
      list.mockClear();
      const result = await call({ since: day(T0), limit: 2, ...(cursor ? { cursor } : {}) });
      calls++;
      // Each call stops at its batch budget, even with nothing to show.
      expect(list.mock.calls.length).toBeLessThanOrEqual(8);
      seen.push(...result.changes);
      expect(JSON.stringify(result)).not.toMatch(/Gone \d+/);
      for (const id of hidden) expect(JSON.stringify(result)).not.toContain(id);
      cursor = result.more ? result.cursor : undefined;
      if (result.more) expect(result.cursor).toEqual(expect.any(String));
    } while (cursor && calls < 10);

    // 30 hidden changes at 2 per batch take more than one call's 8 batches.
    expect(calls).toBeGreaterThan(1);
    expect(seen.map(change => change.page.name)).toEqual(['Still visible']);
    expect(seen[0].page.ref).toBe(visible.id);
  });

  it('stops instead of looping when the store returns a continuation without changes', async () => {
    const { T0, store, call } = await setup();
    const list = vi.spyOn(store, 'listPageActivity').mockResolvedValue({ events: [], nextCursor: 'stuck' });
    await expect(call({ since: day(T0) })).rejects.toThrow(/continuation without any changes/);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('resumes after the last change a token-limited result returned, every change exactly once', async () => {
    const { T0, store, call, acme, page, note } = await setup({ maxTokens: 300 });
    // Seeded note sizes, so the small budget stops mid-batch at varying points.
    let seed = 7;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const p = await page(T0 + 1, acme.id, 'Log');
    for (let i = 0; i < 30; i++) {
      await note(T0 + 1000 * (i + 2), p.id, `entry ${i} ` + 'x'.repeat(Math.floor(rand() * 400)));
    }
    const walk: string[] = [];
    let cursor: string | undefined;
    let calls = 0;
    let stoppedMidBatch = false;
    do {
      const result: any = await call({ since: day(T0), limit: 7, ...(cursor ? { cursor } : {}) });
      calls++;
      expect(result.changes.length).toBeGreaterThan(0);
      if (result.cursor && result.changes.length < 7) stoppedMidBatch = true;
      walk.push(...result.changes.map((change: any) => `${change.at}|${change.action}`));
      cursor = result.cursor;
    } while (cursor && calls < 100);
    // The reference: the store's dated order for the same range, read in one go.
    const { events } = await store.listPageActivity({ read: 'all', since: new Date(T0), limit: 100 });
    const reference = events.map(event => `${event.createdAt.toISOString()}|${event.action}`);
    expect(reference).toHaveLength(31);
    expect(walk).toEqual(reference);
    expect(stoppedMidBatch).toBe(true);
  });

  it('returns an oversized first change cut to fit, and moves on', async () => {
    const { T0, call, acme, page, note } = await setup({ maxTokens: 100 });
    const p = await page(T0 + 1000, acme.id, 'Big');
    // Notes are capped at 250 tokens, so the budget is set below one note.
    await note(T0 + 2000, p.id, 'start ' + 'lorem ipsum '.repeat(55));
    const first = await call({ since: day(T0) });
    expect(first.changes).toHaveLength(1);
    expect(first.changes[0].note).toMatchObject({ current: true, truncated: true });
    expect(first.changes[0].note.text.startsWith('start ')).toBe(true);
    expect(first.more).toBe(true);
    const next = await call({ since: day(T0), cursor: first.cursor });
    expect(next.changes.map((change: any) => change.action)).toEqual(['page-created']);
    expect(next.cursor).toBeUndefined();
  });

  it('lists oldest first with order oldest, and resumes it after a token-limited result, every change exactly once', async () => {
    const { T0, store, call, acme, page, note } = await setup({ maxTokens: 300 });
    let seed = 11;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const p = await page(T0 + 1, acme.id, 'Log');
    for (let i = 0; i < 30; i++) {
      await note(T0 + 1000 * (i + 2), p.id, `entry ${i} ` + 'x'.repeat(Math.floor(rand() * 400)));
    }
    const walk: string[] = [];
    let cursor: string | undefined;
    let calls = 0;
    let stoppedMidBatch = false;
    do {
      const result: any = await call({ since: day(T0), order: 'oldest', limit: 7, ...(cursor ? { cursor } : {}) });
      calls++;
      expect(result.changes.length).toBeGreaterThan(0);
      if (result.cursor && result.changes.length < 7) stoppedMidBatch = true;
      walk.push(...result.changes.map((change: any) => `${change.at}|${change.action}`));
      // Oldest first returns a cursor even once caught up; more says whether to keep going now.
      expect(result.cursor).toEqual(expect.any(String));
      cursor = result.cursor;
      if (!result.more) break;
    } while (calls < 100);
    const { events } = await store.listPageActivity({ read: 'all', since: new Date(T0), order: 'asc', limit: 100 });
    const reference = events.map(event => `${event.createdAt.toISOString()}|${event.action}`);
    expect(reference).toHaveLength(31);
    expect(reference[0]).toMatch(/\|page-created$/);
    expect(walk).toEqual(reference);
    expect(stoppedMidBatch).toBe(true);

    // The caught-up cursor returns nothing until a change lands, then exactly that change,
    // even when its clock reads earlier than everything already listed.
    const idle: any = await call({ since: day(T0), order: 'oldest', cursor });
    expect(idle.changes).toEqual([]);
    expect(idle.more).toBeUndefined();
    await note(T0 + 500, p.id, 'late clock');
    const fresh: any = await call({ since: day(T0), order: 'oldest', cursor: idle.cursor });
    expect(fresh.changes.map((change: any) => change.note?.text)).toEqual(['late clock']);
  });

  it('returns a cursor from an oldest-first read that finds nothing yet, and it picks up the first change', async () => {
    const { T0, call, acme, page } = await setup();
    const empty: any = await call({ since: day(T0), order: 'oldest' });
    expect(empty.changes).toEqual([]);
    expect(empty.more).toBeUndefined();
    expect(empty.cursor).toEqual(expect.any(String));
    await page(T0 + 1000, acme.id, 'First');
    const next: any = await call({ since: day(T0), order: 'oldest', cursor: empty.cursor });
    expect(next.changes.map((change: any) => change.page.name)).toEqual(['First']);
    const again: any = await call({ since: day(T0), order: 'oldest', cursor: next.cursor });
    expect(again.changes).toEqual([]);
  });

  it('refuses a cursor from the other order, either way', async () => {
    const { T0, call, acme, page } = await setup();
    await page(T0 + 1000, acme.id, 'A');
    await page(T0 + 2000, acme.id, 'B');
    const newest = await call({ since: day(T0), limit: 1 });
    const oldest = await call({ since: day(T0), order: 'oldest', limit: 1 });
    expect(newest.changes[0].page.name).toBe('B');
    expect(oldest.changes[0].page.name).toBe('A');
    await expect(call({ since: day(T0), order: 'oldest', cursor: newest.cursor })).rejects.toThrow(/or order/);
    await expect(call({ since: day(T0), cursor: oldest.cursor })).rejects.toThrow(/or order/);
    expect((await call({ since: day(T0), order: 'newest', cursor: newest.cursor })).changes[0].page.name).toBe('A');
  });

  it('refuses a cursor with different since, until or from', async () => {
    const { T0, call, acme, page } = await setup();
    const a = await page(T0 + 1000, acme.id, 'A');
    await page(T0 + 2000, acme.id, 'B');
    const { cursor } = await call({ since: day(T0), limit: 1 });
    expect(cursor).toBeDefined();
    for (const other of [
      { since: day(T0 - 1) },
      { since: day(T0), until: day(T0 + 9000) },
      { since: day(T0), from: a.id },
    ]) {
      await expect(call({ ...other, limit: 1, cursor })).rejects.toThrow(/different since, until, from or order/);
    }
    await expect(call({ since: day(T0), cursor: 'not-a-cursor' })).rejects.toThrow(/did not come from/);
  });
});

describe('knowledge_activity: refusals before any listing', () => {
  it('needs since or until', async () => {
    const { store, call } = await setup();
    const list = vi.spyOn(store, 'listPageActivity');
    await expect(call({})).rejects.toThrow(/needs since or until/);
    await expect(call({ from: 'org:acme', limit: 5 })).rejects.toThrow(/needs since or until/);
    expect(list).not.toHaveBeenCalled();
  });

  it('refuses bad dates and an empty range', async () => {
    const { call } = await setup();
    await expect(call({ since: 'last quarter' })).rejects.toThrow(/must be a date/);
    await expect(call({ since: '2026-13-45' })).rejects.toThrow(/must be a date/);
    await expect(call({ since: '2026-07-01', until: '2026-07-01' })).rejects.toThrow(/earlier than until/);
  });

  it('refuses a date-time without a zone, which would be read in the host zone', async () => {
    const { store, call } = await setup();
    const list = vi.spyOn(store, 'listPageActivity');
    for (const since of ['2026-07-01T09:30:00', '2026-07-01T09:30', '2026-07-01 09:30:00Z']) {
      await expect(call({ since })).rejects.toThrow(/with a zone/);
    }
    expect(list).not.toHaveBeenCalled();
  });

  it('refuses impossible calendar dates instead of rolling them over', async () => {
    const { store, call } = await setup();
    for (const since of [
      '2026-02-30',
      '2026-02-29',
      '2026-04-31T00:00:00Z',
      '2026-07-01T24:00:00Z',
      '2026-07-01T09:60:00Z',
      '2026-07-01T09:30:00+15:00',
    ]) {
      await expect(call({ since })).rejects.toThrow(/must be a date/);
    }
    for (const since of ['2026-07-01T09:30:00+14:01', '2026-07-01T09:30:00-14:59', '2026-07-01T09:30:00+13:60']) {
      await expect(call({ since })).rejects.toThrow(/must be a date/);
    }
    // Year zero, and offsets that carry the instant out of years 1-9999 either way, are refused
    // before the store is asked.
    const list = vi.spyOn(store, 'listPageActivity');
    for (const since of ['0000-01-01', '0001-01-01T00:00:00+14:00', '9999-12-31T23:59:59-14:00']) {
      await expect(call({ since })).rejects.toThrow(/must be a date/);
    }
    expect(list).not.toHaveBeenCalled();
    list.mockRestore();
    // The outer offsets and four-digit years before 100 are valid while the instant stays in range.
    await expect(call({ until: '0001-01-01T14:00:00+14:00' })).resolves.toMatchObject({ changes: [] });
    await expect(call({ since: '9999-12-31T09:59:59-14:00' })).resolves.toMatchObject({ changes: [] });
    for (const until of [
      '2026-07-01T09:30:00+14:00',
      '2026-07-01T09:30:00-14:00',
      '0099-07-01',
      '0001-01-01T00:00:00Z',
    ]) {
      await expect(call({ until })).resolves.toMatchObject({ changes: [] });
    }
    // A real leap day is fine.
    await expect(call({ until: '2028-02-29' })).resolves.toMatchObject({ changes: [] });
  });

  it('reads an explicit offset as that instant', async () => {
    const { T0, call, acme, page } = await setup();
    await page(T0 + 1000, acme.id, 'At one second');
    // The same instants written in +02:00.
    const plusTwo = (ms: number) => new Date(ms + 2 * 3_600_000).toISOString().replace('Z', '+02:00');
    const before = await call({ since: plusTwo(T0 + 500), until: plusTwo(T0 + 1500) });
    expect(before.changes.map((change: any) => change.page.name)).toEqual(['At one second']);
    expect((await call({ since: plusTwo(T0 + 1500) })).changes).toEqual([]);
  });

  it('refuses a store without date support, on a first call and on a resume', async () => {
    const { T0, store, call, acme, page } = await setup();
    await page(T0 + 1000, acme.id, 'A');
    await page(T0 + 2000, acme.id, 'B');
    const { cursor } = await call({ since: day(T0), limit: 1 });
    expect(cursor).toBeDefined();
    const capabilities = store.getCapabilities();
    vi.spyOn(store, 'getCapabilities').mockReturnValue({ ...capabilities, supportsActivityDateRange: undefined });
    const list = vi.spyOn(store, 'listPageActivity');
    for (const input of [{ since: day(T0) }, { since: day(T0), limit: 1, cursor }]) {
      const error = await rejection(call(input));
      expect(error?.name).toBe('KnowledgeUnsupportedCapabilityError');
    }
    expect(list).not.toHaveBeenCalled();
    // The store's own undated read still works.
    expect((await store.listPageActivity({ read: 'all', limit: 5 })).events.length).toBeGreaterThan(0);
  });

  it('refuses order oldest on a store without oldest-first support, on a first call and on a resume', async () => {
    const { T0, store, call, acme, page } = await setup();
    await page(T0 + 1000, acme.id, 'A');
    await page(T0 + 2000, acme.id, 'B');
    const { cursor } = await call({ since: day(T0), order: 'oldest', limit: 1 });
    expect(cursor).toBeDefined();
    const capabilities = store.getCapabilities();
    vi.spyOn(store, 'getCapabilities').mockReturnValue({ ...capabilities, supportsActivityAscending: undefined });
    const list = vi.spyOn(store, 'listPageActivity');
    for (const input of [
      { since: day(T0), order: 'oldest' },
      { since: day(T0), order: 'oldest', limit: 1, cursor },
    ]) {
      const error = await rejection(call(input));
      expect(error?.name).toBe('KnowledgeUnsupportedCapabilityError');
    }
    expect(list).not.toHaveBeenCalled();
    // Newest first doesn't need it.
    expect((await call({ since: day(T0) })).changes).toHaveLength(2);
  });
});
