import type { Plugin, PluginContext } from 'rollup';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePackageInfo } from '../../bundler/workspaceDependencies';

describe('subpathExternalsResolver', () => {
  let plugin: Plugin;
  let resolve: ReturnType<typeof vi.fn>;
  let mockContext: PluginContext;

  beforeEach(async () => {
    const mod = await import('./subpath-externals-resolver');
    resolve = vi.fn();
    mockContext = {
      resolve,
      error(message) {
        throw new Error(String(message));
      },
    } as unknown as PluginContext;
    plugin = mod.subpathExternalsResolver(
      ['@inner/subpath-only'],
      new Map([
        [
          '@inner/subpath-only',
          { name: '@inner/subpath-only', location: '/workspace/packages/subpath-only' } as WorkspacePackageInfo,
        ],
      ]),
    );
  });

  const resolveId = (id: string) => {
    const fn = plugin.resolveId as Function;
    return fn.call(mockContext, id, '/workspace/apps/custom/src/index.ts', {});
  };

  it('externalizes valid workspace package subpaths', async () => {
    resolve.mockResolvedValue({ id: '/workspace/packages/subpath-only/value.ts' });

    await expect(resolveId('@inner/subpath-only/value')).resolves.toEqual({
      id: '@inner/subpath-only/value',
      external: true,
    });
  });

  it('rejects unresolved workspace package subpaths', async () => {
    resolve.mockResolvedValue(null);

    await expect(resolveId('@inner/subpath-only/missing')).rejects.toThrow(
      'Could not resolve workspace package subpath "@inner/subpath-only/missing".',
    );
  });

  it('does not validate external subpaths outside the workspace', async () => {
    const mod = await import('./subpath-externals-resolver');
    plugin = mod.subpathExternalsResolver(['external-package']);

    await expect(resolveId('external-package/subpath')).resolves.toEqual({
      id: 'external-package/subpath',
      external: true,
    });
    expect(resolve).not.toHaveBeenCalled();
  });
});
