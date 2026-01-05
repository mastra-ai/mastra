import type { BundlerEngine, BundlerEngineOptions, BundlerEngineOutput } from '@mastra/core/bundler';
import { rollup, type InputOptions, type OutputOptions, type RollupBuild } from 'rollup';

/**
 * Configuration options for the Rollup bundler engine.
 */
export interface RollupBundlerEngineConfig {
  /**
   * Additional Rollup input options to merge with defaults.
   */
  inputOptions?: Partial<InputOptions>;
  /**
   * Additional Rollup output options to merge with defaults.
   */
  outputOptions?: Partial<OutputOptions>;
}

/**
 * Rollup-based bundler engine for Mastra.
 *
 * This is the default bundler engine used by Mastra. It provides full tree-shaking,
 * code splitting, and plugin support through Rollup.
 *
 * @example
 * ```typescript
 * import { RollupBundlerEngine } from '@mastra/deployer/engines';
 *
 * new Mastra({
 *   bundler: {
 *     engine: new RollupBundlerEngine(),
 *   },
 * });
 * ```
 */
export class RollupBundlerEngine implements BundlerEngine {
  readonly name = 'rollup';

  private config: RollupBundlerEngineConfig;

  constructor(config: RollupBundlerEngineConfig = {}) {
    this.config = config;
  }

  async bundle(options: BundlerEngineOptions): Promise<BundlerEngineOutput> {
    const inputOptions: InputOptions = {
      input: options.input,
      external: options.external,
      treeshake: 'smallest',
      preserveSymlinks: true,
      logLevel: process.env.MASTRA_BUNDLER_DEBUG === 'true' ? 'debug' : 'silent',
      ...this.config.inputOptions,
    };

    const outputOptions: OutputOptions = {
      dir: options.outputDir,
      format: 'esm',
      entryFileNames: '[name].mjs',
      chunkFileNames: '[name].mjs',
      sourcemap: options.sourcemap,
      manualChunks: options.manualChunks,
      ...this.config.outputOptions,
    };

    let bundler: RollupBuild | undefined;

    return {
      write: async () => {
        bundler = await rollup(inputOptions);
        return bundler.write(outputOptions);
      },
      close: async () => {
        if (bundler) {
          await bundler.close();
        }
      },
    };
  }
}

/**
 * Create a Rollup bundler engine with the given configuration.
 * This is a convenience function for creating a RollupBundlerEngine instance.
 */
export function createRollupEngine(config?: RollupBundlerEngineConfig): RollupBundlerEngine {
  return new RollupBundlerEngine(config);
}
