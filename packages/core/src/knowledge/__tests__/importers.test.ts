import { describe, expect, it } from 'vitest';
import { InMemoryStore } from '../../storage';
import { InMemoryKnowledgeImporterStore } from '../../storage/domains/knowledge/importers';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge, KnowledgeImporterBusyError } from '../index';
import type { KnowledgeImporter } from '../index';

type Item = { id: string; title: string; body: string };

/** A source whose items the test edits between runs. */
function docsImporter(source: Map<string, Item>, id = 'docs'): KnowledgeImporter {
  return {
    id,
    async run(ctx) {
      for (const item of source.values()) {
        await ctx.pages.upsert({ scope: 'org:acme', path: `docs/${item.id}`, name: item.title, body: item.body });
      }
    },
  };
}

function setup(importers: KnowledgeImporter<any>[] = []) {
  const knowledge = new Knowledge({ storage: new InMemoryStore(), scopes: knowledgeMemoryScopes(), importers });
  const page = async (path: string) => {
    const storage = await knowledge.getStorage();
    const [scope] = await storage.getScopesByAddress(['org:acme']);
    if (!scope) return null;
    return storage.getPageByPath({ scopeId: scope.id, path: path.split('/'), read: 'all' });
  };
  return { knowledge, page };
}

const items = (...list: Item[]) => new Map(list.map(item => [item.id, item]));

describe('InMemoryKnowledgeImporterStore', () => {
  it('stores JSON state, runs newest first and owned pages', async () => {
    const store = new InMemoryKnowledgeImporterStore();
    await store.setImportState({ importerId: 'a', key: 'cursor', value: { since: 3 } });
    expect(await store.getImportState({ importerId: 'a', key: 'cursor' })).toEqual({ since: 3 });
    expect(await store.getImportState({ importerId: 'b', key: 'cursor' })).toBeUndefined();
    await store.setImportState({ importerId: 'a', key: 'cursor', value: undefined });
    expect(await store.getImportState({ importerId: 'a', key: 'cursor' })).toBeUndefined();

    const counts = { created: 0, updated: 0, unchanged: 0, removed: 0, notes: 0 };
    const base = { importerId: 'a', status: 'running', dryRun: false, incremental: false, counts } as const;
    await store.createImportRun({ ...base, id: 'r1', startedAt: new Date(1000) });
    await store.createImportRun({ ...base, id: 'r2', startedAt: new Date(2000) });
    await store.createImportRun({ ...base, id: 'r3', importerId: 'b', startedAt: new Date(3000) });
    await expect(store.createImportRun({ ...base, id: 'r1', startedAt: new Date() })).rejects.toThrow();
    const done = await store.updateImportRun({
      id: 'r1',
      status: 'failed',
      counts: { ...counts, created: 2 },
      error: 'boom',
      completedAt: new Date(1500),
    });
    expect(done).toMatchObject({ status: 'failed', error: 'boom', counts: { created: 2 } });
    expect((await store.listImportRuns({ importerId: 'a' })).map(run => run.id)).toEqual(['r2', 'r1']);
    expect((await store.listImportRuns({ limit: 1 })).map(run => run.id)).toEqual(['r3']);
    expect(await store.getImportRun({ id: 'missing' })).toBeNull();

    await store.updateImportOwnedPages({
      importerId: 'a',
      add: [
        { scope: 'org:acme', path: 'x' },
        { scope: 'org:acme', path: 'y' },
      ],
    });
    await store.updateImportOwnedPages({ importerId: 'a', remove: [{ scope: 'org:acme', path: 'x' }] });
    expect(await store.listImportOwnedPages({ importerId: 'a' })).toEqual([{ scope: 'org:acme', path: 'y' }]);
    expect(await store.listImportOwnedPages({ importerId: 'b' })).toEqual([]);
  });
});

