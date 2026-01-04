/**
 * Workspace Executor Interface
 *
 * Provides a unified interface for code and command execution.
 * Implementations can be backed by E2B, Modal, Docker, local shell, etc.
 */

// =============================================================================
// Core Types
// =============================================================================

export type Runtime = 'python' | 'node' | 'bash' | 'ruby' | 'go' | 'rust' | 'deno' | 'bun';

export interface ExecutionResult {
  /** Exit code (0 = success) */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Execution duration in milliseconds */
  duration: number;
  /** Whether execution timed out */
  timedOut: boolean;
  /** Whether execution was killed */
  killed: boolean;
}

export interface CommandResult extends ExecutionResult {
  /** The command that was executed */
  command: string;
  /** Arguments passed to the command */
  args: string[];
}

export interface CodeResult extends ExecutionResult {
  /** The runtime used */
  runtime: Runtime;
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
  /** Runtime to use (default: infer from code or use executor default) */
  runtime?: Runtime;
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
  packageManager?: 'npm' | 'pip' | 'cargo' | 'go' | 'auto';
  /** Install as dev dependency */
  dev?: boolean;
  /** Specific version */
  version?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

// =============================================================================
// Executor Interface
// =============================================================================

/**
 * Abstract executor interface for code and command execution.
 *
 * Executors provide isolated environments for running untrusted code.
 * They may have their own filesystem that's separate from the workspace FS.
 */
export interface WorkspaceExecutor {
  /** Unique identifier for this executor instance */
  readonly id: string;

  /** Human-readable name (e.g., 'E2B Sandbox', 'Docker') */
  readonly name: string;

  /** Provider type identifier */
  readonly provider: string;

  /** Current status */
  readonly status: ExecutorStatus;

  /** Supported runtimes */
  readonly supportedRuntimes: readonly Runtime[];

  /** Default runtime */
  readonly defaultRuntime: Runtime;

  // ---------------------------------------------------------------------------
  // Code Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute code in the sandbox.
   * @throws {ExecutionError} if execution fails catastrophically
   * @throws {TimeoutError} if execution times out
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
   * @throws {ExecutionError} if command fails to start
   * @throws {TimeoutError} if command times out
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
   * Install a package in the executor environment.
   */
  installPackage?(packageName: string, options?: InstallPackageOptions): Promise<void>;

  /**
   * Install multiple packages.
   */
  installPackages?(packages: string[], options?: InstallPackageOptions): Promise<void>;

  // ---------------------------------------------------------------------------
  // Filesystem Access (Executor's internal FS)
  // ---------------------------------------------------------------------------

  /**
   * Write a file to the executor's filesystem.
   * This is the executor's internal FS, not the workspace FS.
   */
  writeFile?(path: string, content: string | Buffer): Promise<void>;

  /**
   * Read a file from the executor's filesystem.
   */
  readFile?(path: string): Promise<string>;

  /**
   * List files in the executor's filesystem.
   */
  listFiles?(path: string): Promise<string[]>;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Start/initialize the executor.
   * For cloud providers, this typically spins up a sandbox.
   */
  start(): Promise<void>;

  /**
   * Stop the executor, keeping state for potential restart.
   */
  stop?(): Promise<void>;

  /**
   * Destroy the executor and clean up all resources.
   */
  destroy(): Promise<void>;

  /**
   * Check if the executor is ready for commands.
   */
  isReady(): Promise<boolean>;

