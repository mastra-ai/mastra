import { describe, expect, it, vi } from 'vitest';

import type { ImporterProviderContext } from '../importer-registry.js';
import { linearImporterRegistration } from '../providers/linear/importer.js';
import { createFakeImporter, createFakeState, runImporter, type FakeImporter } from './fixtures/importer-harness.js';

interface LinearDocumentFixture {
  id: string;
  title: string;
  content?: string;
  updatedAt: string;
  archivedAt?: string | null;
  trashed?: boolean | null;
  project?: string;
  initiative?: string;
  url?: string;
}

function documentNode(fixture: LinearDocumentFixture) {
  return {
    id: fixture.id,
    title: fixture.title,
    content: fixture.content ?? null,
    url: fixture.url ?? `https://linear.app/docs/${fixture.id}`,
    updatedAt: fixture.updatedAt,
    archivedAt: fixture.archivedAt ?? null,
    trashed: fixture.trashed === undefined ? false : fixture.trashed,
    project: fixture.project ? { name: fixture.project } : null,
    initiative: fixture.initiative ? { name: fixture.initiative } : null,
  };
}

function documentsResponse(documents: LinearDocumentFixture[], endCursor?: string) {
  return {
    data: {
      documents: {
        nodes: documents.map(documentNode),
        pageInfo: {
          hasNextPage: Boolean(endCursor),
          endCursor: endCursor ?? null,
        },
      },
    },
  };
}

function makeContext(overrides?: { role?: 'owner' | 'edit'; request?: ReturnType<typeof vi.fn> }): {
  ctx: ImporterProviderContext;
  request: ReturnType<typeof vi.fn>;
  importer: FakeImporter;
  state: ReturnType<typeof createFakeState>;
} {
  const request =
    overrides?.request ??
    vi.fn(async () => ({
      data: { documents: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } },
    }));
  const role = overrides?.role ?? 'owner';
  const ctx: ImporterProviderContext = {
    connection: { id: 'c_linear', integrationId: 'linear', status: 'active' } as never,
    request: request as ImporterProviderContext['request'],
    access: { 'org:acme': role },
    schedule: '*/30 * * * *',
  };
  return { ctx, request, importer: createFakeImporter(role), state: createFakeState() };
}

