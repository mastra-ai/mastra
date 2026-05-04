import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

let closeHandler: (() => void) | undefined;

vi.mock('node:fs', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createWriteStream: vi.fn(() => ({
      on: vi.fn((event: string, callback: () => void) => {
        if (event === 'close') {
          closeHandler = callback;
        }
      }),
    })),
  };
});

describe('getMastraVersion', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mastra-version-test-'));
    // Write a package.json so createRequire has a valid base
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  async function loadGetMastraVersion() {
    // Dynamic import to get the real (unmocked) function
    const mod = await import('./deploy.js');
    return mod.getMastraVersion;
  }

  it('resolves the installed version of mastra from node_modules', async () => {
    const getMastraVersion = await loadGetMastraVersion();

    // Create a fake node_modules/mastra/package.json
    const mastraDir = join(tmpDir, 'node_modules', 'mastra');
    mkdirSync(mastraDir, { recursive: true });
    writeFileSync(join(mastraDir, 'package.json'), JSON.stringify({ name: 'mastra', version: '1.2.3' }));

    const result = getMastraVersion(tmpDir);
    expect(result).toBe('1.2.3');
  });

  it('returns null when mastra package.json has no version field', async () => {
    const getMastraVersion = await loadGetMastraVersion();

    // Create a mastra package without a version field
    const mastraDir = join(tmpDir, 'node_modules', 'mastra');
    mkdirSync(mastraDir, { recursive: true });
    writeFileSync(join(mastraDir, 'package.json'), JSON.stringify({ name: 'mastra' }));

    const result = getMastraVersion(tmpDir);
    expect(result).toBeNull();
  });

  it('returns the version even when package.json has a catalog: specifier', async () => {
    const getMastraVersion = await loadGetMastraVersion();

    // Simulate a project that has catalog: in package.json but real version in node_modules
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'my-app', dependencies: { mastra: 'catalog:' } }),
    );
    const mastraDir = join(tmpDir, 'node_modules', 'mastra');
    mkdirSync(mastraDir, { recursive: true });
    writeFileSync(join(mastraDir, 'package.json'), JSON.stringify({ name: 'mastra', version: '0.9.0' }));

    const result = getMastraVersion(tmpDir);
    expect(result).toBe('0.9.0');
  });
});

// Mock all external dependencies
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  log: { step: vi.fn(), info: vi.fn(), success: vi.fn(), warn: vi.fn() },
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
    finalize: vi.fn(async () => {
      closeHandler?.();
    }),
  })),
}));

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    mkdir: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ size: 1024 }),
    access: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    readFile: vi.fn(async (path: string) => {
      const filePath = String(path);
      if (filePath.includes('/.env')) {
        const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        throw err;
      }
      return Buffer.from('zip-data');
    }),
  };
});

vi.mock('../auth/credentials.js', () => ({
  getToken: vi.fn().mockResolvedValue('test-token'),
  getCurrentOrgId: vi.fn().mockResolvedValue('org-1'),
}));

vi.mock('../auth/api.js', () => ({
  fetchOrgs: vi.fn().mockResolvedValue([{ id: 'org-1', name: 'Test Org', role: 'admin', isCurrent: true }]),
}));

vi.mock('./platform-api.js', () => ({
  fetchProjects: vi.fn().mockResolvedValue([]),
  createProject: vi.fn().mockResolvedValue({ id: 'proj-1', name: 'my-app' }),
  uploadDeploy: vi.fn().mockResolvedValue({ id: 'deploy-1', status: 'starting' }),
  pollDeploy: vi.fn().mockResolvedValue({ id: 'deploy-1', status: 'running', instanceUrl: 'https://example.com' }),
}));

