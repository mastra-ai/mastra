import { CommandExitError, Sandbox, TimeoutError } from 'e2b';

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
