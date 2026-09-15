import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
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

  it('resolves the package root when exports hide package.json', async () => {
    const tempRoot = join(process.cwd(), '.tmp');
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'exports-gated-'));
    tempDirs.push(tempDir);

    const appDir = join(tempDir, 'app');
    const packageDir = join(appDir, 'node_modules', '@bufbuild', 'protobuf');
    await mkdir(join(packageDir, 'dist', 'esm', 'wkt'), { recursive: true });
    await writeFile(
      join(packageDir, 'package.json'),
      JSON.stringify({
        name: '@bufbuild/protobuf',
        version: '2.13.0',
        type: 'module',
        exports: {
          '.': './dist/esm/index.js',
          './wkt': './dist/esm/wkt/index.js',
        },
      }),
    );
    await writeFile(join(packageDir, 'dist', 'esm', 'package.json'), JSON.stringify({ type: 'module' }));
    await writeFile(join(packageDir, 'dist', 'esm', 'index.js'), 'export {};');
    await writeFile(join(packageDir, 'dist', 'esm', 'wkt', 'index.js'), 'export {};');
    const appEntry = join(appDir, 'index.js');
    await writeFile(appEntry, `import('@bufbuild/protobuf/wkt');`);

    await expect(getPackageRootPath('@bufbuild/protobuf', appEntry)).resolves.toBe(packageDir);
    await expect(getPackageMetadata('@bufbuild/protobuf', appEntry)).resolves.toMatchObject({ version: '2.13.0' });
  });

  it('resolves symlinked packages to their real package root', async () => {
    const tempRoot = join(process.cwd(), '.tmp');
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'symlinked-package-'));
    tempDirs.push(tempDir);

    const appDir = join(tempDir, 'app');
    const packageDir = join(tempDir, '.pnpm', 'linked-pkg@3.0.0', 'node_modules', 'linked-pkg');
    const linkedDir = join(appDir, 'node_modules', 'linked-pkg');
    await mkdir(packageDir, { recursive: true });
    await mkdir(join(appDir, 'node_modules'), { recursive: true });
    await writeFile(join(packageDir, 'package.json'), JSON.stringify({ name: 'linked-pkg', version: '3.0.0' }));
    await writeFile(join(packageDir, 'index.js'), 'export {};');
    await symlink(packageDir, linkedDir, process.platform === 'win32' ? 'junction' : 'dir');
    const appEntry = join(appDir, 'index.js');
    await writeFile(appEntry, `import 'linked-pkg';`);

    const realPackageDir = await realpath(packageDir);
    await expect(getPackageRootPath('linked-pkg', appEntry)).resolves.toBe(realPackageDir);
    await expect(getPackageMetadata('linked-pkg', appEntry)).resolves.toMatchObject({
      rootPath: realPackageDir,
      version: '3.0.0',
    });
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
