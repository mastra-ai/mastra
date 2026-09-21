import { describe, expect, it, vi } from 'vitest';

import type { ImporterProviderContext } from '../importer-registry.js';
import { zendeskImporterRegistration } from '../providers/zendesk/importer.js';
import { createFakeImporter, createFakeState, runImporter, type FakeImporter } from './fixtures/importer-harness.js';

interface ZendeskArticleFixture {
  id: number;
  title?: string;
  body?: string;
  draft?: boolean;
  locale?: string;
  updated_at?: string;
}

function articleNode(fixture: ZendeskArticleFixture) {
  return {
    id: fixture.id,
    title: fixture.title ?? null,
    body: fixture.body ?? null,
    draft: fixture.draft ?? false,
    locale: fixture.locale ?? 'en-us',
    updated_at: fixture.updated_at,
    html_url: `https://acme.zendesk.com/hc/en-us/articles/${fixture.id}`,
  };
}

function incrementalResponse(
  articles: ZendeskArticleFixture[],
  opts: { end_time?: number | null; next_page?: string | null } = {},
) {
  return {
    articles: articles.map(articleNode),
    end_time: opts.end_time ?? null,
    next_page: opts.next_page ?? null,
  };
}

function makeContext(overrides?: { role?: 'owner' | 'edit'; request?: ReturnType<typeof vi.fn> }): {
  ctx: ImporterProviderContext;
  request: ReturnType<typeof vi.fn>;
  importer: FakeImporter;
  state: ReturnType<typeof createFakeState>;
} {
  const request = overrides?.request ?? vi.fn(async () => ({ articles: [], end_time: null, next_page: null }));
  const role = overrides?.role ?? 'owner';
  const ctx: ImporterProviderContext = {
    connection: { id: 'c_zendesk', integrationId: 'zendesk', status: 'active' } as never,
    request: request as ImporterProviderContext['request'],
    access: { 'org:acme': role },
    schedule: '*/30 * * * *',
  };
  return { ctx, request, importer: createFakeImporter(role), state: createFakeState() };
}

