import { describe, expect, it } from 'vitest';
import z from 'zod';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { getOpenAIModel } from './mock-model';

/**
 * Test for GitHub issue #10389
 * https://github.com/mastra-ai/mastra/issues/10389
 *
 * Issue: agent.resumeStream() fails with "No snapshot found" when resuming
 * a tool with requireApproval: true that suspends execution via workflow.suspend()
 */

const mockStorage = new MockStore();

function resumeStreamApprovalTests(version: 'v1' | 'v2') {
  const openaiModel = getOpenAIModel(version);

  describe.skipIf(version === 'v1')(`${version} - resumeStream with tool requireApproval`, () => {
    it('should successfully resume stream when tool with requireApproval suspends via workflow.suspend()', async () => {
      const suspendingTool = createTool({
        id: 'suspendingTool',
        description: 'A tool that suspends execution if not approved',
        inputSchema: z.object({
          query: z.string(),
        }),
        requireApproval: true,
        execute: async (input: { query: string }, context) => {
          const { workflow } = context;
          const resumeData = workflow?.getResumeData();

          if (!resumeData?.approved) {
            await workflow?.suspend({
              message: 'Tool execution requires approval',
              data: { query: input.query },
            });
            return { status: 'suspended' };
          }

          return { status: 'approved', query: input.query };
        },
      });

      const testAgent = new Agent({
        id: 'testAgent',
        name: 'Test Agent',
        instructions: 'You are a test agent that uses the suspendingTool.',
        model: openaiModel,
        tools: { suspendingTool },
      });

      const mastra = new Mastra({
        agents: { testAgent },
        logger: false,
        storage: mockStorage,
      });

      const agent = mastra.getAgent('testAgent');

      // Start the stream
      const stream = await agent.stream('Use the suspendingTool with query "test query"');

      // Consume the text stream (similar to the reproduction)
      let textOutput = '';
      for await (const chunk of stream.textStream) {
        textOutput += chunk;
      }

      // Wait a bit to ensure snapshot is persisted
      await new Promise(resolve => setTimeout(resolve, 1000));

      // This should not throw "No snapshot found" error
      // Currently fails with: Error: No snapshot found for this workflow run: agentic-loop <runId>
      // GitHub issue #10389: https://github.com/mastra-ai/mastra/issues/10389

      const resumeStream = await agent.resumeStream({ approved: true }, { runId: stream.runId });

      // Consume the resumed stream
      let resumedText = '';
      for await (const chunk of resumeStream.textStream) {
        resumedText += chunk;
      }

      // Verify the stream completed successfully
      expect(resumedText).toBeTruthy();
    });
  });
}

describe('resumeStream with tool approval - v2', () => {
  resumeStreamApprovalTests('v2');
});
