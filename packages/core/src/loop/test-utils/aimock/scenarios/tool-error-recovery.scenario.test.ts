import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { createTool } from '../../../../tools';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: tool-error recovery in the agentic loop (issue #21054).
 *
 * 1. A tool that throws a filesystem-style error (ENOENT / EACCES) must not
 *    halt the run: the error is serialized into a tool-error result, fed back
 *    to the model on the next turn, and the loop continues so the model can
 *    self-correct.
 *
 * 2. Mixed-turn guard: when one tool in a turn errors while another tool call
 *    is still pending human-in-the-loop resolution (a `requireApproval` tool
 *    awaiting its decision), the tool error must NOT force the loop to
 *    continue past the pending call. Continuing would send the next model
 *    request with a tool call that has no tool result, which the provider
 *    rejects. The run must suspend, and only after the approval resolves does
 *    the next model turn happen — carrying BOTH the approved tool's result and
 *    the failed tool's error.
 */
describeForAllEngines('AIMock loop scenario: tool-error recovery (#21054)', engine => {
  const getMock = useLoopScenarioAimock();

  it('recovers from a filesystem-style tool error (ENOENT) and answers', async () => {
    const viewTool = createTool({
      id: 'view',
      description: 'Read a file from disk.',
      inputSchema: z.object({ path: z.string() }),
      outputSchema: z.object({ content: z.string() }),
      execute: async () => {
        throw Object.assign(new Error("ENOENT: no such file or directory, open '/tmp/missing.txt'"), {
          code: 'ENOENT',
          path: '/tmp/missing.txt',
        });
      },
    });

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Read /tmp/missing.txt for me.',
      tools: { view: viewTool },
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        // Turn 1: the model tries to read the missing file.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_view', name: 'view', arguments: { path: '/tmp/missing.txt' } }] },
        );
        // Turn 2: the ENOENT tool error is fed back -> the model recovers.
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_view', hasToolResult: true },
          { content: 'That file does not exist.' },
        );
      },
    });

    // The run did not halt: it reached the recovery turn and produced text.
    const text = await output.text;
    expect(text).toContain('does not exist');
    expect(requests).toHaveLength(2);

    // The ENOENT failure was reported as a tool result keyed to the original
    // call id, so the model could see it and self-correct.
    const turn2Messages = requests[1]?.body?.messages ?? [];
    const toolMessage = turn2Messages.find(message => (message as { role?: string }).role === 'tool') as
      | { tool_call_id?: string; content?: unknown }
      | undefined;
    expect(toolMessage?.tool_call_id).toBe('call_view');
    expect(JSON.stringify(toolMessage?.content)).toMatch(/ENOENT/);
  });

  it('a tool error does not continue the loop past a pending approval in the same turn', async () => {
    let approvedToolExecuted = 0;

    // Pending-HITL tool: suspends for approval before executing.
    const deployTool = createTool({
      id: 'deploy',
      description: 'Deploy the app (requires approval).',
      inputSchema: z.object({ env: z.string() }),
      outputSchema: z.object({ deployed: z.boolean() }),
      requireApproval: true,
      execute: async () => {
        approvedToolExecuted++;
        return { deployed: true };
      },
    });

    // Failing tool: executes immediately in the same turn and throws.
    const readConfigTool = createTool({
      id: 'read_config',
      description: 'Read the deploy config file.',
      inputSchema: z.object({ path: z.string() }),
      outputSchema: z.object({ content: z.string() }),
      execute: async () => {
        throw Object.assign(new Error("EACCES: permission denied, open '/etc/deploy.conf'"), {
          code: 'EACCES',
          path: '/etc/deploy.conf',
        });
      },
    });

    const sharedMemory = new MockMemory();
    const shared = await createSharedAgent(getMock(), {
      tools: { deploy: deployTool, read_config: readConfigTool },
      memory: sharedMemory,
      engine,
    });

    const { output, chunks, llm } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'Read the deploy config and deploy to prod.',
      memory: sharedMemory,
      threadId: 'tool-error-pending-hitl-thread',
      resourceId: 'test-resource',
      collectChunks: true,
      fixtures: mock => {
        // Turn 1: one approval-gated call and one immediately-failing call.
        mock.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call_read', name: 'read_config', arguments: { path: '/etc/deploy.conf' } },
              { id: 'call_deploy', name: 'deploy', arguments: { env: 'prod' } },
            ],
          },
        );
        // Turn 2 (after resume): both results are back -> the model wraps up.
        mock.on(
          { endpoint: 'chat', hasToolResult: true },
          { content: 'Deployed to prod despite the unreadable config.' },
        );
      },
    });

    // The run suspended on the approval-gated call.
    const approvalChunks = chunks!.filter(c => c.type === 'tool-call-approval');
    expect(approvalChunks.length).toBeGreaterThan(0);
    const toolCallId = (approvalChunks[0] as any).payload.toolCallId;

    // THE GUARD: the read_config error must not force continuation past the
    // pending approval — exactly one model request so far. A second request
    // here would carry the `deploy` call with no tool result.
    expect(llm.getRequests()).toHaveLength(1);
    expect(approvedToolExecuted).toBe(0);

    // Resolve the approval and drive the loop to completion.
    const resumed = await shared.agent.resumeStream({ approved: true }, { runId: output.runId, toolCallId });
    for await (const _chunk of resumed.fullStream) {
      // drain
    }

    // The approved tool executed exactly once.
    expect(approvedToolExecuted).toBe(1);

    // The post-resume model turn carries BOTH results: the deploy result and
    // the read_config error, each keyed to its original call id.
    const requests = llm.getRequests();
    expect(requests.length).toBeGreaterThanOrEqual(2);
    const finalTurnMessages = requests[requests.length - 1]?.body?.messages ?? [];
    const toolMessages = finalTurnMessages.filter(
      message => (message as { role?: string }).role === 'tool',
    ) as Array<{ tool_call_id?: string; content?: unknown }>;
    const readResult = toolMessages.find(m => m.tool_call_id === 'call_read');
    const deployResult = toolMessages.find(m => m.tool_call_id === 'call_deploy');
    expect(JSON.stringify(readResult?.content)).toMatch(/EACCES|error|denied/i);
    expect(JSON.stringify(deployResult?.content)).toMatch(/deployed/i);
  });
});
