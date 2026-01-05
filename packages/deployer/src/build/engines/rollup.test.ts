import { describe, it, expect, vi } from 'vitest';
import { RollupBundlerEngine, createRollupEngine } from './rollup';
import type { BundlerEngineOptions } from '@mastra/core/bundler';

describe('RollupBundlerEngine', () => {
  it('should have the correct name', () => {
    const engine = new RollupBundlerEngine();
    expect(engine.name).toBe('rollup');
  });

  it('should be creatable with default config', () => {
    const engine = new RollupBundlerEngine();
    expect(engine).toBeInstanceOf(RollupBundlerEngine);
  });

  it('should be creatable with custom config', () => {
    const engine = new RollupBundlerEngine({
      inputOptions: { logLevel: 'debug' },
      outputOptions: { format: 'cjs' },
    });
    expect(engine).toBeInstanceOf(RollupBundlerEngine);
  });

  it('should return a bundle output with write and close methods', async () => {
    const engine = new RollupBundlerEngine();
    const options: BundlerEngineOptions = {
      input: { index: '/tmp/test-entry.ts' },
      outputDir: '/tmp/test-output',
      external: [],
      sourcemap: false,
      platform: 'node',
    };

    const output = await engine.bundle(options);
    expect(output).toHaveProperty('write');
    expect(output).toHaveProperty('close');
    expect(typeof output.write).toBe('function');
    expect(typeof output.close).toBe('function');
  });
});

describe('createRollupEngine', () => {
  it('should create a RollupBundlerEngine instance', () => {
    const engine = createRollupEngine();
    expect(engine).toBeInstanceOf(RollupBundlerEngine);
    expect(engine.name).toBe('rollup');
  });

  it('should pass config to the engine', () => {
    const engine = createRollupEngine({
      inputOptions: { treeshake: false },
    });
    expect(engine).toBeInstanceOf(RollupBundlerEngine);
  });
});
