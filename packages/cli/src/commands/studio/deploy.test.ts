import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

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
}));

vi.mock('archiver', () => ({
  default: vi.fn(),
}));

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
  loadProjectConfig: vi.fn().mockResolvedValue(null),
  saveProjectConfig: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.resetAllMocks();
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

describe('deployAction', () => {
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
