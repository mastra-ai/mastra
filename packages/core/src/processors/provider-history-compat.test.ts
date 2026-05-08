import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { APICallError } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';
import { MessageList } from '../agent/message-list';
import {
  anthropicStripForeignReasoningContent,
  cerebrasStripReasoningContent,
  isMaybeAnthropic,
  isMaybeCerebras,
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
