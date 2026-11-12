import type { RequestOptions } from '../types';
import { MastraClientError } from '../types';
import { mergeAbortSignals } from '../utils';
import type { BaseResource } from './base';

export type SignalWriteOptions = Pick<RequestOptions, 'signal' | 'headers' | 'credentials' | 'retries'> & {
  /** How long to wait for missing anchors, from the first anchor 404. Default/max: 30 seconds. Zero disables anchor retries. */
  anchorRetryTimeoutMs?: number;
};

function isMissingAnchor(error: unknown): error is MastraClientError {
  if (!(error instanceof MastraClientError) || error.status !== 404) return false;
  const code = (error.body as { code?: unknown } | undefined)?.code;
  return code === 'TRACE_NOT_FOUND' || code === 'SPAN_NOT_FOUND';
}

/** Adds bounded anchor retries to the normal transport retries, with one immutable payload. */
export async function writeSignal<T>(
  resource: BaseResource,
  path: string,
  method: 'POST' | 'PUT',
  body: object,
  options: SignalWriteOptions = {},
): Promise<T> {
  const { anchorRetryTimeoutMs = 30_000, ...requestOptions } = options;
  if (!Number.isSafeInteger(anchorRetryTimeoutMs) || anchorRetryTimeoutMs < 0 || anchorRetryTimeoutMs > 30_000) {
    throw new RangeError('anchorRetryTimeoutMs must be an integer between 0 and 30000');
  }
  const payload: unknown = JSON.parse(JSON.stringify(body));
  const deadline = new AbortController();
  const signal = mergeAbortSignals(resource.options.abortSignal, options.signal, deadline.signal)!;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastAnchorError: MastraClientError | undefined;
  let delay = Math.max(1, resource.options.backoffMs ?? 100);
  try {
    for (;;) {
      try {
        return await resource.request<T>(path, { ...requestOptions, method, body: payload, signal });
      } catch (error) {
        if (signal.aborted) throw error;
        if (!isMissingAnchor(error) || anchorRetryTimeoutMs === 0) throw error;
        lastAnchorError = error;
        timer ??= setTimeout(() => deadline.abort(), anchorRetryTimeoutMs);
      }
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          clearTimeout(wait);
          reject(signal.reason);
        };
        const wait = setTimeout(() => {
          signal.removeEventListener('abort', onAbort);
          resolve();
        }, delay);
        signal.addEventListener('abort', onAbort, { once: true });
        if (signal.aborted) onAbort();
      });
      delay = Math.max(1, Math.min(delay * 2, resource.options.maxBackoffMs ?? 1000));
    }
  } catch (error) {
    const deadlineFired = deadline.signal.aborted && !options.signal?.aborted && !resource.options.abortSignal?.aborted;
    if (
      deadlineFired &&
      (error === deadline.signal.reason || (error instanceof Error && error.name === 'AbortError'))
    ) {
      throw lastAnchorError ?? error;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    deadline.abort(); // Release merged-signal listeners after completion.
  }
}
