export type TimeoutType = 'step' | 'total';

export class MastraTimeoutError extends Error {
  readonly timeoutType: TimeoutType;
  readonly timeoutMs: number;

  constructor(timeoutType: TimeoutType, timeoutMs: number) {
    super(`${timeoutType === 'step' ? 'Model step' : 'Agent run'} timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.timeoutType = timeoutType;
    this.timeoutMs = timeoutMs;
  }
}

export function isMastraTimeoutError(error: unknown): error is MastraTimeoutError {
  return error instanceof MastraTimeoutError;
}

export function getAbortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted', 'AbortError');
}

export function createTimeoutAbortSignal({
  parentSignal,
  timeoutMs,
  timeoutType,
}: {
  parentSignal?: AbortSignal;
  timeoutMs?: number;
  timeoutType: TimeoutType;
}): {
  signal?: AbortSignal;
  cleanup: () => void;
  timeoutPromise?: Promise<never>;
} {
  if (timeoutMs === undefined) {
    return { signal: parentSignal, cleanup: () => {} };
  }

  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => {
        const error = new MastraTimeoutError(timeoutType, timeoutMs);
        controller.abort(error);
        reject(error);
      },
      Math.max(0, timeoutMs),
    );
    timeoutHandle.unref?.();
  });
  timeoutPromise.catch(() => {});

  const abortFromParent = () => controller.abort(getAbortReason(parentSignal!));

  if (parentSignal?.aborted) {
    abortFromParent();
  } else {
    parentSignal?.addEventListener('abort', abortFromParent, { once: true });
  }

  return {
    signal: controller.signal,
    timeoutPromise,
    cleanup: () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      parentSignal?.removeEventListener('abort', abortFromParent);
    },
  };
}

export async function raceAgainstAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) {
    return promise;
  }

  if (signal.aborted) {
    throw getAbortReason(signal);
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(getAbortReason(signal));
    signal.addEventListener('abort', onAbort, { once: true });

    promise.then(
      value => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      error => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}
