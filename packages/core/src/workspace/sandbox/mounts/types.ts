/**
 * Shared types for local mount operations.
 */

export const LOG_PREFIX = '[LocalSandbox]';

/**
 * Context for local mount operations.
 * Uses a run function instead of E2B's sandbox.commands.run().
 */
export interface LocalMountContext {
  run: (
    command: string,
    args: string[],
    options?: { timeout?: number },
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  platform: NodeJS.Platform;
  logger: {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
}

/**
 * Error thrown when a required FUSE tool (s3fs, gcsfuse, macFUSE) is not installed.
 *
 * Distinguished from general mount errors so `LocalSandbox.mount()` can mark the
 * mount as `unavailable` (warning) rather than `error`. The workspace still works
 * via SDK filesystem methods — only sandbox process access to the mount path is affected.
 */
export class MountToolNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MountToolNotFoundError';
  }
}
