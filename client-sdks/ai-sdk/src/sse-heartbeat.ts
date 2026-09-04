const SSE_HEARTBEAT_BYTES = new TextEncoder().encode(': heartbeat\n\n');
const LF_BYTE = 10;
const MAX_TIMEOUT_MS = 2_147_483_647;

type StreamReadResult<T> = { done: false; value: T } | { done: true; value?: undefined };
type WakeReason = 'read' | 'heartbeat';

/** Throws when an enabled heartbeat interval cannot be scheduled with a timer. */
export function assertValidHeartbeatMs(heartbeatMs?: number): void {
  if (
    heartbeatMs !== undefined &&
    !(heartbeatMs <= 0) &&
    (!Number.isFinite(heartbeatMs) || heartbeatMs > MAX_TIMEOUT_MS)
  ) {
    throw new RangeError(`heartbeatMs must be a finite number no greater than ${MAX_TIMEOUT_MS}`);
  }
}

/**
 * Wraps an SSE `Response` so it emits periodic `: heartbeat` comments while the source is idle,
 * keeping connections alive through proxies that close idle streams.
 *
 * Heartbeats are only inserted between complete SSE frames. AI SDK serialization uses LF-delimited
 * frames, which this wrapper preserves and relies on.
 *
 * Returns the input response unchanged when `heartbeatMs` is omitted, is `<= 0`, or the response has
 * no body. Throws a `RangeError` when `heartbeatMs` is enabled but cannot be scheduled with a timer.
 */
export function withSseHeartbeat(response: Response, heartbeatMs?: number): Response {
  assertValidHeartbeatMs(heartbeatMs);
  if (heartbeatMs === undefined || heartbeatMs <= 0 || !response.body) {
    return response;
  }

  const reader = response.body.getReader();
  let heartbeatTimeout: ReturnType<typeof setTimeout> | undefined;
  let wakePull: ((reason: WakeReason) => void) | undefined;
  let readResult: StreamReadResult<Uint8Array> | undefined;
  let readError: unknown;
  let hasReadError = false;
  let reading = false;
  let finished = false;
  let readerReleased = false;
  let atFrameBoundary = true;
  let lastByte: number | undefined;
  let nextHeartbeatAt = performance.now() + heartbeatMs;

  const clearHeartbeat = () => {
    if (heartbeatTimeout !== undefined) {
      clearTimeout(heartbeatTimeout);
      heartbeatTimeout = undefined;
    }
  };

  const releaseReader = () => {
    if (readerReleased) return;
    readerReleased = true;
    reader.releaseLock();
  };

  const updateFrameBoundary = (chunk: Uint8Array) => {
    if (chunk.byteLength === 0) return;

    atFrameBoundary =
      chunk.byteLength === 1
        ? lastByte === LF_BYTE && chunk[0] === LF_BYTE
        : chunk[chunk.byteLength - 2] === LF_BYTE && chunk[chunk.byteLength - 1] === LF_BYTE;
    lastByte = chunk[chunk.byteLength - 1];
  };

  const startRead = () => {
    if (reading || readResult || hasReadError || finished) return;
    reading = true;
    void reader.read().then(
      result => {
        reading = false;
        readResult = result;
        wakePull?.('read');
      },
      error => {
        reading = false;
        readError = error;
        hasReadError = true;
        wakePull?.('read');
      },
    );
  };

  const forwardRead = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    if (hasReadError) {
      finished = true;
      releaseReader();
      controller.error(readError);
      return;
    }
    if (!readResult) return;

    const result = readResult;
    readResult = undefined;
    if (result.done) {
      finished = true;
      releaseReader();
      controller.close();
      return;
    }

    updateFrameBoundary(result.value);
    controller.enqueue(result.value);
  };

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (finished) return;
      startRead();

      // Buffered source results always win over an overdue heartbeat, so completion, errors,
      // and data are never delayed behind a comment.
      if (readResult || hasReadError) {
        forwardRead(controller);
        return;
      }

      const next = await new Promise<WakeReason>(resolve => {
        wakePull = resolve;
        // Heartbeats can only be inserted between complete SSE frames. AI SDK serialization emits
        // complete `data:` frames, so a split frame only pauses heartbeats until its remaining bytes arrive.
        // A ready source read settles in a microtask and outruns an overdue (0 ms) heartbeat timer.
        if (atFrameBoundary) {
          heartbeatTimeout = setTimeout(() => resolve('heartbeat'), Math.max(0, nextHeartbeatAt - performance.now()));
        }
      });

      wakePull = undefined;
      clearHeartbeat();
      if (finished) return;

      // Prefer source completion, errors, and data if they became available at the heartbeat deadline.
      if (readResult || hasReadError) {
        forwardRead(controller);
        return;
      }

      if (next === 'heartbeat') {
        controller.enqueue(SSE_HEARTBEAT_BYTES.slice());
        nextHeartbeatAt = performance.now() + heartbeatMs;
      }
    },
    async cancel(reason) {
      if (finished) return;
      finished = true;
      clearHeartbeat();
      try {
        await reader.cancel(reason);
      } finally {
        releaseReader();
      }
    },
  });

  return new Response(stream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
