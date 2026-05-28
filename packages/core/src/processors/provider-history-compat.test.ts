import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { APICallError } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';
import { MessageList } from '../agent/message-list';
import {
  sanitizeOrphanedToolPairs,
  anthropicStripForeignReasoningContent,
  anthropicToolResultInput,
  cerebrasStripReasoningContent,
  geminiEnsureFirstUserMessage,
  isMaybeAnthropic,
  isMaybeCerebras,
  isMaybeGoogle,
  ProviderHistoryCompat,
} from './provider-history-compat';
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

// ---------------------------------------------------------------------------
// isMaybeGoogle
// ---------------------------------------------------------------------------

describe('isMaybeGoogle', () => {
  it('matches google provider object', () => {
    expect(isMaybeGoogle({ provider: 'google', modelId: 'gemini-2.0-flash' })).toBe(true);
    expect(isMaybeGoogle({ provider: 'google.generativeai', modelId: 'gemini-2.5-flash' })).toBe(true);
  });

  it('matches google/ gateway prefix in string form', () => {
    expect(isMaybeGoogle('google/gemini-2.0-flash')).toBe(true);
  });

  it('matches google/ gateway prefix in modelId', () => {
    expect(isMaybeGoogle({ provider: 'openai-compatible.chat', modelId: 'google/gemini-2.0-flash' })).toBe(true);
  });

  it('does not match non-google providers', () => {
    expect(isMaybeGoogle({ provider: 'openai.chat', modelId: 'gpt-4o' })).toBe(false);
    expect(isMaybeGoogle({ provider: 'anthropic.messages', modelId: 'claude-haiku-4-5-20251001' })).toBe(false);
    expect(isMaybeGoogle({ provider: 'cerebras.chat', modelId: 'zai-glm-4.7' })).toBe(false);
  });

  it('does not match null/undefined/function', () => {
    expect(isMaybeGoogle(null)).toBe(false);
    expect(isMaybeGoogle(undefined)).toBe(false);
    expect(isMaybeGoogle(() => {})).toBe(false);
  });

  it('matches inside a fallback array', () => {
    expect(isMaybeGoogle([{ model: { provider: 'google', modelId: 'gemini-2.0-flash' } }])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// geminiEnsureFirstUserMessage
// ---------------------------------------------------------------------------

describe('geminiEnsureFirstUserMessage', () => {
  it('inserts a user message when first non-system is assistant on Google', () => {
    const prompt: LanguageModelV2Prompt = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'assistant', content: [{ type: 'text', text: 'Hello!' }] },
    ];
    const result = geminiEnsureFirstUserMessage.applyToPrompt!({
      prompt,
      model: { provider: 'google', modelId: 'gemini-2.0-flash' },
    });

    expect(result).toBeDefined();
    expect(result).toHaveLength(3);
    expect(result![0]!.role).toBe('system');
    expect(result![1]!.role).toBe('user');
    expect((result![1] as any).content).toEqual([{ type: 'text', text: '.' }]);
    expect(result![2]!.role).toBe('assistant');
  });

  it('returns undefined when first non-system is already user', () => {
    const prompt: LanguageModelV2Prompt = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'hey' }] },
    ];
    const result = geminiEnsureFirstUserMessage.applyToPrompt!({
      prompt,
      model: { provider: 'google', modelId: 'gemini-2.0-flash' },
    });
    expect(result).toBeUndefined();
  });

  it('returns undefined for non-Google models', () => {
    const prompt: LanguageModelV2Prompt = [{ role: 'assistant', content: [{ type: 'text', text: 'Hello!' }] }];
    const result = geminiEnsureFirstUserMessage.applyToPrompt!({
      prompt,
      model: { provider: 'openai.chat', modelId: 'gpt-4o' },
    });
    expect(result).toBeUndefined();
  });

  it('returns undefined for system-only prompts', () => {
    const prompt: LanguageModelV2Prompt = [{ role: 'system', content: 'sys' }];
    const result = geminiEnsureFirstUserMessage.applyToPrompt!({
      prompt,
      model: { provider: 'google', modelId: 'gemini-2.0-flash' },
    });
    expect(result).toBeUndefined();
  });

  it('returns undefined for empty prompts', () => {
    const result = geminiEnsureFirstUserMessage.applyToPrompt!({
      prompt: [],
      model: { provider: 'google', modelId: 'gemini-2.0-flash' },
    });
    expect(result).toBeUndefined();
  });

  it('handles assistant as very first message (no system)', () => {
    const prompt: LanguageModelV2Prompt = [
      { role: 'assistant', content: [{ type: 'text', text: 'hi' }] },
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
    ];
    const result = geminiEnsureFirstUserMessage.applyToPrompt!({
      prompt,
      model: { provider: 'google.generativeai', modelId: 'gemini-2.5-flash' },
    });

    expect(result).toBeDefined();
    expect(result).toHaveLength(3);
    expect(result![0]!.role).toBe('user');
    expect(result![1]!.role).toBe('assistant');
    expect(result![2]!.role).toBe('user');
  });
});

