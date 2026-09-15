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
vi.mock('find-workspaces', () => ({
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
        inputOptions.plugins?.some(plugin => (plugin as { name?: string })?.name === 'workspace-deps-watcher'),
      ).toBe(true);
    });
  });
});
