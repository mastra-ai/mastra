import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mastra/core/bundler', () => ({
  MastraBundler: class {
    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    constructor() {}
  },
}));

vi.mock('@mastra/core/error', () => ({
  MastraError: class extends Error {},
  ErrorDomain: { DEPLOYER: 'DEPLOYER' },
  ErrorCategory: { SYSTEM: 'SYSTEM' },
}));

vi.mock('../services/deps', () => ({
  DepsService: class {
    __setLogger = vi.fn();
    install = vi.fn();
  },
}));

vi.mock('../services/fs', () => ({
  FileService: class {
    getFirstExistingFile = vi.fn();
  },
}));

vi.mock('../build/analyze', () => ({
  analyzeBundle: vi.fn(),
}));

vi.mock('../build/bundler', () => ({
  createBundler: vi.fn(),
  getInputOptions: vi.fn(),
}));

vi.mock('../build/bundlerOptions', () => ({
  getBundlerOptions: vi.fn(),
}));

vi.mock('../build/package-info', () => ({
  getPackageRootPath: vi.fn(),
}));

vi.mock('./workspaceDependencies', () => ({
  getWorkspaceInformation: vi.fn(),
}));

type SourceDependencyMetadata = {
  dependencyVersions: Record<string, string>;
  overrides: Record<string, unknown>;
  resolutions: Record<string, unknown>;
  pnpmOverrides: Record<string, unknown>;
};

let getDependencySpecForOutput: typeof import('./index').getDependencySpecForOutput;
let getDependencyVersionFromSourceManifest: typeof import('./index').getDependencyVersionFromSourceManifest;
let getSourceDependencyMetadata: typeof import('./index').getSourceDependencyMetadata;
let BundlerClass: typeof import('./index').Bundler;

const getBundlerModule = async () => {
    const module = await import('./index');

    getDependencySpecForOutput = module.getDependencySpecForOutput;
    getDependencyVersionFromSourceManifest = module.getDependencyVersionFromSourceManifest;
    getSourceDependencyMetadata = module.getSourceDependencyMetadata;
    BundlerClass = module.Bundler;
  };

describe('bundler metadata helpers', () => {
  let tempDir: string;

  beforeEach(async () => {
    await getBundlerModule();
    tempDir = await mkdtemp(join(tmpdir(), 'mastra-deployer-bundler-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('reads source package manifest metadata from nearest package manifest', async () => {
    await mkdir(join(tempDir, 'src'), { recursive: true });
    const sourceEntry = join(tempDir, 'src', 'index.ts');

    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        dependencies: { zod: '^4.3.6' },
        overrides: { leftPad: '1.4.2' },
        resolutions: { leftPad: 'npm:left-pad@1.4.2' },
        pnpm: { overrides: { leftPad: 'npm:left-pad@1.4.2' } },
      }),
      'utf-8',
    );
    await writeFile(sourceEntry, 'export {}', 'utf-8');

    const metadata = await getSourceDependencyMetadata({ projectRoot: tempDir, mastraEntryFile: sourceEntry });

    expect(metadata.dependencyVersions).toEqual({ zod: '^4.3.6' });
    expect(metadata.overrides).toEqual({ leftPad: '1.4.2' });
    expect(metadata.resolutions).toEqual({ leftPad: 'npm:left-pad@1.4.2' });
    expect(metadata.pnpmOverrides).toEqual({ leftPad: 'npm:left-pad@1.4.2' });
  });

  it('selects source dependency constraints for subpaths and aliases', () => {
    const sourceDependencies = {
      zod: '^4.3.6',
      '@ai-sdk/openai-v5': 'npm:@ai-sdk/openai@5.0.93',
      '@ai-sdk/openai': '^0.9.0',
    };

    expect(getDependencyVersionFromSourceManifest('zod/v4', undefined, sourceDependencies)).toBe('^4.3.6');
    expect(getDependencyVersionFromSourceManifest('@ai-sdk/openai-v5', '@ai-sdk/openai', sourceDependencies)).toBe(
      'npm:@ai-sdk/openai@5.0.93',
    );
  });

  it('writes output package JSON with source constraint blocks and preserved workspace resolutions', async () => {
    const outputDir = join(tempDir, 'output');
    await mkdir(outputDir, { recursive: true });

    const bundler = new BundlerClass('Test');

    const sourceMetadata = {
      dependencyVersions: { zod: '^4.3.6' },
      overrides: { leftPad: '1.4.2' },
      resolutions: { leftPad: 'npm:left-pad@1.4.2' },
      pnpmOverrides: { leftPad: 'npm:left-pad@1.4.2' },
    };

    const dependencies = new Map<string, string>([
      ['zod/v4', getDependencySpecForOutput({ dependencyName: 'zod/v4', dependencyVersion: '^4.3.6' })],
      [
        '@ai-sdk/openai-v5',
        getDependencySpecForOutput({
          dependencyName: '@ai-sdk/openai-v5',
          actualPackageName: '@ai-sdk/openai',
          dependencyVersion: '5.0.93',
        }),
      ],
    ]);
    const workspaceResolutions = { zod: 'file:./workspace-module/zod-4.3.6.tgz' };

    await bundler.writePackageJson(outputDir, dependencies, workspaceResolutions, sourceMetadata);

    const written = JSON.parse(await readFile(join(outputDir, 'package.json'), 'utf-8'));

    expect(written.dependencies).toEqual({
      zod: '^4.3.6',
      '@ai-sdk/openai-v5': 'npm:@ai-sdk/openai@5.0.93',
    });
    expect(written.overrides).toEqual({ leftPad: '1.4.2' });
    expect(written.pnpm).toEqual({ overrides: { leftPad: 'npm:left-pad@1.4.2' } });
    expect(written.resolutions).toEqual({ zod: 'file:./workspace-module/zod-4.3.6.tgz', leftPad: 'npm:left-pad@1.4.2' });
  });
});
