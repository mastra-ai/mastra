import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPackageMetadata, getPackageRootPath } from './package-info';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
  vi.restoreAllMocks();
});

async function createTempPackage() {
  const tempRoot = join(process.cwd(), '.tmp');
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(join(tempRoot, 'package-root-'));
  tempDirs.push(tempDir);

  const packageDir = join(tempDir, 'node_modules', '@mastra', 'core');
  await mkdir(join(packageDir, 'dist'), { recursive: true });
  await writeFile(join(packageDir, 'package.json'), JSON.stringify({ name: '@mastra/core', version: '1.0.0' }));
  const chunkFile = join(packageDir, 'dist', 'chunk-ABC.js');
  await writeFile(chunkFile, 'export {};');

  return { tempDir, packageDir, chunkFile };
}

describe('getPackageRootPath', () => {
  it('resolves a package when parentPath points to a file instead of a directory', async () => {
    const { packageDir, chunkFile } = await createTempPackage();

    await expect(getPackageRootPath('@mastra/core', chunkFile)).resolves.toBe(packageDir);
  });

  it('resolves the package copy installed for the app', async () => {
    const tempRoot = join(process.cwd(), '.tmp');
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'package-copy-'));
    tempDirs.push(tempDir);

    // An older copy hoisted to the top level, like a transitive dependency of another package.
    const hoistedDir = join(tempDir, 'node_modules', 'plain-pkg');
    await mkdir(hoistedDir, { recursive: true });
    await writeFile(join(hoistedDir, 'package.json'), JSON.stringify({ name: 'plain-pkg', version: '1.0.0' }));
    await writeFile(join(hoistedDir, 'index.js'), 'export {};');

    // The copy the app uses has no exports map.
    const appDir = join(tempDir, 'app');
    const installedDir = join(appDir, 'node_modules', 'plain-pkg');
    await mkdir(installedDir, { recursive: true });
    await writeFile(
      join(installedDir, 'package.json'),
      JSON.stringify({
        name: 'plain-pkg',
        version: '9.0.0',
        type: 'module',
      }),
    );
    await writeFile(join(installedDir, 'index.js'), 'export {};');
    const appEntry = join(appDir, 'index.js');
    await writeFile(appEntry, `import 'plain-pkg';`);

    await expect(getPackageRootPath('plain-pkg', appEntry)).resolves.toBe(installedDir);
    await expect(getPackageMetadata('plain-pkg', appEntry)).resolves.toMatchObject({ version: '9.0.0' });
  });

  it('resolves a versionless private package to its own root, not the app that installs it (#26321)', async () => {
    const tempRoot = join(process.cwd(), '.tmp');
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'versionless-'));
    tempDirs.push(tempDir);

    const appDir = join(tempDir, 'apps', 'app');
    const packageDir = join(appDir, 'node_modules', '@repro', 'versionless');
    await mkdir(join(packageDir, 'src'), { recursive: true });
    await writeFile(
      join(appDir, 'package.json'),
      JSON.stringify({ name: '@repro/app', version: '1.0.0', exports: { '.': './src/index.ts' } }),
    );
    await writeFile(
      join(packageDir, 'package.json'),
      JSON.stringify({ name: '@repro/versionless', private: true, type: 'module', exports: { '.': './src/index.ts' } }),
    );
    await writeFile(join(packageDir, 'src', 'index.ts'), 'export const value = 1;');

    await expect(getPackageRootPath('@repro/versionless', appDir)).resolves.toBe(packageDir);
  });

  it('stops at a versionless package root when the entry sits behind a nested module manifest (#26321)', async () => {
    const tempRoot = join(process.cwd(), '.tmp');
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'versionless-nested-'));
    tempDirs.push(tempDir);

    const appDir = join(tempDir, 'apps', 'app');
    const packageDir = join(appDir, 'node_modules', '@repro', 'versionless');
    const esmDir = join(packageDir, 'dist', 'esm');
    await mkdir(esmDir, { recursive: true });
    await writeFile(join(appDir, 'package.json'), JSON.stringify({ name: '@repro/app', version: '1.0.0' }));
    await writeFile(
      join(packageDir, 'package.json'),
      JSON.stringify({
        name: '@repro/versionless',
        private: true,
        exports: { '.': './dist/esm/index.js' },
      }),
    );
    await writeFile(join(esmDir, 'package.json'), JSON.stringify({ type: 'module' }));
    await writeFile(join(esmDir, 'index.js'), 'export const value = 1;');

    await expect(getPackageRootPath('@repro/versionless', appDir)).resolves.toBe(packageDir);
  });

  it('resolves a file inside a versionless workspace package to that package root (#27134)', async () => {
    const tempRoot = join(process.cwd(), '.tmp');
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'versionless-file-'));
    tempDirs.push(tempDir);

    const packageDir = join(tempDir, 'packages', 'dependent');
    const esmDir = join(packageDir, 'dist', 'esm');
    await mkdir(esmDir, { recursive: true });
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'workspace', version: '1.0.0' }));
    await writeFile(join(packageDir, 'package.json'), JSON.stringify({ name: '@inner/dependent', private: true }));
    await writeFile(join(esmDir, 'package.json'), JSON.stringify({ type: 'module' }));
    const entryFile = join(esmDir, 'index.js');
    await writeFile(entryFile, 'export const value = 1;');

    await expect(getPackageRootPath(entryFile)).resolves.toBe(packageDir);
  });

  it('resolves a file behind a nested manifest named after its package to the real package root', async () => {
    const tempRoot = join(process.cwd(), '.tmp');
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'nested-named-'));
    tempDirs.push(tempDir);

    // Same shape as engine.io-client/build/esm/package.json: named, typed, no version.
    const packageDir = join(tempDir, 'node_modules', 'engine.io-client');
    const esmDir = join(packageDir, 'build', 'esm');
    await mkdir(esmDir, { recursive: true });
    await writeFile(join(packageDir, 'package.json'), JSON.stringify({ name: 'engine.io-client', version: '6.6.6' }));
    await writeFile(join(esmDir, 'package.json'), JSON.stringify({ name: 'engine.io-client', type: 'module' }));
    const entryFile = join(esmDir, 'index.js');
    await writeFile(entryFile, 'export const value = 1;');

    await expect(getPackageRootPath(entryFile)).resolves.toBe(packageDir);
  });

  it('resolves a file behind a nested named manifest in a versionless workspace package to the package root', async () => {
    const tempRoot = join(process.cwd(), '.tmp');
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'nested-named-versionless-'));
    tempDirs.push(tempDir);

    const packageDir = join(tempDir, 'packages', 'foo');
    const esmDir = join(packageDir, 'dist', 'esm');
    await mkdir(esmDir, { recursive: true });
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'workspace', version: '1.0.0' }));
    await writeFile(join(packageDir, 'package.json'), JSON.stringify({ name: '@ws/foo', private: true }));
    await writeFile(join(esmDir, 'package.json'), JSON.stringify({ name: '@ws/foo', type: 'module' }));
    const entryFile = join(esmDir, 'index.js');
    await writeFile(entryFile, 'export const value = 1;');

    await expect(getPackageRootPath(entryFile)).resolves.toBe(packageDir);
  });

  it('returns an absolute path when parentPath is not absolute', async () => {
    const { packageDir, chunkFile } = await createTempPackage();
    const relativeChunkFile = relative(process.cwd(), chunkFile);

    const rootPath = await getPackageRootPath('@mastra/core', relativeChunkFile);

    expect(rootPath && isAbsolute(rootPath)).toBe(true);
    expect(rootPath).toBe(packageDir);
  });

  it('does not log ENOTDIR errors for unresolvable packages when parentPath is a file', async () => {
    const { chunkFile } = await createTempPackage();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // local-pkg logs non-MODULE_NOT_FOUND resolution errors (like ENOTDIR) to the console.
    // Passing a module file path as the resolution base must not trigger that.
    await expect(getPackageRootPath('mastra-nonexistent-package', chunkFile)).resolves.toBeNull();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

describe('getPackageMetadata', () => {
  it('falls back from a package subpath to the package root metadata', async () => {
    const tempRoot = join(process.cwd(), '.tmp');
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'package-metadata-'));
    tempDirs.push(tempDir);

    const packageDir = join(tempDir, 'node_modules', 'date-fns');
    await mkdir(join(packageDir, 'esm', 'endOfDay'), { recursive: true });
    await writeFile(
      join(packageDir, 'package.json'),
      JSON.stringify({ name: 'date-fns', version: '2.30.0', type: 'module', main: './index.js' }),
    );
    await writeFile(join(packageDir, 'esm', 'endOfDay', 'index.js'), `export const endOfDay = () => {};`);

    await expect(getPackageMetadata('date-fns/esm/endOfDay/index.js', tempDir)).resolves.toMatchObject({
      version: '2.30.0',
      packageSpec: undefined,
    });
  });
});
