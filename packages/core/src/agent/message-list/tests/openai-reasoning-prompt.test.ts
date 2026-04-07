import { describe, expect, it } from 'vitest';

import { MessageList } from '../message-list';
import type { MastraDBMessage } from '../state';

function makeAssistantMessage(id: string, reasoningText: string, text: string, suffix: string): MastraDBMessage {
  return {
    id,
    role: 'assistant',
    createdAt: new Date(),
    threadId: 'thread-1',
    resourceId: 'resource-1',
    content: {
      format: 2,
      parts: [
        {
          type: 'reasoning',
          reasoning: reasoningText,
          providerMetadata: {
            openai: {
              itemId: `rs_${suffix}`,
              reasoningEncryptedContent: null,
            },
          },
        },
        {
          type: 'text',
          text,
          providerMetadata: {
            openai: {
              itemId: `msg_${suffix}`,
            },
          },
        },
      ],
    },
  };
}

function getAssistantParts(messages: Array<{ role: string; content: unknown }>) {
  return messages
    .filter(message => message.role === 'assistant' && Array.isArray(message.content))
    .flatMap(message => message.content as Array<Record<string, any>>);
}

function assertReasoningScope(messages: Array<{ role: string; content: unknown }>) {
  const assistantParts = getAssistantParts(messages);

  expect(
    assistantParts.find(part => part.type === 'reasoning' && (part.text ?? part.reasoning) === 'remembered reasoning'),
  ).toBeUndefined();

  const rememberedText = assistantParts.find(part => part.type === 'text' && part.text === 'remembered answer');
  expect(rememberedText).toBeDefined();
  expect(rememberedText.providerOptions?.openai).toBeUndefined();

  const currentReasoning = assistantParts.find(
    part => part.type === 'reasoning' && (part.text ?? part.reasoning) === 'current reasoning',
  );
  expect(currentReasoning).toBeDefined();
  expect(currentReasoning.providerOptions?.openai?.itemId).toBe('rs_current');

  const currentText = assistantParts.find(part => part.type === 'text' && part.text === 'current answer');
  expect(currentText).toBeDefined();
  expect(currentText.providerOptions?.openai?.itemId).toBe('msg_current');
}

describe('MessageList OpenAI reasoning prompt handling', () => {
  it('should strip remembered reasoning but preserve current-run reasoning in aiV5.prompt()', () => {
    const list = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });

    list.add({ role: 'user', content: 'Earlier question' }, 'memory');
    list.add(makeAssistantMessage('assistant-memory', 'remembered reasoning', 'remembered answer', 'memory'), 'memory');
    list.add({ role: 'user', content: 'Continue the current task' }, 'input');
    list.add(makeAssistantMessage('assistant-current', 'current reasoning', 'current answer', 'current'), 'response');

    assertReasoningScope(list.get.all.aiV5.prompt());
  });

  it('should strip remembered reasoning but preserve current-run reasoning in aiV5.llmPrompt()', async () => {
    const list = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });

    list.add({ role: 'user', content: 'Earlier question' }, 'memory');
    list.add(makeAssistantMessage('assistant-memory', 'remembered reasoning', 'remembered answer', 'memory'), 'memory');
    list.add({ role: 'user', content: 'Continue the current task' }, 'input');
    list.add(makeAssistantMessage('assistant-current', 'current reasoning', 'current answer', 'current'), 'response');

    assertReasoningScope(await list.get.all.aiV5.llmPrompt());
  });
});
