/**
 * Durable delegated-approval resume regression (R4, durable engine).
 *
 * When a durable supervisor delegates to a sub-agent whose tool requires
 * approval, the approval metadata persisted on the supervisor's assistant
 * message must store the outer resumable durable runId, with the inner
 * delegated run preserved separately as `delegatedRunId`. Approving with the
 * persisted (runId, toolCallId) pair must resume the suspended inner run —
 * not restart the sub-agent — both in-process and on a fresh process over the
 * same storage (server restart).
 *
 * Regression: the durable tool-call step previously dropped the inner run id
 * (`suspendOptions.runId`) on suspension, so the resume leg called
 * `resumeStream` with an undefined runId, failed with "Failed agent tool
 * execution", and the supervisor re-delegated from scratch (emitting a
 * duplicate approval request).
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
import { globalRunRegistry } from '../run-registry';

/**
 * Sub-agent model: content-driven so a rebuilt instance (simulated restart)
 * behaves identically — calls the approval-gated tool until its result is in
 * the conversation, then answers.
 */
function makeSubAgentModel() {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const hasToolResult = JSON.stringify(prompt).includes('classified-42');
      if (!hasToolResult) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream<any>([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'sub-0', modelId: 'mock-model', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'inner-call-1',
              toolName: 'secretTool',
              input: '{"query":"classified"}',
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
          { type: 'response-metadata', id: 'sub-1', modelId: 'mock-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'sub-text' },
          { type: 'text-delta', id: 'sub-text', delta: 'Secret retrieved.' },
          { type: 'text-end', id: 'sub-text' },
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
      const hasDelegationResult = JSON.stringify(prompt).includes('Secret retrieved');
      if (!hasDelegationResult) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream<any>([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'sup-0', modelId: 'mock-model', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'outer-call-1',
              toolName: 'agent-subAgent',
              input: JSON.stringify({ prompt: 'fetch the secret' }),
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
          { type: 'response-metadata', id: 'sup-1', modelId: 'mock-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'sup-text' },
          { type: 'text-delta', id: 'sup-text', delta: 'Delegation complete.' },
          { type: 'text-end', id: 'sup-text' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      };
    },
  });
}

describe('durable delegated approval persisted runId', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    globalRunRegistry.clear();
    await pubsub.close();
  });

  const buildSupervisor = (mockMemory: MockMemory, toolExecutions: { count: number }) => {
    const secretTool = createTool({
      id: 'secretTool',
      description: 'Fetch a secret',
      inputSchema: z.object({ query: z.string() }),
      requireApproval: true,
      execute: async () => {
        toolExecutions.count++;
        return { secret: 'classified-42' };
      },
    });
    const subAgent = new Agent({
      id: 'subAgent',
      name: 'subAgent',
      description: 'Fetches secrets',
      instructions: 'Fetch secrets with your tool.',
      model: makeSubAgentModel() as LanguageModelV2,
      tools: { secretTool },
    });
    return new Agent({
      id: 'supervisor',
      name: 'Supervisor',
      instructions: 'Delegate to subAgent.',
      model: makeSupervisorModel() as LanguageModelV2,
      agents: { subAgent },
      memory: mockMemory,
    });
  };

  const runToApproval = async (
    durableAgent: {
      stream: (prompt: string, options: any) => Promise<{ runId: string; fullStream: AsyncIterable<{ type: string }> }>;
    },
    memory: { thread: string; resource: string },
    storage: InMemoryStore,
  ) => {
    const result = await durableAgent.stream('Get the secret', { memory, maxSteps: 5 });
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
    const workflows = (await storage.getStore('workflows'))!;
    await vi.waitFor(async () => {
      const persisted = await workflows.getWorkflowRunById({
        runId: result.runId,
        workflowName: DurableStepIds.AGENTIC_LOOP,
      });
      const snapshot = typeof persisted?.snapshot === 'string' ? JSON.parse(persisted.snapshot) : persisted?.snapshot;
      expect(snapshot?.status).toBe('suspended');
    });
    return result.runId;
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

  const drainAndAssertResumed = async (
    resumed: { fullStream: AsyncIterable<any> },
    toolExecutions: { count: number },
  ) => {
    const types: string[] = [];
    let finalText = '';
    const delegationResults: any[] = [];
    for await (const chunk of resumed.fullStream) {
      types.push(chunk.type);
      if (chunk.type === 'text-delta') finalText += chunk.payload?.text ?? '';
      if (chunk.type === 'tool-result' && chunk.payload?.result?.subAgentThreadId) {
        delegationResults.push(chunk.payload.result);
      }
    }
    const label = `resumed chunks: ${types.join(', ')}`;
    // The suspended inner run resumes: no tool errors, no re-delegation, and no
    // duplicate approval request.
    expect(types, label).not.toContain('tool-error');
    // The delegation result reports the identity restored from the suspended
    // run's snapshot: both the thread and its owning resource must be present
    // (a fresh resource ID paired with the snapshot thread fails ownership).
    for (const result of delegationResults) {
      expect(result.subAgentThreadId).toBeDefined();
      expect(result.subAgentResourceId).toBeDefined();
    }
    expect(types, label).not.toContain('error');
    expect(types, label).not.toContain('tool-call-approval');
    expect(
      types.filter(t => t === 'tool-call'),
      label,
    ).toHaveLength(0);
    // The approved tool executed exactly once across the whole flow.
    expect(toolExecutions.count).toBe(1);
    expect(finalText).toBe('Delegation complete.');
  };

  it('persists the outer runId with delegatedRunId and resumes in-process', async () => {
    const storage = new InMemoryStore();
    const mockMemory = new MockMemory();
    const memory = { thread: 'durable-approval-thread', resource: 'durable-approval-resource' };
    const toolExecutions = { count: 0 };

    const durableAgent = createDurableAgent({ agent: buildSupervisor(mockMemory, toolExecutions), pubsub });
    new Mastra({ agents: { durableAgent }, storage, logger: false });

    const outerRunId = await runToApproval(durableAgent, memory, storage);

    const entry = await getApprovalEntry(mockMemory, memory);
    // The persisted pair targets the outer resumable durable run; the inner
    // suspended sub-agent run is preserved separately.
    expect(entry.runId).toBe(outerRunId);
    expect(entry.delegatedRunId).toBeDefined();
    expect(entry.delegatedRunId).not.toBe(entry.runId);
    expect(toolExecutions.count).toBe(0);

    const resumed = await durableAgent.approveToolCall({
      runId: entry.runId,
      toolCallId: entry.toolCallId,
      memory,
    });
    await drainAndAssertResumed(resumed, toolExecutions);
  }, 30000);

  it('resumes the inner run when the delegation tool is itself approval-gated', async () => {
    const storage = new InMemoryStore();
    const mockMemory = new MockMemory();
    const memory = { thread: 'durable-double-gate-thread', resource: 'durable-double-gate-resource' };
    const toolExecutions = { count: 0 };

    const durableAgent = createDurableAgent({ agent: buildSupervisor(mockMemory, toolExecutions), pubsub });
    new Mastra({ agents: { durableAgent }, storage, logger: false });

    // ---- Leg 1: the outer delegation tool is approval-gated, so the run
    // suspends at the pre-execution gate before the sub-agent ever starts. ----
    const result = await durableAgent.stream('Get the secret', {
      memory,
      maxSteps: 5,
      requireToolApproval: true,
    });
    let sawApproval = false;
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'tool-call-approval') {
        sawApproval = true;
        break;
      }
    }
    expect(sawApproval).toBe(true);
    const outerGateEntry = await getApprovalEntry(mockMemory, memory);
    expect(outerGateEntry.runId).toBe(result.runId);
    // Pre-execution gate: no inner run exists yet.
    expect(outerGateEntry.delegatedRunId).toBeUndefined();

    // ---- Leg 2: approve the outer gate. The sub-agent starts and raises its
    // own delegated approval mid-execution. ----
    const midResumed = await durableAgent.approveToolCall({
      runId: outerGateEntry.runId,
      toolCallId: outerGateEntry.toolCallId,
      memory,
    });
    let sawDelegatedApproval = false;
    for await (const chunk of midResumed.fullStream) {
      if (chunk.type === 'tool-call-approval') {
        sawDelegatedApproval = true;
        break;
      }
    }
    expect(sawDelegatedApproval).toBe(true);
    expect(toolExecutions.count).toBe(0);

    // The workflow suspend payload — the durable source of truth for the resume
    // leg — now carries the inner suspended run, partitioned by toolCallId.
    const workflows = (await storage.getStore('workflows'))!;
    await vi.waitFor(async () => {
      const persisted = await workflows.getWorkflowRunById({
        runId: result.runId,
        workflowName: DurableStepIds.AGENTIC_LOOP,
      });
      const snapshot = typeof persisted?.snapshot === 'string' ? JSON.parse(persisted.snapshot) : persisted?.snapshot;
      expect(snapshot?.status).toBe('suspended');
      const innerRunId = JSON.stringify(snapshot).match(/"suspendedToolRunId":"([^"]+)"/)?.[1];
      expect(innerRunId).toBeDefined();
      expect(innerRunId).not.toBe(result.runId);
    });

    // ---- Leg 3: approve the delegated request with the same persisted pair.
    // Even though the tool is approval-gated at the outer step, the decision
    // must resume the suspended inner run instead of re-executing the
    // delegation from scratch. ----
    const resumed = await durableAgent.approveToolCall({
      runId: outerGateEntry.runId,
      toolCallId: outerGateEntry.toolCallId,
      memory,
    });
    await drainAndAssertResumed(resumed, toolExecutions);
  }, 30000);

  it('resumes with the persisted pair on a fresh process over the same storage', async () => {
    const storage = new InMemoryStore();
    const memoryStorage = new InMemoryStore();
    const mockMemory1 = new MockMemory({ storage: memoryStorage });
    const memory = { thread: 'durable-restart-thread', resource: 'durable-restart-resource' };
    const toolExecutions = { count: 0 };

    // ---- Process 1: run to the approval suspension ----
    const durableAgent1 = createDurableAgent({ agent: buildSupervisor(mockMemory1, toolExecutions), pubsub });
    new Mastra({ agents: { durableAgent: durableAgent1 }, storage, logger: false });
    await runToApproval(durableAgent1, memory, storage);

    const entry = await getApprovalEntry(mockMemory1, memory);
    expect(entry.delegatedRunId).toBeDefined();

    // ---- Simulate restart: clear process-local runtime state, then use fresh
    // pubsub, memory/agent instances, and Mastra backed by the same persisted
    // workflow and message storage. ----
    globalRunRegistry.clear();
    const pubsub2 = new EventEmitterPubSub();
    const mockMemory2 = new MockMemory({ storage: memoryStorage });
    try {
      const durableAgent2 = createDurableAgent({
        agent: buildSupervisor(mockMemory2, toolExecutions),
        pubsub: pubsub2,
      });
      new Mastra({ agents: { durableAgent: durableAgent2 }, storage, logger: false });

      const resumed = await durableAgent2.approveToolCall({
        runId: entry.runId,
        toolCallId: entry.toolCallId,
        memory,
      });
      await drainAndAssertResumed(resumed, toolExecutions);
    } finally {
      await pubsub2.close();
    }
  }, 30000);
});
