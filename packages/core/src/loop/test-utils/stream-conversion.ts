// Local stream-conversion test helpers.
//
// These mirror the utilities exported by `@ai-sdk/provider-utils@*/test`, but
// are defined locally on purpose: importing them from the published
// `@ai-sdk/provider-utils` `/test` entrypoint pulls in that package's own
// (separately-resolved) copy of `vitest`, which initializes a second
// `@vitest/snapshot` SnapshotClient. With two SnapshotClient instances loaded,
// `toMatchSnapshot()` in the loop test-utils fails with
// "The snapshot state ... is not found. Did you call 'SnapshotClient.setup()'?".
// Keeping these helpers vitest-free avoids loading that second copy.

export function convertArrayToReadableStream<T>(values: T[]): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const value of values) {
        controller.enqueue(value);
      }
      controller.close();
    },
  });
}

export async function convertReadableStreamToArray<T>(stream: ReadableStream<T>): Promise<T[]> {
  const reader = stream.getReader();
  const result: T[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result.push(value);
  }

  return result;
}

export async function convertAsyncIterableToArray<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of iterable) {
    result.push(item);
  }
  return result;
}
