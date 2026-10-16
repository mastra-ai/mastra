import { describe, expect, it, vi } from 'vitest';

import type { ImporterProviderContext } from '../importer-registry.js';
import { linearImporterRegistration } from '../providers/linear/importer.js';
import { createFakeImporter, createFakeState, runImporter, type FakeImporter } from './fixtures/importer-harness.js';

interface LinearDocumentFixture {
  id: string;
  title: string;
  content?: string;
  slugId?: string;
  updatedAt: string;
  archivedAt?: string | null;
  trashed?: boolean | null;
  project?: string;
  projectId?: string;
  initiative?: string;
  url?: string;
}

function documentNode(fixture: LinearDocumentFixture) {
  return {
    id: fixture.id,
    title: fixture.title,
    content: fixture.content ?? null,
    url: fixture.url ?? `https://linear.app/docs/${fixture.id}`,
    slugId: fixture.slugId ?? null,
    updatedAt: fixture.updatedAt,
    archivedAt: fixture.archivedAt ?? null,
    trashed: fixture.trashed === undefined ? false : fixture.trashed,
    project:
      fixture.project || fixture.projectId ? { id: fixture.projectId ?? null, name: fixture.project ?? null } : null,
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

/** List-query calls only — reconciliation adds `document(id)` point probes after each pass. */
function listCalls(request: ReturnType<typeof vi.fn>) {
  return request.mock.calls
    .map(([req]) => req as { body: { query: string; variables: { after?: string } } })
    .filter(req => /\bdocuments\(/.test(req.body.query));
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
    expect(listCalls(request)).toHaveLength(2);
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
    const secondCall = listCalls(request)[1]!;
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

  it('requests slugId and project id in the GraphQL selection', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(documentsResponse([]));
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });
    const call = request.mock.calls[0]![0]! as { body: { query: string } };
    expect(call.body.query).toContain('slugId');
    expect(call.body.query).toContain('project { id name }');
  });

  it('stamps doc nodes with their address and slug alias', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      documentsResponse([{ id: 'd1', title: 'A', content: 'x', slugId: 'abc123', updatedAt: '2026-09-01T00:00:00Z' }]),
    );
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });
    expect(importer.nodes.get('linear:document:d1')!.input.metadata).toEqual({
      address: 'linear:document:d1',
      addressAliases: ['linear:document:slug:abc123'],
    });
  });

  it('upserts a project container node and links the doc into it', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      documentsResponse([
        {
          id: 'd1',
          title: 'A',
          content: 'x',
          project: 'Payments',
          projectId: 'p1',
          updatedAt: '2026-09-01T00:00:00Z',
        },
      ]),
    );
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });

    const project = importer.nodes.get('linear:project:p1')!;
    expect(project.input).toMatchObject({
      name: 'Payments',
      metadata: { address: 'linear:project:p1' },
    });
    expect(project.records.size).toBe(1);
    const record = [...importer.nodes.get('linear:document:d1')!.records.values()][0]!;
    expect((record.metadata as { links: unknown[] }).links).toEqual([{ address: 'linear:project:p1', rel: 'in' }]);
  });

  it('extracts doc→doc URL links as slug-alias addresses', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      documentsResponse([
        {
          id: 'd1',
          title: 'A',
          content: 'See [the retry PRD](https://linear.app/acme/document/retry-prd-xyz789) for details.',
          updatedAt: '2026-09-01T00:00:00Z',
        },
      ]),
    );
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });

    const record = [...importer.nodes.get('linear:document:d1')!.records.values()][0]!;
    expect((record.metadata as { links: unknown[] }).links).toEqual([
      { address: 'linear:document:slug:xyz789', rel: 'references' },
    ]);
  });

  it('a doc without a project gets no in link, and self-referencing URLs are dropped', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      documentsResponse([
        {
          id: 'd1',
          title: 'A',
          content: 'My own link: https://linear.app/acme/document/self-doc-own1 and [[Bracketed]] text',
          slugId: 'own1',
          updatedAt: '2026-09-01T00:00:00Z',
        },
      ]),
    );
    await runImporter(linearImporterRegistration.createImporter(ctx), { importer, state });

    const record = [...importer.nodes.get('linear:document:d1')!.records.values()][0]!;
    expect((record.metadata as { links?: unknown[] }).links).toBeUndefined();
    expect(record.text).toContain('［［Bracketed］］');
    expect(record.text).not.toContain('[[');
  });

  it('a link change alone produces a new content-hash record', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      documentsResponse([
        { id: 'd1', title: 'A', content: 'x', project: 'Alpha', projectId: 'pA', updatedAt: '2026-09-01T00:00:00Z' },
      ]),
    );
    const definition = linearImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });
    const firstId = [...importer.nodes.get('linear:document:d1')!.records.keys()][0]!;

    // Doc moved to a different project — same title/content/timestamp, ONLY the
    // links differ, proving the link array is part of the content-hash payload.
    request.mockResolvedValueOnce(
      documentsResponse([
        { id: 'd1', title: 'A', content: 'x', project: 'Beta', projectId: 'pB', updatedAt: '2026-09-01T00:00:00Z' },
      ]),
    );
    await runImporter(definition, { importer, state });

    const ids = [...importer.nodes.get('linear:document:d1')!.records.keys()];
    expect(ids).toHaveLength(1);
    expect(ids[0]).not.toBe(firstId);
  });
});