describe('Knowledge importers', () => {
  it('creates pages, then reports them unchanged on a rerun', async () => {
    const source = items({ id: 'a', title: 'A', body: 'alpha' }, { id: 'b', title: 'B', body: 'beta' });
    const { knowledge, page } = setup([docsImporter(source)]);

    const first = await knowledge.runImporter('docs');
    expect(first).toMatchObject({ status: 'succeeded', counts: { created: 2, updated: 0, unchanged: 0 } });
    expect((await page('docs/a'))?.body).toBe('alpha');

    source.get('b')!.body = 'beta 2';
    const second = await knowledge.runImporter('docs');
    expect(second.counts).toMatchObject({ created: 0, updated: 1, unchanged: 1, removed: 0 });
    expect((await knowledge.listImportRuns({ importerId: 'docs' })).map(run => run.id)).toEqual([second.id, first.id]);
    expect(await knowledge.getImportRun(first.id)).toMatchObject({ id: first.id, status: 'succeeded' });
  });

  it('writes as importer:<id>', async () => {
    const { knowledge, page } = setup([docsImporter(items({ id: 'a', title: 'A', body: 'alpha' }))]);
    await knowledge.runImporter('docs');
    const storage = await knowledge.getStorage();
    const created = await page('docs/a');
    const activity = await storage.listPageActivity({ pageId: created!.id, read: 'all' });
    expect(JSON.stringify(activity)).toContain('importer:docs');
  });

  it('removes pages the source no longer has after a full run', async () => {
    const source = items({ id: 'a', title: 'A', body: 'alpha' }, { id: 'b', title: 'B', body: 'beta' });
    const { knowledge, page } = setup([docsImporter(source)]);
    await knowledge.runImporter('docs');

    source.delete('b');
    const run = await knowledge.runImporter('docs');
    expect(run.counts).toMatchObject({ unchanged: 1, removed: 1 });
    expect(await page('docs/b')).toBeNull();
    expect(await page('docs/a')).not.toBeNull();
  });

  it("doesn't remove another importer's pages or pages it kept", async () => {
    const docs = items({ id: 'a', title: 'A', body: 'alpha' });
    const other = items({ id: 'z', title: 'Z', body: 'zeta' });
    const keeper: KnowledgeImporter = {
      id: 'keeper',
      async run(ctx) {
        if (!(await ctx.state.get('ran'))) {
          await ctx.pages.upsert({ scope: 'org:acme', path: 'kept', name: 'Kept', body: 'k' });
          await ctx.state.set('ran', true);
        } else {
          ctx.pages.keep({ scope: 'org:acme', path: 'kept' });
        }
      },
    };
    const { knowledge, page } = setup([docsImporter(docs), docsImporter(other, 'other'), keeper]);
    await knowledge.runImporter('docs');
    await knowledge.runImporter('other');
    await knowledge.runImporter('keeper');

    docs.clear();
    expect((await knowledge.runImporter('docs')).counts.removed).toBe(1);
    expect(await page('docs/z')).not.toBeNull();
    expect((await knowledge.runImporter('keeper')).counts.removed).toBe(0);
    expect(await page('kept')).not.toBeNull();
  });

  it('keeps unwritten pages on an incremental run', async () => {
    const source = items({ id: 'a', title: 'A', body: 'alpha' }, { id: 'b', title: 'B', body: 'beta' });
    const { knowledge, page } = setup([docsImporter(source)]);
    await knowledge.runImporter('docs');
    source.delete('b');
    const run = await knowledge.runImporter('docs', { incremental: true });
    expect(run).toMatchObject({ incremental: true, counts: { removed: 0 } });
    expect(await page('docs/b')).not.toBeNull();
  });

  it('records a failed run and removes nothing', async () => {
    const source = items({ id: 'a', title: 'A', body: 'alpha' }, { id: 'b', title: 'B', body: 'beta' });
    let fail = false;
    const importer: KnowledgeImporter = {
      id: 'flaky',
      async run(ctx) {
        await docsImporter(fail ? items(source.get('a')!) : source).run(ctx);
        if (fail) throw new Error('source returned 500');
      },
    };
    const { knowledge, page } = setup([importer]);
    await knowledge.runImporter('flaky');
    fail = true;
    const run = await knowledge.runImporter('flaky');
    expect(run).toMatchObject({ status: 'failed', error: 'source returned 500', counts: { removed: 0 } });
    expect(run.completedAt).toBeInstanceOf(Date);
    expect(await page('docs/b')).not.toBeNull();
  });

  it('rejects a second run of the same importer while one is running', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const { knowledge } = setup([{ id: 'slow', run: () => gate }]);
    const first = knowledge.runImporter('slow');
    await expect(knowledge.runImporter('slow')).rejects.toBeInstanceOf(KnowledgeImporterBusyError);
    release();
    expect((await first).status).toBe('succeeded');
    expect((await knowledge.runImporter('slow')).status).toBe('succeeded');
  });

  it('writes nothing in a dry run but counts what it would do', async () => {
    const source = items({ id: 'a', title: 'A', body: 'alpha' }, { id: 'b', title: 'B', body: 'beta' });
    const importer: KnowledgeImporter = {
      id: 'docs',
      async run(ctx) {
        await docsImporter(source).run(ctx);
        await ctx.pages.addNote({ scope: 'org:acme', path: 'docs/a', text: 'a note' });
        await ctx.state.set('cursor', 7);
        expect(await ctx.state.get('cursor')).toBe(7);
      },
    };
    const { knowledge, page } = setup([importer]);

    const preview = await knowledge.runImporter('docs', { dryRun: true });
    expect(preview).toMatchObject({ status: 'succeeded', dryRun: true, counts: { created: 2, notes: 1 } });
    expect(await page('docs/a')).toBeNull();
    const storage = await knowledge.getStorage();
    expect(await storage.getImportState({ importerId: 'docs', key: 'cursor' })).toBeUndefined();
    expect(await storage.listImportOwnedPages({ importerId: 'docs' })).toEqual([]);

    await knowledge.runImporter('docs');
    source.delete('b');
    source.get('a')!.body = 'alpha 2';
    const second = await knowledge.runImporter('docs', { dryRun: true });
    expect(second.counts).toMatchObject({ created: 0, updated: 1, removed: 1 });
    expect((await page('docs/a'))?.body).toBe('alpha');
    expect(await page('docs/b')).not.toBeNull();
  });

  it('marks an aborted run canceled and removes nothing', async () => {
    const source = items({ id: 'a', title: 'A', body: 'alpha' }, { id: 'b', title: 'B', body: 'beta' });
    const controller = new AbortController();
    const importer: KnowledgeImporter = {
      id: 'docs',
      async run(ctx) {
        await ctx.pages.upsert({ scope: 'org:acme', path: 'docs/a', name: 'A', body: 'alpha' });
        if (ctx.options === 'abort') controller.abort();
        await ctx.pages.upsert({ scope: 'org:acme', path: 'docs/c', name: 'C', body: 'gamma' });
      },
    };
    const { knowledge, page } = setup([docsImporter(source), { ...importer, id: 'abortable' }]);
    await knowledge.runImporter('abortable');
    const run = await knowledge.runImporter('abortable', { options: 'abort', signal: controller.signal });
    expect(run.status).toBe('canceled');
    expect(await page('docs/c')).not.toBeNull();
  });

  it('finishes a started removal when aborted mid-way and records success', async () => {
    const source = items({ id: 'a', title: 'A', body: 'a' }, { id: 'b', title: 'B', body: 'b' });
    const { knowledge, page } = setup([docsImporter(source)]);
    await knowledge.runImporter('docs');
    source.clear();
    const controller = new AbortController();
    const storage = await knowledge.getStorage();
    const deletePage = storage.deletePage.bind(storage);
    storage.deletePage = async input => {
      controller.abort();
      return deletePage(input);
    };
    const run = await knowledge.runImporter('docs', { signal: controller.signal });
    expect(run.status).toBe('succeeded');
    expect(run.counts.removed).toBe(2);
    expect(await page('docs/a')).toBeNull();
    expect(await page('docs/b')).toBeNull();
  });

  it('adds, updates and removes notes', async () => {
    const importer: KnowledgeImporter = {
      id: 'notes',
      async run(ctx) {
        await ctx.pages.upsert({ scope: 'org:acme', path: 'ticket', name: 'Ticket', body: 'b' });
        const note = await ctx.pages.addNote({ scope: 'org:acme', path: 'ticket', text: 'first' });
        const edited = await ctx.pages.updateNote({ id: note.id, text: 'second' });
        await ctx.state.set('note', edited.id);
        expect(await ctx.pages.removeNote({ id: note.id })).toBe(false);
      },
    };
    const { knowledge, page } = setup([importer]);
    const run = await knowledge.runImporter('notes');
    expect(run).toMatchObject({ status: 'succeeded', counts: { notes: 2 } });
    const storage = await knowledge.getStorage();
    const notes = await storage.listNotes({ pageId: (await page('ticket'))!.id, read: 'all' });
    expect(JSON.stringify(notes)).toContain('second');
    expect(JSON.stringify(notes)).not.toContain('first');
  });

  it('validates ids and registration', () => {
    const { knowledge } = setup([{ id: 'one', run: async () => {} }]);
    expect(() => knowledge.registerImporter({ id: 'one', run: async () => {} })).toThrow(/already registered/);
    expect(() => knowledge.registerImporter({ id: 'bad id', run: async () => {} })).toThrow(/may only use/);
    expect(knowledge.listImporters().map(importer => importer.id)).toEqual(['one']);
    return expect(knowledge.runImporter('missing')).rejects.toThrow(/No Knowledge importer/);
  });
  it('never removes a page it did not create, even after writing to it', async () => {
    const source = items({ id: 'faq', title: 'FAQ', body: 'imported' });
    const { knowledge, page } = setup([docsImporter(source)]);
    await knowledge.upsertPage({
      scope: 'org:acme',
      path: 'docs/faq',
      name: 'FAQ',
      body: 'by a person',
      author: 'user:1',
    });
    await knowledge.runImporter('docs');
    source.clear();
    const run = await knowledge.runImporter('docs');
    expect(run.counts.removed).toBe(0);
    expect(await page('docs/faq')).not.toBeNull();
  });

  it('keeps a cursor unchanged when the run fails', async () => {
    const importer: KnowledgeImporter = {
      id: 'cursor',
      async run(ctx) {
        await ctx.state.set('since', 5);
        throw new Error('source down');
      },
    };
    const { knowledge } = setup([importer]);
    const run = await knowledge.runImporter('cursor', { incremental: true });
    expect(run.status).toBe('failed');
    const storage = await knowledge.getStorage();
    expect(await storage.getImportState({ importerId: 'cursor', key: 'since' })).toBeUndefined();
  });

  it('records the run failed when a stale page cannot be removed', async () => {
    const source = items({ id: 'a', title: 'A', body: 'a' });
    const { knowledge } = setup([docsImporter(source)]);
    await knowledge.runImporter('docs');
    const storage = await knowledge.getStorage();
    storage.deletePage = async () => {
      throw new Error('storage down');
    };
    source.clear();
    const run = await knowledge.runImporter('docs');
    expect(run.status).toBe('failed');
    expect(run.error).toContain('storage down');
  });
});
