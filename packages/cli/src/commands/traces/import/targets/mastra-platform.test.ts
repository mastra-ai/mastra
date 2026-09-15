import { describe, expect, it, vi } from 'vitest';
import { tracePayloadBytes } from '../prepared-traces.js';
import type { PreparedTraceBatch, TraceImportTrace } from '../types.js';
import { MastraPlatformTraceTarget, MastraPlatformUploadError } from './mastra-platform.js';

function trace(): TraceImportTrace {
  return {
    sourceTraceId: 'source-trace',
    spans: [
      {
        traceId: '00000000000000000000000000000001',
        spanId: '0000000000000001',
        parentSpanId: null,
        name: 'root',
        spanType: 'generic',
        startedAt: '2026-09-10T12:00:00.000Z',
        endedAt: '2026-09-10T12:00:01.000Z',
        isEvent: false,
        metadata: { source: 'test' },
      },
    ],
  };
}

function batch(): PreparedTraceBatch {
  const value = trace();
  return {
    firstTraceIndex: 0,
    traces: [value],
    spanCount: value.spans.length,
    payloadBytes: tracePayloadBytes(value),
  };
}

function batchWithSpanCount(spanCount: number): PreparedTraceBatch {
  const value = trace();
  const root = value.spans[0]!;
  value.spans = Array.from({ length: spanCount }, (_, index) => ({
    ...root,
    spanId: (index + 1).toString(16).padStart(16, '0'),
    parentSpanId: index === 0 ? null : root.spanId,
  }));
  return {
    firstTraceIndex: 0,
    traces: [value],
    spanCount,
    payloadBytes: tracePayloadBytes(value),
  };
}

function acknowledgement(spanCount = 1): Response {
  return Response.json({ ok: true, data: { spanCount } });
}

