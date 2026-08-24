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
  /** Update an environment variable for future commands in this sandbox. */
  setEnvironmentVariable?(name: string, value: string): void;
  /** Tear down the underlying VM. Optional: providers without it are no-ops. */
  stop?(): Promise<void>;
}

/**
 * A coarse-grained step of the sandbox-preparation flow, reported as it happens
 * so the UI can show the user what the server is doing instead of a static
 * "Preparing…" toast. `phase` is a stable machine token; `message` is
 * user-facing copy.
 */
export interface PrepareProgress {
  /** `'reattaching'` is retained wire vocabulary for UI phase maps; the server no longer emits it. */
  phase: 'reattaching' | 'provisioning' | 'preparing-workspace' | 'cloning' | 'pulling' | 'finalizing' | 'done';
  message: string;
}

/** Callback invoked with each preparation step. Best-effort; never throws. */
export type ProgressFn = (event: PrepareProgress) => void;

/** Invoke a progress callback without letting it break the actual work. */
export function reportProgress(onProgress: ProgressFn | undefined, event: PrepareProgress): void {
  if (!onProgress) return;
  try {
    onProgress(event);
  } catch {
    // Progress reporting must never break the actual work.
  }
}
