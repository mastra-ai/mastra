import { Agent } from '@mastra/core/agent';
import { askUserTool } from '@mastra/core/tools';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';

import { Memory } from '@mastra/memory';

import { storage } from '../storage';

const memory = new Memory({ storage });

/**
 * Mock model that emits an ask_user tool call on first message, then responds
 * with text on subsequent steps (when tool result arrives).
 *
 * Uses MastraLanguageModelV2Mock with type:'tool-call' + providerExecuted:false
 * so that Mastra's agentic loop executes the tool via tool-call-step (which
 * provides context.agent.suspend for suspension).
 */
function createAskUserToolCallStream(toolCallId = `ask-user-tc-${Date.now()}`) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'id-0',
        modelId: 'mock-ask-user',
        timestamp: new Date(),
      });
      controller.enqueue({
        type: 'tool-call',
        toolCallId,
        toolName: 'ask_user',
        input: JSON.stringify({
          question: 'What programming language would you like to use?',
          options: [
            { label: 'TypeScript', description: 'Strongly typed JavaScript' },
            { label: 'Python', description: 'Versatile scripting language' },
            { label: 'Rust', description: 'Systems programming with safety' },
            { label: 'Go', description: 'Simple concurrent programming' },
          ],
          selectionMode: 'single_select',
        }),
        providerExecuted: false,
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 50, totalTokens: 60 },
      });
      controller.close();
    },
  });
}

function createTextStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'id-1',
        modelId: 'mock-ask-user',
        timestamp: new Date(),
      });
      controller.enqueue({ type: 'text-start', id: 'text-0' });
      controller.enqueue({
        type: 'text-delta',
        id: 'text-0',
        delta: 'Great choice! I will set up your project with that language.',
      });
      controller.enqueue({ type: 'text-end', id: 'text-0' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 30, outputTokens: 20, totalTokens: 50 },
      });
      controller.close();
    },
  });
}

const mockAskUserModel = new MastraLanguageModelV2Mock({
  provider: 'mock',
  modelId: 'mock-ask-user',
  doStream: (() => {
    let callCount = 0;
    return async () => {
      callCount++;
      // Odd calls = tool call (ask_user), Even calls = text response (after resume)
      return {
        stream: callCount % 2 === 1 ? createAskUserToolCallStream() : createTextStream(),
      };
    };
  })(),
});

export const askUserAgent = new Agent({
  id: 'ask-user-agent',
  name: 'Ask User Agent',
  instructions: `You are a helpful assistant that asks the user questions before proceeding.
Always use the ask_user tool to gather user preferences before taking action.`,
  model: mockAskUserModel,
  tools: { ask_user: askUserTool },
  memory,
});
