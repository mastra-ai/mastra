import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';

/**
 * Deterministic reproduction of the parallel sub-agent delegation
 * suspend/resume collision.
 *
 * Root cause: both delegated calls share one assistant response. The first
 * suspension flushes that response, removing it from the unsaved response view.
 * The second suspension previously found no response message and silently skipped
 * its pendingToolApprovals write. Both approval chunks and workflow snapshots
 * existed, but only one approval target survived in persisted message metadata,
 * so a cold reload could not reconstruct and resume both calls.
 *
 * Two parallel delegations to the same sub-agent are required to reproduce
 * faithfully: each call has its own toolCallId and inner suspended run, while
 * both metadata writes target the same outer assistant message.
 *
 * Originally observed live with real OpenRouter models in a support-copilot
 * demo (two parallel refunds → only one refund landed).
 *
 * Related: https://github.com/mastra-ai/mastra/issues/10389
 */

const ORDER_A = 'ord_AAA';
const ORDER_B = 'ord_BBB';

// Orders whose approval-gated tool actually executed.
const processedOrders: string[] = [];

/**
 * Sub-agent: on first turn it calls an approval-gated process-order tool (which
 * suspends); once the tool result is present it reports completion. The order id
 * comes straight from the delegation prompt, so each parallel run is isolated.
 */
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
      const order = text.includes(ORDER_B) ? ORDER_B : ORDER_A;
      const hasToolResult = text.includes('"processed"');

      const chunks = hasToolResult
        ? [
            { type: 'text-start', id: `t-${order}` },
            { type: 'text-delta', id: `t-${order}`, delta: `Processed ${order}.` },
            { type: 'text-end', id: `t-${order}` },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]
        : [
            {
              type: 'tool-call',
              toolCallId: `tc-${order}`,
              toolName: 'process-order',
              input: JSON.stringify({ orderId: order }),
            },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ];

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `sub-${order}`, modelId: 'mock-model-id', timestamp: new Date(0) },
          ...chunks,
        ] as any),
      };
    },
  });

  return new Agent({
    id: 'sub-agent',
    name: 'Sub Agent',
    description: 'Processes a single order.',
    instructions: 'Process the order in the prompt by calling process-order, then report which order you processed.',
    model,
    tools: { processOrderTool },
  });
}

/** Supervisor: first turn emits two parallel delegations; later turns report done. */
function buildSupervisor(subAgent: Agent) {
  let step = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      step += 1;
      const chunks =
        step === 1
          ? [
              {
                type: 'tool-call',
                toolCallId: 'sup-tc-A',
                toolName: 'agent-subAgent',
                input: JSON.stringify({ prompt: `Process order ${ORDER_A}.`, maxSteps: 3 }),
              },
              {
                type: 'tool-call',
                toolCallId: 'sup-tc-B',
                toolName: 'agent-subAgent',
                input: JSON.stringify({ prompt: `Process order ${ORDER_B}.`, maxSteps: 3 }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]
          : [
              { type: 'text-start', id: 'sup-final-t' },
              { type: 'text-delta', id: 'sup-final-t', delta: 'Both orders processed.' },
              { type: 'text-end', id: 'sup-final-t' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ];

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `sup-${step}`, modelId: 'mock-model-id', timestamp: new Date(0) },
          ...chunks,
        ] as any),
      };
    },
  });

  return new Agent({
    id: 'supervisor',
    name: 'Supervisor',
    instructions: 'Delegate each order to the sub agent.',
    model,
    agents: { subAgent },
    memory: new MockMemory(),
  });
}

interface ApprovalSeen {
  toolCallId: string;
  toolName: string;
  argsText: string;
}

async function collectApprovals(stream: any): Promise<ApprovalSeen[]> {
  const approvals: ApprovalSeen[] = [];
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'tool-call-approval') {
      const p: any = (chunk as any).payload ?? {};
      approvals.push({
        toolCallId: String(p.toolCallId ?? ''),
        toolName: String(p.toolName ?? ''),
        argsText: JSON.stringify(p.args ?? p.input ?? {}),
      });
    }
  }
  return approvals;
}

function buildSupervisorAgent(storage: InMemoryStore = new InMemoryStore()) {
  const sup = buildSupervisor(buildSubAgent());
  const mastra = new Mastra({ agents: { supervisor: sup }, logger: false, storage });
  return mastra.getAgent('supervisor');
}

