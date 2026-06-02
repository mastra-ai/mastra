import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Verifies that `createMastraProject` normalizes the packageManager /
 * devEngines.packageManager fields that pnpm v11 writes with a semver range.
 */

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
  const mockWriteFile = vi.fn().mockResolvedValue(undefined);
  // Holds the package.json content returned by readFile for each test
  let readFileContent = '{}';

  return {
    mockExec,
    mockChildProcess,
    mockRm,
    mockExistsSync,
    mockWriteFile,
    get readFileContent() {
      return readFileContent;
    },
    set readFileContent(value: string) {
      readFileContent = value;
    },
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
    readFile: vi.fn().mockImplementation(() => Promise.resolve(mocks.readFileContent)),
    writeFile: mocks.mockWriteFile,
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

describe('pnpm v11 packageManager normalization', () => {
  const originalEnv = process.env;
  const originalChdir = process.chdir;
  const originalCwd = process.cwd;
  const originalExit = process.exit;
  const mockChdir = vi.fn();
  const mockCwd = vi.fn().mockReturnValue('/tmp');
  const mockExit = vi.fn() as unknown as typeof process.exit;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, npm_config_user_agent: 'pnpm/11.3.0' };
    process.chdir = mockChdir;
    process.cwd = mockCwd;
    process.exit = mockExit;
    mocks.mockExec.mockReset();
    mocks.mockExec.mockResolvedValue({ stdout: '' });
    mocks.mockRm.mockClear();
    mocks.mockWriteFile.mockClear();
    mocks.mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    process.env = originalEnv;
    process.chdir = originalChdir;
    process.cwd = originalCwd;
    process.exit = originalExit;
  });

  it('should remove devEngines.packageManager from pnpm v11 init output', async () => {
    // Simulate pnpm v11 init output
    mocks.readFileContent = JSON.stringify({
      name: 'test-project',
      scripts: {},
      devEngines: {
        packageManager: {
          name: 'pnpm',
          version: '^11.3.0',
          onFail: 'download',
        },
      },
    });

    const { createMastraProject } = await import('./utils');

    await createMastraProject({
      projectName: 'test-pnpm11-project',
      needsInteractive: false,
    });

    // Find the writeFile call that writes package.json content
    const writeFileCalls = mocks.mockWriteFile.mock.calls;
    const packageJsonWrite = writeFileCalls.find(
      (call: any[]) => typeof call[1] === 'string' && call[1].includes('"type"'),
    );

    expect(packageJsonWrite).toBeDefined();
    const written = JSON.parse(packageJsonWrite![1]);
    // Both packageManager and devEngines.packageManager should be removed
    // because corepack ≤0.35.0 rejects ranges in both fields
    expect(written.packageManager).toBeUndefined();
    expect(written.devEngines).toBeUndefined();
  });

  it('should remove legacy packageManager field with range', async () => {
    mocks.readFileContent = JSON.stringify({
      name: 'test-project',
      scripts: {},
      packageManager: 'pnpm@^11.3.0',
    });

    const { createMastraProject } = await import('./utils');

    await createMastraProject({
      projectName: 'test-legacy-pm-project',
      needsInteractive: false,
    });

    const writeFileCalls = mocks.mockWriteFile.mock.calls;
    const packageJsonWrite = writeFileCalls.find(
      (call: any[]) => typeof call[1] === 'string' && call[1].includes('"type"'),
    );

    expect(packageJsonWrite).toBeDefined();
    const written = JSON.parse(packageJsonWrite![1]);
    expect(written.packageManager).toBeUndefined();
  });

  it('should remove exact packageManager field too', async () => {
    mocks.readFileContent = JSON.stringify({
      name: 'test-project',
      scripts: {},
      packageManager: 'pnpm@10.29.3',
    });

    const { createMastraProject } = await import('./utils');

    await createMastraProject({
      projectName: 'test-exact-pm-project',
      needsInteractive: false,
    });

    const writeFileCalls = mocks.mockWriteFile.mock.calls;
    const packageJsonWrite = writeFileCalls.find(
      (call: any[]) => typeof call[1] === 'string' && call[1].includes('"type"'),
    );

    expect(packageJsonWrite).toBeDefined();
    const written = JSON.parse(packageJsonWrite![1]);
    expect(written.packageManager).toBeUndefined();
  });
});
