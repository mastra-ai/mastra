/**
 * Durable port of the regular loop's MALFORMED_FUNCTION_CALL regression
 * (`save-and-errors.test.ts`). Gemini ends the stream with finishReason
 * 'error' and no error part; the durable step must surface it as an
 * AGENT_STREAM_ERROR carrying `rawFinishReason` so the default
 * stream-error-retry-processor can retry it.
 */
import {
  convertArrayToReadableStream as convertArrayToReadableStreamV3,
  MockLanguageModelV3,
} from '@internal/ai-v6/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

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

const errorFinishStream = (raw: string) => () =>
  convertArrayToReadableStreamV3([
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
    { type: 'finish', finishReason: { unified: 'error', raw }, usage: v3Usage },
  ]);

const malformedStream = errorFinishStream('MALFORMED_FUNCTION_CALL');

const answerStream = () =>
  convertArrayToReadableStreamV3([
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 'id-2', modelId: 'mock-model-id', timestamp: new Date(0) },
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: 'Here is your answer.' },
    { type: 'text-end', id: 'text-1' },
    { type: 'finish', finishReason: { unified: 'stop', raw: 'STOP' }, usage: v3Usage },
  ]);

describe('DurableAgent default error processors retry Gemini MALFORMED_FUNCTION_CALL', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

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
      id: 'durable-malformed-function-call-retry',
      name: 'Durable Malformed Function Call Retry',
      model,
      instructions: 'You are a helpful assistant.',
      tools: { lookup },
    });

    return { durableAgent: createDurableAgent({ agent, pubsub }), execute, modelCalls: () => calls };
  }

  async function drain(durableAgent: ReturnType<typeof createAgent>['durableAgent']) {
    const { output, cleanup } = await durableAgent.stream('Hello', { modelSettings: { maxRetries: 0 } });
    const chunks: any[] = [];
    for await (const chunk of output.fullStream as unknown as ReadableStream<any>) {
      chunks.push(chunk);
    }
    const text = await output.text;
    await cleanup();
    return { chunks, text };
  }

  it('resends the failed post-tool step and completes the turn without re-running the tool', async () => {
    const { durableAgent, execute, modelCalls } = createAgent([toolCallStream, malformedStream, answerStream]);

    const { chunks, text } = await drain(durableAgent);

    expect(chunks.filter(chunk => chunk.type === 'error')).toHaveLength(0);
    expect(text).toBe('Here is your answer.');
    expect(modelCalls()).toBe(3);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('surfaces the error after the retry budget is exhausted', async () => {
    const { durableAgent, execute, modelCalls } = createAgent([toolCallStream, malformedStream]);

    const { chunks } = await drain(durableAgent);

    // 1 tool-call step + 1 failed step + 2 retries
    expect(modelCalls()).toBe(4);
    expect(execute).toHaveBeenCalledTimes(1);

    const errorChunks = chunks.filter(chunk => chunk.type === 'error');
    expect(errorChunks).toHaveLength(1);
    expect(errorChunks[0].payload.error.id).toBe('AGENT_STREAM_ERROR');
    expect(errorChunks[0].payload.error.details).toMatchObject({ rawFinishReason: 'MALFORMED_FUNCTION_CALL' });
  });

  it('surfaces a payload-less error finish with another raw reason without retrying', async () => {
    const { durableAgent, modelCalls } = createAgent([errorFinishStream('OTHER')]);

    const { chunks } = await drain(durableAgent);

    expect(modelCalls()).toBe(1);
    const errorChunks = chunks.filter(chunk => chunk.type === 'error');
    expect(errorChunks).toHaveLength(1);
    expect(errorChunks[0].payload.error.message).toContain('finishReason "error" (provider reported "OTHER")');
  });
});
