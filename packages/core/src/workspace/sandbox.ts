/**
 * Workspace Sandbox Interface
 *
 * Defines the contract for sandbox providers that can be used with Workspace.
 * Users pass sandbox provider instances to the Workspace constructor.
 *
 * Sandboxes provide isolated environments for code and command execution.
 * They may have their own filesystem that's separate from the workspace FS.
 *
 * Built-in providers (via ComputeSDK):
 * - E2B: Cloud sandboxes
 * - Modal: GPU-enabled sandboxes
 * - Docker: Container-based execution
 * - Local: Development-only local execution
 *
 * @example
 * ```typescript
 * import { Workspace } from '@mastra/core';
 * import { ComputeSDKSandbox } from '@mastra/workspace-sandbox-computesdk';
 *
 * const workspace = new Workspace({
 *   sandbox: new ComputeSDKSandbox({ provider: 'e2b' }),
 * });
 * ```
 */

// =============================================================================
// Core Types
// =============================================================================

export interface ExecutionResult {
  /** Whether execution completed successfully (exitCode === 0) */
  success: boolean;
  /** Exit code (0 = success) */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Execution time in milliseconds */
  executionTimeMs: number;
  /** Whether execution timed out */
  timedOut?: boolean;
  /** Whether execution was killed */
  killed?: boolean;
}

export interface CommandResult extends ExecutionResult {
  /** The command that was executed */
  command?: string;
  /** Arguments passed to the command */
  args?: string[];
}

// =============================================================================
// Execution Options
// =============================================================================

export interface ExecuteCommandOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Environment variables */
  env?: NodeJS.ProcessEnv;
  /** Working directory */
  cwd?: string;
  /** Stream output instead of buffering */
  stream?: boolean;
  /** Shell to use (default: /bin/sh) */
  shell?: string | boolean;
  /** Callback for stdout chunks (enables streaming) */
  onStdout?: (data: string) => void;
  /** Callback for stderr chunks (enables streaming) */
  onStderr?: (data: string) => void;
}

// =============================================================================
// Sandbox Safety Options
// =============================================================================

/**
 * Safety options that can be configured per-sandbox.
 * These options control how the sandbox behaves with regard to execution approval.
 */
export interface SandboxSafetyOptions {
  /**
   * Require approval for sandbox command execution.
   * - 'all': Require approval for all sandbox operations (commands, package installs)
   * - 'none': No approval required
   *
   * This setting is used by workspace tools to set the `requireApproval` flag.
   *
   * @default 'all'
   */
  requireApproval?: 'all' | 'none';
}

// =============================================================================
// Sandbox Interface
// =============================================================================

/**
 * Abstract sandbox interface for code and command execution.
 *
 * Providers implement this interface to provide execution capabilities.
 * Users instantiate providers and pass them to the Workspace constructor.
 *
 * Sandboxes provide isolated environments for running untrusted code.
 * They may have their own filesystem that's separate from the workspace FS.
 */
export interface WorkspaceSandbox {
  /** Unique identifier for this sandbox instance */
  readonly id: string;

  /** Human-readable name (e.g., 'E2B Sandbox', 'Docker') */
  readonly name: string;

  /** Provider type identifier */
  readonly provider: string;

  /** Current status */
  readonly status: SandboxStatus;

  /**
   * Safety configuration for this sandbox.
   * Optional - if not provided, defaults apply.
   */
  readonly safety?: SandboxSafetyOptions;

  // ---------------------------------------------------------------------------
  // Command Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute a shell command.
   * Optional - if not implemented, the workspace_execute_command tool won't be available.
   * @throws {SandboxExecutionError} if command fails to start
   * @throws {SandboxTimeoutError} if command times out
   */
  executeCommand?(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult>;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Start/initialize the sandbox.
   * For cloud providers, this typically spins up a sandbox instance.
   */
  start(): Promise<void>;

  /**
   * Stop the sandbox, keeping state for potential restart.
   */
  stop?(): Promise<void>;

  /**
   * Destroy the sandbox and clean up all resources.
   */
  destroy(): Promise<void>;

  /**
   * Check if the sandbox is ready for commands.
   */
  isReady(): Promise<boolean>;

  /**
   * Get sandbox information/metadata.
   */
  getInfo(): Promise<SandboxInfo>;
}

// =============================================================================
// Sandbox Status & Info
// =============================================================================

export type SandboxStatus = 'pending' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error' | 'destroyed';

export interface SandboxInfo {
  id: string;
  name: string;
  provider: string;
  status: SandboxStatus;
  /** When the sandbox was created */
  createdAt: Date;
  /** When the sandbox was last used */
  lastUsedAt?: Date;
  /** Time until auto-shutdown (if applicable) */
  timeoutAt?: Date;
  /** Resource info (if available) */
  resources?: {
    memoryMB?: number;
    memoryUsedMB?: number;
    cpuCores?: number;
    cpuPercent?: number;
    diskMB?: number;
    diskUsedMB?: number;
  };
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Errors
// =============================================================================

export class SandboxError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'SandboxError';
  }
}

export class SandboxExecutionError extends SandboxError {
  constructor(
    message: string,
    public readonly exitCode: number,
    public readonly stdout: string,
    public readonly stderr: string,
  ) {
    super(message, 'EXECUTION_FAILED', { exitCode, stdout, stderr });
    this.name = 'SandboxExecutionError';
  }
}

export class SandboxTimeoutError extends SandboxError {
  constructor(
    public readonly timeoutMs: number,
    public readonly operation: 'command',
  ) {
    super(`Execution timed out after ${timeoutMs}ms`, 'TIMEOUT', { timeoutMs, operation });
    this.name = 'SandboxTimeoutError';
  }
}

export class SandboxNotReadyError extends SandboxError {
  constructor(idOrStatus: string) {
    super(`Sandbox is not ready: ${idOrStatus}`, 'NOT_READY', { id: idOrStatus });
    this.name = 'SandboxNotReadyError';
  }
}

export class IsolationUnavailableError extends SandboxError {
  constructor(
    public readonly backend: string,
    public readonly reason: string,
  ) {
    super(`Isolation backend '${backend}' is not available: ${reason}`, 'ISOLATION_UNAVAILABLE', { backend, reason });
    this.name = 'IsolationUnavailableError';
  }
}
