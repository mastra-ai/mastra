import type { Plugin, PluginContext } from 'rollup';
import { beforeEach, describe, expect, it } from 'vitest';
import type { WorkspacePackageInfo } from '../../bundler/workspaceDependencies';

describe('subpathExternalsResolver', () => {
  let plugin: Plugin;
  let mockContext: PluginContext;

  beforeEach(async () => {
    const mod = await import('./subpath-externals-resolver');
    mockContext = {
      error(message) {
        throw new Error(String(message));
      },
    } as unknown as PluginContext;
    plugin = mod.subpathExternalsResolver(
      ['@inner/subpath-only'],
      new Map([
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
      ]),
    );
  });

  const resolveId = (id: string, importer = '/workspace/apps/custom/src/index.ts') => {
    const fn = plugin.resolveId as Function;
    return fn.call(mockContext, id, importer, {});
  };

  it('externalizes exported workspace package subpaths independently of the importer', () => {
    expect(resolveId('@inner/subpath-only/value', '/workspace/src/mastra/index.ts')).toEqual({
      id: '@inner/subpath-only/value',
      external: true,
    });
  });

  it('rejects workspace package subpaths that are not exported', () => {
    expect(() => resolveId('@inner/subpath-only/missing')).toThrow(
      'Could not resolve workspace package subpath "@inner/subpath-only/missing".',
    );
  });

  it('does not validate external subpaths outside the workspace', async () => {
    const mod = await import('./subpath-externals-resolver');
    plugin = mod.subpathExternalsResolver(['external-package']);

    expect(resolveId('external-package/subpath')).toEqual({
      id: 'external-package/subpath',
      external: true,
    });
  });
});
