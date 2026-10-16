import { ReadableStream } from 'node:stream/web';
import { describe, expect, it } from 'vitest';
import { MastraWorkflowStream } from './MastraWorkflowStream';
import type { ChunkType } from './types';

function createChunkStream(chunks: ChunkType[]): ReadableStream<ChunkType> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

const run = {
  runId: 'run-1',
  workflowId: 'workflow-1',
  _getExecutionResults: () => ({ status: 'success' }),
} as any;

const usageSteps = [
  { inputTokens: 10, outputTokens: 20, totalTokens: 30, reasoningTokens: 4, cachedInputTokens: 3 },
  { outputTokens: 5 },
];

describe('legacy stream usage aggregation', () => {
  it('keeps omitted workflow usage unknown while preserving reported details', async () => {
    const stream = new MastraWorkflowStream({
      run,
      createStream: () =>
        createChunkStream(
          usageSteps.map(
            usage =>
              ({
                type: 'step-finish',
                runId: 'run-1',
                payload: { usage },
              }) as ChunkType,
          ),
        ),
    });

    for await (const _chunk of stream) {
      // Drain the stream so the usage promise resolves.
    }

    await expect(stream.usage).resolves.toMatchObject({
      inputTokens: undefined,
      outputTokens: 25,
      totalTokens: undefined,
      cachedInputTokens: 3,
    });
  });
});
