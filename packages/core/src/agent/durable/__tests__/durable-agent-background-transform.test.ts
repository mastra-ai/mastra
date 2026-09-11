/**
 * DurableAgent background tool-result transcript transform tests (PHASE3 ledger L22).
 *
 * The background `onResult` hook must wire `transformForTranscript` and
 * `generateId` into the shared `applyBackgroundToolResult` core — previously
 * both were omitted on durable, so a configured transcript redaction was
 * silently skipped for background results (raw secrets persisted to thread
 * history) and background results ignored a custom idGenerator.
 *
 * The transform policy is resolved at completion time from the live run
 * registry (like the sync path), not captured at dispatch, because the
 * registry entry may be rebuilt after a process restart.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { applyBackgroundToolResult } from '../../../loop/shared/steps/background-task-result-core';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { MockStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import type { ToolPayloadTransformPolicy } from '../../../tools/types';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

// Passthrough wrapper so tests can (a) await background completion
// deterministically and (b) assert the durable engine's onResult wiring
// without changing behavior.
vi.mock('../../../loop/shared/steps/background-task-result-core', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../loop/shared/steps/background-task-result-core')>();
  return {
    ...actual,
    applyBackgroundToolResult: vi.fn(actual.applyBackgroundToolResult),
  };
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

describe('DurableAgent background tool-result transcript transforms (L22)', () => {
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

  it('applies a configured transcript transform to background tool results before persistence', async () => {
    const memory = new MockMemory();
    const researchTool = createTool({
      id: 'research',
      description: 'Research a topic',
      inputSchema: z.object({ topic: z.string() }),
      execute: async ({ topic }) => {
        await new Promise(r => setTimeout(r, 100));
        return { summary: `Research on ${topic}` };
      },
      background: { enabled: true },
    });

    const mockModel = createToolCallThenTextModel('research', { topic: 'AI' }, 'Summary provided');

    const baseAgent = new Agent({
      id: 'bg-transform-agent',
      name: 'BG Transform Agent',
      instructions: 'Research when asked',
      model: mockModel as LanguageModelV2,
      tools: { research: researchTool },
      backgroundTasks: { tools: { research: true } },
      memory,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    const localMastra = new Mastra({
      logger: false,
      storage,
      backgroundTasks: { enabled: true },
      agents: { 'bg-transform-agent': durableAgent as any },
    });
    await localMastra.startWorkers();

    const policy: ToolPayloadTransformPolicy = {
      targets: ['transcript'],
      transformToolPayload: ctx => `[redacted ${ctx.phase} on ${ctx.target}]`,
    };

    const { cleanup } = await durableAgent.stream('Research AI', {
      transform: policy,
      memory: { thread: 'thread-bg-transform', resource: 'resource-bg-transform' },
    });

    // Wait for the background task's onResult to fire and settle (flush done).
    await waitFor(() => spy.mock.calls.length > 0);
    await Promise.all(spy.mock.results.map(r => r.value));

    // The wiring must supply the transcript transform hook (previously omitted).
    expect(spy.mock.calls[0]![0].transformForTranscript).toBeDefined();

    const recalled = await memory.recall({
      threadId: 'thread-bg-transform',
      resourceId: 'resource-bg-transform',
    });
    const part = findInvocationPart(recalled.messages as any[], 'call-1');
    expect(part).toBeDefined();

    // The persisted providerMetadata carries the transform state so the
    // transcript target applies on recall.
    const transform = part.providerMetadata?.mastra?.toolPayloadTransform;
    expect(transform?.transcript?.['output-available']?.transformed).toBe('[redacted output-available on transcript]');

    // Drain-time transcript redaction: the stored result is the redacted
    // value and the raw background result never reaches storage.
    expect(part.toolInvocation?.state).toBe('result');
    expect(part.toolInvocation?.result).toBe('[redacted output-available on transcript]');
    const serialized = JSON.stringify(recalled.messages);
    expect(serialized).not.toContain('Research on AI');

    cleanup();
    await localMastra.backgroundTaskManager?.shutdown();
  });

  it('wires generateId from the Mastra idGenerator into background results', async () => {
    const researchTool = createTool({
      id: 'research',
      description: 'Research a topic',
      inputSchema: z.object({ topic: z.string() }),
      execute: async ({ topic }) => {
        await new Promise(r => setTimeout(r, 100));
        return { summary: `Research on ${topic}` };
      },
      background: { enabled: true },
    });

    const mockModel = createToolCallThenTextModel('research', { topic: 'ML' }, 'Done');

    const baseAgent = new Agent({
      id: 'bg-genid-agent',
      name: 'BG GenId Agent',
      instructions: 'Research when asked',
      model: mockModel as LanguageModelV2,
      tools: { research: researchTool },
      backgroundTasks: { tools: { research: true } },
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    let idCounter = 0;
    const localMastra = new Mastra({
      logger: false,
      storage,
      backgroundTasks: { enabled: true },
      idGenerator: () => `custom-id-${++idCounter}`,
      agents: { 'bg-genid-agent': durableAgent as any },
    });
    await localMastra.startWorkers();

    const { cleanup } = await durableAgent.stream('Research ML', {});

    await waitFor(() => spy.mock.calls.length > 0);
    await Promise.all(spy.mock.results.map(r => r.value));

    // Background results must respect the custom idGenerator instead of
    // falling back to randomUUID (previously generateId was omitted).
    const deps = spy.mock.calls[0]![0];
    expect(deps.generateId).toBeDefined();
    expect(deps.generateId!()).toMatch(/^custom-id-\d+$/);

    cleanup();
    await localMastra.backgroundTaskManager?.shutdown();
  });
});
