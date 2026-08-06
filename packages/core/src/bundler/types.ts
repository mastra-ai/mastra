/**
 * Object form of `bundler.externals`, for cases the boolean and array forms can't express.
 */
export type ExternalsConfig = {
  /**
   * Which dependencies the preset externalizes before `include`/`exclude` are applied.
   * - `'none'` (default): bundle everything, externalize only what `include` names
   * - `'all'`: externalize every non-workspace dependency
   */
  preset?: 'all' | 'none';
  /**
   * Always externalized, on top of the preset. Use for packages static analysis can't
   * see, such as dynamically imported drivers.
   */
  include?: string[];
  /**
   * Force-bundled even when the preset would externalize them. Cannot remove Mastra's
   * built-in runtime externals or anything named in `include`.
   */
  exclude?: string[];
};

export type BundlerConfig = {
  /**
   * Controls which dependencies are excluded from the bundle and installed separately.
   * - `true`: Excludes all non-workspace packages from bundling
   * - `string[]`: Specifies custom packages to exclude (merged with global externals like 'pg', '@libsql/client')
   * - `ExternalsConfig`: Composes a preset with per-package `include`/`exclude` overrides
   *
   * @example
   * ```typescript
   * bundler: {
   *   externals: {
   *     preset: 'all',
   *     exclude: ['broken-pkg'], // bundle this one anyway
   *     include: ['pg-native'],  // externalize this one too
   *   }
   * }
   * ```
   */
  externals?: boolean | string[] | ExternalsConfig;
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

  [key: symbol]: boolean | undefined;
};
