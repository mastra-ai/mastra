import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';

/**
 * Regression tests: persisted delegated approval metadata must carry the
 * OUTER resumable supervisor runId.
 *
 * When a delegated sub-agent tool requires approval, the persisted
 * `message.content.metadata.pendingToolApprovals[toolCallId].runId` must equal
 * the runId returned by `listSuspendedRuns()` for the run containing the same
 * toolCallId — otherwise refresh/restart resume via the persisted pair fails
 * closed. The inner delegated run is preserved separately as `delegatedRunId`.
 */

const ORDER = 'ord_R4';
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
            { type: 'text-start', id: 't-sub' },
            { type: 'text-delta', id: 't-sub', delta: `Processed ${ORDER}.` },
            { type: 'text-end', id: 't-sub' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]
        : [
            {
              type: 'tool-call',
              toolCallId: 'inner-tc-r4',
              toolName: 'process-order',
              input: JSON.stringify({ orderId: ORDER }),
            },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ];

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'sub-resp', modelId: 'mock-model-id', timestamp: new Date(0) },
          ...chunks,
        ] as any),
      };
    },
  });

  return new Agent({
    id: 'sub-agent',
    name: 'Sub Agent',
    description: 'Processes a single order.',
    instructions: 'Process the order in the prompt by calling process-order, then report done.',
    model,
    tools: { processOrderTool },
  });
}

function buildSupervisor(subAgent: Agent, memory: MockMemory) {
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      // Content-driven so the mock stays stable across an instance rebuild
      // (a closure step counter would reset and delegate again after resume).
      const text = JSON.stringify(prompt);
      const hasDelegationResult = text.includes('"tool-result"') && text.includes('agent-subAgent');
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
              toolCallId: 'sup-tc-r4',
              toolName: 'agent-subAgent',
              input: JSON.stringify({ prompt: `Process order ${ORDER}.`, maxSteps: 3 }),
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            },
          ];

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'sup-resp', modelId: 'mock-model-id', timestamp: new Date(0) },
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
    agents: { subAgent },
    memory,
  });
}

async function runDelegatedApproval(storage: InMemoryStore, memory: MockMemory, thread: string) {
  const supervisor = buildSupervisor(buildSubAgent(), memory);
  const mastra = new Mastra({ agents: { supervisor: supervisor as Agent }, logger: false, storage });
  const agent = mastra.getAgent('supervisor');

  const stream = await agent.stream('Process the order.', {
    maxSteps: 6,
    memory: { resource: 'rep_r4', thread },
  });

  let liveApprovalRunId: string | undefined;
  let liveApprovalToolCallId: string | undefined;
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'tool-call-approval') {
      liveApprovalRunId = (chunk as any).runId;
      liveApprovalToolCallId = (chunk as any).payload?.toolCallId;
    }
  }

  return { agent, streamRunId: stream.runId, liveApprovalRunId, liveApprovalToolCallId };
}

describe('persisted delegated approval runId', () => {
  it('pendingToolApprovals runId matches the resumable suspended supervisor run', async () => {
    processedOrders.length = 0;
    const storage = new InMemoryStore();
    const memory = new MockMemory({ storage });
    const thread = 'thread-persist-r4';

    const { agent, streamRunId, liveApprovalRunId, liveApprovalToolCallId } = await runDelegatedApproval(
      storage,
      memory,
      thread,
    );

    expect(liveApprovalToolCallId).toBeDefined();

    // Persisted assistant message metadata.
    const { messages } = await memory.recall({ threadId: thread });
    const assistantWithApproval = [...messages]
      .reverse()
      .find(message => message.role === 'assistant' && (message.content as any)?.metadata?.pendingToolApprovals);
    expect(assistantWithApproval).toBeDefined();
    const pending = (assistantWithApproval!.content as any).metadata.pendingToolApprovals as Record<string, any>;
    const entry = Object.values(pending).find((e: any) => e?.toolCallId === liveApprovalToolCallId);
    expect(entry).toBeDefined();

    // Actual resumable suspended supervisor run.
    const { runs } = await agent.listSuspendedRuns();
    const suspendedRun = runs.find(run => run.toolCalls.some(call => call.toolCallId === liveApprovalToolCallId));
    expect(suspendedRun).toBeDefined();

    // Persisted target must be directly resumable: the outer supervisor run.
    expect(entry!.runId).toBe(suspendedRun!.runId);
    expect(entry!.runId).toBe(streamRunId);
    expect(entry!.runId).toBe(liveApprovalRunId);
    // The inner delegated run stays available for the sub-agent resume leg.
    expect(entry!.delegatedRunId).toBeDefined();
    expect(entry!.delegatedRunId).not.toBe(entry!.runId);
  }, 30_000);

  it('resuming with the persisted (runId, toolCallId) pair on a fresh instance succeeds', async () => {
    processedOrders.length = 0;
    const storage = new InMemoryStore();
    const memoryStorage = new InMemoryStore();
    const memory = new MockMemory({ storage: memoryStorage });
    const thread = 'thread-persist-r4-resume';

    const { liveApprovalToolCallId } = await runDelegatedApproval(storage, memory, thread);

    // Read the persisted approval target, as a rehydrating client would.
    const { messages } = await memory.recall({ threadId: thread });
    const assistantWithApproval = [...messages]
      .reverse()
      .find(message => message.role === 'assistant' && (message.content as any)?.metadata?.pendingToolApprovals);
    const pending = (assistantWithApproval!.content as any).metadata.pendingToolApprovals as Record<string, any>;
    const entry = Object.values(pending).find((e: any) => e?.toolCallId === liveApprovalToolCallId)!;

    // Fresh instance over the same storage (server restart).
    const reloaded = buildSupervisor(buildSubAgent(), new MockMemory({ storage: memoryStorage }));
    const mastra2 = new Mastra({ agents: { supervisor: reloaded as Agent }, logger: false, storage });
    const freshAgent = mastra2.getAgent('supervisor');

    const resumed = await freshAgent.resumeStream(
      { approved: true },
      { runId: entry.runId, toolCallId: entry.toolCallId },
    );
    const errors: string[] = [];
    const newApprovals: string[] = [];
    let finalText = '';
    for await (const chunk of resumed.fullStream) {
      if (chunk.type === 'error' || chunk.type === 'tool-error') {
        errors.push(JSON.stringify((chunk as any).payload ?? chunk));
      }
      if (chunk.type === 'tool-call-approval') {
        newApprovals.push((chunk as any).payload?.toolCallId);
      }
      if (chunk.type === 'text-delta') {
        finalText += (chunk as any).payload?.text ?? '';
      }
    }

    expect(errors).toEqual([]);
    expect(processedOrders).toEqual([ORDER]);
    // The resumed leg must complete: final supervisor output, no re-delegation,
    // no second approval request, and nothing left suspended.
    expect(newApprovals).toEqual([]);
    expect(finalText).toContain('Order processed.');
    const { runs: remaining } = await freshAgent.listSuspendedRuns();
    expect(remaining).toEqual([]);
  }, 30_000);
});
