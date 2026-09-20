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
}

function pageResult(fixture: NotionPageFixture) {
  return {
    object: 'page',
    id: fixture.id,
    archived: fixture.archived ?? false,
    url: fixture.url ?? `https://www.notion.so/${fixture.id}`,
    last_edited_time: fixture.lastEditedTime,
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

function makeContext(overrides?: { role?: 'owner' | 'edit'; request?: ReturnType<typeof vi.fn> }): {
  ctx: ImporterProviderContext;
  request: ReturnType<typeof vi.fn>;
  importer: FakeImporter;
  state: ReturnType<typeof createFakeState>;
} {
  const request = overrides?.request ?? vi.fn(async () => ({ results: [], has_more: false, next_cursor: null }));
  const role = overrides?.role ?? 'owner';
  const ctx: ImporterProviderContext = {
    connection: { id: 'c_notion', integrationId: 'notion', status: 'active' } as never,
    request: request as ImporterProviderContext['request'],
    access: { 'org:acme': role },
    schedule: '0 * * * *',
  };
  const importer = createFakeImporter(role);
  const state = createFakeState();
  return { ctx, request, importer, state };
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
    const { ctx, request, importer, state } = makeContext();
    const pages: NotionPageFixture[] = [
      { id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z', propertyText: 'first page' },
      { id: 'p2', title: 'Beta', lastEditedTime: '2026-09-02T00:00:00Z', propertyText: 'second page' },
    ];
    request.mockResolvedValueOnce(searchResponse(pages));

    const definition = notionImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });

    expect(importer.nodes.get('notion:page:p1')?.input).toMatchObject({ name: 'Alpha' });
    expect(importer.nodes.get('notion:page:p2')?.input).toMatchObject({ name: 'Beta' });
    expect(importer.nodes.get('notion:page:p1')!.records.size).toBe(1);
    expect(importer.nodes.get('notion:page:p2')!.records.size).toBe(1);
    expect(await state.get('notion:watermark')).toBe(JSON.stringify({ watermark: '2026-09-02T00:00:00Z' }));
    expect(request).toHaveBeenCalledTimes(1);
    const callArg = request.mock.calls[0]![0]! as { method: string; path: string };
    expect(callArg.method).toBe('POST');
    expect(callArg.path).toBe('v1/search');
  });

  it('second run with unchanged fixtures is idempotent — no new records', async () => {
    const { ctx, request, importer, state } = makeContext();
    const pages: NotionPageFixture[] = [
      { id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z', propertyText: 'first' },
    ];
    request.mockResolvedValue(searchResponse(pages));

    const definition = notionImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });
    const firstSize = importer.nodes.get('notion:page:p1')!.records.size;
    await runImporter(definition, { importer, state });
    expect(importer.nodes.get('notion:page:p1')!.records.size).toBe(firstSize);
  });

  it('updated page content bumps to a new record id and removes the stale record', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z', propertyText: 'v1' }]),
    );
    const definition = notionImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });
    const firstIds = [...importer.nodes.get('notion:page:p1')!.records.keys()];

    request.mockResolvedValueOnce(
      searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-02T00:00:00Z', propertyText: 'v2' }]),
    );
    await runImporter(definition, { importer, state });

    const secondIds = [...importer.nodes.get('notion:page:p1')!.records.keys()];
    expect(secondIds).toHaveLength(1);
    expect(secondIds[0]).not.toBe(firstIds[0]);
  });

  it('watermark advances only on success — mid-run failure leaves it untouched', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockRejectedValueOnce(new Error('platform down'));
    const definition = notionImporterRegistration.createImporter(ctx);
    await expect(runImporter(definition, { importer, state })).rejects.toThrow(/platform down/);
    expect(await state.get('notion:watermark')).toBeUndefined();
  });

  it('archived pages remove importer-owned records under an owner binding', async () => {
    const { ctx, request, importer, state } = makeContext({ role: 'owner' });
    request.mockResolvedValueOnce(
      searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z', propertyText: 'v1' }]),
    );
    const definition = notionImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });
    expect(importer.nodes.get('notion:page:p1')!.records.size).toBe(1);

    request.mockResolvedValueOnce(
      searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-02T00:00:00Z', archived: true }]),
    );
    await runImporter(definition, { importer, state });
    expect(importer.nodes.get('notion:page:p1')!.records.size).toBe(0);
  });

  it('edit-role bindings skip removals rather than mutate out-of-scope records', async () => {
    const { ctx, request, importer, state } = makeContext({ role: 'edit' });
    request.mockResolvedValueOnce(
      searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z', propertyText: 'v1' }]),
    );
    const definition = notionImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });

    request.mockResolvedValueOnce(
      searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-02T00:00:00Z', archived: true }]),
    );
    await runImporter(definition, { importer, state });
    expect(importer.nodes.get('notion:page:p1')!.records.size).toBe(1);
  });

  it('walks multiple pages of search results until has_more is false', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      searchResponse([{ id: 'p2', title: 'Beta', lastEditedTime: '2026-09-02T00:00:00Z' }], 'cursor-1'),
    );
    request.mockResolvedValueOnce(
      searchResponse([{ id: 'p1', title: 'Alpha', lastEditedTime: '2026-09-01T00:00:00Z' }]),
    );
    const definition = notionImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });
    expect(request).toHaveBeenCalledTimes(2);
    expect(importer.nodes.size).toBe(2);
  });

  it('does not advance the watermark when the run bails on maxRecords before draining the descending walk', async () => {
    const { ctx, request, importer, state } = makeContext();
    // First run: seed a watermark from a small, drained window so the second run has state to preserve.
    request.mockResolvedValueOnce(
      searchResponse([{ id: 'p0', title: 'Zero', lastEditedTime: '2026-08-01T00:00:00Z' }]),
    );
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
    request.mockResolvedValueOnce(searchResponse(bigPage, 'cursor-1'));
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
    const { ctx, request, importer, state } = makeContext();

    // Run 1: 501 pages on the first page, has_more with cursor-A. Bails on record cap, no watermark yet.
    const pageA = Array.from({ length: 501 }, (_, i) => ({
      id: `pA${i}`,
      title: `A${i}`,
      lastEditedTime: `2026-09-30T${String(i % 24).padStart(2, '0')}:00:00Z`,
    }));
    request.mockResolvedValueOnce(searchResponse(pageA, 'cursor-A'));
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });
    expect(await state.get('notion:watermark')).toBeUndefined();
    expect(await state.get('notion:resume-cursor')).toBe(JSON.stringify({ cursor: 'cursor-A' }));

    // Run 2: resumes from cursor-A. This time the source returns a partial page (< page_size),
    // so we drain. Watermark advances to the HIGH-WATER mark across BOTH runs (not this run
    // only) and cursor is cleared. The newest item across runs 1+2 is one of pageA's dates
    // (rotating hourly on 2026-09-30). Assert the watermark is on 2026-09-30, not the older
    // 2026-08-15 from pageB — which would cause the next run to re-walk the whole backfill.
    const pageB = [{ id: 'pB0', title: 'B0', lastEditedTime: '2026-08-15T00:00:00Z' }];
    request.mockResolvedValueOnce(searchResponse(pageB));
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });
    // The second call passed cursor-A as start_cursor.
    const secondCall = request.mock.calls[1]![0]!;
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
    const { ctx, request, importer, state } = makeContext();
    // Run 1: no watermark, one page over the cap with has_more=true → cursor + high-water persisted.
    const newestChunk = Array.from({ length: 501 }, (_, i) => ({
      id: `n${i}`,
      title: `N${i}`,
      lastEditedTime: `2026-09-30T${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`,
    }));
    request.mockResolvedValueOnce(searchResponse(newestChunk, 'cursor-1'));
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });
    // High-water persisted from run 1.
    expect(await state.get('notion:high-water')).toBeDefined();
    const runOneHighWater = JSON.parse((await state.get('notion:high-water'))!).highWater as string;
    expect(runOneHighWater.startsWith('2026-09-30')).toBe(true);

    // Run 2: resumes, drains with a single much-older item. Watermark must still be 2026-09-30.
    request.mockResolvedValueOnce(
      searchResponse([{ id: 'nOld', title: 'Old', lastEditedTime: '2026-01-01T00:00:00Z' }]),
    );
    await runImporter(notionImporterRegistration.createImporter(ctx), { importer, state });
    const finalWatermark = JSON.parse((await state.get('notion:watermark'))!).watermark as string;
    expect(finalWatermark).toBe(runOneHighWater);
    // High-water and resume cursor both cleared on drain.
    expect(await state.get('notion:high-water')).toBe(JSON.stringify({ highWater: '' }));
    expect(await state.get('notion:resume-cursor')).toBe(JSON.stringify({ cursor: '' }));
  });

  it('rejects malformed payloads via zod so the run fails and the watermark is preserved', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce({ results: [{ object: 'page' }] });
    const definition = notionImporterRegistration.createImporter(ctx);
    await expect(runImporter(definition, { importer, state })).rejects.toThrow();
    expect(await state.get('notion:watermark')).toBeUndefined();
  });
});
