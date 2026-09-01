import { Agent } from '@mastra/core/agent';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { askUserTool } from '@mastra/core/tools';

import { Memory } from '@mastra/memory';

import { storage } from '../storage';

function createAskUserStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'version-label-pinning-question',
        modelId: 'mock-version-label-pinning',
        timestamp: new Date(),
      });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: `version-label-pinning-tool-call-${crypto.randomUUID()}`,
        toolName: 'ask_user',
        input: JSON.stringify({
          question: 'Which runtime should complete this pinned run?',
          options: [
            { label: 'TypeScript', description: 'Resume the suspended run' },
            { label: 'Python', description: 'Resume with another selection' },
          ],
          selectionMode: 'single_select',
        }),
        providerExecuted: false,
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

function createCompletionStream(text: string) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'version-label-pinning-completion',
        modelId: 'mock-version-label-pinning',
        timestamp: new Date(),
      });
      controller.enqueue({ type: 'text-start', id: 'version-label-pinning-text' });
      controller.enqueue({ type: 'text-delta', id: 'version-label-pinning-text', delta: text });
      controller.enqueue({ type: 'text-end', id: 'version-label-pinning-text' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

const model = new MastraLanguageModelV2Mock({
  provider: 'mock',
  modelId: 'mock-version-label-pinning',
  doStream: async ({ prompt }) => {
    const lastMessage = prompt.at(-1);
    const isResume = lastMessage?.role === 'tool' || JSON.stringify(lastMessage).includes('TypeScript');

    if (!isResume) {
      return { stream: createAskUserStream() };
    }

    const serializedPrompt = JSON.stringify(prompt);
    const version = serializedPrompt.includes('E2E_VERSION_ONE') ? 'one' : 'two';
    return { stream: createCompletionStream(`Pinned execution completed with version ${version}.`) };
  },
});

export const versionLabelPinningAgent = new Agent({
  id: 'version-label-pinning-agent',
  name: 'Version Label Pinning Agent',
  instructions: 'E2E_VERSION_ONE Ask the user before completing the pinned run.',
  model,
  tools: { ask_user: askUserTool },
  memory: new Memory({ storage }),
});
