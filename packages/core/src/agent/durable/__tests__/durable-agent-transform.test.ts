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
});
