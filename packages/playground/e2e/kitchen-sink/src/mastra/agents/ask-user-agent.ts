import { Agent } from '@mastra/core/agent';
import { askUserTool } from '@mastra/core/tools';

import * as aiTest from 'ai/test';

import { Memory } from '@mastra/memory';

import { storage } from '../storage';

const memory = new Memory({ storage });

/**
 * Mock model that emits an ask_user tool call on first message, then responds
 * with text on subsequent steps (when tool result arrives).
 */
let stepCount = 0;

const mockAskUserModel = new aiTest.MockLanguageModelV2({
  provider: 'mock',
  modelId: 'mock-ask-user',
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop' as const,
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [{ type: 'text' as const, text: 'Thank you for your answer!' }],
    warnings: [],
  }),
  doStream: async () => {
    const step = stepCount++;

    if (step % 2 === 0) {
      // First step: emit ask_user tool call
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-ask-user',
              timestamp: new Date(),
            });
            controller.enqueue({
              type: 'tool-call-start',
              id: 'tc-0',
              toolCallType: 'function',
              toolCallId: `ask-user-tc-${Date.now()}`,
              toolName: 'ask_user',
            });
            controller.enqueue({
              type: 'tool-call-delta',
              id: 'tc-0',
              toolCallType: 'function',
              toolCallId: `ask-user-tc-${Date.now()}`,
              toolName: 'ask_user',
              argsTextDelta: JSON.stringify({
                question: 'What programming language would you like to use?',
                options: [
                  { label: 'TypeScript', description: 'Strongly typed JavaScript' },
                  { label: 'Python', description: 'Versatile scripting language' },
                  { label: 'Rust', description: 'Systems programming with safety' },
                  { label: 'Go', description: 'Simple concurrent programming' },
                ],
                selectionMode: 'single_select',
              }),
            });
            controller.enqueue({
              type: 'tool-call-end',
              id: 'tc-0',
            });
            controller.enqueue({
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 50, totalTokens: 60 },
            });
            controller.close();
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    }

    // Subsequent steps: return text response
    return {
      stream: new ReadableStream({
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
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    };
  },
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