describe('ProviderHistoryCompat.processLLMRequest', () => {
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
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_1',
            toolName: 'search',
            output: { type: 'text', value: 'results' },
          },
        ],
      },
    ];
    const args = makeRequestArgs(prompt, { provider: 'cerebras.chat', modelId: 'zai-glm-4.7' });
    expect(await handler.processLLMRequest(args)).toBeUndefined();
  });

  it('returns undefined for non-cerebras/non-google models even if reasoning is present', async () => {
    const handler = new ProviderHistoryCompat();
    const args = makeRequestArgs(promptWithReasoning(), {
      provider: 'openai.chat',
      modelId: 'gpt-4o',
    });
    expect(await handler.processLLMRequest(args)).toBeUndefined();
  });

  it('inserts user message for Google model when first non-system is assistant', async () => {
    const handler = new ProviderHistoryCompat();
    const prompt: LanguageModelV2Prompt = [
      { role: 'system', content: 'sys' },
      { role: 'assistant', content: [{ type: 'text', text: 'Hello!' }] },
    ];
    const args = makeRequestArgs(prompt, {
      provider: 'google',
      modelId: 'gemini-2.0-flash',
    });

    const result = await handler.processLLMRequest(args);

    expect(result).toEqual({ prompt: expect.any(Array) });
    const p = (result as { prompt: LanguageModelV2Prompt }).prompt;
    expect(p).toHaveLength(3);
    expect(p[0]!.role).toBe('system');
    expect(p[1]!.role).toBe('user');
    expect(p[2]!.role).toBe('assistant');
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
// sanitizeOrphanedToolPairs
// ---------------------------------------------------------------------------

function assistantWithToolCallsV2(...callIds: string[]): LanguageModelV2Prompt[number] {
  return {
    role: 'assistant' as const,
    content: callIds.map(toolCallId => ({
      type: 'tool-call' as const,
      toolCallId,
      toolName: 'fetch',
      input: { url: `https://example.com/${toolCallId}` },
    })),
  };
}

function toolMessageV2(...callIds: string[]): LanguageModelV2Prompt[number] {
  return {
    role: 'tool' as const,
    content: callIds.map(toolCallId => ({
      type: 'tool-result' as const,
      toolCallId,
      toolName: 'fetch',
      output: { type: 'text' as const, value: `result-${toolCallId}` },
    })),
  };
}

const anthropicModel = { provider: 'anthropic.messages', modelId: 'claude-haiku-4-5-20251001' };
const openaiModel = { provider: 'openai.chat', modelId: 'gpt-4o' };

describe('sanitizeOrphanedToolPairs', () => {
  it('runs for all providers including non-Anthropic models', () => {
    const prompt: LanguageModelV2Prompt = [
      assistantWithToolCallsV2('orphan'),
      { role: 'user', content: [{ type: 'text', text: 'next' }] },
    ];
    const result = sanitizeOrphanedToolPairs.applyToPrompt!(makeRequestArgs(prompt, openaiModel));
    expect(result).toEqual([{ role: 'user', content: [{ type: 'text', text: 'next' }] }]);
  });

  it('returns undefined when no orphans exist', () => {
    const prompt: LanguageModelV2Prompt = [assistantWithToolCallsV2('A'), toolMessageV2('A')];
    const result = sanitizeOrphanedToolPairs.applyToPrompt!(makeRequestArgs(prompt, anthropicModel));
    expect(result).toBeUndefined();
  });

  it('drops a tool_result with no preceding tool_use', () => {
    const prompt: LanguageModelV2Prompt = [
      { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      toolMessageV2('orphan-A'),
      { role: 'assistant', content: [{ type: 'text', text: 'ok' }] },
    ];
    const result = sanitizeOrphanedToolPairs.applyToPrompt!(makeRequestArgs(prompt, anthropicModel));
    expect(result).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'ok' }] },
    ]);
  });

  it('drops an assistant message that contains only an orphan tool_use', () => {
    const prompt: LanguageModelV2Prompt = [
      assistantWithToolCallsV2('lonely-A'),
      { role: 'user', content: [{ type: 'text', text: 'next question' }] },
    ];
    const result = sanitizeOrphanedToolPairs.applyToPrompt!(makeRequestArgs(prompt, anthropicModel));
    expect(result).toEqual([{ role: 'user', content: [{ type: 'text', text: 'next question' }] }]);
  });

  it('keeps text on an assistant message after dropping its orphan tool_use', () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'thinking out loud' },
          { type: 'tool-call', toolCallId: 'orphan', toolName: 'fetch', input: {} },
        ],
      },
      { role: 'user', content: [{ type: 'text', text: 'next' }] },
    ];
    const result = sanitizeOrphanedToolPairs.applyToPrompt!(makeRequestArgs(prompt, anthropicModel));
    expect(result).toEqual([
      { role: 'assistant', content: [{ type: 'text', text: 'thinking out loud' }] },
      { role: 'user', content: [{ type: 'text', text: 'next' }] },
    ]);
  });

  it('keeps matched call and drops orphan in a parallel tool group', () => {
    const prompt: LanguageModelV2Prompt = [assistantWithToolCallsV2('A', 'B'), toolMessageV2('A')];
    const result = sanitizeOrphanedToolPairs.applyToPrompt!(makeRequestArgs(prompt, anthropicModel));
    expect(result).toEqual([assistantWithToolCallsV2('A'), toolMessageV2('A')]);
  });

  it('drops orphan tool_results in a tool message with a mix of valid and orphan ids', () => {
    const prompt: LanguageModelV2Prompt = [assistantWithToolCallsV2('A'), toolMessageV2('A', 'B')];
    const result = sanitizeOrphanedToolPairs.applyToPrompt!(makeRequestArgs(prompt, anthropicModel));
    expect(result).toEqual([assistantWithToolCallsV2('A'), toolMessageV2('A')]);
  });

  it('preserves a deferred provider-executed tool_use with no matching tool_result', () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'srv-deferred',
            toolName: 'web_search',
            input: { query: 'x' },
            providerExecuted: true,
          },
        ],
      },
      { role: 'user', content: [{ type: 'text', text: 'continue' }] },
    ];
    const result = sanitizeOrphanedToolPairs.applyToPrompt!(makeRequestArgs(prompt, anthropicModel));
    expect(result).toBeUndefined();
  });

  it('preserves inline provider-executed tool_result on assistant content', () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'srv-1', toolName: 'web_search', input: { q: 'x' } } as any,
          {
            type: 'tool-result',
            toolCallId: 'srv-1',
            toolName: 'web_search',
            output: { type: 'text', value: 'results' },
          },
          { type: 'text', text: 'done' },
        ],
      },
      { role: 'user', content: [{ type: 'text', text: 'next' }] },
    ];
    const result = sanitizeOrphanedToolPairs.applyToPrompt!(makeRequestArgs(prompt, anthropicModel));
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// anthropicToolResultInput
// ---------------------------------------------------------------------------

