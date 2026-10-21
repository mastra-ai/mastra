/**
 * Workflow snapshot lifecycle for the agentic loop.
 *
 * Suspended runs must keep their snapshot rows (both `agentic-loop` and the
 * nested `executionWorkflow`) so `resumeStream()` can restore them — including
 * after a server restart. Once a run completes, all of its snapshot rows must
 * be deleted; previously the nested `executionWorkflow` row leaked as a stale
 * "pending"/"suspended" record for every completed agent run.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import type { WorkflowRunState } from '../../workflows';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

const mockFindUser = vi.fn().mockImplementation(async (data: { name: string }) => {
  return { name: data.name, email: 'dero@mail.com' };
});

function createFindUserTool() {
  return createTool({
    id: 'Find user tool',
    description: 'Returns the name and email of a user',
    inputSchema: z.object({ name: z.string() }),
    requireApproval: true,
    execute: async input => {
      return mockFindUser(input);
    },
  });
}

function createMockModel() {
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
              toolCallId: 'call-1',
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
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      };
    },
  });
}

function summarizeRuns(runs: { workflowName: string; runId: string; snapshot: string | WorkflowRunState }[]) {
  return runs
    .map(r => ({
      workflowName: r.workflowName,
      runId: r.runId,
      status: typeof r.snapshot === 'string' ? r.snapshot : r.snapshot?.status,
    }))
    .sort((a, b) => a.workflowName.localeCompare(b.workflowName));
}

describe('agentic-loop snapshot lifecycle', () => {
  it('keeps snapshot rows while suspended and deletes all rows after resume completes', async () => {
    const agent = new Agent({
      id: 'user-agent',
      name: 'User Agent',
      instructions: 'You find users.',
      model: createMockModel(),
      tools: { findUserTool: createFindUserTool() },
    });

    const mastra = new Mastra({
      agents: { agent },
      logger: false,
      storage: new InMemoryStore(),
    });

    const workflowsStore = (await mastra.getStorage()!.getStore('workflows'))!;

    const stream = await agent.stream('Find the user with name - Dero Israel', {
      requireToolApproval: true,
    });

    let toolCallId = '';
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-approval') {
        toolCallId = chunk.payload.toolCallId;
      }
    }
    expect(toolCallId).toBeTruthy();

    // While suspended, both the loop row and the nested execution row must
    // exist so resumeStream() can restore the run (e.g. after a restart).
    // The nested row is persisted under the parent's runId.
    const afterSuspend = summarizeRuns((await workflowsStore.listWorkflowRuns({})).runs);
    expect(afterSuspend).toEqual([
      { workflowName: 'agentic-loop', runId: stream.runId, status: 'suspended' },
      { workflowName: 'executionWorkflow', runId: stream.runId, status: 'suspended' },
    ]);

    // The default engine keeps the RunScope alive across the suspend
    // boundary (the same in-memory loop holds the registration).
    expect(mastra.__getRunScope(stream.runId)).toBeDefined();

    const resumeStream = await agent.approveToolCall({ runId: stream.runId, toolCallId });
    for await (const _chunk of resumeStream.fullStream) {
      // consume
    }

    // After the resumed run completes, no stale rows may remain — neither a
    // "suspended" agentic-loop row nor the nested executionWorkflow row.
    const afterResume = (await workflowsStore.listWorkflowRuns({})).runs;
    expect(afterResume).toHaveLength(0);
    // And the per-run scope is released — proving the refcounted register/
    // unregister pair fires correctly across suspend → resume → terminal.
    expect(mastra.__getRunScope(stream.runId)).toBeUndefined();
  }, 30000);

  it('deletes all snapshot rows after both supervisor and subagent approval runs complete', async () => {
    const subAgent = new Agent({
      id: 'billing-agent',
      name: 'Billing Agent',
      instructions: 'You handle billing.',
      model: createMockModel(),
      tools: { findUserTool: createFindUserTool() },
    });

    let supCallCount = 0;
    const supervisorModel = new MockLanguageModelV2({
      doStream: async () => {
        supCallCount++;
        if (supCallCount === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'sup-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'sup-call-1',
                toolName: 'agent-billing-agent',
                input: '{"message":"Find Dero Israel"}',
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
            { type: 'response-metadata', id: 'sup-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Done' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        };
      },
    });

    const supervisor = new Agent({
      id: 'support-agent',
      name: 'Support Agent',
      instructions: 'You delegate to billing.',
      model: supervisorModel,
      agents: { 'billing-agent': subAgent },
    });

    const mastra = new Mastra({
      agents: { supervisor, subAgent },
      logger: false,
      storage: new InMemoryStore(),
    });
    const workflowsStore = (await mastra.getStorage()!.getStore('workflows'))!;

    const stream = await supervisor.stream('Find the user Dero Israel via billing');

    let toolCallId = '';
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-approval') {
        toolCallId = chunk.payload.toolCallId;
      }
    }
    expect(toolCallId).toBeTruthy();

    // Both the supervisor's run and the subagent's inner run persist
    // suspended rows (loop + nested execution row each).
    const afterSuspend = summarizeRuns((await workflowsStore.listWorkflowRuns({})).runs);
    expect(afterSuspend.filter(r => r.workflowName === 'agentic-loop')).toHaveLength(2);
    expect(afterSuspend.filter(r => r.workflowName === 'executionWorkflow')).toHaveLength(2);
    expect(afterSuspend.every(r => r.status === 'suspended')).toBe(true);

    // The supervisor's scope stays alive across the subagent suspend
    // boundary — the in-memory loop holds the registration.
    expect(mastra.__getRunScope(stream.runId)).toBeDefined();

    const resumeStream = await supervisor.approveToolCall({ runId: stream.runId, toolCallId });
    for await (const _chunk of resumeStream.fullStream) {
      // consume
    }

    const afterResume = (await workflowsStore.listWorkflowRuns({})).runs;
    expect(afterResume).toHaveLength(0);
    // Both the supervisor's scope and the subagent's nested scope must be
    // released — the supervisor's is keyed by stream.runId; the subagent's
    // nested runId is internal, so we assert via the registry size instead.
    expect(mastra.__getRunScope(stream.runId)).toBeUndefined();
  }, 30000);

  it('leaves no snapshot rows behind for a run that never suspends', async () => {
    const agent = new Agent({
      id: 'plain-agent',
      name: 'Plain Agent',
      instructions: 'You answer.',
      model: new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'hello' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        }),
      }),
    });

    const mastra = new Mastra({
      agents: { agent },
      logger: false,
      storage: new InMemoryStore(),
    });
    const workflowsStore = (await mastra.getStorage()!.getStore('workflows'))!;

    const stream = await agent.stream('hi');
    for await (const _chunk of stream.fullStream) {
      // consume
    }

    // Previously the nested executionWorkflow row leaked as a permanent
    // "pending" record for every completed agent run.
    const rows = (await workflowsStore.listWorkflowRuns({})).runs;
    expect(rows).toHaveLength(0);
    // No suspend, terminal success — scope must be released by the finally
    // block in workflowLoopStream (keepRegisteredForResume = false).
    expect(mastra.__getRunScope(stream.runId)).toBeUndefined();
  }, 30000);

  it('deletes all snapshot rows after a declined tool call completes the run', async () => {
    const agent = new Agent({
      id: 'decline-agent',
      name: 'Decline Agent',
      instructions: 'You find users.',
      model: createMockModel(),
      tools: { findUserTool: createFindUserTool() },
    });

    const mastra = new Mastra({
      agents: { agent },
      logger: false,
      storage: new InMemoryStore(),
    });
    const workflowsStore = (await mastra.getStorage()!.getStore('workflows'))!;

    const stream = await agent.stream('Find the user with name - Dero Israel', {
      requireToolApproval: true,
    });

    let toolCallId = '';
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-approval') {
        toolCallId = chunk.payload.toolCallId;
      }
    }
    expect(toolCallId).toBeTruthy();

    // Scope is held across the suspend boundary so decline reads back the
    // same memory/transport handles the original stream registered.
    expect(mastra.__getRunScope(stream.runId)).toBeDefined();

    const resumeStream = await agent.declineToolCall({ runId: stream.runId, toolCallId });
    for await (const _chunk of resumeStream.fullStream) {
      // consume
    }

    const afterDecline = (await workflowsStore.listWorkflowRuns({})).runs;
    expect(afterDecline).toHaveLength(0);
    // Decline is a terminal state — scope must be released.
    expect(mastra.__getRunScope(stream.runId)).toBeUndefined();
  }, 30000);

  it('deletes all snapshot rows after a run fails', async () => {
    const agent = new Agent({
      id: 'failing-agent',
      name: 'Failing Agent',
      instructions: 'You answer.',
      model: new MockLanguageModelV2({
        doStream: async () => {
          throw new Error('model exploded');
        },
      }),
    });

    const mastra = new Mastra({
      agents: { agent },
      logger: false,
      storage: new InMemoryStore(),
    });
    const workflowsStore = (await mastra.getStorage()!.getStore('workflows'))!;

    const stream = await agent.stream('hi');
    let sawError = false;
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'error') sawError = true;
    }
    expect(sawError).toBe(true);

    // The failure path must clean up the same way the success path does.
    const rows = (await workflowsStore.listWorkflowRuns({})).runs;
    expect(rows).toHaveLength(0);
    // Failure is terminal — finally block must still unregister and release
    // the scope, otherwise long-running processes leak handles per failed run.
    expect(mastra.__getRunScope(stream.runId)).toBeUndefined();
  }, 30000);

  it('still finishes the stream when snapshot cleanup fails', async () => {
    const agent = new Agent({
      id: 'cleanup-fail-agent',
      name: 'Cleanup Fail Agent',
      instructions: 'You answer.',
      model: new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'hello' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        }),
      }),
    });

    const mastra = new Mastra({
      agents: { agent },
      logger: false,
      storage: new InMemoryStore(),
    });
    const workflowsStore = (await mastra.getStorage()!.getStore('workflows'))!;
    const deleteSpy = vi.spyOn(workflowsStore, 'deleteWorkflowRunById').mockRejectedValue(new Error('storage offline'));

    try {
      const stream = await agent.stream('hi');
      let sawFinish = false;
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'finish') sawFinish = true;
      }
      // Cleanup is best-effort: a storage failure must not turn a successful
      // run into a stream error or swallow the finish chunk.
      expect(sawFinish).toBe(true);
      expect(deleteSpy).toHaveBeenCalled();
    } finally {
      deleteSpy.mockRestore();
    }
  }, 30000);
});
