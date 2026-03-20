import { describe, expect, it, vi } from 'vitest';

import { MessageList } from '../agent/message-list';
import type { MastraDBMessage } from '../agent/message-list';
import type { IMastraLogger } from '../logger';
import { ProcessorRunner } from './runner';
import { ToolResultReminderProcessor } from './tool-result-reminder';

const mockLogger: IMastraLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  trackException: vi.fn(),
  getTransports: vi.fn(() => []),
  listLogs: vi.fn(() => []),
  listLogsByRunId: vi.fn(() => []),
} as any;

const createMessage = (content: string, role: 'user' | 'assistant' = 'user'): MastraDBMessage => ({
  id: `msg-${Math.random()}`,
  role,
  content: {
    format: 2 as const,
    parts: [{ type: 'text' as const, text: content }],
  },
  createdAt: new Date(),
  threadId: 'test-thread',
});

const createMockModel = (id: string = 'test-model') =>
  ({
    modelId: id,
    specificationVersion: 'v2',
    provider: 'test',
    defaultObjectGenerationMode: 'json',
    supportsImageUrls: false,
    supportsStructuredOutputs: true,
    doGenerate: async () => ({}),
    doStream: async () => ({}),
  }) as any;

describe('ToolResultReminderProcessor', () => {
  describe('tool result detection', () => {
    it('should inject reminder when history contains a role:tool message with tool-result part (test scenario)', async () => {
      const processor = new ToolResultReminderProcessor({
        reminderText: 'Remember to cite your sources.',
        tag: 'citation-reminder',
      });

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      // Simulate assistant tool call
      messageList.add(
        [
          {
            id: 'assistant-1',
            role: 'assistant',
            content: {
              format: 2 as const,
              parts: [
                { type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'web_search', args: { query: 'test' } },
              ],
            },
            createdAt: new Date(),
            threadId: 'test-thread',
          } as unknown as MastraDBMessage,
        ],
        'response',
      );

      // Simulate tool result by updating the assistant message's tool-invocation to state 'result'
      // This is what updateToolInvocation does after tool execution in production.
      // The original message is updated in place with toolInvocation.state === 'result'.
      const assistantMsg = messageList.get.all.db()[1];
      if (assistantMsg && assistantMsg.content.parts) {
        assistantMsg.content.parts = [
          {
            type: 'tool-invocation' as const,
            toolInvocation: {
              toolCallId: 'call-1',
              toolName: 'web_search',
              args: { query: 'test' },
              state: 'result' as const,
              result: 'search results...',
            },
          },
        ];
      }

      // Run processInputStep at step 1 (after tool result)
      await runner.runProcessInputStep({
        messageList,
        stepNumber: 1,
        model: createMockModel(),
        steps: [],
      });

      // Verify the reminder was added via getAllSystemMessages()
      const systemMessages = messageList.getAllSystemMessages();
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0].content).toContain('Remember to cite your sources.');
    });

    it('should NOT inject reminder when no tool-result history exists', async () => {
      const processor = new ToolResultReminderProcessor({
        reminderText: 'Remember to cite your sources.',
        tag: 'citation-reminder',
      });

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');
      messageList.add([createMessage('Hello from assistant', 'assistant')], 'response');

      // Run processInputStep at step 0 (no tool results yet)
      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
      });

      // Verify no system message was added
      const systemMessages = messageList.getAllSystemMessages();
      expect(systemMessages.length).toBe(0);
    });

    it('should NOT inject twice when the same reminder is already present in system messages', async () => {
      const processor = new ToolResultReminderProcessor({
        reminderText: 'Remember to cite your sources.',
        tag: 'citation-reminder',
      });

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      // Add a tool result
      messageList.add(
        [
          {
            id: 'assistant-1',
            role: 'assistant',
            content: {
              format: 2 as const,
              parts: [{ type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'web_search', args: {} }],
            },
            createdAt: new Date(),
            threadId: 'test-thread',
          } as unknown as MastraDBMessage,
        ],
        'response',
      );
      messageList.add(
        [
          {
            id: 'tool-1',
            role: 'tool',
            content: {
              format: 2 as const,
              parts: [{ type: 'tool-result' as const, toolCallId: 'call-1', toolName: 'web_search', result: 'done' }],
            },
            createdAt: new Date(),
            threadId: 'test-thread',
          } as unknown as MastraDBMessage,
        ],
        'response',
      );

      // Manually add the same reminder first
      messageList.addSystem('Remember to cite your sources.', 'citation-reminder');

      // Run processInputStep - should not add duplicate
      await runner.runProcessInputStep({
        messageList,
        stepNumber: 1,
        model: createMockModel(),
        steps: [],
      });

      // Verify only one instance of the reminder exists
      const systemMessages = messageList.getAllSystemMessages();
      expect(systemMessages.length).toBe(1);
    });

    it('should continue to inject correctly after step resets by mutating messageList during processInputStep', async () => {
      const processor = new ToolResultReminderProcessor({
        reminderText: 'Tool results were executed.',
        tag: 'tool-result-reminder',
      });

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      // Step 0: Assistant calls a tool
      messageList.add(
        [
          {
            id: 'assistant-1',
            role: 'assistant',
            content: {
              format: 2 as const,
              parts: [{ type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'tool1', args: {} }],
            },
            createdAt: new Date(),
            threadId: 'test-thread',
          } as unknown as MastraDBMessage,
        ],
        'response',
      );

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
      });

      // No reminder yet (tool result not in history)
      let systemMessages = messageList.getAllSystemMessages();
      expect(systemMessages.length).toBe(0);

      // Simulate tool result by updating the assistant message's tool-invocation to state 'result'
      // This is what updateToolInvocation does after tool execution in production.
      const assistantMsg = messageList.get.all.db()[1];
      if (assistantMsg && assistantMsg.content.parts) {
        assistantMsg.content.parts = [
          {
            type: 'tool-invocation' as const,
            toolInvocation: {
              toolCallId: 'call-1',
              toolName: 'tool1',
              args: {},
              state: 'result' as const,
              result: 'result',
            },
          },
        ];
      }

      // Step 1: After tool result, reminder should be injected
      await runner.runProcessInputStep({
        messageList,
        stepNumber: 1,
        model: createMockModel(),
        steps: [],
      });

      systemMessages = messageList.getAllSystemMessages();
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0].content).toContain('Tool results were executed.');
    });

    it('should handle production scenario with toolInvocations array containing state result', async () => {
      const processor = new ToolResultReminderProcessor({
        reminderText: 'Tool execution completed.',
        tag: 'tool-result-reminder',
      });

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      // Production scenario: role is 'assistant' (converted from 'tool') with toolInvocations state 'result'
      messageList.add(
        [
          {
            id: 'assistant-1',
            role: 'assistant',
            content: {
              format: 2 as const,
              parts: [{ type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'tool1', args: {} }],
              toolInvocations: [
                {
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  args: {},
                  state: 'result' as const,
                  result: 'the result',
                },
              ],
            },
            createdAt: new Date(),
            threadId: 'test-thread',
          } as unknown as MastraDBMessage,
        ],
        'response',
      );

      // Run processInputStep
      await runner.runProcessInputStep({
        messageList,
        stepNumber: 1,
        model: createMockModel(),
        steps: [],
      });

      // Verify the reminder was injected
      const systemMessages = messageList.getAllSystemMessages();
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0].content).toContain('Tool execution completed.');
    });

    it('should use custom tag when provided', async () => {
      const processor = new ToolResultReminderProcessor({
        reminderText: 'Custom tagged reminder.',
        tag: 'my-custom-tag',
      });

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      // Add tool result
      messageList.add(
        [
          {
            id: 'assistant-1',
            role: 'assistant',
            content: {
              format: 2 as const,
              parts: [{ type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'tool1', args: {} }],
              toolInvocations: [
                {
                  toolCallId: 'call-1',
                  toolName: 'tool1',
                  args: {},
                  state: 'result' as const,
                  result: 'the result',
                },
              ],
            },
            createdAt: new Date(),
            threadId: 'test-thread',
          } as unknown as MastraDBMessage,
        ],
        'response',
      );

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 1,
        model: createMockModel(),
        steps: [],
      });

      // Verify reminder was added
      const systemMessages = messageList.getAllSystemMessages();
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0].content).toContain('Custom tagged reminder.');
    });
  });
});
