import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiGlobalOptions } from './target';

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  fetchServerProjects: vi.fn(),
  loadProjectConfig: vi.fn(),
}));

vi.mock('../auth/credentials.js', () => ({
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
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.MASTRA_PLATFORM_ACCESS_TOKEN;
    delete process.env.MASTRA_PROJECT_ID;
    delete process.env.MASTRA_ORGANIZATION_ID;
    fetchMock.mockRejectedValue(new Error('local unavailable'));
    mocks.getToken.mockResolvedValue('platform-token');
    mocks.loadProjectConfig.mockResolvedValue(null);
  });

  afterEach(() => {
    delete process.env.MASTRA_PLATFORM_ACCESS_TOKEN;
    delete process.env.MASTRA_PROJECT_ID;
    delete process.env.MASTRA_ORGANIZATION_ID;
    vi.unstubAllGlobals();
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

    expect(fetchMock).not.toHaveBeenCalled();
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

    expect(fetchMock).not.toHaveBeenCalled();
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

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.fetchServerProjects).not.toHaveBeenCalled();
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
