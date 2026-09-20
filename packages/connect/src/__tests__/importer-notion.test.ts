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

  it('rejects malformed payloads via zod so the run fails and the watermark is preserved', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce({ results: [{ object: 'page' }] });
    const definition = notionImporterRegistration.createImporter(ctx);
    await expect(runImporter(definition, { importer, state })).rejects.toThrow();
    expect(await state.get('notion:watermark')).toBeUndefined();
  });
});
