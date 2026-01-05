/**
 * Output handle returned by a bundler engine after preparing a bundle.
 * Call `write()` to emit the bundle to disk, then `close()` to clean up resources.
 */
export interface BundlerEngineOutput {
  /**
   * Write the bundle output to disk.
   */
  write(): Promise<unknown>;
  /**
   * Close the bundler and release any resources.
   */
  close(): Promise<void>;
}

/**
 * Options passed to a bundler engine when creating a bundle.
 */
export interface BundlerEngineOptions {
  /**
   * Entry points for the bundle. Keys are output names, values are file paths.
   * @example { index: './src/index.ts', 'tools/weather': './src/tools/weather.ts' }
   */
  input: Record<string, string>;
  /**
   * Directory where bundled output files will be written.
   */
  outputDir: string;
  /**
   * Dependencies to exclude from the bundle (treated as external imports).
   */
  external: string[];
  /**
   * Whether to generate source maps.
   */
  sourcemap: boolean;
  /**
   * Target platform for the bundle.
   */
  platform: 'node' | 'browser';
  /**
   * Compile-time constants to define (e.g., process.env.NODE_ENV).
   */
  define?: Record<string, string>;
  /**
   * Manual chunk configuration for code splitting.
   */
  manualChunks?: Record<string, string[]>;
}

/**
 * Interface for bundler engines that can be used with Mastra.
 *
 * Implement this interface to create a custom bundler engine (e.g., using Bun, esbuild, etc.).
 *
 * @example
 * ```typescript
 * import { BundlerEngine } from '@mastra/core/bundler';
 *
 * class MyCustomEngine implements BundlerEngine {
 *   name = 'my-custom-bundler';
 *
 *   async bundle(options) {
 *     // Custom bundling logic
 *     return {
 *       write: async () => { ... },
 *       close: async () => { ... },
 *     };
 *   }
 * }
 * ```
 */
export interface BundlerEngine {
  /**
   * Human-readable name of the bundler engine (for logging).
   */
  readonly name: string;

  /**
   * Create a bundle with the given options.
   * @param options - Configuration for the bundle
   * @returns A handle to write and close the bundle
   */
  bundle(options: BundlerEngineOptions): Promise<BundlerEngineOutput>;
}

export type BundlerConfig = {
  /**
   * The bundler engine to use for packaging the application.
   *
   * By default, Mastra uses Rollup. You can pass a custom engine to use
   * a different bundler like Bun or esbuild.
   *
   * @example
   * ```typescript
   * import { BunBundlerEngine } from '@mastra/bundler-bun';
   *
   * new Mastra({
   *   bundler: {
   *     engine: new BunBundlerEngine(),
   *   },
   * });
   * ```
   */
  engine?: BundlerEngine;

  /**
   * Controls which dependencies are excluded from the bundle and installed separately.
   * - `true`: Excludes all non-workspace packages from bundling
   * - `string[]`: Specifies custom packages to exclude (merged with global externals like 'pino', 'pg', '@libsql/client')
   */
  externals?: boolean | string[];
  /**
   * Enables source map generation for debugging bundled code.
   * Generates `.mjs.map` files alongside bundled output.
   */
  sourcemap?: boolean;
  /**
   * Packages requiring TypeScript/modern JS transpilation during bundling.
   * Automatically includes workspace packages.
   */
  transpilePackages?: string[];

  [key: symbol]: boolean | undefined;
};
