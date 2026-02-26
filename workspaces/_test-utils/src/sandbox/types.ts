/**
 * Types for sandbox test configuration.
 */

import type { MastraSandbox, WorkspaceFilesystem } from '@mastra/core/workspace';

/**
 * Configuration for the sandbox test suite.
 */
export interface SandboxTestConfig {
  /** Display name for test suite */
  suiteName: string;

  /** Factory to create sandbox instance for testing. Accepts optional overrides (e.g. env). */
  createSandbox: (options?: CreateSandboxOptions) => Promise<MastraSandbox> | MastraSandbox;

  /**
   * Optional factory to create a sandbox with intentionally invalid config (e.g. bad image/template).
   * Used to test error recovery: _start() should reject cleanly, not hang.
   * If not provided, error recovery tests are skipped.
   */
  createInvalidSandbox?: () => Promise<MastraSandbox> | MastraSandbox;

  /** Cleanup after tests */
  cleanupSandbox?: (sandbox: MastraSandbox) => Promise<void>;

  /** Capability flags - skip tests for unsupported features */
  capabilities?: SandboxCapabilities;

  /** Test domains to run (default: all) */
  testDomains?: SandboxTestDomains;

  /** Timeout for individual tests (default: 30000ms for sandboxes) */
  testTimeout?: number;

  /** Run only fast tests (skip slow operations) */
  fastOnly?: boolean;

  /**
   * Optional factory to create a filesystem with getMountConfig() for mount tests.
   * Required for mount operation tests that actually mount filesystems.
   */
  createMountableFilesystem?: () => Promise<WorkspaceFilesystem> | WorkspaceFilesystem;
}

/**
 * Options passed to the createSandbox factory for per-test overrides.
 */
export interface CreateSandboxOptions {
  /** Environment variables to configure on the sandbox */
  env?: Record<string, string>;
}

/**
 * Capability flags for sandbox providers.
 */
export interface SandboxCapabilities {
  /** Supports mounting filesystems (default: false) */
  supportsMounting?: boolean;

  /** Supports reconnection to existing sandbox (default: false) */
  supportsReconnection?: boolean;

  /** Supports concurrent command execution (default: true) */
  supportsConcurrency?: boolean;

  /** Supports environment variables (default: true) */
  supportsEnvVars?: boolean;

  /** Supports working directory changes (default: true) */
  supportsWorkingDirectory?: boolean;

  /** Supports command timeout (default: true) */
  supportsTimeout?: boolean;

  /** Default command timeout for tests (ms) */
  defaultCommandTimeout?: number;

  /** Supports streaming output (default: true) */
  supportsStreaming?: boolean;
}

/**
 * Test domains to enable/disable.
 */
export interface SandboxTestDomains {
  /** Command execution tests */
  commandExecution?: boolean;

  /** Lifecycle tests: start, stop, destroy, status */
  lifecycle?: boolean;

  /** Mount operation tests */
  mountOperations?: boolean;

  /** Sandbox reconnection tests */
  reconnection?: boolean;

  /** Background process management tests */
  processManagement?: boolean;
}
