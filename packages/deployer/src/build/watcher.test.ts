import { join } from 'node:path';
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
vi.mock('node:fs', () => ({
  readdirSync: vi.fn().mockImplementation(() => {
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

    describe('workspace-file-watcher plugin', () => {
      it('adds workspace-file-watcher plugin to the plugin chain', async () => {
        const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;
        bundlerGetInputOptions.mockResolvedValueOnce({
          plugins: [{ name: 'esbuild' } satisfies Plugin],
        });

        const result = await getInputOptions('test-entry.js', 'node');

        const pluginNames = (result.plugins as Plugin[]).map(p => p.name);
        expect(pluginNames).toContain('workspace-file-watcher');
      });

      it('preserves alias-optimized-deps in the plugin chain', async () => {
        const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;
        bundlerGetInputOptions.mockResolvedValueOnce({
          plugins: [
            { name: 'alias-optimized-deps', resolveId: () => null } satisfies Plugin,
            { name: 'esbuild' } satisfies Plugin,
          ],
        });

        const result = await getInputOptions('test-entry.js', 'node');

        const pluginNames = (result.plugins as Plugin[]).map(p => p.name);
        expect(pluginNames).toContain('alias-optimized-deps');
        expect(pluginNames).toContain('workspace-file-watcher');
      });

      it('calls addWatchFile for source and dist files in buildStart', async () => {
        const { readdirSync } = await import('node:fs');
        vi.mocked(readdirSync).mockImplementation(((dir: string) => {
          if (dir === '/workspace/packages/core/src') {
            return [
              { name: 'index.ts', isDirectory: () => false },
              { name: 'utils.ts', isDirectory: () => false },
            ];
          }
          if (dir === '/workspace/packages/core/dist') {
            return [{ name: 'index.js', isDirectory: () => false }];
          }
          throw new Error('ENOENT');
        }) as typeof readdirSync);

        const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;
        bundlerGetInputOptions.mockResolvedValueOnce({
          plugins: [{ name: 'esbuild' } satisfies Plugin],
        });

        const result = await getInputOptions('test-entry.js', 'node');

        const watcher = (result.plugins as Plugin[]).find(p => p.name === 'workspace-file-watcher');
        expect(watcher).toBeDefined();

        const addWatchFile = vi.fn();
        (watcher!.buildStart as Function).call({ addWatchFile });

        expect(addWatchFile).toHaveBeenCalledWith(expect.stringContaining('/workspace/packages/core/src/index.ts'));
        expect(addWatchFile).toHaveBeenCalledWith(expect.stringContaining('/workspace/packages/core/src/utils.ts'));
        expect(addWatchFile).toHaveBeenCalledWith(expect.stringContaining('/workspace/packages/core/dist/index.js'));
        expect(addWatchFile).toHaveBeenCalledTimes(3);
      });

      it('recursively watches files in subdirectories', async () => {
        const { readdirSync } = await import('node:fs');
        vi.mocked(readdirSync).mockImplementation(((dir: string) => {
          if (dir === '/workspace/packages/core/src') {
            return [
              { name: 'index.ts', isDirectory: () => false },
              { name: 'utils', isDirectory: () => true },
            ];
          }
          if (dir === '/workspace/packages/core/src/utils') {
            return [{ name: 'helper.ts', isDirectory: () => false }];
          }
          throw new Error('ENOENT');
        }) as typeof readdirSync);

        const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;
        bundlerGetInputOptions.mockResolvedValueOnce({
          plugins: [{ name: 'esbuild' } satisfies Plugin],
        });

        const result = await getInputOptions('test-entry.js', 'node');

        const watcher = (result.plugins as Plugin[]).find(p => p.name === 'workspace-file-watcher');
        const addWatchFile = vi.fn();
        (watcher!.buildStart as Function).call({ addWatchFile });

        expect(addWatchFile).toHaveBeenCalledWith(expect.stringContaining('/workspace/packages/core/src/index.ts'));
        expect(addWatchFile).toHaveBeenCalledWith(
          expect.stringContaining(join('/workspace/packages/core/src/utils', 'helper.ts')),
        );
      });

      it('skips node_modules directories', async () => {
        const { readdirSync } = await import('node:fs');
        vi.mocked(readdirSync).mockImplementation(((dir: string) => {
          if (dir === '/workspace/packages/core/src') {
            return [
              { name: 'index.ts', isDirectory: () => false },
              { name: 'node_modules', isDirectory: () => true },
            ];
          }
          throw new Error('ENOENT');
        }) as typeof readdirSync);

        const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;
        bundlerGetInputOptions.mockResolvedValueOnce({
          plugins: [{ name: 'esbuild' } satisfies Plugin],
        });

        const result = await getInputOptions('test-entry.js', 'node');

        const watcher = (result.plugins as Plugin[]).find(p => p.name === 'workspace-file-watcher');
        const addWatchFile = vi.fn();
        (watcher!.buildStart as Function).call({ addWatchFile });

        expect(addWatchFile).toHaveBeenCalledTimes(1);
        expect(addWatchFile).toHaveBeenCalledWith(expect.stringContaining('index.ts'));
      });

      it('handles missing src and dist directories gracefully', async () => {
        const { readdirSync } = await import('node:fs');
        vi.mocked(readdirSync).mockImplementation(() => {
          throw new Error('ENOENT');
        });

        const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;
        bundlerGetInputOptions.mockResolvedValueOnce({
          plugins: [{ name: 'esbuild' } satisfies Plugin],
        });

        const result = await getInputOptions('test-entry.js', 'node');

        const watcher = (result.plugins as Plugin[]).find(p => p.name === 'workspace-file-watcher');
        const addWatchFile = vi.fn();
        (watcher!.buildStart as Function).call({ addWatchFile });

        expect(addWatchFile).not.toHaveBeenCalled();
      });

      it('ignores non-source files like .json and .md', async () => {
        const { readdirSync } = await import('node:fs');
        vi.mocked(readdirSync).mockImplementation(((dir: string) => {
          if (dir === '/workspace/packages/core/src') {
            return [
              { name: 'index.ts', isDirectory: () => false },
              { name: 'README.md', isDirectory: () => false },
              { name: 'config.json', isDirectory: () => false },
              { name: 'styles.css', isDirectory: () => false },
            ];
          }
          throw new Error('ENOENT');
        }) as typeof readdirSync);

        const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;
        bundlerGetInputOptions.mockResolvedValueOnce({
          plugins: [{ name: 'esbuild' } satisfies Plugin],
        });

        const result = await getInputOptions('test-entry.js', 'node');

        const watcher = (result.plugins as Plugin[]).find(p => p.name === 'workspace-file-watcher');
        const addWatchFile = vi.fn();
        (watcher!.buildStart as Function).call({ addWatchFile });

        expect(addWatchFile).toHaveBeenCalledTimes(1);
        expect(addWatchFile).toHaveBeenCalledWith(expect.stringContaining('index.ts'));
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
        expect(pluginNames).toContain('alias-optimized-deps');
        expect(pluginNames).toContain('esbuild');
        expect(pluginNames).toContain('workspace-file-watcher');
      });
    });
  });
});
