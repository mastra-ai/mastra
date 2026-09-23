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
  isMaybeGoogleWithoutTrailingModelTurn,
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

describe('isMaybeGoogleWithoutTrailingModelTurn', () => {
  it('matches Gemini 3 and later Google, Vertex, and gateway-routed models', () => {
    expect(
      isMaybeGoogleWithoutTrailingModelTurn({ provider: 'google.generative-ai', modelId: 'gemini-3.5-flash-lite' }),
    ).toBe(true);
    expect(
      isMaybeGoogleWithoutTrailingModelTurn({ provider: 'vertex-ai.google-ai', modelId: 'gemini-3.1-pro-preview' }),
    ).toBe(true);
    expect(isMaybeGoogleWithoutTrailingModelTurn('google/gemini-3-pro-preview')).toBe(true);
    expect(
      isMaybeGoogleWithoutTrailingModelTurn({ provider: 'openrouter.chat', modelId: 'google/gemini-3.5-flash-lite' }),
    ).toBe(true);
  });

  it('does not match Gemini 2.x, which accepts a trailing model turn', () => {
    expect(
      isMaybeGoogleWithoutTrailingModelTurn({ provider: 'google.generative-ai', modelId: 'gemini-2.5-flash' }),
    ).toBe(false);
    expect(isMaybeGoogleWithoutTrailingModelTurn('google/gemini-2.0-flash')).toBe(false);
  });

  it('does not match non-Google models, including Google models behind another provider', () => {
    expect(isMaybeGoogleWithoutTrailingModelTurn({ provider: 'openai.chat', modelId: 'gpt-5' })).toBe(false);
    expect(isMaybeGoogleWithoutTrailingModelTurn({ provider: 'anthropic.messages', modelId: 'claude-opus-5' })).toBe(
      false,
    );
    expect(
      isMaybeGoogleWithoutTrailingModelTurn({ provider: 'openai.chat', modelId: 'google/gemini-3.5-flash-lite' }),
    ).toBe(false);
  });

  it('uses a conservative result for unresolved Google model versions and fallback arrays', () => {
    expect(isMaybeGoogleWithoutTrailingModelTurn({ provider: 'google.generative-ai' })).toBe(true);
    expect(
      isMaybeGoogleWithoutTrailingModelTurn({ provider: 'google.generative-ai', modelId: 'gemini-next-flash' }),
    ).toBe(true);
    expect(isMaybeGoogleWithoutTrailingModelTurn(() => 'google/gemini-3.5-flash-lite')).toBe(true);
    expect(
      isMaybeGoogleWithoutTrailingModelTurn([
        { model: 'google/gemini-2.5-flash' },
        { model: 'google/gemini-3.5-flash-lite' },
      ]),
    ).toBe(true);
    expect(isMaybeGoogleWithoutTrailingModelTurn([{ model: 'google/gemini-2.5-flash' }])).toBe(false);
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

// ---------------------------------------------------------------------------
// anthropic-strip-foreign-signed-reasoning (reactive cross-provider backstop)
// ---------------------------------------------------------------------------

describe('anthropicStripForeignSignedReasoning', () => {
  const KIMI = 'kimi-for-coding';
  const ANTHROPIC = 'anthropic.messages';

  /** A persisted assistant turn with signed thinking, stamped with the provider that produced it. */
  const stampedSignedAssistant = (
    provider: string,
    options: { signature?: string; redactedData?: string; text?: string } = {},
  ) => {
    const anthropic: Record<string, unknown> = {};
    if (options.signature !== undefined) anthropic.signature = options.signature;
    if (options.redactedData !== undefined) anthropic.redactedData = options.redactedData;
    const text = options.text ?? 'thinking that was signed';
    return {
      id: `msg-${provider}-${options.signature ?? options.redactedData ?? 'unsigned'}`,
      role: 'assistant' as const,
      content: {
        format: 2 as const,
        metadata: { provider },
        parts: [
          {
            // Canonical V2 stored reasoning shape (AIV5Adapter writes
            // `reasoning` + `details`, not `text`).
            type: 'reasoning' as const,
            reasoning: text,
            details: [{ type: 'text' as const, text }],
            ...(Object.keys(anthropic).length > 0 ? { providerMetadata: { anthropic } } : {}),
          },
          { type: 'text' as const, text: 'the visible answer' },
        ],
      },
      createdAt: new Date(),
    };
  };

  /** A persisted assistant turn that holds ONLY signed thinking (no visible text). */
  const thinkingOnlyAssistant = (provider: string, signature: string) => {
    const message = stampedSignedAssistant(provider, { signature }) as any;
    message.id = `msg-${provider}-thinking-only-${signature}`;
    message.content.parts = message.content.parts.filter((p: any) => p.type === 'reasoning');
    return message;
  };

  describe('preemptive applyToPrompt', () => {
    const promptSignatures = (prompt: LanguageModelV2Prompt) =>
      prompt.flatMap(message =>
        Array.isArray(message.content)
          ? message.content
              .filter(part => part.type === 'reasoning')
              .map(
                part =>
                  (part as { providerOptions?: { anthropic?: { signature?: unknown; redactedData?: unknown } } })
                    .providerOptions?.anthropic,
              )
              .flatMap(anthropic => [anthropic?.signature ?? anthropic?.redactedData])
          : [],
      );

    const promptAssistantContent = (prompt: LanguageModelV2Prompt) =>
      prompt.filter(message => message.role === 'assistant').flatMap(message => message.content as any[]);

    const runRequest = (handler: ProviderHistoryCompat, messageList: MessageList, provider: string) =>
      handler.processLLMRequest({
        ...makeRequestArgs(messageList.get.all.aiV5.prompt(), { provider }),
        messageList,
      });

    it('drops foreign signed reasoning from the outbound prompt (kimi turn, anthropic target)', async () => {
      const handler = new ProviderHistoryCompat();
      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([stampedSignedAssistant(KIMI, { signature: 'kimi-sig' })], 'response');
      messageList.add([createUserMessage('continue on claude')], 'input');

      const result = await runRequest(handler, messageList, ANTHROPIC);

      expect(result).toEqual({ prompt: expect.any(Array) });
      const prompt = (result as { prompt: LanguageModelV2Prompt }).prompt;
      expect(promptSignatures(prompt)).toEqual([]);
      // The visible text of the foreign turn is kept.
      expect(promptAssistantContent(prompt).map(part => part.type)).toEqual(['text']);
    });

    it('drops foreign signed reasoning in the other direction (anthropic turn, kimi target)', async () => {
      const handler = new ProviderHistoryCompat();
      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([stampedSignedAssistant(ANTHROPIC, { signature: 'anthropic-sig' })], 'response');
      messageList.add([createUserMessage('continue on kimi')], 'input');

      const result = await runRequest(handler, messageList, KIMI);

      expect(result).toEqual({ prompt: expect.any(Array) });
      expect(promptSignatures((result as { prompt: LanguageModelV2Prompt }).prompt)).toEqual([]);
    });

    it('keeps the target provider’s own signed reasoning', async () => {
      const handler = new ProviderHistoryCompat();
      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([stampedSignedAssistant(ANTHROPIC, { signature: 'anthropic-sig' })], 'response');
      messageList.add([createUserMessage('keep going')], 'input');

      const result = await runRequest(handler, messageList, ANTHROPIC);

      expect(result).toBeUndefined();
    });

    it('drops only the foreign turn when providers are interleaved', async () => {
      const handler = new ProviderHistoryCompat();
      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([stampedSignedAssistant(KIMI, { signature: 'kimi-sig' })], 'response');
      messageList.add([createUserMessage('switch to claude')], 'input');
      messageList.add([stampedSignedAssistant(ANTHROPIC, { signature: 'anthropic-sig' })], 'response');
      messageList.add([createUserMessage('keep going on claude')], 'input');

      const result = await runRequest(handler, messageList, ANTHROPIC);

      const prompt = (result as { prompt: LanguageModelV2Prompt }).prompt;
      expect(promptSignatures(prompt)).toEqual(['anthropic-sig']);
    });

    it('drops foreign redactedData blocks the same way', async () => {
      const handler = new ProviderHistoryCompat();
      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([stampedSignedAssistant(KIMI, { redactedData: 'kimi-redacted' })], 'response');
      messageList.add([createUserMessage('continue on claude')], 'input');

      const result = await runRequest(handler, messageList, ANTHROPIC);

      expect(promptSignatures((result as { prompt: LanguageModelV2Prompt }).prompt)).toEqual([]);
    });

    it('drops foreign signed reasoning on the trailing assistant turn too (no protected-index exemption)', async () => {
      const handler = new ProviderHistoryCompat();
      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createUserMessage('do a thing on kimi')], 'input');
      messageList.add([stampedSignedAssistant(KIMI, { signature: 'kimi-sig' })], 'response');

      const result = await runRequest(handler, messageList, ANTHROPIC);

      expect(promptSignatures((result as { prompt: LanguageModelV2Prompt }).prompt)).toEqual([]);
    });

    it('removes a turn emptied of all content by the drop (Anthropic rejects empty assistant content)', async () => {
      const handler = new ProviderHistoryCompat();
      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([thinkingOnlyAssistant(KIMI, 'kimi-sig')], 'response');
      messageList.add([createUserMessage('continue on claude')], 'input');

      const result = await runRequest(handler, messageList, ANTHROPIC);

      const prompt = (result as { prompt: LanguageModelV2Prompt }).prompt;
      // The thinking-only foreign turn loses its only part; the message itself
      // must be removed rather than sent with `content: []`.
      expect(prompt.filter(message => message.role === 'assistant')).toEqual([]);
    });

    it('leaves unstamped history untouched', async () => {
      const handler = new ProviderHistoryCompat();
      const messageList = new MessageList({ threadId: 'test-thread' });
      const unstamped = stampedSignedAssistant(KIMI, { signature: 'legacy-sig' }) as any;
      delete unstamped.content.metadata.provider;
      messageList.add([unstamped], 'response');
      messageList.add([createUserMessage('continue on claude')], 'input');

      const result = await runRequest(handler, messageList, ANTHROPIC);

      // Nothing provably foreign -> no change from this rule. (Other rules
      // keep the anthropic-keyed reasoning too.)
      expect(result).toBeUndefined();
    });

    it('does nothing without a message list', async () => {
      const handler = new ProviderHistoryCompat();
      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([stampedSignedAssistant(KIMI, { signature: 'kimi-sig' })], 'response');
      messageList.add([createUserMessage('continue on claude')], 'input');

      const result = await handler.processLLMRequest(
        makeRequestArgs(messageList.get.all.aiV5.prompt(), { provider: ANTHROPIC }),
      );

      expect(result).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// openai-orphan-item-id (#22291)
// ---------------------------------------------------------------------------

describe('openaiOrphanItemId', () => {
  const ORPHAN_ID = 'msg_68ab1c9f0orphan';
  const REASONING_ID = 'rs_68ab1c9f0reason';

  /** The real OpenAI 400 from #22291. */
  function createOrphanItemError() {
    const message =
      `Item '${ORPHAN_ID}' of type 'message' was provided without its required ` +
      `'reasoning' item: '${REASONING_ID}'.`;
    return new APICallError({
      message,
      url: 'https://api.openai.com/v1/responses',
      requestBodyValues: {},
      statusCode: 400,
      responseBody: JSON.stringify({ error: { message, type: 'invalid_request_error', code: null } }),
      isRetryable: false,
    });
  }

  /** The sibling `fc_…` variant already fixed by #19408 — must NOT match this rule. */
  function createOrphanFunctionCallError() {
    const message =
      `Item 'fc_68ab1c9f0tool' of type 'function_call' was provided without its required ` +
      `'reasoning' item: '${REASONING_ID}'.`;
    return new APICallError({
      message,
      url: 'https://api.openai.com/v1/responses',
      requestBodyValues: {},
      statusCode: 400,
      responseBody: JSON.stringify({ error: { message, type: 'invalid_request_error' } }),
      isRetryable: false,
    });
  }

  /** Assistant message carrying an OpenAI itemId on its text part and no reasoning part. */
  function orphanAssistant(itemId: string = ORPHAN_ID) {
    return {
      id: `msg-orphan-${itemId}`,
      role: 'assistant' as const,
      content: {
        format: 2 as const,
        parts: [
          {
            type: 'text' as const,
            text: 'Lyon has a population of 522,969.',
            providerMetadata: {
              openai: {
                itemId,
                cachedPromptTokens: 1024,
                reasoningTokens: 256,
                logprobs: [{ token: 'Lyon', logprob: -0.01 }],
              },
            },
          },
        ],
      },
      createdAt: new Date(),
    };
  }

  /** A healthy assistant message: itemId present AND a reasoning part alongside it. */
  function healthyAssistant() {
    return {
      id: 'msg-healthy',
      role: 'assistant' as const,
      content: {
        format: 2 as const,
        parts: [
          {
            type: 'reasoning' as const,
            text: 'Recall the population figure.',
            providerMetadata: { openai: { itemId: REASONING_ID } },
          },
          {
            type: 'text' as const,
            text: 'About 522,969.',
            providerMetadata: { openai: { itemId: 'msg_healthy_text' } },
          },
        ],
      },
      createdAt: new Date(),
    };
  }

  function orphanArgs(
    build: (list: MessageList) => void,
    overrides: Partial<ProcessAPIErrorArgs> = {},
  ): ProcessAPIErrorArgs {
    const messageList = new MessageList({ threadId: 'test-thread' });
    build(messageList);
    return {
      error: createOrphanItemError(),
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

  function textPartMetadata(args: ProcessAPIErrorArgs, messageId: string) {
    const msg = args.messageList.get.all.db().find(m => m.id === messageId);
    const part = msg!.content.parts.find(p => p.type === 'text');
    return (part as { providerMetadata?: { openai?: Record<string, unknown> } }).providerMetadata?.openai;
  }

  // --- SC4: the corrupted history recovers instead of hard-failing -----------

  it('A1: signals a retry when OpenAI rejects an orphaned message item', async () => {
    const handler = new ProviderHistoryCompat();
    const args = orphanArgs(list => {
      list.add([createUserMessage('population of Lyon?')], 'input');
      list.add([orphanAssistant()], 'memory');
      list.add([createUserMessage('and Paris?')], 'input');
    });

    const result = await handler.processAPIError(args);

    expect(result).toEqual({ retry: true });
  });

  it('A2: strips the orphaned itemId so the replay no longer sends an item_reference', async () => {
    const handler = new ProviderHistoryCompat();
    const args = orphanArgs(list => {
      list.add([createUserMessage('population of Lyon?')], 'input');
      list.add([orphanAssistant()], 'memory');
      list.add([createUserMessage('and Paris?')], 'input');
    });

    await handler.processAPIError(args);

    expect(textPartMetadata(args, `msg-orphan-${ORPHAN_ID}`)).not.toHaveProperty('itemId');
  });

  // --- SC5: nothing else under providerMetadata.openai is collateral --------

  it('A3: preserves every other providerMetadata.openai field', async () => {
    const handler = new ProviderHistoryCompat();
    const args = orphanArgs(list => {
      list.add([createUserMessage('population of Lyon?')], 'input');
      list.add([orphanAssistant()], 'memory');
      list.add([createUserMessage('and Paris?')], 'input');
    });

    await handler.processAPIError(args);

    expect(textPartMetadata(args, `msg-orphan-${ORPHAN_ID}`)).toEqual({
      cachedPromptTokens: 1024,
      reasoningTokens: 256,
      logprobs: [{ token: 'Lyon', logprob: -0.01 }],
    });
  });

  // --- Blast-radius guards --------------------------------------------------

  it('A4: leaves a healthy itemId+reasoning message untouched', async () => {
    const handler = new ProviderHistoryCompat();
    const args = orphanArgs(list => {
      list.add([createUserMessage('population of Lyon?')], 'input');
      list.add([healthyAssistant()], 'memory');
      list.add([createUserMessage('and Paris?')], 'input');
    });

    await handler.processAPIError(args);

    expect(textPartMetadata(args, 'msg-healthy')).toEqual({ itemId: 'msg_healthy_text' });
  });

  it('A5: does not fire on a rate-limit error', async () => {
    const handler = new ProviderHistoryCompat();
    const args = orphanArgs(
      list => {
        list.add([createUserMessage('population of Lyon?')], 'input');
        list.add([orphanAssistant()], 'memory');
        list.add([createUserMessage('and Paris?')], 'input');
      },
      { error: createRateLimitError() },
    );

    const result = await handler.processAPIError(args);

    expect(result).toBeUndefined();
    expect(textPartMetadata(args, `msg-orphan-${ORPHAN_ID}`)).toHaveProperty('itemId', ORPHAN_ID);
  });

  it('A6: does not claim the fc_… variant already handled by #19408', async () => {
    const handler = new ProviderHistoryCompat();
    const args = orphanArgs(
      list => {
        list.add([createUserMessage('population of Lyon?')], 'input');
        list.add([orphanAssistant()], 'memory');
        list.add([createUserMessage('and Paris?')], 'input');
      },
      { error: createOrphanFunctionCallError() },
    );

    const result = await handler.processAPIError(args);

    expect(result).toBeUndefined();
    expect(textPartMetadata(args, `msg-orphan-${ORPHAN_ID}`)).toHaveProperty('itemId', ORPHAN_ID);
  });

  it('A7b: repairs the orphan anyway when the preceding assistant row already paired its own reasoning with its own text', async () => {
    // A preceding row that is self-consistent is not cover for the row after it. Treating it as
    // cover would leave a genuine orphan unrepaired, and the retry would hit the same 400 with
    // retryCount === 1 -- a hard failure instead of a recovery.
    const handler = new ProviderHistoryCompat();
    const args = orphanArgs(list => {
      list.add([createUserMessage('population of Lyon?')], 'input');
      list.add([healthyAssistant()], 'memory');
      list.add([orphanAssistant()], 'memory');
      list.add([createUserMessage('and Paris?')], 'input');
    });

    const result = await handler.processAPIError(args);

    expect(result).toEqual({ retry: true });
    expect(textPartMetadata(args, `msg-orphan-${ORPHAN_ID}`)).not.toHaveProperty('itemId');
    // ...and the healthy row is still untouched.
    expect(textPartMetadata(args, 'msg-healthy')).toEqual({ itemId: 'msg_healthy_text' });
  });

  it('A8: repairs every orphan-shaped message in a mixed history, and only those', async () => {
    const handler = new ProviderHistoryCompat();
    const args = orphanArgs(list => {
      list.add([createUserMessage('population of Lyon?')], 'input');
      list.add([healthyAssistant()], 'memory');
      list.add([createUserMessage('and Paris?')], 'input');
      list.add([orphanAssistant()], 'memory');
      list.add([createUserMessage('and Rome?')], 'input');
      list.add([orphanAssistant('msg_second_orphan')], 'memory');
      list.add([createUserMessage('and Oslo?')], 'input');
    });

    await handler.processAPIError(args);

    expect(textPartMetadata(args, `msg-orphan-${ORPHAN_ID}`)).not.toHaveProperty('itemId');
    expect(textPartMetadata(args, 'msg-orphan-msg_second_orphan')).not.toHaveProperty('itemId');
    expect(textPartMetadata(args, 'msg-healthy')).toEqual({ itemId: 'msg_healthy_text' });
  });

  it('A9: strips every orphaned text part on a multi-part message', async () => {
    const handler = new ProviderHistoryCompat();
    const args = orphanArgs(list => {
      list.add([createUserMessage('population of Lyon?')], 'input');
      list.add(
        [
          {
            id: 'msg-multi',
            role: 'assistant' as const,
            content: {
              format: 2 as const,
              parts: [
                { type: 'text' as const, text: 'first', providerMetadata: { openai: { itemId: 'msg_a', usage: 1 } } },
                { type: 'text' as const, text: 'second', providerMetadata: { openai: { itemId: 'msg_b', usage: 2 } } },
              ],
            },
            createdAt: new Date(),
          },
        ],
        'memory',
      );
      list.add([createUserMessage('and Paris?')], 'input');
    });

    await handler.processAPIError(args);

    const parts = args.messageList.get.all.db().find(m => m.id === 'msg-multi')!.content.parts;
    expect(parts.map((p: any) => p.providerMetadata.openai)).toEqual([{ usage: 1 }, { usage: 2 }]);
  });

  it('A10: does not fire on an unrelated 400', async () => {
    const handler = new ProviderHistoryCompat();
    const unrelated400 = new APICallError({
      message: "Invalid value for 'temperature': expected a number between 0 and 2",
      url: 'https://api.openai.com/v1/responses',
      requestBodyValues: {},
      statusCode: 400,
      responseBody: JSON.stringify({ error: { message: 'Invalid value for temperature' } }),
      isRetryable: false,
    });
    const args = orphanArgs(
      list => {
        list.add([createUserMessage('population of Lyon?')], 'input');
        list.add([orphanAssistant()], 'memory');
        list.add([createUserMessage('and Paris?')], 'input');
      },
      { error: unrelated400 },
    );

    const result = await handler.processAPIError(args);

    expect(result).toBeUndefined();
    expect(textPartMetadata(args, `msg-orphan-${ORPHAN_ID}`)).toHaveProperty('itemId', ORPHAN_ID);
  });

  it('A11: documents the collateral — a valid reasoning-free message in a mixed history also loses its itemId', async () => {
    // A non-reasoning Responses model produces messages that are orphan-shaped but perfectly
    // valid. Since `fix` never sees the error, it cannot tell them apart, so they are stripped
    // too. They still replay correctly, by value rather than by reference: what is lost is the
    // item reference, not the turn. Under-stripping, by contrast, ends it.
    const handler = new ProviderHistoryCompat();
    const args = orphanArgs(list => {
      list.add([createUserMessage('earlier, on a non-reasoning model')], 'input');
      list.add([orphanAssistant('msg_from_gpt41')], 'memory');
      list.add([createUserMessage('population of Lyon?')], 'input');
      list.add([orphanAssistant()], 'memory');
      list.add([createUserMessage('and Paris?')], 'input');
    });

    await handler.processAPIError(args);

    expect(textPartMetadata(args, 'msg-orphan-msg_from_gpt41')).not.toHaveProperty('itemId');
  });

  it('A12: documents the guard false-negative — an orphan behind an unrelated reasoning row is left alone', async () => {
    // The guard reasons about shape, because the required `rs_…` id named in the error is not
    // available to `fix`. An unrelated reasoning-only row therefore reads as cover and the
    // orphan is skipped. That degrades to today's behavior (the turn fails as it already does);
    // it cannot cause a failure that was not already happening.
    const handler = new ProviderHistoryCompat();
    const args = orphanArgs(list => {
      list.add([createUserMessage('population of Lyon?')], 'input');
      list.add(
        [
          {
            id: 'msg-unrelated-reasoning',
            role: 'assistant' as const,
            content: {
              format: 2 as const,
              parts: [
                {
                  type: 'reasoning' as const,
                  text: 'unrelated',
                  providerMetadata: { openai: { itemId: 'rs_unrelated' } },
                },
              ],
            },
            createdAt: new Date(),
          },
        ],
        'memory',
      );
      list.add([orphanAssistant()], 'memory');
      list.add([createUserMessage('and Paris?')], 'input');
    });

    await handler.processAPIError(args);

    expect(textPartMetadata(args, `msg-orphan-${ORPHAN_ID}`)).toHaveProperty('itemId', ORPHAN_ID);
  });

  it('A7: split-history guard — keeps the itemId when the reasoning sits on the preceding assistant message', async () => {
    const handler = new ProviderHistoryCompat();
    const args = orphanArgs(list => {
      list.add([createUserMessage('population of Lyon?')], 'input');
      list.add(
        [
          {
            id: 'msg-split-reasoning',
            role: 'assistant' as const,
            content: {
              format: 2 as const,
              parts: [
                {
                  type: 'reasoning' as const,
                  text: 'Recall the figure.',
                  providerMetadata: { openai: { itemId: REASONING_ID } },
                },
              ],
            },
            createdAt: new Date(),
          },
        ],
        'memory',
      );
      list.add([orphanAssistant('msg_split_text')], 'memory');
      list.add([createUserMessage('and Paris?')], 'input');
    });

    await handler.processAPIError(args);

    expect(textPartMetadata(args, 'msg-orphan-msg_split_text')).toHaveProperty('itemId', 'msg_split_text');
  });

  it('A13: the fix is idempotent — a second call over already-stripped history asks for no retry', async () => {
    // The rule reports a mutation only when it actually stripped something. A `fix` that reported
    // one unconditionally would ask for a retry that cannot change the request, so pin it: once the
    // itemIds are gone, a further call over the same history is silent.
    const handler = new ProviderHistoryCompat();
    const args = orphanArgs(list => {
      list.add([createUserMessage('population of Lyon?')], 'input');
      list.add([orphanAssistant()], 'memory');
      list.add([createUserMessage('and Paris?')], 'input');
    });

    const first = await handler.processAPIError(args);
    const second = await handler.processAPIError(args);

    expect(first).toEqual({ retry: true });
    expect(second).toBeUndefined();
    expect(textPartMetadata(args, `msg-orphan-${ORPHAN_ID}`)).not.toHaveProperty('itemId');
  });

  // --- Every item reference on the orphan, not only the text one ------------

  it('A14: strips the item id from a tool-invocation part on the same orphaned message', async () => {
    // The error names the `msg_…` item, but the tool call beside it is orphaned for the same
    // reason. Leaving its `fc_…` reference behind spends the one available retry to arrive at
    // the same 400, one item further down the list.
    const handler = new ProviderHistoryCompat();
    const args = orphanArgs(list => {
      list.add([createUserMessage('population of Lyon?')], 'input');
      list.add(
        [
          {
            id: 'msg-orphan-mixed',
            role: 'assistant' as const,
            content: {
              format: 2 as const,
              parts: [
                {
                  type: 'tool-invocation' as const,
                  toolInvocation: {
                    state: 'result' as const,
                    toolCallId: 'call-1',
                    toolName: 'lookup',
                    args: {},
                    result: { population: 522969 },
                  },
                  providerMetadata: { openai: { itemId: 'fc_orphaned' } },
                },
                {
                  type: 'text' as const,
                  text: 'About 522,969.',
                  providerMetadata: { openai: { itemId: 'msg_orphaned' } },
                },
              ],
            },
            createdAt: new Date(),
          },
        ],
        'memory',
      );
      list.add([createUserMessage('and Paris?')], 'input');
    });

    const result = await handler.processAPIError(args);
    const parts = args.messageList.get.all.db().find(m => m.id === 'msg-orphan-mixed')!.content.parts;
    const metadataOf = (type: string) =>
      (parts.find(p => p.type === type) as { providerMetadata?: { openai?: Record<string, unknown> } }).providerMetadata
        ?.openai;

    expect(result).toEqual({ retry: true });
    expect(metadataOf('tool-invocation')).not.toHaveProperty('itemId');
    expect(metadataOf('text')).not.toHaveProperty('itemId');
  });

  it('A15: repairs an Azure-namespaced orphan on the same footing as an OpenAI one', async () => {
    // Azure serves the same Responses API and raises the same 400; the repo treats the two as
    // one family (`RESPONSE_ITEM_ID_PROVIDERS`), so reading and stripping go through the shared
    // helpers rather than a hard-coded `openai` key.
    const handler = new ProviderHistoryCompat();
    const args = orphanArgs(list => {
      list.add([createUserMessage('population of Lyon?')], 'input');
      list.add(
        [
          {
            id: 'msg-orphan-azure',
            role: 'assistant' as const,
            content: {
              format: 2 as const,
              parts: [
                {
                  type: 'text' as const,
                  text: 'About 522,969.',
                  providerMetadata: { azure: { itemId: 'msg_azure', cachedPromptTokens: 1024 } },
                },
              ],
            },
            createdAt: new Date(),
          },
        ],
        'memory',
      );
      list.add([createUserMessage('and Paris?')], 'input');
    });

    const result = await handler.processAPIError(args);
    const part = args.messageList.get.all.db().find(m => m.id === 'msg-orphan-azure')!.content.parts[0];
    const azure = (part as { providerMetadata?: { azure?: Record<string, unknown> } }).providerMetadata?.azure;

    expect(result).toEqual({ retry: true });
    expect(azure).toEqual({ cachedPromptTokens: 1024 });
  });

  it('A16: strips ids from both metadata containers on the same part', async () => {
    // The shared lookup reads an id from either container, so a part repaired in only one of
    // them would still report as item-bearing — and would still send the reference that failed.
    const handler = new ProviderHistoryCompat();
    const args = orphanArgs(list => {
      list.add([createUserMessage('population of Lyon?')], 'input');
      list.add(
        [
          {
            id: 'msg-orphan-options',
            role: 'assistant' as const,
            content: {
              format: 2 as const,
              parts: [
                {
                  type: 'text' as const,
                  text: 'About 522,969.',
                  providerMetadata: { openai: { itemId: 'msg_via_metadata', cachedPromptTokens: 1024 } },
                  providerOptions: { openai: { itemId: 'msg_via_options', reasoningTokens: 256 } },
                } as any,
              ],
            },
            createdAt: new Date(),
          },
        ],
        'memory',
      );
      list.add([createUserMessage('and Paris?')], 'input');
    });

    const result = await handler.processAPIError(args);
    const part = args.messageList.get.all.db().find(m => m.id === 'msg-orphan-options')!.content.parts[0] as {
      providerMetadata?: { openai?: Record<string, unknown> };
      providerOptions?: { openai?: Record<string, unknown> };
    };

    expect(result).toEqual({ retry: true });
    expect(part.providerMetadata?.openai).toEqual({ cachedPromptTokens: 1024 });
    expect(part.providerOptions?.openai).toEqual({ reasoningTokens: 256 });
  });

  it('A17: clears the result half of a tool pair, not just the call id', async () => {
    // A merged tool part keeps the result item under `resultItemId`, and
    // `splitResponsesToolItemReferences` turns that back into an `itemId` on the tool-result
    // part during conversion. Stripping only the call id would leave a live reference into the
    // response that was just rejected, and the repaired request would fail the same way.
    const handler = new ProviderHistoryCompat();
    const args = orphanArgs(list => {
      list.add([createUserMessage('population of Lyon?')], 'input');
      list.add(
        [
          {
            id: 'msg-orphan-pair',
            role: 'assistant' as const,
            content: {
              format: 2 as const,
              parts: [
                {
                  type: 'tool-invocation' as const,
                  toolInvocation: {
                    state: 'result' as const,
                    toolCallId: 'call-1',
                    toolName: 'tool_search',
                    args: {},
                    result: { hits: [] },
                  },
                  providerMetadata: { openai: { itemId: 'tso_call', resultItemId: 'tso_result' } },
                },
                {
                  type: 'tool-invocation' as const,
                  toolInvocation: {
                    state: 'result' as const,
                    toolCallId: 'call-2',
                    toolName: 'tool_search',
                    args: {},
                    result: { hits: [] },
                  },
                  providerOptions: { azure: { itemId: 'tso_call_2', resultItemId: 'tso_result_2' } },
                } as any,
              ],
            },
            createdAt: new Date(),
          },
        ],
        'memory',
      );
      list.add([createUserMessage('and Paris?')], 'input');
    });

    const result = await handler.processAPIError(args);
    const parts = args.messageList.get.all.db().find(m => m.id === 'msg-orphan-pair')!.content.parts;
    const openai = (parts[0] as { providerMetadata?: { openai?: Record<string, unknown> } }).providerMetadata?.openai;
    const azure = (parts[1] as { providerOptions?: { azure?: Record<string, unknown> } }).providerOptions?.azure;

    expect(result).toEqual({ retry: true });
    for (const namespace of [openai, azure]) {
      expect(namespace).not.toHaveProperty('itemId');
      expect(namespace).not.toHaveProperty('resultItemId');
    }
  });
});
