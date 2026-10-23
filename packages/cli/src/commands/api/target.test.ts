import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiGlobalOptions } from './target';

const mocks = vi.hoisted(() => ({
  getCurrentOrgId: vi.fn(),
  getToken: vi.fn(),
  fetchServerProjects: vi.fn(),
  loadProjectConfig: vi.fn(),
}));

vi.mock('../auth/credentials.js', () => ({
  getCurrentOrgId: mocks.getCurrentOrgId,
  getToken: mocks.getToken,
}));

vi.mock('../server/platform-api.js', () => ({
  fetchServerProjects: mocks.fetchServerProjects,
}));

vi.mock('../studio/project-config.js', () => ({
  loadProjectConfig: mocks.loadProjectConfig,
}));

const fetchMock = vi.fn();
const options = (overrides: Partial<ApiGlobalOptions> = {}): ApiGlobalOptions => ({
  header: [],
  pretty: false,
  ...overrides,
});
const resolveTarget = async (opts: ApiGlobalOptions, fetchFn?: typeof fetch, path?: string) => {
  const target = await import('./target.js');
  return target.resolveTarget(opts, fetchFn, path);
};
const linkedProject = {
  projectId: 'project-1',
  projectName: 'Project One',
  projectSlug: 'project-one',
  organizationId: 'org-1',
};

