import type { KnowledgeStorage, KnowledgeSequencesStorage } from '@mastra/core/storage';
import {
  KnowledgeNotFoundError,
  KnowledgeSequenceNotFoundError,
  KnowledgeSequenceNotLeafError,
  KnowledgeSequencePurgeRefusedError,
} from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

const host = { author: 'host' };
const importer = 'importer:slack';
const at = (minute: number) => new Date(Date.UTC(2026, 10, 23, 12, minute));

function sequencesOf(store: KnowledgeStorage): KnowledgeSequencesStorage {
  const sequences = store.sequences;
  if (!sequences) throw new Error('store has no sequence storage');
  return sequences;
}

/**
 * The sequence item contract every Knowledge store implements (r437 step 2): idempotent upsert by
 * `(sequenceId, externalId)`, edits ordered by `editedAt`, tombstones, `(occurredAt, id)` cursor
 * reads both ways, thread reads, visibility through the sequence page, and bounded purge.
 *
 * `createStore` returns a fresh, initialized store per call.
 */
export function createKnowledgeSequenceTests(createStore: () => Promise<KnowledgeStorage>): void {
  describe('knowledge sequence storage contract', () => {
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
      const sequences = sequencesOf(store);
      expect(await sequences.markSequence({ pageId: page.id })).toEqual({ status: 'created' });
      const item = (externalId: string, minute: number, extra: Record<string, unknown> = {}) =>
        sequences.upsertItem({
          sequenceId: page.id,
          externalId,
          occurredAt: at(minute),
          body: `message ${externalId}`,
          writtenBy: importer,
          ...extra,
        });
      return { store, scope, other, page, sequences, item };
    }

    const acme = { addresses: ['org:acme'], prefixes: [], children: [] };

    it('marks a live leaf page a sequence once, and refuses a page with children or a deleted one', async () => {
      const { store, scope, page, sequences } = await setup();
      expect(await sequences.markSequence({ pageId: page.id })).toEqual({ status: 'unchanged' });
      expect(await sequences.listSequenceIds({ pageIds: [page.id, scope.id] })).toEqual([page.id]);

      const parent = await store.createPage({ parentId: scope.id, name: 'Parent', provenance: host });
      await store.createPage({ parentId: parent.id, name: 'Child', provenance: host });
      await expect(sequences.markSequence({ pageId: parent.id })).rejects.toBeInstanceOf(KnowledgeSequenceNotLeafError);
      expect(await sequences.listSequenceIds({ pageIds: [parent.id] })).toEqual([]);

      const gone = await store.createPage({ parentId: scope.id, name: 'Gone', provenance: host });
      await store.deletePage({ id: gone.id, expectedVersion: gone.version, deletedBy: 'host' });
      await expect(sequences.markSequence({ pageId: gone.id })).rejects.toBeInstanceOf(KnowledgeNotFoundError);
      await expect(sequences.markSequence({ pageId: 'no-such-page' })).rejects.toBeInstanceOf(KnowledgeNotFoundError);
    });

    it('refuses items for a page that is not a sequence', async () => {
      const { store, scope, sequences } = await setup();
      const plain = await store.createPage({ parentId: scope.id, name: 'Plain', provenance: host });
      await expect(
        sequences.upsertItem({
          sequenceId: plain.id,
          externalId: '1',
          occurredAt: at(0),
          body: 'x',
          writtenBy: importer,
        }),
      ).rejects.toBeInstanceOf(KnowledgeSequenceNotFoundError);
    });

    it('creates an item, then is inert on an identical replay', async () => {
      const { item } = await setup();
      const created = await item('1', 0, { author: { sourceId: 'U1', name: 'Ada' }, editedAt: null });
      expect(created.status).toBe('created');
      expect(created.item).toMatchObject({
        externalId: '1',
        body: 'message 1',
        version: 1,
        author: { sourceId: 'U1', name: 'Ada' },
        threadExternalId: null,
        editedAt: null,
        deletedAt: null,
        writtenBy: importer,
      });
      expect(created.item.occurredAt.getTime()).toBe(at(0).getTime());
      const replay = await item('1', 0, { author: { sourceId: 'U1', name: 'Ada' } });
      expect(replay).toEqual({ status: 'unchanged', item: created.item });
    });

    it('applies a newer edit in place and ignores an older one', async () => {
      const { item } = await setup();
      const created = await item('1', 0);
      const edited = await item('1', 0, { body: 'edited', editedAt: at(5) });
      expect(edited.status).toBe('updated');
      expect(edited.item).toMatchObject({ id: created.item.id, body: 'edited', version: 2 });
      expect(edited.item.editedAt?.getTime()).toBe(at(5).getTime());
      expect(edited.item.writtenAt.getTime()).toBe(created.item.writtenAt.getTime());

      const older = await item('1', 0, { body: 'first edit', editedAt: at(3) });
      expect(older).toMatchObject({ status: 'ignored', reason: 'stale', item: { body: 'edited', version: 2 } });
      const unedited = await item('1', 0, { body: 'message 1' });
      expect(unedited).toMatchObject({ status: 'ignored', reason: 'stale', item: { body: 'edited' } });
    });

    it('keeps a deleted item deleted on replay unless restored', async () => {
      const { item, sequences, page } = await setup();
      const created = await item('1', 0);
      const removed = await sequences.removeItem({ sequenceId: page.id, externalId: '1', writtenBy: importer });
      expect(removed).toMatchObject({ status: 'removed', item: { id: created.item.id, body: '', version: 2 } });
      expect(removed.status === 'removed' && removed.item.deletedAt).toBeInstanceOf(Date);
      expect(await sequences.removeItem({ sequenceId: page.id, externalId: '1', writtenBy: importer })).toMatchObject({
        status: 'unchanged',
      });
      expect(await sequences.removeItem({ sequenceId: page.id, externalId: 'nope', writtenBy: importer })).toEqual({
        status: 'missing',
      });

      expect(await item('1', 0)).toMatchObject({ status: 'ignored', reason: 'deleted', item: { body: '' } });
      const restored = await item('1', 0, { restore: true });
      expect(restored).toMatchObject({
        status: 'updated',
        item: { id: created.item.id, body: 'message 1', deletedAt: null, version: 3 },
      });
    });

    it('keeps external IDs that differ only by case apart', async () => {
      const { item } = await setup();
      const lower = await item('abc', 0);
      const upper = await item('ABC', 1);
      expect(upper.status).toBe('created');
      expect(upper.item.id).not.toBe(lower.item.id);
    });

    it('reads a range newest first and oldest first, by cursor, with since and until', async () => {
      const { item, sequences, page } = await setup();
      for (let minute = 0; minute < 7; minute++) await item(`m${minute}`, minute);
      const read = async (order: 'asc' | 'desc', extra: Record<string, unknown> = {}) => {
        const seen: string[] = [];
        let cursor: string | undefined;
        do {
          const result = await sequences.listItems({
            sequenceId: page.id,
            read: 'all',
            order,
            limit: 3,
            ...extra,
            ...(cursor ? { cursor } : {}),
          });
          seen.push(...result.items.map(e => e.externalId));
          cursor = result.nextCursor ?? undefined;
        } while (cursor);
        return seen;
      };
      expect(await read('desc')).toEqual(['m6', 'm5', 'm4', 'm3', 'm2', 'm1', 'm0']);
      expect(await read('asc')).toEqual(['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6']);
      expect(await read('asc', { since: at(2), until: at(5) })).toEqual(['m2', 'm3', 'm4']);
      const first = await sequences.listItems({ sequenceId: page.id, read: 'all', limit: 7 });
      expect(first.nextCursor).toBeNull();
    });

    it('orders items at the same time by id, and a cursor stays put when more arrive at that time', async () => {
      const { item, sequences, page } = await setup();
      const ids = [];
      for (const name of ['a', 'b', 'c']) ids.push((await item(name, 1)).item.id);
      const first = await sequences.listItems({ sequenceId: page.id, read: 'all', order: 'asc', limit: 2 });
      expect(first.items.map(e => e.id)).toEqual([...ids].sort().slice(0, 2));
      await item('d', 1);
      await item('early', 0);
      const rest = await sequences.listItems({
        sequenceId: page.id,
        read: 'all',
        order: 'asc',
        limit: 10,
        cursor: first.nextCursor!,
      });
      const after = rest.items.map(e => e.externalId);
      expect(after).not.toContain('early');
      expect(after).toContain('d');
      expect(new Set([...first.items.map(e => e.externalId), ...after]).size).toBe(4);
    });

    it('reads one thread, root and replies, and leaves deleted items out unless asked', async () => {
      const { item, sequences, page } = await setup();
      await item('root', 0);
      await item('other', 1);
      await item('r1', 2, { threadExternalId: 'root' });
      await item('r2', 9, { threadExternalId: 'root' });
      await sequences.removeItem({ sequenceId: page.id, externalId: 'r1', writtenBy: importer });
      const thread = await sequences.listItems({
        sequenceId: page.id,
        read: 'all',
        threadExternalId: 'root',
        order: 'asc',
        limit: 10,
      });
      expect(thread.items.map(e => e.externalId)).toEqual(['root', 'r2']);
      const withDeleted = await sequences.listItems({
        sequenceId: page.id,
        read: 'all',
        threadExternalId: 'root',
        order: 'asc',
        limit: 10,
        includeDeleted: true,
      });
      expect(withDeleted.items.map(e => e.externalId)).toEqual(['root', 'r1', 'r2']);
    });

    it('reads items only through a live sequence page readable under the read scope, which follows a move', async () => {
      const { store, item, sequences, page, other } = await setup();
      await item('1', 0);
      const list = (read: Parameters<KnowledgeSequencesStorage['listItems']>[0]['read']) =>
        sequences.listItems({ sequenceId: page.id, read, limit: 10 }).then(r => r.items.length);
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
      await expect(item('2', 1)).rejects.toBeInstanceOf(KnowledgeSequenceNotFoundError);
    });

    it('gets one item by store id through its readable sequence, deleted ones included', async () => {
      const { store, item, sequences, page, scope } = await setup();
      const { item: one } = await item('1', 0);
      const get = (
        read: Parameters<KnowledgeSequencesStorage['getItem']>[0]['read'],
        id = one.id,
        sequenceId = page.id,
      ) => sequences.getItem({ sequenceId, id, read });
      expect(await get(acme)).toEqual(one);
      expect(await get({ addresses: ['org:other'], prefixes: [], children: [] })).toBeNull();
      expect(await get(acme, 'no-such-item')).toBeNull();
      const plain = await store.createPage({ parentId: scope.id, name: 'Plain', provenance: host });
      expect(await get(acme, one.id, plain.id)).toBeNull();

      await sequences.removeItem({ sequenceId: page.id, externalId: '1', writtenBy: importer });
      expect(await get(acme)).toMatchObject({ id: one.id, body: '', deletedAt: expect.any(Date) });

      const live = await store.getPage({ id: page.id, read: 'all' });
      await store.deletePage({ id: page.id, expectedVersion: live!.version, deletedBy: 'host' });
      expect(await get('all')).toBeNull();
    });

    it('purges a deleted sequence in bounded batches, and refuses a live one or one deleted after the cutoff', async () => {
      const { store, item, sequences, page } = await setup();
      for (let minute = 0; minute < 5; minute++) await item(`m${minute}`, minute);
      await expect(
        sequences.purgeItems({ sequenceId: page.id, deletedBefore: new Date(Date.now() + 60_000), limit: 2 }),
      ).rejects.toBeInstanceOf(KnowledgeSequencePurgeRefusedError);

      const before = new Date(Date.now() - 60_000);
      await store.deletePage({ id: page.id, expectedVersion: page.version, deletedBy: 'host' });
      // Deleting hides the items; the mark stays until the purge drops it.
      expect(await sequences.listSequenceIds({ pageIds: [page.id] })).toEqual([page.id]);
      expect(await sequences.listItems({ sequenceId: page.id, read: 'all', limit: 10 })).toEqual({
        items: [],
        nextCursor: null,
      });
      await expect(
        sequences.purgeItems({ sequenceId: page.id, deletedBefore: before, limit: 2 }),
      ).rejects.toBeInstanceOf(KnowledgeSequencePurgeRefusedError);

      const cutoff = new Date(Date.now() + 60_000);
      const purged: string[] = [];
      let done = false;
      let calls = 0;
      while (!done) {
        const result = await sequences.purgeItems({ sequenceId: page.id, deletedBefore: cutoff, limit: 2 });
        expect(result.purgedIds.length).toBeLessThanOrEqual(2);
        purged.push(...result.purgedIds);
        done = result.done;
        expect(++calls).toBeLessThan(10);
      }
      expect(new Set(purged).size).toBe(5);
      expect(await sequences.listSequenceIds({ pageIds: [page.id] })).toEqual([]);
      expect(await sequences.listItems({ sequenceId: page.id, read: 'all', limit: 10, includeDeleted: true })).toEqual({
        items: [],
        nextCursor: null,
      });
    });

    it('searches item bodies by word, ranked by words matched then newest, within readable sequences', async () => {
      const { store, scope, other, page, sequences, item } = await setup();
      await item('old-both', 1, { body: 'Deploy failed: the Postgres migration timed out' });
      await item('new-one', 5, { body: 'postgres is back up' });
      await item('newer-one', 6, { body: 'Who owns the deploy runbook?' });
      await item('nothing', 7, { body: 'lunch?' });
      await item('gone', 8, { body: 'postgres deploy notes' });
      await sequences.removeItem({ sequenceId: page.id, externalId: 'gone', writtenBy: importer });

      const hidden = await store.createPage({ parentId: other.id, key: 'secret', name: '#secret', provenance: host });
      await sequences.markSequence({ pageId: hidden.id });
      await sequences.upsertItem({
        sequenceId: hidden.id,
        externalId: 'h1',
        occurredAt: at(9),
        body: 'postgres deploy secrets',
        writtenBy: importer,
      });

      const ids = (items: { externalId: string }[]) => items.map(e => e.externalId);
      expect(ids(await sequences.searchItems({ query: 'Postgres DEPLOY', read: acme, limit: 10 }))).toEqual([
        'old-both',
        'newer-one',
        'new-one',
      ]);
      // A hidden sequence can't take a slot ahead of the limit.
      expect(ids(await sequences.searchItems({ query: 'postgres deploy', read: acme, limit: 1 }))).toEqual([
        'old-both',
      ]);
      expect(ids(await sequences.searchItems({ query: 'postgres deploy', read: 'all', limit: 1 }))).toEqual(['h1']);
      expect(
        ids(await sequences.searchItems({ query: 'postgres', read: 'all', since: at(5), until: at(9), limit: 10 })),
      ).toEqual(['new-one']);
      expect(ids(await sequences.searchItems({ query: 'postgres', read: acme, since: at(5), limit: 10 }))).toEqual([
        'new-one',
      ]);
      expect(ids(await sequences.searchItems({ query: 'postgres', read: acme, until: at(5), limit: 10 }))).toEqual([
        'old-both',
      ]);
      expect(
        ids(await sequences.searchItems({ query: 'postgres', read: 'all', sequenceIds: [hidden.id], limit: 10 })),
      ).toEqual(['h1']);
      expect(
        ids(await sequences.searchItems({ query: 'postgres', read: 'all', scopeIds: [scope.id], limit: 10 })),
      ).toEqual(['new-one', 'old-both']);
      expect(await sequences.searchItems({ query: '   ', read: 'all', limit: 10 })).toEqual([]);
      // A wildcard character is matched literally.
      expect(await sequences.searchItems({ query: '%', read: 'all', limit: 10 })).toEqual([]);

      await store.deletePage({ id: hidden.id, expectedVersion: hidden.version, deletedBy: 'host' });
      expect(ids(await sequences.searchItems({ query: 'secrets', read: 'all', limit: 10 }))).toEqual([]);
    });

    it('rolls item writes back with the transaction they were in', async () => {
      const { store, page } = await setup();
      await expect(
        store.transaction(async tx => {
          await sequencesOf(tx).upsertItem({
            sequenceId: page.id,
            externalId: 'tx',
            occurredAt: at(0),
            body: 'in tx',
            writtenBy: importer,
          });
          throw new Error('roll back');
        }),
      ).rejects.toThrow('roll back');
      const read = await sequencesOf(store).listItems({ sequenceId: page.id, read: 'all', limit: 10 });
      expect(read.items).toEqual([]);
    });

    it('refuses a read limit over 100 and an invalid time', async () => {
      const { sequences, page } = await setup();
      await expect(sequences.listItems({ sequenceId: page.id, read: 'all', limit: 101 })).rejects.toBeInstanceOf(
        RangeError,
      );
      await expect(sequences.searchItems({ query: 'x', read: 'all', limit: 101 })).rejects.toBeInstanceOf(RangeError);
      await expect(
        sequences.upsertItem({
          sequenceId: page.id,
          externalId: 'bad',
          occurredAt: new Date(Number.NaN),
          body: '',
          writtenBy: importer,
        }),
      ).rejects.toBeInstanceOf(TypeError);
    });
  });
}
