import type { KnowledgeImportersStorage, KnowledgeStorage } from '@mastra/core/storage';
import { KnowledgeImporterBindingConflictError, KnowledgeImporterRunStateError } from '@mastra/core/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

export interface KnowledgeImportersFixture {
  /** Initialized, importer tables provisioned. */
  store: KnowledgeStorage;
  /** A second store on its own connection to the same database and namespace. */
  reader: KnowledgeStorage;
  /**
   * A store on the same database but another namespace (another PG schema, say), its importer
   * tables provisioned. Left out where a store has no namespaces.
   */
  otherNamespace?: KnowledgeStorage;
  /**
   * A store on the same database in a fresh namespace whose importer tables were never created,
   * plus a way to ask whether they exist. Left out where tables don't need creating (in memory).
   */
  unprovisioned?: { store: KnowledgeStorage; importerTablesExist(): Promise<boolean> };
  /** Concurrent transactions run on separate connections, so row locks are observable. */
  concurrentTransactions: boolean;
  cleanup(): Promise<void>;
}

const who = { author: 'importer:test' };

function importersOf(store: KnowledgeStorage): KnowledgeImportersStorage {
  const importers = store.importers;
  if (!importers) throw new Error('store has no importer storage');
  return importers;
}

const node = (
  sourceId: string,
  pageId: string,
  extra: Partial<{ aliases: string[]; parentSourceId: string }> = {},
) => ({
  bindingId: 'b1',
  sourceId,
  pageId,
  kind: 'page',
  parentSourceId: extra.parentSourceId ?? null,
  aliases: extra.aliases ?? [],
  unresolvedLinks: [],
  stub: false,
});

const counts = { created: 1, updated: 0, unchanged: 0, moved: 0, removed: 0, stubbed: 0, refused: 0 };

/**
 * r347 O2: the importer bookkeeping a Knowledge store keeps beside its pages, and the guarantees the
 * local importer host (O3) builds on: conditional run sequencing, a generation fence on the locked
 * writer guard, opaque source IDs, and writes that commit or roll back with page writes.
 */
