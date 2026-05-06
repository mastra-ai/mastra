import { randomUUID } from 'node:crypto';
import { ReadableStream } from 'node:stream/web';
import { MastraModelOutput } from '../stream/base/output';
import type { ChunkType } from '../stream/types';
import { MessageList } from './message-list';
import type { CachedAgentResponse } from './response-cache';

/**
 * Construct a `MastraModelOutput` that replays a cached agent response.
 *
 * The cached chunks are fed into a fresh `MastraModelOutput` via a synthetic
 * `ReadableStream`. Output processors are intentionally left empty because
 * the cached chunks already reflect post-processor output — re-running them
 * would double up. The internal chunk-buffering pipeline still resolves all
 * the `MastraModelOutput`'s delayed promises (text, finishReason, usage,
 * tool calls, etc.) from the replayed chunks, so consumers see identical
 * behaviour to a live response.
 *
 * @internal
 */
export function replayCachedAgentResponse<OUTPUT>({
  cached,
  modelInfo,
  threadId,
}: {
  cached: CachedAgentResponse<OUTPUT>;
  modelInfo: { provider?: string; modelId?: string; specVersion?: string };
  threadId?: string;
}): MastraModelOutput<OUTPUT> {
  const messageList = new MessageList({ threadId });
  // Restore any DB messages the live run produced so consumers that read
  // `output.messageList` after a cache hit see the same conversation state.
  const dbMessages = cached.fullOutput.messages;
  if (Array.isArray(dbMessages) && dbMessages.length > 0) {
    for (const msg of dbMessages) {
      messageList.add(msg, 'response');
    }
  }

  const chunks = cached.chunks ?? [];
  const stream = new ReadableStream<ChunkType<OUTPUT>>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

  const version = (modelInfo.specVersion === 'v3' ? 'v3' : 'v2') as 'v2' | 'v3';

  return new MastraModelOutput<OUTPUT>({
    model: {
      modelId: modelInfo.modelId,
      provider: modelInfo.provider,
      version,
    },
    stream,
    messageList,
    messageId: randomUUID(),
    options: {
      runId: cached.fullOutput.runId ?? randomUUID(),
      // Output processors intentionally omitted — the cached chunks already
      // include any modifications the original processors made.
    },
  });
}
