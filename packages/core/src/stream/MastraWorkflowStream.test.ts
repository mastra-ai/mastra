import { ReadableStream } from 'node:stream/web';
import { describe, expect, it } from 'vitest';
import type { Run } from '../workflows';
import { MastraWorkflowStream } from './MastraWorkflowStream';
import type { ChunkType } from './types';

function createMockRun(): Run<any, any, any, any, any> {
  return {
    runId: 'test-run',
    workflowId: 'test-workflow',
    _getExecutionResults: async () => ({ status: 'success' }),
  } as unknown as Run<any, any, any, any, any>;
}

describe('MastraWorkflowStream error propagation', () => {
  it('rejects result/status/usage when createStream rejects', async () => {
    const boom = new Error('createStream failed');
    const stream = new MastraWorkflowStream({
      run: createMockRun(),
      createStream: () => Promise.reject(boom),
    });

    // Drain the readable so the start() callback runs to completion.
    const drain = (async () => {
      try {
        for await (const _ of stream) {
          // no-op
        }
      } catch {
        // controller.error surfaces here; ignored for this assertion
      }
    })();

    await expect(stream.result).rejects.toThrow('createStream failed');
    await expect(stream.status).rejects.toThrow('createStream failed');
    await expect(stream.usage).rejects.toThrow('createStream failed');
    await drain;
  });

  it('rejects result/status/usage when stream iteration throws', async () => {
    const boom = new Error('iteration failed');
    const stream = new MastraWorkflowStream({
      run: createMockRun(),
      createStream: () =>
        new ReadableStream<ChunkType>({
          start(controller) {
            controller.error(boom);
          },
        }),
    });

    const drain = (async () => {
      try {
        for await (const _ of stream) {
          // no-op
        }
      } catch {
        // ignored
      }
    })();

    await expect(stream.result).rejects.toThrow('iteration failed');
    await expect(stream.status).rejects.toThrow('iteration failed');
    await expect(stream.usage).rejects.toThrow('iteration failed');
    await drain;
  });
});
