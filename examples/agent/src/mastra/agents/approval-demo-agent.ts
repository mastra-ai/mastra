import { Agent } from '@mastra/core/agent';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { z } from 'zod';

/**
 * HITL approve/decline demo agent for issue #17218.
 * https://github.com/mastra-ai/mastra/issues/17218
 *
 * Use this in Studio to manually verify that an approved/declined `requireApproval` tool call
 * round-trips correctly on RECALL (i.e. survives a page reload / thread re-open), not just live.
 *
 * The bug was persistence-only: live approve/decline always looked right, but on reload a declined
 * call rendered as a normal successful tool result. The whole point of the test is the reload step.
 *
 * It uses a deterministic mock model (no API key) so the approval prompt fires every time: the first
 * turn always calls `findUserTool` (which requires approval); after the decision it replies with text.
 * Swap `model` for a real `openai/gpt-...` if you'd rather drive it with a live LLM.
 */

let toolExecuteCount = 0;
const findUserTool = createTool({
  id: 'findUserTool',
  description: 'Look up a user by name and return their email. Requires human approval before running.',
  inputSchema: z.object({ name: z.string() }),
  requireApproval: true,
  execute: async input => {
    toolExecuteCount++;
    return { name: input.name, email: `${input.name.toLowerCase().replace(/\s+/g, '.')}@example.com` };
  },
});

const mockApprovalModel = new MastraLanguageModelV2Mock({
  provider: 'mock',
  modelId: 'mock-approval',
  doStream: (() => {
    let callCount = 0;
    return async () => {
      callCount++;
      // Odd calls = tool call (needs approval); even calls = text response (after the decision).
      if (callCount % 2 === 1) {
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: 'id-0',
                modelId: 'mock-approval',
                timestamp: new Date(),
              });
              controller.enqueue({
                type: 'tool-call',
                toolCallId: `find-user-${Date.now()}`,
                toolName: 'findUserTool',
                input: JSON.stringify({ name: 'Dero Israel' }),
                providerExecuted: false,
              });
              controller.enqueue({
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              });
              controller.close();
            },
          }),
        };
      }
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'response-metadata', id: 'id-1', modelId: 'mock-approval', timestamp: new Date() });
            controller.enqueue({ type: 'text-start', id: 'text-0' });
            controller.enqueue({
              type: 'text-delta',
              id: 'text-0',
              delta: 'All done — let me know if you need anything else.',
            });
            controller.enqueue({ type: 'text-end', id: 'text-0' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            });
            controller.close();
          },
        }),
      };
    };
  })(),
});

export const approvalDemoAgent = new Agent({
  id: 'approval-demo-agent',
  name: 'Approval Demo Agent',
  instructions:
    'You look up users with findUserTool, which requires human approval before it runs. ' +
    'Always call findUserTool when asked to find a user.',
  model: mockApprovalModel,
  tools: { findUserTool },
  // Memory enabled so the thread persists and is recalled on reload — that recall is what this tests.
  memory: new Memory(),
});
