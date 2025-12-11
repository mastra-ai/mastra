export type BundlerConfig = {
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
};
