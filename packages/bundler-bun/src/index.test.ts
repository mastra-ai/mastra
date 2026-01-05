import { describe, it, expect } from 'vitest';
import { BunBundlerEngine, createBunEngine } from './index';
import type { BundlerEngineOptions } from '@mastra/core/bundler';

describe('BunBundlerEngine', () => {
  it('should have the correct name', () => {
    const engine = new BunBundlerEngine();
    expect(engine.name).toBe('bun');
  });

  it('should be creatable with default config', () => {
    const engine = new BunBundlerEngine();
    expect(engine).toBeInstanceOf(BunBundlerEngine);
  });

  it('should be creatable with custom config', () => {
    const engine = new BunBundlerEngine({
      minify: false,
      target: 'node',
      splitting: false,
      external: ['sharp'],
    });
    expect(engine).toBeInstanceOf(BunBundlerEngine);
  });

  it('should throw error when Bun is not available', async () => {
    const engine = new BunBundlerEngine();
    const options: BundlerEngineOptions = {
      input: { index: '/tmp/test-entry.ts' },
      outputDir: '/tmp/test-output',
      external: [],
      sourcemap: false,
      platform: 'node',
    };

    // Since we're running in Node.js (not Bun), this should throw
    await expect(engine.bundle(options)).rejects.toThrow('BunBundlerEngine requires Bun runtime');
  });
});

describe('createBunEngine', () => {
  it('should create a BunBundlerEngine instance', () => {
    const engine = createBunEngine();
    expect(engine).toBeInstanceOf(BunBundlerEngine);
    expect(engine.name).toBe('bun');
  });

  it('should pass config to the engine', () => {
    const engine = createBunEngine({
      minify: true,
      target: 'bun',
    });
    expect(engine).toBeInstanceOf(BunBundlerEngine);
  });
});
