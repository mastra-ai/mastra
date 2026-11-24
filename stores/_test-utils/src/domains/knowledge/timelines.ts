import type { KnowledgeStorage, KnowledgeTimelinesStorage } from '@mastra/core/storage';
import {
  KnowledgeNotFoundError,
  KnowledgeTimelineNotFoundError,
  KnowledgeTimelineNotLeafError,
  KnowledgeTimelinePurgeRefusedError,
} from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

const host = { author: 'host' };
const importer = 'importer:slack';
const at = (minute: number) => new Date(Date.UTC(2026, 10, 23, 12, minute));

function timelinesOf(store: KnowledgeStorage): KnowledgeTimelinesStorage {
  const timelines = store.timelines;
  if (!timelines) throw new Error('store has no timeline storage');
  return timelines;
}

/**
 * The timeline entry contract every Knowledge store implements (r437 step 2): idempotent upsert by
 * `(timelineId, externalId)`, edits ordered by `editedAt`, tombstones, `(occurredAt, id)` cursor
 * reads both ways, thread reads, visibility through the timeline page, and bounded purge.
 *
 * `createStore` returns a fresh, initialized store per call.
 */
export function createKnowledgeTimelineTests(createStore: () => Promise<KnowledgeStorage>): void {
  describe('knowledge timeline storage contract', () => {
    async function setup() {
      const store = await createStore();
      const { scope } = await store.materializeScope({
        address: 'org:acme',
        declaration: 'org:$orgId',
        name: 'Acme',
        provenance: host,
      });
      const { scope: other } = await store.materializeScope({
        address: 'org:other',
        declaration: 'org:$orgId',
        name: 'Other',
        provenance: host,
      });
      const page = await store.createPage({ parentId: scope.id, key: 'general', name: '#general', provenance: host });
      const timelines = timelinesOf(store);
      expect(await timelines.markTimeline({ pageId: page.id })).toEqual({ status: 'created' });
      const entry = (externalId: string, minute: number, extra: Record<string, unknown> = {}) =>
        timelines.upsertEntry({
          timelineId: page.id,
          externalId,
          occurredAt: at(minute),
          body: `message ${externalId}`,
          writtenBy: importer,
          ...extra,
        });
      return { store, scope, other, page, timelines, entry };
    }

    const acme = { addresses: ['org:acme'], prefixes: [], children: [] };

    it('marks a live leaf page a timeline once, and refuses a page with children or a deleted one', async () => {
      const { store, scope, page, timelines } = await setup();
      expect(await timelines.markTimeline({ pageId: page.id })).toEqual({ status: 'unchanged' });
      expect(await timelines.listTimelineIds({ pageIds: [page.id, scope.id] })).toEqual([page.id]);

      const parent = await store.createPage({ parentId: scope.id, name: 'Parent', provenance: host });
      await store.createPage({ parentId: parent.id, name: 'Child', provenance: host });
      await expect(timelines.markTimeline({ pageId: parent.id })).rejects.toBeInstanceOf(KnowledgeTimelineNotLeafError);
      expect(await timelines.listTimelineIds({ pageIds: [parent.id] })).toEqual([]);

      const gone = await store.createPage({ parentId: scope.id, name: 'Gone', provenance: host });
      await store.deletePage({ id: gone.id, expectedVersion: gone.version, deletedBy: 'host' });
      await expect(timelines.markTimeline({ pageId: gone.id })).rejects.toBeInstanceOf(KnowledgeNotFoundError);
      await expect(timelines.markTimeline({ pageId: 'no-such-page' })).rejects.toBeInstanceOf(KnowledgeNotFoundError);
    });

    it('refuses entries for a page that is not a timeline', async () => {
      const { store, scope, timelines } = await setup();
      const plain = await store.createPage({ parentId: scope.id, name: 'Plain', provenance: host });
      await expect(
        timelines.upsertEntry({
          timelineId: plain.id,
          externalId: '1',
          occurredAt: at(0),
          body: 'x',
          writtenBy: importer,
        }),
      ).rejects.toBeInstanceOf(KnowledgeTimelineNotFoundError);
    });

    it('creates an entry, then is inert on an identical replay', async () => {
      const { entry } = await setup();
      const created = await entry('1', 0, { author: { sourceId: 'U1', name: 'Ada' }, editedAt: null });
      expect(created.status).toBe('created');
      expect(created.entry).toMatchObject({
        externalId: '1',
        body: 'message 1',
        version: 1,
        author: { sourceId: 'U1', name: 'Ada' },
        threadExternalId: null,
        editedAt: null,
        deletedAt: null,
        writtenBy: importer,
      });
      expect(created.entry.occurredAt.getTime()).toBe(at(0).getTime());
      const replay = await entry('1', 0, { author: { sourceId: 'U1', name: 'Ada' } });
      expect(replay).toEqual({ status: 'unchanged', entry: created.entry });
    });

    it('applies a newer edit in place and ignores an older one', async () => {
      const { entry } = await setup();
      const created = await entry('1', 0);
      const edited = await entry('1', 0, { body: 'edited', editedAt: at(5) });
      expect(edited.status).toBe('updated');
      expect(edited.entry).toMatchObject({ id: created.entry.id, body: 'edited', version: 2 });
      expect(edited.entry.editedAt?.getTime()).toBe(at(5).getTime());
      expect(edited.entry.writtenAt.getTime()).toBe(created.entry.writtenAt.getTime());

      const older = await entry('1', 0, { body: 'first edit', editedAt: at(3) });
      expect(older).toMatchObject({ status: 'ignored', reason: 'stale', entry: { body: 'edited', version: 2 } });
      const unedited = await entry('1', 0, { body: 'message 1' });
      expect(unedited).toMatchObject({ status: 'ignored', reason: 'stale', entry: { body: 'edited' } });
    });

    it('keeps a deleted entry deleted on replay unless restored', async () => {
      const { entry, timelines, page } = await setup();
      const created = await entry('1', 0);
      const removed = await timelines.removeEntry({ timelineId: page.id, externalId: '1', writtenBy: importer });
      expect(removed).toMatchObject({ status: 'removed', entry: { id: created.entry.id, body: '', version: 2 } });
      expect(removed.status === 'removed' && removed.entry.deletedAt).toBeInstanceOf(Date);
      expect(await timelines.removeEntry({ timelineId: page.id, externalId: '1', writtenBy: importer })).toMatchObject({
        status: 'unchanged',
      });
      expect(await timelines.removeEntry({ timelineId: page.id, externalId: 'nope', writtenBy: importer })).toEqual({
        status: 'missing',
      });

      expect(await entry('1', 0)).toMatchObject({ status: 'ignored', reason: 'deleted', entry: { body: '' } });
      const restored = await entry('1', 0, { restore: true });
      expect(restored).toMatchObject({
        status: 'updated',
        entry: { id: created.entry.id, body: 'message 1', deletedAt: null, version: 3 },
      });
    });

    it('keeps external IDs that differ only by case apart', async () => {
      const { entry } = await setup();
      const lower = await entry('abc', 0);
      const upper = await entry('ABC', 1);
      expect(upper.status).toBe('created');
      expect(upper.entry.id).not.toBe(lower.entry.id);
    });

    it('reads a range newest first and oldest first, by cursor, with since and until', async () => {
      const { entry, timelines, page } = await setup();
      for (let minute = 0; minute < 7; minute++) await entry(`m${minute}`, minute);
      const read = async (order: 'asc' | 'desc', extra: Record<string, unknown> = {}) => {
        const seen: string[] = [];
        let cursor: string | undefined;
        do {
          const result = await timelines.listEntries({
            timelineId: page.id,
            read: 'all',
            order,
            limit: 3,
            ...extra,
            ...(cursor ? { cursor } : {}),
          });
          seen.push(...result.entries.map(e => e.externalId));
          cursor = result.nextCursor ?? undefined;
        } while (cursor);
        return seen;
      };
      expect(await read('desc')).toEqual(['m6', 'm5', 'm4', 'm3', 'm2', 'm1', 'm0']);
      expect(await read('asc')).toEqual(['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6']);
      expect(await read('asc', { since: at(2), until: at(5) })).toEqual(['m2', 'm3', 'm4']);
      const first = await timelines.listEntries({ timelineId: page.id, read: 'all', limit: 7 });
      expect(first.nextCursor).toBeNull();
    });

    it('orders entries at the same time by id, and a cursor stays put when more arrive at that time', async () => {
      const { entry, timelines, page } = await setup();
      const ids = [];
      for (const name of ['a', 'b', 'c']) ids.push((await entry(name, 1)).entry.id);
      const first = await timelines.listEntries({ timelineId: page.id, read: 'all', order: 'asc', limit: 2 });
      expect(first.entries.map(e => e.id)).toEqual([...ids].sort().slice(0, 2));
      await entry('d', 1);
      await entry('early', 0);
      const rest = await timelines.listEntries({
        timelineId: page.id,
        read: 'all',
        order: 'asc',
        limit: 10,
        cursor: first.nextCursor!,
      });
      const after = rest.entries.map(e => e.externalId);
      expect(after).not.toContain('early');
      expect(after).toContain('d');
      expect(new Set([...first.entries.map(e => e.externalId), ...after]).size).toBe(4);
    });

    it('reads one thread, root and replies, and leaves deleted entries out unless asked', async () => {
      const { entry, timelines, page } = await setup();
      await entry('root', 0);
      await entry('other', 1);
      await entry('r1', 2, { threadExternalId: 'root' });
      await entry('r2', 9, { threadExternalId: 'root' });
      await timelines.removeEntry({ timelineId: page.id, externalId: 'r1', writtenBy: importer });
      const thread = await timelines.listEntries({
        timelineId: page.id,
        read: 'all',
        threadExternalId: 'root',
        order: 'asc',
        limit: 10,
      });
      expect(thread.entries.map(e => e.externalId)).toEqual(['root', 'r2']);
      const withDeleted = await timelines.listEntries({
        timelineId: page.id,
        read: 'all',
        threadExternalId: 'root',
        order: 'asc',
        limit: 10,
        includeDeleted: true,
      });
      expect(withDeleted.entries.map(e => e.externalId)).toEqual(['root', 'r1', 'r2']);
    });

    it('reads entries only through a live timeline page readable under the read scope, which follows a move', async () => {
      const { store, entry, timelines, page, other } = await setup();
      await entry('1', 0);
      const list = (read: Parameters<KnowledgeTimelinesStorage['listEntries']>[0]['read']) =>
        timelines.listEntries({ timelineId: page.id, read, limit: 10 }).then(r => r.entries.length);
      expect(await list(acme)).toBe(1);
      expect(await list({ addresses: ['org:other'], prefixes: [], children: [] })).toBe(0);

      const moved = await store.movePage({
        id: page.id,
        expectedVersion: page.version,
        parentId: other.id,
        provenance: host,
      });
      expect(await list(acme)).toBe(0);
      expect(await list({ addresses: ['org:other'], prefixes: [], children: [] })).toBe(1);

      await store.deletePage({ id: moved.id, expectedVersion: moved.version, deletedBy: 'host' });
      expect(await list('all')).toBe(0);
      await expect(entry('2', 1)).rejects.toBeInstanceOf(KnowledgeTimelineNotFoundError);
    });

    it('gets one entry by store id through its readable timeline, deleted ones included', async () => {
      const { store, entry, timelines, page, scope } = await setup();
      const { entry: one } = await entry('1', 0);
      const get = (
        read: Parameters<KnowledgeTimelinesStorage['getEntry']>[0]['read'],
        id = one.id,
        timelineId = page.id,
      ) => timelines.getEntry({ timelineId, id, read });
      expect(await get(acme)).toEqual(one);
      expect(await get({ addresses: ['org:other'], prefixes: [], children: [] })).toBeNull();
      expect(await get(acme, 'no-such-entry')).toBeNull();
      const plain = await store.createPage({ parentId: scope.id, name: 'Plain', provenance: host });
      expect(await get(acme, one.id, plain.id)).toBeNull();

      await timelines.removeEntry({ timelineId: page.id, externalId: '1', writtenBy: importer });
      expect(await get(acme)).toMatchObject({ id: one.id, body: '', deletedAt: expect.any(Date) });

      const live = await store.getPage({ id: page.id, read: 'all' });
      await store.deletePage({ id: page.id, expectedVersion: live!.version, deletedBy: 'host' });
      expect(await get('all')).toBeNull();
    });

    it('purges a deleted timeline in bounded batches, and refuses a live one or one deleted after the cutoff', async () => {
      const { store, entry, timelines, page } = await setup();
      for (let minute = 0; minute < 5; minute++) await entry(`m${minute}`, minute);
      await expect(
        timelines.purgeEntries({ timelineId: page.id, deletedBefore: new Date(Date.now() + 60_000), limit: 2 }),
      ).rejects.toBeInstanceOf(KnowledgeTimelinePurgeRefusedError);

      const before = new Date(Date.now() - 60_000);
      await store.deletePage({ id: page.id, expectedVersion: page.version, deletedBy: 'host' });
      // Deleting hides the entries; the mark stays until the purge drops it.
      expect(await timelines.listTimelineIds({ pageIds: [page.id] })).toEqual([page.id]);
      expect(await timelines.listEntries({ timelineId: page.id, read: 'all', limit: 10 })).toEqual({
        entries: [],
        nextCursor: null,
      });
      await expect(
        timelines.purgeEntries({ timelineId: page.id, deletedBefore: before, limit: 2 }),
      ).rejects.toBeInstanceOf(KnowledgeTimelinePurgeRefusedError);

      const cutoff = new Date(Date.now() + 60_000);
      const purged: string[] = [];
      let done = false;
      let calls = 0;
      while (!done) {
        const result = await timelines.purgeEntries({ timelineId: page.id, deletedBefore: cutoff, limit: 2 });
        expect(result.purgedIds.length).toBeLessThanOrEqual(2);
        purged.push(...result.purgedIds);
        done = result.done;
        expect(++calls).toBeLessThan(10);
      }
      expect(new Set(purged).size).toBe(5);
      expect(await timelines.listTimelineIds({ pageIds: [page.id] })).toEqual([]);
      expect(
        await timelines.listEntries({ timelineId: page.id, read: 'all', limit: 10, includeDeleted: true }),
      ).toEqual({ entries: [], nextCursor: null });
    });

    it('searches entry bodies by word, ranked by words matched then newest, within readable timelines', async () => {
      const { store, scope, other, page, timelines, entry } = await setup();
      await entry('old-both', 1, { body: 'Deploy failed: the Postgres migration timed out' });
      await entry('new-one', 5, { body: 'postgres is back up' });
      await entry('newer-one', 6, { body: 'Who owns the deploy runbook?' });
      await entry('nothing', 7, { body: 'lunch?' });
      await entry('gone', 8, { body: 'postgres deploy notes' });
      await timelines.removeEntry({ timelineId: page.id, externalId: 'gone', writtenBy: importer });

      const hidden = await store.createPage({ parentId: other.id, key: 'secret', name: '#secret', provenance: host });
      await timelines.markTimeline({ pageId: hidden.id });
      await timelines.upsertEntry({
        timelineId: hidden.id,
        externalId: 'h1',
        occurredAt: at(9),
        body: 'postgres deploy secrets',
        writtenBy: importer,
      });

      const ids = (entries: { externalId: string }[]) => entries.map(e => e.externalId);
      expect(ids(await timelines.searchEntries({ query: 'Postgres DEPLOY', read: acme, limit: 10 }))).toEqual([
        'old-both',
        'newer-one',
        'new-one',
      ]);
      // A hidden timeline can't take a slot ahead of the limit.
      expect(ids(await timelines.searchEntries({ query: 'postgres deploy', read: acme, limit: 1 }))).toEqual([
        'old-both',
      ]);
      expect(ids(await timelines.searchEntries({ query: 'postgres deploy', read: 'all', limit: 1 }))).toEqual(['h1']);
      expect(
        ids(await timelines.searchEntries({ query: 'postgres', read: 'all', since: at(5), until: at(9), limit: 10 })),
      ).toEqual(['new-one']);
      expect(ids(await timelines.searchEntries({ query: 'postgres', read: acme, since: at(5), limit: 10 }))).toEqual([
        'new-one',
      ]);
      expect(ids(await timelines.searchEntries({ query: 'postgres', read: acme, until: at(5), limit: 10 }))).toEqual([
        'old-both',
      ]);
      expect(
        ids(await timelines.searchEntries({ query: 'postgres', read: 'all', timelineIds: [hidden.id], limit: 10 })),
      ).toEqual(['h1']);
      expect(
        ids(await timelines.searchEntries({ query: 'postgres', read: 'all', scopeIds: [scope.id], limit: 10 })),
      ).toEqual(['new-one', 'old-both']);
      expect(await timelines.searchEntries({ query: '   ', read: 'all', limit: 10 })).toEqual([]);
      // A wildcard character is matched literally.
      expect(await timelines.searchEntries({ query: '%', read: 'all', limit: 10 })).toEqual([]);

      await store.deletePage({ id: hidden.id, expectedVersion: hidden.version, deletedBy: 'host' });
      expect(ids(await timelines.searchEntries({ query: 'secrets', read: 'all', limit: 10 }))).toEqual([]);
    });

    it('rolls entry writes back with the transaction they were in', async () => {
      const { store, page } = await setup();
      await expect(
        store.transaction(async tx => {
          await timelinesOf(tx).upsertEntry({
            timelineId: page.id,
            externalId: 'tx',
            occurredAt: at(0),
            body: 'in tx',
            writtenBy: importer,
          });
          throw new Error('roll back');
        }),
      ).rejects.toThrow('roll back');
      const read = await timelinesOf(store).listEntries({ timelineId: page.id, read: 'all', limit: 10 });
      expect(read.entries).toEqual([]);
    });

    it('refuses a read limit over 100 and an invalid time', async () => {
      const { timelines, page } = await setup();
      await expect(timelines.listEntries({ timelineId: page.id, read: 'all', limit: 101 })).rejects.toBeInstanceOf(
        RangeError,
      );
      await expect(timelines.searchEntries({ query: 'x', read: 'all', limit: 101 })).rejects.toBeInstanceOf(RangeError);
      await expect(
        timelines.upsertEntry({
          timelineId: page.id,
          externalId: 'bad',
          occurredAt: new Date(Number.NaN),
          body: '',
          writtenBy: importer,
        }),
      ).rejects.toBeInstanceOf(TypeError);
    });
  });
}
