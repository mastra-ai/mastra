/**
 * Types for filesystem test configuration.
 */

import type { WorkspaceFilesystem } from '@mastra/core/workspace';

/**
 * Configuration for the filesystem test suite.
 */
export interface FilesystemTestConfig {
  /** Display name for test suite */
  suiteName: string;

  /** Factory to create filesystem instance for testing */
  createFilesystem: () => Promise<WorkspaceFilesystem> | WorkspaceFilesystem;

  /** Cleanup after tests (delete test files, etc.) */
  cleanupFilesystem?: (fs: WorkspaceFilesystem) => Promise<void>;

  /** Capability flags - skip tests for unsupported features */
  capabilities?: FilesystemCapabilities;

  /** Test domains to run (default: all) */
  testDomains?: FilesystemTestDomains;

  /** Timeout for individual tests (default: 5000ms) */
  testTimeout?: number;

  /** Run only fast tests (skip slow operations like large file tests) */
  fastOnly?: boolean;
}

/**
 * Capability flags for filesystem providers.
 * Tests will be skipped for unsupported features.
 */
export interface FilesystemCapabilities {
  /** Supports append operations (default: true) */
  supportsAppend?: boolean;

  /** Supports symbolic links (default: false) */
  supportsSymlinks?: boolean;

  /** Supports binary files (default: true) */
  supportsBinaryFiles?: boolean;

  /** Supports file permissions (default: false) */
  supportsPermissions?: boolean;

  /** Supports case-sensitive paths (default: true) */
  supportsCaseSensitive?: boolean;

  /** Supports concurrent operations (default: true) */
  supportsConcurrency?: boolean;

  /** Supports getMountConfig() for sandbox mounting */
  supportsMounting?: boolean;

  /** Maximum file size for tests in bytes (default: 10MB) */
  maxTestFileSize?: number;

  /** Supports the force option on delete (default: true) */
  supportsForceDelete?: boolean;

  /** Supports overwrite option on copy (default: true) */
  supportsOverwrite?: boolean;

  /**
   * Supports empty directories (default: true).
   * Object stores (S3, GCS) don't support this - directories only exist
   * when they contain files. Set to false for object stores.
   */
  supportsEmptyDirectories?: boolean;

  /**
   * deleteFile throws FileNotFoundError for missing files (default: true).
   * S3's DeleteObject is idempotent - it succeeds for non-existent keys.
   * Set to false for S3-compatible stores.
   */
  deleteThrowsOnMissing?: boolean;
}

/**
 * Test domains to enable/disable.
 * All default to true if not specified.
 */
export interface FilesystemTestDomains {
  /** File operations: read, write, append, delete, copy, move */
  fileOperations?: boolean;

  /** Directory operations: mkdir, rmdir, readdir */
  directoryOps?: boolean;

  /** Path operations: exists, stat, isFile, isDirectory */
  pathOperations?: boolean;

  /** Error handling: FileNotFoundError, PermissionError */
  errorHandling?: boolean;

  /** Lifecycle: init, destroy, status transitions */
  lifecycle?: boolean;

  /** Mount config: getMountConfig, readOnly enforcement */
  mountConfig?: boolean;
}

/**
 * Configuration for config validation tests.
 */
export interface ConfigTestConfig<T = unknown> {
  /** Provider name for test description */
  providerName: string;

  /** Factory to create provider with given config */
  createProvider: (config: Record<string, unknown>) => T;

  /** Valid configuration test cases */
  validConfigs: ValidConfigTestCase[];

  /** Invalid configuration test cases */
  invalidConfigs: InvalidConfigTestCase[];

  /** Whether the provider uses MastraError wrapping (default: false) */
  usesMastraError?: boolean;
}

export interface ValidConfigTestCase {
  /** Description of the configuration */
  description: string;
  /** The configuration object */
  config: Record<string, unknown>;
}

export interface InvalidConfigTestCase {
  /** Description of the invalid configuration */
  description: string;
  /** The invalid configuration object */
  config: Record<string, unknown>;
  /** Expected error message pattern */
  expectedError: RegExp;
}
