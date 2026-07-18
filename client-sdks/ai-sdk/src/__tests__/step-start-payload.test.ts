import { ReadableStream } from 'node:stream/web';
import { ChunkFrom } from '@mastra/core/stream';
import type { ChunkType, MastraModelOutput } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';

import { toAISdkStream } from '../convert-streams';
import { convertMastraChunkToAISDKv5, convertMastraChunkToAISDKv6 } from '../helpers';

async function collectChunks(stream: ReadableStream) {
  const chunks: any[] = [];

  for await (const chunk of stream as any) {
    chunks.push(chunk);
  }

  return chunks;
}

function createPayloadlessStepStartStream() {
  return new ReadableStream<ChunkType>({
    start(controller) {
      controller.enqueue({
        type: 'start',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: { messageId: 'msg-1' },
      } as ChunkType);
      controller.enqueue({
        type: 'step-start',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
      } as unknown as ChunkType);
      controller.close();
    },
  });
}

describe('step-start chunk conversion', () => {
  it('converts payload-less step-start chunks for v5', () => {
    const chunk = {
      type: 'step-start',
      runId: 'run-1',
      from: ChunkFrom.AGENT,
    } as unknown as ChunkType;

    expect(convertMastraChunkToAISDKv5({ chunk, mode: 'stream' })).toEqual({
      type: 'start-step',
      request: undefined,
      warnings: [],
    });
  });

  it('converts payload-less step-start chunks for v6', () => {
    const chunk = {
      type: 'step-start',
      runId: 'run-1',
      from: ChunkFrom.AGENT,
    } as unknown as ChunkType;

    expect(convertMastraChunkToAISDKv6({ chunk, mode: 'stream' })).toEqual({
      type: 'start-step',
      request: undefined,
      warnings: [],
    });
  });

  it('keeps v5 agent UI streams open when DurableAgent emits payload-less step-start', async () => {
    const chunks = await collectChunks(
      toAISdkStream(createPayloadlessStepStartStream() as unknown as MastraModelOutput, { from: 'agent' }),
    );

    expect(chunks).toEqual([{ type: 'start', messageId: 'msg-1' }, { type: 'start-step' }]);
  });

  it('keeps v6 agent UI streams open when DurableAgent emits payload-less step-start', async () => {
    const chunks = await collectChunks(
      toAISdkStream(createPayloadlessStepStartStream() as unknown as MastraModelOutput, {
        from: 'agent',
        version: 'v6',
      }),
    );

    expect(chunks).toEqual([{ type: 'start', messageId: 'msg-1' }, { type: 'start-step' }]);
  });
});
