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

import type { WorkspaceFilesystem } from './filesystem';

// =============================================================================
// Core Types
// =============================================================================

export type SandboxRuntime = 'python' | 'node' | 'bash' | 'shell' | 'ruby' | 'go' | 'rust' | 'deno' | 'bun';

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

export interface CodeResult extends ExecutionResult {
  /** The runtime used */
  runtime?: SandboxRuntime;
  /** Return value if the code produced one (runtime-dependent) */
  returnValue?: unknown;
}

export interface StreamingExecutionResult {
  /** Exit code promise (resolves when execution completes) */
  exitCode: Promise<number>;
  /** Async iterator for stdout */
  stdout: AsyncIterable<string>;
  /** Async iterator for stderr */
  stderr: AsyncIterable<string>;
  /** Kill the execution */
  kill(): Promise<void>;
  /** Wait for completion and get full result */
  wait(): Promise<ExecutionResult>;
}

// =============================================================================
// Execution Options
// =============================================================================

export interface ExecuteCodeOptions {
  /** Runtime to use (default: infer from code or use sandbox default) */
  runtime?: SandboxRuntime;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
  /** Stream output instead of buffering */
  stream?: boolean;
}

export interface ExecuteCommandOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
  /** Stream output instead of buffering */
  stream?: boolean;
  /** Shell to use (default: /bin/sh) */
  shell?: string | boolean;
}

export interface InstallPackageOptions {
  /** Package manager to use */
  packageManager?: 'npm' | 'pip' | 'cargo' | 'go' | 'yarn' | 'pnpm' | 'auto';
  /** Install as dev dependency */
  dev?: boolean;
  /** Specific version */
  version?: string;
  /** Install globally */
  global?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
}

export interface InstallPackageResult {
  /** Whether installation succeeded */
  success: boolean;
  /** Package name */
  packageName: string;
  /** Installed version (if available) */
  version?: string;
  /** Error message if failed */
  error?: string;
  /** Execution time in milliseconds */
  executionTimeMs: number;
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

  /** Supported runtimes */
  readonly supportedRuntimes: readonly SandboxRuntime[];

  /** Default runtime */
  readonly defaultRuntime: SandboxRuntime;

  // ---------------------------------------------------------------------------
  // Mount Support (optional capability)
  // ---------------------------------------------------------------------------

  /**
   * Whether this sandbox supports mounting external filesystems.
   * When true, filesystems can be mounted at specified paths, creating
   * a unified view where workspace files are directly accessible in sandbox code.
   *
   * Mounting capabilities vary by sandbox type:
   * - LocalSandbox: Can mount local filesystems (same directory)
   * - E2BSandbox: Can mount S3/GCS via FUSE (s3fs, gcsfuse)
   * - DockerSandbox: Can mount via volume binds
   * - BrowserSandbox: Cannot mount (requires sync)
   */
  readonly supportsMounting?: boolean;

  /**
   * Check if this sandbox can mount a specific filesystem.
   * Only available when supportsMounting is true.
   *
   * @param filesystem - The filesystem to check
   * @returns true if this sandbox can mount the given filesystem
   */
  canMount?(filesystem: WorkspaceFilesystem): boolean;

  /**
   * Mount a filesystem at a path in the sandbox.
   * Only available when supportsMounting is true and canMount returns true.
   *
   * After mounting:
   * - workspace.writeFile('/data/file.txt') writes to the filesystem
   * - Sandbox code reading '/workspace/data/file.txt' reads the same file
   *
   * @param filesystem - The filesystem to mount
   * @param mountPath - Path in sandbox where filesystem will be mounted (e.g., '/workspace')
   */
  mount?(filesystem: WorkspaceFilesystem, mountPath: string): Promise<void>;

  /**
   * Unmount a previously mounted filesystem.
   */
  unmount?(mountPath: string): Promise<void>;

  // ---------------------------------------------------------------------------
  // Code Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute code in the sandbox.
   * @throws {SandboxExecutionError} if execution fails catastrophically
   * @throws {SandboxTimeoutError} if execution times out
   */
  executeCode(code: string, options?: ExecuteCodeOptions): Promise<CodeResult>;

  /**
   * Execute code with streaming output.
   */
  executeCodeStream?(code: string, options?: ExecuteCodeOptions): Promise<StreamingExecutionResult>;

  // ---------------------------------------------------------------------------
  // Command Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute a shell command.
   * @throws {SandboxExecutionError} if command fails to start
   * @throws {SandboxTimeoutError} if command times out
   */
  executeCommand(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult>;

  /**
   * Execute a command with streaming output.
   */
  executeCommandStream?(
    command: string,
    args?: string[],
    options?: ExecuteCommandOptions,
  ): Promise<StreamingExecutionResult>;

  // ---------------------------------------------------------------------------
  // Package Management
  // ---------------------------------------------------------------------------

  /**
   * Install a package in the sandbox environment.
   */
  installPackage?(packageName: string, options?: InstallPackageOptions): Promise<InstallPackageResult>;

  /**
   * Install multiple packages.
   */
  installPackages?(packages: string[], options?: InstallPackageOptions): Promise<InstallPackageResult[]>;

  // ---------------------------------------------------------------------------
  // Filesystem Access (Sandbox's internal FS)
  // ---------------------------------------------------------------------------

  /**
   * Write a file to the sandbox's filesystem.
   * This is the sandbox's internal FS, not the workspace FS.
   */
  writeFile?(path: string, content: string | Buffer): Promise<void>;

  /**
   * Read a file from the sandbox's filesystem.
   */
  readFile?(path: string): Promise<string>;

  /**
   * List files in the sandbox's filesystem.
   */
  listFiles?(path: string): Promise<string[]>;

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
    public readonly operation: 'code' | 'command',
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

export class UnsupportedRuntimeError extends SandboxError {
  constructor(runtime: string, supported: readonly SandboxRuntime[]) {
    super(`Runtime '${runtime}' is not supported. Supported: ${supported.join(', ')}`, 'UNSUPPORTED_RUNTIME', {
      runtime,
      supported,
    });
    this.name = 'UnsupportedRuntimeError';
  }
}
