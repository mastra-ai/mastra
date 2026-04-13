import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  log: { step: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(), warn: vi.fn() },
  note: vi.fn(),
  confirm: vi.fn(),
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

vi.mock('../studio/project-config.js', () => ({
  loadProjectConfig: vi.fn().mockResolvedValue(null),
  saveProjectConfig: vi.fn().mockResolvedValue(undefined),
}));

describe('parseEnvFile (server deploy)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

describe('serverDeployAction', () => {
  afterEach(() => {
    delete process.env.MASTRA_API_TOKEN;
    delete process.env.MASTRA_ORG_ID;
    delete process.env.MASTRA_PROJECT_ID;
    vi.resetModules();
  });

  it('throws when headless mode missing org and project', async () => {
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
});
