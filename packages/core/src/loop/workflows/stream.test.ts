import { describe, expect, it, vi } from 'vitest';
import { MessageList } from '../../agent/message-list';
import type { Processor, ProcessorStreamWriter } from '../../processors';
import { ChunkFrom } from '../../stream/types';
import type { ChunkType } from '../../stream/types';

// Capture the outputWriter passed to createAgenticLoopWorkflow so we can
// invoke it directly in tests without spinning up a real agentic loop.
let capturedOutputWriter: ((chunk: ChunkType) => Promise<void>) | undefined;

vi.mock('./agentic-loop', () => ({
  createAgenticLoopWorkflow: (params: any) => {
    capturedOutputWriter = params.outputWriter;

    return {
      __registerMastra: vi.fn(),
      deleteWorkflowRunById: vi.fn().mockResolvedValue(undefined),
      createRun: vi.fn().mockResolvedValue({
        start: vi.fn().mockImplementation(async () => {
          // Simulate the agentic loop emitting a data-* chunk
          await capturedOutputWriter!({
            type: 'data-moderation',
            data: { flagged: true },
            runId: 'run-1',
            from: ChunkFrom.AGENT,
          } as ChunkType);

          return {
            status: 'success',
            result: {
              output: { steps: [], usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
              stepResult: { reason: 'stop', warnings: [], isContinued: false },
              metadata: {},
              messages: { nonUser: [], all: [] },
            },
          };
        }),
      }),
    };
  },
}));

const { workflowLoopStream } = await import('./stream');

describe('workflowLoopStream', () => {
  it('should pass a defined writer to output processors when processing data-* chunks', async () => {
    let receivedWriter: ProcessorStreamWriter | undefined;

    const processor: Processor = {
      id: 'writer-capture',
      name: 'Writer Capture',
      processOutputStream: async ({ part, writer }) => {
        receivedWriter = writer;
        return part;
      },
    };

    const messageList = new MessageList({ threadId: 'test-thread' });

    const stream = workflowLoopStream({
      messageId: 'msg-1',
      runId: 'run-1',
      startTimestamp: Date.now(),
      agentId: 'test-agent',
      messageList,
      models: [{ model: {} as any, toolChoice: undefined }],
      outputProcessors: [processor],
      _internal: {},
      streamState: { serialize: () => ({}), deserialize: () => {} },
      methodType: 'stream',
    });

    // Consume the stream
    const reader = stream.getReader();
    const chunks: ChunkType[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (value) chunks.push(value);
      if (done) break;
    }

    // The processor should have received a defined writer
    expect(receivedWriter).toBeDefined();
    expect(typeof receivedWriter!.custom).toBe('function');

    // Verify the data-* chunk was emitted
    const dataChunk = chunks.find(c => c.type === 'data-moderation');
    expect(dataChunk).toBeDefined();
  });
});