describe('parallel sub-agent delegation (suspend/resume)', () => {
  it('emits two distinct approval requests, one per order', async () => {
    processedOrders.length = 0;
    const supervisor = buildSupervisorAgent();

    const stream = await supervisor.stream('Process both orders in parallel.', {
      maxSteps: 6,
      memory: { resource: 'rep_approval', thread: 'thread-emit' },
    });

    const approvals = await collectApprovals(stream);

    // Keep the outer delegation ids for targeted resume, but disclose the inner
    // approval target so the user sees the actual action and arguments.
    expect(approvals).toHaveLength(2);
    expect(approvals.every(a => a.toolName === 'process-order')).toBe(true);
    expect(approvals.some(a => a.argsText.includes(ORDER_A))).toBe(true);
    expect(approvals.some(a => a.argsText.includes(ORDER_B))).toBe(true);
    expect(new Set(approvals.map(a => a.toolCallId))).toEqual(new Set(['sup-tc-A', 'sup-tc-B']));
  });

  it('rejects a targeted approval when that tool call is not actually suspended', async () => {
    processedOrders.length = 0;
    const supervisor = buildSupervisorAgent();

    const stream = await supervisor.stream('Process both orders in parallel.', {
      maxSteps: 6,
      memory: { resource: 'rep_approval', thread: 'thread-wrong-target' },
    });

    await collectApprovals(stream);
    const bogusToolCallId = 'sup-tc-nonexistent';

    let resumeError: unknown;
    try {
      const resumed = await supervisor.approveToolCall({
        runId: stream.runId,
        toolCallId: bogusToolCallId,
      });
      for await (const _chunk of resumed.fullStream) {
        // Drain the stream so unintended tool execution cannot leak into later tests.
      }
    } catch (error) {
      resumeError = error;
    }

    expect(resumeError).toMatchObject({ id: 'AGENT_RESUME_TOOL_CALL_NOT_SUSPENDED' });
    await expect(
      supervisor.resumeGenerate({ approved: true }, { runId: stream.runId, toolCallId: bogusToolCallId }),
    ).rejects.toMatchObject({ id: 'AGENT_RESUME_TOOL_CALL_NOT_SUSPENDED' });
    await expect(
      supervisor.resumeGenerate({ approved: true }, { runId: stream.runId, toolCallId: '' }),
    ).rejects.toMatchObject({ id: 'AGENT_RESUME_TOOL_CALL_NOT_SUSPENDED' });
    expect(processedOrders).toEqual([]);
  }, 30_000);

  it('surfaces BOTH suspended delegations in listSuspendedRuns', async () => {
    processedOrders.length = 0;
    const supervisor = buildSupervisorAgent();

    const stream = await supervisor.stream('Process both orders in parallel.', {
      maxSteps: 6,
      memory: { resource: 'rep_approval', thread: 'thread-surface' },
    });

    const approvals = await collectApprovals(stream);
    expect(approvals.length).toBe(2);

    const [{ toolCalls }] = (await supervisor.listSuspendedRuns()).runs;
    const suspendedToolCallIds = toolCalls.map(toolCall => toolCall.toolCallId).sort();
    expect(suspendedToolCallIds).toEqual(['sup-tc-A', 'sup-tc-B']);
    expect(toolCalls.every(toolCall => toolCall.toolName === 'process-order')).toBe(true);
    expect(toolCalls.some(toolCall => JSON.stringify(toolCall.args).includes(ORDER_A))).toBe(true);
    expect(toolCalls.some(toolCall => JSON.stringify(toolCall.args).includes(ORDER_B))).toBe(true);
    expect(toolCalls.every(toolCall => toolCall.requiresApproval)).toBe(true);
  });

  it('approving the delegations OUT OF ORDER (B first) processes both orders correctly', async () => {
    processedOrders.length = 0;
    const supervisor = buildSupervisorAgent();

    const stream = await supervisor.stream('Process both orders in parallel.', {
      maxSteps: 6,
      memory: { resource: 'rep_approval', thread: 'thread-out-of-order' },
    });

    const approvals = await collectApprovals(stream);
    const runId = stream.runId;
    expect(approvals.length).toBe(2);

    // Approve the SECOND emitted card first — the field failure ("approve the
    // bottom card") that previously resumed the wrong delegation.
    const outOfOrder = [...approvals].reverse();
    const resumeErrors: string[] = [];
    for (const a of outOfOrder) {
      const resumed = await supervisor.approveToolCall({ runId, toolCallId: a.toolCallId });
      for await (const chunk of resumed.fullStream) {
        if (chunk.type === 'tool-error') resumeErrors.push(JSON.stringify((chunk as any).payload ?? chunk));
      }
    }

    expect(resumeErrors).toEqual([]);
    // Approval order must map to execution order: B was approved first.
    expect(processedOrders).toEqual([ORDER_B, ORDER_A]);
  });

  it('approving both parallel delegations one at a time processes BOTH orders', async () => {
    processedOrders.length = 0;
    const supervisor = buildSupervisorAgent();

    const stream = await supervisor.stream('Process both orders in parallel.', {
      maxSteps: 6,
      memory: { resource: 'rep_approval', thread: 'thread-resume' },
    });

    const approvals = await collectApprovals(stream);
    const runId = stream.runId;
    expect(approvals.length).toBe(2);

    // Approve each pending tool call by id, one at a time.
    const resumeErrors: string[] = [];
    for (const a of approvals) {
      const resumed = await supervisor.approveToolCall({ runId, toolCallId: a.toolCallId });
      for await (const chunk of resumed.fullStream) {
        if (chunk.type === 'tool-error') resumeErrors.push(JSON.stringify((chunk as any).payload ?? chunk));
      }
    }

    // Both orders must execute; neither approval should fail to resume.
    expect(resumeErrors).toEqual([]);
    expect(processedOrders.slice().sort()).toEqual([ORDER_A, ORDER_B].sort());
  });

  it('resuming from a cold reload (no live workflow run) still processes BOTH orders', async () => {
    // Page-refresh scenario: the run that emitted the approvals is gone. Resume happens on a
    // *fresh* agent/Mastra instance backed by the same storage, so the suspended run ids must be
    // recovered purely from the persisted assistant message. If the second suspension loses its
    // metadata write after the first suspension flushes their shared response, the second resume
    // fails because its exact persisted target is unavailable after the reload.
    processedOrders.length = 0;
    const storage = new InMemoryStore();

    // First instance: emit the two approvals, then discard the instance entirely.
    let approvals: ApprovalSeen[];
    const persistedTargets = new Map<
      string,
      {
        runId: string;
        delegatedRunId?: string;
        toolName?: string;
        args?: unknown;
        parentToolName?: string;
        parentArgs?: unknown;
      }
    >();
    {
      const supervisor = buildSupervisorAgent(storage);
      const stream = await supervisor.stream('Process both orders in parallel.', {
        maxSteps: 6,
        memory: { resource: 'rep_approval', thread: 'thread-reload' },
      });
      approvals = await collectApprovals(stream);
      expect(approvals.length).toBe(2);

      const memory = await supervisor.getMemory();
      const recalled = await memory?.recall({
        threadId: 'thread-reload',
        resourceId: 'rep_approval',
        perPage: false,
      });
      for (const message of recalled?.messages ?? []) {
        const metadata = message.content?.metadata as Record<string, unknown> | undefined;
        const pending = (metadata?.pendingToolApprovals ?? {}) as Record<string, unknown>;
        for (const entry of Object.values(pending) as Array<{
          toolCallId?: string;
          toolName?: string;
          args?: unknown;
          parentToolName?: string;
          parentArgs?: unknown;
          runId?: string;
          delegatedRunId?: string;
        }>) {
          if (entry.toolCallId && entry.runId) {
            persistedTargets.set(entry.toolCallId, {
              runId: entry.runId,
              delegatedRunId: entry.delegatedRunId,
              toolName: entry.toolName,
              args: entry.args,
              parentToolName: entry.parentToolName,
              parentArgs: entry.parentArgs,
            });
          }
        }
      }

      expect([...persistedTargets.keys()].sort()).toEqual(approvals.map(approval => approval.toolCallId).sort());
      expect([...persistedTargets.values()].every(target => target.runId === stream.runId)).toBe(true);
      expect([...persistedTargets.values()].every(target => target.toolName === 'process-order')).toBe(true);
      expect([...persistedTargets.values()].every(target => target.parentToolName === 'agent-subAgent')).toBe(true);
      expect([...persistedTargets.values()].some(target => JSON.stringify(target.args).includes(ORDER_A))).toBe(true);
      expect([...persistedTargets.values()].some(target => JSON.stringify(target.args).includes(ORDER_B))).toBe(true);
      expect([...persistedTargets.values()].some(target => JSON.stringify(target.parentArgs).includes(ORDER_A))).toBe(
        true,
      );
      expect([...persistedTargets.values()].some(target => JSON.stringify(target.parentArgs).includes(ORDER_B))).toBe(
        true,
      );
      const delegatedRunIds = [...persistedTargets.values()].map(target => target.delegatedRunId);
      expect(delegatedRunIds.every(Boolean)).toBe(true);
      expect(new Set(delegatedRunIds).size).toBe(2);
    }

    // Second instance: brand-new agent + Mastra over the SAME storage. No in-memory run state
    // survives, so resume uses only the exact targets reconstructed from pendingToolApprovals.
    const reloadedSupervisor = buildSupervisorAgent(storage);
    const resumeErrors: string[] = [];
    for (const approval of [...approvals].reverse()) {
      const target = persistedTargets.get(approval.toolCallId)!;
      const resumed = await reloadedSupervisor.approveToolCall({
        runId: target.runId,
        toolCallId: approval.toolCallId,
      });
      for await (const chunk of resumed.fullStream) {
        if (chunk.type === 'tool-error') resumeErrors.push(JSON.stringify((chunk as any).payload ?? chunk));
      }
    }

    expect(resumeErrors).toEqual([]);
    expect(processedOrders.slice().sort()).toEqual([ORDER_A, ORDER_B].sort());
  });
});
