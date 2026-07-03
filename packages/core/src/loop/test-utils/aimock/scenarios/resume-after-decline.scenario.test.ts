import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { createTool } from '../../../../tools';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Scenario: Resume after decline with shared storage
 *
 * Tests that after a tool call is declined via `resumeStream({ approved: false })`,
 * the agent can retry the same tool in a subsequent turn, and if approved this time,
 * it executes successfully.
 *
 * Uses shared agent+storage across calls to preserve suspension state.
 *
 * Regression classes:
 * - Declined `requireApproval` tool is recorded as `output-denied` (not executed), with the
 *   not-approved reason on its approval metadata, and emits no tool-result (issue #17218)
 * - Agent can retry the declined tool in a subsequent turn
 * - Second approval succeeds and tool executes with correct arguments
 * - Shared storage preserves thread context across decline/retry cycles
 */
describeForAllEngines(
  'AIMock loop scenario: resume after decline',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('declined tool does not execute, then retried and approved in next turn', async () => {
      let executionCount = 0;
      let lastPathExecuted = '';

      const deleteFileTool = createTool({
        id: 'delete-file',
        description: 'Deletes a file from the system',
        inputSchema: z.object({
          path: z.string(),
        }),
        requireApproval: true,
        execute: async (inputData: { path: string }) => {
          executionCount++;
          lastPathExecuted = inputData.path;
          return { deleted: true, path: inputData.path };
        },
      });

      const sharedMemory = new MockMemory();
      const shared = await createSharedAgent(getMock(), {
        tools: { deleteFileTool },
        memory: sharedMemory,
        engine,
      });

      const threadId = 'resume-after-decline-thread';
      const resourceId = 'test-resource';

      // First turn: agent calls delete-file
      const { output: output1, chunks: chunks1 } = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Delete the config file at /tmp/test.conf',
        memory: sharedMemory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.onMessage(/delete|config/i, {
            toolCalls: [
              {
                id: 'call-1',
                name: 'delete-file',
                arguments: { path: '/tmp/test.conf' },
              },
            ],
          });
        },
        collectChunks: true,
      });

      // Find the approval chunk
      const approvalChunks = chunks1!.filter(c => c.type === 'tool-call-approval');
      expect(approvalChunks.length).toBeGreaterThan(0);
      const toolCallId1 = (approvalChunks[0] as any).payload.toolCallId;

      // Decline the tool call via resumeStream
      const declineResult = await shared.agent.resumeStream(
        { approved: false },
        { runId: output1.runId, toolCallId: toolCallId1 },
      );

      // Drain the decline stream
      for await (const _chunk of declineResult.fullStream) {
        // drain
      }

      // Tool should NOT have executed
      expect(executionCount).toBe(0);
      expect(lastPathExecuted).toBe('');

      // Clear fixtures for the second turn
      getMock().clearFixtures();
      getMock().clearRequests();
      getMock().resetMatchCounts();

      // Second turn: agent retries the same tool, this time user approves
      const { output: output2, chunks: chunks2 } = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Actually, go ahead and delete it',
        memory: sharedMemory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.onMessage(/actually|delete|go ahead/i, {
            toolCalls: [
              {
                id: 'call-2',
                name: 'delete-file',
                arguments: { path: '/tmp/test.conf' },
              },
            ],
          });
        },
        collectChunks: true,
      });

      // Find the new approval chunk
      const approvalChunks2 = chunks2!.filter(c => c.type === 'tool-call-approval');
      expect(approvalChunks2.length).toBeGreaterThan(0);
      const toolCallId2 = (approvalChunks2[0] as any).payload.toolCallId;

      // New tool call ID (different from the declined one)
      expect(toolCallId2).not.toBe(toolCallId1);

      // Approve the tool call
      const approveResult = await shared.agent.resumeStream(
        { approved: true },
        { runId: output2.runId, toolCallId: toolCallId2 },
      );

      // Drain the approve stream
      for await (const _chunk of approveResult.fullStream) {
        // drain
      }

      // Tool should have executed once with correct path
      expect(executionCount).toBe(1);
      expect(lastPathExecuted).toBe('/tmp/test.conf');

      // Check tool results
      const toolResults = await approveResult.toolResults;
      expect(toolResults).toBeDefined();
      const deleteResult = toolResults?.find((r: any) => r.payload.toolName === 'delete-file');
      expect(deleteResult).toBeDefined();
      const result = deleteResult?.payload.result as { deleted: boolean; path: string };
      expect(result.deleted).toBe(true);
      expect(result.path).toBe('/tmp/test.conf');
    });

    // TODO(durable-parity): durable agent does not persist tool-invocation
    // parts with output-denied state to memory yet.
    it.skipIf(engine === 'durable')(
      'declined tool is recorded as output-denied with the not-approved reason',
      async () => {
        const sensitiveTool = createTool({
          id: 'sensitive-op',
          description: 'Performs a sensitive operation',
          inputSchema: z.object({
            action: z.string(),
          }),
          requireApproval: true,
          execute: async (inputData: { action: string }) => {
            return { performed: inputData.action };
          },
        });

        const sharedMemory = new MockMemory();
        const shared = await createSharedAgent(getMock(), {
          tools: { sensitiveTool },
          memory: sharedMemory,
          engine,
        });

        const threadId = 'decline-result-thread';
        const resourceId = 'test-resource';

        // Agent calls the tool
        const { output, chunks } = await runLoopScenario({
          engine,
          llm: getMock(),
          sharedAgent: shared,
          prompt: 'Perform action-123',
          memory: sharedMemory,
          threadId,
          resourceId,
          fixtures: llm => {
            llm.onMessage(/perform/i, {
              toolCalls: [
                {
                  id: 'call-sens-1',
                  name: 'sensitive-op',
                  arguments: { action: 'action-123' },
                },
              ],
            });
          },
          collectChunks: true,
        });

        // Find the approval chunk
        const approvalChunks = chunks!.filter(c => c.type === 'tool-call-approval');
        expect(approvalChunks.length).toBeGreaterThan(0);
        const toolCallId = (approvalChunks[0] as any).payload.toolCallId;

        // Decline via resumeStream
        const declineResult = await shared.agent.resumeStream({ approved: false }, { runId: output.runId, toolCallId });

        // Drain
        for await (const _chunk of declineResult.fullStream) {
          // drain
        }

        // A declined tool no longer emits a tool-result chunk: it is persisted as `output-denied`
        // with the not-approved reason on its approval metadata (issue #17218). So it must NOT
        // surface as a live tool-result...
        const toolResults = await declineResult.toolResults;
        const sensResult = toolResults?.find((r: any) => r.payload.toolName === 'sensitive-op');
        expect(sensResult).toBeUndefined();

        // ...and the recalled invocation must carry the decline as `output-denied` + the reason.
        const { messages } = await sharedMemory.recall({ threadId, resourceId });
        const declined = messages
          .flatMap((m: any) => m.content?.parts ?? [])
          .find((p: any) => p.type === 'tool-invocation' && p.toolInvocation?.toolName === 'sensitive-op')
          ?.toolInvocation as { state?: string; approval?: { approved?: boolean; reason?: string } } | undefined;
        expect(declined).toBeDefined();
        expect(declined?.state).toBe('output-denied');
        expect(declined?.approval?.approved).toBe(false);
        expect(declined?.approval?.reason?.toLowerCase()).toContain('not approved');
      },
    );
  },
  { skip: ['fs'] },
);
