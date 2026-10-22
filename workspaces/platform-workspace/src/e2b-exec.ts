import type { CommandsApi } from '@internal/workspace';
import { CommandExitError, Sandbox, TimeoutError } from 'e2b';
import type { EntryInfo } from 'e2b';

import type { DirectExecOptions, DirectExecResult, ExecLease } from './direct-exec.js';

const E2B_ENVD_VERSION = '0.4.0';

export interface E2BExecLease extends ExecLease {
  sandboxId: string;
}

export type E2BExecRunner = (lease: E2BExecLease, options: DirectExecOptions) => Promise<DirectExecResult>;

export const execViaE2BLease: E2BExecRunner = async (lease, options) => {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const onStdout = (data: string) => {
    stdoutChunks.push(data);
    options.onStdout?.(data);
  };
  const onStderr = (data: string) => {
    stderrChunks.push(data);
    options.onStderr?.(data);
  };

  try {
    const sandbox = new Sandbox({
      sandboxId: lease.sandboxId,
      envdVersion: E2B_ENVD_VERSION,
      envdAccessToken: lease.jwt,
      sandboxUrl: lease.wsEndpoint,
      validateApiKey: false,
    });
    const result = await sandbox.commands.run(options.command, {
      cwd: options.cwd,
      envs: options.env,
      timeoutMs: options.timeoutMs,
      onStdout,
      onStderr,
    });
    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      truncated: false,
      timedOut: false,
      opened: true,
    };
  } catch (error) {
    if (error instanceof CommandExitError) {
      return {
        exitCode: error.exitCode,
        stdout: error.stdout,
        stderr: error.stderr,
        truncated: false,
        timedOut: false,
        opened: true,
      };
    }
    return {
      exitCode: null,
      stdout: stdoutChunks.join(''),
      stderr: stderrChunks.join(''),
      truncated: false,
      timedOut: error instanceof TimeoutError,
      closeReason: error instanceof Error ? error.message : String(error),
      opened: true,
    };
  }
};

/**
 * The subset of E2B's `sandbox.files` API that {@link PlatformSandboxFilesystem}
 * uses. Tests substitute a fake through `PlatformSandboxOptions.e2bFilesFactory`.
 */
export interface E2BFiles {
  read(path: string, opts: { format: 'bytes' }): Promise<Uint8Array>;
  write(path: string, data: string | ArrayBuffer): Promise<unknown>;
  list(path: string, opts?: { depth?: number }): Promise<EntryInfo[]>;
  makeDir(path: string): Promise<boolean>;
  rename(oldPath: string, newPath: string): Promise<unknown>;
  remove(path: string): Promise<void>;
  getInfo(path: string): Promise<EntryInfo>;
}

export type E2BFilesFactory = (lease: E2BExecLease) => E2BFiles;

export type E2BCommandsFactory = (lease: E2BExecLease) => CommandsApi;

/** The VM's envd API, authenticated by the exec lease. */
const sandboxForLease = (lease: E2BExecLease) =>
  new Sandbox({
    sandboxId: lease.sandboxId,
    envdVersion: E2B_ENVD_VERSION,
    envdAccessToken: lease.jwt,
    sandboxUrl: lease.wsEndpoint,
    validateApiKey: false,
  });

/** Opens E2B's files API directly against the VM, authenticated by the exec lease. */
export const e2bFilesForLease: E2BFilesFactory = lease => sandboxForLease(lease).files;

/** Opens E2B's commands API directly against the VM, authenticated by the exec lease. */
export const commandsForLease: E2BCommandsFactory = lease => sandboxForLease(lease).commands;
