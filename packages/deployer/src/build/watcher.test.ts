import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInputOptions } from './watcher';

// Mock bundler module at the top level
vi.mock('./bundler', () => ({
  getInputOptions: vi.fn().mockResolvedValue({ plugins: [] }),
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
    it('should skip bundle analysis in dev mode (#12843)', async () => {
      const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;
      await getInputOptions('test-entry.js', 'node');
      expect(bundlerGetInputOptions).toHaveBeenCalled();
    });

    it('should pass empty dependencies to bundler', async () => {
      const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;

      await getInputOptions('test-entry.js', 'node');

      expect(bundlerGetInputOptions).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          dependencies: new Map(),
          externalDependencies: new Map(),
          workspaceMap: expect.any(Map),
        }),
        'node',
        undefined,
        expect.objectContaining({
          isDev: true,
        }),
      );
    });

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
  });
});
