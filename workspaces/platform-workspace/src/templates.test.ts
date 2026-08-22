import { afterEach, describe, expect, it, vi } from 'vitest';
import { serializeSandboxTemplate, Template } from './template.js';
import { PlatformTemplateBuildError, PlatformTemplateBuildTimeoutError, PlatformTemplateClient } from './templates.js';

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function rejectWhenAborted(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const signal = init?.signal;
  if (!signal) return Promise.reject(new Error('Expected an AbortSignal'));
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

function client(fetchMock: typeof fetch, sandboxProvider?: 'railway' | 'e2b') {
  return new PlatformTemplateClient({
    accessToken: 'sk_test',
    projectId: 'project id',
    fetch: fetchMock,
    ...(sandboxProvider && { sandboxProvider }),
  });
}

describe('PlatformTemplateClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('starts a build on the explicit provider route with the exact serialized definition', async () => {
    vi.stubEnv('SANDBOX_PROVIDER', 'railway');
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const definition = serializeSandboxTemplate(Template().setEnvs({ BUILD_MODE: 'production' }).runCmd('pnpm build'));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ templateId: 'tpl_handle', status: 'building' }, 202));

    await expect(
      client(fetchMock as typeof fetch, 'e2b').build({ environmentId: 'env_123', definition }),
    ).resolves.toEqual({ templateId: 'tpl_handle', status: 'building' });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://proxy.test/v1/e2b/projects/project%20id/templates');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ environmentId: 'env_123', definition });
    expect(JSON.parse(String(init.body))).not.toHaveProperty('buildSecrets');
  });

  it('uses SANDBOX_PROVIDER and defaults to provider-prefixed Railway routes when it is unset', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const definition = serializeSandboxTemplate(Template().runCmd('true'));
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(jsonResponse({ templateId: 'tpl', status: 'queued' }, 202)));

    vi.stubEnv('SANDBOX_PROVIDER', 'e2b');
    await client(fetchMock as typeof fetch).build({ environmentId: 'env', definition });
    vi.stubEnv('SANDBOX_PROVIDER', undefined);
    await client(fetchMock as typeof fetch).build({ environmentId: 'env', definition });

    expect(String(fetchMock.mock.calls[0]![0])).toContain('/v1/e2b/projects/');
    expect(String(fetchMock.mock.calls[1]![0])).toContain('/v1/railway/projects/');
  });

  it('rejects an invalid provider environment value', () => {
    vi.stubEnv('SANDBOX_PROVIDER', 'other');
    expect(() => client(vi.fn() as unknown as typeof fetch)).toThrow(
      'SANDBOX_PROVIDER must be either "railway" or "e2b"',
    );
  });

  it('gets status with an encoded opaque handle and environment scope', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ templateId: 'opaque/value', status: 'ready' }));

    await expect(
      client(fetchMock as typeof fetch, 'railway').get({ environmentId: 'env a', templateId: 'opaque/value' }),
    ).resolves.toEqual({ templateId: 'opaque/value', status: 'ready' });

    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      'https://proxy.test/v1/railway/projects/project%20id/templates/opaque%2Fvalue?environmentId=env+a',
    );
  });

  it('polls provider-owned status until ready', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ templateId: 'tpl', status: 'queued' }))
      .mockResolvedValueOnce(jsonResponse({ templateId: 'tpl', status: 'building' }))
      .mockResolvedValueOnce(jsonResponse({ templateId: 'tpl', status: 'ready' }));

    await expect(
      client(fetchMock as typeof fetch).waitUntilReady({
        environmentId: 'env',
        templateId: 'tpl',
        intervalMs: 100,
        timeoutMs: 1_000,
      }),
    ).resolves.toEqual({ templateId: 'tpl', status: 'ready' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws a typed error when the provider build fails', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ templateId: 'tpl', status: 'failed', error: 'Package installation failed' }));

    await expect(
      client(fetchMock as typeof fetch).waitUntilReady({ environmentId: 'env', templateId: 'tpl' }),
    ).rejects.toMatchObject({
      name: 'PlatformTemplateBuildError',
      template: { templateId: 'tpl', status: 'failed', error: 'Package installation failed' },
    } satisfies Partial<PlatformTemplateBuildError>);
  });

  it('supports aborting before and during an in-flight status request', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi.fn(rejectWhenAborted);
    const alreadyAborted = new AbortController();
    alreadyAborted.abort(new Error('stop before polling'));

    await expect(
      client(fetchMock as typeof fetch).waitUntilReady({
        environmentId: 'env',
        templateId: 'tpl',
        signal: alreadyAborted.signal,
      }),
    ).rejects.toThrow('stop before polling');
    expect(fetchMock).not.toHaveBeenCalled();

    const inFlight = new AbortController();
    const wait = client(fetchMock as typeof fetch).waitUntilReady({
      environmentId: 'env',
      templateId: 'tpl',
      signal: inFlight.signal,
    });
    inFlight.abort(new Error('stop in flight'));

    await expect(wait).rejects.toThrow('stop in flight');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('applies the overall timeout to an in-flight status request', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi.fn(rejectWhenAborted);

    await expect(
      client(fetchMock as typeof fetch).waitUntilReady({
        environmentId: 'env',
        templateId: 'tpl',
        intervalMs: 100,
        timeoutMs: 5,
      }),
    ).rejects.toBeInstanceOf(PlatformTemplateBuildTimeoutError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { intervalMs: 0, timeoutMs: 1 },
    { intervalMs: 99, timeoutMs: 1 },
    { intervalMs: 100, timeoutMs: 0 },
    { intervalMs: 100.5, timeoutMs: 10 },
    { intervalMs: 100, timeoutMs: 2_147_483_648 },
    { intervalMs: 2_147_483_648, timeoutMs: 10 },
  ])('rejects invalid polling durations: %o', async ({ intervalMs, timeoutMs }) => {
    await expect(
      client(vi.fn() as unknown as typeof fetch).waitUntilReady({
        environmentId: 'env',
        templateId: 'tpl',
        intervalMs,
        timeoutMs,
      }),
    ).rejects.toBeInstanceOf(RangeError);
  });

  it('rejects malformed template responses', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'provider-id', status: 'READY' }));

    await expect(client(fetchMock as typeof fetch).get({ environmentId: 'env', templateId: 'tpl' })).rejects.toThrow(
      'Invalid sandbox template response',
    );
  });
});
