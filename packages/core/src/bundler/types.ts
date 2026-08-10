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
   * Minifies the generated bundle, stripping whitespace, comments and shortening
   * local identifiers. Off by default so that build output stays readable and
   * stack traces stay meaningful.
   *
   * Enable it when packaging for production — a smaller bundle is cheaper to
   * ship in a container image or to an on-prem target.
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
   * Additional process entries to emit alongside the server bundle, as a map of
   * output name to source path relative to your Mastra directory.
   *
   * Each entry becomes its own `<name>.mjs` in the build output, sharing the
   * output directory, `package.json`, and installed dependencies with the server.
   * Use this for long-running processes that run beside the server rather than
   * inside it — a LiveKit voice worker, for example.
   *
   * Entry names may contain `/` to nest the output, but cannot be `index`
   * (the server bundle), `tools` (the tool aggregator), or start with `tools/`
   * (tool bundles).
   *
   * @example
   * ```typescript
   * bundler: {
   *   entries: { 'voice-worker': './voice-worker.ts' }
   * }
   * // emits .mastra/output/voice-worker.mjs
   * ```
   */
  entries?: Record<string, string>;

  [key: symbol]: boolean | undefined;
};
