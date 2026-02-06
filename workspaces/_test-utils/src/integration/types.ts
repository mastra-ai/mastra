/**
 * Types for integration test configuration.
 */

import type { WorkspaceFilesystem, WorkspaceSandbox } from '@mastra/core/workspace';

/**
 * Configuration for workspace integration tests.
 */
export interface WorkspaceIntegrationTestConfig {
  /** Display name for test suite */
  suiteName: string;

  /** Create a complete workspace setup for testing */
  createWorkspace: () => Promise<WorkspaceSetup>;

  /** Cleanup after tests */
  cleanupWorkspace?: (setup: WorkspaceSetup) => Promise<void>;

  /** Test scenarios to run (default: all applicable) */
  testScenarios?: IntegrationTestScenarios;

  /** Timeout for individual tests (default: 60000ms) */
  testTimeout?: number;

  /** Run only fast tests */
  fastOnly?: boolean;

  /**
   * Mount path prefix for sandbox commands.
   *
   * When a filesystem is FUSE-mounted inside a sandbox (e.g. s3fs at /data/s3),
   * the filesystem API uses object-store keys (e.g. /test/file.txt) while the
   * sandbox sees files at the mount point (e.g. /data/s3/test/file.txt).
   *
   * Set this to the mount path (e.g. '/data/s3') so that scenarios prepend it
   * to paths used in sandbox commands.
   *
   * @default '' (filesystem paths are used directly for sandbox commands)
   */
  mountPath?: string;
}

/**
 * Workspace setup returned by createWorkspace.
 */
export interface WorkspaceSetup {
  /** The filesystem (or CompositeFilesystem for multi-mount) */
  filesystem: WorkspaceFilesystem;

  /** The sandbox for command execution */
  sandbox: WorkspaceSandbox;

  /** Mount configuration (path -> filesystem) */
  mounts?: Record<string, WorkspaceFilesystem>;
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
}
