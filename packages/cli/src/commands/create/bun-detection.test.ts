import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPackageManager } from '../utils';

const mocks = vi.hoisted(() => {
  const mockExec = vi.fn();
  const mockChildProcess = {
    exec: (cmd: string, opts: any, cb: any) => {
      mockExec(cmd);
      if (cb) cb(null, { stdout: '' }, { stderr: '' });
      return {
        on: (event: string, callback: any) => {
          if (event === 'exit') callback(0);
        },
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
    },
  };
  const mockRm = vi.fn().mockResolvedValue(undefined);
  const mockExistsSync = vi.fn().mockReturnValue(false);

  return {
    mockExec,
    mockChildProcess,
    mockRm,
    mockExistsSync,
  };
});

vi.mock('node:child_process', () => ({
  default: mocks.mockChildProcess,
  ...mocks.mockChildProcess,
}));

vi.mock('node:util', () => ({
  default: {
    promisify: (_fn: any) => mocks.mockExec,
  },
  promisify: (_fn: any) => mocks.mockExec,
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(JSON.stringify({ scripts: {}, engines: {} })),
    writeFile: vi.fn().mockResolvedValue(undefined),
    rm: mocks.mockRm,
  },
}));

vi.mock('fs', () => ({
  default: {
    existsSync: mocks.mockExistsSync,
  },
}));

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  text: vi.fn().mockResolvedValue('test-project'),
  isCancel: vi.fn().mockReturnValue(false),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
  })),
  outro: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock('../../services/service.deps.js', () => ({
  DepsService: class {
    addScriptsToPackageJson = vi.fn().mockResolvedValue(undefined);
  },
}));

describe('Bun Runtime Detection', () => {
  const originalEnv = process.env;
  const originalChdir = process.chdir;
  const originalCwd = process.cwd;
  const originalExit = process.exit;
  const mockChdir = vi.fn();
  const mockCwd = vi.fn().mockReturnValue('/tmp');
  const mockExit = vi.fn() as unknown as typeof process.exit;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.chdir = mockChdir;
    process.cwd = mockCwd;
    process.exit = mockExit;
    mocks.mockExec.mockReset();
    mocks.mockExec.mockResolvedValue({ stdout: '' });
    mocks.mockRm.mockClear();
    mocks.mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    process.env = originalEnv;
    process.chdir = originalChdir;
    process.cwd = originalCwd;
    process.exit = originalExit;
  });

  it('should detect bun from npm_config_user_agent', () => {
    process.env.npm_config_user_agent = 'bun/1.0.0 npm/? node/v20.0.0 darwin x64';
    expect(getPackageManager()).toBe('bun');
  });

  it('should detect bun from npm_execpath', () => {
    process.env.npm_config_user_agent = '';
    process.env.npm_execpath = '/usr/local/bin/bun';
    expect(getPackageManager()).toBe('bun');
  });

  it('should fallback to npm if no bun detected', () => {
    process.env.npm_config_user_agent = '';
    process.env.npm_execpath = '';
    expect(getPackageManager()).toBe('npm');
  });

  it('should use bun init when bun is detected', async () => {
    process.env.npm_config_user_agent = 'bun/1.0.0';

    const { createMastraProject } = await import('./utils');

    await createMastraProject({
      projectName: 'test-bun-project',
      needsInteractive: false,
    });

    // Check if bun init was called
    expect(mocks.mockExec).toHaveBeenCalledWith('bun init -y');

    // Check if bun add was used for dependencies
    expect(mocks.mockExec).toHaveBeenCalledWith(expect.stringContaining('bun add zod@^4'));
  });

  it('should explicitly install @mastra/server when using bun (workaround for bun issue #25314)', async () => {
    process.env.npm_config_user_agent = 'bun/1.0.0';

    const { createMastraProject } = await import('./utils');

    await createMastraProject({
      projectName: 'test-bun-server-workaround',
      needsInteractive: false,
    });

    // Check that @mastra/server is explicitly installed for bun
    // This is a workaround for https://github.com/oven-sh/bun/issues/25314
    const allCalls = mocks.mockExec.mock.calls.map((c: unknown[]) => c[0]);
    const serverCall = allCalls.find((cmd: string) => cmd && cmd.includes('@mastra/server'));
    expect(serverCall).toBeDefined();
    expect(serverCall).toContain('bun add @mastra/server@');
  });

  it('should NOT explicitly install @mastra/server when using npm', async () => {
    process.env.npm_config_user_agent = 'npm/10.0.0';

    const { createMastraProject } = await import('./utils');

    await createMastraProject({
      projectName: 'test-npm-no-server-workaround',
      needsInteractive: false,
    });

    // npm should NOT have @mastra/server explicitly installed (it works correctly via transitive deps)
    const serverCalls = mocks.mockExec.mock.calls.filter(
      (call: string[]) => call[0] && call[0].includes('@mastra/server'),
    );
    expect(serverCalls.length).toBe(0);
  });

  it('should use npm init when npm is detected', async () => {
    process.env.npm_config_user_agent = 'npm/10.0.0';

    const { createMastraProject } = await import('./utils');

    await createMastraProject({
      projectName: 'test-npm-project',
      needsInteractive: false,
    });

    // Check if npm init was called
    expect(mocks.mockExec).toHaveBeenCalledWith('npm init -y');

    // Check if npm install was used for dependencies
    expect(mocks.mockExec).toHaveBeenCalledWith(
      expect.stringContaining(
        'npm install --audit=false --fund=false --loglevel=error --progress=false --update-notifier=false zod@^4',
      ),
    );
  });

  it('should clean up directory on failure', async () => {
    process.env.npm_config_user_agent = 'bun/1.0.0';

    // Simulate failure during init
    mocks.mockExec.mockRejectedValueOnce(new Error('Init failed'));
    mocks.mockExistsSync.mockReturnValue(true); // Directory exists for cleanup

    const { createMastraProject } = await import('./utils');

    await createMastraProject({
      projectName: 'test-cleanup-project',
      needsInteractive: false,
    });

    // Check if cleanup was attempted
    expect(mocks.mockRm).toHaveBeenCalledWith(expect.stringContaining('test-cleanup-project'), {
      recursive: true,
      force: true,
    });
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
