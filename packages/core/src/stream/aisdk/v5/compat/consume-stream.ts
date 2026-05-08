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
  const reader = stream.getReader();
  try {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  } catch (error) {
    logger?.error('consumeStream error', error);
    onError?.(error);
  } finally {
    reader.releaseLock();
  }
}
