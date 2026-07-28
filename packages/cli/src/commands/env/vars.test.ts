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

const mockFetchEnvironments = vi.fn();

vi.mock('./platform-api.js', () => ({
  fetchEnvironments: mockFetchEnvironments,
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
  it('writes both environment-scoped and project-scoped vars (regression: pull read project scope only)', async () => {
    // Joel's repro: vars added through the UI land on the environment row;
    // the initial-deploy vars live on the project row. Pull must merge both.
    mockGetServerProjectEnv.mockResolvedValue({ A: '1' });
    mockFetchEnvironments.mockResolvedValue([environment({ envVars: { B: '2' } })]);
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { envVarsPullAction } = await import('./vars.js');
    await envVarsPullAction(undefined, {});

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [filePath, content, options] = mockWriteFile.mock.calls[0]!;
    expect(filePath).toContain('.env');
    expect(content).toContain('A="1"');
    expect(content).toContain('B="2"');
    expect(options).toEqual({ encoding: 'utf-8', mode: 0o600 });
    expect(mockChmod).toHaveBeenCalledWith(filePath, 0o600);
    expect(spy.mock.calls.some(c => String(c[0]).includes('Pulled 2 variable(s)'))).toBe(true);
    spy.mockRestore();
  });

  it('project-scoped values win over environment-scoped values (matches deploy-time merge)', async () => {
    mockGetServerProjectEnv.mockResolvedValue({ SHARED: 'project' });
    mockFetchEnvironments.mockResolvedValue([environment({ envVars: { SHARED: 'environment' } })]);
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { envVarsPullAction } = await import('./vars.js');
    await envVarsPullAction(undefined, {});

    const [, content] = mockWriteFile.mock.calls[0]!;
    expect(content).toContain('SHARED="project"');
    expect(content).not.toContain('SHARED="environment"');
    spy.mockRestore();
  });

  it('lists managed var names as comments without values', async () => {
    mockFetchEnvironments.mockResolvedValue([
      environment({ envVars: { B: '2' }, managedEnvVarNames: ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'] }),
    ]);
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
    mockFetchEnvironments.mockResolvedValue([
      environment({ id: 'env-1', slug: 'my-app', envVars: { PROD: '1' } }),
      environment({ id: 'env-2', name: 'Staging', slug: 'my-app-staging', type: 'staging', envVars: { STAGE: '1' } }),
    ]);
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { envVarsPullAction } = await import('./vars.js');
    await envVarsPullAction('my-app-staging', {});

    const [, content] = mockWriteFile.mock.calls[0]!;
    expect(content).toContain('STAGE="1"');
    expect(content).not.toContain('PROD=');
    spy.mockRestore();
  });

  it('requires an environment argument when the project has more than one', async () => {
    mockFetchEnvironments.mockResolvedValue([
      environment({ id: 'env-1', slug: 'my-app' }),
      environment({ id: 'env-2', slug: 'my-app-staging' }),
    ]);

    const { envVarsPullAction } = await import('./vars.js');
    await expect(envVarsPullAction(undefined, {})).rejects.toThrow(/my-app-staging/);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('throws when the named environment does not exist', async () => {
    mockFetchEnvironments.mockResolvedValue([environment({})]);

    const { envVarsPullAction } = await import('./vars.js');
    await expect(envVarsPullAction('nope', {})).rejects.toThrow('Environment not found: nope');
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('throws when the project has no environments', async () => {
    mockFetchEnvironments.mockResolvedValue([]);

    const { envVarsPullAction } = await import('./vars.js');
    await expect(envVarsPullAction(undefined, {})).rejects.toThrow('No environments found');
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('writes to a custom output file', async () => {
    mockFetchEnvironments.mockResolvedValue([environment({ envVars: { FOO: 'bar' } })]);
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { envVarsPullAction } = await import('./vars.js');
    await envVarsPullAction(undefined, { output: '.env.production' });

    const [filePath] = mockWriteFile.mock.calls[0]!;
    expect(filePath).toContain('.env.production');
    expect(spy.mock.calls.some(c => String(c[0]).includes('.env.production'))).toBe(true);
    spy.mockRestore();
  });

  it('escapes special characters and skips unsafe keys like the legacy pull', async () => {
    mockFetchEnvironments.mockResolvedValue([
      environment({ envVars: { TOKEN: 'price=$100`cmd`\nline2', 'bad-key': 'nope' } }),
    ]);
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
