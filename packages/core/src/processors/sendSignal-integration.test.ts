import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageList } from '../agent/message-list';
import { isTransientSignalMessage } from '../agent/signals';
import type { IMastraLogger } from '../logger';
import { ProcessorRunner } from './runner';
import type { ProcessorStreamWriter } from './index';

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

/**
 * Extract flattened text from a prompt message's content (string or parts array).
 */
function extractPromptText(message: { role: string; content: unknown }): string {
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('\n');
  }
  return '';
}

describe('sendSignal integration through ProcessorRunner', () => {
  let messageList: MessageList;

  beforeEach(() => {
    messageList = new MessageList({ threadId: 'test-thread' });
    messageList.add([{ role: 'user', content: 'hello' }], 'input');
  });

  it('signal from processInputStep appears in the LLM prompt', async () => {
    const runner = new ProcessorRunner({
      inputProcessors: [
        {
          id: 'signal-sender',
          processInputStep: async ({ sendSignal }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'Remember to follow AGENTS.md instructions.',
              attributes: { type: 'dynamic-agents-md', path: '/repo/AGENTS.md' },
              metadata: { path: '/repo/AGENTS.md', type: 'dynamic-agents-md' },
            });
          },
        },
      ],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 0,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      rotateResponseMessageId: () => 'response-2',
      writer: { custom: async () => {} },
    });

    // Signal should be in the DB message list
    const dbMessages = messageList.get.all.db();
    const signalMessages = dbMessages.filter(m => m.role === 'signal');
    expect(signalMessages).toHaveLength(1);
    expect(signalMessages[0]!.content.parts[0]).toEqual(
      expect.objectContaining({ type: 'text', text: 'Remember to follow AGENTS.md instructions.' }),
    );

    // Signal should appear in the LLM prompt as a user message with XML markup
    const promptMessages = await messageList.get.all.aiV5.prompt();
    const userMessages = promptMessages.filter((m: any) => m.role === 'user');
    const signalInPrompt = userMessages.find((m: any) => {
      const text = extractPromptText(m);
      return text.includes('system-reminder') && text.includes('AGENTS.md');
    });
    expect(signalInPrompt).toBeDefined();
  });

  it('signal metadata is preserved through real MessageList round-trip', async () => {
    const runner = new ProcessorRunner({
      inputProcessors: [
        {
          id: 'metadata-signal',
          processInputStep: async ({ sendSignal }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'Check this out',
              attributes: { type: 'dynamic-agents-md', path: '/project/AGENTS.md' },
              metadata: { path: '/project/AGENTS.md', type: 'dynamic-agents-md' },
            });
          },
        },
      ],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 0,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      writer: { custom: async () => {} },
    });

    const signalMsg = messageList.get.all.db().find(m => m.role === 'signal');
    expect(signalMsg).toBeDefined();

    // Verify metadata.signal is preserved with the right structure
    const signalMeta = signalMsg!.content.metadata?.signal as Record<string, unknown> | undefined;
    expect(signalMeta).toBeDefined();
    expect(signalMeta!.type).toBe('reactive');
    expect(signalMeta!.tagName).toBe('system-reminder');
    expect(signalMeta!.attributes).toEqual(
      expect.objectContaining({ type: 'dynamic-agents-md', path: '/project/AGENTS.md' }),
    );
    expect(signalMeta!.metadata).toEqual(
      expect.objectContaining({ path: '/project/AGENTS.md', type: 'dynamic-agents-md' }),
    );
  });

  it('sendSignal emits a data part to the stream writer', async () => {
    const chunks: unknown[] = [];
    const writer: ProcessorStreamWriter = {
      custom: async chunk => {
        chunks.push(chunk);
      },
    };

    const runner = new ProcessorRunner({
      inputProcessors: [
        {
          id: 'stream-signal',
          processInputStep: async ({ sendSignal }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'stream test',
            });
          },
        },
      ],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 0,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      writer,
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(
      expect.objectContaining({
        type: 'data-signal',
        data: expect.objectContaining({
          type: 'reactive',
          tagName: 'system-reminder',
          contents: 'stream test',
        }),
      }),
    );
  });

  it('sendSignal rotates the response message ID and updates the step result', async () => {
    const rotateResponseMessageId = vi.fn(() => 'rotated-id');

    const runner = new ProcessorRunner({
      inputProcessors: [
        {
          id: 'rotate-signal',
          processInputStep: async ({ sendSignal }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'rotated',
            });
          },
        },
      ],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    const result = await runner.runProcessInputStep({
      messageList,
      stepNumber: 0,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      rotateResponseMessageId,
      writer: { custom: async () => {} },
    });

    // rotateResponseMessageId was invoked
    expect(rotateResponseMessageId).toHaveBeenCalledTimes(1);

    // The step result's messageId reflects the rotated value, proving the
    // rotation propagated to the step state (not just the callback invocation).
    expect(result.messageId).toBe('rotated-id');
  });

  it('multiple sendSignal calls from different processors are all preserved', async () => {
    const runner = new ProcessorRunner({
      inputProcessors: [
        {
          id: 'signal-1',
          processInputStep: async ({ sendSignal }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'first reminder',
              attributes: { path: '/a/AGENTS.md' },
            });
          },
        },
        {
          id: 'signal-2',
          processInputStep: async ({ sendSignal }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'second reminder',
              attributes: { path: '/b/AGENTS.md' },
            });
          },
        },
      ],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 0,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      rotateResponseMessageId: vi.fn(() => `rotated-${Math.random()}`),
      writer: { custom: async () => {} },
    });

    const signals = messageList.get.all.db().filter(m => m.role === 'signal');
    expect(signals).toHaveLength(2);

    // Both signals should also appear in the LLM prompt
    const promptMessages = await messageList.get.all.aiV5.prompt();
    const signalTexts = promptMessages
      .filter((m: any) => m.role === 'user')
      .map((m: any) => extractPromptText(m))
      .filter((t: string) => t.includes('system-reminder'));
    expect(signalTexts).toHaveLength(2);
  });

  it('sendSignal is available in processOutputResult context', async () => {
    const runner = new ProcessorRunner({
      inputProcessors: [],
      outputProcessors: [
        {
          id: 'output-signal',
          processOutputResult: async ({ sendSignal, messages }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'output context signal',
            });
            return messages;
          },
        },
      ],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runOutputProcessors(messageList, undefined, undefined, 0, { custom: async () => {} });

    const signals = messageList.get.all.db().filter(m => m.role === 'signal');
    expect(signals).toHaveLength(1);
    expect(signals[0]!.content.parts[0]).toEqual(
      expect.objectContaining({ type: 'text', text: 'output context signal' }),
    );
  });

  it('sendSignal is available in processAPIError context', async () => {
    const runner = new ProcessorRunner({
      inputProcessors: [],
      outputProcessors: [],
      errorProcessors: [
        {
          id: 'error-signal',
          processAPIError: async ({ sendSignal }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'error context signal',
            });
            return { retry: false };
          },
        },
      ],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessAPIError({
      error: new Error('test error'),
      messages: messageList.get.all.db(),
      messageList,
      stepNumber: 0,
      steps: [],
      retryCount: 0,
      writer: { custom: async () => {} },
    });

    const signals = messageList.get.all.db().filter(m => m.role === 'signal');
    expect(signals).toHaveLength(1);
    expect(signals[0]!.content.parts[0]).toEqual(
      expect.objectContaining({ type: 'text', text: 'error context signal' }),
    );
  });

  it('sendSignal without writer still adds message to the list', async () => {
    const runner = new ProcessorRunner({
      inputProcessors: [
        {
          id: 'no-writer-signal',
          processInputStep: async ({ sendSignal }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'no writer test',
            });
          },
        },
      ],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 0,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      // No writer provided
    });

    const signals = messageList.get.all.db().filter(m => m.role === 'signal');
    expect(signals).toHaveLength(1);
  });

  it('sendSignal without rotateResponseMessageId still adds signal', async () => {
    const runner = new ProcessorRunner({
      inputProcessors: [
        {
          id: 'no-rotate-signal',
          processInputStep: async ({ sendSignal }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'no rotate test',
            });
          },
        },
      ],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 0,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      // No rotateResponseMessageId
      writer: { custom: async () => {} },
    });

    const signals = messageList.get.all.db().filter(m => m.role === 'signal');
    expect(signals).toHaveLength(1);
    expect(signals[0]!.content.parts[0]).toEqual(expect.objectContaining({ type: 'text', text: 'no rotate test' }));
  });

  it('threads transient: true from a processor sendSignal through to the DB message', async () => {
    // Regression: MessageList.addSignal rebuilds the signal via createSignal, so it must forward
    // the transient flag. Otherwise transient signals sent from a processor (the main use case)
    // lose the flag before toDBMessage() and get persisted.
    const runner = new ProcessorRunner({
      inputProcessors: [
        {
          id: 'transient-signal',
          processInputStep: async ({ sendSignal }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'transient steering reminder',
              transient: true,
            });
          },
        },
      ],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 0,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      writer: { custom: async () => {} },
    });

    const signals = messageList.get.all.db().filter(m => m.role === 'signal');
    expect(signals).toHaveLength(1);
    // The flag survived addSignal → the save-time filters will drop this from storage.
    expect((signals[0]!.content.metadata?.signal as Record<string, unknown>).transient).toBe(true);
    expect(isTransientSignalMessage(signals[0]!)).toBe(true);
  });

  it('does not mark a normal processor sendSignal as transient', async () => {
    const runner = new ProcessorRunner({
      inputProcessors: [
        {
          id: 'normal-signal',
          processInputStep: async ({ sendSignal }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'persisted reminder',
            });
          },
        },
      ],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 0,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      writer: { custom: async () => {} },
    });

    const signals = messageList.get.all.db().filter(m => m.role === 'signal');
    expect(signals).toHaveLength(1);
    expect(isTransientSignalMessage(signals[0]!)).toBe(false);
  });
});
