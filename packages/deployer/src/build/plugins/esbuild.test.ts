import { describe, it, expect, vi, beforeEach } from 'vitest';
import originalEsbuild from 'rollup-plugin-esbuild';
import { esbuild } from './esbuild';

// Mock rollup-plugin-esbuild to capture the options passed to it
vi.mock('rollup-plugin-esbuild', () => ({
  default: vi.fn(options => ({ name: 'esbuild', options })),
}));

/**
 * Tests for the esbuild plugin wrapper.
 *
 * This wrapper provides sensible defaults for the esbuild rollup plugin.
 * Runtime detection and platform selection is handled by callers using
 * getEsbuildPlatform() from utils.ts (tested in utils.test.ts).
 */
describe('esbuild plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use node20 as the default target', () => {
    esbuild();

    expect(originalEsbuild).toHaveBeenCalledWith(
      expect.objectContaining({
        target: 'node20',
      }),
    );
  });

  it('should use node as the default platform', () => {
    esbuild();

    expect(originalEsbuild).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'node',
      }),
    );
  });

  it('should disable minification by default', () => {
    esbuild();

    expect(originalEsbuild).toHaveBeenCalledWith(
      expect.objectContaining({
        minify: false,
      }),
    );
  });

  it('should allow options to be overridden', () => {
    esbuild({ platform: 'neutral', target: 'esnext', minify: true });

    expect(originalEsbuild).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'neutral',
        target: 'esnext',
        minify: true,
      }),
    );
  });
});
