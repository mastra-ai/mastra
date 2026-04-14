import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execSync: vi.fn().mockReturnValue('my-app'),
}));

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
  readFile: vi.fn(async (path: string) => {
    if (path.endsWith('.env') || path.endsWith('.env.local') || path.endsWith('.env.production')) {
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

vi.mock('../studio/project-config.js', () => ({
  loadProjectConfig: vi.fn().mockResolvedValue(null),
  saveProjectConfig: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./platform-api.js', () => ({
  fetchServerProjects: vi.fn().mockResolvedValue([]),
  createServerProject: vi.fn().mockResolvedValue({ id: 'proj-1', name: 'my-app', slug: 'my-app' }),
  uploadServerDeploy: vi.fn().mockResolvedValue({ id: 'deploy-1', status: 'queued' }),
  pollServerDeploy: vi
    .fn()
    .mockResolvedValue({ id: 'deploy-1', status: 'running', instanceUrl: 'https://example.com' }),
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

describe('serverDeployAction', () => {
  it('throws when headless mode is missing required env vars and flags', async () => {
    process.env.MASTRA_API_TOKEN = 'headless-token';
    vi.resetModules();

    const { serverDeployAction } = await import('./deploy.js');

    await expect(serverDeployAction(undefined, {})).rejects.toThrow(
      'MASTRA_ORG_ID and MASTRA_PROJECT_ID (or --org/--project flags, or .mastra-project.json) are required when MASTRA_API_TOKEN is set',
    );
  });

  it('allows headless mode to rely on .mastra-project.json without env vars or flags', async () => {
    process.env.MASTRA_API_TOKEN = 'headless-token';
    vi.resetModules();

    const { loadProjectConfig } = await import('../studio/project-config.js');
    vi.mocked(loadProjectConfig).mockResolvedValue({
      organizationId: 'org-1',
      projectId: 'proj-1',
      projectName: 'my-app',
      projectSlug: 'my-app',
    });

    const { serverDeployAction } = await import('./deploy.js');

    await expect(serverDeployAction(undefined, {})).resolves.toBeUndefined();
  });

  it('uses project config in headless mode without fetching orgs', async () => {
    process.env.MASTRA_API_TOKEN = 'headless-token';
    vi.resetModules();

    const { loadProjectConfig } = await import('../studio/project-config.js');
    const { fetchOrgs } = await import('../auth/api.js');

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
