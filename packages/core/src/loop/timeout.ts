/**
 * Error thrown when a Mastra execution budget (`modelSettings.timeout`) is exceeded.
 *
 * This is distinct from a caller-supplied abort so that timeouts can be reported as
 * failures rather than treated as clean cancellations.
 */
export class MastraTimeoutError extends Error {
  readonly timeoutType: 'step' | 'total';
  readonly timeoutMs: number;

  constructor({ timeoutType, timeoutMs }: { timeoutType: 'step' | 'total'; timeoutMs: number }) {
    super(
      timeoutType === 'total'
        ? `Agent execution timed out after ${timeoutMs}ms (modelSettings.timeout.totalMs)`
        : `Model call timed out after ${timeoutMs}ms (modelSettings.timeout.stepMs)`,
    );
    this.name = 'MastraTimeoutError';
    this.timeoutType = timeoutType;
    this.timeoutMs = timeoutMs;
  }
}

export function isMastraTimeoutError(error: unknown): error is MastraTimeoutError {
  return error instanceof MastraTimeoutError;
}

/**
 * Returns the abort reason of a signal, if it has been aborted.
 */
export function getAbortReason(signal?: AbortSignal): unknown {
  return signal?.aborted ? signal.reason : undefined;
}

export type TimeoutAbortSignal = {
  /** The signal to pass downstream. Identical to `parentSignal` when no timeout is configured. */
  signal: AbortSignal | undefined;
  /** Rejects with a `MastraTimeoutError` when the budget elapses. Undefined when no timeout is configured. */
  timeoutPromise?: Promise<never>;
  /** Clears the timer and detaches listeners. Safe to call more than once. */
  cleanup: () => void;
};

/**
 * Composes a caller-supplied abort signal with a time budget.
 *
 * When `timeoutMs` is undefined this is a pass-through: the parent signal is returned
 * unchanged and no timer is created.
 */
export function createTimeoutAbortSignal({
  parentSignal,
  timeoutMs,
  timeoutType,
}: {
  parentSignal?: AbortSignal;
  timeoutMs?: number;
  timeoutType: 'step' | 'total';
}): TimeoutAbortSignal {
  if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return { signal: parentSignal, cleanup: () => {} };
  }

  const controller = new AbortController();

  let rejectTimeout: ((error: MastraTimeoutError) => void) | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    rejectTimeout = reject;
  });
  // The race loser is never observed by callers, so pre-attach a handler.
  timeoutPromise.catch(() => {});

  const timer = setTimeout(() => {
    const error = new MastraTimeoutError({ timeoutType, timeoutMs });
    controller.abort(error);
    rejectTimeout?.(error);
  }, timeoutMs);
  // Never hold the process open on account of a pending budget.
  timer.unref?.();

  const onParentAbort = () => {
    controller.abort(parentSignal?.reason);
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      onParentAbort();
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    timeoutPromise,
    cleanup: () => {
      clearTimeout(timer);
      parentSignal?.removeEventListener('abort', onParentAbort);
    },
  };
}

/**
 * Rejects as soon as `signal` aborts, otherwise resolves with `promise`.
 *
 * Guards against providers that ignore `abortSignal` and would otherwise hang past
 * their budget.
 */
/**
 * Keeps a budget in force while a stream is consumed.
 *
 * Establishing a stream is rarely the slow part — a provider can open one and then stall
 * mid-emission — so the budget has to stay armed until the stream ends. Errors the stream
 * with the abort reason if the signal fires before it completes, and cancels the upstream
 * so the provider connection is not left dangling.
 *
 * `onSettled` runs exactly once, whether the stream completes, errors or aborts.
 */
export function guardStreamWithAbort<T>(
  stream: ReadableStream<T>,
  signal?: AbortSignal,
  onSettled?: () => void,
): ReadableStream<T> {
  if (!signal) {
    if (!onSettled) return stream;
    return stream.pipeThrough(
      new TransformStream<T, T>({
        flush: () => onSettled(),
      }) as any,
    ) as ReadableStream<T>;
  }

  const reader = stream.getReader();
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    onSettled?.();
  };

  return new ReadableStream<T>({
    async pull(controller) {
      try {
        const { done, value } = await raceAgainstAbort(reader.read(), signal);
        if (done) {
          settle();
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        settle();
        reader.cancel(error).catch(() => {});
        controller.error(error);
      }
    },
    cancel(reason) {
      settle();
      return reader.cancel(reason);
    },
  });
}

export function raceAgainstAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;

  if (signal.aborted) {
    promise.catch(() => {});
    return Promise.reject(signal.reason ?? new Error('Aborted'));
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(signal.reason ?? new Error('Aborted'));
    };
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
