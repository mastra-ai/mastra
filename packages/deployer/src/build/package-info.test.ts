import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
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

  it('resolves the installed copy of a package whose exports map omits ./package.json', async () => {
    const tempRoot = join(process.cwd(), '.tmp');
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'package-exports-'));
    tempDirs.push(tempDir);

    // An older copy hoisted to the top level, like a transitive dependency of another package.
    const hoistedDir = join(tempDir, 'node_modules', 'gated-pkg');
    await mkdir(hoistedDir, { recursive: true });
    await writeFile(join(hoistedDir, 'package.json'), JSON.stringify({ name: 'gated-pkg', version: '1.0.0' }));
    await writeFile(join(hoistedDir, 'index.js'), 'export {};');

    // The copy the app uses. Its exports map has no `./package.json` entry.
    const appDir = join(tempDir, 'app');
    const installedDir = join(appDir, 'node_modules', 'gated-pkg');
    await mkdir(installedDir, { recursive: true });
    await writeFile(
      join(installedDir, 'package.json'),
      JSON.stringify({
        name: 'gated-pkg',
        version: '9.0.0',
        type: 'module',
        exports: { '.': { types: './index.d.ts', default: './index.js' } },
      }),
    );
    await writeFile(join(installedDir, 'index.js'), 'export {};');
    const appEntry = join(appDir, 'index.js');
    await writeFile(appEntry, `import 'gated-pkg';`);

    await expect(getPackageRootPath('gated-pkg', appEntry)).resolves.toBe(installedDir);
    await expect(getPackageMetadata('gated-pkg', appEntry)).resolves.toMatchObject({ version: '9.0.0' });
  });

  it('returns the real path when the package is linked into node_modules', async () => {
    const tempRoot = join(process.cwd(), '.tmp');
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'package-symlink-'));
    tempDirs.push(tempDir);

    // The real package directory, like a pnpm virtual store or a workspace package.
    const realDir = join(tempDir, 'store', 'linked-pkg');
    await mkdir(realDir, { recursive: true });
    await writeFile(join(realDir, 'package.json'), JSON.stringify({ name: 'linked-pkg', version: '1.2.3' }));
    await writeFile(join(realDir, 'index.js'), 'export {};');

    // The link that a bare import resolves through.
    const appDir = join(tempDir, 'app');
    await mkdir(join(appDir, 'node_modules'), { recursive: true });
    await symlink(realDir, join(appDir, 'node_modules', 'linked-pkg'), 'dir');
    const appEntry = join(appDir, 'index.js');
    await writeFile(appEntry, `import 'linked-pkg';`);

    // Rollup resolves module ids to real paths, so consumers match against the real path.
    await expect(getPackageRootPath('linked-pkg', appEntry)).resolves.toBe(realDir);
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