describe('anthropicToolResultInput', () => {
  it('is a no-op for non-Anthropic models', () => {
    const prompt: LanguageModelV2Prompt = [assistantWithToolCallsV2('A'), toolMessageV2('A')];
    const result = anthropicToolResultInput.applyToPrompt!(makeRequestArgs(prompt, openaiModel));
    expect(result).toBeUndefined();
  });

  it('is a no-op when there are no tool-result parts', () => {
    const prompt: LanguageModelV2Prompt = [
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'hi' }] },
    ];
    const result = anthropicToolResultInput.applyToPrompt!(makeRequestArgs(prompt, anthropicModel));
    expect(result).toBeUndefined();
  });

  it('adds input to tool-result parts from matching tool-call args', () => {
    const prompt: LanguageModelV2Prompt = [
      { role: 'user', content: [{ type: 'text', text: 'fetch this' }] },
      {
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'fetch', input: { url: 'https://example.com' } },
        ],
      },
      {
        role: 'tool',
        content: [
          { type: 'tool-result', toolCallId: 'call-1', toolName: 'fetch', output: { type: 'text', value: 'ok' } },
        ],
      },
    ];
    const result = anthropicToolResultInput.applyToPrompt!(makeRequestArgs(prompt, anthropicModel))!;
    expect(result).toBeDefined();
    const toolMsg = result.find(m => m.role === 'tool')!;
    const toolResult = (toolMsg.content as any[])[0];
    expect(toolResult.input).toEqual({ url: 'https://example.com' });
  });

  it('adds input: {} when tool-call is not found in prompt', () => {
    const prompt: LanguageModelV2Prompt = [
      { role: 'user', content: [{ type: 'text', text: 'continue' }] },
      {
        role: 'tool',
        content: [
          { type: 'tool-result', toolCallId: 'unknown-call', toolName: 'fetch', output: { type: 'text', value: 'ok' } },
        ],
      },
    ];
    const result = anthropicToolResultInput.applyToPrompt!(makeRequestArgs(prompt, anthropicModel))!;
    expect(result).toBeDefined();
    const toolMsg = result.find(m => m.role === 'tool')!;
    const toolResult = (toolMsg.content as any[])[0];
    expect(toolResult.input).toEqual({});
  });

  it('handles multiple tool calls with different args', () => {
    const prompt: LanguageModelV2Prompt = [
      { role: 'user', content: [{ type: 'text', text: 'do things' }] },
      {
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'tool-a', input: { param1: 'value1' } },
          { type: 'tool-call', toolCallId: 'call-2', toolName: 'tool-b', input: {} },
        ],
      },
      {
        role: 'tool',
        content: [
          { type: 'tool-result', toolCallId: 'call-1', toolName: 'tool-a', output: { type: 'text', value: 'r1' } },
          { type: 'tool-result', toolCallId: 'call-2', toolName: 'tool-b', output: { type: 'text', value: 'r2' } },
        ],
      },
    ];
    const result = anthropicToolResultInput.applyToPrompt!(makeRequestArgs(prompt, anthropicModel))!;
    const toolMsg = result.find(m => m.role === 'tool')!;
    const parts = toolMsg.content as any[];
    expect(parts[0].input).toEqual({ param1: 'value1' });
    expect(parts[1].input).toEqual({});
  });

  it('enriches tool-result in assistant messages (inline provider results)', () => {
    const prompt: LanguageModelV2Prompt = [
      { role: 'user', content: [{ type: 'text', text: 'search' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'srv-1',
            toolName: 'web_search',
            input: { query: 'test' },
            providerExecuted: true,
          },
          {
            type: 'tool-result',
            toolCallId: 'srv-1',
            toolName: 'web_search',
            output: { type: 'text', value: 'found' },
          },
          { type: 'text', text: 'here is what I found' },
        ],
      },
    ];
    const result = anthropicToolResultInput.applyToPrompt!(makeRequestArgs(prompt, anthropicModel))!;
    const assistantMsg = result.find(m => m.role === 'assistant')!;
    const toolResult = (assistantMsg.content as any[]).find((p: any) => p.type === 'tool-result');
    expect(toolResult.input).toEqual({ query: 'test' });
  });
});

