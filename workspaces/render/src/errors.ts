export type RenderSandboxErrorCode =
  | 'CONFIGURATION'
  | 'AUTHENTICATION'
  | 'NOT_FOUND'
  | 'STATE'
  | 'BUSY'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'STREAM'
  | 'CLEANUP'
  | 'UNSUPPORTED'
  | 'FILE_LIMIT';

/** A transport/lifecycle failure, distinct from a command's nonzero exit. */
export class RenderSandboxError extends Error {
  readonly name = 'RenderSandboxError';
  constructor(
    public readonly code: RenderSandboxErrorCode,
    message: string,
    public readonly details: {
      sandboxId?: string;
      snapshotId?: string;
      sandboxGroupId?: string;
      stdout?: string;
      stderr?: string;
      stdoutDroppedBytes?: number;
      stderrDroppedBytes?: number;
      remoteMayBeRunning?: boolean;
      cleanupError?: unknown;
    } = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