describe('linear importer', () => {
  it('first run imports every document as a node with a content-hashed record and advances the watermark', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      documentsResponse([
        { id: 'd1', title: 'Auth design', content: 'first', updatedAt: '2026-09-01T00:00:00Z' },
        { id: 'd2', title: 'Retry PRD', content: 'second', updatedAt: '2026-09-02T00:00:00Z' },
      ]),
    );
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });

    expect(importer.nodes.get('linear:document:d1')?.input).toMatchObject({
      name: 'Auth design',
      kind: 'connect:linear:document',
    });
    expect(importer.nodes.get('linear:document:d2')?.records.size).toBe(1);
    expect(await state.get('linear:documents:watermark')).toBe(JSON.stringify({ watermark: '2026-09-02T00:00:00Z' }));
    const call = request.mock.calls[0]![0]! as { method: string; path: string; body: { query: string } };
    expect(call.method).toBe('POST');
    expect(call.path).toBe('graphql');
    expect(call.body.query).toContain('documents(');
  });

  // Regression (inherited from the issues importer): the live Linear API
  // returns `trashed: null` (not absent) for entities that were never
  // trashed — a boolean-only schema failed whole runs.
  it('tolerates null trashed/optional fields from the live API', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      documentsResponse([
        { id: 'd1', title: 'Auth design', content: 'first', updatedAt: '2026-09-01T00:00:00Z', trashed: null },
      ]),
    );
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });
    expect(importer.nodes.get('linear:document:d1')?.records.size).toBe(1);
  });

  it('second run with unchanged fixtures is idempotent', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValue(
      documentsResponse([{ id: 'd1', title: 'A', content: 'x', updatedAt: '2026-09-01T00:00:00Z' }]),
    );
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });
    const first = importer.nodes.get('linear:document:d1')!.records.size;
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });
    expect(importer.nodes.get('linear:document:d1')!.records.size).toBe(first);
  });

  it('updated document bumps to a new record id and removes the stale record', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      documentsResponse([{ id: 'd1', title: 'A', content: 'v1', updatedAt: '2026-09-01T00:00:00Z' }]),
    );
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });
    const firstIds = [...importer.nodes.get('linear:document:d1')!.records.keys()];
    request.mockResolvedValueOnce(
      documentsResponse([{ id: 'd1', title: 'A', content: 'v2', updatedAt: '2026-09-02T00:00:00Z' }]),
    );
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });
    const secondIds = [...importer.nodes.get('linear:document:d1')!.records.keys()];
    expect(secondIds).toHaveLength(1);
    expect(secondIds[0]).not.toBe(firstIds[0]);
  });

  it('watermark advances only on success — mid-run failure leaves it untouched', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockRejectedValueOnce(new Error('platform down'));
    await expect(runImporter(linearImporterRegistration.createImporter(ctx), { importer, state })).rejects.toThrow(
      /platform down/,
    );
    expect(await state.get('linear:documents:watermark')).toBeUndefined();
  });

  it('archived documents remove records under an owner binding but are skipped under edit', async () => {
    const owner = makeContext({ role: 'owner' });
    owner.request.mockResolvedValueOnce(
      documentsResponse([{ id: 'd1', title: 'A', content: 'v1', updatedAt: '2026-09-01T00:00:00Z' }]),
    );
    await runImporter(linearImporterRegistration.createImporter(owner.ctx), owner);
    owner.request.mockResolvedValueOnce(
      documentsResponse([
        { id: 'd1', title: 'A', updatedAt: '2026-09-02T00:00:00Z', archivedAt: '2026-09-02T00:00:00Z' },
      ]),
    );
    await runImporter(linearImporterRegistration.createImporter(owner.ctx), owner);
    expect(owner.importer.nodes.get('linear:document:d1')!.records.size).toBe(0);

    const edit = makeContext({ role: 'edit' });
    edit.request.mockResolvedValueOnce(
      documentsResponse([{ id: 'd1', title: 'A', content: 'v1', updatedAt: '2026-09-01T00:00:00Z' }]),
    );
    await runImporter(linearImporterRegistration.createImporter(edit.ctx), edit);
    edit.request.mockResolvedValueOnce(
      documentsResponse([
        { id: 'd1', title: 'A', updatedAt: '2026-09-02T00:00:00Z', archivedAt: '2026-09-02T00:00:00Z' },
      ]),
    );
    await runImporter(linearImporterRegistration.createImporter(edit.ctx), edit);
    expect(edit.importer.nodes.get('linear:document:d1')!.records.size).toBe(1);
  });

  it('walks multiple pages until hasNextPage is false', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      documentsResponse([{ id: 'd1', title: 'A', updatedAt: '2026-09-01T00:00:00Z' }], 'cursor-1'),
    );
    request.mockResolvedValueOnce(documentsResponse([{ id: 'd2', title: 'B', updatedAt: '2026-09-02T00:00:00Z' }]));
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });
    expect(request).toHaveBeenCalledTimes(2);
    expect(importer.nodes.size).toBe(2);
  });

  it('does not advance the watermark when the run bails on maxRecords before hasNextPage: false', async () => {
    const { ctx, request, importer, state } = makeContext();
    // First run: seed a watermark from a fully drained window.
    request.mockResolvedValueOnce(
      documentsResponse([{ id: 'd0', title: 'Zero', content: 'seed', updatedAt: '2026-08-01T00:00:00Z' }]),
    );
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });
    const seededWatermark = await state.get('linear:documents:watermark');
    expect(seededWatermark).toBe(JSON.stringify({ watermark: '2026-08-01T00:00:00Z' }));

    // Second run: return one page that already exceeds DEFAULT_MAX_RECORDS_PER_RUN and signals
    // hasNextPage: true. The record cap trips before the source exhausts — watermark must stay
    // and the endCursor must be persisted so the next run resumes deeper into the tail.
    const bigNodes = Array.from({ length: 501 }, (_, i) => ({
      id: `d${i + 1}`,
      title: `Document ${i + 1}`,
      updatedAt: `2026-09-${String((i % 30) + 1).padStart(2, '0')}T00:00:00Z`,
    }));
    request.mockResolvedValueOnce(documentsResponse(bigNodes, 'cursor-1'));
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });
    expect(await state.get('linear:documents:watermark')).toBe(seededWatermark);
    expect(await state.get('linear:documents:resume-cursor')).toBe(JSON.stringify({ cursor: 'cursor-1' }));
  });

  it('converges initial backfill by resuming from a persisted cursor and clearing it when drained', async () => {
    const { ctx, request, importer, state } = makeContext();
    // Run 1: 501 documents on one page with hasNextPage=true. No prior watermark. Bails on record cap.
    const pageA = Array.from({ length: 501 }, (_, i) => ({
      id: `dA${i}`,
      title: `A${i}`,
      updatedAt: `2026-09-30T${String(i % 24).padStart(2, '0')}:00:00Z`,
    }));
    request.mockResolvedValueOnce(documentsResponse(pageA, 'cursor-A'));
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });
    expect(await state.get('linear:documents:watermark')).toBeUndefined();
    expect(await state.get('linear:documents:resume-cursor')).toBe(JSON.stringify({ cursor: 'cursor-A' }));

    // Run 2: resumes from cursor-A, source exhausts pagination this time (no endCursor).
    // Watermark must reflect the HIGH-WATER across both runs — pageA's 2026-09-30 items are
    // newer than pageB's 2026-08-15, so the watermark must stay on 2026-09-30.
    request.mockResolvedValueOnce(documentsResponse([{ id: 'dB0', title: 'B0', updatedAt: '2026-08-15T00:00:00Z' }]));
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });
    const secondCall = request.mock.calls[1]![0]! as { body: { variables: { after?: string } } };
    expect(secondCall.body.variables.after).toBe('cursor-A');
    const storedWatermark = JSON.parse((await state.get('linear:documents:watermark'))!).watermark as string;
    expect(storedWatermark.startsWith('2026-09-30')).toBe(true);
    expect(await state.get('linear:documents:resume-cursor')).toBe(JSON.stringify({ cursor: '' }));
  });

  it('rejects malformed payloads via zod', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce({
      data: { documents: { nodes: [{ id: 'd1' }], pageInfo: { hasNextPage: false } } },
    });
    await expect(runImporter(linearImporterRegistration.createImporter(ctx), { importer, state })).rejects.toThrow();
    expect(await state.get('linear:documents:watermark')).toBeUndefined();
  });
});
