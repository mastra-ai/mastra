/**
 * DurableAgent + processor-injected approval tools (issue #24377).
 *
 * The foreach concurrency gate only inspects the tool metadata serialized at
 * run start (`toolsMetadata` from the agent's static `tools`). A tool that an
 * input processor adds per step — `ToolSearchProcessor` in the report, a plain
 * injector here — is executable but invisible to that gate, so two calls to an
 * approval-gated tool could suspend in parallel inside one foreach. That state
 * could not be drained: the second approval hung forever.
 *
 * These tests pin the observable contract: one approval at a time, the sibling
 * runs only after the first is approved, and the run reaches a terminal result.
 *
 * The focused resolver tests pin the concurrency decision directly. These
 * end-to-end variants additionally cover both durable engines so the evented
 * engine cannot release an unapproved sibling while the default engine drains
 * the approvals sequentially to a terminal result.
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
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { globalRunRegistry } from '../run-registry';

/** Input processor that adds one approval-gated tool to every step's tool set. */
function createApprovalToolInjector(tool: unknown) {
  return {
    id: 'approval-tool-injector',
    name: 'approval-tool-injector',
    processInputStep: async ({ tools }: { tools?: Record<string, unknown> }) => ({
      tools: { ...(tools ?? {}), approvalEcho: tool },
    }),
  } as any;
}

/**
 * Emits two same-turn calls to `approvalEcho` until a result is in context, then
 * finishes. Content-driven (never a call counter) so the durable engine's step
 * replay after a suspension re-derives the identical batch.
 */
function makeParallelCallModel() {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const hasEchoResult = JSON.stringify(prompt).includes('echoed');
      if (hasEchoResult) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream<any>([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'par-1', modelId: 'mock-model', timestamp: new Date(0) },
            { type: 'text-start', id: 'par-text' },
            { type: 'text-delta', id: 'par-text', delta: 'Done.' },
            { type: 'text-end', id: 'par-text' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
          ]),
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream<any>([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'par-0', modelId: 'mock-model', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallType: 'function',
            toolCallId: 'tc-alpha',
            toolName: 'approvalEcho',
            input: JSON.stringify({ message: 'Alpha' }),
            providerExecuted: false,
          },
          {
            type: 'tool-call',
            toolCallType: 'function',
            toolCallId: 'tc-beta',
            toolName: 'approvalEcho',
            input: JSON.stringify({ message: 'Beta' }),
            providerExecuted: false,
          },
          {
            type: 'finish',
            finishReason: 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      };
    },
  });
}

