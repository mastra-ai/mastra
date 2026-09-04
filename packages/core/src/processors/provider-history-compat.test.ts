import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { APICallError } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';
import { MessageList } from '../agent/message-list';
import {
  anthropicStripEmptySignedReasoningContent,
  anthropicStripForeignReasoningContent,
  azureSystemReminderTransform,
  cerebrasStripReasoningContent,
  isMaybeAnthropic,
  isMaybeAnthropicWithoutAssistantPrefill,
  isMaybeAzure,
  isMaybeCerebras,
  ProviderHistoryCompat,
  stripForeignProviderExecutedTools,
} from './provider-history-compat';
import type { CompatRule } from './provider-history-compat';
import { ProcessorRunner } from './runner';
import type { ProcessAPIErrorArgs, ProcessLLMRequestArgs } from './index';

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

  it('runs custom reactive compat rules for matching API errors', async () => {
    const customRule: CompatRule = {
      name: 'custom-history-fix',
      errorPatterns: [/custom provider rejected history/i],
      fix(messages) {
        const assistant = messages.find(message => message.role === 'assistant');
        if (!assistant) return false;
        assistant.content.parts = [{ type: 'text', text: 'custom fixed' }];
        return true;
      },
    };
    const handler = new ProviderHistoryCompat({ additionalRules: [customRule] });
    const args = makeArgs({ error: new Error('custom provider rejected history') });

    const result = await handler.processAPIError(args);

    expect(result).toEqual({ retry: true });
    const assistant = args.messageList.get.all.db().find(message => message.role === 'assistant');
    expect(assistant?.content.parts).toEqual([{ type: 'text', text: 'custom fixed' }]);
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

// ---------------------------------------------------------------------------
// isMaybeAnthropic / isMaybeCerebras
// ---------------------------------------------------------------------------

describe('isMaybeAnthropic', () => {
  it('matches provider-shaped anthropic models and gateway-prefixed strings', () => {
    expect(isMaybeAnthropic('anthropic/claude-haiku-4-5-20251001')).toBe(true);
    expect(isMaybeAnthropic('anthropic:claude-haiku-4-5-20251001')).toBe(true);
    expect(isMaybeAnthropic({ provider: 'anthropic.messages', modelId: 'claude-haiku-4-5-20251001' })).toBe(true);
    expect(
      isMaybeAnthropic({ provider: 'openai-compatible.chat', modelId: 'anthropic/claude-haiku-4-5-20251001' }),
    ).toBe(true);
    expect(isMaybeAnthropic({ provider: 'openai.chat', modelId: 'gpt-4o' })).toBe(false);
    expect(isMaybeAnthropic('anthropic-foo')).toBe(false);
  });
});

describe('isMaybeAnthropicWithoutAssistantPrefill', () => {
  it('matches Claude 4.6 and later Anthropic models', () => {
    expect(isMaybeAnthropicWithoutAssistantPrefill('anthropic/claude-opus-4-6')).toBe(true);
    expect(isMaybeAnthropicWithoutAssistantPrefill('anthropic/claude-opus-5')).toBe(true);
    expect(
      isMaybeAnthropicWithoutAssistantPrefill({ provider: 'anthropic.messages', modelId: 'claude-sonnet-4.6' }),
    ).toBe(true);
    expect(
      isMaybeAnthropicWithoutAssistantPrefill({
        provider: 'openai-compatible.chat',
        modelId: 'anthropic/claude-opus-5',
      }),
    ).toBe(true);
  });

  it('does not match older Claude models or non-Anthropic models', () => {
    expect(isMaybeAnthropicWithoutAssistantPrefill('anthropic/claude-haiku-4-5-20251001')).toBe(false);
    expect(
      isMaybeAnthropicWithoutAssistantPrefill({ provider: 'anthropic.messages', modelId: 'claude-sonnet-4.5' }),
    ).toBe(false);
    expect(isMaybeAnthropicWithoutAssistantPrefill('openai/gpt-5')).toBe(false);
  });

  it('uses a conservative result for unresolved Anthropic model versions and fallback arrays', () => {
    expect(isMaybeAnthropicWithoutAssistantPrefill({ provider: 'anthropic.messages' })).toBe(true);
    expect(isMaybeAnthropicWithoutAssistantPrefill(() => 'anthropic/claude-opus-5')).toBe(true);
    expect(
      isMaybeAnthropicWithoutAssistantPrefill([
        { model: 'anthropic/claude-haiku-4-5-20251001' },
        { model: 'anthropic/claude-opus-5' },
      ]),
    ).toBe(true);
  });
});

describe('isMaybeAzure', () => {
  it('matches Azure provider and gateway model forms', () => {
    expect(isMaybeAzure('azure/gpt-4o')).toBe(true);
    expect(isMaybeAzure('azure-openai/gpt-4o')).toBe(true);
    expect(isMaybeAzure('AZURE-OPENAI:gpt-4o')).toBe(true);
    expect(isMaybeAzure({ provider: 'azure.responses', modelId: 'gpt-4o' })).toBe(true);
    expect(isMaybeAzure({ provider: 'azure-openai.chat', modelId: 'gpt-4o' })).toBe(true);
    expect(isMaybeAzure({ provider: 'openai-compatible.chat', modelId: 'azure-openai/gpt-4o' })).toBe(true);
  });

  it('handles fallback arrays and rejects unrelated or unresolved models', () => {
    expect(isMaybeAzure([{ model: 'openai/gpt-4o' }, { model: 'azure/gpt-4o' }])).toBe(true);
    expect(isMaybeAzure('openai/gpt-4o')).toBe(false);
    expect(isMaybeAzure('azureish/gpt-4o')).toBe(false);
    expect(isMaybeAzure({ provider: 'azure-foo', modelId: 'gpt-4o' })).toBe(false);
    expect(isMaybeAzure(() => 'azure/gpt-4o')).toBe(false);
    expect(isMaybeAzure(undefined)).toBe(false);
  });
});

describe('isMaybeCerebras', () => {
  it('matches the gateway-prefixed model id string', () => {
    expect(isMaybeCerebras('cerebras/zai-glm-4.7')).toBe(true);
    expect(isMaybeCerebras('cerebras/llama3.1-8b')).toBe(true);
  });

  it('matches resolved language model objects with cerebras provider', () => {
    expect(isMaybeCerebras({ provider: 'cerebras.chat', modelId: 'zai-glm-4.7' })).toBe(true);
    expect(isMaybeCerebras({ provider: 'cerebras', modelId: 'whatever' })).toBe(true);
    expect(isMaybeCerebras({ provider: 'cerebras-chat', modelId: 'whatever' })).toBe(true);
  });

  it('does not match non-cerebras providers', () => {
    expect(isMaybeCerebras('openai/gpt-4o')).toBe(false);
    expect(isMaybeCerebras('anthropic/claude-opus-4-6')).toBe(false);
    expect(isMaybeCerebras({ provider: 'openai.chat', modelId: 'gpt-4o' })).toBe(false);
    expect(isMaybeCerebras({ provider: 'zai', modelId: 'glm-4.7' })).toBe(false);
    // Models prefixed `cerebras-` (e.g. an unrelated future model name) shouldn't match
    expect(isMaybeCerebras('cerebras-foo')).toBe(false);
  });

  it('matches object-shaped models with generic providers and cerebras-prefixed model IDs', () => {
    expect(isMaybeCerebras({ provider: 'openai-compatible.chat', modelId: 'cerebras/zai-glm-4.7' })).toBe(true);
    expect(isMaybeCerebras({ provider: 'openai-compatible.chat', modelId: 'cerebras:zai-glm-4.7' })).toBe(true);
  });

  it('handles arrays by matching any element', () => {
    expect(isMaybeCerebras([{ model: 'openai/gpt-4o' }, { model: 'cerebras/zai-glm-4.7' }])).toBe(true);
    expect(isMaybeCerebras([{ model: 'openai/gpt-4o' }, { model: 'anthropic/claude-3' }])).toBe(false);
  });

  it('returns false for unknown shapes (functions, null, undefined)', () => {
    expect(isMaybeCerebras(undefined)).toBe(false);
    expect(isMaybeCerebras(null)).toBe(false);
    expect(isMaybeCerebras(() => 'cerebras/foo')).toBe(false);
    expect(isMaybeCerebras({ provider: undefined, modelId: 'x' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// cerebrasStripReasoningContent rule + ProviderHistoryCompat.processLLMRequest
// ---------------------------------------------------------------------------

function promptWithReasoning(): LanguageModelV2Prompt {
  return [
    { role: 'system', content: 'sys' },
    { role: 'user', content: [{ type: 'text', text: 'hi' }] },
    {
      role: 'assistant',
      content: [
        { type: 'reasoning', text: 'I should look this up' },
        { type: 'text', text: 'final answer' },
      ],
    },
    { role: 'user', content: [{ type: 'text', text: 'thanks' }] },
  ];
}

function makeRequestArgs(prompt: LanguageModelV2Prompt, model: unknown): ProcessLLMRequestArgs {
  return {
    prompt,
    model: model as any,
    stepNumber: 0,
    steps: [],
    state: {},
    retryCount: 0,
    abort: (() => {
      throw new Error('abort');
    }) as any,
  };
}

const mockLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  trackException: () => {},
} as any;

describe('stripForeignProviderExecutedTools', () => {
  const hostedToolPrompt = (provider: 'anthropic' | 'openai', toolCallId: string): LanguageModelV2Prompt => [
    { role: 'user', content: [{ type: 'text', text: 'search for this' }] },
    {
      role: 'assistant',
      content: [
        { type: 'text', text: 'I will search.' },
        {
          type: 'tool-call',
          toolCallId,
          toolName: 'web_search',
          input: { query: 'Mastra' },
          providerExecuted: true,
          providerOptions: { [provider]: { itemId: toolCallId } },
        } as any,
        { type: 'text', text: 'Search complete.' },
      ],
    },
    {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId,
          toolName: 'web_search',
          output: { type: 'text', value: 'result' },
          providerOptions: { [provider]: { itemId: toolCallId } },
        } as any,
      ],
    },
    { role: 'user', content: [{ type: 'text', text: 'summarize it' }] },
  ];

  it('strips Anthropic hosted-tool pairs before an OpenAI Responses request', () => {
    const result = stripForeignProviderExecutedTools.applyToPrompt!({
      prompt: hostedToolPrompt('anthropic', 'srvtoolu_abc123'),
      model: { provider: 'openai.responses', modelId: 'gpt-5' },
    });

    expect(result).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'search for this' }] },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'I will search.' },
          { type: 'text', text: 'Search complete.' },
        ],
      },
      { role: 'user', content: [{ type: 'text', text: 'summarize it' }] },
    ]);
  });

  it('strips OpenAI hosted-tool pairs before an Anthropic request', () => {
    const result = stripForeignProviderExecutedTools.applyToPrompt!({
      prompt: hostedToolPrompt('openai', 'ws_abc123'),
      model: { provider: 'anthropic.messages', modelId: 'claude-sonnet-4-5' },
    });

    expect(result?.some(message => message.role === 'tool')).toBe(false);
    expect((result?.[1]?.content as any[]).map(part => part.type)).toEqual(['text', 'text']);
  });

  it('preserves same-provider hosted-tool history', () => {
    const prompt = hostedToolPrompt('anthropic', 'srvtoolu_abc123');
    const result = stripForeignProviderExecutedTools.applyToPrompt!({
      prompt,
      model: { provider: 'anthropic.messages', modelId: 'claude-sonnet-4-5' },
    });

    expect(result).toBeUndefined();
  });

  it('preserves OpenAI hosted-tool history for OpenAI-compatible destinations', () => {
    const prompt = hostedToolPrompt('openai', 'ws_abc123');
    const result = stripForeignProviderExecutedTools.applyToPrompt!({
      prompt,
      model: { provider: 'azure-openai.responses', modelId: 'gpt-5' },
    });

    expect(result).toBeUndefined();
  });

  it('does not remove client-executed tool pairs', () => {
    const prompt = hostedToolPrompt('anthropic', 'call_abc123');
    delete (prompt[1].content as any[])[1].providerExecuted;

    const result = stripForeignProviderExecutedTools.applyToPrompt!({
      prompt,
      model: { provider: 'openai.responses', modelId: 'gpt-5' },
    });

    expect(result).toBeUndefined();
  });
});

