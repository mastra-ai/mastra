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
