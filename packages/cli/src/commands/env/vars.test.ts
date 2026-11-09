import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Environment } from './platform-api.js';

const mockGetToken = vi.fn();

vi.mock('../auth/credentials.js', () => ({
  getToken: mockGetToken,
}));

const mockResolveCurrentOrg = vi.fn();

vi.mock('../auth/orgs.js', () => ({
  resolveCurrentOrg: mockResolveCurrentOrg,
}));

const mockResolveProject = vi.fn();

vi.mock('./resolve-project.js', () => ({
  resolveProject: mockResolveProject,
}));

const mockFetchEnvironmentList = vi.fn();

vi.mock('./platform-api.js', () => ({
  fetchEnvironmentList: mockFetchEnvironmentList,
}));

const mockGetServerProjectEnv = vi.fn();

vi.mock('../server/platform-api.js', () => ({
  getServerProjectEnv: mockGetServerProjectEnv,
}));

const mockWriteFile = vi.fn();
const mockChmod = vi.fn();

vi.mock('node:fs/promises', () => ({
  writeFile: mockWriteFile,
  chmod: mockChmod,
}));

function environment(overrides: Partial<Environment>): Environment {
  return {
    id: 'env-1',
    projectId: 'proj-1',
    name: 'Production',
    slug: 'my-app',
    type: 'production',
    region: null,
    branch: null,
    instanceUrl: null,
    customServerUrl: null,
    observabilityProjectId: null,
    envVars: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockGetToken.mockResolvedValue('tok');
  mockResolveCurrentOrg.mockResolvedValue({ orgId: 'org-1', orgName: 'Org' });
  mockResolveProject.mockResolvedValue({ id: 'proj-1', name: 'My App', slug: 'my-app', organizationId: 'org-1' });
  mockGetServerProjectEnv.mockResolvedValue({});
  mockWriteFile.mockResolvedValue(undefined);
  mockChmod.mockResolvedValue(undefined);
});

