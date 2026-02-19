import type { Plugin } from 'rollup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInputOptions } from './watcher';

// Mock bundler module at the top level
vi.mock('./bundler', () => ({
  getInputOptions: vi.fn().mockResolvedValue({ plugins: [] }),
}));
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(''),
}));
vi.mock('./analyze', () => ({
  analyzeBundle: vi.fn().mockResolvedValue({
    dependencies: new Map([
      ['@mastra/core', { exports: ['Mastra'], rootPath: '/workspace/packages/core', isWorkspace: true }],
      ['lodash', { exports: ['map'], rootPath: '/node_modules/lodash', isWorkspace: false }],
    ]),
  }),
}));
vi.mock('../bundler/workspaceDependencies', () => ({
  getWorkspaceInformation: vi.fn().mockResolvedValue({
    workspaceMap: new Map([
      ['@mastra/core', { location: '/workspace/packages/core', dependencies: {}, version: '1.0.0' }],
    ]),
    workspaceRoot: '/workspace',
    isWorkspacePackage: true,
  }),
}));
vi.mock('find-workspaces', () => ({
  findWorkspacesRoot: vi.fn().mockReturnValue({ location: '/workspace' }),
}));
vi.mock('empathic/package', () => ({
  up: vi.fn().mockReturnValue('/test/project/package.json'),
}));
vi.mock('local-pkg', () => ({
  resolveModule: vi.fn(),
}));
vi.mock('node:fs', () => ({
  readFileSync: vi.fn().mockImplementation(() => {
    throw new Error('ENOENT');
  }),
}));

