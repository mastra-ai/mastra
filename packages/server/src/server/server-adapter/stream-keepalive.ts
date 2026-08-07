/**
 * Keepalive frame for `text/event-stream` responses: an SSE comment, which every
 * spec-compliant SSE consumer ignores.
 */
export const SSE_KEEPALIVE_FRAME = ': keepalive\n\n';

/**
 * Keepalive frame for record-separator delimited responses: an empty record, which
 * client parsers skip.
 */
export const RECORD_SEPARATOR_KEEPALIVE_FRAME = '\x1E';

const KEEPALIVE = Symbol('keepalive');

export type StreamRead<T> = { type: 'chunk'; value: T } | { type: 'keepalive' };

type ReadResult<T> = Awaited<ReturnType<ReadableStreamDefaultReader<T>['read']>>;

/**
 * Reads a stream, yielding a `keepalive` marker whenever the source stays silent for
 * longer than `keepaliveMs`. Callers write the framing-appropriate keepalive frame so
 * intermediary infrastructure does not close a stream that is merely waiting on slow
 * work (e.g. a workflow step running for minutes without emitting events).
 *
 * A pending read is never dropped: it carries over to the next iteration, so a chunk
 * that arrives while a keepalive is emitted is still delivered in order.
 *
 * @param keepaliveMs Idle interval between keepalives. Values <= 0 disable them.
 */
export async function* readWithKeepalive<T>(
  reader: ReadableStreamDefaultReader<T>,
  keepaliveMs: number,
): AsyncGenerator<StreamRead<T>, void, undefined> {
  let pending: Promise<ReadResult<T>> | undefined;

  while (true) {
    if (!pending) {
      pending = reader.read();
      // Keep rejections attributed to a handled promise; the loop still awaits and rethrows them.
      void pending.catch(() => {});
    }

    if (keepaliveMs <= 0) {
      const result = await pending;
      pending = undefined;
      if (result.done) return;
      yield { type: 'chunk', value: result.value };
      continue;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const idle = new Promise<typeof KEEPALIVE>(resolve => {
      timer = setTimeout(() => resolve(KEEPALIVE), keepaliveMs);
    });

    let read: ReadResult<T> | typeof KEEPALIVE;
    try {
      read = await Promise.race([pending, idle]);
    } finally {
      clearTimeout(timer);
    }

    if (read === KEEPALIVE) {
      yield { type: 'keepalive' };
      continue;
    }

    pending = undefined;
    if (read.done) return;
    yield { type: 'chunk', value: read.value };
  }
}
