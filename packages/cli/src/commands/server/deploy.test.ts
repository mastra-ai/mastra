import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    execSync: vi.fn().mockReturnValue('my-app'),
  };
});

let closeHandler: (() => void) | undefined;

vi.mock('node:fs', () => ({
  createWriteStream: vi.fn(() => ({
    on: vi.fn((event: string, callback: () => void) => {
      if (event === 'close') {
        closeHandler = callback;
      }
    }),
  })),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 1024 }),
  access: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  readFile: vi.fn(async (path: string) => {
    if (String(path).includes('/.env')) {
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      throw err;
    }
    return Buffer.from('zip-data');
  }),
}));

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  log: { step: vi.fn(), info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn() },
  note: vi.fn(),
  confirm: vi.fn(),
  select: vi.fn(),
  isCancel: vi.fn(() => false),
  cancel: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  outro: vi.fn(),
}));

vi.mock('archiver', () => ({
  default: vi.fn(() => ({
    on: vi.fn(),
    pipe: vi.fn(),
    glob: vi.fn(),
    file: vi.fn(),
    finalize: vi.fn(async () => {
      closeHandler?.();
    }),
  })),
}));

vi.mock('../auth/credentials.js', () => ({
  getToken: vi.fn().mockResolvedValue('test-token'),
  getCurrentOrgId: vi.fn().mockResolvedValue('org-1'),
}));

vi.mock('../auth/api.js', () => ({
  fetchOrgs: vi.fn().mockResolvedValue([{ id: 'org-1', name: 'Test Org', role: 'admin', isCurrent: true }]),
}));

vi.mock('./platform-api.js', () => ({
  fetchServerProjects: vi.fn().mockResolvedValue([]),
  createServerProject: vi
    .fn()
    .mockResolvedValue({ id: 'proj-1', name: 'my-app', slug: 'my-app', organizationId: 'org-1' }),
  uploadServerDeploy: vi.fn().mockResolvedValue({ id: 'deploy-1', status: 'queued' }),
  pollServerDeploy: vi.fn().mockResolvedValue({
    id: 'deploy-1',
    status: 'running',
    instanceUrl: 'https://example.com',
    error: null,
  }),
}));

