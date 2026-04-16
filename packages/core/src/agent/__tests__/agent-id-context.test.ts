import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTool } from '../../tools';
import { Agent } from '../agent';

/**
 * Integration test verifying that agentId is correctly propagated
 * from the Agent through the tool execution pipeline to context.agent.agentId.
 */
describe('agentId in tool execution context', () => {
  it('should populate context.agent.agentId with the agent id when agent calls a tool', async () => {
    let capturedAgentId: string | undefined;

    const testTool = createTool({
      id: 'agent-id-check',
      description: 'Captures the calling agent ID from context',
      inputSchema: z.object({ input: z.string() }),
      execute: async (_input, context) => {
        capturedAgentId = context.agent?.agentId;
        return { agentId: context.agent?.agentId };
      },
    });

    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [
          {
            type: 'tool-call',
            toolCallType: 'function',
            toolCallId: 'call-1',
            toolName: 'agent-id-check',
            input: '{"input":"test"}',
          },
        ],
        warnings: [],
      }),
    });

    const agent = new Agent({
      id: 'my-test-agent',
      name: 'Test Agent',
      instructions: 'You are a test agent.',
      model: mockModel,
      tools: { 'agent-id-check': testTool },
    });

    const response = await agent.generate('Use the tool');
    const toolCall = response.toolResults.find((result: any) => result.payload.toolName === 'agent-id-check').payload;

    expect(capturedAgentId).toBe('my-test-agent');
    expect(toolCall?.result?.agentId).toBe('my-test-agent');
  });
});
