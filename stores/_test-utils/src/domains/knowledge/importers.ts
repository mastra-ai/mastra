import type { KnowledgeImportRun, KnowledgeStorage } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';

const counts = { created: 0, updated: 0, unchanged: 0, removed: 0, notes: 0 };

function run(id: string, importerId: string, startedAt: number): KnowledgeImportRun {
  return {
    id,
    importerId,
    status: 'running',
    dryRun: false,
    incremental: false,
    counts,
    startedAt: new Date(startedAt),
  };
}

/**
 * Shared importer-store contract (see `@mastra/core/storage` importers.ts). The in-memory store is the
 * reference. `createStore` returns a fresh or cleared store each time.
 */
export function createKnowledgeImporterStoreTests(
  createStore: () => Promise<KnowledgeStorage> | KnowledgeStorage,
): void {
  describe('knowledge importer store contract', () => {
    let store: KnowledgeStorage;

    beforeEach(async () => {
      store = await createStore();
      await store.init();
      await store.dangerouslyClearAll();
    });

    it('reports importer support', () => {
      expect(store.getCapabilities().supportsImporters).toBe(true);
    });

    it('saves, replaces and deletes JSON state per importer and key', async () => {
      await store.setImportState({ importerId: 'linear', key: 'cursor', value: { since: '2026-11-01', n: 3 } });
      await store.setImportState({ importerId: 'notion', key: 'cursor', value: 'other' });
      expect(await store.getImportState({ importerId: 'linear', key: 'cursor' })).toEqual({
        since: '2026-11-01',
        n: 3,
      });
      await store.setImportState({ importerId: 'linear', key: 'cursor', value: [1, 'two', null] });
      expect(await store.getImportState({ importerId: 'linear', key: 'cursor' })).toEqual([1, 'two', null]);
      await store.setImportState({ importerId: 'linear', key: 'cursor', value: undefined });
      expect(await store.getImportState({ importerId: 'linear', key: 'cursor' })).toBeUndefined();
      expect(await store.getImportState({ importerId: 'notion', key: 'cursor' })).toBe('other');
    });

    it('creates, finishes and lists runs newest first', async () => {
      const created = await store.createImportRun(run('r1', 'linear', Date.UTC(2026, 10, 1)));
      expect(created).toEqual(run('r1', 'linear', Date.UTC(2026, 10, 1)));
      await store.createImportRun(run('r2', 'linear', Date.UTC(2026, 10, 2)));
      await store.createImportRun(run('r3', 'notion', Date.UTC(2026, 10, 3)));

      const done = await store.updateImportRun({
        id: 'r1',
        status: 'failed',
        counts: { ...counts, created: 4, notes: 1 },
        error: 'source returned 500',
        completedAt: new Date(Date.UTC(2026, 10, 1, 1)),
      });
      expect(done).toEqual({
        ...run('r1', 'linear', Date.UTC(2026, 10, 1)),
        status: 'failed',
        counts: { ...counts, created: 4, notes: 1 },
        error: 'source returned 500',
        completedAt: new Date(Date.UTC(2026, 10, 1, 1)),
      });
      expect(await store.getImportRun({ id: 'r1' })).toEqual(done);
      expect(await store.getImportRun({ id: 'missing' })).toBeNull();
      await expect(store.updateImportRun({ id: 'missing', status: 'succeeded', counts })).rejects.toThrow();

      expect((await store.listImportRuns({ importerId: 'linear' })).map(r => r.id)).toEqual(['r2', 'r1']);
      expect((await store.listImportRuns({})).map(r => r.id)).toEqual(['r3', 'r2', 'r1']);
      expect((await store.listImportRuns({ limit: 1 })).map(r => r.id)).toEqual(['r3']);
    });

    it('tracks owned pages per importer, idempotently', async () => {
      const a = { scope: 'org:acme', path: 'linear/ENG-1' };
      const b = { scope: 'team:acme:eng', path: 'linear/ENG-2' };
      await store.updateImportOwnedPages({ importerId: 'linear', add: [a, b, a] });
      await store.updateImportOwnedPages({ importerId: 'linear', add: [a] });
      await store.updateImportOwnedPages({ importerId: 'notion', add: [a] });
      const sorted = async (importerId: string) =>
        (await store.listImportOwnedPages({ importerId })).sort((x, y) => x.path.localeCompare(y.path));
      expect(await sorted('linear')).toEqual([a, b]);
      await store.updateImportOwnedPages({ importerId: 'linear', remove: [a] });
      expect(await sorted('linear')).toEqual([b]);
      expect(await sorted('notion')).toEqual([a]);
    });

    it('clears importer data with the rest of Knowledge', async () => {
      await store.setImportState({ importerId: 'linear', key: 'cursor', value: 1 });
      await store.createImportRun(run('r1', 'linear', 1));
      await store.updateImportOwnedPages({ importerId: 'linear', add: [{ scope: 'org:acme', path: 'x' }] });
      await store.dangerouslyClearAll();
      expect(await store.getImportState({ importerId: 'linear', key: 'cursor' })).toBeUndefined();
      expect(await store.listImportRuns({})).toEqual([]);
      expect(await store.listImportOwnedPages({ importerId: 'linear' })).toEqual([]);
    });
  });
}
