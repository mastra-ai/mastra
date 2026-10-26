// Comments belong to the HTTP transport, never to the durable event log.
export function withAgentSseHeartbeat(
  stream: ReadableStream<unknown>,
  intervalMs = 25_000,
  signal?: AbortSignal,
): ReadableStream<unknown> {
  if (intervalMs === 0) return stream;

  const reader = stream.getReader();
  let reading = false;
  let settled: { result: Awaited<ReturnType<typeof reader.read>> } | { error: unknown } | undefined;
  let wake: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let cancelPromise: Promise<void> | undefined;
  let output: ReadableStreamDefaultController<unknown>;
  const clearTimer = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const cleanup = () => {
    closed = true;
    clearTimer();
    signal?.removeEventListener('abort', onAbort);
    wake?.();
  };
  const cancel = (reason?: unknown) => {
    cleanup();
    return (cancelPromise ??= reader.cancel(reason));
  };
  const onAbort = () => {
    if (closed) return;
    output.close();
    void cancel(signal?.reason).catch(() => {});
  };

  return new ReadableStream<unknown>(
    {
      start(controller) {
        output = controller;
        signal?.addEventListener('abort', onAbort, { once: true });
        if (signal?.aborted) onAbort();
      },
      async pull(controller) {
        if (closed) return;
        // Attach only one settlement handler per read, even across many heartbeats.
        if (!reading && !settled) {
          reading = true;
          void reader.read().then(
            result => {
              reading = false;
              settled = { result };
              wake?.();
            },
            error => {
              reading = false;
              settled = { error };
              wake?.();
            },
          );
        }
        if (!settled) {
          await new Promise<void>(resolve => {
            wake = resolve;
            timer = setTimeout(resolve, intervalMs);
          });
        }
        wake = undefined;
        clearTimer();
        if (closed) return;
        try {
          // Data that settles at the heartbeat boundary takes precedence.
          if (!settled) {
            controller.enqueue(': heartbeat\n\n');
            return;
          }
          const next = settled;
          settled = undefined;
          if ('error' in next) throw next.error;
          if (next.result.done) {
            cleanup();
            reader.releaseLock();
            controller.close();
          } else {
            controller.enqueue(next.result.value);
          }
        } catch (error) {
          if (closed) return;
          controller.error(error);
          void cancel(error).catch(() => {});
        }
      },
      cancel,
    },
    // Only pull for an actual read. An unread HTTP consumer must not accumulate pings.
    { highWaterMark: 0 },
  );
}
