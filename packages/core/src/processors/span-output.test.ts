import { describe, expect, it } from 'vitest';
import { projectProcessorSpanPayload, SAFE_PROCESSOR_SPAN_FIELDS } from './span-output';

describe('projectProcessorSpanPayload', () => {
  it('keeps allow-listed fields', () => {
    const projected = projectProcessorSpanPayload({
      phase: 'inputStep',
      messages: [{ id: '1', role: 'user', content: { parts: [{ type: 'text', text: 'hi' }] } }],
      stepNumber: 3,
      retryCount: 0,
      finishReason: 'stop',
      text: 'hello',
      toolCalls: [{ toolCallId: 'a', toolName: 't', args: {} }],
      toolChoice: 'auto',
      activeTools: ['weather'],
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });

    expect(projected).toEqual({
      phase: 'inputStep',
      messages: [{ id: '1', role: 'user', content: { parts: [{ type: 'text', text: 'hi' }] } }],
      stepNumber: 3,
      retryCount: 0,
      finishReason: 'stop',
      text: 'hello',
      toolCalls: [{ toolCallId: 'a', toolName: 't', args: {} }],
      toolChoice: 'auto',
      activeTools: ['weather'],
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });
  });

  it('drops credential-bearing fields', () => {
    const fakeModel = {
      modelId: 'gpt-4o',
      provider: 'openai',
      // TypeScript-private at compile time but enumerable at runtime
      config: { apiKey: 'sk-leak-me', headers: { Authorization: 'Bearer x' } },
      gateway: { id: 'mastra', cachedToken: 'token-secret' },
    };

    const projected = projectProcessorSpanPayload({
      phase: 'inputStep',
      model: fakeModel,
      tools: { weather: { execute: () => null, client: { apiKey: 'tool-key' } } },
      providerOptions: { openai: { headers: { Authorization: 'Bearer provider-secret' } } },
      modelSettings: { headers: { 'X-Tenant-Auth': 'tenant-secret' } },
      structuredOutput: { schema: {}, model: fakeModel },
      state: { userToken: 'user-secret' },
      processorStates: new Map(),
      messageList: { __isMessageList: true },
      requestContext: { apiKey: 'ctx-secret' },
      rotateResponseMessageId: () => 'id',
      writer: {},
      abortSignal: {},
      messageId: 'msg-1',
    });

    const serialized = JSON.stringify(projected);
    expect(serialized).not.toContain('sk-leak-me');
    expect(serialized).not.toContain('token-secret');
    expect(serialized).not.toContain('tool-key');
    expect(serialized).not.toContain('provider-secret');
    expect(serialized).not.toContain('tenant-secret');
    expect(serialized).not.toContain('user-secret');
    expect(serialized).not.toContain('ctx-secret');

    expect(projected).toEqual({
      phase: 'inputStep',
      messageId: 'msg-1',
    });
  });

  it('returns primitives and arrays unchanged', () => {
    expect(projectProcessorSpanPayload(null)).toBe(null);
    expect(projectProcessorSpanPayload(undefined)).toBe(undefined);
    expect(projectProcessorSpanPayload('hello')).toBe('hello');
    expect(projectProcessorSpanPayload(42)).toBe(42);
    const arr = [1, 2, 3];
    expect(projectProcessorSpanPayload(arr)).toBe(arr);
  });

  it('omits undefined fields rather than serializing them', () => {
    const projected = projectProcessorSpanPayload({
      phase: 'input',
      text: undefined,
      finishReason: undefined,
    });

    expect(projected).toEqual({ phase: 'input' });
    expect((projected as Record<string, unknown>).text).toBeUndefined();
  });

  it('exports a stable allow-list', () => {
    // Security: any new field added to the processor payload must be
    // reviewed and explicitly added here. A silent addition would leak.
    expect(SAFE_PROCESSOR_SPAN_FIELDS).toMatchInlineSnapshot(`
      [
        "phase",
        "messages",
        "systemMessages",
        "stepNumber",
        "messageId",
        "retryCount",
        "finishReason",
        "text",
        "toolCalls",
        "toolChoice",
        "activeTools",
        "usage",
        "tripwire",
        "part",
        "messageListMutations",
        "result",
      ]
    `);
  });
});
