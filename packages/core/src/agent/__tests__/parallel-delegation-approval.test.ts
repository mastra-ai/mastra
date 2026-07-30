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
 * Root cause: the agentic loop tracks suspended/pending tool state in a map
 * keyed by toolName (metadata.pendingToolApprovals[toolName]), NOT by
 * toolCallId — see tool-call-step.ts. When a supervisor emits TWO parallel
 * delegations to the SAME sub-agent in one assistant step, both suspend their
 * own inner sub-agent run, but they share ONE outer supervisor run. The second
 * suspension overwrites the first's entry in the toolName-keyed map, so only
 * one inner runId survives.
 *
 * On resume, approveToolCall() reconstructs the inner run by looking the entry
 * up by toolName, so both approvals resolve to the same surviving entry.
 * Approving the first advances/clears the shared state; the second
 * approveToolCall() then finds no snapshot and fails with
 * AGENT_RESUME_NO_SNAPSHOT_FOUND — so only one of the two delegated actions
 * executes.
 *
 * Two parallel delegations to the same sub-agent are required to reproduce
 * faithfully: the two distinct approval chunks emit correctly (proving emission
 * is fine), and the bug is isolated to the resume path.
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
  argsText: string;
}

async function collectApprovals(stream: any): Promise<ApprovalSeen[]> {
  const approvals: ApprovalSeen[] = [];
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'tool-call-approval') {
      const p: any = (chunk as any).payload ?? {};
      approvals.push({
        toolCallId: String(p.toolCallId ?? ''),
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

    // Emission is correct: two approvals, one per order, with distinct ids.
    expect(approvals.length).toBe(2);
    expect(approvals.some(a => a.argsText.includes(ORDER_A))).toBe(true);
    expect(approvals.some(a => a.argsText.includes(ORDER_B))).toBe(true);
    expect(new Set(approvals.map(a => a.toolCallId)).size).toBe(2);
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
    for (const toolCall of toolCalls) {
      expect(toolCall.toolName).toBe('agent-subAgent');
      expect(toolCall.requiresApproval).toBe(true);
    }
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
    // recovered purely from the persisted assistant message. If pendingToolApprovals were keyed
    // by toolName, the two delegations to the same sub-agent would collapse to one persisted
    // entry and the second resume would fail (AGENT_RESUME_NO_SNAPSHOT_FOUND) — exactly the
    // collision the live-resume snapshot path cannot help with after a reload.
    processedOrders.length = 0;
    const storage = new InMemoryStore();

    // First instance: emit the two approvals, then discard the instance entirely.
    let runId: string;
    let approvals: ApprovalSeen[];
    {
      const supervisor = buildSupervisorAgent(storage);
      const stream = await supervisor.stream('Process both orders in parallel.', {
        maxSteps: 6,
        memory: { resource: 'rep_approval', thread: 'thread-reload' },
      });
      approvals = await collectApprovals(stream);
      runId = stream.runId;
      expect(approvals.length).toBe(2);
    }

    // Second instance: brand-new agent + Mastra over the SAME storage. No in-memory run state
    // survives, so resume relies solely on the persisted pendingToolApprovals entries.
    const reloadedSupervisor = buildSupervisorAgent(storage);
    const resumeErrors: string[] = [];
    for (const a of approvals) {
      const resumed = await reloadedSupervisor.approveToolCall({ runId, toolCallId: a.toolCallId });
      for await (const chunk of resumed.fullStream) {
        if (chunk.type === 'tool-error') resumeErrors.push(JSON.stringify((chunk as any).payload ?? chunk));
      }
    }

    expect(resumeErrors).toEqual([]);
    expect(processedOrders.slice().sort()).toEqual([ORDER_A, ORDER_B].sort());
  });
});
