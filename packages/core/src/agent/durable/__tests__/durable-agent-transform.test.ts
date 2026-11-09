/**
 * DurableAgent tool payload transform tests.
 *
 * Verifies that the per-call `transform` policy fires for in-process durable
 * runs and stamps `providerMetadata.mastra.toolPayloadTransform` onto the
 * tool-call, tool-result, and tool-error chunks emitted through pubsub.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import type { ToolPayloadTransformPolicy } from '../../../tools/types';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function createToolCallThenTextModel(toolName: string, args: Record<string, unknown>, finalText: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName,
              input: JSON.stringify(args),
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: finalText },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 20, outputTokens: 15, totalTokens: 35 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

async function drain(stream: ReadableStream<any>) {
  const out: any[] = [];
  for await (const c of stream) out.push(c);
  return out;
}

function findInvocationPart(messages: any[], toolCallId: string) {
  for (const msg of messages) {
    const parts = msg?.content?.parts ?? [];
    for (const part of parts) {
      if (part?.type === 'tool-invocation' && part.toolInvocation?.toolCallId === toolCallId) {
        return part;
      }
    }
  }
  return undefined;
}

describe('DurableAgent tool payload transform', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('stamps the transform metadata on tool-call, tool-result, and tool-error chunks for in-process runs', async () => {
    const tool = createTool({
      id: 'redactedTool',
      description: 'tool whose payloads must be redacted in display + transcript',
      inputSchema: z.object({ secret: z.string() }),
      execute: async () => ({ ok: true, secret: 'still-secret' }),
    });

    const model = createToolCallThenTextModel('redactedTool', { secret: 'hunter2' }, 'done');

    const baseAgent = new Agent({
      id: 'transform-agent',
      name: 'Transform Agent',
      instructions: 'use the tool',
      model: model as any,
      tools: { redactedTool: tool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const policy: ToolPayloadTransformPolicy = {
      targets: ['display', 'transcript'],
      transformToolPayload: ctx => `[redacted ${ctx.phase} on ${ctx.target}]`,
    };

    const { output, cleanup } = await durableAgent.stream('run it', {
      transform: policy,
    });

    const chunks = await drain(output.fullStream as unknown as ReadableStream<any>);
    await cleanup();

    const toolCallChunk = chunks.find((c: any) => c.type === 'tool-call');
    const toolResultChunk = chunks.find((c: any) => c.type === 'tool-result');

    expect(toolCallChunk).toBeDefined();
    expect(toolResultChunk).toBeDefined();

    const toolCallMeta = toolCallChunk.metadata?.mastra?.toolPayloadTransform;
    expect(toolCallMeta?.display?.['input-available']?.transformed).toBe('[redacted input-available on display]');
    expect(toolCallMeta?.transcript?.['input-available']?.transformed).toBe('[redacted input-available on transcript]');

    const toolResultMeta = toolResultChunk.metadata?.mastra?.toolPayloadTransform;
    expect(toolResultMeta?.display?.['output-available']?.transformed).toBe('[redacted output-available on display]');
    expect(toolResultMeta?.transcript?.['output-available']?.transformed).toBe(
      '[redacted output-available on transcript]',
    );
  });

  it('serializes only the JSON-safe `targets` shadow into workflow input', async () => {
    const tool = createTool({
      id: 'tool',
      description: 't',
      inputSchema: z.object({}),
      execute: async () => 'ok',
    });

    const baseAgent = new Agent({
      id: 'transform-prep-agent',
      name: 'Transform Prep Agent',
      instructions: 'noop',
      model: createToolCallThenTextModel('tool', {}, 'done') as any,
      tools: { tool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const policy: ToolPayloadTransformPolicy = {
      targets: ['display'],
      transformToolPayload: () => 'x',
    };

    const { workflowInput, registryEntry } = await durableAgent.prepare('hello', {
      transform: policy,
    });

    // Serializable shadow: only `targets`, never the closure.
    expect(workflowInput.options.transform).toEqual({ targets: ['display'] });
    expect((workflowInput.options.transform as any)?.transformToolPayload).toBeUndefined();

    // The closure lives on the registry (in-process only).
    expect(typeof registryEntry.toolPayloadTransform?.transformToolPayload).toBe('function');
    expect(registryEntry.toolPayloadTransform?.targets).toEqual(['display']);
  });

  it('omits transform from workflow input when no policy is configured anywhere', async () => {
    const tool = createTool({
      id: 'tool',
      description: 't',
      inputSchema: z.object({}),
      execute: async () => 'ok',
    });

    const baseAgent = new Agent({
      id: 'transform-empty-agent',
      name: 'Transform Empty Agent',
      instructions: 'noop',
      model: createToolCallThenTextModel('tool', {}, 'done') as any,
      tools: { tool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const { workflowInput, registryEntry } = await durableAgent.prepare('hello');

    expect(workflowInput.options.transform).toBeUndefined();
    expect(registryEntry.toolPayloadTransform).toBeUndefined();
  });

  it('persists the transform metadata into thread history for client tool results (L18b)', async () => {
    const tool = createTool({
      id: 'secretTool',
      description: 'returns a secret payload',
      inputSchema: z.object({ secret: z.string() }),
      execute: async () => ({ ok: true, secret: 'raw-tool-secret' }),
    });

    const model = createToolCallThenTextModel('secretTool', { secret: 'hunter2' }, 'done');
    const mockMemory = new MockMemory();
    const baseAgent = new Agent({
      id: 'transform-persist-agent',
      name: 'Transform Persist Agent',
      instructions: 'use the tool',
      model: model as any,
      memory: mockMemory,
      tools: { secretTool: tool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'transform-persist-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const policy: ToolPayloadTransformPolicy = {
      targets: ['display', 'transcript'],
      transformToolPayload: ctx => `[redacted ${ctx.phase} on ${ctx.target}]`,
    };

    const result = await durableAgent.stream('run it', {
      transform: policy,
      memory: { thread: 'thread-transform-persist', resource: 'resource-transform-persist' },
    });
    await drain(result.fullStream as unknown as ReadableStream<any>);

    const recalled = await mockMemory.recall({
      threadId: 'thread-transform-persist',
      resourceId: 'resource-transform-persist',
    });
    const part = findInvocationPart(recalled.messages as any[], 'call-1');
    expect(part).toBeDefined();

    // The persisted providerMetadata carries the transform state for both the
    // result phase and the paired input phase, so transcript/display targets
    // apply on recall.
    const transform = part.providerMetadata?.mastra?.toolPayloadTransform;
    expect(transform?.transcript?.['output-available']?.transformed).toBe('[redacted output-available on transcript]');
    expect(transform?.display?.['output-available']?.transformed).toBe('[redacted output-available on display]');
    expect(transform?.transcript?.['input-available']?.transformed).toBe('[redacted input-available on transcript]');
    expect(transform?.display?.['input-available']?.transformed).toBe('[redacted input-available on display]');

    // The transcript transform applies at drain time (MessageList's
    // transformMessageForTranscript reads the persisted metadata), so the
    // stored args/result are the redacted values and the raw secrets never
    // reach storage — the redaction guarantee L18b exists for.
    expect(part.toolInvocation?.state).toBe('result');
    expect(part.toolInvocation?.result).toBe('[redacted output-available on transcript]');
    expect(part.toolInvocation?.args).toBe('[redacted input-available on transcript]');
    const serialized = JSON.stringify(recalled.messages);
    expect(serialized).not.toContain('raw-tool-secret');
    expect(serialized).not.toContain('hunter2');

    result.cleanup();
  });

  it('persists the transform metadata for failed client tool results (L18b)', async () => {
    const tool = createTool({
      id: 'failingTool',
      description: 'always fails with a sensitive error',
      inputSchema: z.object({ secret: z.string() }),
      execute: async () => {
        throw new Error('boom');
      },
    });

    const model = createToolCallThenTextModel('failingTool', { secret: 'hunter2' }, 'done');
    const mockMemory = new MockMemory();
    const baseAgent = new Agent({
      id: 'transform-error-persist-agent',
      name: 'Transform Error Persist Agent',
      instructions: 'use the tool',
      model: model as any,
      memory: mockMemory,
      tools: { failingTool: tool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'transform-error-persist-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const policy: ToolPayloadTransformPolicy = {
      targets: ['display', 'transcript'],
      transformToolPayload: ctx => `[redacted ${ctx.phase} on ${ctx.target}]`,
    };

    const result = await durableAgent.stream('run it', {
      transform: policy,
      memory: { thread: 'thread-transform-error-persist', resource: 'resource-transform-error-persist' },
    });
    await drain(result.fullStream as unknown as ReadableStream<any>);

    const recalled = await mockMemory.recall({
      threadId: 'thread-transform-error-persist',
      resourceId: 'resource-transform-error-persist',
    });
    const part = findInvocationPart(recalled.messages as any[], 'call-1');
    expect(part).toBeDefined();
    expect(part.toolInvocation?.state).toBe('output-error');

    const transform = part.providerMetadata?.mastra?.toolPayloadTransform;
    expect(transform?.transcript?.['error']?.transformed).toBe('[redacted error on transcript]');
    expect(transform?.display?.['error']?.transformed).toBe('[redacted error on display]');
    expect(transform?.transcript?.['input-available']?.transformed).toBe('[redacted input-available on transcript]');

    result.cleanup();
  });
});
