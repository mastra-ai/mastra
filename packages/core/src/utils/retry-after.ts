/**
 * Shared helpers for honoring a provider's `Retry-After` response header.
 *
 * Extracted from `processors/stream-error-retry-processor.ts` so the agent
 * model-call retry path (`stream/aisdk/v5/execute.ts`) applies the same bounded
 * semantics: a provider-controlled delay is respected but always capped, so a
 * large or hostile `Retry-After` cannot wedge a run.
 */

/** Maximum provider-controlled `Retry-After` delay honored by default. */
export const DEFAULT_MAX_RETRY_AFTER_MS = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getObjectCause(error: unknown): unknown {
  if (error instanceof Error) {
    return error.cause;
  }

  if (!isRecord(error)) {
    return undefined;
  }

  return error.cause;
}

function getHeaderValue(error: unknown, headerName: string): string | undefined {
  if (!isRecord(error) || !isRecord(error.responseHeaders)) {
    return undefined;
  }

  for (const [key, value] of Object.entries(error.responseHeaders)) {
    if (key.toLowerCase() === headerName && typeof value === 'string') {
      return value;
    }
  }

  return undefined;
}

/** `Retry-After-Ms` is always a whole number of milliseconds. */
function parseRetryAfterMsHeader(value: string): number | undefined {
  const normalizedValue = value.trim();
  if (!/^\d+$/.test(normalizedValue)) {
    return undefined;
  }

  const milliseconds = Number(normalizedValue);
  return Number.isFinite(milliseconds) ? milliseconds : undefined;
}

/** `Retry-After` is either delay-seconds or an HTTP-date. */
function parseRetryAfterHeader(value: string, now: number): number | undefined {
  const normalizedValue = value.trim();
  if (/^\d+$/.test(normalizedValue)) {
    const seconds = Number(normalizedValue);
    return Number.isFinite(seconds) ? seconds * 1_000 : undefined;
  }

  const retryAt = Date.parse(normalizedValue);
  return Number.isFinite(retryAt) && retryAt > now ? retryAt - now : undefined;
}

/**
 * Reads the provider's requested retry delay from an error or any error in its
 * `cause` chain.
 *
 * `Retry-After-Ms` takes precedence over `Retry-After` because it is the more
 * precise of the two; `Retry-After` accepts both delay-seconds and HTTP-date
 * forms. Returns undefined when neither header carries a usable value.
 */
export function getRetryAfterMs(error: unknown, now = Date.now()): number | undefined {
  const visited = new WeakSet<object>();
  let candidate = error;

  while (candidate !== undefined) {
    if (isRecord(candidate)) {
      if (visited.has(candidate)) return undefined;
      visited.add(candidate);

      const retryAfterMsHeader = getHeaderValue(candidate, 'retry-after-ms');
      if (retryAfterMsHeader !== undefined) {
        const retryAfterMs = parseRetryAfterMsHeader(retryAfterMsHeader);
        if (retryAfterMs !== undefined) return retryAfterMs;
      }

      const retryAfterHeader = getHeaderValue(candidate, 'retry-after');
      if (retryAfterHeader !== undefined) {
        const retryAfterMs = parseRetryAfterHeader(retryAfterHeader, now);
        if (retryAfterMs !== undefined) return retryAfterMs;
      }
    }

    candidate = getObjectCause(candidate);
  }

  return undefined;
}

/** Clamps a delay to a finite, non-negative number of milliseconds. */
export function clampDelayMs(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Waits `delayMs`, resolving early if `abortSignal` fires. */
export async function waitDelay(delayMs: number, abortSignal?: AbortSignal): Promise<void> {
  const ms = clampDelayMs(delayMs);
  if (ms <= 0) return;

  if (!abortSignal) {
    await new Promise<void>(resolve => setTimeout(resolve, ms));
    return;
  }

  await new Promise<void>(resolve => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const onAbort = () => {
      if (timeout) clearTimeout(timeout);
      abortSignal.removeEventListener('abort', onAbort);
      resolve();
    };
    // Register before checking aborted to close the race window where
    // abort fires between the check and addEventListener.
    abortSignal.addEventListener('abort', onAbort, { once: true });
    if (abortSignal.aborted) {
      onAbort();
      return;
    }
    timeout = setTimeout(() => {
      abortSignal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
  });
}
