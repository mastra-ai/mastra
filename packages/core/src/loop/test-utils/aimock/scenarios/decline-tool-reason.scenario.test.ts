import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { createTool } from '../../../../tools';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

describeForAllEngines(
  'AIMock loop scenario: decline tool call with custom reason',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('propagates custom reason when tool call is declined via declineToolCall()', async () => {
      const sensitiveTool = createTool({
        id: 'sensitive-op',
        description: 'Performs a sensitive operation requiring approval',
        inputSchema: z.object({
          action: z.string(),
        }),
        requireApproval: true,
        execute: async ({ action }) => {
          return { performed: action, success: true };
        },
      });

      const sharedMemory = new MockMemory();
      const shared = await createSharedAgent(getMock(), {
        tools: { sensitiveTool },
        memory: sharedMemory,
        engine,
      });

      const threadId = `decline-reason-stream-thread-${engine}`;
      const resourceId = 'test-resource';

      // Agent calls the tool, suspends
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
                id: `call-sens-1-${engine}`,
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

      // Decline via declineToolCall with a custom reason
      const customReason = 'Declined due to policy restriction - user role is insufficient';
      const declineResult = await shared.agent.declineToolCall({
        runId: output.runId,
        toolCallId,
        reason: customReason,
      });

      // Drain the stream
      for await (const _ of declineResult.fullStream) {
        // no-op
      }

      // Verify the recalled invocation carries the custom reason
      const { messages } = await sharedMemory.recall({ threadId, resourceId });
      const declined = messages
        .flatMap((m: any) => m.content?.parts ?? [])
        .find((p: any) => p.type === 'tool-invocation' && p.toolInvocation?.toolName === 'sensitive-op')
        ?.toolInvocation as { state?: string; approval?: { approved?: boolean; reason?: string } } | undefined;

      expect(declined).toBeDefined();
      expect(declined?.state).toBe('output-denied');
      expect(declined?.approval?.approved).toBe(false);
      expect(declined?.approval?.reason).toBe(customReason);
    });

    it('propagates custom reason when tool call is declined via declineToolCallGenerate()', async () => {
      const sensitiveTool = createTool({
        id: 'sensitive-op',
        description: 'Performs a sensitive operation requiring approval',
        inputSchema: z.object({
          action: z.string(),
        }),
        requireApproval: true,
        execute: async ({ action }) => {
          return { performed: action, success: true };
        },
      });

      const llm = getMock();
      // Set up fixtures for the generate() calls
      llm.onMessage(/perform/i, {
        toolCalls: [
          {
            id: `call-sens-gen-${engine}`,
            name: 'sensitive-op',
            arguments: { action: 'action-123' },
          },
        ],
      });
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Declined.' });

      const sharedMemory = new MockMemory();
      const shared = await createSharedAgent(llm, {
        tools: { sensitiveTool },
        memory: sharedMemory,
        engine,
      });

      const threadId = `decline-reason-gen-thread-${engine}`;
      const resourceId = 'test-resource';

      // Agent calls the tool, suspends
      const output = await shared.agent.generate('Perform action-123', {
        requireToolApproval: true,
        memory: { thread: threadId, resource: resourceId },
      });

      expect(output.finishReason).toBe('suspended');
      expect(output.suspendPayload).toBeDefined();

      const toolCallId = output.suspendPayload!.toolCallId;

      // Decline via declineToolCallGenerate with a custom reason
      const customReason = 'Declined due to security warning';
      await shared.agent.declineToolCallGenerate({
        runId: output.runId!,
        toolCallId,
        reason: customReason,
        memory: { thread: threadId, resource: resourceId },
      });

      // Verify the recalled invocation carries the custom reason
      const { messages } = await sharedMemory.recall({ threadId, resourceId });
      const declined = messages
        .flatMap((m: any) => m.content?.parts ?? [])
        .find((p: any) => p.type === 'tool-invocation' && p.toolInvocation?.toolName === 'sensitive-op')
        ?.toolInvocation as { state?: string; approval?: { approved?: boolean; reason?: string } } | undefined;

      expect(declined).toBeDefined();
      expect(declined?.state).toBe('output-denied');
      expect(declined?.approval?.approved).toBe(false);
      expect(declined?.approval?.reason).toBe(customReason);
    });
  },
  { skip: ['fs'] },
);
