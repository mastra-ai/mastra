interface NodeResponseLike {
  on(event: 'close' | 'drain', listener: () => void): unknown;
  once(event: 'close' | 'drain', listener: () => void): unknown;
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
    if (canceled) return;
    canceled = true;
    void reader.cancel(reason).catch(() => {});
  };
  const onClose = () => cancel('request aborted');
  res.on('close', onClose);
  if (res.destroyed) onClose();
  return { cancel, dispose: () => res.off('close', onClose) };
}

/**
 * Writes `chunk` and, when the socket buffer is full, waits for `drain` so a slow client pauses reads from the
 * upstream stream instead of growing the buffer. Resolves on `close` too, so a dropped client never stalls the caller.
 */
export async function writeWithBackpressure(res: NodeResponseLike, chunk: unknown): Promise<void> {
  if (res.write(chunk) !== false || res.destroyed) return;
  // `once` matters: the `compression` middleware routes `res.on('drain')` to its zlib stream but not `res.off`, so
  // only a listener that removes itself on firing is cleaned up there.
  await new Promise<void>(resolve => {
    const done = () => {
      res.off('drain', done);
      res.off('close', done);
      resolve();
    };
    res.once('drain', done);
    res.once('close', done);
  });
}