describe('watcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getInputOptions', () => {
    it('should pass NODE_ENV to bundler when provided', async () => {
      // Arrange
      const env = { 'process.env.NODE_ENV': JSON.stringify('test') };
      const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;

      // Act
      await getInputOptions('test-entry.js', 'node', env);

      // Assert
      expect(bundlerGetInputOptions).toHaveBeenCalledWith(
        // expect.stringMatching(/\.mastra\/\.build\/entry-0\.mjs$/),
        expect.stringMatching('test-entry.js'),
        expect.objectContaining({
          dependencies: expect.any(Map),
          externalDependencies: expect.any(Map),
          workspaceMap: expect.any(Map),
        }),
        'node',
        env,
        expect.objectContaining({
          isDev: true,
          sourcemap: false,
          workspaceRoot: '/workspace',
          projectRoot: expect.any(String),
        }),
      );
    });

    it('should not pass NODE_ENV to bundler when not provided', async () => {
      // Act
      await getInputOptions('test-entry.js', 'node');
      const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;

      // Assert
      expect(bundlerGetInputOptions).toHaveBeenCalledWith(
        // expect.stringMatching(/\.mastra\/\.build\/entry-0\.mjs$/),
        expect.stringMatching('test-entry.js'),
        expect.objectContaining({
          dependencies: expect.any(Map),
          externalDependencies: expect.any(Map),
          workspaceMap: expect.any(Map),
        }),
        'node',
        undefined,
        expect.objectContaining({
          isDev: true,
          sourcemap: false,
          workspaceRoot: '/workspace',
          projectRoot: expect.any(String),
        }),
      );
    });

    describe('platform parameter handling', () => {
      it('forwards "node" platform to bundler', async () => {
        const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;

        await getInputOptions('test-entry.js', 'node');

        expect(bundlerGetInputOptions).toHaveBeenCalledWith(
          expect.stringMatching('test-entry.js'),
          expect.objectContaining({
            dependencies: expect.any(Map),
            externalDependencies: expect.any(Map),
            workspaceMap: expect.any(Map),
          }),
          'node',
          undefined,
          expect.objectContaining({
            isDev: true,
          }),
        );
      });

      it('forwards "neutral" platform to bundler for Bun runtime support', async () => {
        // When running under Bun, callers should pass 'neutral' to preserve
        // Bun-specific globals (like Bun.s3). The watcher correctly forwards
        // whatever platform value is passed to it.
        const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;

        await getInputOptions('test-entry.js', 'neutral');

        expect(bundlerGetInputOptions).toHaveBeenCalledWith(
          expect.stringMatching('test-entry.js'),
          expect.objectContaining({
            dependencies: expect.any(Map),
            externalDependencies: expect.any(Map),
            workspaceMap: expect.any(Map),
          }),
          'neutral',
          undefined,
          expect.objectContaining({
            isDev: true,
          }),
        );
      });
    });

    describe('workspace-source-resolver plugin', () => {
      it('replaces alias-optimized-deps with workspace-source-resolver', async () => {
        const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;
        bundlerGetInputOptions.mockResolvedValueOnce({
          plugins: [
            { name: 'alias-optimized-deps', resolveId: () => null } satisfies Plugin,
            { name: 'esbuild' } satisfies Plugin,
          ],
        });

        const result = await getInputOptions('test-entry.js', 'node');

        const pluginNames = (result.plugins as Plugin[]).map(p => p.name);
        expect(pluginNames).toContain('workspace-source-resolver');
        expect(pluginNames).not.toContain('alias-optimized-deps');
      });

      it('prefers "source" field from package.json over resolveModule', async () => {
        const { readFileSync } = await import('node:fs');
        vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ source: './src/index.ts' }));

        const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;
        bundlerGetInputOptions.mockResolvedValueOnce({
          plugins: [{ name: 'alias-optimized-deps', resolveId: () => null } satisfies Plugin],
        });

        const result = await getInputOptions('test-entry.js', 'node');

        const resolver = (result.plugins as Plugin[]).find(p => p.name === 'workspace-source-resolver');
        expect(resolver).toBeDefined();

        const resolved = (resolver!.resolveId as Function).call(null, '@mastra/core');
        expect(resolved).toEqual({ id: '/workspace/packages/core/src/index.ts', external: false });
      });

      it('falls back to resolveModule when no "source" field exists', async () => {
        const { readFileSync } = await import('node:fs');
        vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ main: './dist/index.js' }));

        const { resolveModule } = await import('local-pkg');
        vi.mocked(resolveModule).mockReturnValue('/workspace/packages/core/dist/index.js');

        const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;
        bundlerGetInputOptions.mockResolvedValueOnce({
          plugins: [{ name: 'alias-optimized-deps', resolveId: () => null } satisfies Plugin],
        });

        const result = await getInputOptions('test-entry.js', 'node');

        const resolver = (result.plugins as Plugin[]).find(p => p.name === 'workspace-source-resolver');
        const resolved = (resolver!.resolveId as Function).call(null, '@mastra/core');
        expect(resolved).toEqual({ id: '/workspace/packages/core/dist/index.js', external: false });
      });

      it('falls back to resolveModule for subpath imports even when "source" field exists', async () => {
        const { readFileSync } = await import('node:fs');
        vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ source: './src/index.ts' }));

        const { resolveModule } = await import('local-pkg');
        vi.mocked(resolveModule).mockReturnValue('/workspace/packages/core/src/utils.ts');

        const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;
        bundlerGetInputOptions.mockResolvedValueOnce({
          plugins: [{ name: 'alias-optimized-deps', resolveId: () => null } satisfies Plugin],
        });

        const result = await getInputOptions('test-entry.js', 'node');

        const resolver = (result.plugins as Plugin[]).find(p => p.name === 'workspace-source-resolver');
        // Subpath import — "source" field only applies to bare package name
        const resolved = (resolver!.resolveId as Function).call(null, '@mastra/core/utils');
        expect(resolved).toEqual({ id: '/workspace/packages/core/src/utils.ts', external: false });
      });

      it('returns null for non-workspace imports', async () => {
        const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;
        bundlerGetInputOptions.mockResolvedValueOnce({
          plugins: [{ name: 'alias-optimized-deps', resolveId: () => null } satisfies Plugin],
        });

        const result = await getInputOptions('test-entry.js', 'node');

        const resolver = (result.plugins as Plugin[]).find(p => p.name === 'workspace-source-resolver');
        expect(resolver).toBeDefined();

        // lodash is not in the workspaceMap, so should return null
        const resolved = (resolver!.resolveId as Function).call(null, 'lodash');
        expect(resolved).toBeNull();
      });

      it('returns null when resolveModule cannot resolve the import', async () => {
        const { readFileSync } = await import('node:fs');
        vi.mocked(readFileSync).mockImplementation(() => {
          throw new Error('ENOENT');
        });

        const { resolveModule } = await import('local-pkg');
        vi.mocked(resolveModule).mockReturnValue(undefined);

        const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;
        bundlerGetInputOptions.mockResolvedValueOnce({
          plugins: [{ name: 'alias-optimized-deps', resolveId: () => null } satisfies Plugin],
        });

        const result = await getInputOptions('test-entry.js', 'node');

        const resolver = (result.plugins as Plugin[]).find(p => p.name === 'workspace-source-resolver');
        const resolved = (resolver!.resolveId as Function).call(null, '@mastra/core');
        expect(resolved).toBeNull();
      });

      it('preserves other plugins in the chain', async () => {
        const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;
        bundlerGetInputOptions.mockResolvedValueOnce({
          plugins: [
            { name: 'some-other-plugin' } satisfies Plugin,
            { name: 'alias-optimized-deps', resolveId: () => null } satisfies Plugin,
            { name: 'esbuild' } satisfies Plugin,
          ],
        });

        const result = await getInputOptions('test-entry.js', 'node');

        const pluginNames = (result.plugins as Plugin[]).map(p => p.name);
        expect(pluginNames).toContain('some-other-plugin');
        expect(pluginNames).toContain('workspace-source-resolver');
        expect(pluginNames).toContain('esbuild');
      });
    });
  });
});