describe('durable processor-injected approval tool concurrency', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    globalRunRegistry.clear();
    await pubsub.close();
  });

  function buildAgent(toolExecutions: { count: number }, mockMemory: MockMemory) {
    const approvalEcho = createTool({
      id: 'approvalEcho',
      description: 'Echoes a message after approval',
      inputSchema: z.object({ message: z.string() }),
      requireApproval: true,
      execute: async ({ message }) => {
        toolExecutions.count++;
        return { echoed: message };
      },
    });

    // `approvalEcho` is deliberately NOT in the agent's static tools: it only
    // reaches the model through the processor, which is the whole point.
    return new Agent({
      id: 'processorApprovalAgent',
      name: 'processorApprovalAgent',
      instructions: 'Call the echo tool twice in parallel.',
      model: makeParallelCallModel() as LanguageModelV2,
      inputProcessors: [createApprovalToolInjector(approvalEcho)],
      memory: mockMemory,
    });
  }

  /** Waits until the workflow snapshot reports the given status. */
  const waitForSnapshotStatus = async (storage: InMemoryStore, runId: string, status: string) => {
    await vi.waitFor(async () => {
      const workflows = (await storage.getStore('workflows'))!;
      const persisted = await workflows.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP });
      const snapshot = typeof persisted?.snapshot === 'string' ? JSON.parse(persisted.snapshot) : persisted?.snapshot;
      expect(snapshot?.status).toBe(status);
    });
  };

  /**
   * Collects chunks until `stopOn` is satisfied or `deadlineMs` elapses.
   *
   * A deadline is required because a suspended durable run keeps its stream
   * open: without it, waiting for a chunk that will never arrive (the bug this
   * test pins) would hang until the test timeout instead of failing fast.
   */
  const collectUntil = async (stream: AsyncIterable<any>, stopOn: (chunks: any[]) => boolean, deadlineMs: number) => {
    const chunks: any[] = [];
    const iterator = stream[Symbol.asyncIterator]();
    const startedAt = Date.now();
    while (Date.now() - startedAt < deadlineMs) {
      const remaining = deadlineMs - (Date.now() - startedAt);
      const next = await Promise.race([
        iterator.next(),
        new Promise<{ done: true; value?: undefined }>(resolve => setTimeout(() => resolve({ done: true }), remaining)),
      ]);
      if (next.done) break;
      chunks.push(next.value);
      if (stopOn(chunks)) break;
    }
    return chunks;
  };

  const approvalsIn = (chunks: any[]) => chunks.filter(c => c.type === 'tool-call-approval');

  it.each(['durable', 'evented'] as const)(
    '%s engine serializes two same-turn calls to a processor-injected approval tool',
    async engine => {
      const storage = new InMemoryStore();
      const mockMemory = new MockMemory();
      const memory = {
        thread: `processor-approval-${engine}-thread`,
        resource: `processor-approval-${engine}-resource`,
      };
      const toolExecutions = { count: 0 };

      const baseAgent = buildAgent(toolExecutions, mockMemory);
      const durableAgent =
        engine === 'evented'
          ? createEventedAgent({ agent: baseAgent, pubsub })
          : createDurableAgent({ agent: baseAgent, pubsub });
      new Mastra({ agents: { durableAgent }, storage, logger: false });

      // Leg 1: stream until the first approval, then keep the (unapproved) stream
      // open for a stabilization window. The gate must hold the sibling back, so
      // no second approval arrives even though the model called the tool twice.
      const first = await durableAgent.stream('Echo twice', { memory, maxSteps: 6 });
      const firstChunks: any[] = [];
      for await (const chunk of first.fullStream) {
        firstChunks.push(chunk);
        if (chunk.type === 'tool-call-approval') break;
      }
      expect(firstChunks.some(c => c.type === 'tool-call-approval')).toBe(true);
      const firstApprovals = approvalsIn(firstChunks);
      expect(
        firstApprovals.map(c => c.payload?.toolCallId),
        `approval chunks: ${firstChunks.map(c => c.type).join(', ')}`,
      ).toHaveLength(1);
      expect(toolExecutions.count).toBe(0);
      await waitForSnapshotStatus(storage, first.runId, 'suspended');

      // Stabilization window: the sibling must NOT surface while the first call is
      // unapproved. Without the gate this is where a second parallel approval
      // would appear.
      const stabilization = await collectUntil(first.fullStream, () => false, 3000);
      const leg1Ids = [...new Set(approvalsIn([...firstChunks, ...stabilization]).map(c => c.payload?.toolCallId))];
      expect(leg1Ids, `leg-1 approvals: ${[...firstChunks, ...stabilization].map(c => c.type).join(', ')}`).toEqual([
        'tc-alpha',
      ]);
      expect(toolExecutions.count).toBe(0);

      // Leg 2: approving the first call releases the sibling, which now raises its
      // own approval instead of having suspended alongside it.
      const second = await durableAgent.approveToolCall({
        runId: first.runId,
        toolCallId: firstApprovals[0].payload.toolCallId,
        memory,
      });
      const secondChunks = await collectUntil(second.fullStream, chunks => approvalsIn(chunks).length > 0, 15000);
      const secondApprovals = approvalsIn(secondChunks);
      expect(
        [...new Set(secondApprovals.map(c => c.payload?.toolCallId))],
        `leg-2 chunks: ${secondChunks.map(c => c.type).join(', ')}`,
      ).toEqual(['tc-beta']);
      expect(secondChunks.map(c => c.type)).not.toContain('error');
      expect(toolExecutions.count).toBe(1);

      // Leg 3: approving the sibling lets the run finish rather than hanging.
      const third = await durableAgent.approveToolCall({
        runId: first.runId,
        toolCallId: secondApprovals[0].payload.toolCallId,
        memory,
      });
      const thirdChunks = await collectUntil(third.fullStream, chunks => chunks.some(c => c.type === 'finish'), 15000);
      const thirdTypes = thirdChunks.map(c => c.type);
      expect(thirdTypes).not.toContain('error');
      expect(thirdTypes).not.toContain('tool-error');
      expect(approvalsIn(thirdChunks)).toHaveLength(0);
      expect(toolExecutions.count).toBe(2);
      expect(
        thirdChunks
          .filter(c => c.type === 'text-delta')
          .map(c => c.payload?.text ?? '')
          .join(''),
      ).toBe('Done.');
    },
    40000,
  );
});
