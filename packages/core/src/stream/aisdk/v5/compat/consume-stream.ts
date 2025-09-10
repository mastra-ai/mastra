export type ConsumeStreamOptions = {
  onError?: (error: unknown) => void;
};

export async function consumeStream({
  stream,
  onError,
}: {
  stream: ReadableStream;
  onError?: (error: unknown) => void;
}): Promise<void> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  } catch (error) {
    console.log('consumeStream error', error);
    onError?.(error);
  } finally {
    reader.releaseLock();
  }
}
