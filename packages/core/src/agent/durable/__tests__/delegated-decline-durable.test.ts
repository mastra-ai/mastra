/**
 * Durable delegated-decline regression (#26994).
 *
 * When a durable supervisor declines a tool approval raised by a sub-agent, the
 * decline must be forwarded to the suspended inner run, mirroring the approve
 * path and the regular Agent. The sub-agent receives the decline (with its
 * reason), the inner tool never executes, and the supervisor's delegation call
 * completes with the sub-agent's own result rather than a local `output-denied`.
 * A decline of the supervisor's own pre-execution gate stays local.
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

const DECLINE_REASON = 'not allowed today';
const SUB_AGENT_ANSWER = 'Sub-agent handled the decline.';
const SUPERVISOR_ANSWER = 'Supervisor finished.';

type Captured = { subAgentPrompts: string[]; supervisorPrompts: string[] };

const hasToolMessage = (prompt: unknown) =>
  Array.isArray(prompt) && prompt.some((message: { role?: string }) => message.role === 'tool');

const toolCallStream = (id: string, toolCallId: string, toolName: string, input: string) => ({
  rawCall: { rawPrompt: null, rawSettings: {} },
  warnings: [],
  stream: convertArrayToReadableStream<any>([
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id, modelId: 'mock-model', timestamp: new Date(0) },
    { type: 'tool-call', toolCallType: 'function', toolCallId, toolName, input, providerExecuted: false },
    { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } },
  ]),
});

const textStream = (id: string, text: string) => ({
  rawCall: { rawPrompt: null, rawSettings: {} },
  warnings: [],
  stream: convertArrayToReadableStream<any>([
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id, modelId: 'mock-model', timestamp: new Date(0) },
    { type: 'text-start', id: `${id}-text` },
    { type: 'text-delta', id: `${id}-text`, delta: text },
    { type: 'text-end', id: `${id}-text` },
    { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } },
  ]),
});

/** Content-driven so a rebuilt instance (simulated restart) behaves identically. */
function makeSubAgentModel(captured: Captured) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      captured.subAgentPrompts.push(JSON.stringify(prompt));
      return hasToolMessage(prompt)
        ? textStream('sub-1', SUB_AGENT_ANSWER)
        : toolCallStream('sub-0', 'inner-call-1', 'secretTool', '{"query":"classified"}');
    },
  });
}

function makeSupervisorModel(captured: Captured) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      captured.supervisorPrompts.push(JSON.stringify(prompt));
      return hasToolMessage(prompt)
        ? textStream('sup-1', SUPERVISOR_ANSWER)
        : toolCallStream('sup-0', 'outer-call-1', 'agent-subAgent', JSON.stringify({ prompt: 'fetch the secret' }));
    },
  });
}

describe('durable delegated approval decline (#26994)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    globalRunRegistry.clear();
    await pubsub.close();
  });

  const buildSupervisor = (mockMemory: MockMemory, toolExecutions: { count: number }, captured: Captured) => {
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
      model: makeSubAgentModel(captured) as LanguageModelV2,
      tools: { secretTool },
    });
    return new Agent({
      id: 'supervisor',
      name: 'Supervisor',
      instructions: 'Delegate to subAgent.',
      model: makeSupervisorModel(captured) as LanguageModelV2,
      agents: { subAgent },
      memory: mockMemory,
    });
  };

  const readUntilApproval = async (stream: AsyncIterable<{ type: string; payload?: any }>) => {
    const seen: string[] = [];
    for await (const chunk of stream) {
      seen.push(chunk.type);
      if (chunk.type === 'tool-call-approval') return chunk.payload;
    }
    throw new Error(`no tool-call-approval; chunks: ${seen.join(', ')}`);
  };

  const waitForSuspended = async (storage: InMemoryStore, runId: string) => {
    const workflows = (await storage.getStore('workflows'))!;
    await vi.waitFor(async () => {
      const persisted = await workflows.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP });
      const snapshot = typeof persisted?.snapshot === 'string' ? JSON.parse(persisted.snapshot) : persisted?.snapshot;
      expect(snapshot?.status).toBe('suspended');
    });
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

  const drain = async (stream: AsyncIterable<any>) => {
    const chunks: any[] = [];
    let text = '';
    for await (const chunk of stream) {
      chunks.push(chunk);
      if (chunk.type === 'text-delta') text += chunk.payload?.text ?? '';
    }
    return { chunks, types: chunks.map(c => c.type as string), text };
  };

  /** The decline reached the sub-agent and the supervisor received the sub-agent's own result. */
  const assertForwardedDecline = (
    { chunks, types, text }: Awaited<ReturnType<typeof drain>>,
    toolExecutions: { count: number },
    captured: Captured,
  ) => {
    const label = `resumed chunks: ${types.join(', ')}`;
    expect(types, label).not.toContain('error');
    expect(types, label).not.toContain('tool-error');
    expect(types, label).not.toContain('tool-call-approval');
    // Not denied locally on the supervisor's delegation call.
    expect(
      chunks.filter(c => c.type === 'tool-output-denied' && c.payload?.toolName === 'agent-subAgent'),
      label,
    ).toHaveLength(0);
    // The inner tool never ran.
    expect(toolExecutions.count).toBe(0);
    // The sub-agent resumed with the decline and its reason, then answered.
    const resumedSubPrompt = captured.subAgentPrompts.find(p => p.includes('"role":"tool"'));
    expect(resumedSubPrompt, 'sub-agent was resumed with a tool response').toBeDefined();
    expect(resumedSubPrompt).toContain(DECLINE_REASON);
    const delegationResult = chunks.find(c => c.type === 'tool-result' && c.payload?.toolName === 'agent-subAgent')
      ?.payload?.result;
    expect(delegationResult?.text, label).toBe(SUB_AGENT_ANSWER);
    expect(text).toBe(SUPERVISOR_ANSWER);
  };

  it('forwards a declined delegated approval on a fresh process over the same storage', async () => {
    const storage = new InMemoryStore();
    const memoryStorage = new InMemoryStore();
    const memory = { thread: 'durable-decline-restart-thread', resource: 'durable-decline-restart-resource' };
    const toolExecutions = { count: 0 };
    const captured: Captured = { subAgentPrompts: [], supervisorPrompts: [] };

    const mockMemory1 = new MockMemory({ storage: memoryStorage });
    const durableAgent1 = createDurableAgent({ agent: buildSupervisor(mockMemory1, toolExecutions, captured), pubsub });
    new Mastra({ agents: { durableAgent: durableAgent1 }, storage, logger: false });

    const result = await durableAgent1.stream('Get the secret', { memory, maxSteps: 5 });
    await readUntilApproval(result.fullStream);
    await waitForSuspended(storage, result.runId);
    const entry = await getApprovalEntry(mockMemory1, memory);
    expect(entry.delegatedRunId).toBeDefined();

    globalRunRegistry.clear();
    const pubsub2 = new EventEmitterPubSub();
    try {
      const mockMemory2 = new MockMemory({ storage: memoryStorage });
      const durableAgent2 = createDurableAgent({
        agent: buildSupervisor(mockMemory2, toolExecutions, captured),
        pubsub: pubsub2,
      });
      new Mastra({ agents: { durableAgent: durableAgent2 }, storage, logger: false });

      const resumed = await durableAgent2.declineToolCall({
        runId: entry.runId,
        toolCallId: entry.toolCallId,
        reason: DECLINE_REASON,
        memory,
      });
      assertForwardedDecline(await drain(resumed.fullStream), toolExecutions, captured);
    } finally {
      await pubsub2.close();
    }
  }, 30000);
});
