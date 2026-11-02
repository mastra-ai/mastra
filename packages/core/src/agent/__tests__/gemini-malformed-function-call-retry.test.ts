import {
  convertArrayToReadableStream as convertArrayToReadableStreamV3,
  MockLanguageModelV3,
} from '@internal/ai-v6/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { MastraError } from '../../error';
import type { ChunkType } from '../../stream/types';
import { createTool } from '../../tools';
import { Agent } from '../agent';

// MockLanguageModelV3: aimock speaks the OpenAI wire format and cannot emit Gemini's raw
// MALFORMED_FUNCTION_CALL finish reason.
describe('default error processors retry Gemini MALFORMED_FUNCTION_CALL', () => {
  const v3Usage = {
    inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 5, text: 5, reasoning: undefined },
  };

  const toolCallStream = () =>
    convertArrayToReadableStreamV3([
      { type: 'stream-start', warnings: [] },
      { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
      { type: 'tool-call', toolCallId: 'call-1', toolName: 'lookup', input: '{}' },
      { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'STOP' }, usage: v3Usage },
    ]);

  // Gemini returns HTTP 200 with no content and finish reason MALFORMED_FUNCTION_CALL.
  const malformedStream = () =>
    convertArrayToReadableStreamV3([
      { type: 'stream-start', warnings: [] },
      { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
      { type: 'finish', finishReason: { unified: 'error', raw: 'MALFORMED_FUNCTION_CALL' }, usage: v3Usage },
    ]);

  const answerStream = () =>
    convertArrayToReadableStreamV3([
      { type: 'stream-start', warnings: [] },
      { type: 'response-metadata', id: 'id-2', modelId: 'mock-model-id', timestamp: new Date(0) },
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', delta: 'Here is your answer.' },
      { type: 'text-end', id: 'text-1' },
      { type: 'finish', finishReason: { unified: 'stop', raw: 'STOP' }, usage: v3Usage },
    ]);

  function createAgent(streams: Array<() => ReturnType<typeof convertArrayToReadableStreamV3>>) {
    let calls = 0;
    const model = new MockLanguageModelV3({
      doStream: async () => {
        const next = streams[Math.min(calls, streams.length - 1)]!;
        calls++;
        return { stream: next() };
      },
    });
    const execute = vi.fn(async () => ({ ok: true }));
    const lookup = createTool({
      id: 'lookup',
      description: 'Looks something up',
      inputSchema: z.object({}),
      execute,
    });

    const agent = new Agent({
      id: 'test-malformed-function-call-retry',
      name: 'Test Malformed Function Call Retry',
      model,
      instructions: 'You are a helpful assistant.',
      tools: { lookup },
    });

    return { agent, execute, modelCalls: () => calls };
  }

  async function drain(agent: Agent) {
    const output = await agent.stream('Hello', { modelSettings: { maxRetries: 0 } });
    const chunks: ChunkType[] = [];
    for await (const chunk of output.fullStream) {
      chunks.push(chunk);
    }
    return { chunks, text: await output.text };
  }

  it('resends the failed post-tool step and completes the turn without re-running the tool', async () => {
    const { agent, execute, modelCalls } = createAgent([toolCallStream, malformedStream, answerStream]);

    const { chunks, text } = await drain(agent);

    expect(chunks.filter(chunk => chunk.type === 'error')).toHaveLength(0);
    expect(text).toBe('Here is your answer.');
    expect(modelCalls()).toBe(3);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('surfaces the error after the retry budget is exhausted', async () => {
    const { agent, execute, modelCalls } = createAgent([toolCallStream, malformedStream]);

    const { chunks } = await drain(agent);

    // 1 tool-call step + 1 failed step + 2 retries
    expect(modelCalls()).toBe(4);
    expect(execute).toHaveBeenCalledTimes(1);

    const errorChunks = chunks.filter(chunk => chunk.type === 'error');
    expect(errorChunks).toHaveLength(1);
    const emitted = (errorChunks[0] as { payload: { error: MastraError } }).payload.error;
    expect(emitted.details).toMatchObject({ rawFinishReason: 'MALFORMED_FUNCTION_CALL' });
  });
});
