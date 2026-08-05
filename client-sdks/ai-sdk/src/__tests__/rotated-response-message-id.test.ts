/**
 * When a processor rotates the active response message id during
 * `processInputStep` (e.g. observational memory sealing a buffer chunk), the
 * rotated id only reaches the wire via `step-start.payload.messageId`. The
 * UIMessage stream announces a message id once, in the `start` chunk — so the
 * transformer must announce the id of the first model step, which is the id
 * the assistant response is actually persisted under.
 */
import type { UIMessage } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { ChunkType } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';

import { handleChatStream } from '../chat-route';
import { AgentStreamToAISDKV6Transformer } from '../transformers';

function createTextModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date() },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'hello' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
      ] as any),
      rawCall: { rawPrompt: [], rawSettings: {} },
      warnings: [],
    }),
  });
}

async function collect(stream: ReadableStream): Promise<any[]> {
  const chunks: any[] = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

const userMessage: UIMessage = {
  id: 'user-1',
  role: 'user',
  parts: [{ type: 'text', text: 'hi' }],
};

function rawChunk(chunk: object): ChunkType<any> {
  return { runId: 'run-1', from: 'AGENT', ...chunk } as ChunkType<any>;
}

describe('rotated response message id announcement', () => {
  it('announces the rotated id when processInputStep rotates before the first model step', async () => {
    let rotatedMessageId: string | undefined;
    const rotatingProcessor = {
      id: 'rotator',
      processInputStep: async ({ rotateResponseMessageId }: any) => {
        rotatedMessageId = rotateResponseMessageId?.();
        return {};
      },
    };

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'helper',
      model: createTextModel(),
      inputProcessors: [rotatingProcessor as any],
    });
    const mastra = new Mastra({ agents: { 'test-agent': agent } });

    const stream = await handleChatStream({
      mastra,
      agentId: 'test-agent',
      params: { messages: [userMessage] },
      version: 'v6',
    } as any);

    const chunks = await collect(stream);
    const startChunks = chunks.filter(c => c.type === 'start');

    expect(rotatedMessageId).toBeDefined();
    expect(startChunks).toHaveLength(1);
    expect(startChunks[0].messageId).toBe(rotatedMessageId);
  });

  it('keeps the first step id when rotation happens between later steps', async () => {
    let callCount = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        callCount++;
        if (callCount === 1) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date() },
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'clientTool',
                args: '{}',
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ] as any),
            rawCall: { rawPrompt: [], rawSettings: {} },
            warnings: [],
          };
        }
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-2', modelId: 'mock', timestamp: new Date() },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'done' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 } },
          ] as any),
          rawCall: { rawPrompt: [], rawSettings: {} },
          warnings: [],
        };
      },
    });

    const stepIds: (string | undefined)[] = [];
    const midRunRotator = {
      id: 'mid-run-rotator',
      processInputStep: async ({ stepNumber, messageId, rotateResponseMessageId }: any) => {
        stepIds.push(stepNumber === 0 ? messageId : rotateResponseMessageId?.());
        return {};
      },
    };

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'helper',
      model,
      inputProcessors: [midRunRotator as any],
    });
    const mastra = new Mastra({ agents: { 'test-agent': agent } });

    const stream = await handleChatStream({
      mastra,
      agentId: 'test-agent',
      params: { messages: [userMessage] },
      version: 'v6',
    } as any);

    const chunks = await collect(stream);
    const startChunks = chunks.filter(c => c.type === 'start');

    // Step 0 did not rotate, step 1 did — the announced id must stay the id
    // the first assistant message persists under.
    expect(stepIds).toHaveLength(2);
    expect(stepIds[1]).toBeDefined();
    expect(stepIds[1]).not.toBe(stepIds[0]);
    expect(startChunks).toHaveLength(1);
    expect(startChunks[0].messageId).toBe(stepIds[0]);
  });

  it('preserves the order of data-* chunks emitted between start and the first step', async () => {
    const stream = convertArrayToReadableStream([
      rawChunk({ type: 'start', payload: { id: 'agent-1', messageId: 'initial-id' } }),
      rawChunk({ type: 'data-om-status', data: { status: 'buffering' } }),
      rawChunk({ type: 'step-start', payload: { request: {}, warnings: [], messageId: 'rotated-id' } }),
      rawChunk({ type: 'text-start', payload: { id: 'text-1' } }),
      rawChunk({ type: 'text-delta', payload: { id: 'text-1', text: 'hello' } }),
      rawChunk({ type: 'text-end', payload: { id: 'text-1' } }),
    ]).pipeThrough(AgentStreamToAISDKV6Transformer({}));

    const chunks = await collect(stream);
    const types = chunks.map(c => c.type);

    expect(types.indexOf('start')).toBeLessThan(types.indexOf('data-om-status'));
    expect(types.indexOf('data-om-status')).toBeLessThan(types.indexOf('start-step'));
    expect(chunks.find(c => c.type === 'start').messageId).toBe('rotated-id');
  });

  it('leaves streams whose start chunk has no message id untouched (durable streams)', async () => {
    const stream = convertArrayToReadableStream([
      rawChunk({ type: 'start', payload: {} }),
      rawChunk({ type: 'text-start', payload: { id: 'text-1' } }),
      rawChunk({ type: 'text-delta', payload: { id: 'text-1', text: 'hello' } }),
      rawChunk({ type: 'text-end', payload: { id: 'text-1' } }),
    ]).pipeThrough(AgentStreamToAISDKV6Transformer({}));

    const chunks = await collect(stream);
    const startChunk = chunks.find(c => c.type === 'start');

    expect(startChunk).toBeDefined();
    expect(startChunk.messageId).toBeUndefined();
  });

  it('flushes a held start chunk when the stream ends without a model step', async () => {
    const stream = convertArrayToReadableStream([
      rawChunk({ type: 'start', payload: { id: 'agent-1', messageId: 'only-id' } }),
      rawChunk({ type: 'data-om-status', data: { status: 'buffering' } }),
    ]).pipeThrough(AgentStreamToAISDKV6Transformer({}));

    const chunks = await collect(stream);
    const startChunk = chunks.find(c => c.type === 'start');

    expect(startChunk).toBeDefined();
    expect(startChunk.messageId).toBe('only-id');
    expect(chunks.some(c => c.type === 'data-om-status')).toBe(true);
  });
});
