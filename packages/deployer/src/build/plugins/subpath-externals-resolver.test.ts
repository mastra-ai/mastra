import { rolldown } from 'rolldown';
import type { InputOptions } from 'rolldown';
import { describe, expect, it } from 'vitest';
import type { WorkspacePackageInfo } from '../../bundler/workspaceDependencies';
import { virtualModules } from '../rolldown/virtual';
import { subpathExternals } from './subpath-externals-resolver';

const workspaceMap = new Map<string, WorkspacePackageInfo>([
  [
    '@inner/subpath-only',
    {
      location: '/workspace/packages/subpath-only',
      exports: {
        '.': './src/index.js',
        './value': './src/value.js',
      },
    } as WorkspacePackageInfo,
  ],
  [
    '@inner/no-exports',
    {
      location: '/workspace/packages/no-exports',
    } as WorkspacePackageInfo,
  ],
]);

async function build(entry: string, { patterns, plugin }: ReturnType<typeof subpathExternals>) {
  const unresolved: string[] = [];
  const options: InputOptions = {
    input: 'entry',
    external: patterns,
    plugins: [virtualModules({ entry }), plugin],
    // Rolldown keeps unresolvable bare imports external with a log, which would hide a missing pattern
    onLog(_level, log) {
      if (log.code === 'UNRESOLVED_IMPORT') {
        unresolved.push(log.exporter ?? log.message);
      }
    },
  };
  const bundle = await rolldown(options);
  try {
    const { output } = await bundle.generate({ format: 'esm' });
    expect(unresolved).toEqual([]);
    return output[0].imports;
  } finally {
    await bundle.close();
  }
}

describe('subpathExternals', () => {
  it('externalizes non-workspace packages and their subpaths through patterns only', async () => {
    const result = subpathExternals(['external-package', '@inner/no-exports'], workspaceMap);

    expect(result.plugin).toBeNull();
    expect(result.patterns).toHaveLength(1);

    const imports = await build(
      [
        `import a from 'external-package';`,
        `import b from 'external-package/subpath';`,
        `import c from '@inner/no-exports/anything';`,
        `console.log(a, b, c);`,
      ].join('\n'),
      result,
    );

    expect(imports.sort()).toEqual(['@inner/no-exports/anything', 'external-package', 'external-package/subpath']);
  });

  it('keeps package-boundary matching for patterns', () => {
    const [pattern] = subpathExternals(['external-package'], workspaceMap).patterns;

    expect(pattern!.test('external-package')).toBe(true);
    expect(pattern!.test('external-package/subpath')).toBe(true);
    expect(pattern!.test('external-package-other')).toBe(false);
    expect(pattern!.test('./external-package')).toBe(false);
  });

  it('externalizes exported workspace package subpaths through the plugin', async () => {
    const result = subpathExternals(['@inner/subpath-only'], workspaceMap);

    expect(result.patterns).toEqual([]);
    expect(result.plugin).not.toBeNull();

    const imports = await build(
      [`import a from '@inner/subpath-only';`, `import b from '@inner/subpath-only/value';`, `console.log(a, b);`].join(
        '\n',
      ),
      result,
    );

    expect(imports.sort()).toEqual(['@inner/subpath-only', '@inner/subpath-only/value']);
  });

  it('rejects workspace package subpaths that are not exported', async () => {
    const result = subpathExternals(['@inner/subpath-only'], workspaceMap);

    await expect(build(`import a from '@inner/subpath-only/missing';\nconsole.log(a);`, result)).rejects.toThrow(
      /Could not resolve workspace package subpath "@inner\/subpath-only\/missing"\./,
    );
  });

  it('splits plain and validated externals', async () => {
    const result = subpathExternals(['external-package', '@inner/subpath-only', './local', '/abs'], workspaceMap);

    expect(result.patterns).toHaveLength(1);
    expect(result.patterns[0]!.test('@inner/subpath-only/value')).toBe(false);
    expect(result.patterns[0]!.test('./local')).toBe(false);

    const imports = await build(
      [
        `import a from 'external-package/subpath';`,
        `import b from '@inner/subpath-only/value';`,
        `console.log(a, b);`,
      ].join('\n'),
      result,
    );

    expect(imports.sort()).toEqual(['@inner/subpath-only/value', 'external-package/subpath']);
  });

  it('does not claim sibling subpaths when the external is itself a subpath', () => {
    const { plugin } = subpathExternals(['@inner/subpath-only/value'], workspaceMap);
    const resolveId = plugin!.resolveId as { filter: { id: RegExp } };

    expect(resolveId.filter.id.test('@inner/subpath-only/value')).toBe(true);
    expect(resolveId.filter.id.test('@inner/subpath-only/other')).toBe(false);
    expect(resolveId.filter.id.test('@inner/subpath-only')).toBe(false);
  });
});
