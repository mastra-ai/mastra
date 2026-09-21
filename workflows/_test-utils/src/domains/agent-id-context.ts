/**
 * agentId in tool execution context
 *
 * Cross-engine pin modeled on
 * packages/core/src/agent/__tests__/agent-id-context.test.ts: when an agent
 * calls a tool, the tool's execution context carries the calling agent's id
 * at context.agent.agentId, and the tool's result (which echoes that id)
 * round-trips back through the stream. Expressed through the DurableAgentLike
 * surface so every leg (DurableAgent, EventedAgent, plain Agent, Inngest)
 * exercises the same contract.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import type { DurableAgentTestContext } from '../types';
import { createToolCallThenTextModel } from '../mock-models';

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createAgentIdContextTests(context: DurableAgentTestContext) {
  const { createAgent, eventPropagationDelay } = context;
  const executionDelay = Math.max(eventPropagationDelay * 2, 500);

  describe('agentId in tool execution context', () => {
    it('should populate context.agent.agentId with the agent id when agent calls a tool', async () => {
      let capturedAgentId: string | undefined;

      const testTool = createTool({
        id: 'agent-id-check',
        description: 'Captures the calling agent ID from context',
        inputSchema: z.object({ input: z.string() }),
        execute: async (_input, toolContext) => {
          capturedAgentId = (toolContext as { agent?: { agentId?: string } } | undefined)?.agent?.agentId;
          return { agentId: capturedAgentId };
        },
      });

      const mockModel = createToolCallThenTextModel('agent-id-check', { input: 'test' }, 'Done');

      const agent = await createAgent({
        id: 'my-test-agent',
        exactId: true,
        instructions: 'You are a test agent.',
        model: mockModel,
        tools: { 'agent-id-check': testTool },
      });

      const toolResults: any[] = [];
      const { output, cleanup } = await agent.stream('Use the tool', {
        onChunk: (chunk: any) => {
          if (chunk.type === 'tool-result') {
            toolResults.push(chunk);
          }
        },
      });

      // Drain to completion so the tool has definitely executed.
      for await (const _chunk of output.textStream) {
        void _chunk;
      }
      await delay(executionDelay);
      cleanup();

      const toolCall = toolResults.find((chunk: any) => chunk.payload?.toolName === 'agent-id-check')?.payload;

      expect(capturedAgentId).toBe('my-test-agent');
      expect(toolCall?.result?.agentId).toBe('my-test-agent');
    });
  });
}
