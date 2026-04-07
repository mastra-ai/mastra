import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

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