describe('anthropicStripForeignReasoningContent', () => {
  it('strips foreign reasoning parts from assistant messages when model is Anthropic', () => {
    const result = anthropicStripForeignReasoningContent.applyToPrompt!({
      prompt: promptWithReasoning(),
      model: { provider: 'anthropic.messages', modelId: 'claude-haiku-4-5-20251001' },
    });

    expect(result).toBeDefined();
    const assistant = result!.find(m => m.role === 'assistant')!;
    expect((assistant.content as any[]).map(p => p.type)).toEqual(['text']);
  });

  it('preserves Anthropic-native reasoning parts', () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'native thinking',
            providerOptions: { anthropic: { signature: 'sig' } },
          },
          { type: 'text', text: 'answer' },
        ],
      },
    ];

    const result = anthropicStripForeignReasoningContent.applyToPrompt!({
      prompt,
      model: { provider: 'anthropic.messages', modelId: 'claude-haiku-4-5-20251001' },
    });

    expect(result).toBeUndefined();
  });

  it('returns undefined when the model is not Anthropic', () => {
    const result = anthropicStripForeignReasoningContent.applyToPrompt!({
      prompt: promptWithReasoning(),
      model: { provider: 'openai.chat', modelId: 'gpt-4o' },
    });
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Trailing assistant protection (Anthropic "thinking blocks in the latest
// assistant message cannot be modified")
// ---------------------------------------------------------------------------

describe('trailing assistant message protection', () => {
  const anthropicModel = { provider: 'anthropic.messages', modelId: 'claude-opus-4-6' };

  /** Active tool-use continuation: last assistant is followed only by tool messages. */
  function toolContinuationPrompt(): LanguageModelV2Prompt {
    return [
      { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      {
        role: 'assistant',
        content: [
          // Historical assistant turn with a strippable part
          { type: 'reasoning', text: 'old foreign reasoning' },
          { type: 'text', text: 'earlier answer' },
        ],
      },
      { role: 'user', content: [{ type: 'text', text: 'do the thing' }] },
      {
        role: 'assistant',
        content: [
          // Unsigned interleaved thinking (no anthropic metadata) — must NOT be
          // stripped from the latest assistant message.
          { type: 'reasoning', text: 'live thinking' },
          // Signed-but-empty block — must also survive untouched.
          { type: 'reasoning', text: '', providerOptions: { anthropic: { signature: 'sig-live' } } },
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'doThing', input: {} },
        ],
      },
      {
        role: 'tool',
        content: [
          { type: 'tool-result', toolCallId: 'call-1', toolName: 'doThing', output: { type: 'text', value: 'ok' } },
        ],
      },
    ];
  }

  it('foreign-reasoning strip skips the trailing assistant of a tool continuation', () => {
    const result = anthropicStripForeignReasoningContent.applyToPrompt!({
      prompt: toolContinuationPrompt(),
      model: anthropicModel,
    });

    expect(result).toBeDefined();
    // Historical assistant stripped
    expect((result![1].content as any[]).map(p => p.type)).toEqual(['text']);
    // Trailing assistant untouched
    expect((result![3].content as any[]).map(p => p.type)).toEqual(['reasoning', 'reasoning', 'tool-call']);
  });

  it('strips foreign reasoning from a trailing tool continuation after switching to Anthropic', () => {
    const prompt: LanguageModelV2Prompt = [
      { role: 'user', content: [{ type: 'text', text: 'do the thing' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: '',
            providerOptions: {
              openai: {
                itemId: 'rs_123',
                reasoningEncryptedContent: 'encrypted-reasoning',
              },
            },
          },
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'doThing', input: {} },
        ],
      },
      {
        role: 'tool',
        content: [
          { type: 'tool-result', toolCallId: 'call-1', toolName: 'doThing', output: { type: 'text', value: 'ok' } },
        ],
      },
    ];

    const result = anthropicStripForeignReasoningContent.applyToPrompt!({
      prompt,
      model: anthropicModel,
    });

    expect(result).toBeDefined();
    expect((result![1].content as any[]).map(p => p.type)).toEqual(['tool-call']);
  });

  it('empty-signed strip skips the trailing assistant of a tool continuation', () => {
    const prompt = toolContinuationPrompt();
    // Give the historical assistant an empty signed block so the rule has
    // something to strip outside the protected message.
    (prompt[1].content as any[]).unshift({
      type: 'reasoning',
      text: '',
      providerOptions: { anthropic: { signature: 'sig-legacy' } },
    });

    const result = anthropicStripEmptySignedReasoningContent.applyToPrompt!({
      prompt,
      model: anthropicModel,
    });

    expect(result).toBeDefined();
    expect((result![1].content as any[]).map(p => p.type)).toEqual(['reasoning', 'text']);
    // Trailing assistant keeps its empty signed block untouched
    expect((result![3].content as any[]).map(p => p.type)).toEqual(['reasoning', 'reasoning', 'tool-call']);
  });

  it('still strips the last assistant message when a new user turn follows it', () => {
    const prompt = toolContinuationPrompt();
    prompt.push({ role: 'user', content: [{ type: 'text', text: 'next question' }] });

    const result = anthropicStripForeignReasoningContent.applyToPrompt!({
      prompt,
      model: anthropicModel,
    });

    expect(result).toBeDefined();
    expect((result![3].content as any[]).map(p => p.type)).toEqual(['reasoning', 'tool-call']);
  });
});

describe('azureSystemReminderTransform', () => {
  const prompt: LanguageModelV2Prompt = [
    {
      role: 'system',
      content: 'Reminders use <system-reminder>context</system-reminder> wrappers.',
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: '<system-reminder>Continue from memory.</system-reminder>' },
        {
          type: 'text',
          text: '<system-reminder type="temporal-gap" precedesMessageId="msg-2">11 hours later</system-reminder>',
        },
        { type: 'text', text: '<system-reminder kind="reference-image" /> and <system-reminder/>' },
        { type: 'text', text: '<system-reminderX>Do not rewrite this.</system-reminderX>' },
        { type: 'file', data: 'ZmFrZQ==', mediaType: 'image/png' },
      ],
    },
    {
      role: 'assistant',
      content: [{ type: 'text', text: '<system-reminder>Assistant text is unchanged.</system-reminder>' }],
    },
  ];

  it('rewrites memory reminder tags in Azure-bound system and user text', () => {
    const result = azureSystemReminderTransform.applyToPrompt!({
      prompt,
      model: { provider: 'azure-openai.chat', modelId: 'gpt-4o' },
    });

    expect(result).toEqual([
      {
        role: 'system',
        content: 'Reminders use <memory-context>context</memory-context> wrappers.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: '<memory-context>Continue from memory.</memory-context>' },
          {
            type: 'text',
            text: '<memory-context type="temporal-gap" precedesMessageId="msg-2">11 hours later</memory-context>',
          },
          { type: 'text', text: '<memory-context kind="reference-image" /> and <memory-context/>' },
          { type: 'text', text: '<system-reminderX>Do not rewrite this.</system-reminderX>' },
          { type: 'file', data: 'ZmFrZQ==', mediaType: 'image/png' },
        ],
      },
      prompt[2],
    ]);
    expect(prompt[0].content).toContain('<system-reminder>');
    expect((prompt[1].content as any[])[0].text).toContain('<system-reminder>');
  });

  it('returns undefined for non-Azure models and prompts without reminder tags', () => {
    expect(azureSystemReminderTransform.applyToPrompt!({ prompt, model: 'openai/gpt-4o' })).toBeUndefined();
    expect(
      azureSystemReminderTransform.applyToPrompt!({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        model: 'azure/gpt-4o',
      }),
    ).toBeUndefined();
  });
});

