import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWebGitCloneDirectoryName } from '../../web/git-clone-context.js';

const railwaySandboxOptions: any[] = [];
const railwaySandboxStartMock = vi.fn(async () => {});
const mockFiles = {
  mkdir: vi.fn(async () => {}),
  read: vi.fn(async () => new Uint8Array()),
  write: vi.fn(async () => {}),
  stat: vi.fn(async () => ({ name: 'dir', size: 0, mode: 0o755, isDir: true, modTime: '2026-06-29T12:00:00Z' })),
  list: vi.fn(async () => []),
  exists: vi.fn(async () => true),
  remove: vi.fn(async () => {}),
  rename: vi.fn(async () => {}),
};
const railwaySandboxExecuteCommandMock = vi.fn(async () => ({
  success: true,
  exitCode: 0,
  stdout: '',
  stderr: '',
  executionTimeMs: 1,
}));
const railwaySandboxWithRestartRetryMock = vi.fn(async (operation: () => Promise<unknown>) => operation());
const ensureWebGitCloneMock = vi.fn(async () => '/tmp/mastracode-web-clones/test-checkout');
const detectProjectMock = vi.fn(() => ({
  resourceId: 'mastra-123',
  name: 'mastra',
  rootPath: '/tmp/mastracode-web-clones/test-checkout',
  gitUrl: 'https://github.com/mastra-ai/mastra.git',
  gitBranch: 'main',
  isWorktree: false,
}));

vi.mock('@mastra/railway', () => ({
  RailwaySandbox: class RailwaySandbox {
    readonly id = 'railway-sandbox-test';
    readonly name = 'RailwaySandbox';
    readonly provider = 'railway';
    readonly start = railwaySandboxStartMock;
    readonly executeCommand = railwaySandboxExecuteCommandMock;
    readonly withRestartRetry = railwaySandboxWithRestartRetryMock;
    readonly railway = { files: mockFiles };

    constructor(options: any) {
      railwaySandboxOptions.push(options);
    }
  },
}));

vi.mock('../../onboarding/settings.js', () => ({
  loadSettings: () => ({}),
}));

vi.mock('../../web/git-clone.js', () => ({
  ensureWebGitClone: ensureWebGitCloneMock,
}));

vi.mock('../../utils/project.js', () => ({
  detectProject: detectProjectMock,
  getAppDataDir: () => '/tmp/mastracode-test-app-data',
}));

const originalEnv = { ...process.env };

function createRequestContext(projectPath: string) {
  const requestContext = new RequestContext();
  const state: Record<string, unknown> = { projectPath, sandboxAllowedPaths: [] };
  requestContext.set('controller', {
    modeId: 'build',
    getState: () => state,
    setState: vi.fn(async (updates: Record<string, unknown>) => Object.assign(state, updates)),
  });
  return requestContext;
}

function createGitRequestContext() {
  const requestContext = createRequestContext('/tmp/unused');
  requestContext.set('mastracode.web.gitClone', {
    gitUrl: 'https://github.com/mastra-ai/mastra.git',
    cloneParentPath: '/Users/ward/projects',
  });
  return requestContext;
}

afterEach(() => {
  process.env = { ...originalEnv };
  railwaySandboxOptions.length = 0;
  vi.clearAllMocks();
  vi.resetModules();
});

