import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { createTool } from '../../../../tools';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Scenario: results that resolve alongside a still-pending tool call.
 *
 * A step can mix a tool that finished with a tool that has not (a client-side tool the
 * browser resolves, or an approval-gated tool waiting on the user). The finished tool's
 * result is streamed and persisted right away (issue #21637) — this scenario guards the
 * other half of that: flushing early must not make the result show up twice once the
 * pending call is resolved and the turn resumes.
 */
describeForAllEngines('AIMock loop scenario: pending tool result flush', engine => {
  const getMock = useLoopScenarioAimock();

  it('streams a completed tool result exactly once across a suspend and resume', async () => {
    const lookupTool = createTool({
      id: 'lookup',
      description: 'Looks a record up',
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }: { id: string }) => ({ record: `record-${id}` }),
    });

    const deleteTool = createTool({
      id: 'delete-file',
      description: 'Deletes a file',
      inputSchema: z.object({ path: z.string() }),
      requireApproval: true,
      execute: async ({ path }: { path: string }) => ({ deleted: true, path }),
    });

    const sharedMemory = new MockMemory();
    const shared = await createSharedAgent(getMock(), {
      tools: { lookupTool, deleteTool },
      memory: sharedMemory,
      engine,
    });

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'Look up record 42 and delete /tmp/test.conf',
      memory: sharedMemory,
      threadId: 'pending-tool-result-flush-thread',
      resourceId: 'test-resource',
      collectChunks: true,
      fixtures: llm => {
        llm.onMessage(/look up|delete/i, {
          toolCalls: [
            { id: 'call-lookup', name: 'lookup', arguments: { id: '42' } },
            { id: 'call-delete', name: 'delete-file', arguments: { path: '/tmp/test.conf' } },
          ],
        });
      },
    });

    const approvalChunks = chunks!.filter(c => c.type === 'tool-call-approval');
    expect(approvalChunks.length).toBeGreaterThan(0);
    const approvalToolCallId = (approvalChunks[0] as any).payload.toolCallId;

    getMock().clearFixtures();
    getMock().resetMatchCounts();
    getMock().on({ endpoint: 'chat', hasToolResult: true }, { content: 'All done' });

    const resumed = await shared.agent.resumeStream(
      { approved: true },
      { runId: output.runId, toolCallId: approvalToolCallId },
    );

    const resumedChunks: any[] = [];
    for await (const chunk of resumed.fullStream) {
      resumedChunks.push(chunk);
    }

    const lookupResults = [...chunks!, ...resumedChunks].filter(
      (c: any) => c.type === 'tool-result' && c.payload?.toolName === 'lookup',
    );

    expect(lookupResults).toHaveLength(1);
    expect((lookupResults[0] as any).payload.result).toEqual({ record: 'record-42' });
  });
});
