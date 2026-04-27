import { APICallError } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';
import { MessageList } from '../agent/message-list';
import { PrefillErrorHandler } from './prefill-error-handler';
import type { ProcessAPIErrorArgs } from './index';

const createMessage = (content: string, role: 'user' | 'assistant' = 'user') => ({
  id: `msg-${Math.random()}`,
  role,
  content: {
    format: 2 as const,
    parts: [{ type: 'text' as const, text: content }],
  },
  createdAt: new Date(),
});

function createPrefillError() {
  return new APICallError({
    message: 'This model does not support assistant message prefill. The conversation must end with a user message.',
    url: 'https://api.anthropic.com/v1/messages',
    requestBodyValues: {},
    statusCode: 400,
    responseBody: JSON.stringify({
      error: {
        message: 'This model does not support assistant message prefill.',
      },
    }),
    isRetryable: false,
  });
}

function createOtherError() {
  return new APICallError({
    message: 'Rate limit exceeded',
    url: 'https://api.anthropic.com/v1/messages',
    requestBodyValues: {},
    statusCode: 429,
    responseBody: JSON.stringify({ error: { message: 'Rate limit exceeded' } }),
    isRetryable: true,
  });
}

function createQwenThinkingPrefillError() {
  return new APICallError({
    message: 'Assistant response prefill is incompatible with enable_thinking.',
    url: 'http://localhost:8080/v1/chat/completions',
    requestBodyValues: {},
    statusCode: 400,
    responseBody: JSON.stringify({
      error: {
        code: 400,
        message: 'Assistant response prefill is incompatible with enable_thinking.',
        type: 'invalid_request_error',
      },
    }),
    isRetryable: false,
  });
}

function createQwenThinkingPrefillErrorInBodyOnly() {
  return new APICallError({
    message: 'Bad request',
    url: 'http://localhost:8080/v1/chat/completions',
    requestBodyValues: {},
    statusCode: 400,
    responseBody: JSON.stringify({
      error: {
        code: 400,
        message: 'Assistant response prefill is incompatible with enable-thinking.',
        type: 'invalid_request_error',
      },
    }),
    isRetryable: false,
  });
}

function makeArgs(overrides: Partial<ProcessAPIErrorArgs> = {}): ProcessAPIErrorArgs {
  const messageList = new MessageList({ threadId: 'test-thread' });
  messageList.add([createMessage('hello', 'user')], 'input');
  messageList.add([createMessage('hi there', 'assistant')], 'response');

  return {
    error: createPrefillError(),
    messages: messageList.get.all.db(),
    messageList,
    stepNumber: 0,
    steps: [],
    state: {},
    retryCount: 0,
    abort: (() => {
      throw new Error('abort');
    }) as any,
    ...overrides,
  };
}

describe('PrefillErrorHandler', () => {
  it('should return { retry: true } for prefill errors with trailing assistant message', async () => {
    const handler = new PrefillErrorHandler();
    const args = makeArgs();

    const result = await handler.processAPIError(args);

    expect(result).toEqual({ retry: true });
  });

  it('should append a system reminder continue message to messageList', async () => {
    const handler = new PrefillErrorHandler();
    const args = makeArgs();
    const messageCountBefore = args.messageList.get.all.db().length;

    await handler.processAPIError(args);

    const messagesAfter = args.messageList.get.all.db();
    expect(messagesAfter.length).toBe(messageCountBefore + 1);

    const lastMessage = messagesAfter[messagesAfter.length - 1]!;
    expect(lastMessage.role).toBe('user');
    expect(lastMessage.content.parts).toEqual([
      expect.objectContaining({
        type: 'text',
        text: '<system-reminder>continue</system-reminder>',
      }),
    ]);
    expect(lastMessage.content.metadata).toEqual({
      systemReminder: {
        type: 'anthropic-prefill-processor-retry',
      },
    });
  });

  it('should return undefined for non-prefill errors', async () => {
    const handler = new PrefillErrorHandler();
    const args = makeArgs({ error: createOtherError() });

    const result = await handler.processAPIError(args);

    expect(result).toBeUndefined();
  });

  it('should return undefined for plain Error objects', async () => {
    const handler = new PrefillErrorHandler();
    const args = makeArgs({ error: new Error('Something else went wrong') });

    const result = await handler.processAPIError(args);

    expect(result).toBeUndefined();
  });

  it('should return undefined when retryCount > 0', async () => {
    const handler = new PrefillErrorHandler();
    const args = makeArgs({ retryCount: 1 });

    const result = await handler.processAPIError(args);

    expect(result).toBeUndefined();
  });

  it('should return { retry: true } for qwen enable_thinking prefill errors', async () => {
    const handler = new PrefillErrorHandler();
    const args = makeArgs({ error: createQwenThinkingPrefillError() });

    const result = await handler.processAPIError(args);

    expect(result).toEqual({ retry: true });
    const lastMessage = args.messageList.get.all.db().at(-1);
    expect(lastMessage?.role).toBe('user');
  });

  it('should return { retry: true } when qwen prefill string is only present in responseBody', async () => {
    const handler = new PrefillErrorHandler();
    const args = makeArgs({ error: createQwenThinkingPrefillErrorInBodyOnly() });

    const result = await handler.processAPIError(args);

    expect(result).toEqual({ retry: true });
  });

  it('should still retry even when last message is not from assistant', async () => {
    const handler = new PrefillErrorHandler();
    const messageList = new MessageList({ threadId: 'test-thread' });
    messageList.add([createMessage('hello', 'user')], 'input');
    const args = makeArgs({
      messageList,
      messages: messageList.get.all.db(),
    });

    const result = await handler.processAPIError(args);

    expect(result).toEqual({ retry: true });
    // Should have appended a system reminder continue message
    const allMessages = messageList.get.all.db();
    expect(allMessages[allMessages.length - 1]?.role).toBe('user');
  });

  it('should not modify messageList when error is not a prefill error', async () => {
    const handler = new PrefillErrorHandler();
    const args = makeArgs({ error: createOtherError() });
    const messageCountBefore = args.messageList.get.all.db().length;

    await handler.processAPIError(args);

    expect(args.messageList.get.all.db().length).toBe(messageCountBefore);
  });

  it('has correct id and name', () => {
    const handler = new PrefillErrorHandler();
    expect(handler.id).toBe('prefill-error-handler');
    expect(handler.name).toBe('Prefill Error Handler');
  });
});
