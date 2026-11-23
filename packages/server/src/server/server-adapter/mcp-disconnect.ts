/**
 * Forwards a fetch `Request` abort to the simulated Node response used by fetch-based
 * adapters (Hono, Elysia, Next) to drive the MCP Node transport.
 *
 * `fetch-to-node`'s `toReqRes` ignores `Request.signal`, and the MCP Node transport only
 * aborts an in-flight request when `res` emits `close`. Without this, a client that
 * disconnects before any response bytes are sent leaves the tool call running to completion.
 *
 * Call it after `startHTTP` has been invoked so the transport's `close` listener is attached.
 */
export function propagateRequestAbort(
  signal: AbortSignal | undefined,
  res: {
    emit: (event: string) => boolean | void;
    once: (event: string, listener: () => void) => unknown;
    writableFinished?: boolean;
  },
): void {
  if (!signal) return;

  const onAbort = () => {
    if (res.writableFinished) return;
    try {
      res.emit('close');
    } catch {
      // Already torn down - nothing left to abort.
    }
  };

  if (signal.aborted) {
    onAbort();
    return;
  }

  signal.addEventListener('abort', onAbort, { once: true });
  res.once('finish', () => signal.removeEventListener('abort', onAbort));
}
