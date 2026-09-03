import { describe, expect, it, vi } from 'vitest';
import { MastraQueryClient } from './query-client.js';

function client(fetch: typeof globalThis.fetch) {
  return new MastraQueryClient({
    collectorOrigin: 'https://observability.mastra.ai',
    projectId: 'project-1',
    accessToken: 'sk_mastra_test',
    fetch,
  });
}

describe('MastraQueryClient', () => {
  it('reads exact span IDs through the project-scoped light trace query', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        traceId: 'trace/with spaces',
        spans: [{ spanId: 'root' }, { spanId: 'child' }, { spanId: 'child' }],
      }),
    );

    const result = await client(fetchMock).getTraceSpanIds('trace/with spaces');

    expect(result).toEqual({ kind: 'found', spanIds: ['child', 'root'] });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://observability.mastra.ai/api/observability/traces/trace%2Fwith%20spaces/light',
      expect.objectContaining({
        method: 'GET',
        redirect: 'manual',
        headers: {
          Authorization: 'Bearer sk_mastra_test',
          'X-Mastra-Project-Id': 'project-1',
        },
      }),
    );
  });

  it.each([
    [404, { kind: 'pending' }],
    [429, { kind: 'retryable', reason: 'Platform query returned HTTP 429.' }],
    [503, { kind: 'retryable', reason: 'Platform query returned HTTP 503.' }],
    [401, { kind: 'unavailable', reason: 'Platform query authentication failed with HTTP 401.' }],
    [403, { kind: 'unavailable', reason: 'Platform query authentication failed with HTTP 403.' }],
  ])('classifies HTTP %i without treating verification as an upload failure', async (status, expected) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status }));

    await expect(client(fetchMock).getTraceSpanIds('trace-1')).resolves.toEqual(expected);
  });

  it('treats network failures as retryable and malformed successes as unavailable', async () => {
    const network = vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'));
    const malformed = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ traceId: 'trace-1', spans: [{}] }));

    await expect(client(network).getTraceSpanIds('trace-1')).resolves.toEqual({
      kind: 'retryable',
      reason: 'Platform query request failed: offline',
    });
    await expect(client(malformed).getTraceSpanIds('trace-1')).resolves.toEqual({
      kind: 'unavailable',
      reason: 'Platform query returned an invalid light trace response.',
    });
  });

  it('does not follow authenticated redirects', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 307 }));

    await expect(client(fetchMock).getTraceSpanIds('trace-1')).resolves.toEqual({
      kind: 'unavailable',
      reason: 'Platform redirected the authenticated query request (HTTP 307).',
    });
  });
});
