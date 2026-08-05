import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Bundler } from './index';

const tempDirs: string[] = [];

class TestBundler extends Bundler {
  async bundle(): Promise<void> {}

  getEnvFiles(): Promise<string[]> {
    return Promise.resolve([]);
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