describe('zendesk importer', () => {
  it('first run imports every published article as a node with a content-hashed record', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      incrementalResponse(
        [
          { id: 1, title: 'Getting started', body: '<p>first</p>', updated_at: '2026-09-01T00:00:00Z' },
          { id: 2, title: 'FAQ', body: '<p>second</p>', updated_at: '2026-09-02T00:00:00Z' },
        ],
        { end_time: 1_780_000_000 },
      ),
    );
    await runImporter(zendeskImporterRegistration.createImporter(ctx), { importer, state });
    expect(importer.nodes.get('zendesk:article:1')?.input).toMatchObject({
      name: 'Getting started',
      kind: 'connect:zendesk:article',
    });
    expect(importer.nodes.get('zendesk:article:2')?.records.size).toBe(1);
    const call = request.mock.calls[0]![0]! as { method: string; path: string; query: Record<string, unknown> };
    expect(call.method).toBe('GET');
    expect(call.path).toBe('api/v2/help_center/incremental/articles.json');
    expect(call.query.start_time).toBe(0);
  });

  it('strips HTML from article bodies before storing records', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      incrementalResponse(
        [
          {
            id: 1,
            title: 'Styling',
            body: '<h1>Header</h1><p>Some <strong>bold</strong> text &amp; more</p><script>alert(1)</script>',
            updated_at: '2026-09-01T00:00:00Z',
          },
        ],
        { end_time: 1_780_000_000 },
      ),
    );
    await runImporter(zendeskImporterRegistration.createImporter(ctx), { importer, state });
    const records = [...importer.nodes.get('zendesk:article:1')!.records.values()];
    expect(records[0]!.text).toBe('Styling\n\nHeader Some bold text & more');
  });

  it('stores end_time as the watermark and resumes from it on the next run', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      incrementalResponse([{ id: 1, title: 'A', body: 'x', updated_at: '2026-09-01T00:00:00Z' }], {
        end_time: 1_780_000_123,
      }),
    );
    await runImporter(zendeskImporterRegistration.createImporter(ctx), { importer, state });
    expect(await state.get('zendesk:articles:watermark')).toBe(JSON.stringify({ watermark: '1780000123' }));

    request.mockResolvedValueOnce(incrementalResponse([], {}));
    await runImporter(zendeskImporterRegistration.createImporter(ctx), { importer, state });
    const secondCall = request.mock.calls[1]![0]! as { query: Record<string, unknown> };
    expect(secondCall.query.start_time).toBe(1_780_000_123);
  });

  it('walks continuation pages while end_time advances and next_page is present', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      incrementalResponse([{ id: 1, title: 'A', body: 'x', updated_at: '2026-09-01T00:00:00Z' }], {
        end_time: 100,
        next_page: 'https://acme.zendesk.com/next',
      }),
    );
    request.mockResolvedValueOnce(
      incrementalResponse([{ id: 2, title: 'B', body: 'y', updated_at: '2026-09-02T00:00:00Z' }], { end_time: 200 }),
    );
    await runImporter(zendeskImporterRegistration.createImporter(ctx), { importer, state });
    expect(request).toHaveBeenCalledTimes(2);
    expect(importer.nodes.size).toBe(2);
    const secondCall = request.mock.calls[1]![0]! as { query: Record<string, unknown> };
    expect(secondCall.query.start_time).toBe(100);
    expect(await state.get('zendesk:articles:watermark')).toBe(JSON.stringify({ watermark: '200' }));
  });

  it('stops when end_time stops advancing — no infinite loop on a caught-up export', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValue(
      incrementalResponse([{ id: 1, title: 'A', body: 'x', updated_at: '2026-09-01T00:00:00Z' }], {
        end_time: 0,
        next_page: 'https://acme.zendesk.com/next',
      }),
    );
    await runImporter(zendeskImporterRegistration.createImporter(ctx), { importer, state });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('second run with unchanged fixtures is idempotent', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValue(
      incrementalResponse([{ id: 1, title: 'A', body: 'x', updated_at: '2026-09-01T00:00:00Z' }], { end_time: 100 }),
    );
    await runImporter(zendeskImporterRegistration.createImporter(ctx), { importer, state });
    const first = importer.nodes.get('zendesk:article:1')!.records.size;
    await runImporter(zendeskImporterRegistration.createImporter(ctx), { importer, state });
    expect(importer.nodes.get('zendesk:article:1')!.records.size).toBe(first);
  });

  it('updated article bumps to a new record id and removes the stale record under owner', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      incrementalResponse([{ id: 1, title: 'A', body: 'v1', updated_at: '2026-09-01T00:00:00Z' }], { end_time: 100 }),
    );
    await runImporter(zendeskImporterRegistration.createImporter(ctx), { importer, state });
    const firstIds = [...importer.nodes.get('zendesk:article:1')!.records.keys()];
    request.mockResolvedValueOnce(
      incrementalResponse([{ id: 1, title: 'A', body: 'v2', updated_at: '2026-09-02T00:00:00Z' }], { end_time: 200 }),
    );
    await runImporter(zendeskImporterRegistration.createImporter(ctx), { importer, state });
    const secondIds = [...importer.nodes.get('zendesk:article:1')!.records.keys()];
    expect(secondIds).toHaveLength(1);
    expect(secondIds[0]).not.toBe(firstIds[0]);
  });

  it('draft articles remove published records under owner but are skipped under edit', async () => {
    const owner = makeContext({ role: 'owner' });
    owner.request.mockResolvedValueOnce(
      incrementalResponse([{ id: 1, title: 'A', body: 'v1', updated_at: '2026-09-01T00:00:00Z' }], { end_time: 100 }),
    );
    await runImporter(zendeskImporterRegistration.createImporter(owner.ctx), owner);
    owner.request.mockResolvedValueOnce(
      incrementalResponse([{ id: 1, title: 'A', body: 'v1', draft: true, updated_at: '2026-09-02T00:00:00Z' }], {
        end_time: 200,
      }),
    );
    await runImporter(zendeskImporterRegistration.createImporter(owner.ctx), owner);
    expect(owner.importer.nodes.get('zendesk:article:1')!.records.size).toBe(0);

    const edit = makeContext({ role: 'edit' });
    edit.request.mockResolvedValueOnce(
      incrementalResponse([{ id: 1, title: 'A', body: 'v1', updated_at: '2026-09-01T00:00:00Z' }], { end_time: 100 }),
    );
    await runImporter(zendeskImporterRegistration.createImporter(edit.ctx), edit);
    edit.request.mockResolvedValueOnce(
      incrementalResponse([{ id: 1, title: 'A', body: 'v1', draft: true, updated_at: '2026-09-02T00:00:00Z' }], {
        end_time: 200,
      }),
    );
    await runImporter(zendeskImporterRegistration.createImporter(edit.ctx), edit);
    expect(edit.importer.nodes.get('zendesk:article:1')!.records.size).toBe(1);
  });

  it('watermark advances only on success — a failing request leaves it untouched', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockRejectedValueOnce(new Error('platform down'));
    await expect(runImporter(zendeskImporterRegistration.createImporter(ctx), { importer, state })).rejects.toThrow(
      /platform down/,
    );
    expect(await state.get('zendesk:articles:watermark')).toBeUndefined();
  });

  it('rejects malformed payloads via zod', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce({ articles: [{ id: 'not-a-number' }] });
    await expect(runImporter(zendeskImporterRegistration.createImporter(ctx), { importer, state })).rejects.toThrow();
    expect(await state.get('zendesk:articles:watermark')).toBeUndefined();
  });
});
