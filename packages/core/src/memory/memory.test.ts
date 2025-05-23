import { beforeEach, describe, expect, it } from 'vitest';
import { MastraMemory } from './memory';
import type { StorageThreadType } from './types';

const TEST_MESSAGES = {
  simpleText: {
    id: 'msg1',
    role: 'user' as const,
    content: 'Hello, how are you?',
    createdAt: new Date(),
    threadId: 'thread1',
    resourceId: 'resource1',
    type: 'text' as const,
  },
  assistantWithToolCall: {
    id: 'msg2',
    role: 'assistant' as const,
    content: [
      {
        type: 'tool-call' as const,
        toolCallId: 'call1',
        toolName: 'getWeather',
        args: { location: 'New York' },
      },
    ],
    createdAt: new Date(),
    threadId: 'thread1',
    resourceId: 'resource1',
    type: 'tool-call' as const,
  },
  toolResult: {
    id: 'msg3',
    role: 'tool' as const,
    content: [
      {
        type: 'tool-result' as const,
        toolCallId: 'call1',
        toolName: 'getWeather',
        result: { temperature: 72, condition: 'sunny' },
      },
    ],
    createdAt: new Date(),
    threadId: 'thread1',
    resourceId: 'resource1',
    type: 'tool-result' as const,
  },
  mixedContent: {
    id: 'msg4',
    role: 'assistant' as const,
    content: [
      { type: 'text' as const, text: 'I will check the weather: ' },
      {
        type: 'tool-call' as const,
        toolCallId: 'call2',
        toolName: 'getWeather',
        args: { location: 'London' },
      },
      { type: 'text' as const, text: ' and then tell you the result.' },
    ],
    createdAt: new Date(),
    threadId: 'thread1',
    resourceId: 'resource1',
    type: 'text' as const,
  },
  multipleToolCalls: {
    id: 'msg5',
    role: 'assistant' as const,
    content: [
      {
        type: 'tool-call' as const,
        toolCallId: 'call3',
        toolName: 'getWeather',
        args: { location: 'Paris' },
      },
      {
        type: 'tool-call' as const,
        toolCallId: 'call4',
        toolName: 'getTime',
        args: { timezone: 'Europe/Paris' },
      },
    ],
    createdAt: new Date(),
    threadId: 'thread1',
    resourceId: 'resource1',
    type: 'tool-call' as const,
  },
} as const;

/**
 * TestMemory class that extends MastraMemory for testing purposes
 */
class TestMemory extends MastraMemory {
  async rememberMessages() {
    return { threadId: 'test', messages: [], uiMessages: [] };
  }

  async getThreadById() {
    return null;
  }

  async getThreadsByResourceId() {
    return [];
  }

  async saveThread() {
    return {} as StorageThreadType;
  }

  async saveMessages() {
    return [];
  }

  async query() {
    return { messages: [], uiMessages: [] };
  }

  async deleteThread() {}
}

describe('MastraMemory', () => {
  let memory: TestMemory;

  beforeEach(() => {
    memory = new TestMemory({ name: 'test' });
  });

  describe('convertToUIMessages', () => {
    it('should convert a simple text message to a UI message with text part', () => {
      const messages = [TEST_MESSAGES.simpleText];
      const result = (memory as any).convertToUIMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].parts).toStrictEqual([
        {
          type: 'text',
          text: 'Hello, how are you?',
        },
      ]);
    });

    it('should convert a tool call message to a UI message with tool-invocation part', () => {
      const messages = [TEST_MESSAGES.assistantWithToolCall];
      const result = (memory as any).convertToUIMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].parts).toMatchObject([
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'call',
            toolCallId: 'call1',
            toolName: 'getWeather',
            args: { location: 'New York' },
          },
        },
      ]);
    });

    it('should update tool invocations with results', () => {
      const messages = [TEST_MESSAGES.assistantWithToolCall, TEST_MESSAGES.toolResult];
      const result = (memory as any).convertToUIMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].parts).toStrictEqual([
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'call1',
            toolName: 'getWeather',
            args: { location: 'New York' },
            result: { temperature: 72, condition: 'sunny' },
          },
        },
      ]);
    });

    it('should handle mixed content with text and tool calls', () => {
      const messages = [TEST_MESSAGES.mixedContent];
      const result = (memory as any).convertToUIMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].parts).toMatchObject([
        {
          type: 'text',
          text: 'I will check the weather: ',
        },
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'call',
            toolCallId: 'call2',
            toolName: 'getWeather',
            args: { location: 'London' },
          },
        },
        {
          type: 'text',
          text: ' and then tell you the result.',
        },
      ]);
    });

    it('should handle multiple tool calls in a single message', () => {
      const messages = [TEST_MESSAGES.multipleToolCalls];
      const result = (memory as any).convertToUIMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].parts).toMatchObject([
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'call',
            toolCallId: 'call3',
            toolName: 'getWeather',
            args: { location: 'Paris' },
          },
        },
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'call',
            toolCallId: 'call4',
            toolName: 'getTime',
            args: { timezone: 'Europe/Paris' },
          },
        },
      ]);
    });

    it('should include toolInvocations array when tool calls are present', () => {
      const messages = [TEST_MESSAGES.assistantWithToolCall];
      const result = (memory as any).convertToUIMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].toolInvocations).toMatchObject([
        {
          state: 'call',
          toolCallId: 'call1',
          toolName: 'getWeather',
          args: { location: 'New York' },
        },
      ]);
    });

    it('should update toolInvocations with results when tool result message is received', () => {
      const messages = [TEST_MESSAGES.assistantWithToolCall, TEST_MESSAGES.toolResult];
      const result = (memory as any).convertToUIMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].toolInvocations).toMatchObject([
        {
          state: 'call',
          toolCallId: 'call1',
          toolName: 'getWeather',
          args: { location: 'New York' },
        },
      ]);
    });

    it('should not include toolInvocations array when no tool calls are present', () => {
      const messages = [TEST_MESSAGES.simpleText];
      const result = (memory as any).convertToUIMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].toolInvocations).toBeUndefined();
    });

    it('should handle mixed content with both parts and toolInvocations', () => {
      const messages = [TEST_MESSAGES.mixedContent];
      const result = (memory as any).convertToUIMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].parts).toMatchObject([
        {
          type: 'text',
          text: 'I will check the weather: ',
        },
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'call',
            toolCallId: 'call2',
            toolName: 'getWeather',
            args: { location: 'London' },
          },
        },
        {
          type: 'text',
          text: ' and then tell you the result.',
        },
      ]);
      expect(result[0].toolInvocations).toMatchObject([
        {
          state: 'call',
          toolCallId: 'call2',
          toolName: 'getWeather',
          args: { location: 'London' },
        },
      ]);
    });
  });
});
