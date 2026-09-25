import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImporterProviderContext } from '../importer-registry.js';
import { notionImporterRegistration } from '../providers/notion/importer.js';
import { createFakeImporter, createFakeState, runImporter, type FakeImporter } from './fixtures/importer-harness.js';

interface NotionPageFixture {
  id: string;
  title: string;
  lastEditedTime: string;
  archived?: boolean;
  propertyText?: string;
  url?: string;
  parent?: { type: string; page_id?: string; database_id?: string };
}

function pageResult(fixture: NotionPageFixture) {
  return {
    object: 'page',
    id: fixture.id,
    archived: fixture.archived ?? false,
    url: fixture.url ?? `https://www.notion.so/${fixture.id}`,
    last_edited_time: fixture.lastEditedTime,
    ...(fixture.parent ? { parent: fixture.parent } : {}),
    properties: {
      Name: { type: 'title', title: [{ plain_text: fixture.title }] },
      Notes: { type: 'rich_text', rich_text: fixture.propertyText ? [{ plain_text: fixture.propertyText }] : [] },
    },
  };
}

function searchResponse(pages: NotionPageFixture[], next?: string) {
  return {
    results: pages.map(pageResult),
    has_more: Boolean(next),
    next_cursor: next ?? null,
  };
}

const EMPTY_BLOCKS = { results: [], has_more: false, next_cursor: null };

interface NotionHarness {
  ctx: ImporterProviderContext;
  request: ReturnType<typeof vi.fn>;
  importer: FakeImporter;
  state: ReturnType<typeof createFakeState>;
  /** Queue the next `v1/search` response — pass an Error to make the call reject. */
  queueSearch: (response: unknown) => void;
  /** Queue block-children responses for a page id, consumed in order. Pass an Error to fail. */
  queueBlocks: (pageId: string, ...responses: unknown[]) => void;
  /** Recorded `v1/search` calls only (block fetches excluded). */
  searchCalls: () => Array<{ method: string; path: string; body?: Record<string, unknown> }>;
  /** Recorded `v1/blocks/:id/children` calls only. */
  blockCalls: () => Array<{ method: string; path: string; query?: Record<string, unknown> }>;
}

function makeContext(overrides?: { role?: 'owner' | 'edit' }): NotionHarness {
  const searchQueue: unknown[] = [];
  const blockQueues = new Map<string, unknown[]>();
  const request = vi.fn(async (options: { method: string; path: string; body?: unknown; query?: unknown }) => {
    if (options.path.startsWith('v1/blocks/')) {
      const pageId = options.path.split('/')[2]!;
      const queue = blockQueues.get(pageId);
      const next = queue && queue.length > 0 ? queue.shift() : EMPTY_BLOCKS;
      if (next instanceof Error) throw next;
      return next;
    }
    const next = searchQueue.length > 0 ? searchQueue.shift() : EMPTY_BLOCKS;
    if (next instanceof Error) throw next;
    return next;
  });
  const role = overrides?.role ?? 'owner';
  const ctx: ImporterProviderContext = {
    connection: { id: 'c_notion', integrationId: 'notion', status: 'active' } as never,
    request: request as unknown as ImporterProviderContext['request'],
    access: { 'org:acme': role },
    schedule: '0 * * * *',
  };
  const importer = createFakeImporter(role);
  const state = createFakeState();
  const calls = () => request.mock.calls.map(call => call[0] as { method: string; path: string });
  return {
    ctx,
    request,
    importer,
    state,
    queueSearch: response => void searchQueue.push(response),
    queueBlocks: (pageId, ...responses) => {
      const queue = blockQueues.get(pageId) ?? [];
      queue.push(...responses);
      blockQueues.set(pageId, queue);
    },
    searchCalls: () => calls().filter(call => call.path === 'v1/search') as never,
    blockCalls: () => calls().filter(call => call.path.startsWith('v1/blocks/')) as never,
  };
}