export function createKnowledgeImportersStorageTests(createFixture: () => Promise<KnowledgeImportersFixture>): void {
  describe('knowledge importers storage contract', () => {
    let fixture: KnowledgeImportersFixture;
    let importers: KnowledgeImportersStorage;
    let run = 0;
    let runId: string;

    beforeAll(async () => {
      fixture = await createFixture();
      importers = importersOf(fixture.store);
    });
    afterAll(async () => {
      await fixture?.cleanup();
    });
    beforeEach(async () => {
      await fixture.store.dangerouslyClearAll();
      await importers.dangerouslyClearAll();
      await importers.registerBinding({ id: 'b1', importer: 'notion', target: 'org:acme#notion' });
      runId = `run-${++run}`;
    });

    const generation = async () => (await importers.readWriterGuard()).generation;
    const start = async (id = runId, extra: { fireKey?: string; deadlineAt?: Date } = {}) =>
      importers.startRun({ bindingId: 'b1', runId: id, generation: await generation(), ...extra });

    describe('bindings', () => {
      it('registers once and refuses a different importer or target', async () => {
        expect(
          (await importers.registerBinding({ id: 'b1', importer: 'notion', target: 'org:acme#notion' })).status,
        ).toBe('unchanged');
        await expect(
          importers.registerBinding({ id: 'b1', importer: 'linear', target: 'org:acme#notion' }),
        ).rejects.toBeInstanceOf(KnowledgeImporterBindingConflictError);
        await expect(
          importers.registerBinding({ id: 'b1', importer: 'notion', target: 'org:acme#elsewhere' }),
        ).rejects.toBeInstanceOf(KnowledgeImporterBindingConflictError);
        expect(await importers.getBinding('b1')).toMatchObject({ importer: 'notion', target: 'org:acme#notion' });
        expect((await importers.listBindings()).map(b => b.id)).toEqual(['b1']);
      });
    });

    describe('runs', () => {
      it('starts at the guard generation and records a second run as skipped', async () => {
        const first = await start();
        expect(first).toMatchObject({ status: 'started', run: { status: 'running', lastSeq: 0, generation: 1 } });
        const second = await start(`${runId}-b`);
        expect(second).toMatchObject({ status: 'skipped', run: { id: `${runId}-b`, status: 'skipped' } });
        expect((await importers.listRuns('b1')).map(r => r.id).sort()).toEqual([runId, `${runId}-b`].sort());
      });

      it('collapses a repeated fire key into the first run', async () => {
        await start(runId, { fireKey: 'tick-1' });
        const again = await start(`${runId}-dup`, { fireKey: 'tick-1' });
        expect(again).toMatchObject({ status: 'duplicate', run: { id: runId } });
        expect(await importers.getRun(`${runId}-dup`)).toBeNull();
      });

      it('lets only one of many concurrent starts run', async () => {
        const results = await Promise.all(Array.from({ length: 6 }, (_, i) => start(`${runId}-${i}`)));
        expect(results.filter(r => r.status === 'started')).toHaveLength(1);
        expect(results.filter(r => r.status === 'skipped')).toHaveLength(5);
      });

      it('records cancel requests only on a running run', async () => {
        await start();
        expect((await importers.requestCancel(runId))?.cancelRequestedAt).toBeInstanceOf(Date);
        expect(await importers.requestCancel('missing')).toBeNull();
      });
    });

    describe('flushes', () => {
      const flush = (seq: number, extra: { generation?: number; digest?: string } = {}) =>
        importers.recordFlush({
          runId,
          generation: extra.generation ?? 1,
          seq,
          digest: extra.digest ?? `d${seq}`,
          receipt: { seq },
          counts,
        });

      it('advances one seq at a time, sums counts and returns the stored record', async () => {
        await start();
        await flush(1);
        await flush(2);
        expect(await importers.getRun(runId)).toMatchObject({ lastSeq: 2, counts: { created: 2 } });
        expect(await importers.getFlush(runId, 1, 2)).toMatchObject({ digest: 'd2', receipt: { seq: 2 } });
        expect(await importers.getFlush(runId, 1, 3)).toBeNull();
      });

      it('refuses a gap, a repeat, a wrong generation, a missing run and an ended run, writing nothing', async () => {
        await start();
        await expect(flush(2)).rejects.toMatchObject({ reason: 'seq' });
        await flush(1);
        await expect(flush(1, { digest: 'other' })).rejects.toBeInstanceOf(KnowledgeImporterRunStateError);
        await expect(flush(2, { generation: 7 })).rejects.toMatchObject({ reason: 'generation' });
        await expect(
          importers.recordFlush({ runId: 'missing', generation: 1, seq: 1, digest: 'x', receipt: {}, counts }),
        ).rejects.toMatchObject({ reason: 'not_found' });
        await importers.finishRun({ runId, generation: 1, lastSeq: 1, status: 'succeeded', finish: { outcome: 'x' } });
        await expect(flush(2)).rejects.toMatchObject({ reason: 'not_running' });
        expect(await importers.getRun(runId)).toMatchObject({ lastSeq: 1, counts: { created: 1 } });
        expect(await importers.getFlush(runId, 1, 1)).toMatchObject({ digest: 'd1' });
      });

      it('finishes once, at the committed seq, and keeps the normalized finish for replay', async () => {
        await start();
        await flush(1);
        await expect(
          importers.finishRun({ runId, generation: 1, lastSeq: 0, status: 'succeeded', finish: {} }),
        ).rejects.toMatchObject({ reason: 'seq' });
        const finish = { outcome: 'succeeded', backlog: false, lastSeq: 1, error: null };
        const ended = await importers.finishRun({ runId, generation: 1, lastSeq: 1, status: 'succeeded', finish });
        expect(ended).toMatchObject({ status: 'succeeded', finish, lastSeq: 1 });
        expect(ended.completedAt).toBeInstanceOf(Date);
        await expect(
          importers.finishRun({ runId, generation: 1, lastSeq: 1, status: 'failed', finish: {} }),
        ).rejects.toMatchObject({ reason: 'not_running' });
        expect((await importers.getRun(runId))?.finish).toEqual(finish);
      });
    });

    describe('writer guard', () => {
      it('starts at generation 1 on path new, with no first write', async () => {
        expect(await importers.readWriterGuard()).toEqual({ activePath: 'new', generation: 1, firstWriteAt: null });
      });

      it('sets the first write once', async () => {
        expect(await importers.markFirstWrite()).toBe(true);
        expect(await importers.markFirstWrite()).toBe(false);
        expect((await importers.readWriterGuard()).firstWriteAt).toBeInstanceOf(Date);
      });

      it('fences a run whose own row still matches but the locked guard has moved on', async () => {
        await start();
        await importers.recordFlush({ runId, generation: 1, seq: 1, digest: 'd1', receipt: {}, counts });
        await fixture.store.transaction(async tx => {
          await importersOf(tx).lockWriterGuard('update');
          await importersOf(tx).advanceWriterGuard({ activePath: 'new', generation: 2 });
        });
        expect((await importers.getRun(runId))?.generation).toBe(1);
        await expect(
          fixture.store.transaction(async tx => {
            await importersOf(tx).lockWriterGuard('share');
            await importersOf(tx).recordFlush({ runId, generation: 1, seq: 2, digest: 'd2', receipt: {}, counts });
          }),
        ).rejects.toMatchObject({ reason: 'stale_guard' });
        await expect(
          importers.finishRun({ runId, generation: 1, lastSeq: 1, status: 'succeeded', finish: {} }),
        ).rejects.toMatchObject({ reason: 'stale_guard' });
        expect(await importers.getRun(runId)).toMatchObject({ lastSeq: 1, status: 'running' });
        expect(await importers.readWriterGuard()).toEqual({ activePath: 'new', generation: 2, firstWriteAt: null });
      });

      it('refuses a generation that does not move forward', async () => {
        await expect(
          fixture.store.transaction(async tx => {
            await importersOf(tx).lockWriterGuard('update');
            await importersOf(tx).advanceWriterGuard({ activePath: 'new', generation: 1 });
          }),
        ).rejects.toThrow();
        expect((await importers.readWriterGuard()).generation).toBe(1);
      });

      it('sets the first write exactly once when flushes race, without deadlock', async () => {
        const marked = await Promise.all(
          Array.from({ length: 5 }, () =>
            fixture.store.transaction(async tx => {
              await importersOf(tx).lockWriterGuard('update');
              return importersOf(tx).markFirstWrite();
            }),
          ),
        );
        expect(marked.filter(Boolean)).toHaveLength(1);
      });

      it('blocks an advance while a flush holds the guard shared', async ctx => {
        if (!fixture.concurrentTransactions) ctx.skip();
        await start();
        let releaseFlush!: () => void;
        const held = new Promise<void>(r => (releaseFlush = r));
        let flushLocked!: () => void;
        const locked = new Promise<void>(r => (flushLocked = r));
        const flushing = fixture.store.transaction(async tx => {
          await importersOf(tx).lockWriterGuard('share');
          flushLocked();
          await held;
          await importersOf(tx).recordFlush({ runId, generation: 1, seq: 1, digest: 'd1', receipt: {}, counts });
        });
        await locked;
        let advanced = false;
        const advancing = fixture.store
          .transaction(async tx => {
            await importersOf(tx).lockWriterGuard('update');
            await importersOf(tx).advanceWriterGuard({ activePath: 'new', generation: 2 });
          })
          .then(() => (advanced = true));
        await new Promise(r => setTimeout(r, 150));
        expect(advanced).toBe(false);
        releaseFlush();
        await flushing;
        await advancing;
        expect(await importers.getRun(runId)).toMatchObject({ lastSeq: 1 });
        expect((await importers.readWriterGuard()).generation).toBe(2);
      });
    });

    describe('nodes', () => {
      it('maps source IDs to pages, by page and by alias, and pages through them in byte order', async () => {
        await importers.saveNode(node('b', 'page-b', { aliases: ['old-b'] }));
        await importers.saveNode(node('a', 'page-a'));
        await importers.saveNode(node('c', 'page-c', { parentSourceId: 'a' }));
        expect(await importers.getNode('b1', 'c')).toMatchObject({ pageId: 'page-c', parentSourceId: 'a' });
        expect(await importers.getNodeByPage('page-b')).toMatchObject({ sourceId: 'b' });
        expect(await importers.findNodeByAlias('b1', 'old-b')).toMatchObject({ sourceId: 'b' });
        const first = await importers.listNodes('b1', { limit: 2 });
        expect(first.items.map(n => n.sourceId)).toEqual(['a', 'b']);
        const rest = await importers.listNodes('b1', { after: first.next!, limit: 2 });
        expect(rest.items.map(n => n.sourceId)).toEqual(['c']);
        expect(rest.next).toBeNull();
        await importers.deleteNode('b1', 'b');
        expect(await importers.getNode('b1', 'b')).toBeNull();
        expect(await importers.getNodeByPage('page-b')).toBeNull();
      });

      it('replaces a node in place and refuses a page another node owns', async () => {
        await importers.saveNode(node('a', 'page-a'));
        await importers.saveNode({ ...node('a', 'page-a'), stub: true, aliases: ['x'] });
        expect(await importers.getNode('b1', 'a')).toMatchObject({ stub: true, aliases: ['x'] });
        await expect(importers.saveNode(node('z', 'page-a'))).rejects.toThrow();
        expect(await importers.getNode('b1', 'z')).toBeNull();
      });

      it('keeps source IDs that differ only by case or Unicode folding apart', async () => {
        const ids = ['Page', 'page', 'PAGE', '\u0130', 'i\u0307', '\u00df', 'SS', 'ss', '\u00e9', 'e\u0301'];
        for (const [i, id] of ids.entries()) await importers.saveNode(node(id, `p${i}`));
        for (const [i, id] of ids.entries()) expect((await importers.getNode('b1', id))?.pageId).toBe(`p${i}`);
        expect((await importers.listNodes('b1')).items).toHaveLength(ids.length);
        expect(await importers.getNode('b1', 'pAGE')).toBeNull();
      });
    });

    describe('state', () => {
      it('upserts keys, keeps the others, and round-trips a __proto__ key as data', async () => {
        await importers.setState('b1', { cursor: 'c1', since: '2026' });
        await importers.setState('b1', JSON.parse('{"cursor":"c2","__proto__":"own"}'));
        const state = await importers.getState('b1');
        expect(Object.keys(state).sort()).toEqual(['__proto__', 'cursor', 'since']);
        expect(Object.getOwnPropertyDescriptor(state, '__proto__')?.value).toBe('own');
        expect(state.cursor).toBe('c2');
        expect(Object.getPrototypeOf(state)).toBe(Object.prototype);
      });
    });

    describe('run changes', () => {
      it('lists changes in the order recorded, one per source ID', async () => {
        await start();
        for (const sourceId of ['z', 'a', 'm']) {
          await importers.recordRunChange({
            runId,
            sourceId,
            pageId: `p-${sourceId}`,
            change: 'created',
            title: sourceId,
            path: sourceId,
          });
        }
        await importers.recordRunChange({
          runId,
          sourceId: 'a',
          pageId: 'p-a',
          change: 'updated',
          title: 'A',
          path: 'a',
        });
        const first = await importers.listRunChanges(runId, { limit: 2 });
        const rest = await importers.listRunChanges(runId, { after: first.next!, limit: 5 });
        const all = [...first.items, ...rest.items];
        expect(all.map(c => c.sourceId).sort()).toEqual(['a', 'm', 'z']);
        expect(all.find(c => c.sourceId === 'a')).toMatchObject({ change: 'updated', title: 'A' });
        expect(first.items[0]?.sourceId).toBe('z');
      });
    });

    describe('atomic with pages', () => {
      const flushInTx = async (
        scopeId: string,
        options: { abort?: boolean; hold?: Promise<void>; written?: () => void },
      ) =>
        fixture.store.transaction(async tx => {
          const imp = importersOf(tx);
          await imp.lockWriterGuard('share');
          const page = await tx.createPage({ parentId: scopeId, name: 'Imported', provenance: who });
          await imp.saveNode(node('src-1', page.id));
          await imp.setState('b1', { cursor: 'after-1' });
          await imp.recordRunChange({
            runId,
            sourceId: 'src-1',
            pageId: page.id,
            change: 'created',
            title: 'Imported',
            path: 'Imported',
          });
          await imp.recordFlush({ runId, generation: 1, seq: 1, digest: 'd1', receipt: { seq: 1 }, counts });
          options.written?.();
          await options.hold;
          if (options.abort) throw new Error('crash before commit');
          return page.id;
        });

      const observe = async () => {
        const seen = importersOf(fixture.reader);
        return {
          node: await seen.getNode('b1', 'src-1'),
          state: await seen.getState('b1'),
          flush: await seen.getFlush(runId, 1, 1),
          lastSeq: (await seen.getRun(runId))?.lastSeq,
          changes: (await seen.listRunChanges(runId)).items.length,
        };
      };
      const nothing = { node: null, state: {}, flush: null, lastSeq: 0, changes: 0 };

      const scope = async () =>
        (
          await fixture.store.materializeScope({
            address: 'org:acme',
            declaration: 'org:$orgId',
            name: 'Acme',
            provenance: who,
          })
        ).scope.id;

      it('rolls back page, node, state, change, flush and seq together', async () => {
        const scopeId = await scope();
        await start();
        await expect(flushInTx(scopeId, { abort: true })).rejects.toThrow('crash before commit');
        expect(await observe()).toEqual(nothing);
        expect(await fixture.reader.getPageByPath({ scopeId, path: ['Imported'], read: 'all' })).toBeNull();
        const pageId = await flushInTx(scopeId, {});
        expect(await observe()).toMatchObject({
          node: { pageId },
          state: { cursor: 'after-1' },
          lastSeq: 1,
          changes: 1,
        });
      });

      it('shows another connection nothing before commit', async ctx => {
        if (!fixture.concurrentTransactions) ctx.skip();
        const scopeId = await scope();
        await start();
        let release!: () => void;
        const hold = new Promise<void>(r => (release = r));
        let written!: () => void;
        const wrote = new Promise<void>(r => (written = r));
        const pending = flushInTx(scopeId, { hold, written });
        await wrote;
        expect(await observe()).toEqual(nothing);
        release();
        await pending;
        expect(await observe()).toMatchObject({ lastSeq: 1, changes: 1 });
      });
    });

    describe('namespace and provisioning', () => {
      it('keeps another namespace on the same database apart', async ctx => {
        if (!fixture.otherNamespace) ctx.skip();
        const other = importersOf(fixture.otherNamespace!);
        await other.dangerouslyClearAll();
        await other.registerBinding({ id: 'b1', importer: 'linear', target: 'org:other#linear' });
        await other.saveNode(node('a', 'other-page'));
        await other.setState('b1', { cursor: 'other' });
        await importers.saveNode(node('a', 'this-page'));
        await importers.setState('b1', { cursor: 'this' });
        await other.markFirstWrite();
        expect(await importers.getBinding('b1')).toMatchObject({ importer: 'notion' });
        expect((await importers.getNode('b1', 'a'))?.pageId).toBe('this-page');
        expect(await importers.getState('b1')).toEqual({ cursor: 'this' });
        expect((await importers.readWriterGuard()).firstWriteAt).toBeNull();
        expect((await other.getNode('b1', 'a'))?.pageId).toBe('other-page');
      });

      it('issues no DDL outside init: writes fail until the tables are provisioned', async ctx => {
        if (!fixture.unprovisioned) ctx.skip();
        const { store, importerTablesExist } = fixture.unprovisioned!;
        const unprovisioned = importersOf(store);
        await expect(
          unprovisioned.registerBinding({ id: 'b1', importer: 'notion', target: 'org:acme#notion' }),
        ).rejects.toThrow();
        await expect(unprovisioned.setState('b1', { cursor: 'c' })).rejects.toThrow();
        await expect(unprovisioned.readWriterGuard()).rejects.toThrow();
        expect(await importerTablesExist()).toBe(false);
        await unprovisioned.init();
        await unprovisioned.init();
        expect(await importerTablesExist()).toBe(true);
        expect(
          (await unprovisioned.registerBinding({ id: 'b1', importer: 'notion', target: 'org:acme#notion' })).status,
        ).toBe('created');
      });
    });
  });
}
