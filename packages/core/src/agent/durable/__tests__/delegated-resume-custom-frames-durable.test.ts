/**
 * Durable-engine coverage for #22277 / #22217: writer.custom() `data-*` frames
 * emitted on the resume leg must reach the caller's stream.
 *
 * On the main loop the bug lived in the stream driver: the delegation tool
 * generated a fresh sub-agent thread id on resume, persistence of data-*
 * frames threw on the thread mismatch, and the throw dropped the frame before
 * it was enqueued. Durable's transport is structurally different — the tool
 * writer forwards every custom frame straight to pubsub (tool-call.ts
 * `outputWriter`) and persistence of data-* parts is decoupled from delivery
 * (#19375 collection) — so the main-loop failure mode cannot occur the same
 * way. These tests pin that contract empirically for both the direct and the
 * delegated resume leg, so future stream-adapter/tool-writer work cannot
 * silently regress it.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

const ORDER = 'order-77';

/** Leaf tool: approval-gated, writes a data-progress frame while executing. */
function buildProcessOrderTool() {
  return createTool({
    id: 'processOrder',
    description: 'Process an order',
    inputSchema: z.object({ orderId: z.string() }),
    requireApproval: true,
    execute: async (input: { orderId: string }, context: any) => {
      await context?.writer?.custom({
        type: 'data-progress',
        data: { orderId: input.orderId, step: 1 },
      });
      return { orderId: input.orderId, processed: true };
    },
  });
}

/**
 * Content-driven model: calls processOrder until its result is in the
 * conversation, then answers — so the same instance behaves correctly across
 * the suspend/resume boundary.
 */
function makeToolThenAnswerModel(answer: string) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const hasToolResult = JSON.stringify(prompt).includes('"processed":true');
      if (!hasToolResult) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream<any>([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'm-0', modelId: 'mock-model', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'leaf-call-1',
              toolName: 'processOrder',
              input: JSON.stringify({ orderId: ORDER }),
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
            },
          ]),
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream<any>([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'm-1', modelId: 'mock-model', timestamp: new Date(0) },
          { type: 'text-start', id: 't-1' },
          { type: 'text-delta', id: 't-1', delta: answer },
          { type: 'text-end', id: 't-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } },
        ]),
      };
    },
  });
}

/** Supervisor model: delegates until the sub-agent's answer is in context. */
function makeSupervisorModel() {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const hasDelegationResult = JSON.stringify(prompt).includes('Order processed.');
      if (!hasDelegationResult) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream<any>([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 's-0', modelId: 'mock-model', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'outer-call-1',
              toolName: 'agent-subAgent',
              input: JSON.stringify({ prompt: `Process order ${ORDER}` }),
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream<any>([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 's-1', modelId: 'mock-model', timestamp: new Date(0) },
          { type: 'text-start', id: 's-t' },
          { type: 'text-delta', id: 's-t', delta: 'Delegation complete.' },
          { type: 'text-end', id: 's-t' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      };
    },
  });
}

describe('durable resume custom frames (#22277)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    globalRunRegistry.clear();
    await pubsub.close();
  });

  const runToApproval = async (durableAgent: any, memory: { thread: string; resource: string }) => {
    const result = await durableAgent.stream(`Process order ${ORDER}`, { memory, maxSteps: 5 });
    let sawApproval = false;
    const seen: string[] = [];
    for await (const chunk of result.fullStream) {
      seen.push(chunk.type);
      if (chunk.type === 'tool-call-approval') {
        sawApproval = true;
        break;
      }
    }
    expect(sawApproval, `chunks: ${seen.join(', ')}`).toBe(true);
    return result.runId as string;
  };

  const getApprovalEntry = async (mockMemory: MockMemory, memory: { thread: string; resource: string }) => {
    return vi.waitFor(async () => {
      const { messages } = await mockMemory.recall({ threadId: memory.thread, resourceId: memory.resource });
      const withApproval = [...messages]
        .reverse()
        .find((m: any) => m.role === 'assistant' && (m.content as any)?.metadata?.pendingToolApprovals);
      const approvals = (withApproval as any)?.content?.metadata?.pendingToolApprovals as
        | Record<string, any>
        | undefined;
      expect(approvals).toBeDefined();
      return Object.values(approvals!)[0] as Record<string, any>;
    });
  };

  const drainResumed = async (resumed: { fullStream: AsyncIterable<any> }) => {
    const types: string[] = [];
    for await (const chunk of resumed.fullStream) {
      types.push(chunk.type);
    }
    return types;
  };

  it('direct resume emits data-progress custom frames on the durable stream', async () => {
    const mockMemory = new MockMemory();
    const memory = { thread: 'durable-custom-frames-direct-thread', resource: 'durable-custom-frames-direct-res' };

    const baseAgent = new Agent({
      id: 'orderAgent',
      name: 'Order Agent',
      instructions: 'Process orders with your tool.',
      model: makeToolThenAnswerModel('Order processed.') as LanguageModelV2,
      tools: { processOrder: buildProcessOrderTool() },
      memory: mockMemory,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({ agents: { durableAgent }, storage: new InMemoryStore(), logger: false });

    const runId = await runToApproval(durableAgent, memory);
    const entry = await getApprovalEntry(mockMemory, memory);
    expect(entry.runId).toBe(runId);

    const resumed = await durableAgent.approveToolCall({ runId: entry.runId, toolCallId: entry.toolCallId, memory });
    const types = await drainResumed(resumed);
    const label = `resumed chunks: ${types.join(', ')}`;

    expect(types, label).not.toContain('error');
    expect(types, label).not.toContain('tool-error');
    // The frame the tool wrote on the resume leg reached the caller's stream.
    expect(types, label).toContain('data-progress');
  }, 30000);

  it('delegated resume via approveToolCall emits sub-agent data-progress frames on the parent stream', async () => {
    const mockMemory = new MockMemory();
    const memory = {
      thread: 'durable-custom-frames-delegated-thread',
      resource: 'durable-custom-frames-delegated-res',
    };

    const subAgent = new Agent({
      id: 'subAgent',
      name: 'subAgent',
      description: 'Processes orders',
      instructions: 'Process orders with your tool.',
      model: makeToolThenAnswerModel('Order processed.') as LanguageModelV2,
      tools: { processOrder: buildProcessOrderTool() },
    });
    const supervisor = new Agent({
      id: 'supervisor',
      name: 'Supervisor',
      instructions: 'Delegate to subAgent.',
      model: makeSupervisorModel() as LanguageModelV2,
      agents: { subAgent },
      memory: mockMemory,
    });
    const durableAgent = createDurableAgent({ agent: supervisor, pubsub });
    new Mastra({ agents: { durableAgent }, storage: new InMemoryStore(), logger: false });

    const runId = await runToApproval(durableAgent, memory);
    const entry = await getApprovalEntry(mockMemory, memory);
    // Delegated approval: the persisted pair targets the outer durable run.
    expect(entry.runId).toBe(runId);

    const resumed = await durableAgent.approveToolCall({ runId: entry.runId, toolCallId: entry.toolCallId, memory });
    const types = await drainResumed(resumed);
    const label = `resumed chunks: ${types.join(', ')}`;

    expect(types, label).not.toContain('error');
    expect(types, label).not.toContain('tool-error');
    expect(types, label).not.toContain('tool-call-approval');
    // The sub-agent's leaf tool wrote the frame after the delegated resume; it
    // must surface on the parent durable stream.
    expect(types, label).toContain('data-progress');
  }, 30000);
});
