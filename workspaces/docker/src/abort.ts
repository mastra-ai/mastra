import { SandboxAbortError } from '@mastra/core/workspace';

export function createAbortError(signal: AbortSignal, operation: string): SandboxAbortError {
  return new SandboxAbortError(operation, signal.reason);
}

export function throwIfAborted(signal: AbortSignal | undefined, operation: string): void {
  if (signal?.aborted) throw createAbortError(signal, operation);
}

export function isAbortError(error: unknown): boolean {
  return (
    error instanceof SandboxAbortError ||
    (error instanceof Error && (error.name === 'AbortError' || ('code' in error && error.code === 'ABORT_ERR')))
  );
}

export function normalizeAbortError(error: unknown, operation: string): unknown {
  return error instanceof SandboxAbortError
    ? error
    : isAbortError(error)
      ? new SandboxAbortError(operation, error)
      : error;
}

export function waitForAbortable<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
  operation: string,
  onAbort?: () => void,
): Promise<T> {
  throwIfAborted(signal, operation);
  if (!signal) return promise;

  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      onAbort?.();
      reject(new SandboxAbortError(operation, signal.reason));
    };
    signal.addEventListener('abort', abort, { once: true });
    promise.then(
      value => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      error => {
        signal.removeEventListener('abort', abort);
        reject(normalizeAbortError(error, operation));
      },
    );
  });
}
