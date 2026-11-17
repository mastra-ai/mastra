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

const mockUpdateEnvironmentVars = vi.fn();

vi.mock('./platform-api.js', async importOriginal => ({
  ...(await importOriginal<typeof import('./platform-api.js')>()),
  fetchEnvironmentList: mockFetchEnvironmentList,
  updateEnvironmentVars: mockUpdateEnvironmentVars,
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

  it('lists write-only secrets as comments instead of writing the placeholder', async () => {
    mockFetchEnvironmentList.mockResolvedValue({
      environments: [
        environment({
          envVars: { LOG_LEVEL: 'debug', OPENAI_API_KEY: '__mastra_secret__', REDIS_URL: '__mastra_secret__' },
          envVarKinds: { LOG_LEVEL: 'config', OPENAI_API_KEY: 'secret', REDIS_URL: 'secret' },
          secretsWriteOnly: true,
        }),
      ],
    });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { envVarsPullAction } = await import('./vars.js');
    await envVarsPullAction(undefined, {});

    const [, content] = mockWriteFile.mock.calls[0]!;
    expect(content).toContain('LOG_LEVEL="debug"');
    expect(content).not.toContain('__mastra_secret__');
    expect(content).toContain('# OPENAI_API_KEY');
    expect(content).toContain('# REDIS_URL');
    expect(content).not.toMatch(/^OPENAI_API_KEY=/m);
    expect(content).not.toMatch(/^REDIS_URL=/m);
    const output = spy.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('Pulled 1 variable(s)');
    expect(output).toContain('2 secret name(s) listed as comments');
    expect(output).not.toContain('__mastra_secret__');
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

describe('envVarsSetAction', () => {
  beforeEach(() => {
    mockUpdateEnvironmentVars.mockResolvedValue(environment({}));
  });

  async function runSet(envArg: string | undefined, assignments: string[], options = {}) {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const { envVarsSetAction } = await import('./vars.js');
      await envVarsSetAction(envArg, assignments, options);
      return spy.mock.calls.map(c => String(c[0])).join('\n');
    } finally {
      spy.mockRestore();
    }
  }

  it('sends the stored vars back with new values and kind flags merged in', async () => {
    mockFetchEnvironmentList.mockResolvedValue({
      environments: [environment({ envVars: { OPENAI_API_KEY: '__mastra_secret__', LOG_LEVEL: 'info' } })],
    });

    const output = await runSet('my-app', ['LOG_LEVEL=debug', 'STRIPE_KEY=sk-new'], {
      secret: ['STRIPE_KEY'],
      config: ['LOG_LEVEL'],
    });

    expect(mockUpdateEnvironmentVars).toHaveBeenCalledWith('tok', 'org-1', 'proj-1', 'env-1', {
      // The placeholder tells the platform to keep the stored secret.
      envVars: { OPENAI_API_KEY: '__mastra_secret__', LOG_LEVEL: 'debug', STRIPE_KEY: 'sk-new' },
      envVarMeta: { STRIPE_KEY: { secret: true }, LOG_LEVEL: { secret: false } },
    });
    expect(output).toContain('set LOG_LEVEL, STRIPE_KEY');
    expect(output).not.toContain('sk-new');
    expect(output).not.toContain('debug');
    expect(output).not.toContain('__mastra_secret__');
  });

  it('treats a lone KEY=VALUE as a var, not an environment name', async () => {
    mockFetchEnvironmentList.mockResolvedValue({ environments: [environment({ envVars: {} })] });

    await runSet('API_KEY=abc', []);

    expect(mockUpdateEnvironmentVars).toHaveBeenCalledWith('tok', 'org-1', 'proj-1', 'env-1', {
      envVars: { API_KEY: 'abc' },
    });
  });

  it('changes only the kind when no values are passed', async () => {
    mockFetchEnvironmentList.mockResolvedValue({ environments: [environment({ envVars: { DATABASE_URL: 'x' } })] });

    await runSet(undefined, [], { secret: ['DATABASE_URL'] });

    expect(mockUpdateEnvironmentVars).toHaveBeenCalledWith('tok', 'org-1', 'proj-1', 'env-1', {
      envVarMeta: { DATABASE_URL: { secret: true } },
    });
  });

  it('requires a new value to turn a write-only secret into config', async () => {
    mockFetchEnvironmentList.mockResolvedValue({
      environments: [environment({ envVars: { LOG_LEVEL: '__mastra_secret__' } })],
    });

    await expect(runSet(undefined, [], { config: ['LOG_LEVEL'] })).rejects.toThrow(/write-only secret.*Re-enter it/);
    expect(mockUpdateEnvironmentVars).not.toHaveBeenCalled();
  });

  it('rejects flags for vars that are not set', async () => {
    mockFetchEnvironmentList.mockResolvedValue({ environments: [environment({ envVars: {} })] });

    await expect(runSet(undefined, [], { secret: ['MISSING'] })).rejects.toThrow('MISSING is not set on my-app');
    expect(mockUpdateEnvironmentVars).not.toHaveBeenCalled();
  });

  it('rejects a var marked both --secret and --config', async () => {
    await expect(runSet(undefined, ['A=1'], { secret: ['A'], config: ['A'] })).rejects.toThrow(
      'both --secret and --config: A',
    );
    expect(mockFetchEnvironmentList).not.toHaveBeenCalled();
  });

  it('rejects malformed assignments without echoing the value', async () => {
    await expect(runSet(undefined, ['NOT_AN_ASSIGNMENT'])).rejects.toThrow('Expected KEY=VALUE');
    await expect(runSet(undefined, ['bad-key=s3cret'])).rejects.not.toThrow(/s3cret/);
  });

  it('refuses to send the placeholder as a value', async () => {
    await expect(runSet(undefined, ['API_KEY=__mastra_secret__'])).rejects.toThrow('reserved placeholder');
  });

  it('requires something to set', async () => {
    await expect(runSet('my-app', [])).rejects.toThrow('Nothing to set');
  });

  it('refuses legacy projects whose runtime reads the project settings', async () => {
    mockFetchEnvironmentList.mockResolvedValue({ envVarsAuthority: 'project', environments: [environment({})] });

    await expect(runSet(undefined, ['A=1'])).rejects.toThrow('legacy project settings');
    expect(mockUpdateEnvironmentVars).not.toHaveBeenCalled();
  });
});
