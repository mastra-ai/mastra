/**
 * DurableAgent suspend-metadata persistence
 *
 * When a tool suspends, the durable agent must persist `suspendedTools` onto the assistant message,
 * the same way the regular agent's tool-call step does. That metadata is what a RELOADING client
 * reads to re-render a pending approval (`extractSuspendedToolsFromMessages`, and the message
 * metadata @mastra/react exposes) — the live `tool-call-suspended` chunk only exists in memory.
 *
 * Without it a refreshed page shows no pending approval even though the run is parked and resumable.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function createToolCallModel(toolName: string, toolArgs: object): LanguageModelV2 {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        {
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId: 'call-1',
          toolName,
          input: JSON.stringify(toolArgs),
          providerExecuted: false,
        },
        { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  }) as unknown as LanguageModelV2;
}

describe('DurableAgent suspend metadata persistence', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('persists suspendedTools on the assistant message when a tool suspends', async () => {
    const threadId = 'thread-suspend-meta';
    const resourceId = 'resource-suspend-meta';

    const storage = new InMemoryStore();
    const memory = new MockMemory({ storage });

    const approvalTool = createTool({
      id: 'request_approval',
      description: 'Ask the user to approve before continuing',
      inputSchema: z.object({ question: z.string() }),
      suspendSchema: z.object({ question: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async (input: any, context: any) => {
        const agentCtx = context?.agent ?? context ?? {};
        if (agentCtx.resumeData != null) return { approved: agentCtx.resumeData.approved };
        await agentCtx.suspend?.({ question: input.question });
        return { approved: false };
      },
    });

    const baseAgent = new Agent({
      id: 'suspend-metadata-agent',
      name: 'Suspend Metadata Agent',
      instructions: 'Call request_approval.',
      model: createToolCallModel('request_approval', { question: 'Proceed?' }),
      tools: { request_approval: approvalTool },
      memory,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    const { runId, cleanup } = await durableAgent.stream('Please proceed', {
      memory: { thread: threadId, resource: resourceId },
    });
    expect(runId).toBeDefined();

    // Let the run reach the suspend and flush.
    await new Promise(r => setTimeout(r, 2000));
    cleanup();

    const store = await storage.getStore('memory');
    const { messages } = await store!.listMessages({ threadId } as never);

    const withSuspend = messages.find((m: any) => (m.content?.metadata as any)?.suspendedTools);
    expect(withSuspend).toBeDefined();

    const entry = Object.values((withSuspend as any).content.metadata.suspendedTools)[0] as any;
    expect(entry.toolName).toBe('request_approval');
    expect(entry.toolCallId).toBeTruthy();
    expect(entry.suspendPayload).toMatchObject({ question: 'Proceed?' });
  });
});
