import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImporterProviderContext } from '../importer-registry.js';
import { confluenceImporterRegistration } from '../providers/confluence/importer.js';
import { createFakeImporter, createFakeState, runImporter, type FakeImporter } from './fixtures/importer-harness.js';

interface ConfluencePageFixture {
  id: string;
  title: string;
  lastModified: string;
  version?: number;
  body?: string;
  status?: string;
  spaceKey?: string;
  ancestors?: { id: string; title?: string }[];
}

function pageResult(fixture: ConfluencePageFixture) {
  return {
    id: fixture.id,
    type: 'page',
    title: fixture.title,
    status: fixture.status ?? 'current',
    version: { number: fixture.version ?? 1, when: fixture.lastModified },
    space: { key: fixture.spaceKey ?? 'ENG' },
    body: { storage: { value: fixture.body ?? '' } },
    _links: { webui: `/wiki/spaces/${fixture.spaceKey ?? 'ENG'}/pages/${fixture.id}` },
    history: { lastUpdated: { when: fixture.lastModified } },
    ...(fixture.ancestors ? { ancestors: fixture.ancestors } : {}),
  };
}

function searchResponse(pages: ConfluencePageFixture[], hasNext = false) {
  return {
    results: pages.map(pageResult),
    _links: hasNext ? { next: '/wiki/...' } : {},
    size: pages.length,
  };
}

function makeContext(overrides?: { role?: 'owner' | 'edit'; request?: ReturnType<typeof vi.fn> }): {
  ctx: ImporterProviderContext;
  request: ReturnType<typeof vi.fn>;
  importer: FakeImporter;
  state: ReturnType<typeof createFakeState>;
} {
  const request = overrides?.request ?? vi.fn(async () => ({ results: [], _links: {} }));
  const role = overrides?.role ?? 'owner';
  const ctx: ImporterProviderContext = {
    connection: { id: 'c_conf', integrationId: 'confluence', status: 'active' } as never,
    request: request as ImporterProviderContext['request'],
    access: { 'org:acme': role },
    schedule: '0 * * * *',
  };
  const importer = createFakeImporter(role);
  const state = createFakeState();
  return { ctx, request, importer, state };
}

