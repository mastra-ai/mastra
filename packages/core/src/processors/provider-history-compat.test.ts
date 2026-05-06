import { APICallError } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';
import { MessageList } from '../agent/message-list';
import { ProviderHistoryCompat } from './provider-history-compat';
import type { ProcessAPIErrorArgs } from './index';

function createUserMessage(content: string) {
  return {
    id: `msg-${Math.random()}`,
    role: 'user' as const,
    content: {
      format: 2 as const,
      parts: [{ type: 'text' as const, text: content }],
    },
    createdAt: new Date(),
  };
}

function createAssistantMessageWithToolCall(toolCallId: string, toolName: string, args: Record<string, unknown> = {}) {
  return {
    id: `msg-${Math.random()}`,
    role: 'assistant' as const,
    content: {
      format: 2 as const,
      parts: [
        {
          type: 'tool-invocation' as const,
          toolInvocation: {
            toolCallId,
            toolName,
            args,
            state: 'result' as const,
            result: 'ok',
          },
        },
      ],
    },
    createdAt: new Date(),
  };
}

function createToolIdError() {
  return new APICallError({
    message: "Invalid request: messages.1.content.0.tool_use.id: String should match pattern '^[a-zA-Z0-9_-]+$'",
    url: 'https://api.anthropic.com/v1/messages',
    requestBodyValues: {},
    statusCode: 400,
    responseBody: JSON.stringify({
      error: {
        message: "messages.1.content.0.tool_use.id: String should match pattern '^[a-zA-Z0-9_-]+$'",
      },
    }),
    isRetryable: false,
  });
}

function createToolIdErrorInBodyOnly() {
  return new APICallError({
    message: 'Bad request',
    url: 'https://api.anthropic.com/v1/messages',
    requestBodyValues: {},
    statusCode: 400,
    responseBody: JSON.stringify({
      error: {
        message: "messages.3.content.0.tool_use.id: String should match pattern '^[a-zA-Z0-9_-]+$'",
      },
    }),
    isRetryable: false,
  });
}

function createRateLimitError() {
  return new APICallError({
    message: 'Rate limit exceeded',
    url: 'https://api.anthropic.com/v1/messages',
    requestBodyValues: {},
    statusCode: 429,
    responseBody: JSON.stringify({ error: { message: 'Rate limit exceeded' } }),
    isRetryable: true,
  });
}

