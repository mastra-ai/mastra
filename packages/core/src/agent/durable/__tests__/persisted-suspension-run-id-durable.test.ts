/**
 * Durable delegated non-approval suspension resume regression (#20496).
 *
 * When a durable supervisor delegates to a sub-agent whose tool suspends
 * mid-execution WITHOUT an approval (the tool calls `context.agent.suspend()`),
 * the suspension metadata persisted on the supervisor's assistant message must
 * store the outer resumable durable runId with the inner delegated run
 * preserved separately as `delegatedRunId`, and the workflow suspend payload
 * must carry `suspendedToolRunId`. Resuming with the persisted
 * (runId, toolCallId) pair and resume data must continue the suspended inner
 * run — not restart the sub-agent — both in-process and on a fresh process
 * over the same storage (server restart).
 *
 * This mirrors the delegated-approval fix from #20492; the general suspension
 * branch previously dropped the inner run id entirely.
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
 * behaves identically — calls the suspending tool until its result is in the
 * conversation, then answers.
 */
function makeSubAgentModel() {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const hasToolResult = JSON.stringify(prompt).includes('lookup-result-payload');
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
              toolName: 'lookupTool',
              input: '{"query":"lookup"}',
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
          { type: 'text-delta', id: 'sub-text', delta: 'Lookup finished.' },
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
      const hasDelegationResult = JSON.stringify(prompt).includes('Lookup finished');
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
              input: JSON.stringify({ prompt: 'look up the data' }),
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

describe('durable delegated non-approval suspension persisted runId', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    globalRunRegistry.clear();
    await pubsub.close();
  });

  const buildSupervisor = (mockMemory: MockMemory, toolExecutions: { count: number; resumeData: unknown[] }) => {
    const lookupTool = createTool({
      id: 'lookupTool',
      description: 'Looks up data; suspends for extra input',
      inputSchema: z.object({ query: z.string() }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.object({ extraInfo: z.string() }),
      execute: async (input: { query: string }, context: any) => {
        if (!context?.agent?.resumeData) {
          return await context?.agent?.suspend({ message: `Need more info for: ${input.query}` });
        }
        toolExecutions.count++;
        toolExecutions.resumeData.push(context.agent.resumeData);
        return { result: 'lookup-result-payload', extra: context.agent.resumeData.extraInfo };
      },
    });
    const subAgent = new Agent({
      id: 'subAgent',
      name: 'subAgent',
      description: 'Looks up data',
      instructions: 'Look up data with your tool.',
      model: makeSubAgentModel() as LanguageModelV2,
      tools: { lookupTool },
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

  const runToSuspension = async (
    durableAgent: {
      stream: (prompt: string, options: any) => Promise<{ runId: string; fullStream: AsyncIterable<{ type: string }> }>;
    },
    memory: { thread: string; resource: string },
    storage: InMemoryStore,
  ) => {
    const result = await durableAgent.stream('Look up the data', { memory, maxSteps: 5 });
    let sawSuspension = false;
    const seen: string[] = [];
    for await (const chunk of result.fullStream) {
      seen.push(chunk.type);
      if (chunk.type === 'tool-call-suspended') {
        sawSuspension = true;
        break;
      }
    }
    expect(sawSuspension, `chunks: ${seen.join(', ')}`).toBe(true);
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

  const getSuspensionEntry = async (mockMemory: MockMemory, memory: { thread: string; resource: string }) => {
    return vi.waitFor(async () => {
      const { messages } = await mockMemory.recall({ threadId: memory.thread, resourceId: memory.resource });
      const withSuspension = [...messages]
        .reverse()
        .find((m: any) => m.role === 'assistant' && (m.content as any)?.metadata?.suspendedTools);
      const suspensions = (withSuspension as any)?.content?.metadata?.suspendedTools as Record<string, any> | undefined;
      expect(suspensions).toBeDefined();
      return Object.values(suspensions!)[0] as Record<string, any>;
    });
  };

  const drainAndAssertResumed = async (
    resumed: { fullStream: AsyncIterable<any> },
    toolExecutions: { count: number; resumeData: unknown[] },
  ) => {
    const types: string[] = [];
    let finalText = '';
    for await (const chunk of resumed.fullStream) {
      types.push(chunk.type);
      if (chunk.type === 'text-delta') finalText += chunk.payload?.text ?? '';
    }
    const label = `resumed chunks: ${types.join(', ')}`;
    // The suspended inner run resumes: no tool errors, no re-delegation, and no
    // repeated suspension.
    expect(types, label).not.toContain('tool-error');
    expect(types, label).not.toContain('error');
    expect(types, label).not.toContain('tool-call-suspended');
    expect(
      types.filter(t => t === 'tool-call'),
      label,
    ).toHaveLength(0);
    // The suspended tool completed exactly once with the provided resume data.
    expect(toolExecutions.count).toBe(1);
    expect(toolExecutions.resumeData).toEqual([{ extraInfo: 'the missing detail' }]);
    expect(finalText).toBe('Delegation complete.');
  };

  it('persists the outer runId with delegatedRunId and resumes in-process', async () => {
    const storage = new InMemoryStore();
    const mockMemory = new MockMemory();
    const memory = { thread: 'durable-suspension-thread', resource: 'durable-suspension-resource' };
    const toolExecutions = { count: 0, resumeData: [] as unknown[] };

    const durableAgent = createDurableAgent({ agent: buildSupervisor(mockMemory, toolExecutions), pubsub });
    new Mastra({ agents: { durableAgent }, storage, logger: false });

    const outerRunId = await runToSuspension(durableAgent, memory, storage);

    const entry = await getSuspensionEntry(mockMemory, memory);
    // The persisted pair targets the outer resumable durable run; the inner
    // suspended sub-agent run is preserved separately.
    expect(entry.runId).toBe(outerRunId);
    expect(entry.delegatedRunId).toBeDefined();
    expect(entry.delegatedRunId).not.toBe(entry.runId);
    expect(toolExecutions.count).toBe(0);

    const resumed = await durableAgent.resumeStream(
      { extraInfo: 'the missing detail' },
      { runId: entry.runId, toolCallId: entry.toolCallId, memory },
    );
    await drainAndAssertResumed(resumed, toolExecutions);
  }, 30000);

  it('resumes with the persisted pair on a fresh process over the same storage', async () => {
    const storage = new InMemoryStore();
    const mockMemory = new MockMemory();
    const memory = { thread: 'durable-suspension-restart-thread', resource: 'durable-suspension-restart-resource' };
    const toolExecutions = { count: 0, resumeData: [] as unknown[] };

    // ---- Process 1: run to the suspension. ----
    const durableAgent = createDurableAgent({ agent: buildSupervisor(mockMemory, toolExecutions), pubsub });
    new Mastra({ agents: { durableAgent }, storage, logger: false });

    const outerRunId = await runToSuspension(durableAgent, memory, storage);
    const entry = await getSuspensionEntry(mockMemory, memory);
    expect(entry.runId).toBe(outerRunId);
    expect(entry.delegatedRunId).toBeDefined();

    // ---- Simulated restart: fresh instances over the same storage and
    // memory; the in-process run registry is gone. ----
    globalRunRegistry.clear();
    await pubsub.close();
    pubsub = new EventEmitterPubSub();

    const freshAgent = createDurableAgent({ agent: buildSupervisor(mockMemory, toolExecutions), pubsub });
    new Mastra({ agents: { durableAgent: freshAgent }, storage, logger: false });

    const resumed = await freshAgent.resumeStream(
      { extraInfo: 'the missing detail' },
      { runId: entry.runId, toolCallId: entry.toolCallId, memory },
    );
    await drainAndAssertResumed(resumed, toolExecutions);
  }, 30000);
});
