/**
 * Background task results go through processToolModelOutput on both engines,
 * so ToolResultTokenLimiter caps an oversized background result for the model
 * while the stored result stays whole.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../agent';
import { createDurableAgent } from '../../agent/durable/create-durable-agent';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { applyBackgroundToolResult } from '../../loop/shared/steps/background-task-result-core';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { MockStore } from '../../storage/mock';
import { createTool } from '../../tools';
import { ToolResultTokenLimiter } from './tool-result-token-limiter';

vi.mock('../../loop/shared/steps/background-task-result-core', async importOriginal => {
  const actual = await importOriginal<typeof import('../../loop/shared/steps/background-task-result-core')>();
  return { ...actual, applyBackgroundToolResult: vi.fn(actual.applyBackgroundToolResult) };
});

function createToolCallThenTextModel(toolName: string, args: Record<string, unknown>, finalText: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
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
          { type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) },
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

async function waitFor(cond: () => boolean, timeoutMs = 5000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for condition');
    await new Promise(r => setTimeout(r, 50));
  }
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

const BIG = 'word '.repeat(4000);
const MARKER = /\n\[truncated: showing [\d,]+ of [\d,]+ tokens\]$/;

describe.each(['default', 'durable'] as const)('background results on the %s engine', engine => {
  let pubsub: EventEmitterPubSub;
  const storage = new MockStore();
  const spy = vi.mocked(applyBackgroundToolResult);

  beforeEach(() => {
    spy.mockClear();
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
    const bgStore = await storage.getStore('backgroundTasks');
    await bgStore?.dangerouslyClearAll();
  });

  it('caps the model-facing copy of an oversized background result', async () => {
    const memory = new MockMemory();
    const bigTool = createTool({
      id: 'big',
      description: 'Returns a lot of text',
      inputSchema: z.object({ q: z.string() }),
      execute: async () => {
        await new Promise(r => setTimeout(r, 50));
        return BIG;
      },
      background: { enabled: true },
    });
    const agentId = `bg-cap-${engine}`;
    const baseAgent = new Agent({
      id: agentId,
      name: agentId,
      instructions: 'Use the tool',
      model: createToolCallThenTextModel('big', { q: 'x' }, 'ok') as LanguageModelV2,
      tools: { big: bigTool },
      backgroundTasks: { tools: { big: true } },
      outputProcessors: [new ToolResultTokenLimiter(100)],
      memory,
    });
    const agent = engine === 'durable' ? createDurableAgent({ agent: baseAgent, pubsub }) : baseAgent;
    const mastra = new Mastra({
      logger: false,
      storage,
      backgroundTasks: { enabled: true },
      agents: { [agentId]: agent as any },
    });
    await mastra.startWorkers();

    const thread = `thread-${engine}`;
    const run: any = await (agent as any).stream('go', { memory: { thread, resource: 'r' } });
    if (engine === 'default') await run.consumeStream?.();

    await waitFor(() => spy.mock.calls.length > 0);
    await Promise.all(spy.mock.results.map(r => r.value));

    const { messages } = await memory.recall({ threadId: thread, resourceId: 'r' });
    const part = findInvocationPart(messages as any[], 'call-1');
    expect(part.toolInvocation.state).toBe('result');
    expect(part.toolInvocation.result).toBe(BIG);
    expect(part.providerMetadata.mastra.modelOutput.value).toMatch(MARKER);

    run.cleanup?.();
    await mastra.backgroundTaskManager?.shutdown();
  });
});