describe('resolveTarget', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.MASTRA_PLATFORM_ACCESS_TOKEN;
    delete process.env.MASTRA_PROJECT_ID;
    delete process.env.MASTRA_ORGANIZATION_ID;
    delete process.env.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT;
    fetchMock.mockRejectedValue(new Error('local unavailable'));
    mocks.getCurrentOrgId.mockResolvedValue('org-current');
    mocks.getToken.mockResolvedValue('platform-token');
    mocks.loadProjectConfig.mockResolvedValue(null);
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.MASTRA_PLATFORM_ACCESS_TOKEN;
    delete process.env.MASTRA_PROJECT_ID;
    delete process.env.MASTRA_ORGANIZATION_ID;
    vi.unstubAllGlobals();
    consoleError.mockRestore();
  });

  it('uses an explicit URL with only custom headers and no discovery', async () => {
    await expect(
      resolveTarget(
        options({
          url: 'https://runtime.example.com',
          header: ['Authorization: Bearer custom', 'X-Test: yes'],
          timeout: '1234',
        }),
      ),
    ).resolves.toEqual({
      baseUrl: 'https://runtime.example.com',
      headers: { Authorization: 'Bearer custom', 'X-Test': 'yes' },
      timeoutMs: 1234,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.loadProjectConfig).not.toHaveBeenCalled();
    expect(mocks.getToken).not.toHaveBeenCalled();
    expect(mocks.fetchServerProjects).not.toHaveBeenCalled();
  });

  it('carries a normalized custom API prefix from --server-api-prefix', async () => {
    await expect(
      resolveTarget(options({ url: 'https://runtime.example.com', serverApiPrefix: 'api/mastra-studio/' })),
    ).resolves.toEqual({
      baseUrl: 'https://runtime.example.com',
      headers: {},
      timeoutMs: 30_000,
      apiPrefix: '/api/mastra-studio',
    });
  });

  it('reads the API prefix from MASTRA_API_PREFIX when the flag is absent', async () => {
    process.env.MASTRA_API_PREFIX = '/api/mastra-studio';

    try {
      await expect(resolveTarget(options({ url: 'https://runtime.example.com' }))).resolves.toMatchObject({
        apiPrefix: '/api/mastra-studio',
      });
    } finally {
      delete process.env.MASTRA_API_PREFIX;
    }
  });

  it('omits apiPrefix when the prefix resolves to the default /api', async () => {
    await expect(
      resolveTarget(options({ url: 'https://runtime.example.com', serverApiPrefix: '/api' })),
    ).resolves.toEqual({
      baseUrl: 'https://runtime.example.com',
      headers: {},
      timeoutMs: 30_000,
    });
  });

  it('probes localhost using the custom API prefix', async () => {
    const cancel = vi.fn();
    fetchMock.mockResolvedValueOnce({ ok: true, body: { cancel } });

    await expect(
      resolveTarget(options({ serverApiPrefix: '/api/mastra-studio' }), fetchMock as typeof fetch),
    ).resolves.toEqual({
      baseUrl: 'http://localhost:4111',
      headers: {},
      timeoutMs: 30_000,
      apiPrefix: '/api/mastra-studio',
    });

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4111/api/mastra-studio/system/api-schema', {
      method: 'GET',
      signal: expect.any(AbortSignal),
    });
  });

  it('uses the hosted observability endpoint with env credentials for observability routes', async () => {
    process.env.MASTRA_PLATFORM_ACCESS_TOKEN = 'env-token';
    process.env.MASTRA_PROJECT_ID = 'env-project';

    await expect(resolveTarget(options(), fetchMock as typeof fetch, '/observability/traces')).resolves.toEqual({
      baseUrl: 'https://observability.mastra.ai',
      headers: {
        Authorization: 'Bearer env-token',
        'X-Mastra-Project-Id': 'env-project',
      },
      fallbackHeaders: {
        Authorization: 'Bearer platform-token',
        'X-Mastra-Project-Id': 'env-project',
      },
      timeoutMs: 30_000,
    });

    expect(fetchMock).toHaveBeenCalledWith('https://platform.mastra.ai/v1/projects/env-project/environments', {
      method: 'GET',
      headers: { Authorization: 'Bearer env-token', 'x-organization-id': 'org-current' },
      signal: expect.any(AbortSignal),
    });
    expect(mocks.fetchServerProjects).not.toHaveBeenCalled();
  });

  it('does not start interactive login when only an observability env token is available', async () => {
    process.env.MASTRA_PLATFORM_ACCESS_TOKEN = 'env-token';
    process.env.MASTRA_PROJECT_ID = 'env-project';
    mocks.getToken.mockRejectedValueOnce(new Error('not logged in'));

    await expect(resolveTarget(options(), fetchMock as typeof fetch, '/observability/traces')).resolves.toEqual({
      baseUrl: 'https://observability.mastra.ai',
      headers: {
        Authorization: 'Bearer env-token',
        'X-Mastra-Project-Id': 'env-project',
      },
      timeoutMs: 30_000,
    });

    expect(mocks.getToken).toHaveBeenCalledWith(undefined, { allowLogin: false });
  });

  it('uses CLI auth and project config when observability env credentials are unavailable', async () => {
    mocks.loadProjectConfig.mockResolvedValueOnce(linkedProject);

    await expect(resolveTarget(options(), fetchMock as typeof fetch, '/observability/traces')).resolves.toEqual({
      baseUrl: 'https://observability.mastra.ai',
      headers: {
        Authorization: 'Bearer platform-token',
        'X-Mastra-Project-Id': 'project-1',
      },
      timeoutMs: 30_000,
    });

    expect(fetchMock).toHaveBeenCalledWith('https://platform.mastra.ai/v1/projects/project-1/environments', {
      method: 'GET',
      headers: { Authorization: 'Bearer platform-token', 'x-organization-id': 'org-1' },
      signal: expect.any(AbortSignal),
    });
    expect(mocks.fetchServerProjects).not.toHaveBeenCalled();
  });

  it('uses the hosted learning endpoint with env credentials for learning routes', async () => {
    process.env.MASTRA_PLATFORM_ACCESS_TOKEN = 'env-token';
    process.env.MASTRA_PROJECT_ID = 'env-project';

    await expect(resolveTarget(options(), fetchMock as typeof fetch, '/learning/entities')).resolves.toEqual({
      baseUrl: 'https://output.signals.mastra.ai',
      headers: {
        Authorization: 'Bearer env-token',
        'X-Mastra-Project-Id': 'env-project',
      },
      fallbackHeaders: {
        Authorization: 'Bearer platform-token',
        'X-Mastra-Project-Id': 'env-project',
      },
      timeoutMs: 30_000,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.fetchServerProjects).not.toHaveBeenCalled();
  });

  it('uses CLI auth and project config when learning env credentials are unavailable', async () => {
    mocks.loadProjectConfig.mockResolvedValueOnce(linkedProject);

    await expect(
      resolveTarget(options(), fetchMock as typeof fetch, '/learning/entities/agent_1/theme-snapshots'),
    ).resolves.toEqual({
      baseUrl: 'https://output.signals.mastra.ai',
      headers: {
        Authorization: 'Bearer platform-token',
        'X-Mastra-Project-Id': 'project-1',
        'X-Mastra-Organization-Id': 'org-1',
      },
      timeoutMs: 30_000,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.fetchServerProjects).not.toHaveBeenCalled();
  });

  it('prefers the env organization ID over project config for learning routes', async () => {
    process.env.MASTRA_ORGANIZATION_ID = 'env-org';
    mocks.loadProjectConfig.mockResolvedValueOnce(linkedProject);

    await expect(resolveTarget(options(), fetchMock as typeof fetch, '/learning/entities')).resolves.toEqual({
      baseUrl: 'https://output.signals.mastra.ai',
      headers: {
        Authorization: 'Bearer platform-token',
        'X-Mastra-Project-Id': 'project-1',
        'X-Mastra-Organization-Id': 'env-org',
      },
      timeoutMs: 30_000,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.fetchServerProjects).not.toHaveBeenCalled();
  });

  it('does not send the organization header for observability routes', async () => {
    mocks.loadProjectConfig.mockResolvedValueOnce(linkedProject);

    await expect(resolveTarget(options(), fetchMock as typeof fetch, '/observability/v1/traces')).resolves.toEqual({
      baseUrl: 'https://observability.mastra.ai',
      headers: {
        Authorization: 'Bearer platform-token',
        'X-Mastra-Project-Id': 'project-1',
      },
      timeoutMs: 30_000,
    });

    expect(mocks.fetchServerProjects).not.toHaveBeenCalled();
  });

  describe('observability region', () => {
    const environmentsResponse = (environments: { type: string; region: string }[]) => ({
      ok: true,
      json: async () => ({ environments }),
    });

    afterEach(() => {
      delete process.env.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT;
    });

    it.each([
      ['https://observability.eu.mastra.ai', 'https://observability.eu.mastra.ai'],
      ['https://observability.eu.mastra.ai/', 'https://observability.eu.mastra.ai'],
      ['https://observability.mastra.ai', 'https://observability.mastra.ai'],
    ])('uses the trusted MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT %s without a lookup', async (endpoint, baseUrl) => {
      process.env.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT = endpoint;
      mocks.loadProjectConfig.mockResolvedValueOnce(linkedProject);

      await expect(resolveTarget(options(), fetchMock as typeof fetch, '/observability/traces')).resolves.toMatchObject(
        { baseUrl, headers: { Authorization: 'Bearer platform-token' } },
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reads MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT from the project .env written by mastra init', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'mastra-api-target-'));
      writeFileSync(
        join(dir, '.env'),
        'MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT=https://observability.eu.mastra.ai\nMASTRA_PROJECT_ID=dotenv-project\n',
      );
      const cwd = vi.spyOn(process, 'cwd').mockReturnValue(dir);
      try {
        await expect(
          resolveTarget(options(), fetchMock as typeof fetch, '/observability/traces'),
        ).resolves.toMatchObject({
          baseUrl: 'https://observability.eu.mastra.ai',
          headers: { 'X-Mastra-Project-Id': 'dotenv-project' },
        });
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        cwd.mockRestore();
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('ignores an untrusted MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT and resolves the region instead', async () => {
      process.env.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT = 'https://observability.eu.mastra.ai.attacker.example';
      mocks.loadProjectConfig.mockResolvedValueOnce(linkedProject);
      fetchMock.mockResolvedValueOnce(environmentsResponse([{ type: 'production', region: 'ams' }]));

      await expect(resolveTarget(options(), fetchMock as typeof fetch, '/observability/traces')).resolves.toMatchObject(
        { baseUrl: 'https://observability.eu.mastra.ai' },
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('routes to the EU host when the production environment is in ams', async () => {
      mocks.loadProjectConfig.mockResolvedValueOnce(linkedProject);
      fetchMock.mockResolvedValueOnce(
        environmentsResponse([
          { type: 'preview', region: 'pdx' },
          { type: 'production', region: 'ams' },
        ]),
      );

      await expect(resolveTarget(options(), fetchMock as typeof fetch, '/observability/traces/query')).resolves.toEqual(
        {
          baseUrl: 'https://observability.eu.mastra.ai',
          headers: { Authorization: 'Bearer platform-token', 'X-Mastra-Project-Id': 'project-1' },
          timeoutMs: 30_000,
        },
      );
    });

    it.each(['eu', 'EU', 'europe-west4'])('treats region %s as EU', async region => {
      mocks.loadProjectConfig.mockResolvedValueOnce(linkedProject);
      fetchMock.mockResolvedValueOnce(environmentsResponse([{ type: 'production', region }]));

      await expect(resolveTarget(options(), fetchMock as typeof fetch, '/observability/traces')).resolves.toMatchObject(
        { baseUrl: 'https://observability.eu.mastra.ai' },
      );
    });

    it('uses the US host without a warning when the project has no environments', async () => {
      mocks.loadProjectConfig.mockResolvedValueOnce(linkedProject);
      fetchMock.mockResolvedValueOnce(environmentsResponse([]));

      await expect(resolveTarget(options(), fetchMock as typeof fetch, '/observability/traces')).resolves.toMatchObject(
        { baseUrl: 'https://observability.mastra.ai' },
      );
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('routes to the US host for non-EU regions', async () => {
      mocks.loadProjectConfig.mockResolvedValueOnce(linkedProject);
      fetchMock.mockResolvedValueOnce(environmentsResponse([{ type: 'production', region: 'iad' }]));

      await expect(resolveTarget(options(), fetchMock as typeof fetch, '/observability/traces')).resolves.toMatchObject(
        { baseUrl: 'https://observability.mastra.ai' },
      );
    });

    it('falls back to the US host when the lookup returns an error status', async () => {
      mocks.loadProjectConfig.mockResolvedValueOnce(linkedProject);
      const cancel = vi.fn();
      fetchMock.mockResolvedValueOnce({ ok: false, status: 403, body: { cancel } });

      await expect(resolveTarget(options(), fetchMock as typeof fetch, '/observability/traces')).resolves.toMatchObject(
        { baseUrl: 'https://observability.mastra.ai' },
      );
      expect(cancel).toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        'Warning: could not determine project region (status 403); defaulting to US observability. ' +
          'Set MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT or pass --url to override.',
      );
    });

    it('warns with the error message when the lookup request fails', async () => {
      mocks.loadProjectConfig.mockResolvedValueOnce(linkedProject);
      fetchMock.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND platform.mastra.ai'));

      await expect(resolveTarget(options(), fetchMock as typeof fetch, '/observability/traces')).resolves.toMatchObject(
        { baseUrl: 'https://observability.mastra.ai' },
      );
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('(getaddrinfo ENOTFOUND platform.mastra.ai)'));
    });

    it('caps the lookup at five seconds and falls back to the US host when it hangs', async () => {
      vi.useFakeTimers();
      try {
        mocks.loadProjectConfig.mockResolvedValueOnce(linkedProject);
        fetchMock.mockImplementationOnce(
          (_url: string, init: RequestInit) =>
            new Promise((_resolve, reject) =>
              init.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
            ),
        );

        const pending = resolveTarget(options(), fetchMock as typeof fetch, '/observability/traces');
        await vi.advanceTimersByTimeAsync(5_000);
        await expect(pending).resolves.toMatchObject({ baseUrl: 'https://observability.mastra.ai' });
        expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('(timed out after 5000ms)'));
      } finally {
        vi.useRealTimers();
      }
    });

    it('skips the lookup when no project ID is known', async () => {
      await expect(resolveTarget(options(), fetchMock as typeof fetch, '/observability/traces')).resolves.toMatchObject(
        { baseUrl: 'https://observability.mastra.ai' },
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('lets --url win over the endpoint env and region lookup', async () => {
      process.env.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT = 'https://observability.eu.mastra.ai';
      mocks.loadProjectConfig.mockResolvedValueOnce(linkedProject);

      await expect(
        resolveTarget(
          options({ url: 'https://observability.mastra.ai' }),
          fetchMock as typeof fetch,
          '/observability/traces',
        ),
      ).resolves.toMatchObject({ baseUrl: 'https://observability.mastra.ai' });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('uses explicit --url for learning paths instead of the hosted endpoint', async () => {
    await expect(
      resolveTarget(
        options({ url: 'https://learning-dev.example.com', header: ['Authorization: Bearer custom'] }),
        fetchMock as typeof fetch,
        '/learning/entities',
      ),
    ).resolves.toEqual({
      baseUrl: 'https://learning-dev.example.com',
      headers: { Authorization: 'Bearer custom' },
      timeoutMs: 30_000,
    });
  });

  it('uses explicit --url for observability paths instead of hosted endpoint', async () => {
    process.env.MASTRA_PLATFORM_ACCESS_TOKEN = 'env-token';
    process.env.MASTRA_PROJECT_ID = 'env-project';

    await expect(
      resolveTarget(
        options({
          url: 'https://observability-dev.example.com',
          header: ['Authorization: Bearer custom', 'X-Mastra-Project-Id: custom-project'],
        }),
        fetchMock as typeof fetch,
        '/observability/traces',
      ),
    ).resolves.toEqual({
      baseUrl: 'https://observability-dev.example.com',
      headers: {
        Authorization: 'Bearer custom',
        'X-Mastra-Project-Id': 'custom-project',
      },
      timeoutMs: 30_000,
    });
  });

  it.each(['https://observability.mastra.ai', 'https://observability.eu.mastra.ai'])(
    'uses Platform credentials for the trusted observability URL %s',
    async url => {
      process.env.MASTRA_PLATFORM_ACCESS_TOKEN = 'env-token';
      process.env.MASTRA_PROJECT_ID = 'env-project';

      await expect(
        resolveTarget(options({ url }), fetchMock as typeof fetch, '/observability/traces'),
      ).resolves.toEqual({
        baseUrl: url,
        headers: {
          Authorization: 'Bearer env-token',
          'X-Mastra-Project-Id': 'env-project',
        },
        fallbackHeaders: {
          Authorization: 'Bearer platform-token',
          'X-Mastra-Project-Id': 'env-project',
        },
        timeoutMs: 30_000,
      });
    },
  );

  it('preserves explicit credentials for a trusted observability URL', async () => {
    process.env.MASTRA_PLATFORM_ACCESS_TOKEN = 'env-token';
    process.env.MASTRA_PROJECT_ID = 'env-project';

    await expect(
      resolveTarget(
        options({
          url: 'https://observability.eu.mastra.ai',
          header: ['Authorization: Bearer custom', 'X-Mastra-Project-Id: custom-project'],
        }),
        fetchMock as typeof fetch,
        '/observability/traces',
      ),
    ).resolves.toEqual({
      baseUrl: 'https://observability.eu.mastra.ai',
      headers: {
        Authorization: 'Bearer custom',
        'X-Mastra-Project-Id': 'custom-project',
      },
      timeoutMs: 30_000,
    });
  });

  it.each([
    'https://observability.mastra.ai.attacker.example',
    'https://observability.eu.mastra.ai:444',
    'http://observability.eu.mastra.ai',
  ])('does not send Platform credentials to the untrusted observability URL %s', async url => {
    process.env.MASTRA_PLATFORM_ACCESS_TOKEN = 'env-token';
    process.env.MASTRA_PROJECT_ID = 'env-project';

    await expect(resolveTarget(options({ url }), fetchMock as typeof fetch, '/observability/traces')).resolves.toEqual({
      baseUrl: url,
      headers: {},
      timeoutMs: 30_000,
    });

    expect(mocks.loadProjectConfig).not.toHaveBeenCalled();
    expect(mocks.getToken).not.toHaveBeenCalled();
  });

  it('carries --server-api-prefix for observability paths when --url is set', async () => {
    await expect(
      resolveTarget(
        options({
          url: 'https://runtime.example.com',
          serverApiPrefix: '/api/mastra-studio',
          header: ['Authorization: Bearer token'],
        }),
        fetchMock as typeof fetch,
        '/observability/traces',
      ),
    ).resolves.toEqual({
      baseUrl: 'https://runtime.example.com',
      headers: { Authorization: 'Bearer token' },
      timeoutMs: 30_000,
      apiPrefix: '/api/mastra-studio',
    });
  });

  it('uses localhost when the default server is reachable and cancels the probe body', async () => {
    const cancel = vi.fn();
    fetchMock.mockResolvedValueOnce({ ok: true, body: { cancel } });

    await expect(
      resolveTarget(options({ header: ['X-Test: yes'], timeout: '5000' }), fetchMock as typeof fetch),
    ).resolves.toEqual({
      baseUrl: 'http://localhost:4111',
      headers: { 'X-Test': 'yes' },
      timeoutMs: 5000,
    });

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4111/api/system/api-schema', {
      method: 'GET',
      signal: expect.any(AbortSignal),
    });
    expect(cancel).toHaveBeenCalledOnce();
    expect(mocks.loadProjectConfig).not.toHaveBeenCalled();
  });

  it('falls back to linked platform project discovery by ID or slug', async () => {
    mocks.loadProjectConfig.mockResolvedValueOnce(linkedProject).mockResolvedValueOnce({
      ...linkedProject,
      projectId: 'missing-id',
    });
    mocks.fetchServerProjects
      .mockResolvedValueOnce([
        { id: 'project-2', slug: 'other', instanceUrl: 'https://other.example.com' },
        { id: 'project-1', slug: 'project-one', instanceUrl: 'https://project.example.com' },
      ])
      .mockResolvedValueOnce([{ id: 'project-1', slug: 'project-one', instanceUrl: 'https://slug.example.com' }]);

    await expect(resolveTarget(options({ header: ['X-Test: yes'] }), fetchMock as typeof fetch)).resolves.toEqual({
      baseUrl: 'https://project.example.com',
      headers: { Authorization: 'Bearer platform-token', 'X-Test': 'yes' },
      timeoutMs: 30_000,
    });
    await expect(resolveTarget(options(), fetchMock as typeof fetch)).resolves.toMatchObject({
      baseUrl: 'https://slug.example.com',
    });

    expect(mocks.loadProjectConfig).toHaveBeenCalledWith(process.cwd());
    expect(mocks.getToken).toHaveBeenCalledTimes(2);
    expect(mocks.fetchServerProjects).toHaveBeenCalledWith('platform-token', 'org-1');
  });

  it('sends the deploy-owned organization for discovered Factory routes', async () => {
    mocks.loadProjectConfig.mockResolvedValueOnce(linkedProject);
    mocks.fetchServerProjects.mockResolvedValueOnce([
      { id: 'project-1', slug: 'project-one', instanceUrl: 'https://shipyard.factory.mastra.cloud' },
    ]);

    await expect(resolveTarget(options(), fetchMock as typeof fetch, '/web/factory/projects')).resolves.toMatchObject({
      headers: {
        Authorization: 'Bearer platform-token',
        'X-Mastra-Organization-Id': 'org-1',
      },
    });
  });

  it('does not use localhost when the probe returns a non-2xx response', async () => {
    const cancel = vi.fn();
    fetchMock.mockResolvedValueOnce({ ok: false, body: { cancel } });
    mocks.loadProjectConfig.mockResolvedValueOnce(linkedProject);
    mocks.fetchServerProjects.mockResolvedValueOnce([
      { id: 'project-1', slug: 'project-one', instanceUrl: 'https://project.example.com' },
    ]);

    await expect(resolveTarget(options(), fetchMock as typeof fetch)).resolves.toMatchObject({
      baseUrl: 'https://project.example.com',
    });

    expect(cancel).toHaveBeenCalledOnce();
    expect(mocks.loadProjectConfig).toHaveBeenCalledWith(process.cwd());
    expect(mocks.fetchServerProjects).toHaveBeenCalledOnce();
  });

  it('throws target resolution errors for missing local/project/platform URL cases', async () => {
    await expect(resolveTarget(options(), fetchMock as typeof fetch)).rejects.toMatchObject({
      code: 'SERVER_UNREACHABLE',
      message: 'Could not connect to target server',
    });

    mocks.loadProjectConfig.mockResolvedValue(linkedProject);
    mocks.fetchServerProjects.mockResolvedValue([{ id: 'project-1', slug: 'project-one' }]);
    await expect(resolveTarget(options(), fetchMock as typeof fetch)).rejects.toMatchObject({
      code: 'PLATFORM_RESOLUTION_FAILED',
      details: { projectId: 'project-1', projectSlug: 'project-one' },
    });

    mocks.fetchServerProjects.mockRejectedValue(new Error('platform down'));
    await expect(resolveTarget(options(), fetchMock as typeof fetch)).rejects.toMatchObject({
      code: 'PLATFORM_RESOLUTION_FAILED',
      details: { message: 'platform down' },
    });
  });

  it.each(['-1', 'not-a-number'])(`defaults invalid timeout %s to 30 seconds`, async timeout => {
    await expect(resolveTarget(options({ url: 'https://runtime.example.com', timeout }))).resolves.toMatchObject({
      timeoutMs: 30_000,
    });
  });

  describe('platform-hosted --url', () => {
    it.each([
      ['https://shipyard.factory.mastra.cloud', 'production factory'],
      ['https://shipyard.studio.mastra.cloud', 'production studio'],
      ['https://shipyard.factory.staging.mastra.cloud', 'staging factory'],
      ['https://shipyard.studio.staging.mastra.cloud', 'staging studio'],
    ])('attaches Bearer from stored credentials for %s (%s)', async url => {
      await expect(resolveTarget(options({ url }))).resolves.toEqual({
        baseUrl: url,
        headers: { Authorization: 'Bearer platform-token' },
        timeoutMs: 30_000,
      });

      expect(mocks.getToken).toHaveBeenCalledOnce();
    });

    it('sends the selected organization for an explicit hosted Factory route', async () => {
      await expect(
        resolveTarget(options({ url: 'https://shipyard.factory.mastra.cloud' }), undefined, '/web/factory/projects'),
      ).resolves.toEqual({
        baseUrl: 'https://shipyard.factory.mastra.cloud',
        headers: {
          Authorization: 'Bearer platform-token',
          'X-Mastra-Organization-Id': 'org-current',
        },
        timeoutMs: 30_000,
      });
    });

    it('preserves an explicit organization header for an explicit hosted Factory route', async () => {
      await expect(
        resolveTarget(
          options({
            url: 'https://shipyard.factory.mastra.cloud',
            header: ['X-Mastra-Organization-Id: org-explicit'],
          }),
          undefined,
          '/web/factory/projects',
        ),
      ).resolves.toMatchObject({
        headers: {
          Authorization: 'Bearer platform-token',
          'X-Mastra-Organization-Id': 'org-explicit',
        },
      });
      expect(mocks.getCurrentOrgId).not.toHaveBeenCalled();
    });

    it.each([
      ['https://shipyard.server.mastra.cloud', 'production user-provided server'],
      ['https://shipyard.server.staging.mastra.cloud', 'staging user-provided server'],
      ['https://runtime.example.com', 'arbitrary custom URL'],
      ['http://shipyard.factory.mastra.cloud', 'non-HTTPS platform host'],
    ])('does not attach Bearer for %s (%s)', async url => {
      await expect(resolveTarget(options({ url }))).resolves.toEqual({
        baseUrl: url,
        headers: {},
        timeoutMs: 30_000,
      });

      expect(mocks.getToken).not.toHaveBeenCalled();
    });

    it('respects an explicit Authorization header for platform-hosted URLs', async () => {
      await expect(
        resolveTarget(
          options({
            url: 'https://shipyard.factory.mastra.cloud',
            header: ['Authorization: Bearer override'],
          }),
        ),
      ).resolves.toEqual({
        baseUrl: 'https://shipyard.factory.mastra.cloud',
        headers: { Authorization: 'Bearer override' },
        timeoutMs: 30_000,
      });

      expect(mocks.getToken).not.toHaveBeenCalled();
    });

    it('matches an explicit Authorization header case-insensitively', async () => {
      await expect(
        resolveTarget(
          options({
            url: 'https://shipyard.factory.mastra.cloud',
            header: ['authorization: Bearer override'],
          }),
        ),
      ).resolves.toEqual({
        baseUrl: 'https://shipyard.factory.mastra.cloud',
        headers: { authorization: 'Bearer override' },
        timeoutMs: 30_000,
      });

      expect(mocks.getToken).not.toHaveBeenCalled();
    });

    it('omits Authorization when no stored credentials are available', async () => {
      mocks.getToken.mockRejectedValueOnce(new Error('not logged in'));

      await expect(resolveTarget(options({ url: 'https://shipyard.factory.mastra.cloud' }))).resolves.toEqual({
        baseUrl: 'https://shipyard.factory.mastra.cloud',
        headers: {},
        timeoutMs: 30_000,
      });
    });
  });

  it('throws malformed header errors before probing targets', async () => {
    await expect(resolveTarget(options({ header: ['invalid'] }))).rejects.toMatchObject({
      code: 'MALFORMED_HEADER',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.loadProjectConfig).not.toHaveBeenCalled();
  });
});
