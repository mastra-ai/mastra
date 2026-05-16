import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeBundle } from '../build/analyze';
import { collectTransitiveWorkspaceDependencies } from './workspaceDependencies';
import { Bundler } from './index';

vi.mock('../build/analyze', () => ({
  analyzeBundle: vi.fn(),
}));

vi.mock('./workspaceDependencies', () => ({
  collectTransitiveWorkspaceDependencies: vi.fn(() => ({
    resolutions: {},
    usedWorkspacePackages: new Set<string>(),
  })),
  packWorkspaceDependencies: vi.fn(),
}));

const tempDirs: string[] = [];

class TestBundler extends Bundler {
  async bundle(): Promise<void> {}

  getEnvFiles(): Promise<string[]> {
    return Promise.resolve([]);
  }
}

/**
 * Runs `_bundle` far enough to generate the package.json, then aborts. Rollup itself is
 * out of scope here — the dependency map handed to `writePackageJson` is what's under test.
 */
const STOP_AFTER_PACKAGE_JSON = 'stop-after-package-json';

class ExcludePackagesBundler extends TestBundler {
  constructor(private readonly excludePackages: string[]) {
    super('Test');
  }

  async runBundle(outputDirectory: string) {
    return this._bundle('server.js', 'mastra.js', { projectRoot: outputDirectory, outputDirectory });
  }

  protected async getUserBundlerOptions() {
    return { externals: [], sourcemap: false, transpilePackages: [], excludePackages: this.excludePackages };
  }

  async listToolsInputOptions() {
    return {};
  }

  protected async getBundlerOptions(): Promise<never> {
    throw new Error(STOP_AFTER_PACKAGE_JSON);
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

describe('Bundler.writePackageJson', () => {
  it('writes npm alias and workspace tarball dependency specs using the package name as the key', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'mastra-bundler-package-json-'));
    tempDirs.push(tempDir);

    const bundler = new TestBundler('Test');
    const workspaceResolutions = {
      '@inner/transitive-c': 'file:./workspace-module/inner-transitive-c-1.0.0.tgz',
    };

    await bundler.writePackageJson(
      tempDir,
      new Map([
        ['@ai-sdk/provider-utils-v7', { version: '5.0.0', packageSpec: 'npm:@ai-sdk/provider-utils@5.0.0' }],
        ['@inner/transitive-c', { version: '1.0.0', packageSpec: workspaceResolutions['@inner/transitive-c'] }],
        ['regular-package/subpath', { version: '1.2.3' }],
      ]),
      workspaceResolutions,
    );

    const pkg = JSON.parse(await readFile(join(tempDir, 'package.json'), 'utf-8'));
    expect(pkg.dependencies).toEqual({
      '@ai-sdk/provider-utils-v7': 'npm:@ai-sdk/provider-utils@5.0.0',
      '@inner/transitive-c': 'file:./workspace-module/inner-transitive-c-1.0.0.tgz',
      'regular-package': '1.2.3',
    });
    expect(pkg.resolutions).toEqual(workspaceResolutions);
    expect(pkg.pnpm).toBeUndefined();
  });
});

describe('Bundler._bundle excludePackages', () => {
  const analyzed = {
    externalDependencies: new Map([
      ['@mastra/libsql', { version: '1.0.0' }],
      ['@mastra/pg', { version: '2.0.0' }],
    ]),
    dependencies: new Map(),
    workspaceMap: new Map(),
    output: { code: '' },
    usedExternals: {},
    invalidChunks: new Set(),
  };

  async function generatePackageJson(excludePackages: string[]) {
    const tempDir = await mkdtemp(join(tmpdir(), 'mastra-bundler-exclude-'));
    tempDirs.push(tempDir);

    vi.mocked(analyzeBundle).mockResolvedValue(analyzed as never);

    await expect(new ExcludePackagesBundler(excludePackages).runBundle(tempDir)).rejects.toThrow(
      STOP_AFTER_PACKAGE_JSON,
    );

    return JSON.parse(await readFile(join(tempDir, 'output', 'package.json'), 'utf-8'));
  }

  it('omits an excluded package from the generated package.json', async () => {
    const pkg = await generatePackageJson(['@mastra/libsql']);

    expect(pkg.dependencies).toEqual({ '@mastra/pg': '2.0.0' });
  });

  it('keeps every analyzed dependency when the option is unset', async () => {
    const pkg = await generatePackageJson([]);

    expect(pkg.dependencies).toEqual({ '@mastra/libsql': '1.0.0', '@mastra/pg': '2.0.0' });
  });

  it('omits an excluded package that the transitive-workspace step would otherwise re-add', async () => {
    vi.mocked(collectTransitiveWorkspaceDependencies).mockReturnValueOnce({
      resolutions: { '@internal/db': 'file:./workspace-module/internal-db-1.0.0.tgz' },
      usedWorkspacePackages: new Set<string>(),
    } as never);

    const pkg = await generatePackageJson(['@internal/db']);

    expect(pkg.dependencies).toEqual({ '@mastra/libsql': '1.0.0', '@mastra/pg': '2.0.0' });
  });
});
