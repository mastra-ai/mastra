export type AsyncIterableStream<T> = AsyncIterable<T> & ReadableStream<T>;

async function* streamGeneratorPolyfill<T>(
  this: ReadableStream<T>,
): AsyncIterator<T, undefined, unknown> {
  const reader = this.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

export function asAsyncIterableStream<T>(
  source: ReadableStream<T>,
): AsyncIterableStream<T> {
  (source as AsyncIterableStream<T>)[Symbol.asyncIterator] ??=
    streamGeneratorPolyfill;
  return source as AsyncIterableStream<T>;
}