vi.mock('./project-config.js', () => ({
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
  vi.resetAllMocks();
  closeHandler = undefined;
});

afterEach(() => {
  delete process.env.MASTRA_API_TOKEN;
  delete process.env.MASTRA_ORG_ID;
  delete process.env.MASTRA_PROJECT_ID;
});

describe('parseEnvFile', () => {
  it('parses simple key=value pairs', async () => {
    const { parseEnvFile } = await import('./deploy.js');

    const result = parseEnvFile('FOO=bar\nBAZ=qux');
    expect(result).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('ignores comments and empty lines', async () => {
    const { parseEnvFile } = await import('./deploy.js');

    const result = parseEnvFile('# comment\n\nFOO=bar\n  # another comment\n');
    expect(result).toEqual({ FOO: 'bar' });
  });

  it('handles double-quoted values', async () => {
    const { parseEnvFile } = await import('./deploy.js');

    const result = parseEnvFile('FOO="hello world"\nBAR="with spaces"');
    expect(result).toEqual({ FOO: 'hello world', BAR: 'with spaces' });
  });

  it('handles single-quoted values', async () => {
    const { parseEnvFile } = await import('./deploy.js');

    const result = parseEnvFile("FOO='hello world'");
    expect(result).toEqual({ FOO: 'hello world' });
  });

  it('handles values with equals signs', async () => {
    const { parseEnvFile } = await import('./deploy.js');

    const result = parseEnvFile('DB_URL=postgres://host:5432/db?sslmode=require');
    expect(result).toEqual({ DB_URL: 'postgres://host:5432/db?sslmode=require' });
  });

  it('ignores lines without equals sign', async () => {
    const { parseEnvFile } = await import('./deploy.js');

    const result = parseEnvFile('FOO=bar\nINVALID_LINE\nBAZ=qux');
    expect(result).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('returns empty object for empty content', async () => {
    const { parseEnvFile } = await import('./deploy.js');

    const result = parseEnvFile('');
    expect(result).toEqual({});
  });

  it('trims whitespace from keys and values', async () => {
    const { parseEnvFile } = await import('./deploy.js');

    const result = parseEnvFile('  FOO  =  bar  ');
    expect(result).toEqual({ FOO: 'bar' });
  });

  it('strips export prefix from keys', async () => {
    const { parseEnvFile } = await import('./deploy.js');

    const result = parseEnvFile('export FOO=bar\nexport BAZ="qux"');
    expect(result).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });
});

describe('readEnvVars', () => {
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

describe('deployAction', () => {
  it('passes disablePlatformObservability to uploadDeploy and preserves it when saving config', async () => {
    const { access, readdir, readFile, stat } = await import('node:fs/promises');
    const { fetchOrgs } = await import('../auth/api.js');
    const { getCurrentOrgId, getToken } = await import('../auth/credentials.js');
    const { fetchProjects, createProject, uploadDeploy, pollDeploy } = await import('./platform-api.js');
    const { loadProjectConfig, saveProjectConfig } = await import('./project-config.js');

    vi.mocked(getToken).mockResolvedValue('test-token');
    vi.mocked(getCurrentOrgId).mockResolvedValue('org-1');
    vi.mocked(access).mockResolvedValue(undefined);
    vi.mocked(stat).mockResolvedValue({ size: 1024 } as Awaited<ReturnType<typeof stat>>);
    vi.mocked(fetchOrgs).mockResolvedValue([{ id: 'org-1', name: 'Test Org', role: 'admin', isCurrent: true }]);
    vi.mocked(fetchProjects).mockResolvedValue([]);
    vi.mocked(createProject).mockResolvedValue({
      id: 'proj-1',
      name: 'my-app',
      slug: 'my-app',
      organizationId: 'org-1',
      latestDeployId: null,
      latestDeployStatus: null,
      instanceUrl: null,
      createdAt: null,
      updatedAt: null,
    });
    vi.mocked(uploadDeploy).mockResolvedValue({ id: 'deploy-1', status: 'starting' });
    vi.mocked(pollDeploy).mockResolvedValue({
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

    const { deployAction } = await import('./deploy.js');

    await expect(
      deployAction(undefined, { yes: true, skipBuild: true, org: 'org-1', project: 'my-app' }),
    ).resolves.toBeUndefined();

    expect(saveProjectConfig).toHaveBeenCalledWith(
      expect.any(String),
      {
        projectId: 'proj-1',
        projectName: 'my-app',
        projectSlug: 'my-app',
        organizationId: 'org-1',
        disablePlatformObservability: true,
      },
      undefined,
    );
    expect(uploadDeploy).toHaveBeenCalledWith(
      'test-token',
      'org-1',
      'proj-1',
      expect.any(Buffer),
      expect.objectContaining({
        projectName: 'my-app',
        envVars: { API_KEY: 'test' },
        disablePlatformObservability: true,
      }),
    );
  });

  it('sends disablePlatformObservability false when config omits it', async () => {
    const { access, readdir, readFile, stat } = await import('node:fs/promises');
    const { fetchOrgs } = await import('../auth/api.js');
    const { getCurrentOrgId, getToken } = await import('../auth/credentials.js');
    const { fetchProjects, uploadDeploy, pollDeploy } = await import('./platform-api.js');
    const { loadProjectConfig } = await import('./project-config.js');

    vi.mocked(getToken).mockResolvedValue('test-token');
    vi.mocked(getCurrentOrgId).mockResolvedValue('org-1');
    vi.mocked(access).mockResolvedValue(undefined);
    vi.mocked(stat).mockResolvedValue({ size: 1024 } as Awaited<ReturnType<typeof stat>>);
    vi.mocked(fetchOrgs).mockResolvedValue([{ id: 'org-1', name: 'Test Org', role: 'admin', isCurrent: true }]);
    vi.mocked(fetchProjects).mockResolvedValue([
      {
        id: 'proj-1',
        name: 'my-app',
        slug: 'my-app',
        organizationId: 'org-1',
        latestDeployId: null,
        latestDeployStatus: null,
        instanceUrl: null,
        createdAt: null,
        updatedAt: null,
      },
    ]);
    vi.mocked(uploadDeploy).mockResolvedValue({ id: 'deploy-1', status: 'starting' });
    vi.mocked(pollDeploy).mockResolvedValue({
      id: 'deploy-1',
      status: 'running',
      instanceUrl: 'https://example.com',
      error: null,
    });
    vi.mocked(loadProjectConfig).mockResolvedValue({
      organizationId: 'org-1',
      projectId: 'proj-1',
      projectName: 'my-app',
      projectSlug: 'my-app',
    });
    vi.mocked(readdir).mockResolvedValue([{ name: '.env', isFile: () => true }] as unknown as Awaited<
      ReturnType<typeof readdir>
    >);
    vi.mocked(readFile).mockImplementation(async path => {
      if (String(path).endsWith('.env')) return 'API_KEY=test';
      return Buffer.from('zip-data');
    });

    const { deployAction } = await import('./deploy.js');

    await expect(deployAction(undefined, { yes: true, skipBuild: true })).resolves.toBeUndefined();

    expect(uploadDeploy).toHaveBeenCalledWith(
      'test-token',
      'org-1',
      'proj-1',
      expect.any(Buffer),
      expect.objectContaining({
        projectName: 'my-app',
        envVars: { API_KEY: 'test' },
        disablePlatformObservability: false,
      }),
    );
  });

  it('throws when headless mode missing required env vars', async () => {
    process.env.MASTRA_API_TOKEN = 'headless-token';
    // Missing MASTRA_ORG_ID and MASTRA_PROJECT_ID
    vi.resetModules();

    const { deployAction } = await import('./deploy.js');

    await expect(deployAction(undefined, {})).rejects.toThrow(
      'MASTRA_ORG_ID and MASTRA_PROJECT_ID are required when MASTRA_API_TOKEN is set',
    );
  });

  it('throws when headless mode missing MASTRA_PROJECT_ID', async () => {
    process.env.MASTRA_API_TOKEN = 'headless-token';
    process.env.MASTRA_ORG_ID = 'org-1';
    // Missing MASTRA_PROJECT_ID
    vi.resetModules();

    const { deployAction } = await import('./deploy.js');

    await expect(deployAction(undefined, {})).rejects.toThrow(
      'MASTRA_ORG_ID and MASTRA_PROJECT_ID are required when MASTRA_API_TOKEN is set',
    );
  });
});
