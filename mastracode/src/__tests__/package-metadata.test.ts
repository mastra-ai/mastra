import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const packageJsonPath = new URL('../../package.json', import.meta.url);

type PackageJson = {
  type?: string;
  files?: string[];
  main?: string;
  types?: string;
  bin?: Record<string, string>;
  exports?: Record<string, unknown>;
  engines?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

async function readPackageJson(): Promise<PackageJson> {
  return JSON.parse(await readFile(packageJsonPath, 'utf8')) as PackageJson;
}

describe('mastracode package metadata', () => {
  it('keeps the installed CLI entrypoint and public exports aligned with dist output', async () => {
    const pkg = await readPackageJson();

    expect(pkg.type).toBe('module');
    expect(pkg.files).toEqual(expect.arrayContaining(['dist', 'CHANGELOG.md']));
    expect(pkg.bin).toEqual({ mastracode: './dist/cli.js' });
    expect(pkg.main).toBe('dist/index.js');
    expect(pkg.types).toBe('dist/index.d.ts');
    expect(pkg.exports).toMatchObject({
      '.': {
        import: { types: './dist/index.d.ts', default: './dist/index.js' },
        require: { types: './dist/index.d.ts', default: './dist/index.cjs' },
      },
      './tui': {
        import: { types: './dist/tui/index.d.ts', default: './dist/tui.js' },
        require: { types: './dist/tui/index.d.ts', default: './dist/tui.cjs' },
      },
      './package.json': './package.json',
    });
    expect(pkg.engines?.node).toBe('>=22.19.0');
  });

  it('does not publish floating latest dependency ranges', async () => {
    const pkg = await readPackageJson();
    const dependencyGroups = {
      dependencies: pkg.dependencies ?? {},
      devDependencies: pkg.devDependencies ?? {},
      peerDependencies: pkg.peerDependencies ?? {},
      optionalDependencies: pkg.optionalDependencies ?? {},
    };

    for (const [groupName, deps] of Object.entries(dependencyGroups)) {
      for (const [name, range] of Object.entries(deps)) {
        expect(range, `${groupName}.${name}`).not.toBe('latest');
      }
    }
  });
});
