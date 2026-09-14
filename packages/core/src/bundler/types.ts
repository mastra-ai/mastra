/** Dependency handling and output settings for the Mastra bundler. */
export type BundlerConfig = {
  /**
   * Controls which dependencies are excluded from the bundle and installed separately.
   * - `true`: Excludes all non-workspace packages from bundling
   * - `false`: Disables the all-dependencies preset; built-in global externals still apply.
   * - `string[]`: Specifies custom packages to exclude (merged with global externals like 'pg', '@libsql/client').
   * The `mastra build` CLI also retains array entries as runtime dependencies and
   * enables the all-dependencies preset. Use `false` to disable that preset.
   * @default true for `mastra build`
   */
  externals?: boolean | string[];
  /**
   * Enables source map generation for debugging bundled code.
   * Generates `.mjs.map` files alongside bundled output.
   * @default false
   */
  sourcemap?: boolean;
  /**
   * Minifies the generated bundle, stripping whitespace, comments and shortening
   * local identifiers. Off by default so that build output stays readable and
   * stack traces stay meaningful.
   *
   * Enable it when packaging for production — a smaller bundle is cheaper to
   * ship in a container image or to an on-prem target.
   * @default false
   *
   * @example
   * ```typescript
   * bundler: {
   *   minify: true
   * }
   * ```
   */
  minify?: boolean;
  /**
   * Packages requiring TypeScript/modern JS transpilation during bundling.
   * Automatically includes workspace packages.
   * @default [] for the explicitly configured package list
   */
  transpilePackages?: string[];
  /**
   * Packages that are loaded dynamically at runtime and cannot be detected by static analysis.
   * These packages will be included in the final dependencies even if not statically imported.
   *
   * Use this for packages loaded via string references like plugin systems, custom loggers,
   * or other dynamic module loading patterns.
   *
   * @example
   * ```typescript
   * bundler: {
   *   dynamicPackages: ['my-custom-pino-transport', 'some-plugin']
   * }
   * ```
   */
  dynamicPackages?: string[];

  /** Symbol-keyed bundler flags.
   * @param key - Symbol identifying a bundler flag.
   */
  [key: symbol]: boolean | undefined;
};
