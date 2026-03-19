/**
 * Sandbox Errors
 *
 * Error classes for sandbox operations including execution and mounting.
 */

import type { SandboxOperation } from './types';

// =============================================================================
// Base Error
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

// =============================================================================
// Execution Errors
// =============================================================================

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
    public readonly operation: SandboxOperation,
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

// =============================================================================
// Mount Errors
// =============================================================================

/**
 * Base error for mount operations.
 */
export class MountError extends SandboxError {
  constructor(
    message: string,
    public readonly mountPath: string,
    details?: Record<string, unknown>,
  ) {
    super(message, 'MOUNT_ERROR', { ...details, mountPath });
    this.name = 'MountError';
  }
}

/**
 * Error thrown when sandbox doesn't support mounting.
 */
export class MountNotSupportedError extends SandboxError {
  constructor(sandboxProvider: string) {
    super(`Sandbox provider '${sandboxProvider}' does not support mounting`, 'MOUNT_NOT_SUPPORTED', {
      sandboxProvider,
    });
    this.name = 'MountNotSupportedError';
  }
}

/**
 * Error thrown when a filesystem cannot be mounted.
 */
export class FilesystemNotMountableError extends SandboxError {
  constructor(filesystemProvider: string, reason?: string) {
    const message = reason
      ? `Filesystem '${filesystemProvider}' cannot be mounted: ${reason}`
      : `Filesystem '${filesystemProvider}' does not support mounting`;
    super(message, 'FILESYSTEM_NOT_MOUNTABLE', { filesystemProvider, reason });
    this.name = 'FilesystemNotMountableError';
  }
}
