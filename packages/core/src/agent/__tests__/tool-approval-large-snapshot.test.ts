/**
 * Large-snapshot HITL resume (issue #22413).
 *
 * The suspension for an approval-gated tool call is written to the nested
 * `executionWorkflow` row first and only later to the parent `agentic-loop` row
 * that resume hydration reads. The `tool-call-approval` chunk is emitted before
 * either row is durable, so a client can approve immediately — before the parent
 * row carries the suspension. Because snapshot write time scales with snapshot
 * size, a fixed 2s validation deadline wrongly rejected large, genuinely-suspended
 * runs with `AGENT_RESUME_TOOL_CALL_NOT_SUSPENDED`.
 *
 * These tests pin the fixed behavior: the validator waits for the parent row to
 * become durable (keyed to observed persistence, not a fixed deadline) while still
 * rejecting a stale/non-suspended tool call promptly.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import type { WorkflowRunState } from '../../workflows/types';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

const executedCalls: string[] = [];

function createApprovalTool() {
  return createTool({
    id: 'findUserTool',
    description: 'Returns the name and email of a user',
    inputSchema: z.object({ name: z.string() }),
    requireApproval: true,
    execute: async (input: { name: string }) => {
      executedCalls.push(input.name);
      return { name: input.name, email: `${input.name}@mail.com` };
    },
  });
}

/** One approval-gated tool call on the first turn, then a final text answer. */
function createApprovalModel(toolCallId = 'call-1') {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId,
              toolName: 'findUserTool',
              input: '{"name":"Dero Israel"}',
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
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'User found' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      };
    },
  });
}

/**
 * Delay the durable suspend write of the parent `agentic-loop` row, modeling a
 * large snapshot whose write outlasts the old fixed deadline. The initial
 * `running` persist stays fast, so the run is observably progressing toward
 * suspension while the suspended snapshot write is in flight.
 */
async function delayAgenticLoopSuspendWrite(storage: InMemoryStore, delayMs: number) {
  const workflows = (await storage.getStore('workflows'))!;
  const originalPersist = workflows.persistWorkflowSnapshot.bind(workflows);
  workflows.persistWorkflowSnapshot = async (args: {
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
    [key: string]: unknown;
  }) => {
    if (args.workflowName === 'agentic-loop' && args.snapshot?.status === 'suspended') {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return originalPersist(args as any);
  };
}

function createSetup(storage: InMemoryStore, toolCallId?: string) {
  const agent = new Agent({
    id: 'user-agent',
    name: 'User Agent',
    instructions: 'You find users.',
    model: createApprovalModel(toolCallId),
    tools: { findUserTool: createApprovalTool() },
  });
  const mastra = new Mastra({ agents: { agent }, logger: false, storage });
  return { agent, mastra };
}

async function streamToApproval(agent: Agent, prompt = 'Find the user with name - Dero Israel') {
  const stream = await agent.stream(prompt, { memory: { thread: crypto.randomUUID(), resource: crypto.randomUUID() } });
  let toolCallId = '';
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'tool-call-approval') {
      toolCallId = chunk.payload.toolCallId;
      break;
    }
  }
  return { runId: stream.runId, toolCallId };
}

describe('approveToolCall with a slow-to-persist (large) suspend snapshot (#22413)', () => {
  beforeEach(() => {
    executedCalls.length = 0;
  });

  it('resumes a genuinely-suspended run even when the parent snapshot write outlasts the old 2s deadline', async () => {
    const storage = new InMemoryStore();
    // Must exceed main's combined wait budget (2s in #loadAgenticLoopSnapshotOrThrow +
    // 2s in the old validator poll), otherwise the old code passes by accident.
    await delayAgenticLoopSuspendWrite(storage, 6000);
    const { agent } = createSetup(storage);

    const { runId, toolCallId } = await streamToApproval(agent);
    expect(toolCallId).toBeTruthy();

    const resumeStream = await agent.approveToolCall({ runId, toolCallId });
    for await (const _chunk of resumeStream.fullStream) {
      // drain
    }

    expect(executedCalls).toContain('Dero Israel');
    const toolResults = await resumeStream.toolResults;
    const result = toolResults?.find((r: any) => r.payload.toolName === 'findUserTool')?.payload;
    expect((result?.result as any)?.name).toBe('Dero Israel');
  }, 30000);

  it('still rejects a stale/non-suspended tool call promptly', async () => {
    const storage = new InMemoryStore();
    const { agent } = createSetup(storage);

    const { runId, toolCallId } = await streamToApproval(agent);
    expect(toolCallId).toBeTruthy();

    const start = Date.now();
    await expect(agent.approveToolCall({ runId, toolCallId: 'does-not-exist' })).rejects.toThrow(/not suspended/i);
    // Must not hang to the safety ceiling: a different tool call is suspended, so
    // this is a genuine (fast) rejection.
    expect(Date.now() - start).toBeLessThan(2000);

    expect(executedCalls).not.toContain('Dero Israel');
  }, 30000);

  it('control: small-snapshot immediate approval resumes without delay', async () => {
    const storage = new InMemoryStore();
    const { agent } = createSetup(storage);

    const { runId, toolCallId } = await streamToApproval(agent);
    const resumeStream = await agent.approveToolCall({ runId, toolCallId });
    for await (const _chunk of resumeStream.fullStream) {
      // drain
    }

    expect(executedCalls).toContain('Dero Israel');
  }, 30000);
});
