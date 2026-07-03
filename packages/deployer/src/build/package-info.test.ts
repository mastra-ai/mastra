import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getPackageMetadata, getPackageRootPath } from './package-info';

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const tempRoot = join(process.cwd(), '.tmp');
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(join(tempRoot, `${prefix}-`));
  tempDirs.push(tempDir);
  return tempDir;
}

async function writePackage(
  dir: string,
  packageJson: Record<string, unknown>,
  entryRelPath = 'index.js',
): Promise<void> {
  await mkdir(join(dir, entryRelPath, '..'), { recursive: true });
  await writeFile(join(dir, 'package.json'), JSON.stringify(packageJson));
  await writeFile(join(dir, entryRelPath), 'export const value = 1;');
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
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

  // Regression: https://github.com/mastra-ai/mastra/issues/18849
  // When the installed package's `exports` map does not expose `./package.json`, the deployer
  // must still pin the version of the copy the bundled code actually imports — not a stale copy
  // hoisted elsewhere in the workspace whose package.json happens to be freely readable.
  it('pins the version of the copy whose exports omit ./package.json (issue #18849)', async () => {
    const tempDir = await makeTempDir('package-metadata-exports');

    // Correct copy in the app: modern ESM `exports` with NO `./package.json` subpath.
    await writePackage(join(tempDir, 'app', 'node_modules', 'dep-pkg'), {
      name: 'dep-pkg',
      version: '9.6.1',
      type: 'module',
      exports: { types: './index.d.ts', default: './index.js' },
    });

    // Stale hoisted copy with a freely-readable package.json (no exports gate).
    await writePackage(join(tempDir, 'node_modules', 'dep-pkg'), {
      name: 'dep-pkg',
      version: '5.1.1',
      main: './index.js',
    });

    await expect(getPackageMetadata('dep-pkg', join(tempDir, 'app'))).resolves.toMatchObject({
      version: '9.6.1',
    });
  });
});

describe('getPackageRootPath', () => {
  it('resolves the package whose exports omit ./package.json (issue #18849)', async () => {
    const tempDir = await makeTempDir('package-root-exports');
    const packageDir = join(tempDir, 'node_modules', 'dep-pkg');
    await writePackage(packageDir, {
      name: 'dep-pkg',
      version: '9.6.1',
      type: 'module',
      exports: { types: './index.d.ts', default: './index.js' },
    });

    await expect(getPackageRootPath('dep-pkg', tempDir)).resolves.toBe(packageDir);
  });

  it('resolves a plain package whose package.json is freely readable', async () => {
    const tempDir = await makeTempDir('package-root-plain');
    const packageDir = join(tempDir, 'node_modules', 'plain-pkg');
    await writePackage(packageDir, { name: 'plain-pkg', version: '1.0.0', main: './index.js' });

    await expect(getPackageRootPath('plain-pkg', tempDir)).resolves.toBe(packageDir);
  });

  it('walks up to the package root when the entry points deep into the package', async () => {
    const tempDir = await makeTempDir('package-root-deep');
    const packageDir = join(tempDir, 'node_modules', 'deep-pkg');
    await writePackage(
      packageDir,
      {
        name: 'deep-pkg',
        version: '1.0.0',
        type: 'module',
        exports: { default: './dist/index.js' },
      },
      join('dist', 'index.js'),
    );

    await expect(getPackageRootPath('deep-pkg', tempDir)).resolves.toBe(packageDir);
  });

  it('returns null for a package that cannot be resolved', async () => {
    const tempDir = await makeTempDir('package-root-missing');

    await expect(getPackageRootPath('does-not-exist-pkg', tempDir)).resolves.toBeNull();
  });
});