describe('getWebWorkspace Railway sandbox selection', () => {
  it('uses a Railway sandbox when railway config provides an environmentId', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-railway-workspace-'));

    try {
      const { getWebWorkspace } = await import('../../web/workspace.js');

      const workspace = await getWebWorkspace(
        { requestContext: createRequestContext(tempDir) },
        { token: 'test-token', environmentId: 'env_test' },
      );

      expect(workspace.filesystem!.provider).toBe('railway');
      expect(workspace.filesystem!.basePath).toBe('/workspace');
      expect((workspace.filesystem as any).sandbox).toBe(workspace.sandbox);
      expect(workspace.sandbox!.provider).toBe('railway');
      expect(railwaySandboxOptions).toHaveLength(1);
      expect(railwaySandboxOptions[0]).toMatchObject({
        idleTimeoutMinutes: 3,
        token: 'test-token',
        environmentId: 'env_test',
      });
      expect(railwaySandboxStartMock).toHaveBeenCalled();
      expect(mockFiles.mkdir).toHaveBeenCalledOnce();
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('builds the Railway sandbox template with git checkout setup', async () => {
    const { getWebWorkspace } = await import('../../web/workspace.js');

    const workspace = await getWebWorkspace(
      { requestContext: createGitRequestContext() },
      { token: 'test-token', environmentId: 'env_test' },
    );

    expect(workspace.filesystem!.provider).toBe('railway');
    expect(workspace.filesystem!.basePath).toBe(
      `/workspace/${getWebGitCloneDirectoryName('https://github.com/mastra-ai/mastra.git')}`,
    );
    expect((workspace.filesystem as any).sandbox).toBe(workspace.sandbox);
    expect(railwaySandboxOptions[0]).toMatchObject({
      token: 'test-token',
      environmentId: 'env_test',
      checkpointName: expect.stringMatching(/^mastracode-mastra-[a-f0-9]{16}$/),
    });
    expect(railwaySandboxStartMock).toHaveBeenCalled();
    expect(mockFiles.mkdir).toHaveBeenCalledOnce();
    expect(ensureWebGitCloneMock).not.toHaveBeenCalled();
    expect(detectProjectMock).not.toHaveBeenCalled();

    const builder = {
      withPackages: vi.fn(function (this: any) {
        return this;
      }),
      run: vi.fn(function (this: any) {
        return this;
      }),
      workdir: vi.fn(function (this: any) {
        return this;
      }),
    };

    railwaySandboxOptions[0].template(builder);

    const remoteWorkdir = `/workspace/${getWebGitCloneDirectoryName('https://github.com/mastra-ai/mastra.git')}`;
    expect(builder.workdir).toHaveBeenCalledWith(remoteWorkdir);
    expect(builder.withPackages).toHaveBeenCalledWith('git', 'curl');
    expect(builder.run).toHaveBeenCalledWith('npm i -g pnpm');
    expect(builder.run).toHaveBeenCalledWith(
      `git clone --depth 1 'https://github.com/mastra-ai/mastra.git' '${remoteWorkdir}'`,
    );
  });

  it('keeps subsequent Railway resolutions on the stored remote project path', async () => {
    const { getWebWorkspace } = await import('../../web/workspace.js');
    const remoteWorkdir = `/workspace/${getWebGitCloneDirectoryName('https://github.com/mastra-ai/mastra.git')}`;

    const workspace = await getWebWorkspace(
      { requestContext: createRequestContext(remoteWorkdir) },
      { environmentId: 'env_test' },
    );

    expect(workspace.filesystem!.provider).toBe('railway');
    expect(workspace.filesystem!.basePath).toBe(remoteWorkdir);
    expect(railwaySandboxOptions).toHaveLength(1);

    const builder = {
      withPackages: vi.fn(function (this: any) {
        return this;
      }),
      run: vi.fn(function (this: any) {
        return this;
      }),
      workdir: vi.fn(function (this: any) {
        return this;
      }),
    };

    railwaySandboxOptions[0].template(builder);

    expect(builder.workdir).toHaveBeenCalledWith(remoteWorkdir);
    expect(builder.run).toHaveBeenCalledWith('npm i -g pnpm');
    expect(builder.run).not.toHaveBeenCalledWith(expect.stringContaining('git clone'));
  });

  it('falls back to RAILWAY_ENVIRONMENT_ID env var when no config is provided', async () => {
    process.env.RAILWAY_ENVIRONMENT_ID = 'env_from_env';
    const { getWebWorkspace } = await import('../../web/workspace.js');

    const workspace = await getWebWorkspace({ requestContext: createRequestContext('/tmp/unused') });

    expect(workspace.filesystem!.provider).toBe('railway');
    expect(railwaySandboxOptions).toHaveLength(1);
    // env var fallback: token/environmentId not in config, RailwaySandbox reads env vars itself
    expect(railwaySandboxOptions[0]).toMatchObject({ idleTimeoutMinutes: 3 });
    expect(railwaySandboxOptions[0].token).toBeUndefined();
    expect(railwaySandboxOptions[0].environmentId).toBeUndefined();
  });
});
