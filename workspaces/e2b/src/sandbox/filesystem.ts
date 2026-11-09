import { FilesApiFilesystem } from '@internal/workspace';
import type { FilesApi, FilesApiErrorKind, FilesCommandResult } from '@internal/workspace';
import type { ProviderStatus } from '@mastra/core/workspace';
import { InvalidArgumentError, NotFoundError, SandboxNotFoundError } from 'e2b';
import type { Sandbox } from 'e2b';

import type { E2BSandbox } from './index';

type E2BFiles = Sandbox['files'];

/**
 * envd's edge answers a paused or missing sandbox with a 404 that the SDK
 * reports as `FileNotFoundError`. Same pattern as `E2BSandbox`'s dead-sandbox
 * check, so those errors reach `retryOnDead` instead of reading as a missing file.
 */
const DEAD_SANDBOX = /\b(?:paused\s+)?sandbox(?:\s+\S+)?\s+(?:was\s+)?not found\b/i;

/**
 * The disk of an {@link E2BSandbox}, read and written through E2B's files API
 * (`sandbox.e2b.files`). Each operation starts the sandbox if needed, and each
 * files call is retried once on a sandbox that died server-side, like
 * `executeCommand`. Copies, appends and no-clobber writes and moves run as one
 * shell command in the VM, so they are atomic and file bytes don't round-trip
 * through the host. Paths are absolute inside the sandbox; this class does not
 * confine paths or symlinks to any root.
 */
export class E2BSandboxFilesystem extends FilesApiFilesystem {
  readonly id: string;
  readonly name = 'E2BSandboxFilesystem';
  readonly provider = 'e2b';
  status: ProviderStatus = 'ready';

  readonly #sandbox: E2BSandbox;

  constructor(sandbox: E2BSandbox) {
    super({ name: 'E2BSandboxFilesystem' });
    this.id = `${sandbox.id}-filesystem`;
    this.#sandbox = sandbox;
  }

  /**
   * Wrap each files call in `retryOnDead`, so a sandbox that died mid-operation
   * is restarted and only the call that failed runs again; the calls before it
   * are never replayed. If the sandbox was killed and replaced rather than
   * paused, the rest of a multi-call operation runs against the new sandbox's disk.
   */
  protected async runFiles<T>(_operation: string, fn: (files: FilesApi) => Promise<T>): Promise<T> {
    await this.#sandbox.ensureRunning();
    // Re-read `e2b` on every call: after a restart it is a new handle.
    const call = <R>(invoke: (files: E2BFiles) => Promise<R>) =>
      this.#sandbox.retryOnDead(() => invoke(this.#sandbox.e2b.files));
    return fn({
      read: path => call(files => files.read(path, { format: 'bytes' })),
      write: (path, data) => call(files => files.write(path, data)),
      list: (path, opts) => call(files => files.list(path, opts)),
      makeDir: path => call(files => files.makeDir(path)),
      rename: (oldPath, newPath) => call(files => files.rename(oldPath, newPath)),
      remove: path => call(files => files.remove(path)),
      getInfo: path => call(files => files.getInfo(path)),
    });
  }

  protected runCommand(operation: string, script: string): Promise<FilesCommandResult> {
    // MastraSandbox builds executeCommand from the process manager, which E2BSandbox always has.
    if (!this.#sandbox.executeCommand) throw new Error(`${operation} needs E2BSandbox.executeCommand`);
    return this.#sandbox.executeCommand('sh', ['-c', script]);
  }

  protected errorKind(error: unknown): FilesApiErrorKind | undefined {
    if (
      error instanceof NotFoundError &&
      !(error instanceof SandboxNotFoundError) &&
      !(error instanceof Error && DEAD_SANDBOX.test(error.message))
    ) {
      return 'not-found';
    }
    if (error instanceof InvalidArgumentError) return 'invalid-argument';
    return undefined;
  }
}
