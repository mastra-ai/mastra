import type { KnowledgeStorage, KnowledgeSequencesStorage } from '@mastra/core/storage';
import {
  KnowledgeNotFoundError,
  KnowledgeSequenceItemInvalidError,
  KnowledgeSequenceItemPropertiesError,
  KnowledgeSequenceNotFoundError,
  KnowledgeSequenceOrderByChangeError,
  KnowledgeSequencePageItemError,
  KnowledgeSequenceParentNestedError,
  KnowledgeSequenceParentNotFoundError,
  KnowledgeSequencePurgeRefusedError,
  KnowledgeSequenceSchemaInvalidError,
  KnowledgeSequenceTooManyChildrenError,
  MAX_KNOWLEDGE_SEQUENCE_JSON_DEPTH,
  MAX_KNOWLEDGE_SEQUENCE_MARK_CHILDREN,
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

    it('marks a live page a sequence once, and refuses a deleted one', async () => {
      const { store, scope, page, sequences } = await setup();
      expect(await sequences.markSequence({ pageId: page.id })).toEqual({ status: 'unchanged' });
      expect(await sequences.listSequenceIds({ pageIds: [page.id, scope.id] })).toEqual([page.id]);

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
        externalParentId: null,
        title: null,
        links: [],
        properties: null,
        type: null,
        editedAt: null,
        deletedAt: null,
        writtenBy: importer,
      });
      expect(created.item.occurredAt?.getTime()).toBe(at(0).getTime());
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
      expect(removed).toMatchObject({ status: 'removed', item: { id: created.item.id, body: null, version: 2 } });
      expect(removed.status === 'removed' && removed.item.deletedAt).toBeInstanceOf(Date);
      expect(await sequences.removeItem({ sequenceId: page.id, externalId: '1', writtenBy: importer })).toMatchObject({
        status: 'unchanged',
      });
      expect(await sequences.removeItem({ sequenceId: page.id, externalId: 'nope', writtenBy: importer })).toEqual({
        status: 'missing',
      });

      expect(await item('1', 0)).toMatchObject({ status: 'ignored', reason: 'deleted', item: { body: null } });
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

    it('reads one parent with the items under it, and leaves deleted items out unless asked', async () => {
      const { item, sequences, page } = await setup();
      await item('root', 0);
      await item('other', 1);
      await item('r1', 2, { externalParentId: 'root' });
      await item('r2', 9, { externalParentId: 'root' });
      await sequences.removeItem({ sequenceId: page.id, externalId: 'r1', writtenBy: importer });
      const thread = await sequences.listItems({
        sequenceId: page.id,
        read: 'all',
        externalParentId: 'root',
        order: 'asc',
        limit: 10,
      });
      expect(thread.items.map(e => e.externalId)).toEqual(['root', 'r2']);
      const withDeleted = await sequences.listItems({
        sequenceId: page.id,
        read: 'all',
        externalParentId: 'root',
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
      expect(await get(acme)).toMatchObject({ id: one.id, body: null, deletedAt: expect.any(Date) });

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

    it('stores the item envelope, and a delete clears its content but keeps its type', async () => {
      const { item, sequences, page } = await setup();
      const links = [{ url: 'https://ci.example/run/7', title: 'Run 7' }, { url: 'http://ci.example/log' }];
      const properties = { status: 'failed', durationMs: 4200, flaky: false, failed: ['a.test.ts', 'b.test.ts'] };
      const created = await item('build-7', 0, { title: 'Build 7', body: undefined, links, properties, type: 'build' });
      expect(created.item).toMatchObject({ title: 'Build 7', body: null, links, properties, type: 'build' });

      // Properties compare by value, not key order.
      const reordered = { failed: ['a.test.ts', 'b.test.ts'], flaky: false, durationMs: 4200, status: 'failed' };
      expect(
        await item('build-7', 0, { title: 'Build 7', body: undefined, links, properties: reordered, type: 'build' }),
      ).toMatchObject({ status: 'unchanged' });
      const passed = await item('build-7', 0, {
        title: 'Build 7',
        body: undefined,
        links,
        properties: { ...properties, status: 'passed' },
        type: 'build',
        editedAt: at(1),
      });
      expect(passed).toMatchObject({ status: 'updated', item: { properties: { status: 'passed' }, version: 2 } });
      const untyped = await item('build-7', 0, { title: 'Build 7', body: undefined, type: null, editedAt: at(2) });
      expect(untyped.item).toMatchObject({ type: null, links: [], properties: null, version: 3 });

      await item('build-8', 1, { title: 'Build 8', body: undefined, links, properties, type: 'build' });
      const removed = await sequences.removeItem({ sequenceId: page.id, externalId: 'build-8', writtenBy: importer });
      expect(removed).toMatchObject({
        status: 'removed',
        item: { title: null, body: null, links: [], properties: null, type: 'build' },
      });
      const [stored] = (
        await sequences.listItems({
          sequenceId: page.id,
          read: 'all',
          limit: 10,
          includeDeleted: true,
          types: ['build'],
        })
      ).items;
      expect(stored).toMatchObject({ externalId: 'build-8', type: 'build', title: null });
    });

    it('refuses an item with no content or a field over its limit, and writes nothing', async () => {
      const { item, sequences, page } = await setup();
      const refused = [
        { body: undefined },
        { body: '' },
        { body: undefined, title: '', links: [], properties: {} },
        { title: 'x'.repeat(301) },
        { title: 'two\nlines' },
        { links: Array.from({ length: 11 }, (_, i) => ({ url: `https://example.com/${i}` })) },
        { links: [{ url: 'javascript:alert(1)' }] },
        { links: [{ url: 'not a url' }] },
        { properties: ['not', 'an', 'object'] },
        { properties: { blob: 'x'.repeat(16 * 1024) } },
        { type: 'Build' },
        { type: '-build' },
        { type: 'b'.repeat(65) },
        { externalParentId: 'self' },
      ];
      for (const extra of refused) {
        await expect(item('self', 0, extra), JSON.stringify(extra).slice(0, 80)).rejects.toBeInstanceOf(
          KnowledgeSequenceItemInvalidError,
        );
      }
      expect((await sequences.listItems({ sequenceId: page.id, read: 'all', limit: 10 })).items).toEqual([]);
      // At the limits is fine.
      await item('ok', 0, {
        title: 't'.repeat(300),
        links: Array.from({ length: 10 }, (_, i) => ({ url: `https://example.com/${i}` })),
        type: 'a'.repeat(64),
      });
    });

    it('refuses properties that are not plain JSON, so an empty-looking object never stands in for content', async () => {
      const { sequences, page } = await setup();
      const put = (properties: Record<string, unknown>) =>
        sequences.upsertItem({
          sequenceId: page.id,
          externalId: 'p',
          occurredAt: at(1),
          properties,
          writtenBy: importer,
        });
      const cyclic: Record<string, unknown> = { a: 1 };
      cyclic.self = cyclic;
      const hooked: Record<string, unknown> = { payload: 'x'.repeat(20_000) };
      Object.defineProperty(hooked, 'toJSON', { value: () => ({}) });
      const hookedList = [1];
      Object.defineProperty(hookedList, 'toJSON', { value: () => [] });
      const getter = Object.defineProperty({}, 'n', { get: () => 1, enumerable: true });
      const symbolKey = { [Symbol('s')]: 1, a: 1 };
      for (const properties of [
        { omitted: undefined },
        { nested: { omitted: undefined } },
        { list: [1, undefined] },
        { n: Number.NaN },
        { n: Number.POSITIVE_INFINITY },
        { when: new Date(0) },
        { fn: () => 1 },
        { big: 1n },
        { list: new Array(1) },
        { list: [1, , 2] },
        cyclic,
        hooked,
        { list: Object.assign(new Array(1), { extra: 'not an array element' }) },
        { nested: hookedList },
        getter,
        symbolKey,
      ]) {
        await expect(put(properties)).rejects.toBeInstanceOf(KnowledgeSequenceItemInvalidError);
      }
      expect((await sequences.listItems({ sequenceId: page.id, read: 'all', limit: 10 })).items).toEqual([]);
      const shared = { c: true };
      const ok = await put({ a: null, b: [1, 'x', null, shared], d: shared });
      expect(ok).toMatchObject({
        status: 'created',
        item: { properties: { a: null, b: [1, 'x', null, { c: true }], d: { c: true } } },
      });
    });

    it('takes a parent only from the same sequence, one level deep, and a deleted parent still counts', async () => {
      const { store, scope, item, sequences, page } = await setup();
      const other = await store.createPage({ parentId: scope.id, key: 'other', name: '#other', provenance: host });
      await sequences.markSequence({ pageId: other.id });
      await sequences.upsertItem({
        sequenceId: other.id,
        externalId: 'elsewhere',
        occurredAt: at(0),
        body: 'x',
        writtenBy: importer,
      });

      await expect(item('orphan', 1, { externalParentId: 'nobody' })).rejects.toBeInstanceOf(
        KnowledgeSequenceParentNotFoundError,
      );
      await expect(item('orphan', 1, { externalParentId: 'elsewhere' })).rejects.toBeInstanceOf(
        KnowledgeSequenceParentNotFoundError,
      );

      await item('root', 0);
      await item('reply', 1, { externalParentId: 'root' });
      await expect(item('deeper', 2, { externalParentId: 'reply' })).rejects.toBeInstanceOf(
        KnowledgeSequenceParentNestedError,
      );
      // An item with replies can't become a reply itself.
      await item('top', 3);
      await expect(item('root', 0, { externalParentId: 'top', editedAt: at(4) })).rejects.toBeInstanceOf(
        KnowledgeSequenceParentNestedError,
      );

      await sequences.removeItem({ sequenceId: page.id, externalId: 'root', writtenBy: importer });
      expect((await item('late', 5, { externalParentId: 'root' })).status).toBe('created');
      const under = await sequences.listItems({
        sequenceId: page.id,
        read: 'all',
        externalParentId: 'root',
        order: 'asc',
        limit: 10,
      });
      expect(under.items.map(e => e.externalId)).toEqual(['reply', 'late']);
      const live = await sequences.listItems({ sequenceId: page.id, read: 'all', order: 'asc', limit: 10 });
      expect(live.items.map(e => e.externalId)).toEqual(['reply', 'top', 'late']);
    });

    it('filters reads and search by type before the limit, with full pages and no item skipped', async () => {
      const { item, sequences, page } = await setup();
      // 12 items: every 4th a deploy, every 4th (offset 1) untyped, the rest notes.
      for (let minute = 0; minute < 12; minute++) {
        const type = minute % 4 === 0 ? 'deploy' : minute % 4 === 1 ? null : 'note';
        await item(`i${minute}`, minute, { body: `release ${minute}`, type });
      }
      const ext = (items: { externalId: string }[]) => items.map(e => e.externalId);
      const all = async (order: 'asc' | 'desc', filter: { types?: string[]; untyped?: boolean }) => {
        const seen: string[] = [];
        let cursor: string | undefined;
        do {
          const result = await sequences.listItems({
            sequenceId: page.id,
            read: 'all',
            order,
            limit: 2,
            ...filter,
            ...(cursor ? { cursor } : {}),
          });
          if (result.nextCursor) expect(result.items).toHaveLength(2);
          seen.push(...ext(result.items));
          cursor = result.nextCursor ?? undefined;
        } while (cursor);
        return seen;
      };
      expect(await all('asc', {})).toHaveLength(12);
      expect(await all('asc', { untyped: false })).toHaveLength(12);
      expect(await all('asc', { untyped: true })).toEqual(['i1', 'i5', 'i9']);
      expect(await all('asc', { types: ['deploy'] })).toEqual(['i0', 'i4', 'i8']);
      expect(await all('desc', { types: ['deploy'] })).toEqual(['i8', 'i4', 'i0']);
      expect(await all('asc', { types: ['deploy'], untyped: true })).toEqual(['i0', 'i1', 'i4', 'i5', 'i8', 'i9']);
      expect(await all('asc', { types: ['missing'] })).toEqual([]);

      const search = (filter: { types?: string[]; untyped?: boolean }, limit = 10) =>
        sequences.searchItems({ query: 'release', read: 'all', limit, ...filter }).then(ext);
      expect(await search({})).toHaveLength(10);
      expect(await search({ untyped: true })).toEqual(['i9', 'i5', 'i1']);
      expect(await search({ types: ['deploy'] }, 2)).toEqual(['i8', 'i4']);
      expect(await search({ types: ['deploy'], untyped: true }, 3)).toEqual(['i9', 'i8', 'i5']);

      for (const types of [[], Array.from({ length: 21 }, (_, i) => `t${i}`), ['Bad']]) {
        await expect(sequences.listItems({ sequenceId: page.id, read: 'all', limit: 2, types })).rejects.toBeInstanceOf(
          RangeError,
        );
        await expect(sequences.searchItems({ query: 'release', read: 'all', limit: 2, types })).rejects.toBeInstanceOf(
          RangeError,
        );
      }
    });

    it('searches titles, link titles and string property values, but not numbers', async () => {
      const { item, sequences } = await setup();
      await item('m', 0, { body: undefined, title: 'Milestone: beta launch' });
      await item('l', 1, { body: 'see the runbook', links: [{ url: 'https://example.com', title: 'Rollback guide' }] });
      await item('p', 2, { body: undefined, properties: { owner: 'Ada Lovelace', tags: ['infra'], count: 4242 } });
      const ext = (query: string) =>
        sequences.searchItems({ query, read: 'all', limit: 10 }).then(items => items.map(e => e.externalId));
      expect(await ext('beta')).toEqual(['m']);
      expect(await ext('rollback')).toEqual(['l']);
      expect(await ext('lovelace')).toEqual(['p']);
      expect(await ext('infra')).toEqual(['p']);
      expect(await ext('4242')).toEqual([]);
      // Property keys aren't searched, only values.
      expect(await ext('owner')).toEqual([]);
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
          body: 'x',
          writtenBy: importer,
        }),
      ).rejects.toBeInstanceOf(TypeError);
    });

    describe('position order', () => {
      async function positioned() {
        const base = await setup();
        const list = await base.store.createPage({
          parentId: base.scope.id,
          key: 'roadmap',
          name: 'Roadmap',
          provenance: host,
        });
        expect(await base.sequences.markSequence({ pageId: list.id, orderBy: 'position' })).toEqual({
          status: 'created',
        });
        const put = (externalId: string, extra: Record<string, unknown> = {}) =>
          base.sequences.upsertItem({
            sequenceId: list.id,
            externalId,
            title: externalId,
            writtenBy: 'agent:a',
            ...extra,
          });
        const ids = async (extra: Record<string, unknown> = {}) =>
          (await base.sequences.listItems({ sequenceId: list.id, read: 'all', limit: 100, ...extra })).items.map(
            i => i.externalId,
          );
        return { ...base, list, put, ids };
      }

      it('appends, inserts after and before, and reads first-by-position by default, both ways', async () => {
        const { put, ids } = await positioned();
        await put('a');
        await put('c');
        await put('b', { after: 'a' });
        await put('start', { before: 'a' });
        await put('end');
        expect(await ids()).toEqual(['start', 'a', 'b', 'c', 'end']);
        expect(await ids({ order: 'desc' })).toEqual(['end', 'c', 'b', 'a', 'start']);
      });

      it('takes no occurredAt, keeps an item in place on edit, and moves it only when told', async () => {
        const { put, ids, sequences, list } = await positioned();
        const a = await put('a');
        expect(a.status).toBe('created');
        if (a.status !== 'created') return;
        expect(a.item.occurredAt).toBeNull();
        expect(a.item.position).toMatch(/^[0-9a-z]+$/);
        await put('b');
        await put('c');
        const edited = await put('a', { title: 'a2' });
        expect(edited.status).toBe('updated');
        if (edited.status !== 'updated') return;
        expect(edited.item.position).toBe(a.item.position);
        expect(await put('a', { title: 'a2' })).toMatchObject({ status: 'unchanged' });
        expect(await put('a', { title: 'a2', after: 'c' })).toMatchObject({ status: 'updated' });
        expect(await ids()).toEqual(['b', 'c', 'a']);
        const dated = await sequences.upsertItem({
          sequenceId: list.id,
          externalId: 'd',
          title: 'dated',
          occurredAt: at(3),
          writtenBy: 'agent:a',
        });
        expect(dated).toMatchObject({ status: 'created', item: { occurredAt: at(3) } });
      });

      it('takes an explicit position key, and refuses a bad key, two placements, or an unknown anchor', async () => {
        const { put, ids } = await positioned();
        await put('x', { position: 'm' });
        await put('y', { position: 'c' });
        expect(await ids()).toEqual(['y', 'x']);
        for (const extra of [{ position: 'A' }, { position: 'a_b' }, { position: '' }, { after: 'x', before: 'y' }]) {
          await expect(put('bad', extra)).rejects.toBeInstanceOf(KnowledgeSequenceItemInvalidError);
        }
        await expect(put('bad', { after: 'nope' })).rejects.toBeInstanceOf(KnowledgeSequenceItemInvalidError);
        expect(await ids()).toEqual(['y', 'x']);
      });

      it('refuses an explicit key another item holds, so every anchor has room on both sides', async () => {
        const { put, ids } = await positioned();
        await put('a', { position: 'm' });
        await expect(put('b', { position: 'm' })).rejects.toBeInstanceOf(KnowledgeSequenceItemInvalidError);
        expect((await put('a', { position: 'm', body: 'edited' })).status).toBe('updated');
        await put('b', { position: 'n' });
        await put('c', { after: 'a' });
        await put('d', { before: 'b' });
        await put('e', { before: 'a' });
        expect(await ids()).toEqual(['e', 'a', 'c', 'd', 'b']);
      });

      it('gives concurrent appends distinct keys in call order', async () => {
        const { put, ids, sequences, list } = await positioned();
        await Promise.all(['w', 'x', 'y', 'z'].map(id => put(id)));
        const { items } = await sequences.listItems({ sequenceId: list.id, read: 'all', limit: 100 });
        expect(new Set(items.map(item => item.position)).size).toBe(4);
        expect((await ids()).sort()).toEqual(['w', 'x', 'y', 'z']);
      });

      it('breaks equal search scores by position on a position sequence, whatever the items are dated', async () => {
        const { put, sequences, list } = await positioned();
        await put('last-new', { position: 'z', body: 'release notes', occurredAt: at(9) });
        await put('first-undated', { position: 'b', body: 'release notes' });
        await put('middle-old', { position: 'm', body: 'release notes', occurredAt: at(1) });
        const hits = await sequences.searchItems({ query: 'release', read: 'all', sequenceIds: [list.id], limit: 10 });
        expect(hits.map(hit => hit.externalId)).toEqual(['first-undated', 'middle-old', 'last-new']);
      });

      it('pages by position cursor both ways with no item skipped, and refuses a time cursor', async () => {
        const { put, sequences, list } = await positioned();
        const all: string[] = [];
        for (let i = 0; i < 7; i++) {
          await put(`i${i}`);
          all.push(`i${i}`);
        }
        for (const order of ['asc', 'desc'] as const) {
          const seen: string[] = [];
          let cursor: string | undefined;
          do {
            const page = await sequences.listItems({ sequenceId: list.id, read: 'all', limit: 3, order, cursor });
            seen.push(...page.items.map(i => i.externalId));
            if (page.nextCursor) expect(page.nextCursor).toMatch(/^p[0-9a-z]+_.+$/);
            cursor = page.nextCursor ?? undefined;
          } while (cursor);
          expect(seen).toEqual(order === 'asc' ? all : [...all].reverse());
        }
        for (const cursor of ['t0_x', 'pA_x', 'p_x', 'pab', 'nonsense']) {
          await expect(
            sequences.listItems({ sequenceId: list.id, read: 'all', limit: 3, cursor }),
          ).rejects.toBeInstanceOf(TypeError);
        }
      });

      it('keeps the order mode fixed, and keeps time sequences to occurredAt', async () => {
        const { sequences, list, page, item } = await positioned();
        expect(await sequences.markSequence({ pageId: list.id, orderBy: 'position' })).toEqual({ status: 'unchanged' });
        await expect(sequences.markSequence({ pageId: list.id })).rejects.toBeInstanceOf(
          KnowledgeSequenceOrderByChangeError,
        );
        await expect(sequences.markSequence({ pageId: page.id, orderBy: 'position' })).rejects.toBeInstanceOf(
          KnowledgeSequenceOrderByChangeError,
        );
        expect(await sequences.markSequence({ pageId: page.id, orderBy: 'timeline' })).toEqual({ status: 'unchanged' });
        await expect(item('placed', 1, { after: 'x' })).rejects.toBeInstanceOf(KnowledgeSequenceItemInvalidError);
        await expect(item('keyed', 1, { position: 'm' })).rejects.toBeInstanceOf(KnowledgeSequenceItemInvalidError);
        await expect(
          sequences.upsertItem({ sequenceId: page.id, externalId: 'undated', body: 'x', writtenBy: importer }),
        ).rejects.toBeInstanceOf(KnowledgeSequenceItemInvalidError);
        const created = await item('dated', 1);
        expect(created).toMatchObject({ status: 'created', item: { position: null } });
      });
    });

    describe('child pages as page items', () => {
      async function withChildren(orderBy: 'timeline' | 'position') {
        const base = await setup();
        const list = await base.store.createPage({ parentId: base.scope.id, name: 'Plan', provenance: host });
        const make = (name: string, extra: Record<string, unknown> = {}) =>
          base.store.createPage({ parentId: list.id, name, provenance: host, ...extra });
        const read = async (extra: Record<string, unknown> = {}) =>
          (await base.sequences.listItems({ sequenceId: list.id, read: 'all', limit: 100, ...extra })).items;
        const titles = async (extra: Record<string, unknown> = {}) => (await read(extra)).map(i => i.title);
        const pageOf = async (id: string) => (await base.store.getPage({ id, read: 'all' }))!;
        /** Every live page item carries its page's position, and every live child has one. */
        const consistent = async () => {
          const items = (await read()).filter(i => i.pageId);
          const children = (await base.store.listChildPages({ parentId: list.id, read: 'all', limit: 100 })).pages;
          expect(items.map(i => i.pageId).sort()).toEqual(children.map(c => c.id).sort());
          if (orderBy === 'position') {
            for (const child of children) expect(items.find(i => i.pageId === child.id)!.position).toBe(child.position);
          }
        };
        return { ...base, list, make, read, titles, pageOf, consistent, orderBy };
      }

      it('marks a page that has children, giving each a page item titled with its page name', async () => {
        for (const orderBy of ['timeline', 'position'] as const) {
          const { list, make, sequences, read, consistent } = await withChildren(orderBy);
          const first = await make('First');
          const second = await make('Second');
          expect(await sequences.markSequence({ pageId: list.id, orderBy })).toEqual({ status: 'created' });
          const items = await read();
          expect(items.map(i => [i.pageId, i.title, i.externalId])).toEqual([
            ...(orderBy === 'timeline'
              ? [
                  [second.id, 'Second', `page:${second.id}`],
                  [first.id, 'First', `page:${first.id}`],
                ]
              : [
                  [first.id, 'First', `page:${first.id}`],
                  [second.id, 'Second', `page:${second.id}`],
                ]),
          ]);
          if (orderBy === 'timeline') expect(items[1]!.occurredAt).toEqual(first.createdAt);
          await consistent();
        }
      });

      it('gives a page created under a sequence its item, appended after the light items on a position sequence', async () => {
        const { list, make, sequences, titles, consistent } = await withChildren('position');
        await sequences.markSequence({ pageId: list.id, orderBy: 'position' });
        await sequences.upsertItem({ sequenceId: list.id, externalId: 'a', title: 'a', writtenBy: 'agent:a' });
        await make('Page');
        await sequences.upsertItem({ sequenceId: list.id, externalId: 'b', title: 'b', writtenBy: 'agent:a' });
        expect(await titles()).toEqual(['a', 'Page', 'b']);
        await consistent();
      });

      it('takes a page position as the item key, and refuses one another item holds', async () => {
        const { list, make, sequences, titles, consistent } = await withChildren('position');
        await sequences.markSequence({ pageId: list.id, orderBy: 'position' });
        await sequences.upsertItem({ sequenceId: list.id, externalId: 'm', title: 'm', position: 'm', writtenBy: 'x' });
        await make('Early', { position: 'c' });
        await expect(make('Clash', { position: 'm' })).rejects.toBeInstanceOf(KnowledgeSequenceItemInvalidError);
        expect(await titles()).toEqual(['Early', 'm']);
        await consistent();
      });

      it('reorders a page within a position sequence in both rows, and keeps them equal under concurrent moves', async () => {
        const { store, list, make, sequences, titles, pageOf, consistent } = await withChildren('position');
        await sequences.markSequence({ pageId: list.id, orderBy: 'position' });
        const a = await make('A', { position: 'b' });
        const b = await make('B', { position: 'd' });
        const c = await make('C', { position: 'f' });
        await store.movePage({
          id: c.id,
          parentId: list.id,
          position: 'a',
          expectedVersion: c.version,
          provenance: host,
        });
        expect(await titles()).toEqual(['C', 'A', 'B']);
        await consistent();
        const [ma, mb] = [await pageOf(a.id), await pageOf(b.id)];
        await Promise.all([
          store.movePage({
            id: ma.id,
            parentId: list.id,
            position: 'x',
            expectedVersion: ma.version,
            provenance: host,
          }),
          store.movePage({
            id: mb.id,
            parentId: list.id,
            position: 'w',
            expectedVersion: mb.version,
            provenance: host,
          }),
        ]);
        expect(await titles()).toEqual(['C', 'B', 'A']);
        await consistent();
      });

      it('tombstones the page item when the page moves out or is deleted, and revives it when the page comes back', async () => {
        const { store, scope, list, make, sequences, read, pageOf, consistent } = await withChildren('timeline');
        await sequences.markSequence({ pageId: list.id });
        const stays = await make('Stays');
        const leaves = await make('Leaves');
        const goes = await make('Goes');
        const reply = await sequences.upsertItem({
          sequenceId: list.id,
          externalId: 'reply',
          body: 'about Goes',
          occurredAt: at(5),
          externalParentId: `page:${goes.id}`,
          writtenBy: importer,
        });
        expect(reply.status).toBe('created');
        await store.movePage({ id: leaves.id, parentId: scope.id, expectedVersion: leaves.version, provenance: host });
        await store.deletePage({ id: goes.id, expectedVersion: goes.version, deletedBy: 'host' });
        await consistent();
        const all = await read({ includeDeleted: true });
        expect(
          all
            .filter(i => i.pageId && i.deletedAt)
            .map(i => i.pageId)
            .sort(),
        ).toEqual([leaves.id, goes.id].sort());
        expect((await read()).find(i => i.externalId === 'reply')).toMatchObject({
          externalParentId: `page:${goes.id}`,
        });
        const moved = await pageOf(leaves.id);
        await store.movePage({ id: moved.id, parentId: list.id, expectedVersion: moved.version, provenance: host });
        await consistent();
        expect((await read()).map(i => i.pageId).filter(Boolean)).toEqual(
          expect.arrayContaining([stays.id, leaves.id]),
        );
      });

      it('carries a page item through a merge into or out of a sequence', async () => {
        const { store, scope, list, make, sequences, consistent } = await withChildren('position');
        await sequences.markSequence({ pageId: list.id, orderBy: 'position' });
        await make('Kept');
        const outside = await store.createPage({ parentId: scope.id, name: 'Outside', provenance: host });
        await store.createPage({ parentId: outside.id, name: 'Arrives', provenance: host });
        await store.mergePages({
          sourceId: outside.id,
          targetId: list.id,
          sourceVersion: outside.version,
          provenance: host,
        });
        await consistent();
        const leaving = await make('Leaving');
        const target = await store.createPage({ parentId: scope.id, name: 'Target', provenance: host });
        await store.mergePages({
          sourceId: leaving.id,
          targetId: target.id,
          sourceVersion: leaving.version,
          provenance: host,
        });
        await consistent();
      });

      it('shows a renamed page by its new name, and refuses item writes to a page item', async () => {
        const { store, list, make, sequences, titles } = await withChildren('position');
        await sequences.markSequence({ pageId: list.id, orderBy: 'position' });
        const page = await make('Old name');
        await store.updatePage({ id: page.id, name: 'New name', expectedVersion: page.version, provenance: host });
        expect(await titles()).toEqual(['New name']);
        await sequences.upsertItem({
          sequenceId: list.id,
          externalId: 'after-page',
          title: 'after',
          after: `page:${page.id}`,
          writtenBy: 'agent:a',
        });
        expect(await titles()).toEqual(['New name', 'after']);
        await expect(
          sequences.upsertItem({
            sequenceId: list.id,
            externalId: `page:${page.id}`,
            title: 'x',
            writtenBy: 'agent:a',
          }),
        ).rejects.toBeInstanceOf(KnowledgeSequencePageItemError);
        await expect(
          sequences.removeItem({ sequenceId: list.id, externalId: `page:${page.id}`, writtenBy: 'agent:a' }),
        ).rejects.toBeInstanceOf(KnowledgeSequencePageItemError);
        await expect(
          sequences.upsertItem({ sequenceId: list.id, externalId: 'page:other', title: 'x', writtenBy: 'agent:a' }),
        ).rejects.toBeInstanceOf(KnowledgeSequencePageItemError);
        expect(await titles()).toEqual(['New name', 'after']);
      });

      it('refuses to mark a page with more children than one mark may write', async () => {
        const { store, list, sequences } = await withChildren('timeline');
        for (let i = 0; i <= MAX_KNOWLEDGE_SEQUENCE_MARK_CHILDREN; i++) {
          await store.createPage({ parentId: list.id, name: `p${i}`, provenance: host });
        }
        await expect(sequences.markSequence({ pageId: list.id })).rejects.toBeInstanceOf(
          KnowledgeSequenceTooManyChildrenError,
        );
        expect(await sequences.listSequenceIds({ pageIds: [list.id] })).toEqual([]);
      });
    });

    describe('property schemas and item types', () => {
      const untypedSchema = {
        type: 'object' as const,
        properties: { channel: { type: 'string' as const } },
        required: ['channel'],
      };
      const deploySchema = {
        type: 'object' as const,
        properties: {
          env: { type: 'string' as const, enum: ['staging', 'production'] },
          at: { type: 'date' as const },
          ok: { type: 'boolean' as const },
          ms: { type: 'number' as const },
          failed: { type: 'array' as const, items: { type: 'string' as const }, maxItems: 3 },
        },
        required: ['env'],
      };
      const itemTypes = {
        deploy: { label: 'Deploy', description: 'A release to an environment', propertiesSchema: deploySchema },
        note: { label: 'Note' },
      };

      async function typed() {
        const { store, scope, sequences } = await setup();
        const page = await store.createPage({ parentId: scope.id, name: 'Releases', provenance: host });
        expect(await sequences.markSequence({ pageId: page.id, propertiesSchema: untypedSchema, itemTypes })).toEqual({
          status: 'created',
        });
        const put = (externalId: string, extra: Record<string, unknown>) =>
          sequences.upsertItem({
            sequenceId: page.id,
            externalId,
            occurredAt: at(1),
            title: externalId,
            writtenBy: importer,
            ...extra,
          });
        return { store, sequences, page, put };
      }

      async function refusedBySchema(write: Promise<unknown>, itemType: string | null, key: string) {
        const error = await write.then(
          () => undefined,
          (e: unknown) => e,
        );
        expect(error).toBeInstanceOf(KnowledgeSequenceItemPropertiesError);
        expect(error).toBeInstanceOf(KnowledgeSequenceItemInvalidError);
        expect(error).toMatchObject({ itemType, key });
      }

      it('stores the schemas on the sequence and reads them back', async () => {
        const { sequences, page } = await typed();
        expect(await sequences.getSequence({ pageId: page.id })).toEqual({
          pageId: page.id,
          orderBy: 'timeline',
          propertiesSchema: untypedSchema,
          itemTypes,
        });
        expect(await sequences.getSequence({ pageId: 'no-such-page' })).toBeNull();
      });

      it('checks an untyped item against the sequence schema', async () => {
        const { sequences, page, put } = await typed();
        expect((await put('ok', { properties: { channel: 'general', extra: [1, { a: 2 }] } })).status).toBe('created');
        await refusedBySchema(put('missing', { properties: { other: 'x' } }), null, 'channel');
        await refusedBySchema(put('wrong', { properties: { channel: 3 } }), null, 'channel');
        await refusedBySchema(put('none', {}), null, 'channel');
        const { items } = await sequences.listItems({ sequenceId: page.id, read: acme, limit: 10 });
        expect(items.map(item => item.externalId)).toEqual(['ok']);
      });

      it("checks a typed item against its type's schema only, not the sequence schema", async () => {
        const { put } = await typed();
        const deploy = {
          env: 'production',
          at: '2026-11-23T12:00:00Z',
          ok: true,
          ms: 1.5,
          failed: ['a', 'b'],
          free: { any: 'json' },
        };
        expect((await put('d1', { type: 'deploy', properties: deploy })).status).toBe('created');
        await refusedBySchema(put('d2', { type: 'deploy', properties: { env: 'dev' } }), 'deploy', 'env');
        await refusedBySchema(put('d3', { type: 'deploy', properties: { at: 'yesterday' } }), 'deploy', 'env');
        await refusedBySchema(
          put('d4', { type: 'deploy', properties: { env: 'staging', at: '2026-02-30T00:00:00Z' } }),
          'deploy',
          'at',
        );
        await refusedBySchema(put('d5', { type: 'deploy', properties: { env: 'staging', ok: 'yes' } }), 'deploy', 'ok');
        await refusedBySchema(put('d6', { type: 'deploy', properties: { env: 'staging', ms: '1' } }), 'deploy', 'ms');
        await refusedBySchema(
          put('d7', { type: 'deploy', properties: { env: 'staging', failed: ['a', 'b', 'c', 'd'] } }),
          'deploy',
          'failed',
        );
        await refusedBySchema(
          put('d8', { type: 'deploy', properties: { env: 'staging', failed: ['a', 2] } }),
          'deploy',
          'failed',
        );
        await refusedBySchema(
          put('d9', { type: 'deploy', properties: { env: 'staging', failed: 'a' } }),
          'deploy',
          'failed',
        );
      });

      it('leaves a type without a schema, or an undeclared type, free-form within the common limits', async () => {
        const { put } = await typed();
        const wouldFailEverySchema = { env: 'dev', channel: 3 };
        expect((await put('n1', { type: 'note', properties: wouldFailEverySchema })).status).toBe('created');
        expect((await put('u1', { type: 'unknown-kind', properties: wouldFailEverySchema })).status).toBe('created');
        await expect(put('n2', { type: 'note', properties: { big: 'x'.repeat(17 * 1024) } })).rejects.toBeInstanceOf(
          KnowledgeSequenceItemInvalidError,
        );
        await expect(put('n3', { type: 'Not A Key', properties: {} })).rejects.toBeInstanceOf(
          KnowledgeSequenceItemInvalidError,
        );
      });

      it('checks an edit against its new type, and clearing the type falls back to the sequence schema', async () => {
        const { put } = await typed();
        await put('e', { type: 'note', properties: { anything: 1 } });
        await refusedBySchema(
          put('e', { type: 'deploy', properties: { anything: 1 }, editedAt: at(2) }),
          'deploy',
          'env',
        );
        expect((await put('e', { type: 'deploy', properties: { env: 'staging' }, editedAt: at(3) })).item.type).toBe(
          'deploy',
        );
        await refusedBySchema(put('e', { properties: { env: 'staging' }, editedAt: at(4) }), null, 'channel');
        expect((await put('e', { properties: { channel: 'c' }, editedAt: at(5) })).item.type).toBeNull();
      });

      it('lets a sequence with no schemas take any properties', async () => {
        const { item } = await setup();
        expect((await item('free', 1, { type: 'deploy', properties: { env: 3 } })).status).toBe('created');
        expect((await item('free2', 2, { properties: { channel: 3 } })).status).toBe('created');
      });

      it('refuses a bad schema or item-type map when marking, and writes nothing', async () => {
        const { store, scope, sequences } = await setup();
        const page = await store.createPage({ parentId: scope.id, name: 'Bad', provenance: host });
        const manyProps = Object.fromEntries(
          Array.from({ length: 51 }, (_, i) => [`p${i}`, { type: 'string' as const }]),
        );
        const manyTypes = Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`t${i}`, {}]));
        const hugeTypes = Object.fromEntries(
          Array.from({ length: 49 }, (_, i) => [`t${i}`, { description: 'x'.repeat(500), label: 'y'.repeat(80) }]),
        );
        const bigEnum = { type: 'object', properties: { e: { type: 'string', enum: ['x'.repeat(70 * 1024)] } } };
        for (const declaration of [
          { propertiesSchema: { type: 'object', properties: manyProps } },
          { itemTypes: { deploy: { propertiesSchema: { type: 'object', properties: manyProps } } } },
          { itemTypes: manyTypes },
          { itemTypes: { ...hugeTypes, big: { propertiesSchema: bigEnum } } },
          { itemTypes: { 'Bad Key': {} } },
          { itemTypes: { deploy: { label: 'x'.repeat(81) } } },
          { itemTypes: { deploy: { description: 'x'.repeat(501) } } },
          { propertiesSchema: { type: 'array' } },
          { propertiesSchema: { type: 'object', properties: { a: { type: 'object' } } } },
          { propertiesSchema: { type: 'object', properties: { a: { type: 'array', items: { type: 'boolean' } } } } },
          {
            propertiesSchema: {
              type: 'object',
              properties: { a: { type: 'array', items: { type: 'string' }, maxItems: 1001 } },
            },
          },
          { propertiesSchema: { type: 'object', properties: { a: { type: 'string', enum: [1] } } } },
          { propertiesSchema: { type: 'object', properties: { a: { type: 'string', enum: [] } } } },
          { propertiesSchema: { type: 'object', properties: { a: { type: 'string' } }, required: ['b'] } },
          { propertiesSchema: { type: 'object', properties: { a: { type: 'string', pattern: '.*' } } } },
          { propertiesSchema: { type: 'object', properties: {}, $ref: '#' } },
        ]) {
          await expect(sequences.markSequence({ pageId: page.id, ...(declaration as object) })).rejects.toBeInstanceOf(
            KnowledgeSequenceSchemaInvalidError,
          );
        }
        expect(await sequences.getSequence({ pageId: page.id })).toBeNull();
        expect(await sequences.listSequenceIds({ pageIds: [page.id] })).toEqual([]);
      });

      it('refuses a deeply nested declaration with a schema error, and writes nothing', async () => {
        const { store, scope, sequences } = await setup();
        const page = await store.createPage({ parentId: scope.id, name: 'Deep', provenance: host });
        const nested = (depth: number) => {
          let value: Record<string, unknown> = {};
          for (let i = 0; i < depth; i++) value = { a: value };
          return value;
        };
        for (const [declaration, path] of [
          [{ propertiesSchema: { type: 'object', properties: { value: nested(4000) } } }, 'propertiesSchema'],
          [{ itemTypes: { deploy: { propertiesSchema: nested(4000) } } }, 'itemTypes'],
        ] as const) {
          const error = await sequences.markSequence({ pageId: page.id, ...(declaration as object) }).then(
            () => undefined,
            (e: unknown) => e,
          );
          expect(error).toBeInstanceOf(KnowledgeSequenceSchemaInvalidError);
          expect((error as { path: string }).path.startsWith(path)).toBe(true);
        }
        expect(await sequences.getSequence({ pageId: page.id })).toBeNull();
      });

      it('takes free-form properties nested as deep as their byte limit allows, and replays them unchanged', async () => {
        const { store, scope, sequences } = await setup();
        const page = await store.createPage({ parentId: scope.id, name: 'Free', provenance: host });
        await sequences.markSequence({ pageId: page.id });
        const nested = (depth: number) => {
          let value: Record<string, unknown> = {};
          for (let i = 1; i < depth; i++) value = { a: value };
          return value;
        };
        const write = (externalId: string, properties: Record<string, unknown>) =>
          sequences.upsertItem({
            sequenceId: page.id,
            externalId,
            occurredAt: at(1),
            title: externalId,
            properties,
            writtenBy: importer,
          });
        // 2,500 levels is about 15 KB of JSON, under the 16 KB limit; key order mustn't matter at depth.
        for (const depth of [MAX_KNOWLEDGE_SEQUENCE_JSON_DEPTH + 1, 2500]) {
          const id = `deep-${depth}`;
          const created = await write(id, nested(depth));
          expect(created.status).toBe('created');
          expect((await write(id, nested(depth))).status).toBe('unchanged');
          const stored = await sequences.getItem({ sequenceId: page.id, id: created.item.id, read: 'all' });
          expect(JSON.stringify(stored!.properties)).toBe(JSON.stringify(nested(depth)));
        }
        // Arrays nest a level per byte: too deep for JSON.stringify, so refused with a typed error.
        let deepArray: unknown = [];
        for (let i = 1; i < 8000; i++) deepArray = [deepArray];
        await expect(write('too-deep', { list: deepArray })).rejects.toMatchObject({
          name: 'KnowledgeSequenceItemInvalidError',
          field: 'properties',
        });
        const { items } = await sequences.listItems({ sequenceId: page.id, read: 'all', limit: 10 });
        expect(items.map(i => i.externalId).sort()).toEqual(['deep-2500', 'deep-65']);
      });

      it('re-declares: same schemas in another key order write nothing, changed ones replace in place', async () => {
        const { sequences, page, put } = await typed();
        await put('kept', { type: 'deploy', properties: { env: 'production' } });
        const reordered = {
          note: { label: 'Note' },
          deploy: {
            propertiesSchema: { required: ['env'], properties: deploySchema.properties, type: 'object' as const },
            description: 'A release to an environment',
            label: 'Deploy',
          },
        };
        expect(
          await sequences.markSequence({ pageId: page.id, itemTypes: reordered, propertiesSchema: untypedSchema }),
        ).toEqual({ status: 'unchanged' });

        const loose = { deploy: { label: 'Deploy' } };
        expect(await sequences.markSequence({ pageId: page.id, itemTypes: loose })).toEqual({ status: 'updated' });
        expect(await sequences.getSequence({ pageId: page.id })).toMatchObject({
          propertiesSchema: null,
          itemTypes: loose,
        });
        expect(await sequences.markSequence({ pageId: page.id, itemTypes: loose })).toEqual({ status: 'unchanged' });
        await expect(
          sequences.markSequence({ pageId: page.id, orderBy: 'position', itemTypes: loose }),
        ).rejects.toBeInstanceOf(KnowledgeSequenceOrderByChangeError);
        expect(await sequences.getSequence({ pageId: page.id })).toMatchObject({
          orderBy: 'timeline',
          itemTypes: loose,
        });

        const { items } = await sequences.listItems({ sequenceId: page.id, read: acme, limit: 10 });
        expect(items.map(item => [item.externalId, item.type, item.properties])).toEqual([
          ['kept', 'deploy', { env: 'production' }],
        ]);
        expect((await put('loose', { type: 'deploy', properties: { env: 1 } })).status).toBe('created');

        // Tightening again checks new writes only; items already stored stay as they are.
        expect(await sequences.markSequence({ pageId: page.id, itemTypes: reordered })).toEqual({ status: 'updated' });
        const after = await sequences.listItems({ sequenceId: page.id, read: acme, limit: 10 });
        expect(after.items.map(item => [item.externalId, item.properties]).sort()).toEqual([
          ['kept', { env: 'production' }],
          ['loose', { env: 1 }],
        ]);
        await expect(put('loose', { type: 'deploy', properties: { env: 2 } })).rejects.toBeInstanceOf(
          KnowledgeSequenceItemPropertiesError,
        );
      });
    });
  });
}
