import { chmod, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runTraceImport } from './import-run.js';
import { readManifest } from './manifest.js';
import { TRACE_IMPORT_FIELDS } from './types.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

async function stateRoot(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'mastra-trace-import-'));
  roots.push(path);
  return path;
}

const sourcePage = {
  data: [
    {
      id: 'child',
      traceId: 'trace-1',
      projectId: 'langfuse-project',
      parentObservationId: 'root',
      type: 'GENERATION',
      name: 'answer',
      startTime: '2026-08-20T10:00:01.000Z',
      endTime: '2026-08-20T10:00:02.000Z',
      input: '{"question":"hello"}',
      output: 'world',
      model: 'gpt-4o-mini',
    },
    {
      id: 'root',
      traceId: 'trace-1',
      projectId: 'langfuse-project',
      parentObservationId: null,
      type: 'AGENT',
      name: 'agent',
      startTime: '2026-08-20T10:00:00.000Z',
      endTime: '2026-08-20T10:00:03.000Z',
      environment: 'production',
      tags: ['migration'],
    },
    {
      id: 'incomplete',
      traceId: 'trace-incomplete',
      projectId: 'langfuse-project',
      parentObservationId: null,
      type: 'SPAN',
      name: 'running',
      startTime: '2026-08-20T10:00:00.000Z',
      endTime: null,
    },
  ],
  meta: { cursor: null },
};

function options(root: string) {
  return {
    source: {
      baseUrl: 'https://cloud.langfuse.com',
      publicKey: 'pk-lf-test',
      secretKey: 'sk-lf-test',
    },
    target: {
      projectId: '11111111-1111-4111-8111-111111111111',
      accessToken: 'sk_mastra_test',
      collectorUrl: 'https://observability.mastra.ai',
    },
    stateRoot: root,
    now: new Date('2026-09-03T00:00:00.000Z'),
    verify: false,
  };
}