vi.mock('../../utils/run-build.js', () => ({
  runBuild: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../studio/project-config.js', () => ({
  getProjectConfigToSave: vi.fn((projectId, projectName, projectSlug, organizationId, projectConfig) => ({
    projectId,
    projectName,
    projectSlug,
    organizationId,
    ...(projectConfig?.disablePlatformObservability !== undefined
      ? { disablePlatformObservability: projectConfig.disablePlatformObservability }
      : {}),
  })),
  loadProjectConfig: vi.fn().mockResolvedValue(null),
  saveProjectConfig: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
  closeHandler = undefined;
});

afterEach(() => {
  delete process.env.MASTRA_API_TOKEN;
  delete process.env.MASTRA_ORG_ID;
  delete process.env.MASTRA_PROJECT_ID;
});

describe('parseEnvFile (server deploy)', () => {
  it('parses simple key=value pairs', async () => {
    const { parseEnvFile } = await import('./deploy.js');
    expect(parseEnvFile('FOO=bar\nBAZ=qux')).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('ignores comments, empty lines, and export prefix', async () => {
    const { parseEnvFile } = await import('./deploy.js');
    const result = parseEnvFile('# c\n\nexport FOO=bar');
    expect(result).toEqual({ FOO: 'bar' });
  });

  it('strips balanced quotes', async () => {
    const { parseEnvFile } = await import('./deploy.js');
    expect(parseEnvFile('A="x=y"\nB=\'z\'')).toEqual({ A: 'x=y', B: 'z' });
  });
});

describe('readEnvVars (server deploy)', () => {
  it('prompts for which env file to deploy when multiple files exist', async () => {
    const { readdir, readFile } = await import('node:fs/promises');
    const prompts = await import('@clack/prompts');
    vi.mocked(readdir).mockResolvedValue([
      { name: '.env.production', isFile: () => true },
      { name: '.env', isFile: () => true },
      { name: '.env.staging', isFile: () => true },
    ] as unknown as Awaited<ReturnType<typeof readdir>>);
    vi.mocked(readFile).mockImplementation(async path => {
      const filePath = String(path);
      if (filePath.endsWith('.env')) return 'SHARED=base\nBASE_ONLY=1';
      if (filePath.endsWith('.env.production')) return 'SHARED=prod\nPROD_ONLY=1';
      if (filePath.endsWith('.env.staging')) return 'SHARED=staging\nSTAGING_ONLY=1';
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      throw err;
    });
    vi.mocked(prompts.select).mockResolvedValue('.env.staging');

    const { readEnvVars } = await import('./deploy.js');

    await expect(readEnvVars('/project')).resolves.toEqual({
      SHARED: 'staging',
      STAGING_ONLY: '1',
    });
    expect(prompts.select).toHaveBeenCalledWith({
      message: 'Choose env file to deploy',
      options: [
        { value: '.env', label: '.env' },
        { value: '.env.production', label: '.env.production' },
        { value: '.env.staging', label: '.env.staging' },
      ],
      initialValue: '.env.production',
    });
    expect(prompts.log.step).toHaveBeenCalledWith('Using env file: .env.staging');
  });

  it('throws in auto-accept mode when multiple env files exist and no --env-file specified', async () => {
    const { readdir } = await import('node:fs/promises');
    vi.mocked(readdir).mockResolvedValue([
      { name: '.env.staging', isFile: () => true, isSymbolicLink: () => false },
      { name: '.env', isFile: () => true, isSymbolicLink: () => false },
      { name: '.env.production', isFile: () => true, isSymbolicLink: () => false },
    ] as unknown as Awaited<ReturnType<typeof readdir>>);

    const { readEnvVars } = await import('./deploy.js');

    await expect(readEnvVars('/project', { autoAccept: true })).rejects.toThrow(
      'Multiple env files found: .env, .env.production, .env.staging. Use --env-file to specify which one to deploy.',
    );
  });

  it('auto-selects the only env file in auto-accept mode without prompting', async () => {
    const { readdir, readFile } = await import('node:fs/promises');
    const prompts = await import('@clack/prompts');
    vi.mocked(readdir).mockResolvedValue([
      { name: '.env.production', isFile: () => true, isSymbolicLink: () => false },
    ] as unknown as Awaited<ReturnType<typeof readdir>>);
    vi.mocked(readFile).mockImplementation(async path => {
      const filePath = String(path);
      if (filePath.endsWith('.env.production')) return 'SHARED=prod\nPROD_ONLY=1';
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      throw err;
    });

    const { readEnvVars } = await import('./deploy.js');

    await expect(readEnvVars('/project', { autoAccept: true })).resolves.toEqual({
      SHARED: 'prod',
      PROD_ONLY: '1',
    });
    expect(prompts.select).not.toHaveBeenCalled();
    expect(prompts.log.step).toHaveBeenCalledWith('Using env file: .env.production');
  });

  it('includes symlinked env files when discovering deploy env files', async () => {
    const { readdir, readFile } = await import('node:fs/promises');
    const prompts = await import('@clack/prompts');
    vi.mocked(readdir).mockResolvedValue([
      { name: '.env', isFile: () => false, isSymbolicLink: () => true },
      { name: '.env.production', isFile: () => true, isSymbolicLink: () => false },
    ] as unknown as Awaited<ReturnType<typeof readdir>>);
    vi.mocked(readFile).mockImplementation(async path => {
      const filePath = String(path);
      if (filePath.endsWith('.env')) return 'SHARED=base\nBASE_ONLY=1';
      if (filePath.endsWith('.env.production')) return 'SHARED=prod\nPROD_ONLY=1';
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      throw err;
    });
    vi.mocked(prompts.select).mockResolvedValue('.env');

    const { readEnvVars } = await import('./deploy.js');

    await expect(readEnvVars('/project')).resolves.toEqual({
      SHARED: 'base',
      BASE_ONLY: '1',
    });
    expect(prompts.select).toHaveBeenCalledWith({
      message: 'Choose env file to deploy',
      options: [
        { value: '.env', label: '.env' },
        { value: '.env.production', label: '.env.production' },
      ],
      initialValue: '.env.production',
    });
    expect(prompts.log.step).toHaveBeenCalledWith('Using env file: .env');
  });

  it('uses the requested env file without prompting', async () => {
    const { access, readFile } = await import('node:fs/promises');
    const prompts = await import('@clack/prompts');
    vi.mocked(access).mockResolvedValue(undefined);
    vi.mocked(readFile).mockImplementation(async path => {
      const filePath = String(path);
      if (filePath.endsWith('.env.staging')) return 'SHARED=staging\nSTAGING_ONLY=1';
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      throw err;
    });

    const { readEnvVars } = await import('./deploy.js');

    await expect(readEnvVars('/project', { envFile: '.env.staging' })).resolves.toEqual({
      SHARED: 'staging',
      STAGING_ONLY: '1',
    });
    expect(prompts.select).not.toHaveBeenCalled();
    expect(prompts.log.step).toHaveBeenCalledWith('Using env file: .env.staging');
  });

  it('accepts a non-.env-prefixed file when explicitly requested', async () => {
    const { access, readFile } = await import('node:fs/promises');
    const prompts = await import('@clack/prompts');
    vi.mocked(access).mockResolvedValue(undefined);
    vi.mocked(readFile).mockImplementation(async path => {
      const filePath = String(path);
      if (filePath.endsWith('config/prod.env')) return 'SECRET=abc';
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      throw err;
    });

    const { readEnvVars } = await import('./deploy.js');

    await expect(readEnvVars('/project', { envFile: 'config/prod.env' })).resolves.toEqual({
      SECRET: 'abc',
    });
    expect(prompts.select).not.toHaveBeenCalled();
    expect(prompts.log.step).toHaveBeenCalledWith('Using env file: config/prod.env');
  });

  it('fails when the requested env file does not exist on disk', async () => {
    const { access } = await import('node:fs/promises');
    vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

    const { readEnvVars } = await import('./deploy.js');

    await expect(readEnvVars('/project', { envFile: '.env.staging' })).rejects.toThrow(
      'Env file not found: .env.staging',
    );
  });

  it('fails when the selected env file disappears before it can be read', async () => {
    const { readdir, readFile } = await import('node:fs/promises');
    const prompts = await import('@clack/prompts');
    vi.mocked(readdir).mockResolvedValue([
      { name: '.env', isFile: () => true },
      { name: '.env.staging', isFile: () => true },
    ] as unknown as Awaited<ReturnType<typeof readdir>>);
    vi.mocked(prompts.select).mockResolvedValue('.env.staging');
    vi.mocked(readFile).mockImplementation(async path => {
      if (String(path).endsWith('.env.staging')) {
        const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        throw err;
      }

      return 'BASE_ONLY=1';
    });

    const { readEnvVars } = await import('./deploy.js');

    await expect(readEnvVars('/project')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('fails when no deploy env file exists', async () => {
    const { readdir } = await import('node:fs/promises');
    vi.mocked(readdir).mockResolvedValue([] as Awaited<ReturnType<typeof readdir>>);

    const { readEnvVars } = await import('./deploy.js');

    await expect(readEnvVars('/project')).rejects.toThrow(
      'No env file found for deploy. Add a .env or .env.* file before deploying.',
    );
  });
});

describe('serverDeployAction', () => {
  beforeEach(async () => {
    const { access } = await import('node:fs/promises');
    const { loadProjectConfig } = await import('../studio/project-config.js');

    vi.mocked(access).mockResolvedValue(undefined);
    vi.mocked(loadProjectConfig).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('passes disablePlatformObservability to uploadServerDeploy and preserves it when saving config', async () => {
    const { readdir, readFile } = await import('node:fs/promises');
    const { fetchOrgs } = await import('../auth/api.js');
    const { getCurrentOrgId, getToken } = await import('../auth/credentials.js');
    const { fetchServerProjects, uploadServerDeploy, pollServerDeploy } = await import('./platform-api.js');
    const { loadProjectConfig, saveProjectConfig } = await import('../studio/project-config.js');

    vi.mocked(getToken).mockResolvedValue('test-token');
    vi.mocked(getCurrentOrgId).mockResolvedValue('org-1');
    vi.mocked(fetchOrgs).mockResolvedValue([{ id: 'org-1', name: 'Test Org', role: 'admin', isCurrent: true }]);
    vi.mocked(fetchServerProjects).mockResolvedValue([]);
    vi.mocked(pollServerDeploy).mockResolvedValue({
      id: 'deploy-1',
      status: 'running',
      instanceUrl: 'https://example.com',
      error: null,
    });
    vi.mocked(loadProjectConfig).mockResolvedValue({
      organizationId: 'org-2',
      projectId: 'old-proj',
      projectName: 'old-app',
      projectSlug: 'old-app',
      disablePlatformObservability: true,
    });
    vi.mocked(readdir).mockResolvedValue([{ name: '.env', isFile: () => true }] as unknown as Awaited<
      ReturnType<typeof readdir>
    >);
    vi.mocked(readFile).mockImplementation(async path => {
      if (String(path).endsWith('.env')) return 'API_KEY=test';
      return Buffer.from('zip-data');
    });

    const { serverDeployAction } = await import('./deploy.js');

    await expect(
      serverDeployAction(undefined, { yes: true, skipBuild: true, org: 'org-1', project: 'my-app' }),
    ).resolves.toBeUndefined();

    expect(saveProjectConfig).toHaveBeenCalledWith(
      expect.any(String),
      {
        projectId: 'my-app',
        projectName: 'my-app',
        projectSlug: 'my-app',
        organizationId: 'org-1',
        disablePlatformObservability: true,
      },
      undefined,
    );
    expect(uploadServerDeploy).toHaveBeenCalledWith('test-token', 'org-1', 'my-app', expect.any(Buffer), {
      projectName: 'my-app',
      envVars: { API_KEY: 'test' },
      disablePlatformObservability: true,
    });
  });

  it('throws when headless mode is missing required env vars and flags', async () => {
    process.env.MASTRA_API_TOKEN = 'headless-token';
    vi.resetModules();

    const { serverDeployAction } = await import('./deploy.js');

    await expect(serverDeployAction(undefined, {})).rejects.toThrow(
      'MASTRA_ORG_ID and MASTRA_PROJECT_ID (or --org/--project flags, or .mastra-project.json) are required when MASTRA_API_TOKEN is set',
    );
  });

  it('throws when headless mode missing project', async () => {
    process.env.MASTRA_API_TOKEN = 'headless-token';
    process.env.MASTRA_ORG_ID = 'org-1';
    vi.resetModules();

    const { serverDeployAction } = await import('./deploy.js');

    await expect(serverDeployAction(undefined, {})).rejects.toThrow(
      'MASTRA_ORG_ID and MASTRA_PROJECT_ID (or --org/--project flags, or .mastra-project.json) are required when MASTRA_API_TOKEN is set',
    );
  });

  it('allows headless mode to rely on .mastra-project.json without env vars or flags', async () => {
    process.env.MASTRA_API_TOKEN = 'headless-token';
    vi.resetModules();

    const { readdir, readFile } = await import('node:fs/promises');
    const { loadProjectConfig } = await import('../studio/project-config.js');
    const { uploadServerDeploy } = await import('./platform-api.js');
    vi.mocked(readdir).mockResolvedValue([{ name: '.env', isFile: () => true }] as unknown as Awaited<
      ReturnType<typeof readdir>
    >);
    vi.mocked(readFile).mockImplementation(async path => {
      if (String(path).endsWith('.env')) return 'API_KEY=test';
      return Buffer.from('zip-data');
    });
    vi.mocked(loadProjectConfig).mockResolvedValue({
      organizationId: 'org-1',
      projectId: 'proj-1',
      projectName: 'my-app',
      projectSlug: 'my-app',
    });

    const { serverDeployAction } = await import('./deploy.js');

    await expect(serverDeployAction(undefined, {})).resolves.toBeUndefined();
    expect(uploadServerDeploy).toHaveBeenCalledWith('test-token', 'org-1', 'proj-1', expect.any(Buffer), {
      projectName: 'my-app',
      envVars: { API_KEY: 'test' },
      disablePlatformObservability: false,
    });
  });

  it('uses project config in headless mode without fetching orgs', async () => {
    process.env.MASTRA_API_TOKEN = 'headless-token';
    vi.resetModules();

    const { readdir, readFile } = await import('node:fs/promises');
    const { loadProjectConfig } = await import('../studio/project-config.js');
    const { fetchOrgs } = await import('../auth/api.js');

    vi.mocked(readdir).mockResolvedValue([{ name: '.env', isFile: () => true }] as unknown as Awaited<
      ReturnType<typeof readdir>
    >);
    vi.mocked(readFile).mockImplementation(async path => {
      if (String(path).endsWith('.env')) return 'API_KEY=test';
      return Buffer.from('zip-data');
    });
    vi.mocked(loadProjectConfig).mockResolvedValue({
      organizationId: 'org-1',
      projectId: 'proj-1',
      projectName: 'my-app',
      projectSlug: 'my-app',
    });
    vi.mocked(fetchOrgs).mockResolvedValue([]);

    const { serverDeployAction } = await import('./deploy.js');

    await expect(serverDeployAction(undefined, {})).resolves.toBeUndefined();
    expect(fetchOrgs).not.toHaveBeenCalled();
  });
});