describe('MastraPlatformTraceTarget', () => {
  it('posts the exact prepared payload to the project-scoped collector', async () => {
    const fetch = vi.fn(async () => acknowledgement());
    const target = new MastraPlatformTraceTarget({ accessToken: 'secret-token', projectId: 'project_1' }, { fetch });
    const preparedBatch = batch();

    await target.upload(preparedBatch);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://observability.mastra.ai/projects/project_1/ai/spans/publish');
    expect(init).toMatchObject({
      method: 'POST',
      redirect: 'manual',
      headers: {
        Authorization: 'Bearer secret-token',
        'Content-Type': 'application/json',
        'x-mastra-observability-capabilities': 'quota-pause-v1',
      },
    });
    expect(JSON.parse(init!.body as string)).toEqual({ spans: preparedBatch.traces[0]!.spans });
    expect(Buffer.byteLength(init!.body as string)).toBe(preparedBatch.payloadBytes);
  });

  it('accepts the full collector URL used by regional and local environments', async () => {
    const fetch = vi.fn(async () => acknowledgement());
    const target = new MastraPlatformTraceTarget(
      {
        accessToken: 'secret-token',
        projectId: 'project_1',
        endpoint: 'http://localhost:8080/projects/project_1/ai/spans/publish/',
      },
      { fetch },
    );

    await target.upload(batch());

    expect(fetch.mock.calls[0]![0]).toBe('http://localhost:8080/projects/project_1/ai/spans/publish');
  });

  it('retries temporary responses, honors Retry-After, and sends the same body', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '2' } }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(acknowledgement());
    const sleep = vi.fn(async () => undefined);
    const target = new MastraPlatformTraceTarget(
      { accessToken: 'secret-token', projectId: 'project_1' },
      { fetch, sleep },
    );

    await target.upload(batch());

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 2000, undefined);
    expect(sleep).toHaveBeenNthCalledWith(2, 1000, undefined);
    expect(fetch.mock.calls.map(call => call[1]?.body)).toEqual([
      fetch.mock.calls[0]![1]!.body,
      fetch.mock.calls[0]![1]!.body,
      fetch.mock.calls[0]![1]!.body,
    ]);
  });

  it('caps provider-controlled Retry-After delays', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '120' } }))
      .mockResolvedValueOnce(acknowledgement());
    const sleep = vi.fn(async () => undefined);
    const target = new MastraPlatformTraceTarget(
      { accessToken: 'secret-token', projectId: 'project_1' },
      { fetch, sleep },
    );

    await target.upload(batch());

    expect(sleep).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledWith(30_000, undefined);
  });

  it('paces consecutive whole-trace batches to the default span rate', async () => {
    let now = 1_000;
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(acknowledgement(250))
      .mockResolvedValueOnce(acknowledgement());
    const sleep = vi.fn(async (milliseconds: number) => {
      now += milliseconds;
    });
    const target = new MastraPlatformTraceTarget(
      { accessToken: 'secret-token', projectId: 'project_1' },
      { fetch, sleep, now: () => now },
    );

    await target.upload(batchWithSpanCount(250));
    await target.upload(batch());

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledWith(2500, undefined);
  });

  it('retries a network failure with the unchanged deterministic payload', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValueOnce(acknowledgement());
    const sleep = vi.fn(async () => undefined);
    const target = new MastraPlatformTraceTarget(
      { accessToken: 'secret-token', projectId: 'project_1' },
      { fetch, sleep },
    );

    await target.upload(batch());

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]![1]!.body).toBe(fetch.mock.calls[0]![1]!.body);
    expect(sleep).toHaveBeenCalledWith(500, undefined);
  });

  it('retries a lost or invalid acknowledgement without advancing on assumption', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(acknowledgement(0));
    const sleep = vi.fn(async () => undefined);
    const target = new MastraPlatformTraceTarget(
      { accessToken: 'secret-token', projectId: 'project_1' },
      { fetch, sleep, maxAttempts: 2 },
    );

    await expect(target.upload(batch())).rejects.toMatchObject<Partial<MastraPlatformUploadError>>({
      name: 'MastraPlatformUploadError',
      retryable: true,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it.each([
    [400, 'HTTP 400'],
    [401, 'access token'],
    [402, 'quota'],
    [404, 'target project'],
    [413, 'too large'],
  ])('does not retry permanent HTTP %s responses', async (status, message) => {
    const fetch = vi.fn(async () => new Response(null, { status }));
    const sleep = vi.fn(async () => undefined);
    const target = new MastraPlatformTraceTarget(
      { accessToken: 'secret-token', projectId: 'project_1' },
      { fetch, sleep },
    );

    await expect(target.upload(batch())).rejects.toThrow(message);
    expect(fetch).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it('stops immediately when the caller cancels the upload', async () => {
    const controller = new AbortController();
    const reason = new Error('customer cancelled');
    const fetch = vi.fn(async () => {
      controller.abort(reason);
      throw new DOMException('Aborted', 'AbortError');
    });
    const target = new MastraPlatformTraceTarget({ accessToken: 'secret-token', projectId: 'project_1' }, { fetch });

    await expect(target.upload(batch(), { signal: controller.signal })).rejects.toBe(reason);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('rejects unsafe destination configuration before sending credentials', () => {
    expect(
      () =>
        new MastraPlatformTraceTarget({
          accessToken: 'secret-token',
          projectId: '../project',
        }),
    ).toThrow('project ID');
    expect(
      () =>
        new MastraPlatformTraceTarget({
          accessToken: 'secret-token',
          projectId: 'project_1',
          endpoint: 'http://collector.example.com',
        }),
    ).toThrow('HTTPS');
    expect(
      () =>
        new MastraPlatformTraceTarget({
          accessToken: 'secret-token',
          projectId: 'project_1',
          endpoint: 'https://user:password@collector.example.com',
        }),
    ).toThrow('credentials');
    expect(
      () =>
        new MastraPlatformTraceTarget({
          accessToken: 'secret-token',
          projectId: 'project_1',
          endpoint: 'https://collector.example.com/projects/project_2/ai/spans/publish',
        }),
    ).toThrow('different target project');
  });
});
