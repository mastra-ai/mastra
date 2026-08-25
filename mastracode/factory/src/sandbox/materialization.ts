import type { WorkspaceSandbox } from '@mastra/core/workspace';

/** Result of one command executed inside a sandbox. */
export interface SandboxCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Minimal live-sandbox surface the materialization helpers need: an id, a way
 * to start it, and command execution.
 */
export interface MaterializationSandbox {
  readonly id: string;
  /** Human-readable provider name, forwarded from the underlying sandbox. */
  readonly name?: string;
  /** Provider type discriminator, forwarded from the underlying sandbox. */
  readonly provider?: string;
  /** Sandbox usage instructions surfaced in tool descriptions. */
  getInstructions?(opts?: { requestContext?: unknown }): string;
  /** Long-running process capability, when the provider supports it. */
  readonly processes?: WorkspaceSandbox['processes'];
  /** Mount capability, when the provider supports it. */
  readonly mounts?: WorkspaceSandbox['mounts'];
  start(): Promise<void>;
  getInfo(): Promise<{ metadata?: Record<string, unknown> }>;
  executeCommand(
    command: string,
    args?: string[],
    options?: { timeout?: number; env?: Record<string, string | undefined> },
  ): Promise<SandboxCommandResult>;
  /**
   * Update the sandbox's runtime environment for future commands. Mirrors
   * core's optional `WorkspaceSandbox.setEnv`, which every `MastraSandbox`
   * provides.
   */
  setEnv?: WorkspaceSandbox['setEnv'];
  /** Tear down the underlying VM. Optional: providers without it are no-ops. */
  stop?(): Promise<void>;
}