describe('cerebrasStripReasoningContent', () => {
  it('strips reasoning parts from assistant messages when model is cerebras', () => {
    const prompt = promptWithReasoning();
    const result = cerebrasStripReasoningContent.applyToPrompt!({
      prompt,
      model: { provider: 'cerebras.chat', modelId: 'zai-glm-4.7' },
    });

    expect(result).toBeDefined();
    const assistant = result!.find(m => m.role === 'assistant')!;
    expect(Array.isArray(assistant.content)).toBe(true);
    expect((assistant.content as any[]).map(p => p.type)).toEqual(['text']);
    // Original prompt is untouched (immutable rewrite).
    const origAssistant = prompt.find(m => m.role === 'assistant')!;
    expect((origAssistant.content as any[]).map(p => p.type)).toEqual(['reasoning', 'text']);
  });

  it('preserves text and tool-call parts on assistant messages', () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'thinking' },
          {
            type: 'tool-call',
            toolCallId: 'call_1',
            toolName: 'search',
            input: { q: 'x' },
          },
          { type: 'text', text: 'done' },
        ],
      },
    ];
    const result = cerebrasStripReasoningContent.applyToPrompt!({
      prompt,
      model: { provider: 'cerebras.chat', modelId: 'zai-glm-4.7' },
    });

    expect(result).toBeDefined();
    const assistant = result![0]!;
    expect((assistant.content as any[]).map(p => p.type)).toEqual(['tool-call', 'text']);
  });

  it('returns undefined when the model is not cerebras', () => {
    const result = cerebrasStripReasoningContent.applyToPrompt!({
      prompt: promptWithReasoning(),
      model: { provider: 'openai.chat', modelId: 'gpt-4o' },
    });
    expect(result).toBeUndefined();
  });

  it('returns undefined when no assistant message has a reasoning part', () => {
    const prompt: LanguageModelV2Prompt = [
      { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_1',
            toolName: 'search',
            input: {},
          },
        ],
      },
    ];
    const result = cerebrasStripReasoningContent.applyToPrompt!({
      prompt,
      model: { provider: 'cerebras.chat', modelId: 'zai-glm-4.7' },
    });
    expect(result).toBeUndefined();
  });

  it('does not touch user messages', () => {
    // Real-world prompts won't have user reasoning parts, but the rule should
    // remain assistant-scoped regardless.
    const prompt: LanguageModelV2Prompt = [
      { role: 'user', content: [{ type: 'text', text: 'ask' }] },
      {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'thinking' },
          { type: 'text', text: 'answer' },
        ],
      },
    ];
    const result = cerebrasStripReasoningContent.applyToPrompt!({
      prompt,
      model: { provider: 'cerebras.chat', modelId: 'zai-glm-4.7' },
    });
    expect(result).toBeDefined();
    expect(result![0]).toEqual(prompt[0]);
  });
});