describe('confluence importer', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  beforeEach(() => warnSpy?.mockRestore());

  it('first run imports every page and advances the watermark', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      searchResponse([
        { id: 'p1', title: 'Alpha', lastModified: '2026-09-01T00:00:00Z', body: '<p>hello</p>' },
        { id: 'p2', title: 'Beta', lastModified: '2026-09-02T00:00:00Z', body: '<p>world</p>' },
      ]),
    );

    const definition = confluenceImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });

    expect(importer.nodes.get('confluence:page:p1')?.input.name).toBe('Alpha');
    expect(importer.nodes.get('confluence:page:p2')?.input.name).toBe('Beta');
    expect(await state.get('confluence:watermark')).toBe(JSON.stringify({ watermark: '2026-09-02T00:00:00Z' }));
    const call = request.mock.calls[0]![0]! as { method: string; path: string; query: Record<string, unknown> };
    expect(call.method).toBe('GET');
    expect(call.path).toBe('wiki/rest/api/content/search');
    expect(call.query.cql).toContain('order by lastmodified asc');
  });

  it('second run with unchanged fixtures is idempotent — no new records', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValue(
      searchResponse([{ id: 'p1', title: 'Alpha', lastModified: '2026-09-01T00:00:00Z', body: '<p>hi</p>' }]),
    );
    const definition = confluenceImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });
    const firstSize = importer.nodes.get('confluence:page:p1')!.records.size;
    await runImporter(definition, { importer, state });
    expect(importer.nodes.get('confluence:page:p1')!.records.size).toBe(firstSize);
  });

  it('updated body bumps the record id and removes the stale one', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      searchResponse([{ id: 'p1', title: 'Alpha', lastModified: '2026-09-01T00:00:00Z', body: '<p>v1</p>' }]),
    );
    const definition = confluenceImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });
    const firstIds = [...importer.nodes.get('confluence:page:p1')!.records.keys()];

    request.mockResolvedValueOnce(
      searchResponse([
        { id: 'p1', title: 'Alpha', lastModified: '2026-09-02T00:00:00Z', version: 2, body: '<p>v2</p>' },
      ]),
    );
    await runImporter(definition, { importer, state });
    const secondIds = [...importer.nodes.get('confluence:page:p1')!.records.keys()];
    expect(secondIds).toHaveLength(1);
    expect(secondIds[0]).not.toBe(firstIds[0]);
  });

  it('watermark advances only on success — mid-run failure leaves it untouched', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockRejectedValueOnce(new Error('confluence unreachable'));
    const definition = confluenceImporterRegistration.createImporter(ctx);
    await expect(runImporter(definition, { importer, state })).rejects.toThrow(/confluence/);
    expect(await state.get('confluence:watermark')).toBeUndefined();
  });

  it('deleted status removes records under an owner binding', async () => {
    const { ctx, request, importer, state } = makeContext({ role: 'owner' });
    request.mockResolvedValueOnce(
      searchResponse([{ id: 'p1', title: 'Alpha', lastModified: '2026-09-01T00:00:00Z', body: '<p>x</p>' }]),
    );
    const definition = confluenceImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });
    expect(importer.nodes.get('confluence:page:p1')!.records.size).toBe(1);

    request.mockResolvedValueOnce(
      searchResponse([{ id: 'p1', title: 'Alpha', lastModified: '2026-09-02T00:00:00Z', status: 'trashed' }]),
    );
    await runImporter(definition, { importer, state });
    expect(importer.nodes.get('confluence:page:p1')!.records.size).toBe(0);
  });

  it('edit-role bindings skip removals', async () => {
    const { ctx, request, importer, state } = makeContext({ role: 'edit' });
    request.mockResolvedValueOnce(
      searchResponse([{ id: 'p1', title: 'Alpha', lastModified: '2026-09-01T00:00:00Z', body: '<p>x</p>' }]),
    );
    const definition = confluenceImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });

    request.mockResolvedValueOnce(
      searchResponse([{ id: 'p1', title: 'Alpha', lastModified: '2026-09-02T00:00:00Z', status: 'trashed' }]),
    );
    await runImporter(definition, { importer, state });
    expect(importer.nodes.get('confluence:page:p1')!.records.size).toBe(1);
  });

  it('walks paginated results while _links.next is present', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      searchResponse([{ id: 'p1', title: 'Alpha', lastModified: '2026-09-01T00:00:00Z', body: '<p>a</p>' }], true),
    );
    request.mockResolvedValueOnce(
      searchResponse([{ id: 'p2', title: 'Beta', lastModified: '2026-09-02T00:00:00Z', body: '<p>b</p>' }]),
    );
    const definition = confluenceImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });
    expect(request).toHaveBeenCalledTimes(2);
    expect(importer.nodes.size).toBe(2);
  });

  it('rejects malformed payloads via zod', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce({ results: [{ id: 42 }] });
    const definition = confluenceImporterRegistration.createImporter(ctx);
    await expect(runImporter(definition, { importer, state })).rejects.toThrow();
    expect(await state.get('confluence:watermark')).toBeUndefined();
  });

  it('requests ancestors in the expand and emits a child-of link toward the direct parent', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      searchResponse([
        {
          id: 'p3',
          title: 'Grandchild',
          lastModified: '2026-09-01T00:00:00Z',
          body: '<p>content</p>',
          ancestors: [
            { id: 'p1', title: 'Root' },
            { id: 'p2', title: 'Parent' },
          ],
        },
      ]),
    );
    await runImporter(confluenceImporterRegistration.createImporter(ctx), { importer, state });

    const call = request.mock.calls[0]![0]! as { query: Record<string, unknown> };
    expect(call.query.expand).toContain('ancestors');
    const record = [...importer.nodes.get('confluence:page:p3')!.records.values()][0]!;
    // Direct parent is the LAST ancestor (root → parent order).
    expect((record.metadata as { links: unknown[] }).links).toEqual([
      { address: 'confluence:page:p2', rel: 'child-of' },
    ]);
  });

  it('extracts ri:page links — content-id becomes an address link, title-only becomes a name link', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      searchResponse([
        {
          id: 'p1',
          title: 'Alpha',
          lastModified: '2026-09-01T00:00:00Z',
          body:
            '<p>See <ac:link><ri:page ri:content-title="Runbook" ri:content-id="777"/></ac:link> and ' +
            '<ac:link><ri:page ri:content-title="Onboarding Guide"/></ac:link> for details.</p>',
        },
      ]),
    );
    await runImporter(confluenceImporterRegistration.createImporter(ctx), { importer, state });

    const record = [...importer.nodes.get('confluence:page:p1')!.records.values()][0]!;
    expect((record.metadata as { links: unknown[] }).links).toEqual([
      { name: 'Onboarding Guide', rel: 'references' },
      { address: 'confluence:page:777', rel: 'references' },
    ]);
    // Links survive even though HTML stripping removed the markup from the body text.
    expect(record.text).not.toContain('ri:page');
    expect(record.text).toContain('See');
  });

  it('stamps node self-address metadata and neutralizes wikilink brackets in body text', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      searchResponse([
        { id: 'p1', title: 'Alpha', lastModified: '2026-09-01T00:00:00Z', body: '<p>about [[Beta]] page</p>' },
      ]),
    );
    await runImporter(confluenceImporterRegistration.createImporter(ctx), { importer, state });

    const node = importer.nodes.get('confluence:page:p1')!;
    expect(node.input.metadata).toEqual({ address: 'confluence:page:p1' });
    const record = [...node.records.values()][0]!;
    expect(record.text).toContain('［［Beta］］');
    expect(record.text).not.toContain('[[');
  });

  it('a link change alone produces a new content-hash record', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      searchResponse([
        { id: 'p1', title: 'Alpha', lastModified: '2026-09-01T00:00:00Z', ancestors: [{ id: 'parentA' }] },
      ]),
    );
    const definition = confluenceImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });
    const firstId = [...importer.nodes.get('confluence:page:p1')!.records.keys()][0]!;

    // Page moved under a different parent — same title/body/timestamp, ONLY the
    // links differ, proving the link array is part of the content-hash payload.
    request.mockResolvedValueOnce(
      searchResponse([
        { id: 'p1', title: 'Alpha', lastModified: '2026-09-01T00:00:00Z', ancestors: [{ id: 'parentB' }] },
      ]),
    );
    await runImporter(definition, { importer, state });

    const ids = [...importer.nodes.get('confluence:page:p1')!.records.keys()];
    expect(ids).toHaveLength(1);
    expect(ids[0]).not.toBe(firstId);
  });
});
