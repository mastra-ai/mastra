import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import originalEsbuild from 'rollup-plugin-esbuild';
import { esbuild } from './esbuild';

// Mock rollup-plugin-esbuild to capture the options passed to it
vi.mock('rollup-plugin-esbuild', () => ({
  default: vi.fn(options => ({ name: 'esbuild', options })),
}));

describe('esbuild plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use node as the default platform', () => {
    esbuild();

    expect(originalEsbuild).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'node',
        target: 'node20',
      }),
    );
  });

  it('should allow platform to be overridden via options', () => {
    // This test demonstrates that the esbuild wrapper DOES support overriding platform
    // The issue is that callers never pass a different platform
    esbuild({ platform: 'browser' });

    expect(originalEsbuild).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'browser', // This should work because ...options comes after defaults
      }),
    );
  });

  it('should allow target to be overridden via options', () => {
    esbuild({ target: 'esnext' });

    expect(originalEsbuild).toHaveBeenCalledWith(
      expect.objectContaining({
        target: 'esnext',
      }),
    );
  });

  /**
   * This test suite documents the bug reported in GitHub issue #11253:
   * "Bun S3 API's not working inside Mastra Workflows"
   *
   * When running under Bun runtime, the bundler should detect this and use
   * appropriate platform settings so that Bun-specific globals (like Bun.s3)
   * are available when workflow steps execute.
   *
   * Currently, the platform is hardcoded to 'node' in multiple places:
   * - packages/deployer/src/build/plugins/esbuild.ts (default 'node')
   * - packages/cli/src/commands/dev/DevBundler.ts (hardcoded 'node')
   * - packages/deployer/src/bundler/index.ts (hardcoded 'node')
   * - packages/deployer/src/build/watcher.ts (hardcoded 'node')
   */
  describe('Bun runtime support (GitHub issue #11253)', () => {
    const originalGlobalBun = (globalThis as any).Bun;

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

    it('should detect Bun runtime and allow platform to be set appropriately', () => {
      // Simulate Bun runtime environment
      (globalThis as any).Bun = { version: '1.0.0' };

      // The esbuild plugin itself allows platform override - this works
      esbuild({ platform: 'neutral' }); // 'neutral' is more appropriate for Bun

      expect(originalEsbuild).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'neutral',
        }),
      );
    });

    /**
     * This test documents that while runtime detection IS possible,
     * the Mastra bundler infrastructure does not implement or use it.
     *
     * The fix should:
     * 1. Add a runtime detection utility
     * 2. Modify DevBundler, Bundler, and watcher to use the detected runtime
     *    instead of hardcoding 'node'
     * 3. When running under Bun, use platform 'neutral' or adjust settings
     *    to preserve Bun-specific globals
     */
    it('demonstrates runtime detection is possible but not implemented in bundler', () => {
      // Simulate Bun runtime environment
      (globalThis as any).Bun = { version: '1.0.0' };

      // Runtime detection IS possible (this works)
      const isBunRuntime = typeof (globalThis as any).Bun !== 'undefined';
      expect(isBunRuntime).toBe(true);

      // However, the esbuild plugin defaults to 'node' with no awareness of runtime
      // This is the root cause of issue #11253
      esbuild(); // Called without options - uses defaults

      expect(originalEsbuild).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'node', // Still 'node' even when running under Bun!
          target: 'node20', // Still targeting node20!
        }),
      );

      // NOTE: The actual fix needs to happen in the callers (DevBundler, etc.)
      // They should detect the runtime and pass appropriate platform options
    });

    /**
     * Integration test placeholder - this test would fail if we had a utility
     * function that the bundler could use to detect runtime.
     *
     * When fixing this issue, a utility like `detectRuntime()` should be added
     * to the codebase and used by DevBundler and Bundler.
     */
    it.skip('TODO: bundler should use detectRuntime utility (not yet implemented)', async () => {
      // This test is skipped because detectRuntime doesn't exist yet
      // Once implemented, this test should:
      // 1. Mock the Bun global
      // 2. Import detectRuntime from the new utility location
      // 3. Verify it returns 'bun' when Bun global is present
      // 4. Verify DevBundler uses this detection
    });
  });
});
