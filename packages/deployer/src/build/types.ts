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
