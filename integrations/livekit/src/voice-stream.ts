/** A one-to-one mapping that awaits upstream cancellation, including pending reads. */
export function mapVoiceStream<Input, Output>(
  source: ReadableStream<Input>,
  map: (chunk: Input) => Output,
): ReadableStream<Output> {
  const reader = source.getReader();
  let cancelled = false;
  return new ReadableStream<Output>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (cancelled) return;
        if (done) controller.close();
        else controller.enqueue(map(value));
      } catch (error) {
        if (!cancelled) controller.error(error);
      }
    },
    cancel(reason) {
      cancelled = true;
      return reader.cancel(reason);
    },
  });
}
