import {
  Knowledge,
  KnowledgeImporterHostConflictError,
  KnowledgeImporter,
  createKnowledgeImporterHost,
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

    it('rewrites resolved links to a page and its subtree when settling moves it under a late parent', async () => {
      const { knowledge, run, page } = setup();
      await run([
        upsert({
          sourceId: 'a',
          links: [
            { sourceId: 'b', rel: 'see' },
            { sourceId: 'c', rel: 'deep' },
          ],
        }),
        upsert({ sourceId: 'b', parent: 'p' }),
        upsert({ sourceId: 'c', parent: 'b' }),
      ]);
      expect((await page('notion/a'))?.body).toBe(
        'body of a\n\nLinks:\n- deep: [[docs:acme#notion/b/c]]\n- see: [[docs:acme#notion/b]]',
      );

      // a isn't sent again; settling b under p moves c with it.
      expect(await run([upsert({ sourceId: 'p' })])).toMatchObject({ outcome: 'succeeded', counts: { moved: 1 } });
      const linker = await page('notion/a');
      expect(linker?.body).toBe(
        'body of a\n\nLinks:\n- deep: [[docs:acme#notion/p/b/c]]\n- see: [[docs:acme#notion/p/b]]',
      );
      const storage = await knowledge.getStorage();
      const moved = [(await page('notion/p/b'))!.id, (await page('notion/p/b/c'))!.id];
      for (const id of moved) expect(await storage.listPageBodyLinkSources({ toPageIds: [id] })).toContain(linker!.id);
      expect(await run([upsert({ sourceId: 'p' })])).toMatchObject({ counts: { unchanged: 1, moved: 0, updated: 0 } });
    });

    it('repairs linking pages that sort before the settle cursor when settling moves their target past the cap', async () => {
      const { knowledge, run, page } = setup();
      const linkers = Array.from({ length: 105 }, (_, i) =>
        upsert({ sourceId: `a${String(i).padStart(3, '0')}`, links: [{ sourceId: 'b' }] }),
      );
      await run([...linkers, upsert({ sourceId: 'b', parent: 'p' }), upsert({ sourceId: 'orphan', parent: 'never' })]);

      // Settling b under p happens after the cursor has passed a000–a104; the same run goes back for
      // them once, and still finishes with the orphan whose parent never arrives left waiting.
      expect(await run([upsert({ sourceId: 'p' })])).toMatchObject({ outcome: 'succeeded', chain: false });
      for (const { item } of linkers as Extract<KnowledgeImporterOp, { op: 'upsert' }>[]) {
        expect((await page(`notion/${item.sourceId}`))?.body).toBe(
          `body of ${item.sourceId}\n\nLinks:\n- [[docs:acme#notion/p/b]]`,
        );
      }
      const storage = await knowledge.getStorage();
      expect((await storage.importers!.listNodes('b1', { unsettled: true })).items.map(n => n.sourceId)).toEqual([
        'orphan',
      ]);
      expect(await run([])).toMatchObject({ outcome: 'succeeded', chain: false, counts: { moved: 0, updated: 0 } });
    });

    it('goes back for deferred linkers when the settle slice that moved their target ends at its move cap', async () => {
      const { knowledge, run, page } = setup();
      const linkers = Array.from({ length: 105 }, (_, i) =>
        upsert({ sourceId: `a${String(i).padStart(3, '0')}`, links: [{ sourceId: 'b' }] }),
      );
      // b and z000–z049 wait for p: 51 moves, so the slice that moves b stops at the 50-move cap with
      // z049 still ahead of its cursor.
      const waiting = Array.from({ length: 50 }, (_, i) =>
        upsert({ sourceId: `z${String(i).padStart(3, '0')}`, parent: 'p' }),
      );
      await run([...linkers, upsert({ sourceId: 'b', parent: 'p' }), ...waiting]);

      expect(await run([upsert({ sourceId: 'p' })])).toMatchObject({ outcome: 'succeeded' });
      for (const { item } of linkers as Extract<KnowledgeImporterOp, { op: 'upsert' }>[]) {
        expect((await page(`notion/${item.sourceId}`))?.body).toBe(
          `body of ${item.sourceId}\n\nLinks:\n- [[docs:acme#notion/p/b]]`,
        );
      }
      expect(await page('notion/p/z049')).toBeTruthy();
      const storage = await knowledge.getStorage();
      expect((await storage.importers!.listNodes('b1', { unsettled: true })).items).toEqual([]);
    }, 30_000);

    it('counts a page that links into its own subtree when deciding whether a move left linkers behind', async () => {
      const { knowledge, run, page } = setup();
      // The linking list's first 101 are a000–a099 and b itself; c000 is the 101st other linker.
      const linkers = [...Array.from({ length: 100 }, (_, i) => `a${String(i).padStart(3, '0')}`), 'c000'].map(
        sourceId => upsert({ sourceId, links: [{ sourceId: 'b' }] }),
      );
      await run([...linkers, upsert({ sourceId: 'b', parent: 'p', links: [{ sourceId: 'b' }] })]);

      expect(await run([upsert({ sourceId: 'p' })])).toMatchObject({ outcome: 'succeeded' });
      for (const { item } of linkers as Extract<KnowledgeImporterOp, { op: 'upsert' }>[]) {
        expect((await page(`notion/${item.sourceId}`))?.body).toBe(
          `body of ${item.sourceId}\n\nLinks:\n- [[docs:acme#notion/p/b]]`,
        );
      }
      const storage = await knowledge.getStorage();
      expect((await storage.importers!.listNodes('b1', { unsettled: true })).items).toEqual([]);
    }, 30_000);

    it('rewrites resolved links to a page the source moved to another parent', async () => {
      const { run, page } = setup();
      await run([
        upsert({ sourceId: 'p1' }),
        upsert({ sourceId: 'p2' }),
        upsert({ sourceId: 'b', parent: 'p1' }),
        upsert({ sourceId: 'a', links: [{ sourceId: 'b' }] }),
      ]);
      expect((await page('notion/a'))?.body).toBe('body of a\n\nLinks:\n- [[docs:acme#notion/p1/b]]');

      expect(await run([upsert({ sourceId: 'b', parent: 'p2' })])).toMatchObject({
        outcome: 'succeeded',
        counts: { moved: 1, updated: 1 },
      });
      expect((await page('notion/a'))?.body).toBe('body of a\n\nLinks:\n- [[docs:acme#notion/p2/b]]');
      expect(await run([upsert({ sourceId: 'b', parent: 'p2' })])).toMatchObject({
        counts: { unchanged: 1, moved: 0, updated: 0 },
      });
    });

    it("keeps a source's own Links: text byte for byte when links are rewritten or resolved", async () => {
      const { run, page } = setup();
      const own = 'Links:\n- [[docs:acme#notion/p1/b]]\n\nImportant paragraph';
      await run([
        upsert({ sourceId: 'p1' }),
        upsert({ sourceId: 'p2' }),
        upsert({ sourceId: 'b', parent: 'p1' }),
        // Its own text names b's path, but it declares no links: the importer never rewrites it.
        upsert({ sourceId: 'a', body: own }),
        upsert({ sourceId: 'z', body: own, links: [{ sourceId: 'b' }] }),
        upsert({ sourceId: 'w', body: own, links: [{ sourceId: 'q' }] }),
      ]);
      expect((await page('notion/a'))?.body).toBe(own);
      expect((await page('notion/z'))?.body).toBe(`${own}\n\nLinks:\n- [[docs:acme#notion/p1/b]]`);
      expect((await page('notion/w'))?.body).toBe(own);

      // b moves and q arrives: z's links section follows b and w gains one, and neither touches the source's text.
      await run([upsert({ sourceId: 'b', parent: 'p2' }), upsert({ sourceId: 'q' })]);
      expect((await page('notion/a'))?.body).toBe(own);
      expect((await page('notion/z'))?.body).toBe(`${own}\n\nLinks:\n- [[docs:acme#notion/p2/b]]`);
      expect((await page('notion/w'))?.body).toBe(`${own}\n\nLinks:\n- [[docs:acme#notion/q]]`);
    });

    it('repairs the linking page a binding owns however many other pages link to the moved page', async () => {
      const { knowledge, run, page } = setup();
      await run([upsert({ sourceId: 'p1' }), upsert({ sourceId: 'p2' }), upsert({ sourceId: 'b', parent: 'p1' })]);
      // 101 human pages link to b, and every one of their IDs sorts before any page the importer creates.
      const storage = await knowledge.getStorage();
      const [scope] = await storage.getScopesByAddress(['docs:acme']);
      for (let i = 0; i <= 100; i++) {
        await storage.createPage({
          id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
          parentId: scope!.id,
          key: `human-${i}`,
          name: `Human ${i}`,
          body: 'See [[docs:acme#notion/p1/b]]',
          provenance: { author: 'human' },
        });
      }
      await knowledge.reindexLinks();
      await run([upsert({ sourceId: 'a', links: [{ sourceId: 'b' }] })]);

      expect(await run([upsert({ sourceId: 'b', parent: 'p2' })])).toMatchObject({
        outcome: 'succeeded',
        counts: { moved: 1, updated: 1 },
      });
      expect((await page('notion/a'))?.body).toBe('body of a\n\nLinks:\n- [[docs:acme#notion/p2/b]]');
      expect((await page('human-0'))?.body).toBe('See [[docs:acme#notion/p1/b]]');
    });

    it('repairs linking pages past the per-move cap in the settle work that follows', async () => {
      const { knowledge, run, page } = setup();
      const linkers = Array.from({ length: 105 }, (_, i) =>
        upsert({ sourceId: `l${String(i).padStart(3, '0')}`, links: [{ sourceId: 'b' }] }),
      );
      await run([
        upsert({ sourceId: 'p1' }),
        upsert({ sourceId: 'p2' }),
        upsert({ sourceId: 'b', parent: 'p1' }),
        ...linkers,
      ]);
      expect((await page('notion/l104'))?.body).toBe('body of l104\n\nLinks:\n- [[docs:acme#notion/p1/b]]');

      expect(await run([upsert({ sourceId: 'b', parent: 'p2' })])).toMatchObject({
        outcome: 'succeeded',
        counts: { moved: 1, updated: 105 },
      });
      for (const { item } of linkers as Extract<KnowledgeImporterOp, { op: 'upsert' }>[]) {
        expect((await page(`notion/${item.sourceId}`))?.body).toBe(
          `body of ${item.sourceId}\n\nLinks:\n- [[docs:acme#notion/p2/b]]`,
        );
      }
      const storage = await knowledge.getStorage();
      expect((await storage.importers!.listNodes('b1', { unsettled: true })).items).toEqual([]);
      expect(await run([upsert({ sourceId: 'b', parent: 'p2' })])).toMatchObject({
        counts: { unchanged: 1, moved: 0, updated: 0 },
      });
    });

    it('a declare of a linker whose repair a move deferred still repairs it', async () => {
      const { knowledge, run, page } = setup();
      const linkers = Array.from({ length: 105 }, (_, i) =>
        upsert({ sourceId: `l${String(i).padStart(3, '0')}`, links: [{ sourceId: 'b' }] }),
      );
      await run([
        upsert({ sourceId: 'p1' }),
        upsert({ sourceId: 'p2' }),
        upsert({ sourceId: 'b', parent: 'p1' }),
        ...linkers,
      ]);
      // The move rewrites l000–l099 and defers the rest; l104 is declared, unchanged, before settle reaches it.
      expect(
        await run([
          upsert({ sourceId: 'b', parent: 'p2' }),
          { op: 'declare', item: { sourceId: 'l104', title: 'L104' } },
        ]),
      ).toMatchObject({ outcome: 'succeeded' });
      await run([]);
      expect((await page('notion/l104'))?.body).toBe('body of l104\n\nLinks:\n- [[docs:acme#notion/p2/b]]');
      const storage = await knowledge.getStorage();
      expect((await storage.importers!.listNodes('b1', { unsettled: true })).items).toEqual([]);
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

    it("takes over a page someone else wrote at an item's path, keeping its id, and lands the rest of the flush", async () => {
      const { knowledge, run, page } = setup();
      await run([upsert({ sourceId: 'p1' })]);
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'notion/p2', name: 'Human', body: 'mine' });
      const human = await page('notion/p2');
      const receipt = await run([upsert({ sourceId: 'p2' }), upsert({ sourceId: 'p3' })]);
      expect(receipt).toMatchObject({ counts: { created: 1, updated: 1, refused: 0 } });
      const taken = await page('notion/p2');
      expect(taken).toMatchObject({ id: human!.id, name: 'P2', body: 'body of p2' });
      expect(await page('notion/p3')).toBeTruthy();

      // It is owned now: the next run updates it like any page the binding created.
      const again = await run([upsert({ sourceId: 'p2', body: 'newer' })]);
      expect(again).toMatchObject({ counts: { updated: 1, refused: 0 } });
      expect((await page('notion/p2'))?.body).toBe('newer');
    });

    it('never deletes a page it took over: removed from the source, it is kept as a stub', async () => {
      const { knowledge, run, page } = setup();
      await run([upsert({ sourceId: 'p1' })]);
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'notion/p2', name: 'Human', body: 'mine' });
      const human = await page('notion/p2');
      await run([upsert({ sourceId: 'p2' })]);

      const removed = await run([
        { op: 'remove', sourceId: 'p2' },
        { op: 'remove', sourceId: 'p1' },
      ]);
      expect(removed).toMatchObject({ counts: { stubbed: 1, removed: 1, refused: 0 } });
      expect(await page('notion/p1')).toBeNull();
      expect(await page('notion/p2')).toMatchObject({
        id: human!.id,
        body: 'Removed from the source. Kept because the page was here before the import.',
      });

      // A stub it took over comes back to life when the source sends the item again.
      const back = await run([upsert({ sourceId: 'p2', body: 'back' })]);
      expect(back).toMatchObject({ counts: { updated: 1, refused: 0 } });
      expect(await page('notion/p2')).toMatchObject({ id: human!.id, body: 'back' });
    });

    it('writes an item again after someone deleted its page by hand, and lets its removal through', async () => {
      const { knowledge, run, page } = setup();
      await run([upsert({ sourceId: 'p1' }), upsert({ sourceId: 'c1', parent: 'p1' }), upsert({ sourceId: 'p2' })]);
      const old = await page('notion/p1/c1');
      await knowledge.removePage({ scope: 'docs:acme', path: 'notion/p1/c1' });
      await knowledge.removePage({ scope: 'docs:acme', path: 'notion/p1' });
      await knowledge.removePage({ scope: 'docs:acme', path: 'notion/p2' });

      // The child arrives alone first: its parent's page is gone too, so it waits under the target.
      const child = await run([upsert({ sourceId: 'c1', parent: 'p1', body: 'back' })]);
      expect(child).toMatchObject({ counts: { created: 1, refused: 0 } });
      expect((await page('notion/c1'))?.body).toBe('back');
      expect((await page('notion/c1'))?.id).not.toBe(old!.id);

      // The parent comes back and the child settles under it.
      const parent = await run([upsert({ sourceId: 'p1' })]);
      expect(parent).toMatchObject({ counts: { created: 1, refused: 0 } });
      expect((await page('notion/p1/c1'))?.body).toBe('back');

      // A hand-deleted page whose item the source removes: nothing to do, and nothing refused.
      const removed = await run([{ op: 'remove', sourceId: 'p2' }]);
      expect(removed).toMatchObject({ counts: { removed: 0, refused: 0 } });
      const resent = await run([upsert({ sourceId: 'p2' })]);
      expect(resent).toMatchObject({ counts: { created: 1, refused: 0 } });
    });

    it("refuses an item whose path holds another binding's page, and never takes it over", async () => {
      const { knowledge, run, page } = setup([
        { id: 'b1', target: 'docs:acme#notion' },
        { id: 'b2', target: 'docs:acme#linear' },
      ]);
      await run([upsert({ sourceId: 'p1' })]);
      await run([upsert({ sourceId: 'p2' })], 'b2');
      // A human moves b2's page to where b1's item p2 goes.
      await knowledge.movePage({ scope: 'docs:acme', path: 'linear/p2', parent: 'notion' });
      const receipt = await run([upsert({ sourceId: 'p2', body: 'from b1' })]);
      expect(receipt).toMatchObject({ counts: { created: 0, updated: 0, refused: 1 } });
      expect((await page('notion/p2'))?.body).toBe('body of p2');
      const b2 = await run([upsert({ sourceId: 'p2', body: 'from b2' })], 'b2');
      expect(b2).toMatchObject({ counts: { refused: 1 } });
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

  describe('importer host conformance (strict-lease service host)', () => {
    for (const c of importerHostConformance(async () => ({
      host: createKnowledgeImporterHost(new Knowledge({ scopes: { 'docs:$orgId': {} }, storage: fixture.storage }), {
        leaseMs: 90_000,
        bindings: [{ id: 'b1', importer: 'notes', target: 'docs:acme#notion', settings: {}, credentials: {} }],
      }),
      bindingId: 'b1',
    }))) {
      it(c.name, c.run);
    }
  });
}
