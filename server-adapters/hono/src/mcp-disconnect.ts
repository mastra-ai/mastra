/**
 * Propagates a client disconnect to the simulated Node response produced by `toReqRes`.
 *
 * `fetch-to-node` builds the outgoing body from `res` events but never observes cancellation
 * of the stream it hands back. When an MCP Streamable HTTP client drops its session, nothing
 * tells `res` that the socket is gone, so the MCP transport keeps its SSE keep-alive timer
 * armed. The next keep-alive tick writes into an already-closed stream controller, and because
 * that write originates in a timer callback the resulting `ERR_INVALID_STATE` is unhandled and
 * takes down the process.
 *
 * Emitting `close` on `res` is the signal the MCP Node transport listens for: it aborts the
 * request's AbortController, which breaks the write loop and tears down the SSE stream,
 * clearing the keep-alive timer. No post-disconnect write is ever attempted.
 */
export function propagateClientDisconnect(
  fetchResponse: Response,
  res: { emit: (event: string) => void; destroy?: () => void },
): Response {
  const upstream = fetchResponse.body;
  if (!upstream) return fetchResponse;

  let disconnected = false;
  const disconnect = () => {
    if (disconnected) return;
    disconnected = true;
    try {
      res.emit('close');
    } catch {
      // Already torn down - the transport has nothing left to clean up.
    }
    // Deliberately *not* cancelling or destroying the bridge stream here. `fetch-to-node`
    // buffers writes and flushes them from a cork timer; tearing its controller down leaves
    // that pending flush to enqueue into a closed controller, which throws an unhandled
    // ERR_INVALID_STATE from a timer callback - the very crash this guards against.
    // Emitting `close` aborts the transport, which ends the response, so the bridge closes
    // its own controller in the right order once buffered data has drained.
    void reader.read().then(
      function drain({ done }): unknown {
        return done ? undefined : reader.read().then(drain);
      },
      () => {},
    );
  };

  const reader = upstream.getReader();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(value);
    },
    cancel() {
      disconnect();
    },
  });

  return new Response(body, {
    status: fetchResponse.status,
    statusText: fetchResponse.statusText,
    headers: fetchResponse.headers,
  });
}
