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
}
