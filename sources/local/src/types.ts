import type { ChangeEvent, ProjectSource } from '@mastra/admin';

/**
 * Configuration for the local project source provider.
 */
export interface LocalProjectSourceConfig {
  /**
   * Base directories to scan for Mastra projects.
   * All paths should be absolute.
   * @example ['/home/user/projects', '/opt/mastra-apps']
   */
  basePaths: string[];

  /**
   * Glob patterns to include when scanning for projects.
   * Relative to each base path.
   * @default ['*']
   */
  include?: string[];

  /**
   * Glob patterns to exclude from scanning.
   * Useful for ignoring node_modules, .git, etc.
   * @default ['node_modules', '.git', 'dist', 'build', '.next']
   */
  exclude?: string[];

  /**
   * Maximum depth to scan for projects.
   * @default 2
   */
  maxDepth?: number;

  /**
   * Whether to watch for file changes.
   * Only enable in development mode.
   * @default false
   */
  watchChanges?: boolean;

  /**
   * Debounce interval for file change events (ms).
   * @default 300
   */
  watchDebounceMs?: number;
}

/**
 * Supported package managers for Mastra projects.
 */
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

/**
 * Metadata about a detected Mastra project.
 */
export interface ProjectMetadata {
  /** Project name from package.json */
  name: string;

  /** Project version from package.json */
  version?: string;

  /** Description from package.json */
  description?: string;

  /** Detected package manager */
  packageManager: PackageManager;

  /** Whether the project has a mastra.config file */
  hasMastraConfig: boolean;

  /** Path to the mastra config file (if found) */
  mastraConfigPath?: string;

  /** Main entry point from package.json */
  entryPoint?: string;

  /** Whether the project uses TypeScript */
  isTypeScript: boolean;

  /** Dependencies that indicate this is a Mastra project */
  mastraDependencies: string[];

  /** Allow additional custom metadata fields */
  [key: string]: unknown;
}

/**
 * Extended project source with local-specific metadata.
 */
export interface LocalProjectSource extends ProjectSource {
  type: 'local';
  /** Absolute path to the project directory */
  path: string;
  /** Detected project metadata */
  metadata: ProjectMetadata & Record<string, unknown>;
}

/**
 * Options for scanning directories.
 */
export interface ScanOptions {
  /** Base path to scan */
  basePath: string;

  /** Include patterns */
  include: string[];

  /** Exclude patterns */
  exclude: string[];

  /** Maximum depth */
  maxDepth: number;
}

/**
 * Result of scanning a directory.
 */
export interface ScanResult {
  /** Discovered Mastra projects */
  projects: LocalProjectSource[];

  /** Directories that were scanned but not valid Mastra projects */
  skipped: string[];

  /** Errors encountered during scanning */
  errors: ScanError[];
}

/**
 * Error encountered during scanning.
 */
export interface ScanError {
  path: string;
  error: string;
  code?: string;
}

/**
 * Re-export core types for convenience.
 */
export type { ProjectSource, ChangeEvent };