function makeArgs(overrides: Partial<ProcessAPIErrorArgs> = {}): ProcessAPIErrorArgs {
  const messageList = new MessageList({ threadId: 'test-thread' });
  messageList.add([createUserMessage('hello')], 'input');
  messageList.add([createAssistantMessageWithToolCall('call:abc.123', 'searchTool', { query: 'test' })], 'response');
  messageList.add([createUserMessage('thanks')], 'input');

  return {
    error: createToolIdError(),
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

describe('ProviderHistoryCompat', () => {
  it('has correct id and name', () => {
    const handler = new ProviderHistoryCompat();
    expect(handler.id).toBe('provider-history-compat');
    expect(handler.name).toBe('Provider History Compat');
  });

  it('should return { retry: true } for tool ID validation errors', async () => {
    const handler = new ProviderHistoryCompat();
    const args = makeArgs();

    const result = await handler.processAPIError(args);

    expect(result).toEqual({ retry: true });
  });

  it('should sanitize invalid tool-call IDs in tool-invocation parts', async () => {
    const handler = new ProviderHistoryCompat();
    const args = makeArgs();

    await handler.processAPIError(args);

    const messages = args.messageList.get.all.db();
    const assistantMsg = messages.find(m => m.role === 'assistant');
    const toolPart = assistantMsg!.content.parts.find(p => p.type === 'tool-invocation');
    expect(toolPart!.type).toBe('tool-invocation');
    if (toolPart!.type === 'tool-invocation') {
      expect(toolPart!.toolInvocation.toolCallId).toBe('call_abc_123');
      expect(toolPart!.toolInvocation.toolCallId).toMatch(/^[a-zA-Z0-9_-]+$/);
    }
  });

  it('should not modify tool-call IDs that are already valid', async () => {
    const handler = new ProviderHistoryCompat();
    const messageList = new MessageList({ threadId: 'test-thread' });
    messageList.add([createUserMessage('hello')], 'input');
    messageList.add([createAssistantMessageWithToolCall('toolu_01ABC-def_123', 'searchTool')], 'response');

    const args = makeArgs({ messageList, messages: messageList.get.all.db() });

    const result = await handler.processAPIError(args);

    // No invalid IDs found, so no rewrite needed — returns void
    expect(result).toBeUndefined();
  });

  it('should return undefined for non-tool-ID errors', async () => {
    const handler = new ProviderHistoryCompat();
    const args = makeArgs({ error: createRateLimitError() });

    const result = await handler.processAPIError(args);

    expect(result).toBeUndefined();
  });

  it('should return undefined for plain Error objects', async () => {
    const handler = new ProviderHistoryCompat();
    const args = makeArgs({ error: new Error('Something else went wrong') });

    const result = await handler.processAPIError(args);

    expect(result).toBeUndefined();
  });

  it('should return undefined when retryCount > 0', async () => {
    const handler = new ProviderHistoryCompat();
    const args = makeArgs({ retryCount: 1 });

    const result = await handler.processAPIError(args);

    expect(result).toBeUndefined();
  });

  it('should handle error string only present in responseBody', async () => {
    const handler = new ProviderHistoryCompat();
    const args = makeArgs({ error: createToolIdErrorInBodyOnly() });

    const result = await handler.processAPIError(args);

    expect(result).toEqual({ retry: true });
  });

  it('should sanitize multiple invalid IDs consistently', async () => {
    const handler = new ProviderHistoryCompat();
    const messageList = new MessageList({ threadId: 'test-thread' });
    messageList.add([createUserMessage('hello')], 'input');
    messageList.add([createAssistantMessageWithToolCall('call:abc.1', 'tool1')], 'response');
    messageList.add([createUserMessage('more')], 'input');
    messageList.add([createAssistantMessageWithToolCall('call:xyz.2', 'tool2')], 'response');

    const args = makeArgs({
      messageList,
      messages: messageList.get.all.db(),
    });

    await handler.processAPIError(args);

    const messages = messageList.get.all.db();
    const assistantMsgs = messages.filter(m => m.role === 'assistant');

    for (const msg of assistantMsgs) {
      for (const part of msg.content.parts) {
        if (part.type === 'tool-invocation') {
          expect(part.toolInvocation.toolCallId).toMatch(/^[a-zA-Z0-9_-]+$/);
        }
      }
    }

    // Verify specific rewrites
    const ids = assistantMsgs.flatMap(m =>
      m.content.parts
        .filter(p => p.type === 'tool-invocation')
        .map(p => (p.type === 'tool-invocation' ? p.toolInvocation.toolCallId : '')),
    );
    expect(ids).toEqual(['call_abc_1', 'call_xyz_2']);
  });

  it('should sanitize IDs in legacy toolInvocations array', async () => {
    const handler = new ProviderHistoryCompat();
    const messageList = new MessageList({ threadId: 'test-thread' });
    messageList.add([createUserMessage('hello')], 'input');

    // Create a message with legacy toolInvocations
    const msgWithLegacy = {
      id: `msg-legacy`,
      role: 'assistant' as const,
      content: {
        format: 2 as const,
        parts: [] as any[],
        toolInvocations: [
          {
            toolCallId: 'call:legacy.id',
            toolName: 'myTool',
            args: {},
            state: 'result' as const,
            result: 'ok',
          },
        ],
      },
      createdAt: new Date(),
    };
    messageList.add([msgWithLegacy], 'response');

    const args = makeArgs({
      messageList,
      messages: messageList.get.all.db(),
    });

    await handler.processAPIError(args);

    const messages = messageList.get.all.db();
    const assistantMsg = messages.find(m => m.role === 'assistant' && m.content.toolInvocations?.length);
    expect(assistantMsg!.content.toolInvocations![0]!.toolCallId).toBe('call_legacy_id');
  });

  it('should not modify messages when there are no invalid IDs', async () => {
    const handler = new ProviderHistoryCompat();
    const messageList = new MessageList({ threadId: 'test-thread' });
    messageList.add([createUserMessage('hello')], 'input');
    messageList.add([createAssistantMessageWithToolCall('valid-id_123', 'tool1')], 'response');

    const args = makeArgs({
      messageList,
      messages: messageList.get.all.db(),
    });

    const messagesBefore = JSON.stringify(messageList.get.all.db());

    const result = await handler.processAPIError(args);

    expect(result).toBeUndefined();
    expect(JSON.stringify(messageList.get.all.db())).toBe(messagesBefore);
  });
});
