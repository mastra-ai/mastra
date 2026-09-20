/**
 * Durable agents must give tools a `writer` (ToolStream) regardless of which
 * lookup resolved the tool. Tools from the per-run registry are CoreToolBuilder
 * wrappers that build their own ToolStream; tools resolved from the Mastra
 * registry (the cross-process fallback) are raw `Tool` instances and depend on
 * the durable tool-call step providing `writer` itself.
 *
 * Regression for https://github.com/mastra-ai/mastra/issues/24196
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

function createToolCallingModel(toolName: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
            {
              type: 'tool-call',
              id: 'tc-1',
              toolCallType: 'function',
              toolCallId: 'tc-1',
              toolName,
              args: JSON.stringify({}),
            },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'resp-2', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: 'Done.' },
          { type: 'text-end', id: 't' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

async function drain(stream: ReadableStream<any>) {
  const out: any[] = [];
  for await (const c of stream) out.push(c);
  return out;
}

function makeEmitTool(seen: { writer?: string }) {
  return createTool({
    id: 'emitTool',
    description: 'Emits a custom chunk',
    inputSchema: z.object({}),
    execute: async (_input, context: any) => {
      seen.writer = context.writer?.constructor?.name;
      await context.writer?.custom({ type: 'data-demo', data: { ok: true } });
      await context.writer?.write({ progress: 1 });
      return { done: true };
    },
  });
}

describe('DurableAgent tool writer', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('provides a ToolStream writer to tools resolved from the per-run registry', async () => {
    const seen: { writer?: string } = {};
    const emitTool = makeEmitTool(seen);

    const agent = new Agent({
      id: 'writer-agent',
      name: 'Writer Agent',
      instructions: 'test',
      model: createToolCallingModel('emitTool') as LanguageModelV2,
      tools: { emitTool },
    });

    const durableAgent = createDurableAgent({ agent, pubsub });
    new Mastra({
      agents: { 'writer-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const chunks = await drain((await durableAgent.stream('go', { maxSteps: 3 })).fullStream);
    const types = chunks.map(c => c.type);

    expect(seen.writer).toBe('ToolStream');
    expect(types).toContain('data-demo');
    expect(types).toContain('tool-output');
  });

  it('provides a ToolStream writer to raw tools resolved from the Mastra registry (cross-process fallback)', async () => {
    const seen: { writer?: string } = {};
    const emitTool = makeEmitTool(seen);

    const agent = new Agent({
      id: 'writer-agent-fallback',
      name: 'Writer Agent Fallback',
      instructions: 'test',
      model: createToolCallingModel('emitTool') as LanguageModelV2,
      tools: { emitTool },
    });

    const durableAgent = createDurableAgent({ agent, pubsub });
    new Mastra({
      agents: { 'writer-agent-fallback': durableAgent as any },
      tools: { emitTool },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    // Simulate a separate worker process: the run-registry entry exists but has
    // no tools, so the tool-call step falls through to `mastra.getTool()`, which
    // returns the raw `Tool` instance (not a CoreToolBuilder wrapper).
    const originalSet = globalRunRegistry.set.bind(globalRunRegistry);
    globalRunRegistry.set = ((runId: string, entry: any) =>
      originalSet(runId, { ...entry, tools: {} })) as typeof globalRunRegistry.set;

    try {
      const chunks = await drain((await durableAgent.stream('go', { maxSteps: 3 })).fullStream);
      const types = chunks.map(c => c.type);

      expect(seen.writer).toBe('ToolStream');
      expect(types).toContain('data-demo');
      expect(types).toContain('tool-output');
    } finally {
      globalRunRegistry.set = originalSet;
    }
  });
});
