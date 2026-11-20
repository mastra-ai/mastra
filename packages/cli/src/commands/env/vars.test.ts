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
    mockFetchEnvironmentList.mockResolvedValue({ environments: [environment({ envVars: {} })] });
  });

  async function runSet(
    envArg: string | undefined,
    varArgs: string[],
    options: { project?: string; secret?: boolean; config?: boolean } = {},
  ) {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const { envVarsSetAction } = await import('./vars.js');
      await envVarsSetAction(envArg, varArgs, options);
      return spy.mock.calls.map(c => String(c[0])).join('\n');
    } finally {
      spy.mockRestore();
    }
  }

  it('sends the stored vars back with new values merged in and flags every var in the command', async () => {
    mockFetchEnvironmentList.mockResolvedValue({
      environments: [environment({ envVars: { OPENAI_API_KEY: '__mastra_secret__', LOG_LEVEL: 'info' } })],
    });

    const output = await runSet('my-app', ['STRIPE_KEY=sk-new', 'WEBHOOK_SECRET=whsec-new'], { secret: true });

    expect(mockUpdateEnvironmentVars).toHaveBeenCalledWith('tok', 'org-1', 'proj-1', 'env-1', {
      // The placeholder tells the platform to keep the stored secret.
      envVars: {
        OPENAI_API_KEY: '__mastra_secret__',
        LOG_LEVEL: 'info',
        STRIPE_KEY: 'sk-new',
        WEBHOOK_SECRET: 'whsec-new',
      },
      envVarMeta: { STRIPE_KEY: { secret: true }, WEBHOOK_SECRET: { secret: true } },
    });
    expect(output).toContain('set STRIPE_KEY, WEBHOOK_SECRET; secret: STRIPE_KEY, WEBHOOK_SECRET');
    expect(output).not.toContain('sk-new');
    expect(output).not.toContain('whsec-new');
    expect(output).not.toContain('__mastra_secret__');
  });

  it('marks every var in the command as config with --config', async () => {
    mockFetchEnvironmentList.mockResolvedValue({ environments: [environment({ envVars: { LOG_LEVEL: 'info' } })] });

    await runSet('my-app', ['LOG_LEVEL=debug', 'FEATURE_X=on'], { config: true });

    expect(mockUpdateEnvironmentVars).toHaveBeenCalledWith('tok', 'org-1', 'proj-1', 'env-1', {
      envVars: { LOG_LEVEL: 'debug', FEATURE_X: 'on' },
      envVarMeta: { LOG_LEVEL: { secret: false }, FEATURE_X: { secret: false } },
    });
  });

  it('sends no kind flags without --secret or --config, so stored kinds stay', async () => {
    await runSet('my-app', ['A=1']);

    expect(mockUpdateEnvironmentVars).toHaveBeenCalledWith('tok', 'org-1', 'proj-1', 'env-1', {
      envVars: { A: '1' },
    });
  });

  it('treats a lone KEY=VALUE as a var, not an environment name', async () => {
    await runSet('API_KEY=abc', []);

    expect(mockUpdateEnvironmentVars).toHaveBeenCalledWith('tok', 'org-1', 'proj-1', 'env-1', {
      envVars: { API_KEY: 'abc' },
    });
  });

  it('keeps __proto__ as a variable instead of setting the prototype', async () => {
    await runSet('my-app', ['__proto__=1'], { secret: true });

    const sent = mockUpdateEnvironmentVars.mock.calls[0]![4];
    expect(Object.keys(sent.envVars)).toEqual(['__proto__']);
    expect(Object.keys(sent.envVarMeta)).toEqual(['__proto__']);
    expect(JSON.parse(JSON.stringify(sent))).toEqual(
      JSON.parse('{"envVars":{"__proto__":"1"},"envVarMeta":{"__proto__":{"secret":true}}}'),
    );
  });

  it('changes only the kind for bare names, including one in the environment slot', async () => {
    mockFetchEnvironmentList.mockResolvedValue({
      environments: [environment({ envVars: { DATABASE_URL: 'x', REDIS_URL: 'y' } })],
    });

    await runSet('DATABASE_URL', ['REDIS_URL'], { secret: true });

    expect(mockUpdateEnvironmentVars).toHaveBeenCalledWith('tok', 'org-1', 'proj-1', 'env-1', {
      envVarMeta: { DATABASE_URL: { secret: true }, REDIS_URL: { secret: true } },
    });
  });

  it('needs an environment when a bare name lands in its slot and the project has several', async () => {
    mockFetchEnvironmentList.mockResolvedValue({
      environments: [
        environment({ envVars: { DATABASE_URL: 'x' } }),
        environment({ id: 'env-2', slug: 'staging', name: 'Staging' }),
      ],
    });

    await expect(runSet('DATABASE_URL', [], { secret: true })).rejects.toThrow('Multiple environments found');
    expect(mockUpdateEnvironmentVars).not.toHaveBeenCalled();
  });

  it('requires a new value to turn a write-only secret into config', async () => {
    mockFetchEnvironmentList.mockResolvedValue({
      environments: [environment({ envVars: { LOG_LEVEL: '__mastra_secret__' } })],
    });

    const error = await runSet(undefined, ['LOG_LEVEL'], { config: true }).catch(e => e as Error);
    expect(error.message).toBe(
      "The variable in argument 1 is a write-only secret, so its value can't be kept as config. Re-enter it as KEY=VALUE with --config.",
    );
    expect(mockUpdateEnvironmentVars).not.toHaveBeenCalled();

    await runSet(undefined, ['LOG_LEVEL=debug'], { config: true });
    expect(mockUpdateEnvironmentVars).toHaveBeenCalledWith('tok', 'org-1', 'proj-1', 'env-1', {
      envVars: { LOG_LEVEL: 'debug' },
      envVarMeta: { LOG_LEVEL: { secret: false } },
    });
  });

  it('rejects bare names that are not set without echoing them', async () => {
    mockFetchEnvironmentList.mockResolvedValue({ environments: [environment({ envVars: { A: '1' } })] });

    const error = await runSet(undefined, ['A', 'ghp_abc123'], { secret: true }).catch(e => e as Error);
    expect(error.message).toBe('The variable in argument 2 is not set on my-app. Pass it as KEY=VALUE.');
    expect(mockUpdateEnvironmentVars).not.toHaveBeenCalled();
  });

  it('rejects a bare name without a kind flag, without echoing it', async () => {
    const error = await runSet('my-app', ['ghp_abc123']).catch(e => e as Error);
    expect(error.message).toBe('Expected KEY=VALUE for variable argument 1. A bare name needs --secret or --config.');
    expect(mockUpdateEnvironmentVars).not.toHaveBeenCalled();
  });

  it('rejects --secret and --config together', async () => {
    const error = await runSet(undefined, ['A=1'], { secret: true, config: true }).catch(e => e as Error);
    expect(error.message).toBe('Pass either --secret or --config, not both. Set mixed kinds with separate commands.');
    expect(mockFetchEnvironmentList).not.toHaveBeenCalled();
  });

  it('rejects malformed arguments without echoing them', async () => {
    const cases: [string[], string][] = [
      [['sk-live-abc123'], 'Expected KEY=VALUE for variable argument 1'],
      [['bad-key=s3cret'], 'Invalid variable name in argument 1'],
      [['sk-abc/def=='], 'Invalid variable name in argument 1'],
      [['A=1', 'API_KEY: sk-live-abc123'], 'Expected KEY=VALUE for variable argument 2'],
    ];
    for (const [args, message] of cases) {
      const error = await runSet('my-app', args).catch(e => e as Error);
      expect(error.message).toContain(message);
      expect(error.message).not.toMatch(/abc|s3cret/);
    }
    const bareError = await runSet('my-app', ['sk-live-abc123'], { secret: true }).catch(e => e as Error);
    expect(bareError.message).toBe('Invalid variable name in argument 1');
  });

  it('does not echo an unknown environment argument, which may be a pasted value', async () => {
    const error = await runSet('sk-live-abc123', ['A=1']).catch((e: Error) => e);
    expect(error.message).toContain('Expected KEY=VALUE for variable argument 1');
    expect(error.message).not.toContain('abc123');
  });

  it('refuses to send the placeholder as a value without echoing the name', async () => {
    const error = await runSet(undefined, ['API_KEY=__mastra_secret__']).catch((e: Error) => e);
    expect(error.message).toBe('Argument 1 has a reserved placeholder value. Pass the real value.');
  });

  it('requires something to set', async () => {
    await expect(runSet(undefined, [])).rejects.toThrow('Nothing to set');
    await expect(runSet('my-app', [], { secret: true })).rejects.toThrow('Nothing to set');
  });

  it('refuses legacy projects whose runtime reads the project settings', async () => {
    mockFetchEnvironmentList.mockResolvedValue({ envVarsAuthority: 'project', environments: [environment({})] });

    await expect(runSet(undefined, ['A=1'])).rejects.toThrow('legacy project settings');
    expect(mockUpdateEnvironmentVars).not.toHaveBeenCalled();
  });

  it('parses boolean kind flags placed after the variables', async () => {
    const { Command } = await import('commander');
    const { registerEnvVarsCommands } = await import('./vars.js');
    const program = new Command('env');
    registerEnvVarsCommands(program);
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await program.parseAsync(['vars', 'set', 'my-app', 'A=1', 'B=2', '--secret'], { from: 'user' });
      await vi.waitFor(() => expect(mockUpdateEnvironmentVars).toHaveBeenCalled());
    } finally {
      spy.mockRestore();
    }

    expect(mockUpdateEnvironmentVars).toHaveBeenCalledWith('tok', 'org-1', 'proj-1', 'env-1', {
      envVars: { A: '1', B: '2' },
      envVarMeta: { A: { secret: true }, B: { secret: true } },
    });
  });
});
