/**
 * Sub-agent tool approvals recovered purely from persisted metadata.
 *
 * When a parent agent delegates to a sub-agent whose tool requires approval,
 * the suspension metadata stores the nested run in `runId` and the parent run
 * in `parentRunId`. Consumers that recover after a restart (e.g. channel
 * approval-button clicks, where the in-memory card stash is gone) must resume
 * through the parent agent with `parentRunId ?? runId`. Resuming with the
 * nested run id on the parent agent is rejected.
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';

const THREAD_ID = 'thread-restart';
const RESOURCE_ID = 'resource-restart';

const processedOrders: string[] = [];

function buildSubAgent() {
  const processOrderTool = createTool({
    id: 'process-order',
    description: 'Process the given order. Requires human approval.',
    inputSchema: z.object({ orderId: z.string() }),
    outputSchema: z.object({ orderId: z.string(), processed: z.boolean() }),
    requireApproval: true,
    execute: async ({ orderId }: { orderId: string }) => {
      processedOrders.push(orderId);
      return { orderId, processed: true };
    },
  });

  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const text = JSON.stringify(prompt);
      const hasToolResult = text.includes('"processed"');
      const chunks = hasToolResult
        ? [
            { type: 'text-start', id: 't-1' },
            { type: 'text-delta', id: 't-1', delta: 'Processed ord_AAA.' },
            { type: 'text-end', id: 't-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]
        : [
            {
              type: 'tool-call',
              toolCallId: 'tc-A',
              toolName: 'process-order',
              input: JSON.stringify({ orderId: 'ord_AAA' }),
            },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'sub-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          ...chunks,
        ] as any),
      };
    },
  });

  return new Agent({
    id: 'sub-agent',
    name: 'Sub Agent',
    description: 'Processes a single order.',
    instructions: 'Process the order by calling process-order.',
    model,
    tools: { processOrderTool },
  });
}

function buildSupervisor(memory: MockMemory) {
  // Prompt-driven (not call-counted) so a fresh instance behaves correctly on resume.
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const text = JSON.stringify(prompt);
      const hasDelegationResult = text.includes('Processed ord_AAA');
      const chunks = hasDelegationResult
        ? [
            { type: 'text-start', id: 'sup-final-t' },
            { type: 'text-delta', id: 'sup-final-t', delta: 'Order processed.' },
            { type: 'text-end', id: 'sup-final-t' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]
        : [
            {
              type: 'tool-call',
              toolCallId: 'sup-tc-A',
              toolName: 'agent-subAgent',
              input: JSON.stringify({ prompt: 'Process order ord_AAA.', maxSteps: 3 }),
            },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'sup-x', modelId: 'mock-model-id', timestamp: new Date(0) },
          ...chunks,
        ] as any),
      };
    },
  });

  return new Agent({
    id: 'supervisor',
    name: 'Supervisor',
    instructions: 'Delegate the order to the sub agent.',
    model,
    agents: { subAgent: buildSubAgent() },
    memory,
  });
}

/** Mirrors the AgentChannels fallback: find the pending approval in persisted message metadata. */
async function findPendingApproval(memory: MockMemory, toolCallId: string) {
  const { messages } = await memory.recall({ threadId: THREAD_ID, resourceId: RESOURCE_ID, perPage: 50 });
  for (const msg of messages ?? []) {
    const pending = (msg as any).content?.metadata?.pendingToolApprovals as
      | Record<string, { toolCallId: string; runId: string; parentRunId?: string }>
      | undefined;
    if (!pending) continue;
    for (const toolData of Object.values(pending)) {
      if (toolData.toolCallId === toolCallId) return toolData;
    }
  }
  return undefined;
}

async function suspendOnFreshInstance(storage: InMemoryStore, memory: MockMemory) {
  const mastra = new Mastra({ agents: { supervisor: buildSupervisor(memory) }, logger: false, storage });
  const supervisor = mastra.getAgent('supervisor');
  const stream = await supervisor.stream('Process order ord_AAA.', {
    maxSteps: 6,
    memory: { resource: RESOURCE_ID, thread: THREAD_ID },
  });
  let toolCallId = '';
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'tool-call-approval') toolCallId = chunk.payload.toolCallId;
  }
  expect(toolCallId).toBeTruthy();
  return { parentRunId: stream.runId, toolCallId };
}

describe('sub-agent approval recovery from persisted metadata', () => {
  it('resumes via parentRunId after a restart', async () => {
    processedOrders.length = 0;
    const storage = new InMemoryStore();
    const memory = new MockMemory();

    const { parentRunId, toolCallId } = await suspendOnFreshInstance(storage, memory);

    const pending = await findPendingApproval(memory, toolCallId);
    expect(pending).toBeDefined();
    // The nested sub-agent run differs from the parent run; both are persisted.
    expect(pending!.runId).not.toBe(parentRunId);
    expect(pending!.parentRunId).toBe(parentRunId);

    // "Restart": fresh Mastra and agent instances on the same storage.
    const mastraB = new Mastra({ agents: { supervisor: buildSupervisor(memory) }, logger: false, storage });
    const supervisorB = mastraB.getAgent('supervisor');

    // Resume the way the channels fallback does after this fix.
    const resumed = await supervisorB.approveToolCall({
      runId: pending!.parentRunId ?? pending!.runId,
      toolCallId,
    });
    for await (const _chunk of resumed.fullStream) {
      // consume
    }

    expect(processedOrders).toEqual(['ord_AAA']);
  }, 30000);

  it('rejects resuming with the nested run id on the parent agent', async () => {
    processedOrders.length = 0;
    const storage = new InMemoryStore();
    const memory = new MockMemory();

    const { toolCallId } = await suspendOnFreshInstance(storage, memory);
    const pending = await findPendingApproval(memory, toolCallId);
    expect(pending).toBeDefined();

    const mastraB = new Mastra({ agents: { supervisor: buildSupervisor(memory) }, logger: false, storage });
    const supervisorB = mastraB.getAgent('supervisor');

    // The pre-fix channels fallback resumed with the nested run id — that fails.
    await expect(async () => {
      const resumed = await supervisorB.approveToolCall({ runId: pending!.runId, toolCallId });
      for await (const _chunk of resumed.fullStream) {
        // consume
      }
    }).rejects.toMatchObject({ id: 'AGENT_RESUME_TOOL_CALL_NOT_SUSPENDED' });

    expect(processedOrders).toEqual([]);
  }, 30000);
});
