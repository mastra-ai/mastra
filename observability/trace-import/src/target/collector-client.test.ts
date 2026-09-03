import { describe, expect, it, vi } from 'vitest';
import { TraceImportError } from '../errors.js';
import { MastraCollectorClient, resolveCollectorEndpoint } from './collector-client.js';

describe('MastraCollectorClient', () => {
  it('builds only the project-scoped route and validates API-key credentials', () => {
    expect(resolveCollectorEndpoint('https://observability.mastra.ai', 'project-1')).toEqual({
      origin: 'https://observability.mastra.ai',
      endpoint: 'https://observability.mastra.ai/projects/project-1/ai/spans/publish',
    });
    expect(
      () =>
        new MastraCollectorClient({
          projectId: 'project-1',
          accessToken: 'user-login-token',
        }),
    ).toThrow('organization ingestion key');
  });

  it('requires an exact successful acknowledgement', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true, data: { spanCount: 1 } }));
    const client = new MastraCollectorClient({
      projectId: 'project-1',
      accessToken: 'sk_test',
      fetch: fetchMock,
    });
    await expect(client.publishBody('{"spans":[{}]}', 1)).resolves.toMatchObject({ ok: true });
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init?.headers as Record<string, string>)['x-mastra-observability-capabilities']).toBe('quota-pause-v1');
    expect(init?.redirect).toBe('manual');
  });

  it('surfaces quota exhaustion as resumable without retrying', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 402 }));
    const client = new MastraCollectorClient({
      projectId: 'project-1',
      accessToken: 'sk_test',
      fetch: fetchMock,
    });
    await expect(client.publishBody('{"spans":[]}', 0)).rejects.toMatchObject<Partial<TraceImportError>>({
      status: 402,
      resumable: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries an identical body after a transient failure', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(Response.json({ ok: true, data: { spanCount: 1 } }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = new MastraCollectorClient({
      projectId: 'project-1',
      accessToken: 'sk_test',
      fetch: fetchMock,
      sleep,
    });
    const body = '{"spans":[{"id":"stable"}]}';
    await client.publishBody(body, 1);
    expect(fetchMock.mock.calls.map(([, init]) => init?.body)).toEqual([body, body]);
  });

  it('retries network failures and pauses resumably when they continue', async () => {
    const body = '{"spans":[{"id":"stable"}]}';
    const recoveredFetch = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValueOnce(Response.json({ ok: true, data: { spanCount: 1 } }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const recovered = new MastraCollectorClient({
      projectId: 'project-1',
      accessToken: 'sk_test',
      fetch: recoveredFetch,
      sleep,
    });
    await expect(recovered.publishBody(body, 1)).resolves.toMatchObject({ ok: true });
    expect(recoveredFetch.mock.calls.map(([, init]) => init?.body)).toEqual([body, body]);

    const exhausted = new MastraCollectorClient({
      projectId: 'project-1',
      accessToken: 'sk_test',
      maxAttempts: 1,
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')),
    });
    await expect(exhausted.publishBody(body, 1)).rejects.toMatchObject({
      stage: 'target',
      resumable: true,
    });
  });

  it.each([400, 401, 403, 404])('treats HTTP %s as a permanent target failure', async status => {
    const client = new MastraCollectorClient({
      projectId: 'project-1',
      accessToken: 'sk_test',
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status })),
    });
    await expect(client.publishBody('{"spans":[]}', 0)).rejects.toMatchObject({
      status,
      resumable: false,
    });
  });

  it('explains that HTTP 404 usually means a stale or inaccessible project ID', async () => {
    const client = new MastraCollectorClient({
      projectId: 'stale-project',
      accessToken: 'sk_test',
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 404 })),
    });

    await expect(client.publishBody('{"spans":[]}', 0)).rejects.toThrow(
      'Project "stale-project" was not found for this organization key',
    );
  });

  it('treats a legacy 204 quota drop as resumable instead of success', async () => {
    const client = new MastraCollectorClient({
      projectId: 'project-1',
      accessToken: 'sk_test',
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })),
    });
    await expect(client.publishBody('{"spans":[]}', 0)).rejects.toMatchObject({
      status: 204,
      resumable: true,
    });
  });

  it('honors Retry-After for target rate limits', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '2' } }))
      .mockResolvedValueOnce(Response.json({ ok: true, data: { spanCount: 0 } }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const onRetry = vi.fn();
    const client = new MastraCollectorClient({
      projectId: 'project-1',
      accessToken: 'sk_test',
      fetch: fetchMock,
      sleep,
      onRetry,
    });
    await client.publishBody('{"spans":[]}', 0);
    expect(sleep).toHaveBeenCalledWith(2000, undefined);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('rejects count mismatches and missing stable ID warnings', async () => {
    const mismatch = new MastraCollectorClient({
      projectId: 'project-1',
      accessToken: 'sk_test',
      fetch: vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true, data: { spanCount: 0 } })),
    });
    await expect(mismatch.publishBody('{"spans":[{}]}', 1)).rejects.toThrow('expected span count');

    const warning = new MastraCollectorClient({
      projectId: 'project-1',
      accessToken: 'sk_test',
      fetch: vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          ok: true,
          data: { spanCount: 1 },
          warnings: [{ code: 'MISSING_STABLE_ID', message: 'missing', count: 1 }],
        }),
      ),
    });
    await expect(warning.publishBody('{"spans":[{}]}', 1)).rejects.toThrow('missing stable IDs');
  });

  it('does not follow authenticated redirects', async () => {
    const client = new MastraCollectorClient({
      projectId: 'project-1',
      accessToken: 'sk_test',
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 307 })),
    });
    await expect(client.publishBody('{"spans":[]}', 0)).rejects.toMatchObject({ status: 307 });
  });
});
