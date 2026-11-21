import {
  Knowledge,
  KnowledgeImporterHostConflictError,
  KnowledgeImporter,
  importerHostConformance,
  knowledgeImporterFlushDigest,
} from '@mastra/core/knowledge';
import type {
  KnowledgeImporterContext,
  KnowledgeImporterHost,
  KnowledgeImportItem,
  KnowledgeImporterOp,
} from '@mastra/core/knowledge';
import type { MastraCompositeStore } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

export interface KnowledgeImporterHostFixture {
  /** A store whose Knowledge domain is provisioned (pages and importer tables) and empty. */
  storage: MastraCompositeStore;
  cleanup(): Promise<void>;
}

/**
 * The local importer host (r347 O3) end to end through `knowledge.importers`: placement, ownership
 * refusals, stubs, replay and finish rules. Each test gets a fresh, provisioned store.
 */
export function createKnowledgeImporterHostTests(createFixture: () => Promise<KnowledgeImporterHostFixture>): void {
  let fixture: KnowledgeImporterHostFixture;
  beforeEach(async () => {
    fixture = await createFixture();
  });
  afterEach(async () => {
    await fixture.cleanup();
  });

  function setup(bindings: { id: string; target: string }[] = [{ id: 'b1', target: 'docs:acme#notion' }]) {
    let ops: KnowledgeImporterOp[] = [];
    class Notes extends KnowledgeImporter({ id: 'notes', label: 'Notes' }) {
      async import(ctx: KnowledgeImporterContext<Record<string, never>, never>) {
        for (const op of ops) {
          if (op.op === 'upsert') await ctx.items.upsert(op.item);
          else if (op.op === 'declare') await ctx.items.declare(op.item);
          else await ctx.items.remove(op.sourceId);
        }
      }
    }
    const knowledge = new Knowledge({
      scopes: { 'docs:$orgId': {} },
      storage: fixture.storage,
      importers: bindings.map(b => new Notes(b)),
    });
    const run = async (next: KnowledgeImporterOp[], bindingId = 'b1') => {
      ops = next;
      return knowledge.importers!.run(bindingId);
    };
    const page = async (path: string) => {
      const storage = await knowledge.getStorage();
      const [scope] = await storage.getScopesByAddress(['docs:acme']);
      return scope ? storage.getPageByPath({ scopeId: scope.id, path: path.split('/'), read: 'all' }) : null;
    };
    return { knowledge, run, page };
  }

  const upsert = (item: Partial<KnowledgeImportItem> & { sourceId: string }): KnowledgeImporterOp => ({
    op: 'upsert',
    item: { title: item.sourceId.toUpperCase(), body: `body of ${item.sourceId}`, ...item },
  });

  async function flushOnce(
    host: KnowledgeImporterHost,
    runId: string,
    generation: number,
    seq: number,
    ops: KnowledgeImporterOp[],
  ) {
    const digest = await knowledgeImporterFlushDigest({ ops });
    return host.flush({ runId, generation, seq, digest, ops });
  }

  describe('local importer host', () => {
    it('creates the anchor, places children under parents that arrive later in the flush, and links them', async () => {
      const { run, page } = setup();
      const receipt = await run([
        upsert({ sourceId: 'c1', parent: 'p1', links: [{ sourceId: 'p1', rel: 'up' }] }),
        upsert({ sourceId: 'p1' }),
      ]);
      expect(receipt).toMatchObject({ outcome: 'succeeded', counts: { created: 2, refused: 0 } });
      expect((await page('notion'))?.name).toBe('notion');
      const child = await page('notion/p1/c1');
      expect(child?.name).toBe('C1');
      expect(child?.body).toBe('body of c1\n\nLinks:\n- up: [[docs:acme#notion/p1]]');
    });

    it('settles pages whose parent and link targets arrive in a later run, a bounded slice at a time', async () => {
      const { run, page } = setup();
      const children = Array.from({ length: 60 }, (_, i) =>
        upsert({ sourceId: `c${String(i).padStart(2, '0')}`, parent: 'p', links: [{ sourceId: 'p', rel: 'up' }] }),
      );
      expect(await run(children)).toMatchObject({ outcome: 'succeeded', chain: false, counts: { created: 60 } });
      expect((await page('notion/c00'))?.body).toBe('body of c00');

      // The parent's flush settles 50 and leaves the rest pending; the runner drains it with an empty flush.
      expect(await run([upsert({ sourceId: 'p' })])).toMatchObject({
        outcome: 'succeeded',
        chain: false,
        counts: { created: 1, moved: 60 },
      });
      expect(await page('notion/c00')).toBeNull();
      expect((await page('notion/p/c59'))?.body).toBe('body of c59\n\nLinks:\n- up: [[docs:acme#notion/p]]');
      expect(await run([upsert({ sourceId: 'p' })])).toMatchObject({ counts: { unchanged: 1, moved: 0, updated: 0 } });
    });

    it('a later run that imports nothing still finishes settle work an earlier run left', async () => {
      const { knowledge, run, page } = setup();
      const host = knowledge.importers!.host;
      const first = await host.startRun('b1');
      if (first.status !== 'started') throw new Error('not started');
      const children = Array.from({ length: 60 }, (_, i) =>
        upsert({ sourceId: `c${String(i).padStart(2, '0')}`, parent: 'p', links: [{ sourceId: 'p', rel: 'up' }] }),
      );
      await flushOnce(host, first.runId, first.generation, 1, children);
      // The parent arrives and settles 50; the run ends there, with 10 left.
      expect(await flushOnce(host, first.runId, first.generation, 2, [upsert({ sourceId: 'p' })])).toMatchObject({
        moved: 50,
        pending: true,
      });
      await host.finishRun({
        runId: first.runId,
        generation: first.generation,
        outcome: 'succeeded',
        backlog: false,
        lastSeq: 2,
      });
      const left = (await (await knowledge.getStorage()).importers!.listNodes('b1', { unsettled: true })).items;
      expect(left).toHaveLength(10);

      // An incremental importer with nothing new: no items, no state.
      expect(await run([])).toMatchObject({ outcome: 'succeeded', chain: false, counts: { moved: 10 } });
      expect(await page('notion/c59')).toBeNull();
      expect((await page('notion/p/c59'))?.body).toBe('body of c59\n\nLinks:\n- up: [[docs:acme#notion/p]]');
      expect((await (await knowledge.getStorage()).importers!.listNodes('b1', { unsettled: true })).items).toEqual([]);
    });

    it('a run that imports nothing does not chain on a parent that never arrives', async () => {
      const { run, page } = setup();
      await run([upsert({ sourceId: 'orphan', parent: 'never' })]);
      expect(await run([])).toMatchObject({ outcome: 'succeeded', chain: false, counts: { moved: 0 } });
      expect(await page('notion/orphan')).toBeTruthy();
    });

    it('escapes source IDs into keys and writes nothing on an unchanged rerun', async () => {
      const { run, page } = setup();
      await run([upsert({ sourceId: 'a/b:c' })]);
      const first = await page('notion/a~2Fb~3Ac');
      expect(first).toBeTruthy();
      const again = await run([upsert({ sourceId: 'a/b:c' })]);
      expect(again).toMatchObject({ counts: { created: 0, updated: 0, unchanged: 1 } });
      expect((await page('notion/a~2Fb~3Ac'))?.version).toBe(first!.version);
    });

    it('refuses every op when an unowned page already sits at the target, and never adopts it', async () => {
      const { knowledge, run, page } = setup();
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'notion', name: 'Mine', body: 'human' });
      const receipt = await run([upsert({ sourceId: 'p1' })]);
      expect(receipt).toMatchObject({ outcome: 'succeeded', counts: { created: 0, refused: 1 } });
      expect(await page('notion/p1')).toBeNull();
      expect((await page('notion'))?.body).toBe('human');
    });

    it('refuses an item whose path a human page holds, and lands the rest of the flush', async () => {
      const { knowledge, run, page } = setup();
      await run([upsert({ sourceId: 'p1' })]);
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'notion/p2', name: 'Human', body: 'mine' });
      const receipt = await run([upsert({ sourceId: 'p2' }), upsert({ sourceId: 'p3' })]);
      expect(receipt).toMatchObject({ counts: { created: 1, refused: 1 } });
      expect((await page('notion/p2'))?.body).toBe('mine');
      expect(await page('notion/p3')).toBeTruthy();
    });

    it('refuses to touch an imported page a human moved out of the target', async () => {
      const { knowledge, run, page } = setup();
      await run([upsert({ sourceId: 'p1' })]);
      await knowledge.movePage({ scope: 'docs:acme', path: 'notion/p1', parent: '' });
      const receipt = await run([upsert({ sourceId: 'p1', body: 'new' })]);
      expect(receipt).toMatchObject({ counts: { updated: 0, refused: 1 } });
      expect((await page('p1'))?.body).toBe('body of p1');
    });

    it('refuses every op after the anchor moved away from its configured path', async () => {
      const { knowledge, run } = setup();
      await run([upsert({ sourceId: 'p1' })]);
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'archive', name: 'Archive' });
      await knowledge.movePage({ scope: 'docs:acme', path: 'notion', parent: 'archive' });
      const receipt = await run([upsert({ sourceId: 'p2' })]);
      expect(receipt).toMatchObject({ counts: { created: 0, refused: 1 } });
    });

    it('stubs a removed item with children, deletes a leaf, and removes a parent with its children child-first', async () => {
      const { run, page } = setup();
      await run([
        upsert({ sourceId: 'p1' }),
        upsert({ sourceId: 'c1', parent: 'p1' }),
        upsert({ sourceId: 'p2' }),
        upsert({ sourceId: 'c2', parent: 'p2' }),
      ]);
      const stubbed = await run([{ op: 'remove', sourceId: 'p1' }]);
      expect(stubbed).toMatchObject({ counts: { stubbed: 1, removed: 0 } });
      expect((await page('notion/p1'))?.body).toBe(
        'Removed from the source. Kept because pages are still nested under it.',
      );
      const both = await run([
        { op: 'remove', sourceId: 'p2' },
        { op: 'remove', sourceId: 'c2' },
      ]);
      expect(both).toMatchObject({ counts: { removed: 2, stubbed: 0 } });
      expect(await page('notion/p2')).toBeNull();
      const unknown = await run([{ op: 'remove', sourceId: 'never-seen' }]);
      expect(unknown).toMatchObject({ counts: { removed: 0, refused: 0 } });
    });

    it('a declare places an item without blanking the body an upsert wrote', async () => {
      const { run, page } = setup();
      await run([upsert({ sourceId: 'p1' })]);
      await run([{ op: 'declare', item: { sourceId: 'p1', title: 'Renamed' } }]);
      expect(await page('notion/p1')).toMatchObject({ name: 'Renamed', body: 'body of p1' });
    });

    it('replays a committed flush to its stored receipt without applying it again, and refuses other content for that seq', async () => {
      const { knowledge, page } = setup();
      const host = knowledge.importers!.host;
      const started = await host.startRun('b1');
      if (started.status !== 'started') throw new Error('not started');
      const ops = [upsert({ sourceId: 'p1' })];
      const first = await flushOnce(host, started.runId, started.generation, 1, ops);
      const version = (await page('notion/p1'))!.version;
      const replay = await flushOnce(host, started.runId, started.generation, 1, ops);
      expect(replay).toEqual(first);
      expect((await page('notion/p1'))!.version).toBe(version);

      const changed = [upsert({ sourceId: 'p1', body: 'other' })];
      const originalDigest = await knowledgeImporterFlushDigest({ ops });
      await expect(
        host.flush({
          runId: started.runId,
          generation: started.generation,
          seq: 1,
          digest: originalDigest,
          ops: changed,
        }),
      ).rejects.toMatchObject({ code: 'digest_mismatch' });
      await expect(flushOnce(host, started.runId, started.generation, 1, changed)).rejects.toMatchObject({
        code: 'digest_mismatch',
      });
      await expect(flushOnce(host, started.runId, started.generation, 3, ops)).rejects.toMatchObject({
        code: 'seq_mismatch',
      });
    });

    it('commits state with its flush, and replays a finish exactly once recorded', async () => {
      const { knowledge } = setup();
      const host = knowledge.importers!.host;
      const started = await host.startRun('b1');
      if (started.status !== 'started') throw new Error('not started');
      const ops = [upsert({ sourceId: 'p1' })];
      const digest = await knowledgeImporterFlushDigest({ ops, state: { cursor: 'c1' } });
      await host.flush({
        runId: started.runId,
        generation: started.generation,
        seq: 1,
        digest,
        ops,
        state: { cursor: 'c1' },
      });
      const request = {
        runId: started.runId,
        generation: started.generation,
        outcome: 'succeeded' as const,
        backlog: false,
        lastSeq: 1,
      };
      const receipt = await host.finishRun(request);
      expect(receipt.counts.created).toBe(1);
      expect(await host.finishRun(request)).toEqual(receipt);
      await expect(host.finishRun({ ...request, backlog: true })).rejects.toBeInstanceOf(
        KnowledgeImporterHostConflictError,
      );
      await expect(flushOnce(host, started.runId, started.generation, 2, ops)).rejects.toMatchObject({
        code: 'run_not_active',
      });
      const next = await host.startRun('b1');
      expect(next).toMatchObject({ status: 'started', state: { cursor: 'c1' }, lastSeq: 0 });
    });

    it("refuses to move or stub a page whose subtree holds another binding's page, and moves human children", async () => {
      const { knowledge, run, page } = setup([
        { id: 'b1', target: 'docs:acme#notion' },
        { id: 'b2', target: 'docs:acme#linear' },
      ]);
      await run([upsert({ sourceId: 'l1' })], 'b2');
      await run([upsert({ sourceId: 'p1' }), upsert({ sourceId: 'p2' }), upsert({ sourceId: 'p3' })]);
      // A human puts b2's page under b1's p1, and their own page under p3.
      await knowledge.movePage({ scope: 'docs:acme', path: 'linear/l1', parent: 'notion/p1' });
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'notion/p3/mine', name: 'Mine', body: 'human' });

      const move = await run([upsert({ sourceId: 'p1', parent: 'p2' })]);
      expect(move).toMatchObject({ counts: { moved: 0, refused: 1 } });
      expect(await page('notion/p1/l1')).toBeTruthy();
      expect(await page('notion/p2/p1')).toBeNull();

      const remove = await run([{ op: 'remove', sourceId: 'p1' }]);
      expect(remove).toMatchObject({ counts: { stubbed: 0, removed: 0, refused: 1 } });
      expect((await page('notion/p1'))?.body).toBe('body of p1');

      const human = await run([upsert({ sourceId: 'p3', parent: 'p2' })]);
      expect(human).toMatchObject({ counts: { moved: 1, refused: 0 } });
      expect((await page('notion/p2/p3/mine'))?.body).toBe('human');
    });

    it('reclaims a run past its deadline at the next start, and refuses its runner after that', async () => {
      const { knowledge } = setup();
      const host = knowledge.importers!.host;
      const orphan = await host.startRun('b1', { deadline: Date.now() + 1500 });
      if (orphan.status !== 'started') throw new Error('not started');
      const ops = [upsert({ sourceId: 'p1' })];
      const committed = await flushOnce(host, orphan.runId, orphan.generation, 1, ops);
      await new Promise(resolve => setTimeout(resolve, 1600));

      const next = await host.startRun('b1');
      expect(next.status).toBe('started');
      const storage = await knowledge.getStorage();
      expect(await storage.importers!.getRun(orphan.runId)).toMatchObject({
        status: 'failed',
        finish: { outcome: 'failed', lastSeq: 1, error: { code: 'stopped' } },
      });
      // Its runner is fenced, but can still learn what it committed.
      expect(await flushOnce(host, orphan.runId, orphan.generation, 1, ops)).toEqual(committed);
      await expect(
        flushOnce(host, orphan.runId, orphan.generation, 2, [upsert({ sourceId: 'p2' })]),
      ).rejects.toMatchObject({ status: 409, code: 'run_not_active' });
      await expect(
        host.finishRun({
          runId: orphan.runId,
          generation: orphan.generation,
          outcome: 'succeeded',
          backlog: false,
          lastSeq: 1,
        }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('reclaims a run whose heartbeat went stale, and never one whose runner is alive', async () => {
      const { knowledge } = setup();
      const host = knowledge.importers!.host;
      const live = await host.startRun('b1');
      if (live.status !== 'started') throw new Error('not started');
      await host.heartbeat(live.runId, live.generation);
      expect((await host.startRun('b1')).status).toBe('skipped');
      const storage = await knowledge.getStorage();
      expect((await storage.importers!.getRun(live.runId))?.status).toBe('running');

      // Six minutes on, with no heartbeat since: past the 5-minute default.
      vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 6 * 60_000 });
      try {
        const next = await host.startRun('b1');
        expect(next.status).toBe('started');
        expect(await storage.importers!.getRun(live.runId)).toMatchObject({
          status: 'failed',
          finish: { error: { code: 'stopped' } },
        });
        expect(await host.heartbeat(live.runId, live.generation)).toEqual({ cancel: true });
      } finally {
        vi.useRealTimers();
      }
    });

    it('rolls the whole flush back, receipt included, when the sink fails unexpectedly', async () => {
      const { knowledge, page } = setup();
      const host = knowledge.importers!.host;
      const started = await host.startRun('b1');
      if (started.status !== 'started') throw new Error('not started');
      const ops = [upsert({ sourceId: 'p1' }), upsert({ sourceId: 'p2' })];

      // Every transaction view shares the store's prototype, so this reaches the flush's writes.
      const proto = Object.getPrototypeOf(await knowledge.getStorage()) as {
        replacePageBodyLinks: (...args: unknown[]) => Promise<void>;
      };
      const original = proto.replacePageBodyLinks;
      let calls = 0;
      const spy = vi.spyOn(proto, 'replacePageBodyLinks').mockImplementation(function (this: unknown, ...args) {
        if (++calls === 2) return Promise.reject(new Error('link index is down'));
        return original.apply(this, args);
      });
      try {
        await expect(flushOnce(host, started.runId, started.generation, 1, ops)).rejects.toThrow();
      } finally {
        spy.mockRestore();
      }
      expect(calls).toBe(2);
      expect(await page('notion')).toBeNull();
      expect(await page('notion/p1')).toBeNull();

      // Nothing was recorded for seq 1, so the resend applies it rather than replaying a receipt.
      const resent = await flushOnce(host, started.runId, started.generation, 1, ops);
      expect(resent).toMatchObject({ seq: 1, created: 2 });
      expect(await page('notion/p2')).toBeTruthy();
    });

    it('refuses a binding whose target nests inside another', async () => {
      const { run } = setup([
        { id: 'b1', target: 'docs:acme#notion' },
        { id: 'b2', target: 'docs:acme#notion/inner' },
      ]);
      await expect(run([upsert({ sourceId: 'p1' })], 'b2')).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('importer host conformance (local host)', () => {
    // Each case gets the fresh store from beforeEach; the suite's own cleanup runs in afterEach.
    for (const c of importerHostConformance(async () => ({
      host: setup().knowledge.importers!.host,
      bindingId: 'b1',
    }))) {
      it(c.name, c.run);
    }
  });
}
