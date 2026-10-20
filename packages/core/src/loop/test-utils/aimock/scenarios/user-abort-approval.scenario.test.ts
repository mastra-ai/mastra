/**
 * What a user sees when they stop a run that is waiting on a tool approval (#27617, #27619, #26871).
 *
 * - The user aborts the parked approval, then clicks approve: the tool must not run.
 * - The user's host disconnects while the approval is parked (a local-only abort, as a session
 *   does when it detaches), then the user approves from another connection: the tool runs once.
 * - On durable, the user aborts, the run finishes, then opens the suspended-runs list: the run is gone.
 */
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import type { EngineVariant } from '../types';

const THREAD = { thread: 'approval-thread', resource: 'approval-user' };

const errorId = (error: unknown) =>
  typeof error === 'object' && error !== null && 'id' in error && typeof error.id === 'string'
    ? error.id
    : String(error);

function scriptModel(llm: ReturnType<ReturnType<typeof useLoopScenarioAimock>>) {
  llm.on(
    { endpoint: 'chat', hasToolResult: false },
    { toolCalls: [{ id: 'call_lookup', name: 'lookup_status', arguments: { query: 'alpha' } }] },
  );
  llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Status is OK.' });
}

function lookupTool(executed: string[]) {
  return createTool({
    id: 'lookup_status',
    description: 'Look up a status.',
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ query }) => {
      executed.push(query);
      return { status: `OK:${query}` };
    },
  });
}

function parkedApprovalHelpers(engine: EngineVariant, getMock: ReturnType<typeof useLoopScenarioAimock>) {
  async function parkApproval(onThread: boolean) {
    const llm = getMock();
    scriptModel(llm);
    const executed: string[] = [];
    const { agent } = await createSharedAgent(llm, {
      engine,
      tools: { lookup_status: lookupTool(executed) },
      ...(onThread ? { memory: new MockMemory() } : {}),
    });
    const output = await agent.stream('Look up alpha', {
      requireToolApproval: true,
      maxSteps: 5,
      ...(onThread ? { memory: THREAD } : {}),
    });
    let approvalSeen = false;
    for await (const chunk of output.fullStream) {
      if (chunk.type === 'tool-call-approval') {
        approvalSeen = true;
        break;
      }
    }
    expect(approvalSeen).toBe(true);
    expect(executed).toEqual([]);
    return { llm, agent, executed, runId: output.runId };
  }

  // Approve: the user clicked approve. Returns the error the user saw, the abort the stream
  // ended with, or the streamed text.
  async function approve(agent: Awaited<ReturnType<typeof parkApproval>>['agent'], runId: string) {
    try {
      const resumed = await agent.approveToolCall({ runId, toolCallId: 'call_lookup' });
      let text = '';
      for await (const chunk of resumed.fullStream) {
        if (chunk.type === 'text-delta') text += chunk.payload.text;
      }
      const finishReason = await resumed.finishReason;
      // The durable stream adapter reports 'abort'; the base stream reports 'aborted'.
      return finishReason === 'aborted' || finishReason === 'abort' ? { finishReason } : { text };
    } catch (error) {
      return { error: errorId(error) };
    }
  }

  return { parkApproval, approve };
}

describeForAllEngines('User stops a run parked on a tool approval', engine => {
  const { parkApproval, approve } = parkedApprovalHelpers(engine, useLoopScenarioAimock());

  it('aborts the parked approval, then clicks approve: the tool does not run', async () => {
    const { llm, agent, executed, runId } = await parkApproval(false);
    expect(agent.abortRunStream(runId)).toBe(true);

    const outcome = await approve(agent, runId);

    expect(executed).toEqual([]);
    // Either the approval is refused, or the resumed stream ends as aborted without the tool.
    expect([
      { error: 'AGENT_RESUME_ABORTED_RUN' },
      { finishReason: 'aborted' },
      { finishReason: 'abort' },
    ]).toContainEqual(outcome);
    // Only the turn that asked for approval reached the model.
    expect(llm.getRequests()).toHaveLength(1);
  }, 30_000);
});

// On normal and fs a local-only detach already leaves the approval answerable on main, so those
// legs cannot show anything about the fence; only the durable engines lose the approval on main.
describeForAllEngines(
  'User host disconnects while a tool approval is parked',
  engine => {
    const { parkApproval, approve } = parkedApprovalHelpers(engine, useLoopScenarioAimock());

    it('host disconnects while the approval is parked, user approves from another connection: the tool runs once', async () => {
      const { agent, executed, runId } = await parkApproval(true);
      // A session detaching from the thread aborts only what this host owns and must leave
      // the approval answerable (#26871).
      agent.abortThreadStream({ threadId: THREAD.thread, resourceId: THREAD.resource, localOnly: true });

      const outcome = await approve(agent, runId);

      expect(outcome).toEqual({ text: 'Status is OK.' });
      expect(executed).toEqual(['alpha']);
    }, 30_000);
  },
  { skip: ['normal', 'fs'] },
);

// #27619 was reported on durable: the other engines never listed an approval-suspended run.
describeForAllEngines(
  'User aborts a parked approval, the run finishes, then opens the suspended-runs list (#27619)',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('no longer lists the run', async () => {
      const llm = getMock();
      scriptModel(llm);
      const executed: string[] = [];
      const { agent } = await createSharedAgent(llm, { engine, tools: { lookup_status: lookupTool(executed) } });
      const isListed = async (runId: string) => (await agent.listSuspendedRuns()).runs.some(run => run.runId === runId);

      const output = await agent.stream('Look up alpha', { requireToolApproval: true, maxSteps: 5 });
      for await (const chunk of output.fullStream) {
        if (chunk.type === 'tool-call-approval') break;
      }
      expect(await isListed(output.runId)).toBe(true);
      expect(agent.abortRunStream(output.runId)).toBe(true);

      // The user clicks approve on the stopped run; the run finishes either way.
      try {
        const resumed = await agent.approveToolCall({ runId: output.runId, toolCallId: 'call_lookup' });
        for await (const _chunk of resumed.fullStream) {
          // Drain until the run finishes.
        }
      } catch {
        // Rejecting the approval of an aborted run is the #27617 outcome.
      }

      expect(await isListed(output.runId)).toBe(false);
      expect(executed).toEqual([]);
    }, 30_000);
  },
  { skip: ['normal', 'evented', 'fs'] },
);
