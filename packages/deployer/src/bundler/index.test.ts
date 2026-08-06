import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { BundlerOptions } from '../build/types';
import { Bundler } from './index';

const tempDirs: string[] = [];

class TestBundler extends Bundler {
  async bundle(): Promise<void> {}

  getEnvFiles(): Promise<string[]> {
    return Promise.resolve([]);
  }

  // Surfaces the protected input-map builder for assertions.
  publicGetBundlerOptions(serverFile: string, mastraEntryFile: string, options: BundlerOptions) {
    return this.getBundlerOptions(
      serverFile,
      mastraEntryFile,
      { dependencies: new Map(), externalDependencies: new Map(), workspaceMap: new Map() },
      [],
      options,
    );
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

describe('Bundler.getBundlerOptions extra entries', () => {
  const baseOptions: BundlerOptions = {
    enableSourcemap: false,
    enableEsmShim: true,
    externals: [],
  };

  async function setupProject() {
    const tempDir = await mkdtemp(join(tmpdir(), 'mastra-bundler-entries-'));
    tempDirs.push(tempDir);
    const mastraEntryFile = join(tempDir, 'index.ts');
    await writeFile(mastraEntryFile, 'export const mastra = {}');
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0' }));
    return { tempDir, mastraEntryFile };
  }

  it('keeps only index when no extra entries are configured', async () => {
    const { mastraEntryFile } = await setupProject();
    const bundler = new TestBundler('Test');

    const inputOptions = await bundler.publicGetBundlerOptions('const virtual = 1\n', mastraEntryFile, baseOptions);

    expect(inputOptions.input).toEqual({ index: '#entry' });
  });

  it('emits extra entries alongside the virtual server entry', async () => {
    const { tempDir, mastraEntryFile } = await setupProject();
    const workerPath = join(tempDir, 'voice-worker.ts').replaceAll('\\', '/');
    const bundler = new TestBundler('Test');

    const inputOptions = await bundler.publicGetBundlerOptions('const virtual = 1\n', mastraEntryFile, {
      ...baseOptions,
      entries: { 'voice-worker': workerPath },
    });

    // `index` must survive — an extra entry adds an output, it never replaces the server.
    expect(inputOptions.input).toEqual({ index: '#entry', 'voice-worker': workerPath });
  });

  it('emits extra entries alongside a file-based server entry', async () => {
    const { tempDir, mastraEntryFile } = await setupProject();
    const serverFile = join(tempDir, 'server.ts');
    await writeFile(serverFile, 'export const server = 1');
    const workerPath = join(tempDir, 'voice-worker.ts').replaceAll('\\', '/');
    const bundler = new TestBundler('Test');

    const inputOptions = await bundler.publicGetBundlerOptions(serverFile, mastraEntryFile, {
      ...baseOptions,
      entries: { 'voice-worker': workerPath },
    });

    expect(inputOptions.input).toEqual({ index: serverFile, 'voice-worker': workerPath });
  });
});
