import type { BundlerEngine, BundlerEngineOptions, BundlerEngineOutput } from '@mastra/core/bundler';

/**
 * Configuration options for the Bun bundler engine.
 */
export interface BunBundlerEngineConfig {
  /**
   * Whether to minify the output.
   * @default true
   */
  minify?: boolean;

  /**
   * Target environment for the bundle.
   * @default 'bun'
   */
  target?: 'bun' | 'node' | 'browser';

  /**
   * Additional packages to mark as external (in addition to those passed via options).
   */
  external?: string[];

  /**
   * Enable splitting for code splitting.
   * @default true
   */
  splitting?: boolean;
}

/**
 * Bun-based bundler engine for Mastra.
 *
 * This engine uses Bun's native bundler for fast, efficient bundling.
 * It requires Bun to be installed and available in the environment.
 *
 * @example
 * ```typescript
 * import { Mastra } from '@mastra/core';
 * import { BunBundlerEngine } from '@mastra/bundler-bun';
 *
 * export const mastra = new Mastra({
 *   agents: { myAgent },
 *   bundler: {
 *     engine: new BunBundlerEngine(),
 *   },
 * });
 * ```
 *
 * @example With configuration
 * ```typescript
 * import { BunBundlerEngine } from '@mastra/bundler-bun';
 *
 * const engine = new BunBundlerEngine({
 *   minify: true,
 *   target: 'bun',
 *   splitting: true,
 * });
 * ```
 */
export class BunBundlerEngine implements BundlerEngine {
  readonly name = 'bun';

  private config: BunBundlerEngineConfig;

  constructor(config: BunBundlerEngineConfig = {}) {
    this.config = {
      minify: true,
      target: 'bun',
      splitting: true,
      ...config,
    };
  }

  async bundle(options: BundlerEngineOptions): Promise<BundlerEngineOutput> {
    // Check if Bun is available
    if (typeof globalThis.Bun === 'undefined') {
      throw new Error(
        'BunBundlerEngine requires Bun runtime. ' +
          'Please run with Bun or install Bun: https://bun.sh\n' +
          'If you want to use Rollup instead, remove the engine option from your bundler config.',
      );
    }

    const entrypoints = Object.values(options.input);

    // Merge external dependencies
    const external = [...options.external, ...(this.config.external || [])];

    // Store the build result for writing
    let buildResult: Awaited<ReturnType<typeof Bun.build>> | undefined;

    return {
      write: async () => {
        buildResult = await Bun.build({
          entrypoints,
          outdir: options.outputDir,
          target: this.config.target,
          minify: this.config.minify,
          splitting: this.config.splitting,
          sourcemap: options.sourcemap ? 'external' : 'none',
          external,
          define: options.define,
          naming: {
            // Match Rollup's output naming convention
            entry: '[dir]/[name].mjs',
            chunk: '[name]-[hash].mjs',
          },
        });

        if (!buildResult.success) {
          const errors = buildResult.logs
            .filter(log => log.level === 'error')
            .map(log => log.message)
            .join('\n');

          throw new Error(`Bun bundler failed:\n${errors}`);
        }

        return buildResult;
      },
      close: async () => {
        // Bun.build doesn't require explicit cleanup
        buildResult = undefined;
      },
    };
  }
}

/**
 * Create a Bun bundler engine with the given configuration.
 * This is a convenience function for creating a BunBundlerEngine instance.
 *
 * @example
 * ```typescript
 * import { createBunEngine } from '@mastra/bundler-bun';
 *
 * export const mastra = new Mastra({
 *   bundler: {
 *     engine: createBunEngine({ minify: true }),
 *   },
 * });
 * ```
 */
export function createBunEngine(config?: BunBundlerEngineConfig): BunBundlerEngine {
  return new BunBundlerEngine(config);
}

// Re-export types for convenience
export type { BundlerEngine, BundlerEngineOptions, BundlerEngineOutput } from '@mastra/core/bundler';
