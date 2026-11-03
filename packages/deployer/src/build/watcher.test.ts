import { posix } from 'node:path';
import { watch } from 'rolldown';
import type { RolldownWatcher, RolldownWatcherEvent } from 'rolldown';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as BundlerModule from './bundler';
import { chunkFileNames } from './rolldown';
import { createWatcher, getInputOptions } from './watcher';

vi.mock('rolldown', async importOriginal => ({
  ...(await importOriginal<typeof import('rolldown')>()),
  watch: vi.fn(),
}));

// Mock bundler module at the top level
vi.mock('./bundler', () => ({
  getInputOptions: vi.fn().mockResolvedValue({ plugins: [] }),
}));
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(''),
}));
vi.mock('./analyze', () => ({
  analyzeBundleDeferringValidation: vi.fn().mockResolvedValue({
    validation: Promise.resolve(),
    dependencies: new Map([
      ['@mastra/core', 'packages/core/node_modules/.cache/@mastra__core.mjs'],
      ['lodash', 'node_modules/lodash/index.js'],
    ]),
    depsToOptimize: new Map([
      [
        '@mastra/core',
        {
          exports: ['Mastra'],
          rootPath: '/workspace/packages/core',
          isWorkspace: true,
        },
      ],
    ]),
    workspaceMap: new Map([
      ['@mastra/core', { location: '/workspace/packages/core', dependencies: {}, version: '1.0.0' }],
    ]),
    workspaceRoot: '/workspace',
    outputDir: '/workspace/.mastra/.build',
  }),
}));
vi.mock('./plugins/workspace-deps-watcher', () => ({
  workspaceDepsWatcher: vi.fn(() => ({ name: 'workspace-deps-watcher' })),
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
vi.mock('@internal/find-workspaces', () => ({
  findWorkspacesRoot: vi.fn().mockReturnValue({ location: '/workspace' }),
}));
vi.mock('empathic/package', () => ({
  up: vi.fn().mockReturnValue('/test/project/package.json'),
}));

describe('watcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getInputOptions', () => {
    it('writes analysis output to the provided outputDir', async () => {
      const analyzeBundle = vi.mocked(await import('./analyze')).analyzeBundleDeferringValidation;

      await getInputOptions('test-entry.js', 'node', undefined, { outputDir: '/custom/root/.mastra/.build' });

      expect(analyzeBundle).toHaveBeenCalledWith(
        ['test-entry.js'],
        'test-entry.js',
        expect.objectContaining({ outputDir: '/custom/root/.mastra/.build' }),
        expect.anything(),
      );
    });

    it('defaults analysis output to <cwd>/.mastra/.build', async () => {
      const analyzeBundle = vi.mocked(await import('./analyze')).analyzeBundleDeferringValidation;

      await getInputOptions('test-entry.js', 'node');

      expect(analyzeBundle).toHaveBeenCalledWith(
        ['test-entry.js'],
        'test-entry.js',
        expect.objectContaining({ outputDir: posix.join(process.cwd(), '.mastra', '.build') }),
        expect.anything(),
      );
    });

    it('should pass NODE_ENV to bundler when provided', async () => {
      // Arrange
      const env = { 'process.env.NODE_ENV': JSON.stringify('test') };
      const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;
      const analyzeBundle = vi.mocked(await import('./analyze')).analyzeBundleDeferringValidation;

      // Act
      await getInputOptions('test-entry.js', 'node', env);

      // Assert
      expect(analyzeBundle).toHaveBeenCalledWith(
        ['test-entry.js'],
        'test-entry.js',
        expect.objectContaining({ env }),
        expect.anything(),
      );
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

    it('installs workspace-deps-watcher when optimized workspace deps exist', async () => {
      const { workspaceDepsWatcher } = await import('./plugins/workspace-deps-watcher');
      const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;
      bundlerGetInputOptions.mockResolvedValueOnce({ plugins: [] });

      const inputOptions = await getInputOptions('test-entry.js', 'node');

      expect(workspaceDepsWatcher).toHaveBeenCalledWith(
        expect.objectContaining({
          depsToOptimize: expect.any(Map),
          optimizedDependencyFiles: expect.any(Map),
          workspaceRoot: '/workspace',
          platform: 'node',
        }),
      );
      expect(
        (inputOptions.plugins as { name?: string }[]).some(plugin => plugin.name === 'workspace-deps-watcher'),
      ).toBe(true);
    });

    it('uses the dev pipeline built by the bundler without swapping plugins', async () => {
      const actualBundler = await vi.importActual<typeof BundlerModule>('./bundler');
      const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;
      bundlerGetInputOptions.mockImplementationOnce(actualBundler.getInputOptions);

      const inputOptions = await getInputOptions('test-entry.js', 'node');
      const pluginNames = (inputOptions.plugins as { name?: string }[]).map(plugin => plugin.name);

      expect(pluginNames).toEqual(
        expect.arrayContaining(['tsconfig-paths', 'hono-alias', 'node-modules-externals', 'workspace-deps-watcher']),
      );
      expect(pluginNames.filter(name => name === 'tsconfig-paths')).toHaveLength(1);
      expect(pluginNames.filter(name => name === 'hono-alias')).toHaveLength(1);
    });
  });

  describe('createWatcher', () => {
    type WatchBuild = Extract<RolldownWatcherEvent, { code: 'BUNDLE_END' }>['result'];

    function mockBuild() {
      const close = vi.fn().mockResolvedValue(undefined);
      return Object.assign({ close } as unknown as WatchBuild, { close });
    }

    function mockWatch() {
      const listeners: Array<(event: RolldownWatcherEvent) => unknown> = [];
      const watcher = {
        on: vi.fn((name: string, listener: (event: RolldownWatcherEvent) => unknown) => {
          if (name === 'event') {
            listeners.push(listener);
          }
          return watcher;
        }),
      };
      vi.mocked(watch).mockReturnValue(watcher as unknown as RolldownWatcher);

      return {
        emit: async (event: RolldownWatcherEvent) => {
          for (const listener of listeners) {
            await listener(event);
          }
        },
      };
    }

    it('writes ESM output with .mjs file names', async () => {
      mockWatch();

      await createWatcher({ input: 'entry.js' }, { dir: '/out' });

      expect(watch).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'entry.js',
          output: expect.objectContaining({
            dir: '/out',
            format: 'esm',
            entryFileNames: '[name].mjs',
            chunkFileNames,
          }),
        }),
      );
    });

    it('closes the build result on BUNDLE_END and ERROR so Rolldown can release the build', async () => {
      const { emit } = mockWatch();
      await createWatcher({ input: 'entry.js' }, { dir: '/out' });

      const bundleEndResult = mockBuild();
      await emit({ code: 'BUNDLE_END', duration: 1, output: ['/out'], result: bundleEndResult });
      expect(bundleEndResult.close).toHaveBeenCalledTimes(1);

      const errorResult = mockBuild();
      await emit({ code: 'ERROR', error: new Error('boom'), result: errorResult });
      expect(errorResult.close).toHaveBeenCalledTimes(1);

      await expect(emit({ code: 'START' })).resolves.toBeUndefined();
    });
  });
});
