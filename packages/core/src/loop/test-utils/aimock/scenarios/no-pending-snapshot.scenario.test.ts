import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { createTool } from '../../../../tools';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Scenario: agent turns do not persist a "pending" snapshot before inference.
 *
 * Only suspended/paused agent-loop snapshots are resumable, so the loop skips the
 * pre-inference "pending" write. Suspend/resume must keep working without it.
 */
describeForAllEngines('AIMock loop scenario: no pending agent-loop snapshot', engine => {
  const getMock = useLoopScenarioAimock();

  async function spyOnSnapshots(mastra: any) {
    const store = await mastra.getStorage().getStore('workflows');
    return vi.spyOn(store, 'persistWorkflowSnapshot');
  }

  function persistedStatuses(spy: ReturnType<typeof vi.fn>) {
    return spy.mock.calls
      .map(([args]: any[]) => ({ workflowName: args.workflowName, status: args.snapshot?.status }))
      .filter(c => c.workflowName === 'agentic-loop' || c.workflowName === 'agentic-execution');
  }

  function createApprovalTool(onExecute: () => void) {
    return createTool({
      id: 'confirm-op',
      description: 'Operation requiring confirmation',
      inputSchema: z.object({ name: z.string() }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async (inputData, context) => {
        if (!context?.agent?.resumeData) {
          return await context?.agent?.suspend({ message: `Confirm ${inputData.name}` });
        }
        onExecute();
        return { ok: true };
      },
    });
  }

  const fixtures = (llm: any) => {
    llm.onMessage(/confirm/i, {
      toolCalls: [{ id: 'call-confirm-1', name: 'confirm-op', arguments: { name: 'x' } }],
    });
  };

  it('does not persist a pending snapshot on a plain turn', async () => {
    const memory = new MockMemory();
    const shared = await createSharedAgent(getMock(), { memory, engine });
    const spy = await spyOnSnapshots(shared.mastra);

    await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'hello there',
      memory,
      threadId: 'no-pending-thread',
      resourceId: 'r',
      fixtures: llm => llm.onMessage(/hello/i, { content: 'hi' }),
    });

    expect(persistedStatuses(spy).filter(c => c.status === 'pending')).toEqual([]);
  });

  async function suspendRun(threadId: string) {
    let executions = 0;
    const memory = new MockMemory();
    const shared = await createSharedAgent(getMock(), {
      tools: { confirmOp: createApprovalTool(() => executions++) },
      memory,
      engine,
    });
    const spy = await spyOnSnapshots(shared.mastra);
    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'confirm this',
      memory,
      threadId,
      resourceId: 'r',
      fixtures,
      collectChunks: true,
    });
    const suspended = chunks!.find(c => c.type === 'tool-call-suspended') as any;
    expect(suspended).toBeDefined();
    const resume = async () => {
      const r = await shared.agent.resumeStream(
        { approved: true },
        { runId: output.runId, toolCallId: suspended.payload.toolCallId },
      );
      for await (const _ of r.fullStream) {
        // drain
      }
    };
    return { spy, resume, executions: () => executions };
  }

  it('resumes immediately after suspend without a pending snapshot', async () => {
    const { spy, resume, executions } = await suspendRun('early-resume-thread');
    expect(persistedStatuses(spy).filter(c => c.status === 'pending')).toEqual([]);
    await resume();
    expect(executions()).toBe(1);
  });

  it('reports no snapshot when resuming a run that never suspended', async () => {
    const memory = new MockMemory();
    const shared = await createSharedAgent(getMock(), { memory, engine });

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'hello crash',
      memory,
      threadId: 'never-suspended-thread',
      resourceId: 'r',
      fixtures: llm => llm.onMessage(/hello/i, { content: 'hi' }),
    });

    await expect(
      shared.agent.resumeStream({ approved: true }, { runId: output.runId, toolCallId: 'missing' }),
    ).rejects.toThrow();
  });
});