describe('ProviderHistoryCompat.processLLMRequest', () => {
  it('rewrites memory reminders in Azure-bound prompts', async () => {
    const handler = new ProviderHistoryCompat();
    const prompt: LanguageModelV2Prompt = [
      { role: 'system', content: 'Use <system-reminder> tags.' },
      { role: 'user', content: [{ type: 'text', text: '<system-reminder>Continue.</system-reminder>' }] },
    ];

    const result = await handler.processLLMRequest(
      makeRequestArgs(prompt, { provider: 'azure.responses', modelId: 'gpt-4o' }),
    );

    expect(result).toEqual({
      prompt: [
        { role: 'system', content: 'Use <memory-context> tags.' },
        { role: 'user', content: [{ type: 'text', text: '<memory-context>Continue.</memory-context>' }] },
      ],
    });
    expect(prompt[0].content).toBe('Use <system-reminder> tags.');
  });

  it('strips reasoning parts from the prompt on cerebras', async () => {
    const handler = new ProviderHistoryCompat();
    const args = makeRequestArgs(promptWithReasoning(), {
      provider: 'cerebras.chat',
      modelId: 'zai-glm-4.7',
    });

    const result = await handler.processLLMRequest(args);

    expect(result).toEqual({ prompt: expect.any(Array) });
    const assistant = (result as { prompt: LanguageModelV2Prompt }).prompt.find(m => m.role === 'assistant')!;
    expect((assistant.content as any[]).map(p => p.type)).toEqual(['text']);
  });

  it('strips foreign reasoning parts from the prompt on Anthropic', async () => {
    const handler = new ProviderHistoryCompat();
    const args = makeRequestArgs(promptWithReasoning(), {
      provider: 'anthropic.messages',
      modelId: 'claude-haiku-4-5-20251001',
    });

    const result = await handler.processLLMRequest(args);

    expect(result).toEqual({ prompt: expect.any(Array) });
    const assistant = (result as { prompt: LanguageModelV2Prompt }).prompt.find(m => m.role === 'assistant')!;
    expect((assistant.content as any[]).map(p => p.type)).toEqual(['text']);
  });

  it('strips foreign provider-executed tool pairs through the built-in rule set', async () => {
    const handler = new ProviderHistoryCompat();
    const prompt: LanguageModelV2Prompt = [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Before' },
          {
            type: 'tool-call',
            toolCallId: 'srvtoolu_123',
            toolName: 'web_search',
            input: { query: 'weather' },
            providerExecuted: true,
            providerOptions: { anthropic: { type: 'server_tool_use' } },
          },
          { type: 'text', text: 'After' },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'srvtoolu_123',
            toolName: 'web_search',
            output: { type: 'json', value: { temperature: 72 } },
            providerOptions: { anthropic: { type: 'web_search_tool_result' } },
          },
        ],
      },
    ];

    const result = await handler.processLLMRequest(
      makeRequestArgs(prompt, { provider: 'openai.responses', modelId: 'gpt-5' }),
    );

    expect(result).toEqual({
      prompt: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Before' },
            { type: 'text', text: 'After' },
          ],
        },
      ],
    });
  });

  it('returns undefined when nothing needs to change', async () => {
    const handler = new ProviderHistoryCompat();
    const prompt: LanguageModelV2Prompt = [
      { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_1',
            toolName: 'search',
            input: {},
          },
        ],
      },
    ];
    const args = makeRequestArgs(prompt, { provider: 'cerebras.chat', modelId: 'zai-glm-4.7' });
    expect(await handler.processLLMRequest(args)).toBeUndefined();
  });

  it('returns undefined for non-cerebras models even if reasoning is present', async () => {
    const handler = new ProviderHistoryCompat();
    const args = makeRequestArgs(promptWithReasoning(), {
      provider: 'openai.chat',
      modelId: 'gpt-4o',
    });
    expect(await handler.processLLMRequest(args)).toBeUndefined();
  });

  it('strips reasoning when a generic provider object has a cerebras-prefixed modelId', async () => {
    const handler = new ProviderHistoryCompat();
    const args = makeRequestArgs(promptWithReasoning(), {
      provider: 'openai-compatible.chat',
      modelId: 'cerebras/zai-glm-4.7',
    });

    const result = await handler.processLLMRequest(args);

    expect(result).toEqual({ prompt: expect.any(Array) });
    const assistant = (result as { prompt: LanguageModelV2Prompt }).prompt.find(m => m.role === 'assistant')!;
    expect((assistant.content as any[]).map(p => p.type)).toEqual(['text']);
  });

  it('runs custom prompt compat rules after built-in prompt rewrites', async () => {
    const customRule: CompatRule = {
      name: 'custom-mark-provider-prompt',
      applyToPrompt: ({ prompt, model }) => {
        const assistant = prompt.find(m => m.role === 'assistant')!;
        expect((assistant.content as any[]).map(p => p.type)).toEqual(['text']);
        return [
          ...prompt,
          {
            role: 'user',
            content: [{ type: 'text', text: `custom:${(model as any).provider}` }],
          },
        ];
      },
    };
    const handler = new ProviderHistoryCompat({ additionalRules: [customRule] });
    const args = makeRequestArgs(promptWithReasoning(), {
      provider: 'cerebras.chat',
      modelId: 'zai-glm-4.7',
    });

    const result = await handler.processLLMRequest(args);

    expect(result).toEqual({ prompt: expect.any(Array) });
    expect((result as { prompt: LanguageModelV2Prompt }).prompt.at(-1)).toEqual({
      role: 'user',
      content: [{ type: 'text', text: 'custom:cerebras.chat' }],
    });
  });
});

describe('ProcessorRunner.runProcessLLMRequest', () => {
  it('runs ProviderHistoryCompat when explicitly configured', async () => {
    const runner = new ProcessorRunner({
      inputProcessors: [new ProviderHistoryCompat()],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    const result = await runner.runProcessLLMRequest({
      prompt: promptWithReasoning(),
      model: { provider: 'openai-compatible.chat', modelId: 'cerebras/zai-glm-4.7' },
      stepNumber: 0,
      steps: [],
    });

    const assistant = result.prompt.find(m => m.role === 'assistant')!;
    expect((assistant.content as any[]).map(p => p.type)).toEqual(['text']);
  });

  it('does not auto-inject ProviderHistoryCompat for provider models', async () => {
    const runner = new ProcessorRunner({
      inputProcessors: [],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    const result = await runner.runProcessLLMRequest({
      prompt: promptWithReasoning(),
      model: { provider: 'anthropic.messages', modelId: 'claude-haiku-4-5-20251001' },
      stepNumber: 0,
      steps: [],
    });

    const assistant = result.prompt.find(m => m.role === 'assistant')!;
    expect((assistant.content as any[]).map(p => p.type)).toEqual(['reasoning', 'text']);
  });
});