describe('runTraceImport', () => {
  it('dry-runs without a target credential and preserves a resumable plan', async () => {
    const root = await stateRoot();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(sourcePage));
    const report = await runTraceImport({
      ...options(root),
      target: { ...options(root).target, accessToken: undefined },
      dryRun: true,
      fetch: fetchMock,
    });

    expect(report.status).toBe('dry-run');
    expect(report.counts).toMatchObject({
      readSpans: 3,
      eligibleTraces: 1,
      eligibleSpans: 2,
      skippedTraces: 1,
      skippedSpans: 1,
      enqueuedSpans: 0,
      skipReasons: { incomplete_duration: 1 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sourceUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(sourceUrl.searchParams.get('fromStartTime')).toBe('2026-08-04T00:00:00.000Z');
    expect(sourceUrl.searchParams.get('toStartTime')).toBe('2026-09-03T00:00:00.000Z');
    expect(sourceUrl.searchParams.get('limit')).toBe('1000');
    expect(sourceUrl.searchParams.get('fields')).toBe(TRACE_IMPORT_FIELDS);
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>).Authorization).toContain('Basic ');
    const manifest = await readManifest(report.stateDirectory);
    expect(manifest.phase).toBe('planned');
    expect(manifest.batches).toHaveLength(1);
    expect(report.warnings).toEqual([]);
    expect((await stat(report.stateDirectory)).mode & 0o777).toBe(0o700);
    expect((await stat(join(report.stateDirectory, 'manifest.json'))).mode & 0o777).toBe(0o600);
    const staged = await Promise.all(
      (await readdir(report.stateDirectory, { recursive: true }))
        .filter(path => !path.endsWith('shards') && !path.endsWith('batches'))
        .map(path => readFile(join(report.stateDirectory, path), 'utf8').catch(() => '')),
    );
    expect(staged.join('\n')).not.toContain('pk-lf-test');
    expect(staged.join('\n')).not.toContain('sk-lf-test');
    expect(staged.join('\n')).not.toContain('sk_mastra_test');
  });

  it('completes a no-op import without asking for upload confirmation', async () => {
    const root = await stateRoot();
    const confirm = vi.fn().mockResolvedValue(true);
    const report = await runTraceImport({
      ...options(root),
      fetch: vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: [], meta: { cursor: null } })),
      confirm,
    });

    expect(report.status).toBe('complete');
    expect(report.counts).toMatchObject({ eligibleTraces: 0, eligibleSpans: 0, enqueuedSpans: 0 });
    expect(confirm).not.toHaveBeenCalled();
  });

  it('retains a staged plan when the user cancels confirmation without uploading', async () => {
    const root = await stateRoot();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(sourcePage));
    const report = await runTraceImport({
      ...options(root),
      fetch: fetchMock,
      confirm: async () => false,
    });

    expect(report.status).toBe('cancelled');
    expect(report.counts.enqueuedSpans).toBe(0);
    expect(fetchMock).toHaveBeenCalledOnce();
    await expect(readManifest(report.stateDirectory)).resolves.toMatchObject({
      phase: 'planned',
      batches: [{ status: 'pending' }],
    });
  });

  it('resumes a dry-run plan and uploads its exact preserved timestamps', async () => {
    const root = await stateRoot();
    const sourceFetch = vi.fn<typeof fetch>().mockResolvedValue(Response.json(sourcePage));
    const dryRun = await runTraceImport({ ...options(root), dryRun: true, fetch: sourceFetch });
    const targetFetch = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true, data: { spanCount: 2 } }));

    const report = await runTraceImport({
      ...options(root),
      resumeId: dryRun.importId,
      fetch: targetFetch,
      confirm: async () => true,
      keepState: true,
    });
    expect(report.status).toBe('complete');
    expect(report.counts.enqueuedSpans).toBe(2);
    expect(targetFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(targetFetch.mock.calls[0]?.[1]?.body)) as {
      spans: Array<Record<string, unknown>>;
    };
    expect(body.spans.map(span => span.startedAt)).toEqual(['2026-08-20T10:00:00.000Z', '2026-08-20T10:00:01.000Z']);
    expect(body.spans.map(span => span.endedAt)).toEqual(['2026-08-20T10:00:03.000Z', '2026-08-20T10:00:02.000Z']);
    expect(body.spans[0]?.parentSpanId).toBeNull();
    expect(body.spans[1]?.parentSpanId).toBe(body.spans[0]?.spanId);
    expect(body.spans[1]?.attributes).toMatchObject({ model: 'gpt-4o-mini' });
  });

  it('keeps the original snapshot window when a staged import resumes later', async () => {
    const root = await stateRoot();
    const dryRun = await runTraceImport({
      ...options(root),
      dryRun: true,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(Response.json(sourcePage)),
    });
    const targetFetch = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true, data: { spanCount: 2 } }));

    const resumed = await runTraceImport({
      ...options(root),
      now: new Date('2026-09-20T00:00:00.000Z'),
      resumeId: dryRun.importId,
      fetch: targetFetch,
      confirm: async () => true,
      keepState: true,
    });

    expect(resumed.snapshotAt).toBe(dryRun.snapshotAt);
    expect(resumed.cutoffAt).toBe(dryRun.cutoffAt);
    expect(targetFetch).toHaveBeenCalledTimes(1);
  });

  it('checkpoints quota pauses and resumes only unacknowledged batches', async () => {
    const root = await stateRoot();
    const sourceFetch = vi.fn<typeof fetch>().mockResolvedValue(Response.json(sourcePage));
    const dryRun = await runTraceImport({
      ...options(root),
      dryRun: true,
      batchSize: 1,
      fetch: sourceFetch,
    });
    const pausedFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ ok: true, data: { spanCount: 1 } }))
      .mockResolvedValueOnce(new Response('', { status: 402 }));
    const paused = await runTraceImport({
      ...options(root),
      resumeId: dryRun.importId,
      batchSize: 1,
      fetch: pausedFetch,
      confirm: async () => true,
      keepState: true,
    });
    expect(paused.status).toBe('paused');
    expect(paused.counts.enqueuedSpans).toBe(1);

    const resumedFetch = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true, data: { spanCount: 1 } }));
    const completed = await runTraceImport({
      ...options(root),
      resumeId: dryRun.importId,
      batchSize: 1,
      fetch: resumedFetch,
      confirm: async () => true,
      keepState: true,
    });
    expect(completed.status).toBe('complete');
    expect(completed.counts.enqueuedSpans).toBe(2);
    expect(resumedFetch).toHaveBeenCalledTimes(1);
  });

  it('reports source and target HTTP retries without exposing request data', async () => {
    const root = await stateRoot();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(Response.json(sourcePage))
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(Response.json({ ok: true, data: { spanCount: 2 } }));

    const report = await runTraceImport({
      ...options(root),
      fetch: fetchMock,
      sleep: vi.fn().mockResolvedValue(undefined),
      confirm: async () => true,
      keepState: true,
    });

    expect(report.counts).toMatchObject({ sourceRetries: 1, targetRetries: 1 });
    expect(await readManifest(report.stateDirectory)).toMatchObject({
      counts: { sourceRetries: 1, targetRetries: 1 },
    });
  });

  it('rechecks acknowledged batch hashes before resuming', async () => {
    const root = await stateRoot();
    const dryRun = await runTraceImport({
      ...options(root),
      dryRun: true,
      batchSize: 1,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(Response.json(sourcePage)),
    });
    const pausedFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ ok: true, data: { spanCount: 1 } }))
      .mockResolvedValueOnce(new Response('', { status: 402 }));
    await runTraceImport({
      ...options(root),
      resumeId: dryRun.importId,
      batchSize: 1,
      fetch: pausedFetch,
      confirm: async () => true,
      keepState: true,
    });

    const manifest = await readManifest(dryRun.stateDirectory);
    const acknowledged = manifest.batches.find(batch => batch.status === 'acknowledged')!;
    await writeFile(join(dryRun.stateDirectory, 'batches', acknowledged.file), '{"spans":[]}');
    const resumedFetch = vi.fn<typeof fetch>();

    await expect(
      runTraceImport({
        ...options(root),
        resumeId: dryRun.importId,
        batchSize: 1,
        fetch: resumedFetch,
        confirm: async () => true,
      }),
    ).rejects.toThrow('no longer matches its manifest hash');
    expect(resumedFetch).not.toHaveBeenCalled();
  });

  it('cleans raw trace state after success by default', async () => {
    const root = await stateRoot();
    const fetchMock = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      return url.includes('langfuse') ? Response.json(sourcePage) : Response.json({ ok: true, data: { spanCount: 2 } });
    });
    const report = await runTraceImport({
      ...options(root),
      fetch: fetchMock,
      confirm: async () => true,
    });
    expect(report.status).toBe('complete');
    await expect(readFile(join(report.stateDirectory, 'source-pages.jsonl'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(await readManifest(report.stateDirectory)).toMatchObject({ phase: 'complete' });
  });

  it('cleans retained raw state when a completed manifest is resumed without keep-state', async () => {
    const root = await stateRoot();
    const fetchMock = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      return url.includes('langfuse') ? Response.json(sourcePage) : Response.json({ ok: true, data: { spanCount: 2 } });
    });
    const completed = await runTraceImport({
      ...options(root),
      fetch: fetchMock,
      confirm: async () => true,
      keepState: true,
    });
    expect(await stat(join(completed.stateDirectory, 'source-pages.jsonl'))).toBeDefined();

    const resumed = await runTraceImport({
      ...options(root),
      resumeId: completed.importId,
      fetch: vi.fn<typeof fetch>(),
    });

    expect(resumed.status).toBe('complete');
    await expect(readFile(join(completed.stateDirectory, 'source-pages.jsonl'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect((await readdir(completed.stateDirectory)).sort()).toEqual(['manifest.json', 'report.json']);
  });

  it('surfaces unknown source types and potential Platform truncation', async () => {
    const root = await stateRoot();
    const page = structuredClone(sourcePage);
    page.data = [
      {
        ...page.data[1]!,
        type: 'FUTURE_OBSERVATION',
        output: 'x'.repeat(1024 * 1024 + 1),
      },
    ];
    const report = await runTraceImport({
      ...options(root),
      dryRun: true,
      maxBatchBytes: 2 * 1024 * 1024,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(Response.json(page)),
    });

    expect(report.counts.truncationRiskSpans).toBe(1);
    expect(report.warnings).toEqual([
      'Unknown Langfuse observation types were mapped to generic spans: FUTURE_OBSERVATION.',
      '1 eligible spans contain fields that Platform may truncate at its storage limits.',
    ]);
  });

  it('bounds local source staging before advancing the cursor', async () => {
    const root = await stateRoot();
    const page = structuredClone(sourcePage);
    page.data[0]!.output = 'x'.repeat(2048);

    await expect(
      runTraceImport({
        ...options(root),
        dryRun: true,
        maxSpoolBytes: 1024,
        fetch: vi.fn<typeof fetch>().mockResolvedValue(Response.json(page)),
      }),
    ).rejects.toThrow('local staging limit');

    const [projectDirectory] = await readdir(root);
    const [importDirectory] = await readdir(join(root, projectDirectory!));
    const manifest = await readManifest(join(root, projectDirectory!, importDirectory!));
    expect(manifest.source.cursor).toBeUndefined();
    expect(manifest.source.observationCount).toBe(0);
  });

  it('rejects a project change between Langfuse pages without advancing the second cursor', async () => {
    const root = await stateRoot();
    const firstPage = {
      data: [sourcePage.data[1]],
      meta: { cursor: 'page-2' },
    };
    const secondPage = {
      data: [{ ...sourcePage.data[0], projectId: 'different-project' }],
      meta: { cursor: null },
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(firstPage))
      .mockResolvedValueOnce(Response.json(secondPage));

    await expect(runTraceImport({ ...options(root), dryRun: true, fetch: fetchMock })).rejects.toThrow(
      'Langfuse project changed',
    );

    const [projectDirectory] = await readdir(root);
    const [importDirectory] = await readdir(join(root, projectDirectory!));
    const manifest = await readManifest(join(root, projectDirectory!, importDirectory!));
    expect(manifest.source).toMatchObject({
      projectId: 'langfuse-project',
      cursor: 'page-2',
      pageCount: 1,
      observationCount: 1,
    });
  });

  it('rejects a repeated Langfuse cursor', async () => {
    const root = await stateRoot();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json({ data: [sourcePage.data[1]], meta: { cursor: 'same-cursor' } }));

    await expect(runTraceImport({ ...options(root), dryRun: true, fetch: fetchMock })).rejects.toThrow(
      'repeated pagination cursor',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('pauses safely when interrupted between source staging and batch planning', async () => {
    const root = await stateRoot();
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => {
      controller.abort(new Error('test interrupt'));
      return Response.json(sourcePage);
    });

    const report = await runTraceImport({
      ...options(root),
      dryRun: true,
      fetch: fetchMock,
      signal: controller.signal,
    });

    expect(report.status).toBe('paused');
    expect(report.counts.readSpans).toBe(3);
    expect(await readManifest(report.stateDirectory)).toMatchObject({
      phase: 'paused',
      source: { complete: true },
      batches: [],
      lastError: { message: 'Import interrupted' },
    });
  });

  it('pauses at the target stage when upload is aborted', async () => {
    const root = await stateRoot();
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      if (String(input).includes('langfuse')) return Response.json(sourcePage);
      if (init?.method === 'POST') {
        controller.abort(new Error('test upload abort'));
        throw controller.signal.reason;
      }
      throw new Error('Unexpected request');
    });

    const report = await runTraceImport({
      ...options(root),
      fetch: fetchMock,
      signal: controller.signal,
      confirm: async () => true,
      keepState: true,
    });

    expect(report.status).toBe('paused');
    expect(report.counts.enqueuedSpans).toBe(0);
    await expect(readManifest(report.stateDirectory)).resolves.toMatchObject({
      phase: 'paused',
      lastError: { stage: 'target', message: 'Import interrupted' },
      batches: [{ status: 'pending' }],
    });
  });

  it('keeps an acknowledged upload resumable when query verification is aborted', async () => {
    const root = await stateRoot();
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      if (String(input).includes('langfuse')) return Response.json(sourcePage);
      if (init?.method === 'POST') return Response.json({ ok: true, data: { spanCount: 2 } });
      controller.abort(new Error('test verification abort'));
      throw controller.signal.reason;
    });

    const report = await runTraceImport({
      ...options(root),
      verify: true,
      fetch: fetchMock,
      signal: controller.signal,
      confirm: async () => true,
      keepState: true,
    });

    expect(report.status).toBe('paused');
    expect(report.counts.enqueuedSpans).toBe(2);
    await expect(readManifest(report.stateDirectory)).resolves.toMatchObject({
      phase: 'paused',
      lastError: { stage: 'target', message: 'Import interrupted' },
      batches: [{ status: 'acknowledged' }],
    });
  });

  it('rejects a modified saved batch before uploading it', async () => {
    const root = await stateRoot();
    const dryRun = await runTraceImport({
      ...options(root),
      dryRun: true,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(Response.json(sourcePage)),
    });
    const manifest = await readManifest(dryRun.stateDirectory);
    const batchPath = join(dryRun.stateDirectory, 'batches', manifest.batches[0]!.file);
    await chmod(batchPath, 0o600);
    await writeFile(batchPath, '{"spans":[]}');
    const targetFetch = vi.fn<typeof fetch>();

    await expect(
      runTraceImport({
        ...options(root),
        resumeId: dryRun.importId,
        fetch: targetFetch,
        confirm: async () => true,
      }),
    ).rejects.toThrow('no longer matches its manifest hash');
    expect(targetFetch).not.toHaveBeenCalled();
  });

  it('surfaces non-fatal Platform acknowledgement warnings', async () => {
    const root = await stateRoot();
    const fetchMock = vi.fn<typeof fetch>(async input => {
      return String(input).includes('langfuse')
        ? Response.json(sourcePage)
        : Response.json({
            ok: true,
            data: { spanCount: 2 },
            warnings: [{ code: 'IMPORT_NOTICE', message: 'Accepted with a notice', count: 1 }],
          });
    });
    const report = await runTraceImport({
      ...options(root),
      fetch: fetchMock,
      confirm: async () => true,
      keepState: true,
    });

    expect(report.warnings).toContain('Platform warning IMPORT_NOTICE: Accepted with a notice');
  });

  it('creates stable batches bounded by the default 100-record limit', async () => {
    const root = await stateRoot();
    const page = {
      data: Array.from({ length: 205 }, (_, index) => ({
        id: `root-${index}`,
        traceId: `trace-${index}`,
        projectId: 'langfuse-project',
        parentObservationId: null,
        type: 'EVENT',
        name: `event-${index}`,
        startTime: '2026-08-20T10:00:00.000Z',
        endTime: null,
      })),
      meta: { cursor: null },
    };
    const report = await runTraceImport({
      ...options(root),
      dryRun: true,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(Response.json(page)),
    });
    const manifest = await readManifest(report.stateDirectory);

    expect(manifest.batches.map(batch => batch.spanCount)).toEqual([100, 100, 5]);
    expect(manifest.batches.every(batch => batch.byteLength <= 4 * 1024 * 1024)).toBe(true);
    expect(manifest.verification.samples).toHaveLength(10);
  });

  it('automatically verifies exact uploaded span IDs through the light trace query', async () => {
    const root = await stateRoot();
    let expectedTraceId = '';
    let expectedSpanIds: string[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.includes('langfuse')) return Response.json(sourcePage);
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { spans: Array<{ traceId: string; spanId: string }> };
        expectedTraceId = body.spans[0]!.traceId;
        expectedSpanIds = body.spans.map(span => span.spanId).sort();
        return Response.json({ ok: true, data: { spanCount: 2 } });
      }
      const queryAttempt = fetchMock.mock.calls.filter(([, request]) => request?.method === 'GET').length;
      return Response.json({
        traceId: expectedTraceId,
        spans: (queryAttempt === 1 ? expectedSpanIds.slice(0, 1) : expectedSpanIds).map(spanId => ({ spanId })),
      });
    });

    const report = await runTraceImport({
      ...options(root),
      verify: true,
      fetch: fetchMock,
      sleep: vi.fn().mockResolvedValue(undefined),
      confirm: async () => true,
      keepState: true,
    });

    expect(report.status).toBe('complete');
    expect(report.counts.verifiedTraces).toBe(1);
    expect(report.verification).toEqual({
      status: 'verified',
      sampledTraces: 1,
      verifiedTraces: 1,
      attempts: 2,
    });
    const queryCalls = fetchMock.mock.calls.filter(([, request]) => request?.method === 'GET');
    expect(queryCalls).toHaveLength(2);
    expect(String(queryCalls[0]?.[0])).toBe(
      `https://observability.mastra.ai/api/observability/traces/${expectedTraceId}/light`,
    );
    expect(queryCalls[0]?.[1]?.headers).toEqual({
      Authorization: 'Bearer sk_mastra_test',
      'X-Mastra-Project-Id': '11111111-1111-4111-8111-111111111111',
    });
  });

  it('completes an upload while reporting query authentication as unavailable', async () => {
    const root = await stateRoot();
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      if (String(input).includes('langfuse')) return Response.json(sourcePage);
      if (init?.method === 'POST') return Response.json({ ok: true, data: { spanCount: 2 } });
      return new Response('', { status: 403 });
    });

    const report = await runTraceImport({
      ...options(root),
      verify: true,
      fetch: fetchMock,
      sleep: vi.fn().mockResolvedValue(undefined),
      confirm: async () => true,
      keepState: true,
    });

    expect(report.status).toBe('complete');
    expect(report.counts).toMatchObject({ enqueuedSpans: 2, verifiedTraces: 0 });
    expect(report.verification).toEqual({
      status: 'unavailable',
      reason: 'Platform query authentication failed with HTTP 403.',
      sampledTraces: 1,
      verifiedTraces: 0,
      attempts: 1,
    });
  });

  it('reports a verification timeout without changing an acknowledged upload to failed', async () => {
    const root = await stateRoot();
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      if (String(input).includes('langfuse')) return Response.json(sourcePage);
      if (init?.method === 'POST') return Response.json({ ok: true, data: { spanCount: 2 } });
      return new Response('', { status: 404 });
    });

    const report = await runTraceImport({
      ...options(root),
      verify: true,
      fetch: fetchMock,
      sleep: vi.fn().mockResolvedValue(undefined),
      confirm: async () => true,
      keepState: true,
    });

    expect(report.status).toBe('complete');
    expect(report.verification).toEqual({
      status: 'timed-out',
      reason: 'Uploaded traces were not queryable before the verification timeout.',
      sampledTraces: 1,
      verifiedTraces: 0,
      attempts: 6,
    });
  });

  it('can re-run verification from a completed manifest after sensitive batches are cleaned', async () => {
    const root = await stateRoot();
    const firstFetch = vi.fn<typeof fetch>(async (input, init) => {
      if (String(input).includes('langfuse')) return Response.json(sourcePage);
      if (init?.method === 'POST') return Response.json({ ok: true, data: { spanCount: 2 } });
      return new Response('', { status: 404 });
    });
    const first = await runTraceImport({
      ...options(root),
      verify: true,
      fetch: firstFetch,
      sleep: vi.fn().mockResolvedValue(undefined),
      confirm: async () => true,
    });
    const manifest = await readManifest(first.stateDirectory);
    const [sample] = manifest.verification.samples;

    const queryFetch = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        traceId: sample!.traceId,
        spans: sample!.spanIds.map(spanId => ({ spanId })),
      }),
    );
    const resumed = await runTraceImport({
      ...options(root),
      verify: true,
      resumeId: first.importId,
      fetch: queryFetch,
    });

    expect(resumed.verification).toEqual({
      status: 'verified',
      sampledTraces: 1,
      verifiedTraces: 1,
      attempts: 1,
    });
    expect(queryFetch).toHaveBeenCalledOnce();
    expect(queryFetch.mock.calls[0]?.[1]?.method).toBe('GET');
  });

  it('splits a valid trace across byte-bounded batches without skipping it', async () => {
    const root = await stateRoot();
    const page = structuredClone(sourcePage);
    page.data = page.data.slice(0, 2);
    page.data[0]!.output = 'x'.repeat(2500);
    page.data[1]!.output = 'y'.repeat(2500);
    const report = await runTraceImport({
      ...options(root),
      dryRun: true,
      maxBatchBytes: 4096,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(Response.json(page)),
    });
    const manifest = await readManifest(report.stateDirectory);

    expect(report.counts).toMatchObject({ eligibleTraces: 1, eligibleSpans: 2, skippedTraces: 0 });
    expect(manifest.batches.map(batch => batch.spanCount)).toEqual([1, 1]);
    expect(manifest.batches.every(batch => batch.byteLength <= 4096)).toBe(true);
  });

  it('skips a whole trace when one span cannot fit the byte ceiling', async () => {
    const root = await stateRoot();
    const page = structuredClone(sourcePage);
    page.data[0]!.output = 'x'.repeat(4096);
    const report = await runTraceImport({
      ...options(root),
      dryRun: true,
      maxBatchBytes: 1024,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(Response.json(page)),
    });

    expect(report.counts.eligibleTraces).toBe(0);
    expect(report.counts.skippedSpans).toBe(3);
    expect(report.counts.skipReasons).toEqual({ oversized_span: 1, incomplete_duration: 1 });
  });
});
