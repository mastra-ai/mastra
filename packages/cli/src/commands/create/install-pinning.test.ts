import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockExec = vi.fn();
  const mockChildProcess = {
    exec: (cmd: string, opts: unknown, cb: unknown) => {
      mockExec(cmd);
      if (cb) (cb as (a: null, b: { stdout: string }) => void)(null, { stdout: '' });
      return {
        on: (event: string, callback: (code: number) => void) => {
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
    promisify: () => mocks.mockExec,
  },
  promisify: () => mocks.mockExec,
}));

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(JSON.stringify({ scripts: {}, engines: {} })),
    writeFile: vi.fn().mockResolvedValue(undefined),
    rm: mocks.mockRm,
  },
}));

vi.mock('node:fs', () => ({
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

describe('create install version pinning', () => {
  const originalEnv = process.env;
  const originalChdir = process.chdir;
  const originalCwd = process.cwd;
  const originalExit = process.exit;
  const mockChdir = vi.fn();
  const mockCwd = vi.fn().mockReturnValue('/tmp');
  const mockExitFn = vi.fn();
  const mockExit = mockExitFn as unknown as typeof process.exit;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.chdir = mockChdir;
    process.cwd = mockCwd;
    process.exit = mockExit;
    mockChdir.mockClear();
    mockCwd.mockClear();
    mockExitFn.mockClear();
    mocks.mockExec.mockReset();
    mocks.mockExec.mockResolvedValue({ stdout: '' });
    mocks.mockRm.mockClear();
    mocks.mockExistsSync.mockReturnValue(false);
    process.env.npm_config_user_agent = 'npm/10.0.0';
  });

  afterEach(() => {
    process.env = originalEnv;
    process.chdir = originalChdir;
    process.cwd = originalCwd;
    process.exit = originalExit;
  });

  it('does not retry mastra with @latest when a pinned mastra install fails', async () => {
    mocks.mockExec.mockImplementation(async (cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('mastra@1.3.14')) {
        throw new Error('install failed');
      }
      return { stdout: '' };
    });

    const { createMastraProject } = await import('./utils');

    await createMastraProject({
      projectName: 'pinned-fail-project',
      needsInteractive: false,
      createVersionTag: '1.3.14',
    });

    expect(mockExitFn).toHaveBeenCalledWith(1);
    const joined = mocks.mockExec.mock.calls.map(c => String(c[0])).join('\n');
    expect(joined).toContain('mastra@1.3.14');
    expect(joined).not.toMatch(/mastra@latest/);
  });
});
