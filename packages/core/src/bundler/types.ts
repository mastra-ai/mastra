export type BundlerConfig = {
  /**
   * Controls which dependencies are excluded from the bundle and installed separately.
   * - `true`: Excludes all non-workspace packages from bundling
   * - `string[]`: Specifies custom packages to exclude (merged with global externals like 'pg', '@libsql/client')
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

  /**
   * Packages to force-exclude from the generated `package.json` even if
   * dependency analysis flagged them as in use.
   *
   * Useful when conditional dynamic imports (e.g. a dev-only
   * `await import('@mastra/libsql')` gated by `process.env.NODE_ENV`) get
   * picked up by static analysis but are tree-shaken out of the production
   * bundle, polluting the output with packages your runtime never actually
   * needs.
   *
   * Entries are matched by package name only — `'@mastra/libsql'` drops the
   * package even when it was imported via a subpath, but `'@mastra/libsql/vector'`
   * matches nothing and is silently ignored.
   *
   * This affects the generated `package.json` only; the package stays external
   * to the bundle. Excluding something the runtime does reach therefore surfaces
   * as a `MODULE_NOT_FOUND` at run time, not as a build error.
   *
   * @example
   * ```typescript
   * bundler: {
   *   excludePackages: ['@mastra/libsql']
   * }
   * ```
   */
  excludePackages?: string[];

  [key: symbol]: boolean | undefined;
};
