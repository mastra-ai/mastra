/**
 * Collected metadata about a dependency
 */
export interface DependencyMetadata {
  /**
   * The list of exports from the dependency
   */
  exports: string[];
  /**
   * The root path of the dependency
   */
  rootPath: string | null;
  /**
   * Whether the dependency is a workspace package
   */
  isWorkspace: boolean;
  /**
   * The resolved version of the dependency (exact version from package.json)
   */
  version?: string;
  /**
   * The package.json dependency value to install when it differs from the resolved version.
   * For npm aliases, this uses npm alias syntax (e.g. npm:actual-package@1.0.0).
   */
  packageSpec?: string;
}

export interface BundlerOptions {
  enableSourcemap: boolean;
  /**
   * Optional so that a `Bundler` subclass outside this repo, which builds this
   * object itself, keeps compiling. Absent means off, same as `false`.
   */
  enableMinify?: boolean;
  enableEsmShim: boolean;
  externals: boolean | string[];
  dynamicPackages?: string[];
  /**
   * Extra process entries to emit beside the server bundle, as output name ->
   * absolute source path. Already resolved and validated against the user's
   * `bundler.entries` config; see `resolveExtraEntries`.
   */
  entries?: Record<string, string>;
}

/**
 * Version information for an external dependency
 */
export interface ExternalDependencyInfo {
  /**
   * The resolved version of the dependency (exact version from package.json)
   */
  version?: string;
  /**
   * The package.json dependency value to install when it differs from the resolved version.
   * For npm aliases, this uses npm alias syntax (e.g. npm:actual-package@1.0.0).
   */
  packageSpec?: string;
}
