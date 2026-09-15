import type { Plugin } from 'rollup';
import { describe, expect, it } from 'vitest';
import { getInputOptions } from './bundler';

function resolveId(plugin: Plugin, id: string) {
  const hook = plugin.resolveId;
  const handler = typeof hook === 'function' ? hook : hook?.handler;

  return handler?.call({} as any, id, '/project/src/index.ts', {} as any);
}

describe('getInputOptions externals', () => {
  it('externalizes dependency subpaths without rewriting them when using the externals preset', async () => {
    const inputOptions = await getInputOptions(
      'test-entry.js',
      {
        dependencies: new Map(),
        externalDependencies: new Map([['lodash', {} as any]]),
        workspaceMap: new Map(),
      },
      'node',
      undefined,
      {
        externalsPreset: true,
        externalPackages: ['@bufbuild/protobuf'],
        projectRoot: process.cwd(),
      },
    );

    expect(inputOptions.external).toEqual([]);

    const plugin = (inputOptions.plugins as Plugin[]).find(plugin => plugin.name === 'subpath-externals-resolver');
    expect(await resolveId(plugin!, '@bufbuild/protobuf/wkt')).toEqual({
      id: '@bufbuild/protobuf/wkt',
      external: true,
    });
    expect(await resolveId(plugin!, 'lodash/fp/get')).toBeUndefined();
  });
});
