export async function consumeStream({
  stream,
  onError,
}: {
  stream: ReadableStream;
  onError?: (error: unknown) => void;
}) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  } catch (error) {
    onError == null ? void 0 : onError(error);
  } finally {
    reader.releaseLock();
  }
}