// ---------------------------------------------------------------------------
// ProcessorRunner auto-applies Anthropic compat rules
// ---------------------------------------------------------------------------

describe('ProcessorRunner — Anthropic compat auto-injection', () => {
  it('auto-applies anthropicToolResultInput for Anthropic models', async () => {
    const runner = new ProcessorRunner({
      inputProcessors: [],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    const prompt: LanguageModelV2Prompt = [
      { role: 'user', content: [{ type: 'text', text: 'fetch' }] },
      {
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 'c1', toolName: 'fetch', input: { url: 'https://x.com' } }],
      },
      {
        role: 'tool',
        content: [{ type: 'tool-result', toolCallId: 'c1', toolName: 'fetch', output: { type: 'text', value: 'ok' } }],
      },
    ];

    const result = await runner.runProcessLLMRequest({
      prompt,
      model: anthropicModel,
      stepNumber: 0,
      steps: [],
    });

    const toolMsg = result.prompt.find(m => m.role === 'tool')!;
    const toolResult = (toolMsg.content as any[])[0];
    expect(toolResult.input).toEqual({ url: 'https://x.com' });
  });

  it('does NOT add input for non-Anthropic models', async () => {
    const runner = new ProcessorRunner({
      inputProcessors: [],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    const prompt: LanguageModelV2Prompt = [
      { role: 'user', content: [{ type: 'text', text: 'fetch' }] },
      {
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 'c1', toolName: 'fetch', input: { url: 'https://x.com' } }],
      },
      {
        role: 'tool',
        content: [{ type: 'tool-result', toolCallId: 'c1', toolName: 'fetch', output: { type: 'text', value: 'ok' } }],
      },
    ];

    const result = await runner.runProcessLLMRequest({
      prompt,
      model: openaiModel,
      stepNumber: 0,
      steps: [],
    });

    const toolMsg = result.prompt.find(m => m.role === 'tool')!;
    const toolResult = (toolMsg.content as any[])[0];
    expect(toolResult.input).toBeUndefined();
  });

  it('auto-applies sanitizeOrphanedToolPairs for all models (including non-Anthropic)', async () => {
    const runner = new ProcessorRunner({
      inputProcessors: [],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    const prompt: LanguageModelV2Prompt = [
      assistantWithToolCallsV2('orphan'),
      { role: 'user', content: [{ type: 'text', text: 'next' }] },
    ];

    const result = await runner.runProcessLLMRequest({
      prompt,
      model: openaiModel,
      stepNumber: 0,
      steps: [],
    });

    // Orphan tool call should be removed even for OpenAI
    expect(result.prompt).toEqual([{ role: 'user', content: [{ type: 'text', text: 'next' }] }]);
  });
});
