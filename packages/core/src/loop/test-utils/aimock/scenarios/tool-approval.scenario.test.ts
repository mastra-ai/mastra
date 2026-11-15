import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { MockMemory } from '../../../../memory';
import {
  createSharedAgent,
  describeForAllEngines,
  runApprovalScenario,
  runLoopScenario,
  useLoopScenarioAimock,
} from '../aimock-scenario';

/**
 * Regression class: tool approval + suspend/resume.
 *
 * With `requireToolApproval: true` the loop suspends before executing a tool,
 * emits a `tool-call-approval` chunk, and persists a snapshot. The run is then
 * resumed via approve/decline. These scenarios prove the suspend → resume →
 * continue path keeps message ordering and tool plumbing intact across the
 * snapshot boundary.
 */
describeForAllEngines('AIMock loop scenario: tool approval suspend/resume', engine => {
  const getMock = useLoopScenarioAimock();

  const makeLookupTool = () =>
    createTool({
      id: 'lookup_status',
      description: 'Look up a status payload for a query.',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ status: z.string() }),
      execute: async ({ query }) => ({ status: `STATUS_OK:${query}` }),
    });

  it('approves a suspended tool call, executes it, then completes', async () => {
    const { output, chunks, approvals, requests } = await runApprovalScenario({
      llm: getMock(),
      engine,
      prompt: 'Look up the status for query alpha.',
      tools: { lookup_status: makeLookupTool() },
      stopWhen: stepCountIs(5),
      decision: () => true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_lookup_alpha', name: 'lookup_status', arguments: { query: 'alpha' } }] },
        );
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_lookup_alpha', hasToolResult: true },
          { content: 'The status for alpha is STATUS_OK:alpha.' },
        );
      },
    });

    // The loop suspended for exactly one approval, which we approved.
    expect(approvals).toEqual(['approve:call_lookup_alpha']);

    // The approval chunk was surfaced before resume.
    expect(chunks.some(chunk => chunk.type === 'tool-call-approval')).toBe(true);

    // After approval the tool executed and the model produced its final answer.
    const text = await output.text;
    expect(text).toContain('STATUS_OK:alpha');

    // Two model turns total: the tool-call turn and the post-result turn. The
    // approval pause does not insert an extra model request.
    expect(requests).toHaveLength(2);

    // The post-resume request carries the executed tool result keyed to the
    // original tool call id.
    const turn2Messages = requests[1]?.body?.messages ?? [];
    const toolMessage = turn2Messages.find(message => (message as { role?: string }).role === 'tool') as
      | { tool_call_id?: string }
      | undefined;
    expect(toolMessage?.tool_call_id).toBe('call_lookup_alpha');
  });

  it('declines a suspended tool call and reports the denial back to the model', async () => {
    const { output, approvals, requests } = await runApprovalScenario({
      llm: getMock(),
      engine,
      prompt: 'Look up the status for query beta.',
      tools: { lookup_status: makeLookupTool() },
      stopWhen: stepCountIs(5),
      decision: () => false,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_lookup_beta', name: 'lookup_status', arguments: { query: 'beta' } }] },
        );
        // After the decline is reported as the tool result, the model wraps up.
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Understood, I will not look that up.' });
      },
    });

    expect(approvals).toEqual(['decline:call_lookup_beta']);

    // A declined tool must NOT produce its real execution payload downstream.
    const turn2Messages = requests[1]?.body?.messages ?? [];
    const serialized = JSON.stringify(turn2Messages);
    expect(serialized).not.toContain('STATUS_OK:beta');

    const text = await output.text;
    expect(text).toContain('will not look that up');
  });

  it('declineToolCall never executes when gated only by function requireToolApproval (#20470)', async () => {
    let executions = 0;
    const dangerTool = createTool({
      id: 'do_the_thing',
      description: 'Performs an irreversible action',
      inputSchema: z.object({ label: z.string() }),
      outputSchema: z.object({ done: z.boolean() }),
      execute: async () => {
        executions += 1;
        return { done: true };
      },
    });

    const { approvals, requests } = await runApprovalScenario({
      llm: getMock(),
      engine,
      prompt: 'Use the label "beta".',
      tools: { do_the_thing: dangerTool },
      stopWhen: stepCountIs(5),
      requireToolApproval: ({ toolName }) => toolName === 'do_the_thing',
      decision: () => false,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_20470_stream', name: 'do_the_thing', arguments: { label: 'beta' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Declined.' });
      },
    });

    expect(approvals).toEqual(['decline:call_20470_stream']);
    expect(executions).toBe(0);
    expect(JSON.stringify(requests[1]?.body?.messages ?? [])).not.toContain('"done":true');
  });

  // A user clicking Approve twice must not run the tool twice, and the second
  // click must fail right away instead of waiting on the first run (#27365).
  it('approving the same tool call twice runs it once and fails the second approval fast', async () => {
    let executions = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const archiveTool = createTool({
      id: 'archive',
      description: 'Archive an item',
      inputSchema: z.object({ item: z.string() }),
      requireApproval: true,
      execute: async () => {
        executions += 1;
        await gate;
        return { archived: true };
      },
    });

    const llm = getMock();
    const memory = new MockMemory();
    const shared = await createSharedAgent(llm, { tools: { archive: archiveTool }, memory, engine });
    const { output, chunks } = await runLoopScenario({
      engine,
      llm,
      sharedAgent: shared,
      prompt: 'Archive a',
      memory,
      threadId: 'double-approve-thread',
      resourceId: 'double-approve-resource',
      collectChunks: true,
      fixtures: mock => {
        mock.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_archive', name: 'archive', arguments: { item: 'a' } }] },
        );
        mock.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Archived.' });
      },
    });
    expect(chunks!.some(chunk => chunk.type === 'tool-call-approval')).toBe(true);

    const first = shared.agent.approveToolCall({ runId: output.runId, toolCallId: 'call_archive' });
    const startedAt = Date.now();
    const second = shared.agent.approveToolCall({ runId: output.runId, toolCallId: 'call_archive' });
    await expect(second).rejects.toMatchObject({ id: 'AGENT_RESUME_ALREADY_CLAIMED' });
    expect(Date.now() - startedAt).toBeLessThan(1_000);

    release();
    const resumed = await first;
    const resumedTypes: string[] = [];
    for await (const chunk of resumed.fullStream) resumedTypes.push(chunk.type);
    expect(resumedTypes).not.toContain('error');
    expect(resumedTypes).toContain('finish');
    expect(executions).toBe(1);
  });

  /** Parks an `archive` call for approval on a shared agent and returns what the Inngest-only cases need. */
  const parkArchive = async (threadId: string) => {
    let executions = 0;
    const archiveTool = createTool({
      id: 'archive',
      description: 'Archive an item',
      inputSchema: z.object({ item: z.string() }),
      requireApproval: true,
      execute: async () => {
        executions += 1;
        return { archived: true };
      },
    });
    const llm = getMock();
    const memory = new MockMemory();
    const shared = await createSharedAgent(llm, { tools: { archive: archiveTool }, memory, engine });
    const { output } = await runLoopScenario({
      engine,
      llm,
      sharedAgent: shared,
      prompt: 'Archive a',
      memory,
      threadId,
      resourceId: `${threadId}-resource`,
      collectChunks: true,
      fixtures: mock => {
        mock.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_archive', name: 'archive', arguments: { item: 'a' } }] },
        );
        mock.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Archived.' });
      },
    });
    const approve = async () => {
      const resumed = await shared.agent.approveToolCall({ runId: output.runId, toolCallId: 'call_archive' });
      for await (const _ of resumed.fullStream) {
        // drain
      }
      return resumed;
    };
    return { shared, runId: output.runId, llm, approve, executions: () => executions };
  };

  // Technical: Inngest claims a suspension by marking it `running`. A resume whose process died after
  // claiming left it there with no live lease, and every later approval failed. Core's durable engines
  // cover their own claim in resume-claim-after-crash.scenario.test.ts.
  (engine === 'inngest' ? it : it.skip)('approves a run whose previous resume died after claiming it', async () => {
    const { shared, runId, approve, executions } = await parkArchive('dead-claim-thread');
    const workflows = await shared.mastra.getStorage().getStore('workflows');
    const loop = 'inngest:durable-agentic-loop';
    // Claims are only taken on the suspension written last, which has no active paths.
    await vi.waitFor(
      async () => {
        const snapshot = await workflows.loadWorkflowSnapshot({ workflowName: loop, runId });
        expect(snapshot).toMatchObject({ status: 'suspended', activePaths: [] });
      },
      { timeout: 10_000 },
    );
    // What a resume that died before sending its event leaves behind: its claim and the run it marked
    // `running`. The claim's lease lapses at once here instead of after 60s.
    await workflows.claimRunOwnership({
      runId: `${loop}:resume-claim:${runId}`,
      ownerId: 'dead-resume',
      leaseMs: 1,
    });
    await workflows.updateWorkflowState({
      workflowName: loop,
      runId,
      opts: { status: 'running', expectedStatus: 'suspended' },
    });
    await new Promise(resolve => setTimeout(resolve, 10));

    const resumed = await approve();
    expect(await resumed.text).toBe('Archived.');
    expect(executions()).toBe(1);
  });

  // Technical: a send can fail after Inngest accepted the event, and the caller may send it again.
  // The resume event's id lets Inngest drop the copy instead of running the tool twice.
  (engine === 'inngest' ? it : it.skip)('runs the tool once when the resume event is delivered twice', async () => {
    const { shared, llm, approve, executions } = await parkArchive('double-delivery-thread');
    const inngest = (shared.agent as unknown as { inngest: { send: (payload: any) => Promise<unknown> } }).inngest;
    const send = inngest.send.bind(inngest);
    inngest.send = async payload => {
      const result = await send(payload);
      if (payload?.data?.resume) await send(payload);
      return result;
    };

    await approve();
    // A duplicate segment would run the tool and call the model again after this one finished.
    await new Promise(resolve => setTimeout(resolve, 3000));
    expect(executions()).toBe(1);
    expect(llm.getRequests()).toHaveLength(2);
  });

  // Technical: Inngest cancelling a resumed segment never reaches the finalize step that ends the run
  // and releases its claim. The `resume-claim-release` function does instead. The run is not parked
  // again: Inngest does not cancel the nested segment, which finishes the tool on its own.
  (engine === 'inngest' ? it : it.skip)(
    'ends the run when Inngest cancels the resumed segment',
    async () => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      let executions = 0;
      const archiveTool = createTool({
        id: 'archive',
        description: 'Archive an item',
        inputSchema: z.object({ item: z.string() }),
        requireApproval: true,
        execute: async () => {
          executions += 1;
          if (executions === 1) await gate;
          return { archived: true };
        },
      });
      const llm = getMock();
      const memory = new MockMemory();
      const shared = await createSharedAgent(llm, { tools: { archive: archiveTool }, memory, engine });
      const { output } = await runLoopScenario({
        engine,
        llm,
        sharedAgent: shared,
        prompt: 'Archive a',
        memory,
        threadId: 'cancelled-resume-thread',
        resourceId: 'cancelled-resume-resource',
        collectChunks: true,
        fixtures: mock => {
          mock.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_archive', name: 'archive', arguments: { item: 'a' } }] },
          );
          mock.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Archived.' });
        },
      });
      const inngest = (shared.agent as unknown as { inngest: { send: (payload: any) => Promise<unknown> } }).inngest;

      try {
        const first = await shared.agent.approveToolCall({ runId: output.runId, toolCallId: 'call_archive' });
        await vi.waitFor(() => expect(executions).toBe(1), { timeout: 10_000 });
        await inngest.send({ name: 'cancel.workflow.inngest:durable-agentic-loop', data: { runId: output.runId } });
        const firstTypes: string[] = [];
        for await (const chunk of first.fullStream) firstTypes.push(chunk.type);
        expect(firstTypes).toContain('abort');
      } finally {
        release();
      }

      await expect(shared.agent.approveToolCall({ runId: output.runId, toolCallId: 'call_archive' })).rejects.toThrow(
        /not suspended \(status: canceled\)/,
      );
      expect(executions).toBe(1);
    },
    40_000,
  );

  it('requireToolApproval in agent defaultOptions gates tool calls', async () => {
    let executions = 0;
    const archiveTool = createTool({
      id: 'archive',
      description: 'Archive an item',
      inputSchema: z.object({ item: z.string() }),
      execute: async () => {
        executions += 1;
        return { archived: true };
      },
    });

    const llm = getMock();
    const memory = new MockMemory();
    const shared = await createSharedAgent(llm, {
      tools: { archive: archiveTool },
      memory,
      engine,
      defaultOptions: { requireToolApproval: true },
    });
    const { output, chunks } = await runLoopScenario({
      engine,
      llm,
      sharedAgent: shared,
      prompt: 'Archive a',
      memory,
      threadId: 'default-options-approval-thread',
      resourceId: 'default-options-approval-resource',
      collectChunks: true,
      fixtures: mock => {
        mock.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_archive', name: 'archive', arguments: { item: 'a' } }] },
        );
        mock.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Archived.' });
      },
    });
    expect(chunks!.some(chunk => chunk.type === 'tool-call-approval')).toBe(true);
    expect(executions).toBe(0);

    const resumed = await shared.agent.approveToolCall({ runId: output.runId, toolCallId: 'call_archive' });
    for await (const _ of resumed.fullStream) {
      // drain
    }
    expect(executions).toBe(1);
    expect(await resumed.text).toBe('Archived.');
  });
});
