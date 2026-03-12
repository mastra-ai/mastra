import { ReadableStream } from 'node:stream/web';
import { describe, expect, it } from 'vitest';
import { MessageList } from '../../agent/message-list';
import type { Processor, ProcessorStreamWriter } from '../../processors';
import { ChunkFrom } from '../types';
import type { ChunkType } from '../types';
import { MastraModelOutput } from './output';

/**
 * Creates a ReadableStream that emits the given chunks in order.
 */
function createChunkStream<OUTPUT = undefined>(chunks: ChunkType<OUTPUT>[]): ReadableStream<ChunkType<OUTPUT>> {
  return new ReadableStream<ChunkType<OUTPUT>>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

/**
 * Minimal step-finish chunk to populate bufferedSteps before the finish chunk.
 */
function createStepFinishChunk(runId: string): ChunkType {
  return {
    type: 'step-finish',
    runId,
    from: ChunkFrom.AGENT,
    payload: {
      id: 'step-1',
      output: {
        steps: [],
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      },
      stepResult: {
        reason: 'stop',
        warnings: [],
        isContinued: false,
      },
      metadata: {},
      messages: { nonUser: [], all: [] },
    },
  } as ChunkType;
}

/**
 * Minimal finish chunk for the outer MastraModelOutput.
 */
function createFinishChunk(runId: string): ChunkType {
  return {
    type: 'finish',
    runId,
    from: ChunkFrom.AGENT,
    payload: {
      id: 'finish-1',
      output: {
        steps: [],
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      },
      stepResult: {
        reason: 'stop',
        warnings: [],
        isContinued: false,
      },
      metadata: {},
      messages: { nonUser: [], all: [] },
    },
  } as ChunkType;
}

describe('MastraModelOutput', () => {
  describe('streaming tool-call delta reassembly', () => {
    function createToolCallDeltaSequence(
      runId: string,
      toolCallId: string,
      toolName: string,
      deltas: string[],
    ): ChunkType[] {
      const chunks: ChunkType[] = [];

      chunks.push({
        type: 'tool-call-input-streaming-start',
        runId,
        from: ChunkFrom.AGENT,
        payload: { toolCallId, toolName, providerExecuted: false },
      } as ChunkType);

      for (const delta of deltas) {
        chunks.push({
          type: 'tool-call-delta',
          runId,
          from: ChunkFrom.AGENT,
          payload: { toolCallId, argsTextDelta: delta },
        } as ChunkType);
      }

      chunks.push({
        type: 'tool-call-input-streaming-end',
        runId,
        from: ChunkFrom.AGENT,
        payload: { toolCallId },
      } as ChunkType);

      return chunks;
    }

    async function collectToolCallArgs(deltas: string[], toolName = 'edit_files'): Promise<any> {
      const runId = 'test-run';
      const toolCallId = 'call-1';

      const stream = createChunkStream([
        ...createToolCallDeltaSequence(runId, toolCallId, toolName, deltas),
        createStepFinishChunk(runId),
        createFinishChunk(runId),
      ]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList: new MessageList({ threadId: 'test-thread' }),
        messageId: 'msg-1',
        options: { runId },
      });

      const chunks: ChunkType[] = [];
      for await (const chunk of output.fullStream) {
        chunks.push(chunk);
      }

      const toolCallChunk = chunks.find(c => c.type === 'tool-call');
      expect(toolCallChunk).toBeDefined();
      return (toolCallChunk as any).payload.args;
    }

    it('should reassemble valid JSON from multiple deltas', async () => {
      const expected = {
        summary: 'update readme',
        files: [{ path: 'README.md', edits: [{ old_string: 'old', new_string: 'new' }] }],
      };
      const fullStr = JSON.stringify(expected);
      const deltas = [fullStr.slice(0, 30), fullStr.slice(30, 60), fullStr.slice(60)];

      const args = await collectToolCallArgs(deltas);
      expect(args).toEqual(expected);
    });

    it('should reassemble large nested JSON (~2000 chars) from many small deltas', async () => {
      const expected = {
        summary: 'Multi-file refactor for authentication module',
        files: Array.from({ length: 5 }, (_, i) => ({
          path: `src/auth/handler-${i}.ts`,
          edits: Array.from({ length: 3 }, (_, j) => ({
            old_string: `const oldVar${j} = authenticate(request.headers['x-token-${j}'])`,
            new_string: `const newVar${j} = await verifyToken(request.cookies.get('session-${j}'))`,
          })),
        })),
      };
      const fullStr = JSON.stringify(expected);
      expect(fullStr.length).toBeGreaterThan(1500);

      const deltas: string[] = [];
      for (let i = 0; i < fullStr.length; i += 50) {
        deltas.push(fullStr.slice(i, i + 50));
      }

      const args = await collectToolCallArgs(deltas);
      expect(args).toEqual(expected);
    });

    it('should strip trailing LLM tokens and parse successfully', async () => {
      const expected = {
        summary: 'fix bug',
        files: [{ path: 'src/index.ts', edits: [{ old_string: 'a', new_string: 'b' }] }],
      };
      const withToken = JSON.stringify(expected) + '<|endoftext|>';
      const deltas = [withToken.slice(0, withToken.length - 5), withToken.slice(withToken.length - 5)];

      const args = await collectToolCallArgs(deltas);
      expect(args).toEqual(expected);
    });

    it('should repair JSON with trailing comma', async () => {
      const deltas = ['{"summary":"fix",', '"files":[],', '}'];

      const args = await collectToolCallArgs(deltas);
      expect(args).toEqual({ summary: 'fix', files: [] });
    });

    it('should repair JSON with missing opening quote on property name', async () => {
      const deltas = ['{"command":"git diff",', 'description":"show changes"}'];

      const args = await collectToolCallArgs(deltas, 'run_command');
      expect(args).toEqual({ command: 'git diff', description: 'show changes' });
    });

    it('should return undefined for unrecoverable truncated JSON', async () => {
      const fullStr = JSON.stringify({
        summary: 'update',
        files: [{ path: 'a.ts', edits: [{ old_string: 'x', new_string: 'y' }] }],
      });
      const truncated = fullStr.slice(0, -10);
      const deltas = [truncated.slice(0, 40), truncated.slice(40)];

      const args = await collectToolCallArgs(deltas);
      expect(args).toBeUndefined();
    });

    it('should return undefined when no deltas are received', async () => {
      const args = await collectToolCallArgs([]);
      expect(args).toBeUndefined();
    });

    it('should handle single-field tool calls from a single delta', async () => {
      const expected = { path: 'some/file.md' };
      const args = await collectToolCallArgs([JSON.stringify(expected)]);
      expect(args).toEqual(expected);
    });
  });

  describe('writer in output processors (outer context)', () => {
    it('should pass a defined writer to processOutputResult', async () => {
      let receivedWriter: ProcessorStreamWriter | undefined;

      const processor: Processor = {
        id: 'writer-capture',
        name: 'Writer Capture',
        processOutputResult: async ({ messages, writer }) => {
          receivedWriter = writer;
          return messages;
        },
      };

      const runId = 'test-run';
      const messageList = new MessageList({ threadId: 'test-thread' });

      // Add a response message so the processor has something to work with
      messageList.add(
        {
          id: 'msg-1',
          role: 'assistant',
          content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'hello' }] },
          createdAt: new Date(),
        },
        'response',
      );

      const stream = createChunkStream([createStepFinishChunk(runId), createFinishChunk(runId)]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList,
        messageId: 'msg-1',
        options: {
          runId,
          outputProcessors: [processor],
          // isLLMExecutionStep is NOT set — this is the outer context
        },
      });

      await output.consumeStream();

      expect(receivedWriter).toBeDefined();
      expect(typeof receivedWriter!.custom).toBe('function');
    });

    it('should deliver custom chunks emitted via writer before the finish chunk', async () => {
      const processor: Processor = {
        id: 'custom-emitter',
        name: 'Custom Emitter',
        processOutputResult: async ({ messages, writer }) => {
          await writer!.custom({ type: 'data-moderation', data: { flagged: true } });
          return messages;
        },
      };

      const runId = 'test-run';
      const messageList = new MessageList({ threadId: 'test-thread' });

      messageList.add(
        {
          id: 'msg-1',
          role: 'assistant',
          content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'hello' }] },
          createdAt: new Date(),
        },
        'response',
      );

      const stream = createChunkStream([createStepFinishChunk(runId), createFinishChunk(runId)]);

      const output = new MastraModelOutput({
        model: { modelId: 'test-model', provider: 'test', version: 'v3' },
        stream,
        messageList,
        messageId: 'msg-1',
        options: {
          runId,
          outputProcessors: [processor],
        },
      });

      // Collect all chunks from the fullStream
      const chunks: ChunkType[] = [];
      for await (const chunk of output.fullStream) {
        chunks.push(chunk);
      }

      const customChunk = chunks.find(c => c.type === 'data-moderation');
      const finishIndex = chunks.findIndex(c => c.type === 'finish');
      const customIndex = chunks.findIndex(c => c.type === 'data-moderation');

      expect(customChunk).toBeDefined();
      expect((customChunk as any).data).toEqual({ flagged: true });
      // Custom chunk should appear before the finish chunk
      expect(customIndex).toBeLessThan(finishIndex);
    });
  });
});
