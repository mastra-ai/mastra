/**
 * Workspace Types
 *
 * These types mirror the interfaces in @mastra/core/workspace.
 * Provider implementations can use either these types or import from core.
 */

// =============================================================================
// Filesystem Types
// =============================================================================

export type FileContent = string | Buffer | Uint8Array;

export interface FileStat {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  mimeType?: string;
}

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
}

export interface ReadOptions {
  encoding?: BufferEncoding;
}

export interface WriteOptions {
  recursive?: boolean;
  overwrite?: boolean;
  mimeType?: string;
}

export interface ListOptions {
  recursive?: boolean;
  extension?: string | string[];
  maxDepth?: number;
}

export interface RemoveOptions {
  recursive?: boolean;
  force?: boolean;
}

export interface CopyOptions {
  overwrite?: boolean;
  recursive?: boolean;
}

// =============================================================================
// Sandbox Types
// =============================================================================

export type SandboxRuntime = 'python' | 'node' | 'bash' | 'ruby' | 'go' | 'rust' | 'deno' | 'bun';
export type SandboxStatus = 'pending' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error' | 'destroyed';

export interface ExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  timedOut: boolean;
  killed: boolean;
}

export interface CommandResult extends ExecutionResult {
  command: string;
  args: string[];
}

export interface CodeResult extends ExecutionResult {
  runtime: SandboxRuntime;
  returnValue?: unknown;
}

export interface StreamingExecutionResult {
  exitCode: Promise<number>;
  stdout: AsyncIterable<string>;
  stderr: AsyncIterable<string>;
  kill(): Promise<void>;
  wait(): Promise<ExecutionResult>;
}

export interface ExecuteCodeOptions {
  runtime?: SandboxRuntime;
  timeout?: number;
  env?: Record<string, string>;
  cwd?: string;
  stream?: boolean;
}

export interface ExecuteCommandOptions {
  timeout?: number;
  env?: Record<string, string>;
  cwd?: string;
  stream?: boolean;
  shell?: string | boolean;
}

export interface InstallPackageOptions {
  packageManager?: 'npm' | 'pip' | 'cargo' | 'go' | 'auto';
  dev?: boolean;
  version?: string;
  timeout?: number;
}

export interface SandboxInfo {
  id: string;
  provider: string;
  status: SandboxStatus;
  createdAt: Date;
  lastUsedAt?: Date;
  timeoutAt?: Date;
  resources?: {
    memoryUsedMb?: number;
    memoryLimitMb?: number;
    cpuPercent?: number;
    diskUsedMb?: number;
    diskLimitMb?: number;
  };
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Errors
// =============================================================================

export class FilesystemError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly path: string,
  ) {
    super(message);
    this.name = 'FilesystemError';
  }
}

export class FileNotFoundError extends FilesystemError {
  constructor(path: string) {
    super(`File not found: ${path}`, 'ENOENT', path);
    this.name = 'FileNotFoundError';
  }
}

export class DirectoryNotFoundError extends FilesystemError {
  constructor(path: string) {
    super(`Directory not found: ${path}`, 'ENOENT', path);
    this.name = 'DirectoryNotFoundError';
  }
}

export class FileExistsError extends FilesystemError {
  constructor(path: string) {
    super(`File already exists: ${path}`, 'EEXIST', path);
    this.name = 'FileExistsError';
  }
}

export class IsDirectoryError extends FilesystemError {
  constructor(path: string) {
    super(`Path is a directory: ${path}`, 'EISDIR', path);
    this.name = 'IsDirectoryError';
  }
}

export class NotDirectoryError extends FilesystemError {
  constructor(path: string) {
    super(`Path is not a directory: ${path}`, 'ENOTDIR', path);
    this.name = 'NotDirectoryError';
  }
}

export class DirectoryNotEmptyError extends FilesystemError {
  constructor(path: string) {
    super(`Directory not empty: ${path}`, 'ENOTEMPTY', path);
    this.name = 'DirectoryNotEmptyError';
  }
}

export class PermissionError extends FilesystemError {
  constructor(path: string, operation: string) {
    super(`Permission denied: ${operation} on ${path}`, 'EACCES', path);
    this.name = 'PermissionError';
  }
}

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

export class SandboxNotReadyError extends SandboxError {
  constructor(status: SandboxStatus) {
    super(`Sandbox is not ready (status: ${status})`, 'NOT_READY', { status });
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
