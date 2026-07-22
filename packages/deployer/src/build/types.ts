import type { Config } from '@mastra/core/mastra';

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
  enableEsmShim: boolean;
  externals: NonNullable<Config['bundler']>['externals'];
  dynamicPackages?: string[];
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
