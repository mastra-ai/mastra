import { join } from 'node:path';
import type { Plugin } from 'rollup';
import { describe, expect, it } from 'vitest';
import type { WorkspacePackageInfo } from '../bundler/workspaceDependencies';
import { getInputOptions, resolveWorkspaceSubpathToSource } from './bundler';

const workspacePackage = (exports: unknown): WorkspacePackageInfo => ({
  location: '/workspace/packages/example',
  dependencies: undefined,
  version: '1.0.0',
  exports,
});

describe('resolveWorkspaceSubpathToSource', () => {
  it('resolves an exact workspace subpath export', () => {
    const workspaceMap = new Map([
      [
        '@repo/example',
        workspacePackage({
          '.': './src/index.ts',
          './feature': './src/feature.ts',
        }),
      ],
    ]);

    expect(resolveWorkspaceSubpathToSource('@repo/example/feature', workspaceMap)).toBe(
      join('/workspace/packages/example', './src/feature.ts'),
    );
  });

  it('resolves wildcard workspace subpath exports', () => {
    const workspaceMap = new Map([
      [
        '@repo/example',
        workspacePackage({
          '.': './src/index.ts',
          './dist/*': './src/*.ts',
        }),
      ],
    ]);

    expect(resolveWorkspaceSubpathToSource('@repo/example/dist/feature', workspaceMap)).toBe(
      join('/workspace/packages/example', './src/feature.ts'),
    );
  });

  it('selects the runtime import target from conditional exports', () => {
    const workspaceMap = new Map([
      [
        '@repo/example',
        workspacePackage({
          '.': './src/index.ts',
          './feature': {
            types: './dist/feature.d.ts',
            import: './src/feature.ts',
            default: './dist/feature.js',
          },
        }),
      ],
    ]);

    expect(resolveWorkspaceSubpathToSource('@repo/example/feature', workspaceMap)).toBe(
      join('/workspace/packages/example', './src/feature.ts'),
    );
  });

  it.each([
    ['a bare package root', '@repo/example', new Map([['@repo/example', workspacePackage({ '.': './src/index.ts' })]])],
    ['a non-workspace package', '@repo/missing/feature', new Map()],
    [
      'a missing export entry',
      '@repo/example/missing',
      new Map([['@repo/example', workspacePackage({ '.': './src/index.ts', './feature': './src/feature.ts' })]]),
    ],
    ['an invalid exports field', '@repo/example/feature', new Map([['@repo/example', workspacePackage(42)]])],
  ])('returns null for %s', (_, id, workspaceMap) => {
    expect(resolveWorkspaceSubpathToSource(id, workspaceMap)).toBeNull();
  });
});

describe('alias-optimized-deps workspace subpath fallback', () => {
  const getAliasPlugin = async (externalsPreset: boolean) => {
    const options = await getInputOptions(
      '/workspace/apps/mastra/src/index.ts',
      {
        dependencies: new Map(),
        externalDependencies: new Map(),
        workspaceMap: new Map([
          [
            '@repo/example',
            workspacePackage({
              '.': './src/index.ts',
              './feature': './src/feature.ts',
            }),
          ],
        ]),
      },
      'node',
      undefined,
      {
        projectRoot: '/workspace/apps/mastra',
        workspaceRoot: '/workspace',
        externalsPreset,
      },
    );

    return (options.plugins as Plugin[]).find(plugin => plugin.name === 'alias-optimized-deps')!;
  };

  it('inlines an uncaptured workspace subpath for external preset builds', async () => {
    const plugin = await getAliasPlugin(true);
    const resolveId = plugin.resolveId as (id: string) => unknown;

    expect(await resolveId('@repo/example/feature')).toEqual({
      id: join('/workspace/packages/example', './src/feature.ts'),
      external: false,
    });
  });

  it('preserves the existing fallback outside external preset builds', async () => {
    const plugin = await getAliasPlugin(false);
    const resolveId = plugin.resolveId as (id: string) => unknown;

    expect(await resolveId('@repo/example/feature')).toBeNull();
  });
});
