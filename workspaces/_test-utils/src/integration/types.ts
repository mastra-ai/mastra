/**
 * Types for integration test configuration.
 */

import type { Workspace } from '@mastra/core/workspace';

/**
 * Configuration for workspace integration tests.
 */
export interface WorkspaceIntegrationTestConfig {
  /** Display name for test suite */
  suiteName: string;

  /** Create a Workspace instance. The factory calls workspace.init() automatically. */
  createWorkspace: () => Promise<Workspace> | Workspace;

  /** Cleanup after tests (delete test files, etc.) */
  cleanupWorkspace?: (workspace: Workspace) => Promise<void>;

  /** Test scenarios to run (default: all applicable) */
  testScenarios?: IntegrationTestScenarios;

  /** Timeout for individual tests (default: 60000ms) */
  testTimeout?: number;

  /** Run only fast tests */
  fastOnly?: boolean;

  /**
   * Whether sandbox file paths align with filesystem API paths for multi-mount.
   *
   * When true: sandbox commands like `cat /mount1/file.txt` see the same files
   * as `fs1.readFile('/file.txt')`. Required for sandbox-dependent multi-mount tests.
   *
   * When false: only API-level isolation tests run (e.g. prefix-based S3 on same bucket
   * where s3fs mounts the full bucket, not the prefix).
   *
   * @default true
   */
  sandboxPathsAligned?: boolean;
}

/**
 * Integration test scenarios to enable/disable.
 */
export interface IntegrationTestScenarios {
  /** Write file via filesystem API, read via sandbox command */
  fileSync?: boolean;

  /** Multiple filesystems mounted at different paths */
  multiMount?: boolean;

  /** Copy files between different mounts */
  crossMountCopy?: boolean;

  /** Verify readOnly enforcement end-to-end */
  readOnlyMount?: boolean;

  /** Concurrent file operations (parallel reads/writes) */
  concurrentOperations?: boolean;

  /** Large file handling (5MB+ files) */
  largeFileHandling?: boolean;

  /** Write-read consistency (immediate read-after-write) */
  writeReadConsistency?: boolean;

  // Composite-specific scenarios (API-only, no sandbox needed)

  /** Route operations to correct mount based on path */
  mountRouting?: boolean;

  /** Cross-mount copy/move via filesystem API (not sandbox) */
  crossMountApi?: boolean;

  /** Virtual directory listing at root and mount points */
  virtualDirectory?: boolean;

  /** Mount isolation - operations on one mount don't affect another */
  mountIsolation?: boolean;
}
