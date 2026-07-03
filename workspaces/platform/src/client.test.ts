import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlatformApiError } from './client.js';
import { PlatformClient } from './client.js';

function response(body: string, init?: ResponseInit) {
  return new Response(body, init);
}

describe('PlatformClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds project-scoped proxy requests with bearer auth', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test/');
    const fetchMock = vi.fn().mockResolvedValue(response('{}', { status: 200 }));
    const client = new PlatformClient({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      fetch: fetchMock,
    });

    await client.request('/sandbox', { method: 'POST', query: { dryRun: true } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://proxy.test/v1/projects/proj_123/sandbox?dryRun=true');
    expect((init.headers as Headers).get('authorization')).toBe('Bearer sk_test');
    expect(init.method).toBe('POST');
  });

  it('throws PlatformApiError for non-2xx responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('nope', { status: 401 }));
    const client = new PlatformClient({ accessToken: 'sk_test', projectId: 'proj_123', fetch: fetchMock });

    await expect(client.request('/sandbox')).rejects.toMatchObject({
      status: 401,
      body: 'nope',
    } satisfies Partial<PlatformApiError>);
  });
});
