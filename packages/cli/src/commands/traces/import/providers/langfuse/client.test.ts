import { describe, expect, it, vi } from 'vitest';
import { LangfuseClient, LangfuseReaderError, LangfuseResponseTooLargeError } from './client.js';

const options = {
  baseUrl: 'https://cloud.langfuse.com',
  publicKey: 'pk-lf-test',
  secretKey: 'sk-lf-test',
};

const observation = {
  id: 'observation-1',
  traceId: 'trace-1',
  startTime: '2026-09-01T10:00:00.000Z',
  endTime: '2026-09-01T10:00:01.000Z',
  projectId: 'project-1',
  parentObservationId: null,
  type: 'SPAN',
};

function cancelableResponse(
  status: number,
  headers?: HeadersInit,
): { response: Response; cancel: ReturnType<typeof vi.fn> } {
  const cancel = vi.fn();
  const body = new ReadableStream({ cancel });
  return { response: new Response(body, { status, headers }), cancel };
}

describe('LangfuseClient', () => {
  it('identifies the project associated with its Basic-auth credentials', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      Response.json({
        data: [{ id: 'project-1', name: 'Customer project', organization: { id: 'org-1', name: 'Customer' } }],
      }),
    );
    const client = new LangfuseClient({ ...options, baseUrl: 'https://cloud.langfuse.com/' }, { fetch });

    await expect(client.identifyProject()).resolves.toEqual({ id: 'project-1', name: 'Customer project' });

    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe('https://cloud.langfuse.com/api/public/projects');
    expect(init).toMatchObject({ redirect: 'manual' });
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from('pk-lf-test:sk-lf-test').toString('base64')}`,
    );
  });

  it('retries when a successful response body fails while streaming', async () => {
    const failedBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new TypeError('stream interrupted'));
      },
    });
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(failedBody))
      .mockResolvedValueOnce(Response.json({ data: [{ id: 'project-1', name: 'Customer project' }] }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const onRetry = vi.fn();
    const client = new LangfuseClient(options, { fetch, sleep, maxAttempts: 2, onRetry });

    await expect(client.identifyProject()).resolves.toEqual({ id: 'project-1', name: 'Customer project' });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('builds a bounded Observations API v2 request', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(Response.json({ data: [observation], meta: { cursor: 'next-page' } }));
    const client = new LangfuseClient(options, { fetch });

    await expect(
      client.getObservationsPage({
        fields: 'core,metadata',
        expandMetadata: '*',
        limit: 1000,
        cursor: 'current-page',
        traceId: 'trace-1',
        fromStartTime: '2026-08-01T00:00:00.000Z',
        toStartTime: '2026-09-01T00:00:00.000Z',
      }),
    ).resolves.toEqual({ data: [observation], cursor: 'next-page' });

    const url = new URL(String(fetch.mock.calls[0]![0]));
    expect(url.pathname).toBe('/api/public/v2/observations');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      fields: 'core,metadata',
      limit: '1000',
      cursor: 'current-page',
      traceId: 'trace-1',
      fromStartTime: '2026-08-01T00:00:00.000Z',
      toStartTime: '2026-09-01T00:00:00.000Z',
      expandMetadata: '*',
    });
  });

  it('honors Retry-After when Langfuse rate-limits a request', async () => {
    const rateLimit = cancelableResponse(429, { 'Retry-After': '3' });
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(rateLimit.response)
      .mockResolvedValueOnce(Response.json({ data: [], meta: { cursor: null } }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const onRetry = vi.fn();
    const client = new LangfuseClient(options, { fetch, sleep, onRetry });

    await client.getObservationsPage({ fields: 'core', limit: 1000 });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(rateLimit.cancel).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledWith(3000, undefined);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it.each([
    ['an empty value', '', 500],
    ['a whitespace-only value', '   ', 500],
    ['a delay longer than the local backoff cap', '120', 120_000],
    ['an HTTP date', 'Thu, 10 Sep 2026 12:01:00 GMT', 60_000],
  ])('handles Retry-After with %s', async (_case, retryAfter, expectedDelay) => {
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-10T12:00:00.000Z'));
    const rateLimit = cancelableResponse(429, { 'Retry-After': retryAfter });
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(rateLimit.response)
      .mockResolvedValueOnce(Response.json({ data: [], meta: { cursor: null } }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = new LangfuseClient(options, { fetch, sleep });

    try {
      await client.getObservationsPage({ fields: 'core', limit: 1000 });
      expect(sleep).toHaveBeenCalledWith(expectedDelay, undefined);
    } finally {
      dateNow.mockRestore();
    }
  });

  it('retries temporary network failures', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(Response.json({ data: [], meta: { cursor: null } }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = new LangfuseClient(options, { fetch, sleep });

    await expect(client.getObservationsPage({ fields: 'core', limit: 1000 })).resolves.toEqual({
      data: [],
      cursor: null,
    });
    expect(sleep).toHaveBeenCalledWith(500, undefined);
  });

  it.each([408, 429, 500, 503])('marks exhausted HTTP %s errors as retryable', async status => {
    const client = new LangfuseClient(options, {
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status })),
      maxAttempts: 1,
    });

    await expect(client.getObservationsPage({ fields: 'core', limit: 1000 })).rejects.toMatchObject({
      status,
      retryable: true,
    });
  });

  it.each([401, 403])('does not retry HTTP %s credential failures', async status => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status }));
    const client = new LangfuseClient(options, { fetch });

    await expect(client.identifyProject()).rejects.toMatchObject({ status, retryable: false });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([302, 401, 404, 400, 500])('cancels an unread HTTP %s response before throwing', async status => {
    const result = cancelableResponse(status);
    const client = new LangfuseClient(options, {
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(result.response),
      maxAttempts: 1,
    });

    await expect(client.identifyProject()).rejects.toBeInstanceOf(LangfuseReaderError);
    expect(result.cancel).toHaveBeenCalledOnce();
  });

  it('explains the Langfuse v4 requirement when Observations API v2 is missing', async () => {
    const client = new LangfuseClient(options, {
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 404 })),
    });

    await expect(client.getObservationsPage({ fields: 'core', limit: 1000 })).rejects.toThrow(
      'self-hosted Langfuse v4 or later',
    );
  });

  it('rejects authenticated redirects and malformed responses', async () => {
    const redirect = new LangfuseClient(options, {
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 302 })),
    });
    await expect(redirect.identifyProject()).rejects.toMatchObject({ status: 302, retryable: false });

    const malformed = new LangfuseClient(options, {
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ data: [{}], meta: null })),
    });
    await expect(malformed.getObservationsPage({ fields: 'core', limit: 1000 })).rejects.toBeInstanceOf(
      LangfuseReaderError,
    );
  });

  it('rejects ambiguous project credentials', async () => {
    const client = new LangfuseClient(options, {
      fetch: vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(Response.json({ data: [{ id: 'one' }, { id: 'two' }] })),
    });

    await expect(client.identifyProject()).rejects.toThrow('exactly one source project');
  });

  it('rejects a response whose content length exceeds the Langfuse API response limit', async () => {
    const oversized = cancelableResponse(200, { 'Content-Length': String(5 * 1024 * 1024 + 1) });
    const client = new LangfuseClient(options, {
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(oversized.response),
    });

    await expect(client.identifyProject()).rejects.toBeInstanceOf(LangfuseResponseTooLargeError);
    expect(oversized.cancel).toHaveBeenCalledOnce();
  });

  it('stops reading a streamed response when it exceeds the Langfuse API response limit', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(5 * 1024 * 1024));
        controller.enqueue(new Uint8Array(1));
        controller.close();
      },
    });
    const client = new LangfuseClient(options, {
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(body)),
    });

    await expect(client.identifyProject()).rejects.toBeInstanceOf(LangfuseResponseTooLargeError);
  });

  it.each([
    'http://langfuse.example.com',
    'https://user:password@langfuse.example.com',
    'https://langfuse.example.com/api',
    'https://langfuse.example.com?region=us',
    'https://langfuse.example.com#settings',
  ])('rejects unsafe base URL %s', baseUrl => {
    expect(() => new LangfuseClient({ ...options, baseUrl })).toThrow();
  });

  it('allows HTTP only for localhost development', () => {
    expect(new LangfuseClient({ ...options, baseUrl: 'http://localhost:3000' }).baseUrl).toBe('http://localhost:3000');
  });
});