describe('notion importer', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  beforeEach(() => warnSpy?.mockRestore());

  it('exposes dynamic scopes as the cron trigger resolveBindings with the connection-bound source', async () => {
    const { ctx } = makeContext();
    const definition = notionImporterRegistration.createImporter({
      ...ctx,
      access: { 'resource:$projectId': 'owner' },
      scopes: async () => ['resource:one', 'resource:two'],
    });
    expect(definition.triggers?.cron?.bindings).toBeUndefined();
    await expect(definition.triggers!.cron!.resolveBindings!()).resolves.toEqual([
      { source: 'notion:c_notion', scope: 'resource:one' },
      { source: 'notion:c_notion', scope: 'resource:two' },
    ]);
  });

  it('first run imports every page as a node with a content-hashed record and advances the watermark', async () => {
    const harness = makeContext();
    const { ctx, importer, state } = harness;
    const pages: NotionPageFixture[] = [
      { id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z', propertyText: 'first page' },
      { id: 'p2', title: 'Beta', lastEditedTime: '2026-09-02T00:00:00Z', propertyText: 'second page' },
    ];
    harness.queueSearch(searchResponse(pages));

    const definition = notionImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });

    expect(importer.nodes.get('notion:page:p1')?.input).toMatchObject({ name: 'Alpha' });
    expect(importer.nodes.get('notion:page:p2')?.input).toMatchObject({ name: 'Beta' });
    expect(importer.nodes.get('notion:page:p1')!.records.size).toBe(1);
    expect(importer.nodes.get('notion:page:p2')!.records.size).toBe(1);
    expect(await state.get('notion:watermark')).toBe(JSON.stringify({ watermark: '2026-09-02T00:00:00Z' }));
    expect(harness.searchCalls()).toHaveLength(1);
    expect(harness.searchCalls()[0]!.method).toBe('POST');
  });

  it('second run with unchanged fixtures is idempotent — no new records', async () => {
    const harness = makeContext();
    const { ctx, importer, state } = harness;
    const pages: NotionPageFixture[] = [
      { id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z', propertyText: 'first' },
    ];
    harness.queueSearch(searchResponse(pages));
    harness.queueSearch(searchResponse(pages));

    const definition = notionImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });
    const firstSize = importer.nodes.get('notion:page:p1')!.records.size;
    await runImporter(definition, { importer, state });
    expect(importer.nodes.get('notion:page:p1')!.records.size).toBe(firstSize);
  });

  it('updated page content bumps to a new record id and removes the stale record', async () => {
    const harness = makeContext();
    const { ctx, importer, state } = harness;
    harness.queueSearch(
      searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z', propertyText: 'v1' }]),
    );
    const definition = notionImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });
    const firstIds = [...importer.nodes.get('notion:page:p1')!.records.keys()];

    harness.queueSearch(
      searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-02T00:00:00Z', propertyText: 'v2' }]),
    );
    await runImporter(definition, { importer, state });

    const secondIds = [...importer.nodes.get('notion:page:p1')!.records.keys()];
    expect(secondIds).toHaveLength(1);
    expect(secondIds[0]).not.toBe(firstIds[0]);
  });

  it('watermark advances only on success — mid-run failure leaves it untouched', async () => {
    const harness = makeContext();
    const { ctx, importer, state } = harness;
    harness.queueSearch(new Error('platform down'));
    const definition = notionImporterRegistration.createImporter(ctx);
    await expect(runImporter(definition, { importer, state })).rejects.toThrow(/platform down/);
    expect(await state.get('notion:watermark')).toBeUndefined();
  });

  it('archived pages remove importer-owned records under an owner binding', async () => {
    const harness = makeContext({ role: 'owner' });
    const { ctx, importer, state } = harness;
    harness.queueSearch(
      searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z', propertyText: 'v1' }]),
    );
    const definition = notionImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });
    expect(importer.nodes.get('notion:page:p1')!.records.size).toBe(1);

    harness.queueSearch(
      searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-02T00:00:00Z', archived: true }]),
    );
    await runImporter(definition, { importer, state });
    expect(importer.nodes.get('notion:page:p1')!.records.size).toBe(0);
  });

  it('edit-role bindings skip removals rather than mutate out-of-scope records', async () => {
    const harness = makeContext({ role: 'edit' });
    const { ctx, importer, state } = harness;
    harness.queueSearch(
      searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z', propertyText: 'v1' }]),
    );
    const definition = notionImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });

    harness.queueSearch(
      searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-02T00:00:00Z', archived: true }]),
    );
    await runImporter(definition, { importer, state });
    expect(importer.nodes.get('notion:page:p1')!.records.size).toBe(1);
  });

  it('walks multiple pages of search results until has_more is false', async () => {
    const harness = makeContext();
    const { ctx, importer, state } = harness;
    harness.queueSearch(
      searchResponse([{ id: 'p2', title: 'Beta', lastEditedTime: '2026-09-02T00:00:00Z' }], 'cursor-1'),
    );
    harness.queueSearch(searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z' }]));
    const definition = notionImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });
    expect(harness.searchCalls()).toHaveLength(2);
    expect(importer.nodes.size).toBe(2);
  });

  it('does not advance the watermark when the run bails on maxRecords before draining the descending walk', async () => {
    const harness = makeContext();
    const { ctx, importer, state } = harness;
    // First run: seed a watermark from a small, drained window so the second run has state to preserve.
    harness.queueSearch(searchResponse([{ id: 'p0', title: 'Zero', lastEditedTime: '2026-08-01T00:00:00Z' }]));
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });
    const seededWatermark = await state.get('notion:watermark');
    expect(seededWatermark).toBe(JSON.stringify({ watermark: '2026-08-01T00:00:00Z' }));

    // Second run: return a huge single page that exceeds DEFAULT_MAX_RECORDS_PER_RUN (500) without
    // crossing the watermark, then a `has_more: true` cursor. The record cap should trigger before
    // the walk reaches previousWatermark — meaning we did NOT drain, so watermark must stay and
    // the pagination cursor must be persisted so the next run resumes deeper into the tail.
    const bigPage = Array.from({ length: 501 }, (_, i) => ({
      id: `p${i + 1}`,
      title: `Page ${i + 1}`,
      lastEditedTime: `2026-09-${String((i % 30) + 1).padStart(2, '0')}T00:00:00Z`,
    }));
    harness.queueSearch(searchResponse(bigPage, 'cursor-1'));
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });
    // Watermark should still be the seeded value; not advanced past the un-fetched tail.
    expect(await state.get('notion:watermark')).toBe(seededWatermark);
    // Resume cursor persisted so the next run continues from where we stopped.
    expect(await state.get('notion:resume-cursor')).toBe(JSON.stringify({ cursor: 'cursor-1' }));
  });

  it('converges initial backfill by resuming from a persisted cursor and clearing it when drained', async () => {
    // Reproduces the previous stall: with no watermark and >500 records available, the naive
    // strategy of "don't advance watermark on truncation" would loop forever fetching the same
    // newest page. The resume cursor pushes each run further into the tail until the source
    // exhausts pagination, at which point the watermark advances and the cursor is cleared.
    const harness = makeContext();
    const { ctx, importer, state } = harness;

    // Run 1: 501 pages on the first page, has_more with cursor-A. Bails on record cap, no watermark yet.
    const pageA = Array.from({ length: 501 }, (_, i) => ({
      id: `pA${i}`,
      title: `A${i}`,
      lastEditedTime: `2026-09-30T${String(i % 24).padStart(2, '0')}:00:00Z`,
    }));
    harness.queueSearch(searchResponse(pageA, 'cursor-A'));
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });
    expect(await state.get('notion:watermark')).toBeUndefined();
    expect(await state.get('notion:resume-cursor')).toBe(JSON.stringify({ cursor: 'cursor-A' }));

    // Run 2: resumes from cursor-A. This time the source returns a partial page (< page_size),
    // so we drain. Watermark advances to the HIGH-WATER mark across BOTH runs (not this run
    // only) and cursor is cleared. The newest item across runs 1+2 is one of pageA's dates
    // (rotating hourly on 2026-09-30). Assert the watermark is on 2026-09-30, not the older
    // 2026-08-15 from pageB — which would cause the next run to re-walk the whole backfill.
    const pageB = [{ id: 'pB0', title: 'B0', lastEditedTime: '2026-08-15T00:00:00Z' }];
    harness.queueSearch(searchResponse(pageB));
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });
    // The second search call passed cursor-A as start_cursor.
    const secondCall = harness.searchCalls()[1]!;
    expect(secondCall.body).toMatchObject({ start_cursor: 'cursor-A' });
    // Drained: watermark = newest observed across BOTH runs. Since pageA had items on 2026-09-30
    // (newer than pageB's 2026-08-15), the watermark must be on 2026-09-30 — not regress to pageB.
    const storedWatermark = JSON.parse((await state.get('notion:watermark'))!).watermark as string;
    expect(storedWatermark.startsWith('2026-09-30')).toBe(true);
    expect(await state.get('notion:resume-cursor')).toBe(JSON.stringify({ cursor: '' }));
  });

  it('never regresses the watermark: a drain run resumed from a cursor uses the persisted high-water from the earlier truncated run', async () => {
    // Locks in the round-3 fix. Run 1 is the "newest" chunk; run 2 drains a tiny old tail.
    // The final watermark must reflect the newest observed across BOTH runs, not run 2's tail.
    const harness = makeContext();
    const { ctx, importer, state } = harness;
    // Run 1: no watermark, one page over the cap with has_more=true → cursor + high-water persisted.
    const newestChunk = Array.from({ length: 501 }, (_, i) => ({
      id: `n${i}`,
      title: `N${i}`,
      lastEditedTime: `2026-09-30T${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`,
    }));
    harness.queueSearch(searchResponse(newestChunk, 'cursor-1'));
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });
    // High-water persisted from run 1.
    expect(await state.get('notion:high-water')).toBeDefined();
    const runOneHighWater = JSON.parse((await state.get('notion:high-water'))!).highWater as string;
    expect(runOneHighWater.startsWith('2026-09-30')).toBe(true);

    // Run 2: resumes, drains with a single much-older item. Watermark must still be 2026-09-30.
    harness.queueSearch(searchResponse([{ id: 'nOld', title: 'Old', lastEditedTime: '2026-01-01T00:00:00Z' }]));
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });
    const finalWatermark = JSON.parse((await state.get('notion:watermark'))!).watermark as string;
    expect(finalWatermark).toBe(runOneHighWater);
    // High-water and resume cursor both cleared on drain.
    expect(await state.get('notion:high-water')).toBe(JSON.stringify({ highWater: '' }));
    expect(await state.get('notion:resume-cursor')).toBe(JSON.stringify({ cursor: '' }));
  });

  it('rejects malformed payloads via zod so the run fails and the watermark is preserved', async () => {
    const harness = makeContext();
    const { ctx, importer, state } = harness;
    harness.queueSearch({ results: [{ object: 'page' }] });
    const definition = notionImporterRegistration.createImporter(ctx);
    await expect(runImporter(definition, { importer, state })).rejects.toThrow();
    expect(await state.get('notion:watermark')).toBeUndefined();
  });

  it('appends block body text to the record with wikilink brackets neutralized', async () => {
    const harness = makeContext();
    const { ctx, importer, state } = harness;
    harness.queueSearch(searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z' }]));
    harness.queueBlocks('p1', {
      results: [
        { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Body copy about [[Beta]] page' }] } },
        { type: 'heading_2', heading_2: { rich_text: [{ plain_text: 'Section' }] } },
      ],
      has_more: false,
      next_cursor: null,
    });
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });

    const record = [...importer.nodes.get('notion:page:p1')!.records.values()][0]!;
    expect(record.text).toContain('Body copy about ［［Beta］］ page');
    expect(record.text).toContain('Section');
    expect(record.text).not.toContain('[[');
  });

  it('stamps node self-address metadata and emits parent + reference links, deduped, ignoring child_page blocks', async () => {
    const harness = makeContext();
    const { ctx, importer, state } = harness;
    harness.queueSearch(
      searchResponse([
        {
          id: 'p1',
          title: 'Alpha',
          lastEditedTime: '2026-09-01T00:00:00Z',
          parent: { type: 'page_id', page_id: 'p-parent' },
        },
      ]),
    );
    harness.queueBlocks('p1', {
      results: [
        { type: 'link_to_page', link_to_page: { type: 'page_id', page_id: 'p2' } },
        // Duplicate of the link_to_page target via a mention — must dedup.
        {
          type: 'paragraph',
          paragraph: { rich_text: [{ plain_text: 'see', mention: { type: 'page', page: { id: 'p2' } } }] },
        },
        {
          type: 'paragraph',
          paragraph: { rich_text: [{ plain_text: 'db', mention: { type: 'database', database: { id: 'db9' } } }] },
        },
        // Containment is emitted by the child via `parent`, never from child_page blocks.
        { type: 'child_page', child_page: { title: 'Nested' } },
        { type: 'child_database', child_database: { title: 'Nested DB' } },
      ],
      has_more: false,
      next_cursor: null,
    });
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });

    const node = importer.nodes.get('notion:page:p1')!;
    expect(node.input.metadata).toEqual({ address: 'notion:page:p1' });
    const record = [...node.records.values()][0]!;
    const links = (record.metadata as { links: unknown[] }).links;
    expect(links).toEqual([
      { address: 'notion:database:db9', rel: 'references' },
      { address: 'notion:page:p-parent', rel: 'child-of' },
      { address: 'notion:page:p2', rel: 'references' },
    ]);
  });

  it('extracts reference links from rich-text hrefs carrying a notion.so page id', async () => {
    const harness = makeContext();
    const { ctx, importer, state } = harness;
    harness.queueSearch(searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z' }]));
    harness.queueBlocks('p1', {
      results: [
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                plain_text: 'linked',
                href: 'https://www.notion.so/Some-Page-0123456789abcdef0123456789abcdef',
              },
            ],
          },
        },
      ],
      has_more: false,
      next_cursor: null,
    });
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });

    const record = [...importer.nodes.get('notion:page:p1')!.records.values()][0]!;
    expect((record.metadata as { links: unknown[] }).links).toEqual([
      { address: 'notion:page:01234567-89ab-cdef-0123-456789abcdef', rel: 'references' },
    ]);
  });

  it('a block-fetch failure leaves an existing good record untouched', async () => {
    const harness = makeContext();
    const { ctx, importer, state } = harness;
    harness.queueSearch(searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z' }]));
    harness.queueBlocks('p1', {
      results: [{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'good body' }] } }],
      has_more: false,
      next_cursor: null,
    });
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });
    const goodRecordId = [...importer.nodes.get('notion:page:p1')!.records.keys()][0]!;

    // Re-edit: block fetch now fails — the good record must survive untouched.
    harness.queueSearch(searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-02T00:00:00Z' }]));
    harness.queueBlocks('p1', new Error('notion 500'));
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });

    const records = importer.nodes.get('notion:page:p1')!.records;
    expect([...records.keys()]).toEqual([goodRecordId]);
    expect([...records.values()][0]!.text).toContain('good body');
  });

  it('a block-fetch failure on a brand-new page still produces a title-only record', async () => {
    const harness = makeContext();
    const { ctx, importer, state } = harness;
    harness.queueSearch(searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z' }]));
    harness.queueBlocks('p1', new Error('notion 500'));
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });

    const node = importer.nodes.get('notion:page:p1')!;
    expect(node.records.size).toBe(1);
    expect([...node.records.values()][0]!.text).toContain('Alpha');
    // Run completed despite the failure — watermark advanced.
    expect(await state.get('notion:watermark')).toBe(JSON.stringify({ watermark: '2026-09-01T00:00:00Z' }));
  });

  it('stops block fetching at the per-entity request budget', async () => {
    const harness = makeContext();
    const { ctx, importer, state } = harness;
    harness.queueSearch(searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z' }]));
    const blockPage = (marker: string, next?: string) => ({
      results: [{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: marker }] } }],
      has_more: Boolean(next),
      next_cursor: next ?? null,
    });
    // Endless pagination — the importer must stop after MAX_BLOCK_REQUESTS_PER_ENTITY fetches.
    const markers = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
    harness.queueBlocks('p1', ...markers.map((marker, i) => blockPage(marker, `c${i + 1}`)));
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });

    expect(harness.blockCalls()).toHaveLength(8);
    const record = [...importer.nodes.get('notion:page:p1')!.records.values()][0]!;
    expect(record.text).toContain('eight');
    expect(record.text).not.toContain('nine');
  });

  it('descends into nested blocks and keeps document order', async () => {
    const harness = makeContext();
    const { ctx, importer, state } = harness;
    harness.queueSearch(searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z' }]));
    harness.queueBlocks('p1', {
      results: [
        {
          type: 'column_list',
          id: 'cl1',
          has_children: true,
          column_list: {},
        },
        { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'after columns' }] } },
      ],
      has_more: false,
      next_cursor: null,
    });
    harness.queueBlocks('cl1', {
      results: [{ type: 'column', id: 'col1', has_children: true, column: {} }],
      has_more: false,
      next_cursor: null,
    });
    harness.queueBlocks('col1', {
      results: [{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'inside a column' }] } }],
      has_more: false,
      next_cursor: null,
    });
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });

    const record = [...importer.nodes.get('notion:page:p1')!.records.values()][0]!;
    expect(record.text.indexOf('inside a column')).toBeGreaterThan(-1);
    expect(record.text.indexOf('inside a column')).toBeLessThan(record.text.indexOf('after columns'));
  });

  it('does not descend into child_page blocks', async () => {
    const harness = makeContext();
    const { ctx, importer, state } = harness;
    harness.queueSearch(searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z' }]));
    harness.queueBlocks('p1', {
      results: [
        { type: 'child_page', id: 'cp1', has_children: true, child_page: { title: 'Sub page' } },
        { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'own body' }] } },
      ],
      has_more: false,
      next_cursor: null,
    });
    harness.queueBlocks('cp1', {
      results: [{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'sub page body' }] } }],
      has_more: false,
      next_cursor: null,
    });
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });

    const record = [...importer.nodes.get('notion:page:p1')!.records.values()][0]!;
    expect(record.text).toContain('own body');
    expect(record.text).not.toContain('sub page body');
    // Only the page itself was fetched — the child page's blocks were never requested.
    expect(harness.blockCalls().map(call => call.path)).toEqual(['v1/blocks/p1/children']);
  });

  it('extracts text from code, to_do, and table_row blocks', async () => {
    const harness = makeContext();
    const { ctx, importer, state } = harness;
    harness.queueSearch(searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z' }]));
    harness.queueBlocks('p1', {
      results: [
        { type: 'code', code: { rich_text: [{ plain_text: 'const x = 1;' }], language: 'typescript' } },
        { type: 'to_do', to_do: { rich_text: [{ plain_text: 'ship the fix' }], checked: false } },
        { type: 'table', id: 't1', has_children: true, table: { table_width: 2 } },
      ],
      has_more: false,
      next_cursor: null,
    });
    harness.queueBlocks('t1', {
      results: [
        {
          type: 'table_row',
          table_row: { cells: [[{ plain_text: 'Owner' }], [{ plain_text: 'Charlie' }]] },
        },
      ],
      has_more: false,
      next_cursor: null,
    });
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });

    const record = [...importer.nodes.get('notion:page:p1')!.records.values()][0]!;
    expect(record.text).toContain('const x = 1;');
    expect(record.text).toContain('ship the fix');
    expect(record.text).toContain('OwnerCharlie');
  });

  it('a link change alone produces a new content-hash record and removes the stale one', async () => {
    const harness = makeContext();
    const { ctx, importer, state } = harness;
    const page = { id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z' };
    harness.queueSearch(searchResponse([page]));
    harness.queueBlocks('p1', {
      results: [{ type: 'link_to_page', link_to_page: { type: 'page_id', page_id: 'p2' } }],
      has_more: false,
      next_cursor: null,
    });
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });
    const firstId = [...importer.nodes.get('notion:page:p1')!.records.keys()][0]!;

    // Same title/body, different link target — the record id must change.
    harness.queueSearch(searchResponse([{ ...page, lastEditedTime: '2026-09-02T00:00:00Z' }]));
    harness.queueBlocks('p1', {
      results: [{ type: 'link_to_page', link_to_page: { type: 'page_id', page_id: 'p3' } }],
      has_more: false,
      next_cursor: null,
    });
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });

    const ids = [...importer.nodes.get('notion:page:p1')!.records.keys()];
    expect(ids).toHaveLength(1);
    expect(ids[0]).not.toBe(firstId);
  });

  it('skips a self-referencing link and a workspace parent', async () => {
    const harness = makeContext();
    const { ctx, importer, state } = harness;
    harness.queueSearch(
      searchResponse([
        { id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z', parent: { type: 'workspace' } },
      ]),
    );
    harness.queueBlocks('p1', {
      results: [{ type: 'link_to_page', link_to_page: { type: 'page_id', page_id: 'p1' } }],
      has_more: false,
      next_cursor: null,
    });
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });

    const record = [...importer.nodes.get('notion:page:p1')!.records.values()][0]!;
    expect((record.metadata as { links?: unknown[] }).links).toBeUndefined();
  });
});
