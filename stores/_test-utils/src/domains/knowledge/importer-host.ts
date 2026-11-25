import {
  Knowledge,
  KnowledgeImporterHostConflictError,
  KnowledgeImporter,
  createKnowledgeImporterHost,
  importerHostConformance,
  knowledgeImporterFlushDigest,
} from '@mastra/core/knowledge';
import type {
  KnowledgeChangeEvent,
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

    it('tells change listeners about each page an import created, moved, updated or removed', async () => {
      const { knowledge, run, page } = setup();
      const events: KnowledgeChangeEvent[] = [];
      knowledge.onChange(event => events.push(event));
      const pages = () => events.flatMap(event => (event.kind === 'page' ? [`${event.op} ${event.pageId}`] : []));

      // The child arrives before its parent, so it waits under the target until the parent lands.
      await run([upsert({ sourceId: 'c1', parent: 'p1' })]);
      const anchor = (await page('notion'))!;
      const child = (await page('notion/c1'))!;
      expect(pages()).toEqual([`create ${anchor.id}`, `create ${child.id}`]);
      expect(events.filter(event => event.kind === 'page').every(event => event.scopeId === anchor.scopeId)).toBe(true);

      events.length = 0;
      await run([upsert({ sourceId: 'p1' })]);
      const parent = (await page('notion/p1'))!;
      expect(pages()).toEqual([`create ${parent.id}`, `move ${child.id}`]);

      // A refused op reports nothing; only the write that landed beside it does.
      events.length = 0;
      const mixed = await run([upsert({ sourceId: 'p1', parent: 'p1' }), upsert({ sourceId: 'p2' })]);
      expect(mixed).toMatchObject({ counts: { created: 1, refused: 1 } });
      expect(pages()).toEqual([`create ${(await page('notion/p2'))!.id}`]);

      events.length = 0;
      await run([upsert({ sourceId: 'p1', body: 'changed' })]);
      expect(pages()).toEqual([`update ${parent.id}`]);

      events.length = 0;
      await run([{ op: 'remove', sourceId: 'c1' }]);
      expect(pages()).toEqual([`delete ${child.id}`]);
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

    it('takes over a page someone wrote at the target as its folder, keeping its body and children', async () => {
      const { knowledge, run, page } = setup();
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'notion', name: 'Mine', body: 'human' });
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'notion/notes', name: 'Notes', body: 'kept' });
      const folder = await page('notion');
      const receipt = await run([upsert({ sourceId: 'p1' })]);
      expect(receipt).toMatchObject({ outcome: 'succeeded', counts: { created: 1, refused: 0 } });
      expect(await page('notion')).toMatchObject({ id: folder!.id, name: 'Mine', body: 'human' });
      expect((await page('notion/notes'))?.body).toBe('kept');
      expect((await page('notion/p1'))?.body).toBe('body of p1');
      const again = await run([upsert({ sourceId: 'p2' })]);
      expect(again).toMatchObject({ counts: { created: 1, refused: 0 } });
    });

    it("uses another binding's item page at its target as its folder, which stays that binding's item", async () => {
      const { knowledge, run, page } = setup([
        { id: 'b1', target: 'docs:acme#notion' },
        { id: 'b2', target: 'docs:acme#linear' },
      ]);
      await run([upsert({ sourceId: 'notion' })], 'b2');
      // A human moves b2's imported page to where b1's target goes.
      await knowledge.movePage({ scope: 'docs:acme', path: 'linear/notion', parent: '' });
      const moved = await page('notion');
      const receipt = await run([upsert({ sourceId: 'p1' })]);
      expect(receipt).toMatchObject({ outcome: 'succeeded', counts: { created: 1, refused: 0 } });
      expect(await page('notion')).toMatchObject({ id: moved!.id, body: 'body of notion' });
      expect((await page('notion/p1'))?.body).toBe('body of p1');
      // b2 still tracks it, and keeps updating it where the person put it.
      const again = await run([upsert({ sourceId: 'notion', body: 'b2 again' })], 'b2');
      expect(again).toMatchObject({ counts: { created: 0, updated: 1, refused: 0 } });
      expect(await page('notion')).toMatchObject({ id: moved!.id, body: 'b2 again' });
      expect(await page('linear/notion')).toBeNull();
      expect(await page('notion/p1')).toBeTruthy();
    });

    it("shares another binding's folder at its target, and both keep writing under it", async () => {
      const { knowledge, run, page } = setup([
        { id: 'b1', target: 'docs:acme#notion' },
        { id: 'b2', target: 'docs:acme#linear/notion' },
      ]);
      await run([upsert({ sourceId: 'l1' })], 'b2');
      // A human moves b2's folder to where b1's target goes.
      await knowledge.movePage({ scope: 'docs:acme', path: 'linear/notion', parent: '' });
      const folder = await page('notion');
      const receipt = await run([upsert({ sourceId: 'p1' })]);
      expect(receipt).toMatchObject({ outcome: 'succeeded', counts: { created: 1, refused: 0 } });
      expect((await page('notion'))?.id).toBe(folder!.id);
      expect(await page('notion/p1')).toBeTruthy();
      // b2's folder is pinned by id, so b2 keeps writing under it where the person moved it.
      const b2 = await run([upsert({ sourceId: 'l2' })], 'b2');
      expect(b2).toMatchObject({ counts: { created: 1, refused: 0 } });
      expect(await page('notion/l2')).toBeTruthy();
      expect(await page('linear/notion')).toBeNull();
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
      // Its hand-written body comes back.
      expect(await page('notion/p2')).toMatchObject({ id: human!.id, body: 'mine' });

      // A stub it took over comes back to life when the source sends the item again.
      const back = await run([upsert({ sourceId: 'p2', body: 'back' })]);
      expect(back).toMatchObject({ counts: { updated: 1, refused: 0 } });
      expect(await page('notion/p2')).toMatchObject({ id: human!.id, body: 'back' });
    });

    it('keeps the body it took over in a note, and leaves a page that had no body as a stub', async () => {
      const { knowledge, run, page } = setup();
      await knowledge.upsertPage({
        scope: 'docs:acme',
        path: 'notion/p1',
        name: 'Human',
        body: 'mine\n\nwith [[docs:acme#notion]]',
      });
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'notion/p2', name: 'Empty', body: '' });
      expect(await run([upsert({ sourceId: 'p1' }), upsert({ sourceId: 'p2' })])).toMatchObject({
        counts: { updated: 2, refused: 0 },
      });
      const storage = await knowledge.getStorage();
      const taken = await page('notion/p1');
      const { notes } = await storage.listNotes({ pageId: taken!.id, read: 'all' });
      expect(notes.map(n => n.text)).toEqual([
        'The body this page had before an importer took it over:\n\nmine\n\nwith [[docs:acme#notion]]',
      ]);
      expect(notes[0]!.mentions).toEqual([]);
      const empty = await page('notion/p2');
      expect((await storage.listNotes({ pageId: empty!.id, read: 'all' })).notes).toEqual([]);

      // A later resend still replaces the body, and keeps the one note.
      await run([upsert({ sourceId: 'p1', body: 'newer' })]);
      expect((await storage.listNotes({ pageId: taken!.id, read: 'all' })).notes).toHaveLength(1);

      expect(
        await run([
          { op: 'remove', sourceId: 'p1' },
          { op: 'remove', sourceId: 'p2' },
        ]),
      ).toMatchObject({
        counts: { stubbed: 2, removed: 0, refused: 0 },
      });
      expect((await page('notion/p1'))?.body).toBe('mine\n\nwith [[docs:acme#notion]]');
      expect((await page('notion/p2'))?.body).toBe(
        'Removed from the source. Kept because the page was here before the import.',
      );
    });

    it('keeps the hand-written body when a declare takes the page over and a later upsert writes it', async () => {
      const { knowledge, run, page } = setup();
      await run([upsert({ sourceId: 'p0' })]);
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'notion/p1', name: 'Human', body: 'mine' });
      const human = await page('notion/p1');
      const storage = await knowledge.getStorage();

      expect(await run([{ op: 'declare', item: { sourceId: 'p1', title: 'P1' } }])).toMatchObject({
        counts: { updated: 1, refused: 0 },
      });
      // Saved at the takeover itself, before any op sends a body.
      expect((await storage.listNotes({ pageId: human!.id, read: 'all' })).notes.map(n => n.text)).toEqual([
        'The body this page had before an importer took it over:\n\nmine',
      ]);

      await run([upsert({ sourceId: 'p1', body: 'imported' })]);
      expect((await page('notion/p1'))?.body).toBe('imported');

      expect(await run([{ op: 'remove', sourceId: 'p1' }])).toMatchObject({ counts: { stubbed: 1, refused: 0 } });
      expect(await page('notion/p1')).toMatchObject({ id: human!.id, body: 'mine' });
    });

    it('keeps the hand-written body when the takeover sends that same body', async () => {
      const { knowledge, run, page } = setup();
      await run([upsert({ sourceId: 'p0' })]);
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'notion/p1', name: 'Human', body: 'mine' });
      const human = await page('notion/p1');

      await run([upsert({ sourceId: 'p1', body: 'mine' })]);
      await run([upsert({ sourceId: 'p1', body: 'imported' })]);

      expect(await run([{ op: 'remove', sourceId: 'p1' }])).toMatchObject({ counts: { stubbed: 1, refused: 0 } });
      expect(await page('notion/p1')).toMatchObject({ id: human!.id, body: 'mine' });
    });

    it('takes over a hand-written page while its item waits for its parent, and keeps its body through the move', async () => {
      const { knowledge, run, page } = setup();
      await run([upsert({ sourceId: 'p0' })]);
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'notion/c1', name: 'Human', body: 'mine' });
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'notion/c1/h', name: 'Human child', body: 'kid' });
      const human = await page('notion/c1');

      // c1's parent hasn't arrived, so it waits at the target's root, where the hand-written page is.
      expect(await run([upsert({ sourceId: 'c1', parent: 'p1' })])).toMatchObject({
        counts: { updated: 1, refused: 0 },
      });
      expect(await page('notion/c1')).toMatchObject({ id: human!.id, body: 'body of c1' });

      // The parent arrives: the taken-over page moves under it with its human child.
      expect(await run([upsert({ sourceId: 'p1' })])).toMatchObject({ counts: { created: 1, refused: 0 } });
      expect(await page('notion/p1/c1')).toMatchObject({ id: human!.id, body: 'body of c1' });
      expect((await page('notion/p1/c1/h'))?.body).toBe('kid');

      // Removed from the source, it keeps its place and its hand-written body comes back.
      expect(await run([{ op: 'remove', sourceId: 'c1' }])).toMatchObject({ counts: { stubbed: 1, refused: 0 } });
      expect(await page('notion/p1/c1')).toMatchObject({ id: human!.id, body: 'mine' });
      expect((await page('notion/p1/c1/h'))?.body).toBe('kid');
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

    it("takes over an item path that holds another binding's page, and that binding stops tracking it", async () => {
      const { knowledge, run, page } = setup([
        { id: 'b1', target: 'docs:acme#notion' },
        { id: 'b2', target: 'docs:acme#linear' },
      ]);
      await run([upsert({ sourceId: 'p1' })]);
      await run([upsert({ sourceId: 'p2' })], 'b2');
      await knowledge.movePage({ scope: 'docs:acme', path: 'linear/p2', parent: 'notion' });
      const moved = (await page('notion/p2'))!;
      // A human moves b2's page to where b1's item p2 goes; b1 writes there.
      const receipt = await run([upsert({ sourceId: 'p2', body: 'from b1' })]);
      expect(receipt).toMatchObject({ counts: { created: 0, updated: 1, refused: 0 } });
      expect(await page('notion/p2')).toMatchObject({ id: moved.id, body: 'from b1' });
      const storage = await knowledge.getStorage();
      expect(await storage.importers!.getNode('b2', 'p2')).toBeNull();
      // b2 no longer tracks it, so its next p2 is a new page at its own path.
      expect(await run([upsert({ sourceId: 'p2', body: 'from b2' })], 'b2')).toMatchObject({
        counts: { created: 1, refused: 0 },
      });
      expect((await page('linear/p2'))?.body).toBe('from b2');
      expect((await page('notion/p2'))?.body).toBe('from b1');
      // b1 took it over, so removing p2 keeps the page (as a stub of its original body).
      expect(await run([{ op: 'remove', sourceId: 'p2' }])).toMatchObject({ counts: { stubbed: 1, removed: 0 } });
      expect((await page('notion/p2'))?.id).toBe(moved.id);
    });

    it('repairs links to a hand-deleted page that is written again under another parent', async () => {
      const { knowledge, run, page } = setup();
      await run([
        upsert({ sourceId: 'P' }),
        upsert({ sourceId: 'p1', parent: 'P' }),
        upsert({ sourceId: 'p2', links: [{ sourceId: 'p1' }] }),
      ]);
      expect((await page('notion/p2'))?.body).toBe('body of p2\n\nLinks:\n- [[docs:acme#notion/P/p1]]');
      await knowledge.removePage({ scope: 'docs:acme', path: 'notion/P/p1' });
      await knowledge.removePage({ scope: 'docs:acme', path: 'notion/P' });

      // p1 comes back while its parent is still gone: it waits at the target's root. p2 isn't resent.
      expect(await run([upsert({ sourceId: 'p1', parent: 'P' })])).toMatchObject({ outcome: 'succeeded' });
      const p1 = await page('notion/p1');
      expect((await page('notion/p2'))?.body).toBe('body of p2\n\nLinks:\n- [[docs:acme#notion/p1]]');
      const storage = await knowledge.getStorage();
      expect(await storage.listPageBodyLinkSources({ toPageIds: [p1!.id] })).toContain((await page('notion/p2'))!.id);

      // Its parent returns and it moves under it; p2 follows again.
      await run([upsert({ sourceId: 'P' })]);
      expect((await page('notion/P/p1'))?.id).toBe(p1!.id);
      expect((await page('notion/p2'))?.body).toBe('body of p2\n\nLinks:\n- [[docs:acme#notion/P/p1]]');
    });

    it('leaves links alone when a hand-deleted page is written again at the same path', async () => {
      const { knowledge, run, page } = setup();
      await run([upsert({ sourceId: 'p1' }), upsert({ sourceId: 'p2', links: [{ sourceId: 'p1' }] })]);
      const p2 = await page('notion/p2');
      await knowledge.removePage({ scope: 'docs:acme', path: 'notion/p1' });
      const receipt = await run([upsert({ sourceId: 'p1' })]);
      expect(receipt).toMatchObject({ counts: { created: 1, updated: 0 } });
      expect(await page('notion/p2')).toMatchObject({ id: p2!.id, version: p2!.version, body: p2!.body });
      const storage = await knowledge.getStorage();
      expect(await storage.listPageBodyLinkSources({ toPageIds: [(await page('notion/p1'))!.id] })).toContain(p2!.id);
    });

    it('ends the run when the settings check throws, so the next run is not skipped', async () => {
      let blowUp = true;
      class Strict extends KnowledgeImporter({
        id: 'strict',
        label: 'Strict',
        settings: {
          '~standard': {
            version: 1 as const,
            vendor: 'test',
            jsonSchema: { input: () => ({ type: 'object' }), output: () => ({ type: 'object' }) },
            validate: (value: unknown) => {
              if (blowUp) throw new Error('validator blew up');
              return { value };
            },
          },
        },
      }) {
        async import(ctx: KnowledgeImporterContext<unknown, never>) {
          await ctx.items.upsert({ sourceId: 'p1', title: 'P1', body: 'body of p1' });
        }
      }
      const knowledge = new Knowledge({
        scopes: { 'docs:$orgId': {} },
        storage: fixture.storage,
        importers: [new Strict({ id: 's1', target: 'docs:acme#strict' })],
      });
      await expect(knowledge.importers!.run('s1')).rejects.toThrow('validator blew up');
      blowUp = false;
      expect(await knowledge.importers!.run('s1')).toMatchObject({ outcome: 'succeeded', counts: { created: 1 } });
    });

    it('keeps updating an imported page a person moved out of the target, where they put it', async () => {
      const { knowledge, run, page } = setup();
      await run([
        upsert({ sourceId: 'p1' }),
        upsert({ sourceId: 'c1', parent: 'p1' }),
        upsert({ sourceId: 'a', links: [{ sourceId: 'p1' }] }),
      ]);
      const before = await page('notion/p1');
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'archive', name: 'Archive' });
      await knowledge.movePage({ scope: 'docs:acme', path: 'notion/p1', parent: 'archive' });

      const receipt = await run([
        upsert({ sourceId: 'p1', body: 'new' }),
        upsert({ sourceId: 'c2', parent: 'p1' }),
        upsert({ sourceId: 'a', body: 'a again', links: [{ sourceId: 'p1' }] }),
      ]);
      expect(receipt).toMatchObject({ outcome: 'succeeded', counts: { created: 1, updated: 2, moved: 0, refused: 0 } });
      expect(await page('archive/p1')).toMatchObject({ id: before!.id, body: 'new' });
      expect(await page('notion/p1')).toBeNull();
      // Children follow their parent where it is; links render from the page's real path.
      expect((await page('archive/p1/c2'))?.body).toBe('body of c2');
      expect((await page('notion/a'))?.body).toBe('a again\n\nLinks:\n- [[docs:acme#archive/p1]]');
      // Nothing left to settle: the page stays where the person put it.
      expect(await run([upsert({ sourceId: 'p1', body: 'new' })])).toMatchObject({
        chain: false,
        counts: { unchanged: 1, moved: 0, refused: 0 },
      });

      // Removed from the source with children under it, it is kept as a stub, not deleted.
      const removed = await run([{ op: 'remove', sourceId: 'p1' }]);
      expect(removed).toMatchObject({ counts: { stubbed: 1, removed: 0, refused: 0 } });
      expect((await page('archive/p1'))?.id).toBe(before!.id);
    });

    it("keeps updating an imported page a person moved into another binding's folder, where they put it", async () => {
      const { knowledge, run, page } = setup([
        { id: 'b1', target: 'docs:acme#notion' },
        { id: 'b2', target: 'docs:acme#linear' },
      ]);
      await run([upsert({ sourceId: 'p1' })]);
      await run([upsert({ sourceId: 'l1' })], 'b2');
      const before = await page('notion/p1');
      await knowledge.movePage({ scope: 'docs:acme', path: 'notion/p1', parent: 'linear/l1' });
      const receipt = await run([upsert({ sourceId: 'p1', body: 'new' })]);
      expect(receipt).toMatchObject({ counts: { updated: 1, refused: 0 } });
      expect(await page('linear/l1/p1')).toMatchObject({ id: before!.id, body: 'new' });
      // Its anchor directly, too.
      await knowledge.movePage({ scope: 'docs:acme', path: 'linear/l1/p1', parent: 'linear' });
      expect(await run([upsert({ sourceId: 'p1', body: 'newer' })])).toMatchObject({ counts: { updated: 1 } });
      expect(await page('linear/p1')).toMatchObject({ id: before!.id, body: 'newer' });
    });

    it("updates an imported page a person moved under another binding's page inside this target, and puts it back", async () => {
      const { knowledge, run, page } = setup([
        { id: 'b1', target: 'docs:acme#notion' },
        { id: 'b2', target: 'docs:acme#linear' },
      ]);
      await run([upsert({ sourceId: 'p1' })]);
      await run([upsert({ sourceId: 'l1' })], 'b2');
      // b2's page lands inside b1's target, then b1's own page goes under it.
      await knowledge.movePage({ scope: 'docs:acme', path: 'linear/l1', parent: 'notion' });
      await knowledge.movePage({ scope: 'docs:acme', path: 'notion/p1', parent: 'notion/l1' });
      const before = await page('notion/l1/p1');
      // Inside its target, b1 places it back under its parent, the anchor.
      expect(await run([upsert({ sourceId: 'p1', body: 'new' })])).toMatchObject({
        counts: { updated: 1, moved: 1, refused: 0 },
      });
      expect(await page('notion/l1/p1')).toBeNull();
      expect(await page('notion/p1')).toMatchObject({ id: before!.id, body: 'new' });
    });

    it("anchors through another binding's anchor and on another binding's item page", async () => {
      const { knowledge, run, page } = setup([
        { id: 'b1', target: 'docs:acme#hub/linear/notion' },
        { id: 'b2', target: 'docs:acme#linear' },
        { id: 'b3', target: 'docs:acme#l1' },
      ]);
      await run([upsert({ sourceId: 'l1' })], 'b2');
      // b2's anchor moves under a human page onto b1's path; b2's item page moves to the top onto b3's target.
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'hub', name: 'Hub' });
      await knowledge.movePage({ scope: 'docs:acme', path: 'linear', parent: 'hub' });
      await knowledge.movePage({ scope: 'docs:acme', path: 'hub/linear/l1' });
      const l1 = await page('l1');
      expect(await run([upsert({ sourceId: 'p1' })], 'b1')).toMatchObject({ counts: { created: 1, refused: 0 } });
      expect(await page('hub/linear/notion/p1')).toBeTruthy();
      // b3 anchors on b2's item page, which stays b2's item: folders are shared.
      expect(await run([upsert({ sourceId: 'p1' })], 'b3')).toMatchObject({ counts: { created: 1, refused: 0 } });
      expect(await page('l1/p1')).toBeTruthy();
      const storage = await knowledge.getStorage();
      expect(await storage.importers!.getBinding('b3')).toMatchObject({ anchorPageId: l1!.id });
      expect(await storage.importers!.getNode('b2', 'l1')).toMatchObject({ pageId: l1!.id });
      expect(await storage.importers!.getBinding('b1')).not.toMatchObject({ anchorPageId: null });
    });

    it("keeps writing once another binding's page has taken the place of an ancestor of the anchor", async () => {
      const { knowledge, run, page } = setup([
        { id: 'b1', target: 'docs:acme#hub/notion' },
        { id: 'b2', target: 'docs:acme#linear' },
      ]);
      await run([upsert({ sourceId: 'p1' })]);
      await run([upsert({ sourceId: 'hub' })], 'b2');
      // Same keys as before, but `hub` is now b2's item page.
      await knowledge.movePage({ scope: 'docs:acme', path: 'hub/notion' });
      await knowledge.removePage({ scope: 'docs:acme', path: 'hub' });
      await knowledge.movePage({ scope: 'docs:acme', path: 'linear/hub' });
      await knowledge.movePage({ scope: 'docs:acme', path: 'notion', parent: 'hub' });
      expect(await run([upsert({ sourceId: 'p1', body: 'new' }), upsert({ sourceId: 'p2' })])).toMatchObject({
        counts: { updated: 1, created: 1, refused: 0 },
      });
      expect((await page('hub/notion/p1'))?.body).toBe('new');
      expect(await page('hub/notion/p2')).toBeTruthy();
    });

    it('anchors on one of its own pages a rebind left at the target, and stops tracking it as an item', async () => {
      const { knowledge, run, page } = setup([{ id: 'b1', target: 'docs:acme#p1' }]);
      await run([upsert({ sourceId: 'p1' })]);
      // The anchor moves away and its item `p1` takes the target path; the app then rebinds.
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'old', name: 'Old' });
      const anchor = await page('p1');
      await knowledge.movePage({ scope: 'docs:acme', path: 'p1', parent: 'old' });
      await knowledge.movePage({ scope: 'docs:acme', path: 'old/p1/p1' });
      const item = await page('p1');
      const storage = await knowledge.getStorage();
      await storage.transaction(tx =>
        tx.importers!.setBindingAnchor({ bindingId: 'b1', expected: anchor!.id, pageId: null }),
      );
      expect(await run([upsert({ sourceId: 'p2' })])).toMatchObject({ counts: { created: 1, refused: 0 } });
      expect(await page('p1/p2')).toBeTruthy();
      expect(await storage.importers!.getBinding('b1')).toMatchObject({ anchorPageId: item!.id });
      expect(await storage.importers!.getNode('b1', 'p1')).toBeNull();
    });

    it('writes an item again at its configured path when a person moved its page into another scope', async () => {
      const { knowledge, run, page } = setup();
      await run([upsert({ sourceId: 'p1' })]);
      const before = await page('notion/p1');
      await knowledge.movePage({ scope: 'docs:acme', path: 'notion/p1', toScope: 'docs:other' });
      const receipt = await run([upsert({ sourceId: 'p1', body: 'new' })]);
      expect(receipt).toMatchObject({ counts: { created: 1, refused: 0 } });
      expect((await page('notion/p1'))?.body).toBe('new');
      const storage = await knowledge.getStorage();
      const [other] = await storage.getScopesByAddress(['docs:other']);
      // The moved page is an ordinary page now: left as it was, and not removed with the item.
      expect(await storage.getPageByPath({ scopeId: other!.id, path: ['p1'], read: 'all' })).toMatchObject({
        id: before!.id,
        body: 'body of p1',
      });
      expect(await run([{ op: 'remove', sourceId: 'p1' }])).toMatchObject({ counts: { removed: 1, refused: 0 } });
      expect(await storage.getPageByPath({ scopeId: other!.id, path: ['p1'], read: 'all' })).toBeTruthy();
    });

    it('keeps writing under its anchor after a person moved the anchor away from its configured path', async () => {
      const { knowledge, run, page } = setup();
      await run([upsert({ sourceId: 'p1' })]);
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'archive', name: 'Archive' });
      await knowledge.movePage({ scope: 'docs:acme', path: 'notion', parent: 'archive' });
      const receipt = await run([upsert({ sourceId: 'p2' })]);
      expect(receipt).toMatchObject({ counts: { created: 1, refused: 0 } });
      expect(await page('archive/notion/p2')).toBeTruthy();
    });

    it('anchors again at its configured path after a person deleted the anchor', async () => {
      const { knowledge, run, page } = setup();
      await run([upsert({ sourceId: 'p1' })]);
      await knowledge.removePage({ scope: 'docs:acme', path: 'notion/p1' });
      await knowledge.removePage({ scope: 'docs:acme', path: 'notion' });
      expect(await run([upsert({ sourceId: 'p2' })])).toMatchObject({ counts: { created: 1, refused: 0 } });
      expect(await page('notion/p2')).toBeTruthy();
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

    it("moves and stubs a page whose subtree holds another binding's page, carrying every child", async () => {
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
      expect(move).toMatchObject({ counts: { moved: 1, refused: 0 } });
      expect(await page('notion/p2/p1/l1')).toBeTruthy();

      const remove = await run([{ op: 'remove', sourceId: 'p1' }]);
      expect(remove).toMatchObject({ counts: { stubbed: 1, removed: 0, refused: 0 } });
      expect(await page('notion/p2/p1/l1')).toBeTruthy();

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

    it('runs two bindings at the same target: whichever runs last takes the page over', async () => {
      const { run, page } = setup([
        { id: 'b1', target: 'docs:acme#notion' },
        { id: 'b2', target: 'docs:acme#notion' },
      ]);
      expect(await run([upsert({ sourceId: 'p1', body: 'from b1' })])).toMatchObject({
        counts: { created: 1, refused: 0 },
      });
      const first = await page('notion/p1');
      expect(await run([upsert({ sourceId: 'p1', body: 'from b2' })], 'b2')).toMatchObject({
        counts: { created: 0, updated: 1, refused: 0 },
      });
      expect(await page('notion/p1')).toMatchObject({ id: first!.id, body: 'from b2' });
      // b1 no longer tracks it, so its next run takes it back rather than making a second page.
      expect(await run([upsert({ sourceId: 'p1', body: 'from b1' })])).toMatchObject({
        counts: { created: 0, updated: 1, refused: 0 },
      });
      expect(await page('notion/p1')).toMatchObject({ id: first!.id, body: 'from b1' });
      expect(await page('notion')).toBeTruthy();
    });

    for (const [name, order] of [
      ['the first binding', ['b1', 'b2', 'b1']],
      ['the second binding', ['b2', 'b1', 'b2']],
    ] as const) {
      it(`removes its own items with a removal-only flush after another binding wrote to the same target last (${name} removes)`, async () => {
        const { run, page } = setup([
          { id: 'b1', target: 'docs:acme#notion' },
          { id: 'b2', target: 'docs:acme#notion' },
        ]);
        const [first, second, remover] = order;
        expect(
          await run([upsert({ sourceId: `${first}-a` }), upsert({ sourceId: `${first}-b` })], first),
        ).toMatchObject({
          counts: { created: 2, refused: 0 },
        });
        expect(await run([upsert({ sourceId: `${second}-q` })], second)).toMatchObject({ counts: { created: 1 } });
        if (remover === first) {
          expect(await run([{ op: 'remove', sourceId: `${first}-b` }], first)).toMatchObject({
            counts: { removed: 1, refused: 0 },
          });
          expect(await page(`notion/${first}-b`)).toBeNull();
        } else {
          await run([upsert({ sourceId: `${first}-c` })], first);
          expect(await run([{ op: 'remove', sourceId: `${second}-q` }], second)).toMatchObject({
            counts: { removed: 1, refused: 0 },
          });
          expect(await page(`notion/${second}-q`)).toBeNull();
        }
        expect(await page(`notion/${first}-a`)).toBeTruthy();
      });
    }

    it("queues another binding's linking pages when a move carries its pages, and its next empty run repairs them", async () => {
      const { run, page } = setup([
        { id: 'b1', target: 'docs:acme#notion' },
        { id: 'b2', target: 'docs:acme#notion/a1/linear' },
      ]);
      await run([upsert({ sourceId: 'a0' }), upsert({ sourceId: 'a1' })]);
      await run([upsert({ sourceId: 'q1' }), upsert({ sourceId: 'q2', links: [{ sourceId: 'q1' }] })], 'b2');
      expect((await page('notion/a1/linear/q2'))?.body).toContain('[[docs:acme#notion/a1/linear/q1]]');
      // b1 moves a1, and b2's folder with it.
      expect(await run([upsert({ sourceId: 'a1', parent: 'a0' })])).toMatchObject({ counts: { moved: 1, refused: 0 } });
      expect(await page('notion/a0/a1/linear/q1')).toBeTruthy();
      // b2 has nothing new, and its run still rewrites q2's link to where q1 is now.
      expect(await run([], 'b2')).toMatchObject({ outcome: 'succeeded', counts: { refused: 0 } });
      const q2 = await page('notion/a0/a1/linear/q2');
      expect(q2?.body).toContain('[[docs:acme#notion/a0/a1/linear/q1]]');
      expect(q2?.body).not.toContain('[[docs:acme#notion/a1/linear/q1]]');
    });

    it('stops settling when more nodes than one slice examines can never settle, and still repairs a link queued behind its cursor', async () => {
      const { knowledge, run, page } = setup([
        { id: 'b1', target: 'docs:acme#notion' },
        { id: 'b2', target: 'docs:acme#notion/a1/linear' },
      ]);
      await run([upsert({ sourceId: 'a0' }), upsert({ sourceId: 'a1' })]);
      const host = knowledge.importers!.host;
      const orphans = Array.from({ length: 250 }, (_, i) =>
        upsert({ sourceId: `c${String(i).padStart(3, '0')}`, parent: 'never' }),
      );
      const first = await host.startRun('b2');
      if (first.status !== 'started') throw new Error('not started');
      expect(
        await flushOnce(host, first.runId, first.generation, 1, [
          upsert({ sourceId: 'q1' }),
          upsert({ sourceId: 'a-link', links: [{ sourceId: 'q1' }] }),
          ...orphans,
        ]),
      ).toMatchObject({ created: 252 });
      // Empty flushes, as the runner sends while settle work is pending: they must stop saying
      // pending once a whole pass has gone by without settling anything.
      let seq = 1;
      let pending = true;
      while (pending && seq < 10) {
        seq++;
        pending = (await flushOnce(host, first.runId, first.generation, seq, [])).pending === true;
      }
      expect(pending).toBe(false);
      await host.finishRun({
        runId: first.runId,
        generation: first.generation,
        outcome: 'succeeded',
        backlog: false,
        lastSeq: seq,
      });
      // b1 moves b2's folder; a-link sorts before every orphan.
      expect(await run([upsert({ sourceId: 'a1', parent: 'a0' })])).toMatchObject({ counts: { moved: 1 } });
      expect(await run([], 'b2')).toMatchObject({ outcome: 'succeeded' });
      expect((await page('notion/a0/a1/linear/a-link'))?.body).toContain('[[docs:acme#notion/a0/a1/linear/q1]]');
      // Nothing settles from here on, and runs end on their own.
      expect(await run([], 'b2')).toMatchObject({ outcome: 'succeeded', chain: false, counts: { moved: 0 } });
    }, 60_000);

    it.each(['move', 'takeover'] as const)(
      "repairs another binding's linking pages behind its saved settle cursor in its next run, even after a pass already started over (%s)",
      async how => {
        const { knowledge, run, page } = setup([
          { id: 'b1', target: 'docs:acme#notion' },
          { id: 'b2', target: 'docs:acme#notion/a1/linear' },
        ]);
        await run([upsert({ sourceId: 'a0' }), upsert({ sourceId: 'a1' })]);
        const host = knowledge.importers!.host;
        // Just over one 200-node slice: the first pass ends after two flushes, and a third stops
        // partway through the next pass with the cursor saved.
        const orphans = Array.from({ length: 210 }, (_, i) =>
          upsert({ sourceId: `c${String(i).padStart(3, '0')}`, parent: 'never' }),
        );
        const first = await host.startRun('b2');
        if (first.status !== 'started') throw new Error('not started');
        await flushOnce(host, first.runId, first.generation, 1, [
          upsert({ sourceId: 'q1' }),
          upsert({ sourceId: 'a-link', links: [{ sourceId: 'q1' }] }),
          ...orphans,
        ]);
        // Empty flushes walk the orphans a slice at a time, reach the end and start the pass again;
        // the run then ends mid-pass (on its budget, lease or a cancel) with the cursor saved.
        for (const seq of [2, 3]) await flushOnce(host, first.runId, first.generation, seq, []);
        await host.finishRun({
          runId: first.runId,
          generation: first.generation,
          outcome: 'succeeded',
          backlog: false,
          lastSeq: 3,
        });
        const storage = await knowledge.getStorage();
        expect((await storage.importers!.getState('b2'))['mastra:settle:cursor']).toBeTruthy();
        if (how === 'move') {
          // b1 moves a1, and b2's folder with it; a-link sorts before b2's saved cursor.
          expect(await run([upsert({ sourceId: 'a1', parent: 'a0' })])).toMatchObject({ counts: { moved: 1 } });
        } else {
          // A person moves b2's q1 to where b1's q1 goes, and b1 takes it over.
          await knowledge.movePage({ scope: 'docs:acme', path: 'notion/a1/linear/q1', parent: 'notion' });
          expect(await run([upsert({ sourceId: 'q1', body: 'from b1' })])).toMatchObject({ counts: { updated: 1 } });
        }
        expect((await storage.importers!.getNode('b2', 'a-link'))?.unsettled).toBe(true);
        // b2's next run, which sends nothing, repairs it, and ends on its own: the orphans still
        // never settle, and the restart is taken once.
        expect(await run([], 'b2')).toMatchObject({ outcome: 'succeeded', chain: false });
        const linker = how === 'move' ? 'notion/a0/a1/linear/a-link' : 'notion/a1/linear/a-link';
        if (how === 'move') {
          expect((await page(linker))?.body).toContain('[[docs:acme#notion/a0/a1/linear/q1]]');
          expect((await storage.importers!.getNode('b2', 'a-link'))?.unsettled).toBe(false);
        } else {
          // Its target is b1's now; it waits for b2 to send q1 again.
          expect((await page(linker))?.body).not.toContain('q1]]');
        }
      },
      30_000,
    );

    describe("another binding's restart request", () => {
      const RESTART = 'mastra:settle:restart';
      const SEEN = 'mastra:settle:seen';

      it('starts the next flush over when it arrives after a flush that starts over read the state', async () => {
        const { knowledge, run } = setup([{ id: 'b2', target: 'docs:acme#linear' }]);
        await run([upsert({ sourceId: 'q1' })], 'b2');
        const storage = await knowledge.getStorage();
        await storage.importers!.setState('b2', { [RESTART]: 'r1' });
        const host = knowledge.importers!.host;
        const started = await host.startRun('b2');
        if (started.status !== 'started') throw new Error('not started');
        // Another binding's request lands after this flush read the state, before it writes `seen`.
        const proto = Object.getPrototypeOf(storage.importers!);
        const getState = proto.getState;
        proto.getState = async function (this: typeof storage.importers, bindingId: string) {
          const state = await getState.call(this, bindingId);
          proto.getState = getState;
          await this!.setState(bindingId, { [RESTART]: 'r2' });
          return state;
        };
        try {
          await flushOnce(host, started.runId, started.generation, 1, []);
        } finally {
          proto.getState = getState;
        }
        expect(await storage.importers!.getState('b2')).toMatchObject({ [RESTART]: 'r2', [SEEN]: 'r1' });
        await flushOnce(host, started.runId, started.generation, 2, []);
        expect(await storage.importers!.getState('b2')).toMatchObject({ [RESTART]: 'r2', [SEEN]: 'r2' });
      });

      it('stays unseen while the run has stopped settling after its timeouts', async () => {
        const { knowledge, run } = setup([{ id: 'b2', target: 'docs:acme#linear' }]);
        await run([upsert({ sourceId: 'q1' })], 'b2');
        const storage = await knowledge.getStorage();
        const host = knowledge.importers!.host;
        const started = await host.startRun('b2');
        if (started.status !== 'started') throw new Error('not started');
        await storage.importers!.setState('b2', { [RESTART]: 'r1', 'mastra:settle:timeouts': `${started.runId}:3` });
        await flushOnce(host, started.runId, started.generation, 1, [upsert({ sourceId: 'q2' })]);
        expect((await storage.importers!.getState('b2'))[SEEN] ?? '').toBe('');
        await host.finishRun({
          runId: started.runId,
          generation: started.generation,
          outcome: 'succeeded',
          backlog: false,
          lastSeq: 1,
        });
        // The next run settles again, from the start.
        await run([], 'b2');
        expect((await storage.importers!.getState('b2'))[SEEN]).toBe('r1');
      });

      it('stays unseen while the binding has no folder to settle under', async () => {
        const { knowledge, run } = setup([{ id: 'b2', target: 'docs:acme#linear' }]);
        await run([upsert({ sourceId: 'q1' }), upsert({ sourceId: 'q2' })], 'b2');
        await knowledge.upsertPage({ scope: 'docs:acme', path: 'kept', name: 'Kept' });
        await knowledge.movePage({ scope: 'docs:acme', path: 'linear/q1', parent: 'kept' });
        await knowledge.movePage({ scope: 'docs:acme', path: 'linear/q2', parent: 'kept' });
        await knowledge.removePage({ scope: 'docs:acme', path: 'linear' });
        const storage = await knowledge.getStorage();
        await storage.importers!.setState('b2', { [RESTART]: 'r1' });
        expect(await run([{ op: 'remove', sourceId: 'q2' }], 'b2')).toMatchObject({ counts: { removed: 1 } });
        expect((await storage.importers!.getState('b2'))[SEEN] ?? '').toBe('');
        // The write that makes the folder again settles from the start.
        await run([upsert({ sourceId: 'q3' })], 'b2');
        expect((await storage.importers!.getState('b2'))[SEEN]).toBe('r1');
      });
    });

    it("repairs another binding's linking pages behind its saved settle cursor when its item is taken over", async () => {
      const { knowledge, run, page } = setup([
        { id: 'b1', target: 'docs:acme#notion' },
        { id: 'b2', target: 'docs:acme#linear' },
      ]);
      await run([upsert({ sourceId: 'p0' })]);
      const host = knowledge.importers!.host;
      const first = await host.startRun('b2');
      if (first.status !== 'started') throw new Error('not started');
      const children = Array.from({ length: 60 }, (_, i) =>
        upsert({ sourceId: `c${String(i).padStart(2, '0')}`, parent: 'p' }),
      );
      await flushOnce(host, first.runId, first.generation, 1, [
        upsert({ sourceId: 'q1' }),
        upsert({ sourceId: 'a-link', links: [{ sourceId: 'q1' }] }),
        ...children,
      ]);
      // The parent arrives and settles 50; the run ends with its settle cursor saved at c49.
      expect(await flushOnce(host, first.runId, first.generation, 2, [upsert({ sourceId: 'p' })])).toMatchObject({
        pending: true,
      });
      await host.finishRun({
        runId: first.runId,
        generation: first.generation,
        outcome: 'succeeded',
        backlog: false,
        lastSeq: 2,
      });
      expect((await page('linear/a-link'))?.body).toContain('[[docs:acme#linear/q1]]');
      // A person moves b2's q1 to where b1's q1 goes, and b1 takes it over; a-link sorts before b2's cursor.
      await knowledge.movePage({ scope: 'docs:acme', path: 'linear/q1', parent: 'notion' });
      expect(await run([upsert({ sourceId: 'q1', body: 'from b1' })])).toMatchObject({ counts: { updated: 1 } });
      const storage = await knowledge.getStorage();
      expect((await storage.importers!.getNode('b2', 'a-link'))?.unsettled).toBe(true);
      // b2's next empty run reaches a-link: it no longer links to the page b1 took over.
      expect(await run([], 'b2')).toMatchObject({ outcome: 'succeeded' });
      expect((await page('linear/a-link'))?.body).not.toContain('q1]]');
      // Once b2 sends q1 again, a-link links to b2's new page.
      expect(await run([upsert({ sourceId: 'q1' })], 'b2')).toMatchObject({ counts: { created: 1 } });
      expect((await page('linear/a-link'))?.body).toContain('[[docs:acme#linear/q1]]');
    });

    it("repairs another binding's linking pages that sort before its saved settle cursor", async () => {
      const { knowledge, run, page } = setup([
        { id: 'b1', target: 'docs:acme#notion' },
        { id: 'b2', target: 'docs:acme#notion/a1/linear' },
      ]);
      await run([upsert({ sourceId: 'a0' }), upsert({ sourceId: 'a1' })]);
      const host = knowledge.importers!.host;
      const first = await host.startRun('b2');
      if (first.status !== 'started') throw new Error('not started');
      const children = Array.from({ length: 60 }, (_, i) =>
        upsert({ sourceId: `c${String(i).padStart(2, '0')}`, parent: 'p' }),
      );
      await flushOnce(host, first.runId, first.generation, 1, [
        upsert({ sourceId: 'q1' }),
        upsert({ sourceId: 'a-link', links: [{ sourceId: 'q1' }] }),
        ...children,
      ]);
      // The parent arrives and settles 50; the run ends with its settle cursor saved at c49.
      expect(await flushOnce(host, first.runId, first.generation, 2, [upsert({ sourceId: 'p' })])).toMatchObject({
        pending: true,
      });
      await host.finishRun({
        runId: first.runId,
        generation: first.generation,
        outcome: 'succeeded',
        backlog: false,
        lastSeq: 2,
      });
      // b1 moves a1, and b2's folder with it; a-link sorts before b2's saved cursor.
      expect(await run([upsert({ sourceId: 'a1', parent: 'a0' })])).toMatchObject({ counts: { moved: 1 } });
      expect(await run([], 'b2')).toMatchObject({ outcome: 'succeeded', chain: false });
      expect((await page('notion/a0/a1/linear/a-link'))?.body).toContain('[[docs:acme#notion/a0/a1/linear/q1]]');
      expect((await page('notion/a0/a1/linear/p/c59'))?.parentId).toBe((await page('notion/a0/a1/linear/p'))!.id);
      const storage = await knowledge.getStorage();
      expect((await storage.importers!.listNodes('b2', { unsettled: true })).items).toEqual([]);
      // Nothing left: the next run settles nothing.
      expect(await run([], 'b2')).toMatchObject({
        outcome: 'succeeded',
        chain: false,
        counts: { moved: 0, updated: 0 },
      });
    });

    it('gives back a kept body whose note was written with the earlier heading', async () => {
      const { knowledge, run, page } = setup();
      // Taken over with no body, so the takeover keeps no note; the note an earlier version kept is added after.
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'notion/p1', name: 'P1', body: '' });
      const p1 = await page('notion/p1');
      await run([{ op: 'declare', item: { sourceId: 'p1', title: 'P1' } }]);
      const storage = await knowledge.getStorage();
      await storage.addNote({
        id: `knowledge-import-original:${p1!.id}`,
        pageId: p1!.id,
        text: 'Written by hand before an importer took over this page:\n\nmine',
        stampScopeIds: [p1!.scopeId],
        mentions: [],
        provenance: { author: 'host' },
      });
      await run([upsert({ sourceId: 'p1' })]);
      expect((await page('notion/p1'))?.body).toBe('body of p1');
      await run([{ op: 'remove', sourceId: 'p1' }]);
      expect((await page('notion/p1'))?.body).toBe('mine');
    });

    for (const again of ['another binding', 'the same binding id'] as const) {
      it(`a second takeover by ${again} after retirement keeps the body the page has then, not the first one`, async () => {
        const first = setup();
        await first.knowledge.upsertPage({ scope: 'docs:acme', path: 'notion/p1', name: 'P1', body: 'Human original' });
        const p1 = await first.page('notion/p1');
        await first.run([upsert({ sourceId: 'p1' })]);
        await first.run([{ op: 'remove', sourceId: 'p1' }]);
        expect((await first.page('notion/p1'))?.body).toBe('Human original');
        await createKnowledgeImporterHost(first.knowledge, {
          bindings: [{ id: 'b1', importer: 'notes', target: 'docs:acme#notion', settings: {}, credentials: {} }],
        }).retireBinding('b1');
        await first.knowledge.upsertPage({ scope: 'docs:acme', path: 'notion/p1', name: 'P1', body: 'Human later' });

        const id = again === 'another binding' ? 'b9' : 'b1';
        const second = setup([{ id, target: 'docs:acme#notion' }]);
        expect(await second.run([upsert({ sourceId: 'p1' })], id)).toMatchObject({
          counts: { updated: 1, refused: 0 },
        });
        await second.run([upsert({ sourceId: 'p1', body: 'imported again' })], id);
        expect(await second.run([{ op: 'remove', sourceId: 'p1' }], id)).toMatchObject({ counts: { stubbed: 1 } });
        expect(await second.page('notion/p1')).toMatchObject({ id: p1!.id, body: 'Human later' });
        // The page keeps one kept-body note: the earlier one is gone.
        const storage = await second.knowledge.getStorage();
        const kept = (await storage.listNotes({ pageId: p1!.id, read: 'all' })).notes.filter(n =>
          n.text.startsWith('The body this page had before an importer took it over:'),
        );
        expect(kept.map(n => n.text)).toEqual([
          'The body this page had before an importer took it over:\n\nHuman later',
        ]);
      });
    }

    it('an item the source sends again after removing it keeps the body the page has then', async () => {
      const { knowledge, run, page } = setup();
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'notion/p1', name: 'P1', body: 'Human original' });
      await run([upsert({ sourceId: 'p1' })]);
      await run([{ op: 'remove', sourceId: 'p1' }]);
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'notion/p1', name: 'P1', body: 'Human later' });
      await run([upsert({ sourceId: 'p1', body: 'back again' })]);
      expect((await page('notion/p1'))?.body).toBe('back again');
      await run([{ op: 'remove', sourceId: 'p1' }]);
      expect((await page('notion/p1'))?.body).toBe('Human later');
    });

    it('an item the source sends again after a person cleared its restored body is stubbed on removal, not given the old body', async () => {
      const { knowledge, run, page } = setup();
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'notion/p1', name: 'P1', body: 'Human original' });
      await run([upsert({ sourceId: 'p1' })]);
      await run([{ op: 'remove', sourceId: 'p1' }]);
      expect((await page('notion/p1'))?.body).toBe('Human original');
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'notion/p1', name: 'P1', body: '' });
      await run([upsert({ sourceId: 'p1', body: 'back again' })]);
      await run([{ op: 'remove', sourceId: 'p1' }]);
      expect((await page('notion/p1'))?.body).toBe(
        'Removed from the source. Kept because the page was here before the import.',
      );
    });

    for (const again of ['another binding', 'the same binding id'] as const) {
      it(`a second takeover by ${again} of a page a person emptied keeps no earlier body`, async () => {
        const first = setup();
        await first.knowledge.upsertPage({ scope: 'docs:acme', path: 'notion/p1', name: 'P1', body: 'Human original' });
        const p1 = await first.page('notion/p1');
        await first.run([upsert({ sourceId: 'p1' })]);
        await first.run([{ op: 'remove', sourceId: 'p1' }]);
        await createKnowledgeImporterHost(first.knowledge, {
          bindings: [{ id: 'b1', importer: 'notes', target: 'docs:acme#notion', settings: {}, credentials: {} }],
        }).retireBinding('b1');
        await first.knowledge.upsertPage({ scope: 'docs:acme', path: 'notion/p1', name: 'P1', body: '' });

        const id = again === 'another binding' ? 'b9' : 'b1';
        const second = setup([{ id, target: 'docs:acme#notion' }]);
        await second.run([upsert({ sourceId: 'p1', body: 'imported again' })], id);
        expect(await second.run([{ op: 'remove', sourceId: 'p1' }], id)).toMatchObject({ counts: { stubbed: 1 } });
        expect(await second.page('notion/p1')).toMatchObject({
          id: p1!.id,
          body: 'Removed from the source. Kept because the page was here before the import.',
        });
        const storage = await second.knowledge.getStorage();
        const kept = (await storage.listNotes({ pageId: p1!.id, read: 'all' })).notes.filter(n =>
          n.text.startsWith('The body this page had before an importer took it over:'),
        );
        expect(kept).toEqual([]);
      });
    }

    it('drops a generated link to an item the source removed on the next empty run', async () => {
      const { run, page } = setup();
      await run([upsert({ sourceId: 'z-target' }), upsert({ sourceId: 'a-link', links: [{ sourceId: 'z-target' }] })]);
      expect((await page('notion/a-link'))?.body).toBe('body of a-link\n\nLinks:\n- [[docs:acme#notion/z-target]]');
      expect(await run([{ op: 'remove', sourceId: 'z-target' }])).toMatchObject({ counts: { removed: 1 } });
      expect(await page('notion/z-target')).toBeNull();
      expect(await run([])).toMatchObject({ outcome: 'succeeded', counts: { refused: 0 } });
      expect((await page('notion/a-link'))?.body).toBe('body of a-link');
    });

    it("keeps its item page as a stub when the source removes it while it is another binding's empty folder", async () => {
      const { knowledge, run, page } = setup([
        { id: 'b1', target: 'docs:acme#notion' },
        { id: 'b2', target: 'docs:acme#notion/x' },
      ]);
      await run([upsert({ sourceId: 'x' })]);
      await run([upsert({ sourceId: 'q1' })], 'b2');
      await run([{ op: 'remove', sourceId: 'q1' }], 'b2');
      const x = await page('notion/x');
      await knowledge.addNote({ scope: 'docs:acme', path: 'notion/x', text: 'Owner: support team' });
      expect(await run([{ op: 'remove', sourceId: 'x' }])).toMatchObject({
        counts: { removed: 0, stubbed: 1, refused: 0 },
      });
      expect(await page('notion/x')).toMatchObject({
        id: x!.id,
        body: 'Removed from the source. Kept because another importer writes under it.',
      });
      const storage = await knowledge.getStorage();
      expect((await storage.listNotes({ pageId: x!.id, read: 'all' })).notes.map(n => n.text)).toContain(
        'Owner: support team',
      );
      expect(await storage.importers!.getBinding('b2')).toMatchObject({ anchorPageId: x!.id });
      // b2 keeps the same folder.
      expect(await run([upsert({ sourceId: 'q2' })], 'b2')).toMatchObject({ counts: { created: 1, refused: 0 } });
      expect((await page('notion/x/q2'))?.parentId).toBe(x!.id);
    });

    it("keeps its item page as an ordinary stub when it is another binding's folder with pages under it", async () => {
      const { run, page } = setup([
        { id: 'b1', target: 'docs:acme#notion' },
        { id: 'b2', target: 'docs:acme#notion/x' },
      ]);
      await run([upsert({ sourceId: 'x' })]);
      await run([upsert({ sourceId: 'q1' })], 'b2');
      const x = await page('notion/x');
      expect(await run([{ op: 'remove', sourceId: 'x' }])).toMatchObject({ counts: { removed: 0, stubbed: 1 } });
      expect(await page('notion/x')).toMatchObject({
        id: x!.id,
        body: 'Removed from the source. Kept because pages are still nested under it.',
      });
      expect(await page('notion/x/q1')).toBeTruthy();
    });

    it('removes its own items with a removal-only flush after its folder was deleted', async () => {
      const { knowledge, run, page } = setup([{ id: 'b1', target: 'docs:acme#notion' }]);
      await run([upsert({ sourceId: 'a' }), upsert({ sourceId: 'b' })]);
      // A person keeps both pages somewhere else, and deletes the folder.
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'kept', name: 'Kept' });
      await knowledge.movePage({ scope: 'docs:acme', path: 'notion/a', parent: 'kept' });
      await knowledge.movePage({ scope: 'docs:acme', path: 'notion/b', parent: 'kept' });
      await knowledge.removePage({ scope: 'docs:acme', path: 'notion' });
      const receipt = await run([
        { op: 'remove', sourceId: 'b' },
        { op: 'remove', sourceId: 'gone' },
      ]);
      expect(receipt).toMatchObject({ outcome: 'succeeded', counts: { removed: 1, refused: 0 } });
      expect(await page('kept/b')).toBeNull();
      expect(await page('kept/a')).toBeTruthy();
      expect(await page('notion')).toBeNull();
      // The folder comes back with the next write.
      expect(await run([upsert({ sourceId: 'c' })])).toMatchObject({ counts: { created: 1, refused: 0 } });
      expect(await page('notion/c')).toBeTruthy();
    });

    for (const [name, upsertAgain] of [
      ['before', false],
      ['after', true],
    ] as const) {
      it(`removes its own items with a removal-only flush when its folder is another binding's item page, ${name} that binding writes it again`, async () => {
        const { knowledge, run, page } = setup([
          { id: 'b1', target: 'docs:acme#notion' },
          { id: 'b2', target: 'docs:acme#notion/x' },
        ]);
        await run([upsert({ sourceId: 'x' })]);
        expect(await run([upsert({ sourceId: 'q1' }), upsert({ sourceId: 'q2' })], 'b2')).toMatchObject({
          counts: { created: 2, refused: 0 },
        });
        if (upsertAgain) {
          expect(await run([upsert({ sourceId: 'x', body: 'x v2' })])).toMatchObject({
            counts: { updated: 1, refused: 0 },
          });
          // b1 still tracks its own page, so no note keeps its imported body as an earlier one.
          const x = await page('notion/x');
          expect(x?.body).toBe('x v2');
          const storage = await knowledge.getStorage();
          expect(await storage.getNote({ id: `knowledge-import-original:${x!.id}`, read: 'all' })).toBeNull();
        }
        expect(await run([{ op: 'remove', sourceId: 'q2' }], 'b2')).toMatchObject({
          counts: { removed: 1, refused: 0 },
        });
        expect(await page('notion/x/q2')).toBeNull();
        expect(await page('notion/x/q1')).toBeTruthy();
      });
    }

    it('runs bindings whose targets nest, each writing where it is configured', async () => {
      const { run, page } = setup([
        { id: 'b1', target: 'docs:acme#notion' },
        { id: 'b2', target: 'docs:acme#notion/inner' },
      ]);
      expect(await run([upsert({ sourceId: 'p1' })])).toMatchObject({ counts: { created: 1, refused: 0 } });
      expect(await run([upsert({ sourceId: 'p1' })], 'b2')).toMatchObject({ counts: { created: 1, refused: 0 } });
      expect(await page('notion/p1')).toBeTruthy();
      expect(await page('notion/inner/p1')).toBeTruthy();
    });

    it('a retired binding leaves its pages as ordinary pages, and a new binding at the same target takes them over', async () => {
      const first = setup();
      await first.run([upsert({ sourceId: 'p1' }), upsert({ sourceId: 'c1', parent: 'p1' })]);
      const p1 = await first.page('notion/p1');
      const host = createKnowledgeImporterHost(first.knowledge, {
        bindings: [{ id: 'b1', importer: 'notes', target: 'docs:acme#notion', settings: {}, credentials: {} }],
      });
      await host.retireBinding('b1');
      const storage = await first.knowledge.getStorage();
      expect(await storage.importers!.getBinding('b1')).toBeNull();
      expect((await storage.importers!.listNodes('b1')).items).toEqual([]);
      expect(await storage.importers!.listRuns('b1')).toEqual([]);
      expect(await first.page('notion/p1/c1')).toBeTruthy();
      // Retiring again, or a binding that was never stored, is a no-op.
      await host.retireBinding('b1');

      const again = setup([{ id: 'b9', target: 'docs:acme#notion' }]);
      expect(await again.run([upsert({ sourceId: 'p1', body: 'again' })], 'b9')).toMatchObject({
        counts: { created: 0, updated: 1, refused: 0 },
      });
      expect(await again.page('notion/p1')).toMatchObject({ id: p1!.id, body: 'again' });
      // It took p1 over, so the source removing it never deletes the page.
      expect(await again.run([{ op: 'remove', sourceId: 'p1' }], 'b9')).toMatchObject({
        counts: { removed: 0, stubbed: 1 },
      });
      expect((await again.page('notion/p1'))?.id).toBe(p1!.id);
    });

    it('a run of a binding retired while it runs is refused at its next flush, and writes nothing', async () => {
      const { knowledge, page } = setup();
      const host = createKnowledgeImporterHost(knowledge, {
        bindings: [{ id: 'b1', importer: 'notes', target: 'docs:acme#notion', settings: {}, credentials: {} }],
      });
      const started = await host.startRun('b1');
      if (started.status !== 'started') throw new Error('not started');
      await host.retireBinding('b1');
      await expect(
        flushOnce(host, started.runId, started.generation, 1, [upsert({ sourceId: 'p1' })]),
      ).rejects.toMatchObject({ status: 409 });
      expect(await page('notion/p1')).toBeNull();
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

/**
 * A store provisioned only from the exported DDL, with storage init disabled, runs an import: the
 * export has to leave the importer tables as `importers.init()` would, writer-guard row included.
 */
export function createKnowledgeImporterExportDDLTests(
  createFixture: () => Promise<KnowledgeImporterHostFixture>,
): void {
  describe('importer tables provisioned from the exported DDL', () => {
    it('runs an import with storage init disabled', async () => {
      const fixture = await createFixture();
      try {
        class Notes extends KnowledgeImporter({ id: 'notes', label: 'Notes' }) {
          async import(ctx: KnowledgeImporterContext<Record<string, never>, never>) {
            await ctx.items.upsert({ sourceId: 'p1', title: 'P1', body: 'body of p1' });
          }
        }
        const knowledge = new Knowledge({
          scopes: { 'docs:$orgId': {} },
          storage: fixture.storage,
          importers: [new Notes({ id: 'b1', target: 'docs:acme#notion' })],
        });
        expect(await knowledge.importers!.run('b1')).toMatchObject({
          outcome: 'succeeded',
          counts: { created: 1, refused: 0 },
        });
        const storage = await knowledge.getStorage();
        const [scope] = await storage.getScopesByAddress(['docs:acme']);
        expect((await storage.getPageByPath({ scopeId: scope!.id, path: ['notion', 'p1'], read: 'all' }))?.body).toBe(
          'body of p1',
        );
      } finally {
        await fixture.cleanup();
      }
    });
  });
}
