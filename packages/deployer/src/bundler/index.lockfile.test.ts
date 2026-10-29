import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Bundler } from './index';

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
  install: vi.fn(),
  resolutions: {} as Record<string, string>,
}));

vi.mock('node:child_process', async importOriginal => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  execFile: mocks.execFile,
}));

vi.mock('../services/deps', () => ({
  DepsService: class {
    __setLogger = vi.fn();
    install = mocks.install;
  },
}));

vi.mock('../build/analyze', () => ({
  analyzeBundle: vi.fn(async () => ({
    dependencies: new Map(),
    externalDependencies: new Map(),
    workspaceMap: new Map(),
  })),
}));

vi.mock('./workspaceDependencies', () => ({
  getWorkspaceInformation: vi.fn(async () => ({ workspaceRoot: null, workspaceMap: new Map() })),
  collectTransitiveWorkspaceDependencies: vi.fn(async () => ({
    resolutions: mocks.resolutions,
    usedWorkspacePackages: new Set(),
  })),
  packWorkspaceDependencies: vi.fn(),
}));

class TestBundler extends Bundler {
  async bundle(): Promise<void> {}

  getEnvFiles(): Promise<string[]> {
    return Promise.resolve([]);
  }

  protected async getUserBundlerOptions() {
    return {};
  }

  protected async getBundlerOptions() {
    return { input: {} };
  }

  protected createBundler() {
    return Promise.resolve({ write: async () => {} }) as unknown as ReturnType<Bundler['createBundler']>;
  }

  protected async copyPublic() {}

  bundleForTest(projectRoot: string, outputDirectory: string) {
    return this._bundle(join(projectRoot, 'server.mjs'), join(projectRoot, 'src', 'mastra', 'index.ts'), {
      projectRoot,
      outputDirectory,
    });
  }
}

const tempDirs: string[] = [];

const setup = async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'mastra-bundle-lockfile-'));
  tempDirs.push(projectRoot);
  await mkdir(join(projectRoot, 'src', 'mastra'), { recursive: true });
  await writeFile(join(projectRoot, 'package.json'), JSON.stringify({ name: 'app' }));
  await writeFile(join(projectRoot, 'src', 'mastra', 'index.ts'), 'export {}');
  const outputDirectory = join(projectRoot, '.mastra');
  await mkdir(join(outputDirectory, 'output'), { recursive: true });
  return { projectRoot, outputDirectory };
};

describe('Bundler._bundle package-lock.json generation', () => {
  afterEach(async () => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    for (const key of Object.keys(mocks.resolutions)) delete mocks.resolutions[key];
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
  });

  it('generates package-lock.json in the output after installing dependencies', async () => {
    const { projectRoot, outputDirectory } = await setup();
    mocks.execFile.mockImplementation((_cmd, _args, _options, callback) => callback(null, { stdout: '', stderr: '' }));

    await new TestBundler('Test').bundleForTest(projectRoot, outputDirectory);

    expect(mocks.install).toHaveBeenCalledTimes(1);
    expect(mocks.execFile).toHaveBeenCalledTimes(1);
    expect(mocks.execFile.mock.calls[0]!.slice(0, 2)).toEqual(['npm', ['install', '--package-lock-only', '--force']]);
    expect(mocks.execFile.mock.calls[0]![2]).toMatchObject({ cwd: join(outputDirectory, 'output') });
    expect(mocks.install.mock.invocationCallOrder[0]).toBeLessThan(mocks.execFile.mock.invocationCallOrder[0]!);
  });

  it('skips package-lock.json generation with a warning when packed workspace dependencies are present', async () => {
    const { projectRoot, outputDirectory } = await setup();
    mocks.resolutions['@app/shared'] = 'file:./workspace-module/app-shared-1.0.0.tgz';
    const bundler = new TestBundler('Test');
    const warn = vi.spyOn(bundler['logger'], 'warn');

    await bundler.bundleForTest(projectRoot, outputDirectory);

    expect(mocks.install).toHaveBeenCalledTimes(1);
    expect(mocks.execFile).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      'Skipping package-lock.json generation because the output contains packed workspace dependencies',
    );
  });

  it('skips installation and package-lock.json generation when MASTRA_BUILD_SKIP_INSTALL is set', async () => {
    const { projectRoot, outputDirectory } = await setup();
    vi.stubEnv('MASTRA_BUILD_SKIP_INSTALL', 'true');

    await new TestBundler('Test').bundleForTest(projectRoot, outputDirectory);

    expect(mocks.install).not.toHaveBeenCalled();
    expect(mocks.execFile).not.toHaveBeenCalled();
  });
});
