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
}

export interface BundlerOptions {
  enableSourcemap: boolean;
  enableEsmShim: boolean;
  externals: boolean | string[];
  dynamicPackages?: string[];
  /**
   * Packages to force-exclude from the generated `package.json` even if
   * dependency analysis flagged them as in use. Useful when conditional
   * dynamic imports (e.g. dev-only `await import('@mastra/libsql')` gated
   * by `process.env.NODE_ENV`) get picked up by static analysis but are
   * tree-shaken out of the production bundle. See
   * https://github.com/mastra-ai/mastra/issues/16645.
   */
  excludePackages?: string[];
}

/**
 * Version information for an external dependency
 */
export interface ExternalDependencyInfo {
  /**
   * The resolved version of the dependency (exact version from package.json)
   */
  version?: string;
}
