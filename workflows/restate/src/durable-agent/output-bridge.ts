import { MessageList } from '@mastra/core/agent';
import type { CoreMessage } from '@mastra/core/llm';
import { MastraModelOutput } from '@mastra/core/stream';
import type { ChunkType } from '@mastra/core/stream';

import type { RestateAgentRunResult } from '../types';

/**
 * Reconstruct a `MastraModelOutput` client-side from the recorded chunks of
 * a completed Restate run. The returned output replays the journaled chunks
 * through a `ReadableStream`, so `output.text`, `output.fullStream`, and
 * `output.getFullOutput()` all work as if the agent had run locally.
 */
export function rebuildOutput(
  result: RestateAgentRunResult,
  options: { runId: string; messageId: string; messages: CoreMessage[] },
): MastraModelOutput {
  const { runId, messageId } = options;
  const chunks = (result.chunks ?? []) as ChunkType[];

  const stream = new ReadableStream<ChunkType>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

  const messageList = new MessageList().add(options.messages, 'input');

  return new MastraModelOutput({
    model: {
      modelId: result.modelId,
      provider: result.provider,
      version: 'v2',
    },
    stream,
    messageList,
    options: { runId },
    messageId,
  });
}