describe('envVarsPullAction', () => {
  it("pulls only the selected environment's vars when the environment is the authority (regression: QA pull wrote production values)", async () => {
    // For env-first projects the platform answers the legacy project-scope
    // endpoint with the *production* environment's vars. Merging that in on
    // top of the selected environment made `pull qa` write production's
    // value for every key both environments define.
    mockGetServerProjectEnv.mockResolvedValue({ API_KEY: 'prod-key', ONLY_IN_PROD: '1' });
    mockFetchEnvironmentList.mockResolvedValue({
      envVarsAuthority: 'environment',
      environments: [
        environment({ id: 'env-1', slug: 'my-app', envVars: { API_KEY: 'prod-key', ONLY_IN_PROD: '1' } }),
        environment({
          id: 'env-2',
          name: 'QA',
          slug: 'my-app--qa',
          type: 'staging',
          envVars: { API_KEY: 'qa-key', ONLY_IN_QA: '1' },
        }),
      ],
    });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { envVarsPullAction } = await import('./vars.js');
    await envVarsPullAction('my-app--qa', {});

    expect(mockGetServerProjectEnv).not.toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [filePath, content, options] = mockWriteFile.mock.calls[0]!;
    expect(filePath).toContain('.env');
    expect(content).toContain('API_KEY="qa-key"');
    expect(content).toContain('ONLY_IN_QA="1"');
    expect(content).not.toContain('prod-key');
    expect(content).not.toContain('ONLY_IN_PROD=');
    expect(content).toContain('Pulled from Mastra environment my-app--qa');
    expect(options).toEqual({ encoding: 'utf-8', mode: 0o600, flag: 'wx' });
    expect(mockChmod).toHaveBeenCalledWith(filePath, 0o600);
    expect(spy.mock.calls.some(c => String(c[0]).includes('Pulled 2 variable(s) from my-app--qa'))).toBe(true);
    spy.mockRestore();
  });

  it('treats a missing envVarsAuthority as environment (platforms that predate the field)', async () => {
    mockGetServerProjectEnv.mockResolvedValue({ SHARED: 'production' });
    mockFetchEnvironmentList.mockResolvedValue({ environments: [environment({ envVars: { SHARED: 'environment' } })] });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { envVarsPullAction } = await import('./vars.js');
    await envVarsPullAction(undefined, {});

    expect(mockGetServerProjectEnv).not.toHaveBeenCalled();
    const [, content] = mockWriteFile.mock.calls[0]!;
    expect(content).toContain('SHARED="environment"');
    expect(content).not.toContain('SHARED="production"');
    spy.mockRestore();
  });

  it('pulls the project-scoped vars when a legacy project is the authority', async () => {
    // Un-adopted legacy projects still boot from the project row; the
    // environment row's vars are not read by anything, so they are not pulled.
    mockGetServerProjectEnv.mockResolvedValue({ A: '1', SHARED: 'project' });
    mockFetchEnvironmentList.mockResolvedValue({
      envVarsAuthority: 'project',
      environments: [environment({ envVars: { SHARED: 'environment', STALE: 'unread' } })],
    });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { envVarsPullAction } = await import('./vars.js');
    await envVarsPullAction(undefined, {});

    expect(mockGetServerProjectEnv).toHaveBeenCalledWith('tok', 'org-1', 'proj-1');
    const [, content] = mockWriteFile.mock.calls[0]!;
    expect(content).toContain('A="1"');
    expect(content).toContain('SHARED="project"');
    expect(content).not.toContain('SHARED="environment"');
    expect(content).not.toContain('STALE=');
    expect(spy.mock.calls.some(c => String(c[0]).includes('Pulled 2 variable(s)'))).toBe(true);
    spy.mockRestore();
  });

  it('lists managed var names as comments without values', async () => {
    mockFetchEnvironmentList.mockResolvedValue({
      environments: [
        environment({ envVars: { B: '2' }, managedEnvVarNames: ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'] }),
      ],
    });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { envVarsPullAction } = await import('./vars.js');
    await envVarsPullAction(undefined, {});

    const [, content] = mockWriteFile.mock.calls[0]!;
    expect(content).toContain('# TURSO_DATABASE_URL');
    expect(content).toContain('# TURSO_AUTH_TOKEN');
    expect(content).not.toMatch(/^TURSO_DATABASE_URL=/m);
    expect(content).not.toMatch(/^TURSO_AUTH_TOKEN=/m);
    spy.mockRestore();
  });

  it('selects the environment by name, slug, or id', async () => {
    mockFetchEnvironmentList.mockResolvedValue({
      environments: [
        environment({ id: 'env-1', slug: 'my-app', envVars: { PROD: '1' } }),
        environment({ id: 'env-2', name: 'Staging', slug: 'my-app-staging', type: 'staging', envVars: { STAGE: '1' } }),
      ],
    });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { envVarsPullAction } = await import('./vars.js');
    await envVarsPullAction('my-app-staging', {});

    const [, content] = mockWriteFile.mock.calls[0]!;
    expect(content).toContain('STAGE="1"');
    expect(content).not.toContain('PROD=');
    spy.mockRestore();
  });

  it('requires an environment argument when the project has more than one', async () => {
    mockFetchEnvironmentList.mockResolvedValue({
      environments: [
        environment({ id: 'env-1', slug: 'my-app' }),
        environment({ id: 'env-2', slug: 'my-app-staging' }),
      ],
    });

    const { envVarsPullAction } = await import('./vars.js');
    await expect(envVarsPullAction(undefined, {})).rejects.toThrow(/my-app-staging/);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('throws when the named environment does not exist', async () => {
    mockFetchEnvironmentList.mockResolvedValue({ environments: [environment({})] });

    const { envVarsPullAction } = await import('./vars.js');
    await expect(envVarsPullAction('nope', {})).rejects.toThrow('Environment not found: nope');
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('throws when the project has no environments', async () => {
    mockFetchEnvironmentList.mockResolvedValue({ environments: [] });

    const { envVarsPullAction } = await import('./vars.js');
    await expect(envVarsPullAction(undefined, {})).rejects.toThrow('No environments found');
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('writes to a custom output file', async () => {
    mockFetchEnvironmentList.mockResolvedValue({ environments: [environment({ envVars: { FOO: 'bar' } })] });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { envVarsPullAction } = await import('./vars.js');
    await envVarsPullAction(undefined, { output: '.env.production' });

    const [filePath] = mockWriteFile.mock.calls[0]!;
    expect(filePath).toContain('.env.production');
    expect(spy.mock.calls.some(c => String(c[0]).includes('.env.production'))).toBe(true);
    spy.mockRestore();
  });

  it('requires --force before overwriting an existing output file', async () => {
    mockFetchEnvironmentList.mockResolvedValue({ environments: [environment({ envVars: { FOO: 'bar' } })] });
    const error = Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
    mockWriteFile.mockRejectedValueOnce(error);

    const { envVarsPullAction } = await import('./vars.js');
    await expect(envVarsPullAction(undefined, {})).rejects.toThrow('Refusing to overwrite .env');

    expect(mockWriteFile).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
      encoding: 'utf-8',
      mode: 0o600,
      flag: 'wx',
    });
    expect(mockChmod).not.toHaveBeenCalled();
  });

  it('overwrites an existing output file when --force is set', async () => {
    mockFetchEnvironmentList.mockResolvedValue({ environments: [environment({ envVars: { FOO: 'bar' } })] });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { envVarsPullAction } = await import('./vars.js');
    await envVarsPullAction(undefined, { force: true });

    expect(mockWriteFile).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
      encoding: 'utf-8',
      mode: 0o600,
      flag: 'w',
    });
    expect(mockChmod).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('escapes special characters and skips unsafe keys like the legacy pull', async () => {
    mockFetchEnvironmentList.mockResolvedValue({
      environments: [environment({ envVars: { TOKEN: 'price=$100`cmd`\nline2', 'bad-key': 'nope' } })],
    });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { envVarsPullAction } = await import('./vars.js');
    await envVarsPullAction(undefined, {});

    const [, content] = mockWriteFile.mock.calls[0]!;
    expect(content).toContain('TOKEN="price=\\$100\\`cmd\\`\\nline2"');
    expect(content).not.toContain('bad-key=');
    expect(content).toContain('# Skipped unsafe key');
    spy.mockRestore();
  });
});
