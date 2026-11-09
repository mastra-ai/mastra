import type { IMastraLogger } from '../../../../logger';

export type ConsumeStreamOptions = {
  onError?: (error: unknown) => void;
  logger?: IMastraLogger;
};

export async function consumeStream({
  stream,
  onError,
  logger,
}: {
  stream: ReadableStream;
  onError?: (error: unknown) => void;
  logger?: IMastraLogger;
}): Promise<void> {
  // Acquire the reader inside the try: a stream that is already locked by another
  // consumer must surface through onError, not as a rejection of this promise.
  let reader: ReadableStreamDefaultReader | undefined;
  try {
    reader = stream.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  } catch (error) {
    logger?.error('consumeStream error', error);
    onError?.(error);
  } finally {
    reader?.releaseLock();
  }
}
