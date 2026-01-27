export interface LocalProjectSourceConfig {
  /** Base paths to scan for Mastra projects */
  basePaths: string[];
  /** Glob patterns to include directories (default: ['*']) */
  include?: string[];
  /** Directory names to exclude (default: ['node_modules', '.git', 'dist', '.next', '.mastra']) */
  exclude?: string[];
  /** Maximum depth to scan (default: 3) */
  maxDepth?: number;
  /** Enable file watching for changes (default: false) */
  watchChanges?: boolean;
}
