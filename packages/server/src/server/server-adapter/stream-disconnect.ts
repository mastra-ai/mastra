interface NodeResponseLike {
  on(event: 'close' | 'drain', listener: () => void): unknown;
  off(event: 'close' | 'drain', listener: () => void): unknown;
  write(chunk: any): boolean;
  destroyed?: boolean;
}

/**
 * Cancels `reader` once when the Node response closes, so a disconnected client stops the upstream stream.
 *
 * Cancels right away when the response is already destroyed: if the client dropped while the route handler
 * was still running, `close` fired before this listener existed. Call `dispose()` before ending the response
 * so the close that follows a normal end does not cancel.
 */
export function cancelReaderOnResponseClose(
  reader: ReadableStreamDefaultReader<unknown>,
  res: NodeResponseLike,
): { cancel: (reason: string) => void; dispose: () => void } {
  let canceled = false;
  const cancel = (reason: string) => {
    if (canceled) {
      return;
    }

    canceled = true;
    void reader.cancel(reason).catch(() => {});
  };
  const onClose = () => cancel('request aborted');
  res.on('close', onClose);

  if (res.destroyed) {
    onClose();
  }

  return { cancel, dispose: () => res.off('close', onClose) };
}

// Writes waiting for `drain`, per response. Each response gets one `drain` and one `close` listener for its whole life
// instead of one pair per wait: the `compression` middleware forwards `res.on('drain')` to its zlib stream but not
// `res.off`, so a listener removed after every wait would still pile up there.
const pendingWrites = new WeakMap<NodeResponseLike, Array<() => void>>();

function getPendingWrites(res: NodeResponseLike): Array<() => void> {
  const existing = pendingWrites.get(res);

  if (existing) {
    return existing;
  }

  const queue: Array<() => void> = [];
  const release = () => {
    for (const resolve of queue.splice(0)) resolve();
  };
  res.on('drain', release);
  res.on('close', release);
  pendingWrites.set(res, queue);
  return queue;
}

/**
 * Writes `chunk` and, when the socket buffer is full, waits for `drain` so a slow client pauses reads from the
 * upstream stream instead of growing the buffer. Resolves on `close` too, so a dropped client never stalls the caller.
 */
export async function writeWithBackpressure(res: NodeResponseLike, chunk: unknown): Promise<void> {
  if (res.write(chunk) !== false || res.destroyed) {
    return;
  }

  await new Promise<void>(resolve => getPendingWrites(res).push(resolve));
}
