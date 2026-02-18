import { ReadableStream } from 'node:stream/web';
import { describe, it, expect } from 'vitest';
import { MessageList } from '../../agent/message-list';
import type { ChunkType } from '../types';
import { ChunkFrom } from '../types';
import { MastraModelOutput } from './output';

function createTestStream<OUTPUT = undefined>(chunks: ChunkType<OUTPUT>[]): ReadableStream<ChunkType<OUTPUT>> {
  return new ReadableStream<ChunkType<OUTPUT>>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

function createOutput<OUTPUT = undefined>(
  chunks: ChunkType<OUTPUT>[],
  options: { isLLMExecutionStep?: boolean; structuredOutput?: any } = {},
) {
  const messageList = new MessageList();
  messageList.add(
    [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'hello' }] },
        createdAt: new Date(),
      },
    ],
    'user',
  );

  return new MastraModelOutput<OUTPUT>({
    model: { modelId: 'test-model', provider: 'test-provider', version: 'v2' },
    stream: createTestStream(chunks),
    messageList,
    messageId: 'test-msg',
    options: {
      runId: 'test-run',
      isLLMExecutionStep: options.isLLMExecutionStep,
      structuredOutput: options.structuredOutput,
    },
  });
}

describe('MastraModelOutput', () => {
  describe('isLLMExecutionStep text promise', () => {
    it('should resolve text when isLLMExecutionStep is false', async () => {
      const output = createOutput([
        { type: 'text-start', runId: 'test-run', from: ChunkFrom.AGENT, payload: {} },
        { type: 'text-delta', runId: 'test-run', from: ChunkFrom.AGENT, payload: { text: 'Hello ' } },
        { type: 'text-delta', runId: 'test-run', from: ChunkFrom.AGENT, payload: { text: 'world' } },
        { type: 'text-end', runId: 'test-run', from: ChunkFrom.AGENT, payload: {} },
        {
          type: 'finish',
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          payload: {
            reason: 'stop',
            stepResult: { reason: 'stop' },
            metadata: {},
            output: {
              text: 'Hello world',
              toolCalls: [],
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            },
          },
        },
      ] as ChunkType[]);

      const text = await output.text;
      expect(text).toBe('Hello world');
    });

    it('should resolve text when isLLMExecutionStep is true (not reject with unresolved promise error)', async () => {
      const output = createOutput(
        [
          { type: 'text-start', runId: 'test-run', from: ChunkFrom.AGENT, payload: {} },
          { type: 'text-delta', runId: 'test-run', from: ChunkFrom.AGENT, payload: { text: 'Hello ' } },
          { type: 'text-delta', runId: 'test-run', from: ChunkFrom.AGENT, payload: { text: 'world' } },
          { type: 'text-end', runId: 'test-run', from: ChunkFrom.AGENT, payload: {} },
          {
            type: 'finish',
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            payload: {
              reason: 'stop',
              stepResult: { reason: 'stop' },
              metadata: {},
              output: {
                text: 'Hello world',
                toolCalls: [],
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            },
          },
        ] as ChunkType[],
        { isLLMExecutionStep: true },
      );

      // This is the key assertion: with isLLMExecutionStep=true, the finish handler
      // previously skipped resolving text (deferring to the outer MastraModelOutput).
      // But the outer output has its own separate promises, so nobody resolved the
      // inner output's text promise. flush() then rejected it with:
      //   "promise 'text' was not resolved or rejected when stream finished"
      // The fix ensures text is resolved in the finish chunk handler's else branch
      // for all outputs, so flush() never rejects it.
      const text = await output.text;
      expect(text).toBe('Hello world');
    });
  });
});
