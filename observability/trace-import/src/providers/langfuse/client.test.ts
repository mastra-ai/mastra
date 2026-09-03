import { describe, expect, it, vi } from 'vitest';
import { LangfuseObservationsClient } from './client.js';

const page = {
  data: [
    {
      id: 'obs-1',
      traceId: 'trace-1',
      projectId: 'project-1',
      parentObservationId: null,
      type: 'SPAN',
      startTime: '2026-08-20T10:00:00.000Z',
      endTime: '2026-08-20T10:00:01.000Z',
    },
  ],
  meta: { cursor: null },
};

describe('LangfuseObservationsClient', () => {
  it('sends bounded v2 cursor requests with Basic auth', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(page));
    const client = new LangfuseObservationsClient({
      baseUrl: 'https://eu.cloud.langfuse.com',
      publicKey: 'pk-lf-test',
      secretKey: 'sk-lf-test',
      fetch: fetchMock,
    });
    await client.getPage({
      cutoffAt: '2026-08-04T00:00:00.000Z',
      snapshotAt: '2026-09-03T00:00:00.000Z',
      fields: 'core,basic',
      limit: 1000,
      cursor: 'next-page',
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    const requestUrl = new URL(String(url));
    expect(requestUrl.pathname).toBe('/api/public/v2/observations');
    expect(requestUrl.searchParams.get('fromStartTime')).toBe('2026-08-04T00:00:00.000Z');
    expect(requestUrl.searchParams.get('toStartTime')).toBe('2026-09-03T00:00:00.000Z');
    expect(requestUrl.searchParams.get('cursor')).toBe('next-page');
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from('pk-lf-test:sk-lf-test').toString('base64')}`,
    );
    expect(init?.redirect).toBe('manual');
  });

  it('honors Retry-After on a 429 response', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '3' } }))
      .mockResolvedValueOnce(Response.json(page));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const onRetry = vi.fn();
    const client = new LangfuseObservationsClient({
      baseUrl: 'https://cloud.langfuse.com',
      publicKey: 'public',
      secretKey: 'secret',
      fetch: fetchMock,
      sleep,
      onRetry,
    });
    await client.getPage({
      cutoffAt: '2026-08-04T00:00:00.000Z',
      snapshotAt: '2026-09-03T00:00:00.000Z',
      fields: 'core',
      limit: 1000,
    });
    expect(sleep).toHaveBeenCalledWith(3000, undefined);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('rejects insecure non-local origins', () => {
    expect(
      () =>
        new LangfuseObservationsClient({
          baseUrl: 'http://example.com',
          publicKey: 'public',
          secretKey: 'secret',
        }),
    ).toThrow('must use HTTPS');
  });

  it.each([401, 403])('treats HTTP %s as a permanent credential failure', async status => {
    const client = new LangfuseObservationsClient({
      baseUrl: 'https://cloud.langfuse.com',
      publicKey: 'public',
      secretKey: 'secret',
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status })),
    });
    await expect(
      client.getPage({
        cutoffAt: '2026-08-04T00:00:00.000Z',
        snapshotAt: '2026-09-03T00:00:00.000Z',
        fields: 'core',
        limit: 1000,
      }),
    ).rejects.toMatchObject({ status, resumable: false });
  });

  it('reports the V2 compatibility requirement for a missing route', async () => {
    const client = new LangfuseObservationsClient({
      baseUrl: 'https://cloud.langfuse.com',
      publicKey: 'public',
      secretKey: 'secret',
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 404 })),
    });
    await expect(
      client.getPage({
        cutoffAt: '2026-08-04T00:00:00.000Z',
        snapshotAt: '2026-09-03T00:00:00.000Z',
        fields: 'core',
        limit: 1000,
      }),
    ).rejects.toThrow('self-hosted Langfuse v4+');
  });

  it.each([408, 503])('pauses after retryable source HTTP %s exhausts its budget', async status => {
    const client = new LangfuseObservationsClient({
      baseUrl: 'https://cloud.langfuse.com',
      publicKey: 'public',
      secretKey: 'secret',
      maxAttempts: 1,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status })),
    });
    await expect(
      client.getPage({
        cutoffAt: '2026-08-04T00:00:00.000Z',
        snapshotAt: '2026-09-03T00:00:00.000Z',
        fields: 'core',
        limit: 1000,
      }),
    ).rejects.toMatchObject({ status, resumable: true });
  });

  it('retries network failures and pauses resumably when they continue', async () => {
    const recoveredFetch = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValueOnce(Response.json(page));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const recovered = new LangfuseObservationsClient({
      baseUrl: 'https://cloud.langfuse.com',
      publicKey: 'public',
      secretKey: 'secret',
      fetch: recoveredFetch,
      sleep,
    });
    await expect(
      recovered.getPage({
        cutoffAt: '2026-08-04T00:00:00.000Z',
        snapshotAt: '2026-09-03T00:00:00.000Z',
        fields: 'core',
        limit: 1000,
      }),
    ).resolves.toEqual(page);
    expect(sleep).toHaveBeenCalledTimes(1);

    const exhausted = new LangfuseObservationsClient({
      baseUrl: 'https://cloud.langfuse.com',
      publicKey: 'public',
      secretKey: 'secret',
      maxAttempts: 1,
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')),
    });
    await expect(
      exhausted.getPage({
        cutoffAt: '2026-08-04T00:00:00.000Z',
        snapshotAt: '2026-09-03T00:00:00.000Z',
        fields: 'core',
        limit: 1000,
      }),
    ).rejects.toMatchObject({ stage: 'source', resumable: true });
  });

  it('rejects schema drift and authenticated redirects', async () => {
    const invalid = new LangfuseObservationsClient({
      baseUrl: 'https://cloud.langfuse.com',
      publicKey: 'public',
      secretKey: 'secret',
      fetch: vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: [], meta: null })),
    });
    await expect(
      invalid.getPage({
        cutoffAt: '2026-08-04T00:00:00.000Z',
        snapshotAt: '2026-09-03T00:00:00.000Z',
        fields: 'core',
        limit: 1000,
      }),
    ).rejects.toThrow('unsupported Observations API v2 response');

    const redirect = new LangfuseObservationsClient({
      baseUrl: 'https://cloud.langfuse.com',
      publicKey: 'public',
      secretKey: 'secret',
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 302 })),
    });
    await expect(
      redirect.getPage({
        cutoffAt: '2026-08-04T00:00:00.000Z',
        snapshotAt: '2026-09-03T00:00:00.000Z',
        fields: 'core',
        limit: 1000,
      }),
    ).rejects.toMatchObject({ status: 302 });
  });
});
