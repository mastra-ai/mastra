import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Test that user-specified externals are always included in the output package.json,
 * even when they are not detected by static analysis (e.g., dynamically imported packages).
 *
 * See: https://github.com/mastra-ai/mastra/issues/10893
 */

// Mock analyzeBundle to return controlled results
vi.mock('../build/analyze', () => ({
  analyzeBundle: vi.fn(),
}));

// Mock getBundlerOptions to return user-specified externals
vi.mock('../build/bundlerOptions', () => ({
  getBundlerOptions: vi.fn(),
}));

// Mock getPackageRootPath
vi.mock('../build/package-info', () => ({
  getPackageRootPath: vi.fn().mockResolvedValue(null),
}));

// Mock workspaceDependencies
vi.mock('./workspaceDependencies', () => ({
  getWorkspaceInformation: vi.fn().mockResolvedValue({
    workspaceRoot: '/fake/root',
    workspaceMap: new Map(),
  }),
}));

import { analyzeBundle } from '../build/analyze';
import { getBundlerOptions } from '../build/bundlerOptions';
import { Bundler } from './index';

// Concrete test subclass
class TestBundler extends Bundler {
  constructor() {
    super('test-bundler');
  }

  // Expose writePackageJson for assertions
  public async testWritePackageJson(
    outputDirectory: string,
    dependencies: Map<string, string>,
    resolutions?: Record<string, string>,
  ) {
    return this.writePackageJson(outputDirectory, dependencies, resolutions);
  }

  // Expose _bundle for testing
  public async testBundle(
    serverFile: string,
    mastraEntryFile: string,
    options: { projectRoot: string; outputDirectory: string; enableEsmShim?: boolean },
    toolsPaths?: (string | string[])[],
  ) {
    return this._bundle(serverFile, mastraEntryFile, options, toolsPaths);
  }
}

describe('user-specified externals in output package.json', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mastra-bundler-test-'));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should include user-specified externals in dependenciesToInstall even when not detected by static analysis', async () => {
    const bundler = new TestBundler();

    // Mock getBundlerOptions to return user-specified externals
    vi.mocked(getBundlerOptions).mockResolvedValue({
      externals: ['pino-opentelemetry-transport'],
      sourcemap: false,
      transpilePackages: [],
    });

    // Mock analyzeBundle to return results WITHOUT pino-opentelemetry-transport
    // (simulating the case where the package is dynamically imported by pino, not statically imported)
    vi.mocked(analyzeBundle).mockResolvedValue({
      externalDependencies: new Map([['pino', { version: '9.0.0' }]]),
      workspaceMap: new Map(),
      dependencies: new Map(),
      invalidChunks: new Set(),
    });

    // Spy on writePackageJson to capture what dependencies are passed
    const originalWritePackageJson = bundler['writePackageJson'].bind(bundler);
    let capturedDependencies: Map<string, string> | undefined;

    vi.spyOn(bundler as any, 'writePackageJson').mockImplementation(
      async (outputDir: string, deps: Map<string, string>) => {
        capturedDependencies = deps;
        // Still write the file so we can verify
        return originalWritePackageJson(outputDir, deps);
      },
    );

    // Mock the rest of _bundle's dependencies to prevent actual bundling
    vi.spyOn(bundler as any, 'getBundlerOptions').mockResolvedValue({
      input: { index: 'fake-entry' },
      plugins: [],
    });

    vi.spyOn(bundler as any, 'createBundler').mockResolvedValue({
      write: vi.fn().mockResolvedValue(undefined),
    });

    vi.spyOn(bundler as any, 'listToolsInputOptions').mockResolvedValue({});
    vi.spyOn(bundler as any, 'copyPublic').mockResolvedValue(undefined);
    vi.spyOn(bundler as any, 'copyDOTNPMRC').mockResolvedValue(undefined);
    vi.spyOn(bundler as any, 'installDependencies').mockResolvedValue(undefined);

    await bundler.testBundle('const server = true;', '/fake/mastra/index.ts', {
      projectRoot: '/fake/project',
      outputDirectory: tempDir,
    });

    // Verify that writePackageJson was called
    expect(capturedDependencies).toBeDefined();

    // The key assertion: pino-opentelemetry-transport should be in the dependencies
    // even though it was not in analyzedBundleInfo.externalDependencies
    expect(capturedDependencies!.has('pino-opentelemetry-transport')).toBe(true);

    // pino should also be there (it WAS detected by static analysis)
    expect(capturedDependencies!.has('pino')).toBe(true);
    expect(capturedDependencies!.get('pino')).toBe('9.0.0');
  });
});