  /**
   * Get executor information/metadata.
   */
  getInfo(): Promise<ExecutorInfo>;
}

// =============================================================================
// Executor Status & Info
// =============================================================================

export type ExecutorStatus = 'pending' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error' | 'destroyed';

export interface ExecutorInfo {
  id: string;
  provider: string;
  status: ExecutorStatus;
  /** When the executor was created */
  createdAt: Date;
  /** When the executor was last used */
  lastUsedAt?: Date;
  /** Time until auto-shutdown (if applicable) */
  timeoutAt?: Date;
  /** Resource usage (if available) */
  resources?: {
    memoryUsedMb?: number;
    memoryLimitMb?: number;
    cpuPercent?: number;
    diskUsedMb?: number;
    diskLimitMb?: number;
  };
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Provider Configuration
// =============================================================================

export interface ExecutorProviderConfig {
  /** Unique ID for this executor instance */
  id: string;
  /** Default runtime */
  defaultRuntime?: Runtime;
  /** Default timeout in milliseconds */
  timeout?: number;
  /** Environment variables to set in all executions */
  env?: Record<string, string>;
}

export interface E2BExecutorConfig extends ExecutorProviderConfig {
  provider: 'e2b';
  /** E2B API key (defaults to E2B_API_KEY env var) */
  apiKey?: string;
  /** E2B template ID */
  templateId?: string;
  /** Sandbox timeout in milliseconds */
  sandboxTimeout?: number;
}

export interface ModalExecutorConfig extends ExecutorProviderConfig {
  provider: 'modal';
  /** Modal token ID (defaults to MODAL_TOKEN_ID env var) */
  tokenId?: string;
  /** Modal token secret (defaults to MODAL_TOKEN_SECRET env var) */
  tokenSecret?: string;
  /** GPU type if needed */
  gpu?: string;
}

export interface DockerExecutorConfig extends ExecutorProviderConfig {
  provider: 'docker';
  /** Docker image to use */
  image: string;
  /** Pull image if not present */
  pull?: boolean;
  /** Mount volumes */
  volumes?: Array<{ host: string; container: string; readonly?: boolean }>;
  /** Memory limit (e.g., '512m', '1g') */
  memory?: string;
  /** CPU limit (e.g., '0.5', '2') */
  cpus?: string;
  /** Network mode */
  network?: 'none' | 'bridge' | 'host';
}

export interface LocalExecutorConfig extends ExecutorProviderConfig {
  provider: 'local';
  /** Working directory for executions */
  cwd?: string;
  /** Use a shell for command execution */
  shell?: boolean;
  /** Restrict commands (security) */
  allowedCommands?: string[];
}

export interface DaytonaExecutorConfig extends ExecutorProviderConfig {
  provider: 'daytona';
  /** Daytona API key (defaults to DAYTONA_API_KEY env var) */
  apiKey?: string;
  /** Workspace template */
  template?: string;
}

export interface ComputeSDKExecutorConfig extends ExecutorProviderConfig {
  provider: 'computesdk';
  /** Let ComputeSDK auto-detect provider */
  autoDetect?: boolean;
  /** Force specific provider */
  forceProvider?: 'e2b' | 'modal' | 'railway' | 'daytona' | 'vercel' | 'cloudflare';
}

export type ExecutorConfig =
  | E2BExecutorConfig
  | ModalExecutorConfig
  | DockerExecutorConfig
  | LocalExecutorConfig
  | DaytonaExecutorConfig
  | ComputeSDKExecutorConfig;

// =============================================================================
// Errors
// =============================================================================

export class ExecutorError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ExecutorError';
  }
}

export class ExecutionError extends ExecutorError {
  constructor(
    message: string,
    public readonly exitCode: number,
    public readonly stdout: string,
    public readonly stderr: string,
  ) {
    super(message, 'EXECUTION_FAILED', { exitCode, stdout, stderr });
    this.name = 'ExecutionError';
  }
}

export class TimeoutError extends ExecutorError {
  constructor(
    public readonly timeoutMs: number,
    public readonly operation: 'code' | 'command',
  ) {
    super(`Execution timed out after ${timeoutMs}ms`, 'TIMEOUT', { timeoutMs, operation });
    this.name = 'TimeoutError';
  }
}

export class ExecutorNotReadyError extends ExecutorError {
  constructor(status: ExecutorStatus) {
    super(`Executor is not ready (status: ${status})`, 'NOT_READY', { status });
    this.name = 'ExecutorNotReadyError';
  }
}

export class UnsupportedRuntimeError extends ExecutorError {
  constructor(runtime: string, supported: readonly Runtime[]) {
    super(`Runtime '${runtime}' is not supported. Supported: ${supported.join(', ')}`, 'UNSUPPORTED_RUNTIME', {
      runtime,
      supported,
    });
    this.name = 'UnsupportedRuntimeError';
  }
}
