import { describe, expect, it } from 'vitest';

import { MessageList } from '../message-list';
import type { MastraDBMessage } from '../state/types';
import { hasExplicitModelOutput } from './tool-result-model-output';

const compactOutput = {
  type: 'content',
  value: [{ type: 'media', data: 'aGVsbG8=', mediaType: 'image/png' }],
};

function makeToolResultMessage(mastraMetadata?: object): MastraDBMessage {
  return {
    id: 'tool-result-message',
    role: 'assistant',
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'call-1',
            toolName: 'exampleTool',
            args: {},
            result: { raw: 'RAW_RESULT' },
          },
          ...(mastraMetadata ? { providerMetadata: { mastra: mastraMetadata } } : {}),
        },
      ],
    },
    createdAt: new Date(0),
  } as MastraDBMessage;
}

function toolResultPart(prompt: Awaited<ReturnType<MessageList['get']['all']['aiV5']['llmPrompt']>>) {
  const toolMessage = prompt.find(message => message.role === 'tool');
  return toolMessage?.content.find(part => part.type === 'tool-result');
}

describe('explicit tool model output provenance', () => {
  it.each([
    ['aiV5', (list: MessageList) => list.get.all.aiV5.llmPrompt({})],
    ['aiV6', (list: MessageList) => list.get.all.aiV6.llmPrompt({})],
    ['aiV7', (list: MessageList) => list.get.all.aiV7.llmPrompt({})],
  ] as const)('survives the %s prompt path without provider-visible metadata', async (_, getPrompt) => {
    const list = new MessageList();
    list.add(makeToolResultMessage({ modelOutput: compactOutput }), 'memory');

    const prompt = await getPrompt(list);
    const part = toolResultPart(prompt);

    expect(part).toBeDefined();
    expect(hasExplicitModelOutput(part)).toBe(true);
    expect(JSON.stringify(prompt)).not.toContain('explicitModelOutput');
    expect(part).not.toHaveProperty('providerMetadata.mastra');
    expect(part).toHaveProperty('providerOptions.mastra.modelOutput', compactOutput);
  });

  it.each([
    ['absent', undefined],
    ['inherited', Object.create({ modelOutput: compactOutput })],
  ])('does not mark %s model output provenance', async (_, metadata) => {
    const list = new MessageList();
    list.add(makeToolResultMessage(metadata), 'memory');

    for (const prompt of [
      await list.get.all.aiV5.llmPrompt({}),
      await list.get.all.aiV6.llmPrompt({}),
      await list.get.all.aiV7.llmPrompt({}),
    ]) {
      expect(hasExplicitModelOutput(toolResultPart(prompt))).toBe(false);
    }
  });
});