describe('linear importer — archived/trashed reconciliation by point query', () => {
  // Live, Linear's `documents` list omits archived and trashed documents, so the
  // only positive tombstone signal is the exact-id `document(id)` point query.
  type PointAnswer = { archivedAt?: string | null; trashed?: boolean | null } | 'not-found' | Error;

  function routedRequest(list: LinearDocumentFixture[], point: Record<string, PointAnswer>) {
    return vi.fn(async (req: { body?: { query?: string; variables?: { id?: string } } }) => {
      const query = req.body?.query ?? '';
      if (/\bdocument\(id:/.test(query)) {
        const id = req.body!.variables!.id!;
        const answer = point[id];
        if (answer instanceof Error) throw answer;
        if (answer === undefined || answer === 'not-found') {
          return {
            data: null,
            errors: [{ message: 'Entity not found: Document', extensions: { code: 'INVALID_INPUT' } }],
          };
        }
        return { data: { document: { id, archivedAt: answer.archivedAt ?? null, trashed: answer.trashed ?? null } } };
      }
      return documentsResponse(list);
    });
  }

  async function seed(role: 'owner' | 'edit' = 'owner') {
    const seedRequest = routedRequest(
      [
        { id: 'd1', title: 'A', content: 'v1', updatedAt: '2026-09-01T00:00:00Z', projectId: 'p1', project: 'P' },
        { id: 'd2', title: 'B', content: 'v2', updatedAt: '2026-09-01T00:00:01Z' },
      ],
      { d1: {}, d2: {} },
    );
    const fx = makeContext({ role, request: seedRequest });
    await runImporter(linearImporterRegistration.createImporter(fx.ctx), fx);
    expect(fx.importer.nodes.get('linear:document:d1')!.records.size).toBe(1);
    return fx;
  }

  function rerun(fx: Awaited<ReturnType<typeof seed>>, point: Record<string, PointAnswer>) {
    const request = routedRequest([], point);
    const ctx = { ...fx.ctx, request: request as ImporterProviderContext['request'] };
    return { request, run: () => runImporter(linearImporterRegistration.createImporter(ctx), fx) };
  }

  it('removes records of a document absent from the list when the point query reports archivedAt', async () => {
    const fx = await seed();
    const { run } = rerun(fx, { d1: { archivedAt: '2026-09-03T00:00:00Z', trashed: null }, d2: {} });
    await run();
    expect(fx.importer.nodes.get('linear:document:d1')!.records.size).toBe(0);
    expect(fx.importer.nodes.has('linear:document:d1')).toBe(true);
    expect(fx.importer.nodes.get('linear:document:d2')!.records.size).toBe(1);
  });

  it('removes records when the point query reports trashed: true', async () => {
    const fx = await seed();
    const { run } = rerun(fx, { d1: { trashed: true }, d2: {} });
    await run();
    expect(fx.importer.nodes.get('linear:document:d1')!.records.size).toBe(0);
    expect(fx.importer.nodes.get('linear:document:d2')!.records.size).toBe(1);
  });

  it('probes by exact id with a document(id) query selecting archivedAt and trashed, never project nodes', async () => {
    const fx = await seed();
    const { request, run } = rerun(fx, { d1: {}, d2: {} });
    await run();
    const probes = request.mock.calls
      .map(([req]) => req as { body: { query: string; variables: { id: string } } })
      .filter(req => /\bdocument\(id:/.test(req.body.query));
    expect(probes.map(p => p.body.variables.id).sort()).toEqual(['d1', 'd2']);
    expect(probes[0]!.body.query).toMatch(/archivedAt/);
    expect(probes[0]!.body.query).toMatch(/trashed/);
    expect(fx.importer.nodes.get('linear:project:p1')!.records.size).toBe(1);
  });

  it('keeps records on not-found, 403/404 and schema ambiguity', async () => {
    const fx = await seed();
    const forbidden = Object.assign(new Error('forbidden'), { status: 403 });
    await rerun(fx, { d1: 'not-found', d2: forbidden }).run();
    expect(fx.importer.nodes.get('linear:document:d1')!.records.size).toBe(1);
    expect(fx.importer.nodes.get('linear:document:d2')!.records.size).toBe(1);
    await rerun(fx, { d1: Object.assign(new Error('gone'), { status: 404 }), d2: { trashed: 'yes' as never } }).run();
    expect(fx.importer.nodes.get('linear:document:d1')!.records.size).toBe(1);
    expect(fx.importer.nodes.get('linear:document:d2')!.records.size).toBe(1);
  });

  it('a transport/5xx probe error keeps records, fails the run and does not advance past the node', async () => {
    const fx = await seed();
    const down = Object.assign(new Error('upstream 502'), { status: 502 });
    await expect(rerun(fx, { d1: down, d2: { archivedAt: '2026-09-03T00:00:00Z' } }).run()).rejects.toThrow(/502/);
    expect(fx.importer.nodes.get('linear:document:d1')!.records.size).toBe(1);
    expect(fx.importer.nodes.get('linear:document:d2')!.records.size).toBe(1);
    // Next run retries d1 rather than skipping it.
    await rerun(fx, { d1: { archivedAt: '2026-09-03T00:00:00Z' }, d2: {} }).run();
    expect(fx.importer.nodes.get('linear:document:d1')!.records.size).toBe(0);
  });

  it('does not probe or remove under an edit binding', async () => {
    const fx = await seed('edit');
    const { request, run } = rerun(fx, { d1: { archivedAt: '2026-09-03T00:00:00Z' }, d2: { trashed: true } });
    await run();
    expect(
      request.mock.calls.some(([req]) => /\bdocument\(id:/.test((req as { body: { query: string } }).body.query)),
    ).toBe(false);
    expect(fx.importer.nodes.get('linear:document:d1')!.records.size).toBe(1);
  });

  it('does not reconcile when the incremental pass fails', async () => {
    const fx = await seed();
    const request = vi.fn(async (req: { body: { query: string } }) => {
      if (/\bdocument\(id:/.test(req.body.query))
        return { data: { document: { id: 'd1', archivedAt: 'x', trashed: true } } };
      throw new Error('platform down');
    });
    const ctx = { ...fx.ctx, request: request as ImporterProviderContext['request'] };
    await expect(runImporter(linearImporterRegistration.createImporter(ctx), fx)).rejects.toThrow(/platform down/);
    expect(fx.importer.nodes.get('linear:document:d1')!.records.size).toBe(1);
  });
});
