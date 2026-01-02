import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Store original Bun global for restoration
const originalGlobalBun = (globalThis as any).Bun;

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
          externalDependencies: expect.any(Set),
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
          externalDependencies: expect.any(Set),
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

    /**
     * GitHub Issue #11253: Bun S3 API's not working inside Mastra Workflows
     *
     * This test documents the bug where the platform is always hardcoded to 'node'
     * even when running under the Bun runtime. This causes Bun-specific globals
     * (like Bun.s3) to not be available when workflow steps execute.
     *
     * The analyzeBundle call in watcher.ts hardcodes platform: 'node':
     *
     *   const analyzeEntryResult = await analyzeBundle(
     *     [entryFile],
     *     entryFile,
     *     {
     *       outputDir: posix.join(process.cwd(), '.mastra', '.build'),
     *       projectRoot: workspaceRoot || process.cwd(),
     *       platform: 'node',  // <-- HARDCODED!
     *       isDev: true,
     *     },
     *     noopLogger,
     *   );
     */
    describe('Bun runtime support (GitHub issue #11253)', () => {
      beforeEach(() => {
        // Clean up Bun global before each test
        delete (globalThis as any).Bun;
      });

      afterEach(() => {
        // Restore original Bun global
        if (originalGlobalBun) {
          (globalThis as any).Bun = originalGlobalBun;
        } else {
          delete (globalThis as any).Bun;
        }
      });

      it('documents that platform is always passed as "node" regardless of runtime', async () => {
        // Simulate Bun runtime environment
        (globalThis as any).Bun = { version: '1.0.0' };

        const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;

        // Call getInputOptions - even though we're "running in Bun",
        // it will still use 'node' as the platform
        await getInputOptions('test-entry.js', 'node');

        // This assertion documents the current (buggy) behavior:
        // The platform is always 'node', even when Bun runtime is detected
        expect(bundlerGetInputOptions).toHaveBeenCalledWith(
          expect.stringMatching('test-entry.js'),
          expect.objectContaining({
            dependencies: expect.any(Map),
            externalDependencies: expect.any(Set),
            workspaceMap: expect.any(Map),
          }),
          'node', // <-- This is always 'node', never 'bun' or 'neutral'
          undefined, // env not passed
          expect.objectContaining({
            isDev: true,
          }),
        );
      });

      /**
       * This test documents the architectural limitation:
       *
       * The watcher's getInputOptions function ACCEPTS a platform parameter,
       * but the CALLERS (like DevBundler) always pass 'node' as a hardcoded value.
       *
       * The fix should be in the callers (DevBundler, Bundler) to:
       * 1. Detect if running under Bun runtime
       * 2. Pass an appropriate platform (e.g., 'neutral' or 'bun') instead of hardcoded 'node'
       *
       * See DevBundler.ts line 70:
       *   const inputOptions = await getWatcherInputOptions(
       *     entryFile,
       *     'node',  // <-- This should be dynamically determined based on runtime
       *     ...
       *   );
       */
      it('confirms the platform parameter is caller-controlled (fix needed in DevBundler)', async () => {
        // Simulate Bun runtime environment
        (globalThis as any).Bun = { version: '1.0.0' };

        const bundlerGetInputOptions = vi.mocked(await import('./bundler')).getInputOptions;

        // The watcher function accepts platform as a parameter - it works correctly.
        // The bug is that DevBundler ALWAYS passes 'node' as the platform,
        // even when running under Bun.

        // Simulating what DevBundler does (hardcoded 'node'):
        await getInputOptions('test-entry.js', 'node');

        // The bundler receives 'node' because that's what the caller passed
        expect(bundlerGetInputOptions).toHaveBeenCalledWith(
          expect.stringMatching('test-entry.js'),
          expect.objectContaining({
            dependencies: expect.any(Map),
          }),
          'node', // DevBundler always passes this, even under Bun!
          undefined,
          expect.objectContaining({
            isDev: true,
          }),
        );

        // Clear and test with 'neutral' - this would work if DevBundler detected Bun
        vi.clearAllMocks();
        await getInputOptions('test-entry.js', 'neutral'); // If we passed 'neutral'

        expect(bundlerGetInputOptions).toHaveBeenCalledWith(
          expect.stringMatching('test-entry.js'),
          expect.objectContaining({
            dependencies: expect.any(Map),
          }),
          'neutral', // This would preserve Bun globals
          undefined,
          expect.objectContaining({
            isDev: true,
          }),
        );
      });
    });
  });
});
