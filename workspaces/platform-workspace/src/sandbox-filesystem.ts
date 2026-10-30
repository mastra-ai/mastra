import { FilesApiFilesystem } from '@internal/workspace';
import type { FilesApi, FilesApiErrorKind, FilesCommandResult } from '@internal/workspace';
import type { ProviderStatus } from '@mastra/core/workspace';
import { InvalidArgumentError, NotFoundError, SandboxError, SandboxNotFoundError, TimeoutError } from 'e2b';

import type { E2BFiles } from './e2b-exec.js';

/** How `PlatformSandbox` lends its files API and shell to the filesystem. */
export interface E2BFilesRunner {
  readonly id: string;
  withFiles<T>(operation: string, fn: (files: E2BFiles) => Promise<T>): Promise<T>;
  /** Run a POSIX `sh` script in the sandbox. */
  runCommand(script: string): Promise<FilesCommandResult>;
}

/**
 * envd's edge answers a paused or missing sandbox with a 404 or 502 that the
 * SDK reports as `FileNotFoundError` or `TimeoutError`. Same message pattern as
 * `E2BSandbox`'s dead-sandbox check.
 */
const DEAD_SANDBOX = /\b(?:paused\s+)?sandbox(?:\s+\S+)?\s+(?:was\s+)?not found\b/i;

const isDeadSandbox = (error: unknown) =>
  error instanceof SandboxNotFoundError || (error instanceof Error && DEAD_SANDBOX.test(error.message));

/** A failure that isn't a file-level answer from envd: the sandbox is gone, the call timed out, or it failed before envd replied. */
export const isBrokenSandboxError = (error: unknown) =>
  isDeadSandbox(error) || error instanceof TimeoutError || !(error instanceof SandboxError);

/**
 * The disk of a {@link PlatformSandbox}, read and written through E2B's files
 * API directly on the VM, authenticated by the same lease `executeCommand`
 * uses. Copies, appends and no-clobber writes and moves run as one shell
 * command in the VM, so they are atomic and file bytes don't round-trip
 * through the host. Paths are absolute inside the sandbox; this class does not
 * confine paths or symlinks to any root.
 */
export class PlatformSandboxFilesystem extends FilesApiFilesystem {
  readonly id: string;
  readonly name = 'PlatformSandboxFilesystem';
  readonly provider = 'platform';
  status: ProviderStatus = 'ready';

  readonly #runner: E2BFilesRunner;

  constructor(runner: E2BFilesRunner) {
    super({ name: 'PlatformSandboxFilesystem' });
    this.id = `${runner.id}-filesystem`;
    this.#runner = runner;
  }

  protected runFiles<T>(operation: string, fn: (files: FilesApi) => Promise<T>): Promise<T> {
    return this.#runner.withFiles(operation, fn);
  }

  protected runCommand(_operation: string, script: string): Promise<FilesCommandResult> {
    return this.#runner.runCommand(script);
  }

  protected errorKind(error: unknown): FilesApiErrorKind | undefined {
    if (error instanceof NotFoundError && !isDeadSandbox(error)) return 'not-found';
    if (error instanceof InvalidArgumentError) return 'invalid-argument';
    return undefined;
  }
}
