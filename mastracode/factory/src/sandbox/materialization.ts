import type { ExecuteCommandOptions, WorkspaceSandbox } from '@mastra/core/workspace';

/** Result of one command executed inside a sandbox. */
export interface SandboxCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * A sandbox that can run commands.
 *
 * `executeCommand` is optional on `WorkspaceSandbox` because some providers
 * only offer a filesystem. Every git and materialization helper here needs it,
 * so this type promotes it to required. `id` is taken from core; the command
 * signature is spelled out because core's `CommandResult` is wider than what
 * these helpers read (see below).
 */
export type ExecutableSandbox = Pick<WorkspaceSandbox, 'id'> & {
  /**
   * Runs a command. The options are core's, but the result is only the part
   * these helpers read: core's `CommandResult` also carries `success` and
   * `executionTimeMs`, and asking for them would reject test doubles that
   * report exactly what the helpers consume.
   */
  executeCommand(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<SandboxCommandResult>;
};

/**
 * Narrow a sandbox to one that can run commands, or fail saying which
 * capability is missing.
 *
 * Callers hold a `WorkspaceSandbox`, whose `executeCommand` is optional.
 * Optional-chaining past it would hand every caller `undefined` where it
 * expects an exit code, turning a misconfigured provider into a git command
 * that silently did nothing.
 */
export function requireExec(sandbox: WorkspaceSandbox): ExecutableSandbox {
  if (typeof sandbox.executeCommand !== 'function') {
    throw new Error(
      `Sandbox provider '${sandbox.provider}' does not support executeCommand, which is required to run git and filesystem operations in a session.`,
    );
  }
  return sandbox as ExecutableSandbox;
}
