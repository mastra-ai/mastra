import { MessageList, type MastraDBMessage } from '@mastra/core/agent';
import type { ProcessInputArgs, ProcessLLMRequestArgs } from '@mastra/core/processors';
import { describe, expect, it, vi } from 'vitest';

import { createPiProcessorAdapters } from '../processor-adapter.js';
import { MastraPiExtensionGeneration } from '../runtime.js';

function createGeneration(register: (api: ReturnType<MastraPiExtensionGeneration['createApi']>) => void) {
  const generation = new MastraPiExtensionGeneration('processor-plugin', 'processor-extension', '/tmp/processor.ts');
  register(generation.createApi());
  generation.bind();
  return generation;
}

function userMessage(text = 'hello'): MastraDBMessage {
  return {
    id: 'user-1',
    role: 'user',
    content: {
      format: 2,
      parts: [
        { type: 'text', text },
        { type: 'file', data: 'aGVsbG8=', mimeType: 'image/png' },
      ],
      metadata: { piInputSource: 'rpc', streamingBehavior: 'steer' },
    },
    createdAt: new Date(),
  };
}

function inputArgs(message = userMessage()): ProcessInputArgs {
  const messageList = new MessageList();
  messageList.add(message, 'input');
  return {
    messages: [message],
    messageList,
    systemMessages: [{ role: 'system', content: 'original system' }],
    state: {},
    retryCount: 0,
    abort: reason => {
      throw new Error(reason);
    },
  };
}

describe('Pi processor adapter', () => {
  it('omits non-JSON host message metadata instead of failing the input boundary', async () => {
    const seen: unknown[] = [];
    const generation = createGeneration(api => {
      api.on('context', event => {
        seen.push(event);
      });
    });
    const message = userMessage();
    message.content.metadata = { callback: () => 'unsafe', count: 1 } as never;
    const { input } = createPiProcessorAdapters(generation, '/workspace');

    await expect(input[0]!.processInput?.(inputArgs(message))).resolves.toBeDefined();
    expect(JSON.stringify(seen)).not.toContain('callback');
    expect(generation.compatibility.diagnostics).toContainEqual(
      expect.objectContaining({ capability: 'event:context:non-serializable' }),
    );
  });

  it('maps input metadata and images, transforms text, chains system/context replacements, and preserves ordering', async () => {
    const seen: unknown[] = [];
    const generation = createGeneration(api => {
      api.on('input', event => {
        seen.push(event);
        return {
          action: 'transform',
          text: 'transformed input',
          images: [{ type: 'image', data: 'bmV3', mimeType: 'image/jpeg' }],
        };
      });
      api.on('before_agent_start', event => {
        seen.push(event);
        return { systemPrompt: 'replacement system' };
      });
      api.on('context', event => {
        seen.push(event);
        const contextEvent = event as { messages: MastraDBMessage[] };
        return {
          messages: contextEvent.messages.map((message: MastraDBMessage) =>
            message.role === 'user'
              ? { ...message, content: { ...message.content, parts: [{ type: 'text', text: 'context input' }] } }
              : message,
          ),
        };
      });
    });
    const processor = createPiProcessorAdapters(generation, '/workspace').input[0]!;

    const result = await processor.processInput!(inputArgs());

    expect(seen[0]).toMatchObject({
      type: 'input',
      text: 'hello',
      source: 'rpc',
      streamingBehavior: 'steer',
      images: [{ type: 'image', data: 'aGVsbG8=', mimeType: 'image/png' }],
    });
    expect(result).toMatchObject({
      messages: [{ content: { parts: [{ type: 'text', text: 'context input' }] } }],
      systemMessages: [{ role: 'system', content: 'replacement system' }],
    });
  });

  it('maps handled input to the MC processor abort boundary', async () => {
    const generation = createGeneration(api => api.on('input', () => ({ action: 'handled' })));
    const processor = createPiProcessorAdapters(generation, '/workspace').input[0]!;

    await expect(processor.processInput!(inputArgs())).rejects.toThrow('handled the input');
  });

  it('applies same-role final-message replacements and diagnoses invalid role changes', async () => {
    const generation = createGeneration(api => {
      api.on('message_end', event => {
        const message = (event as { message: MastraDBMessage }).message;
        return {
          message: {
            ...message,
            content: { ...message.content, parts: [{ type: 'text', text: 'replaced' }] },
          },
        };
      });
    });
    const output = createPiProcessorAdapters(generation, '/workspace').output[0]!;
    const assistant: MastraDBMessage = {
      id: 'assistant-1',
      role: 'assistant',
      content: { format: 2, parts: [{ type: 'text', text: 'original' }] },
      createdAt: new Date(),
    };

    await expect(
      output.processOutputResult!({
        ...inputArgs(),
        messages: [assistant],
        result: {
          text: 'original',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          finishReason: 'stop',
          steps: [],
        },
      }),
    ).resolves.toMatchObject([{ role: 'assistant', content: { parts: [{ type: 'text', text: 'replaced' }] } }]);
  });

  it('transforms successful non-owned tool results through the host post-tool hook and diagnoses host gaps', async () => {
    const generation = createGeneration(api => {
      api.on('tool_call', () => undefined);
      api.on('tool_result', () => ({
        content: [{ type: 'text', text: 'rewritten' }],
        details: { rewritten: true },
        isError: true,
      }));
    });
    const output = createPiProcessorAdapters(generation, '/workspace').output[0]!;
    const messageList = new MessageList();
    messageList.add(
      {
        id: 'assistant-tool',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'call',
                toolCallId: 'call-1',
                toolName: 'host_tool',
                args: { value: 'input' },
              },
            },
          ],
        },
        createdAt: new Date(),
      },
      'response',
    );

    await output.processToolResult!({
      ...inputArgs(),
      messageList,
      stepNumber: 0,
      toolName: 'host_tool',
      toolCallId: 'call-1',
      args: { value: 'input' },
      result: { original: true },
      systemMessages: [],
      steps: [],
    });

    expect(messageList.get.all.db()[0]?.content.parts[0]).toMatchObject({
      toolInvocation: {
        state: 'result',
        result: { content: [{ type: 'text', text: 'rewritten' }], details: { rewritten: true } },
      },
    });
    const nonCloneable = {
      content: [{ type: 'custom', run: () => undefined }],
      details: () => undefined,
    };
    const circularArgs: Record<string, unknown> = {};
    circularArgs.self = circularArgs;
    await output.processToolResult!({
      ...inputArgs(),
      messageList,
      stepNumber: 0,
      toolName: 'host_tool',
      toolCallId: 'call-1',
      args: circularArgs,
      result: nonCloneable,
      systemMessages: [],
      steps: [],
    });
    expect(messageList.get.all.db()[0]?.content.parts[0]).toMatchObject({
      toolInvocation: { args: {} },
    });
    expect(generation.compatibility.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ capability: 'event:tool_call:host-tools' }),
        expect.objectContaining({ capability: 'event:tool_result:host-errors' }),
        expect.objectContaining({ capability: 'event:tool_result:unsupported-host-content' }),
        expect.objectContaining({ capability: 'event:tool_result:non-serializable-details' }),
        expect.objectContaining({ capability: 'event:tool_result:non-serializable-input' }),
        expect.objectContaining({ capability: 'event:tool_result:error-rewrite' }),
      ]),
    );
  });

  it('falls back safely before and after hooks for cloneable content that is not JSON-safe', async () => {
    const observedContent: unknown[] = [];
    const generation = createGeneration(api => {
      api.on('tool_result', event => {
        observedContent.push((event as { content: unknown }).content);
        return { content: [{ type: 'custom', value: 1n }] };
      });
    });
    const output = createPiProcessorAdapters(generation, '/workspace').output[0]!;
    const messageList = new MessageList();
    messageList.add(
      {
        id: 'assistant-bigint',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'call', toolCallId: 'call-bigint', toolName: 'host_tool', args: {} },
            },
          ],
        },
        createdAt: new Date(),
      },
      'response',
    );

    await expect(
      output.processToolResult!({
        ...inputArgs(),
        messageList,
        stepNumber: 0,
        toolName: 'host_tool',
        toolCallId: 'call-bigint',
        args: {},
        result: { content: [{ type: 'custom', value: 1n }] },
        systemMessages: [],
        steps: [],
      }),
    ).resolves.toBe(messageList);
    expect(observedContent).toEqual([[{ type: 'text', text: '[object Object]' }]]);
    expect(messageList.get.all.db()[0]?.content.parts[0]).toMatchObject({
      toolInvocation: { result: { content: [{ type: 'text', text: '[object Object]' }] } },
    });
    expect(generation.compatibility.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ capability: 'event:tool_result:unsupported-host-content' }),
        expect.objectContaining({ capability: 'event:tool_result:unsupported-extension-content' }),
      ]),
    );
  });

  it('strips extra fields from valid-looking host and extension content blocks', async () => {
    const observedContent: unknown[] = [];
    const generation = createGeneration(api => {
      api.on('tool_result', event => {
        observedContent.push((event as { content: unknown }).content);
        return { content: [{ type: 'text', text: 'rewritten', extra: 1n }] };
      });
    });
    const output = createPiProcessorAdapters(generation, '/workspace').output[0]!;
    const messageList = new MessageList();
    messageList.add(
      {
        id: 'assistant-extra',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'call', toolCallId: 'call-extra', toolName: 'host_tool', args: {} },
            },
          ],
        },
        createdAt: new Date(),
      },
      'response',
    );

    await output.processToolResult!({
      ...inputArgs(),
      messageList,
      stepNumber: 0,
      toolName: 'host_tool',
      toolCallId: 'call-extra',
      args: {},
      result: { content: [{ type: 'text', text: 'original', extra: () => undefined }] },
      systemMessages: [],
      steps: [],
    });

    expect(observedContent).toEqual([[{ type: 'text', text: 'original' }]]);
    expect(messageList.get.all.db()[0]?.content.parts[0]).toMatchObject({
      toolInvocation: { result: { content: [{ type: 'text', text: 'rewritten' }] } },
    });
  });

  it('maps provider request replacement and response observation without exposing raw host objects', async () => {
    const response = vi.fn();
    const generation = createGeneration(api => {
      api.on('before_provider_request', event => [
        ...(event as { payload: unknown[] }).payload,
        { role: 'system', content: [{ type: 'text', text: 'replacement' }] },
      ]);
      api.on('after_provider_response', response);
    });
    const adapters = createPiProcessorAdapters(generation, '/workspace');
    const requestArgs = {
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
      model: 'openai/gpt-5',
      stepNumber: 0,
      steps: [],
      state: {},
      retryCount: 0,
      abort: () => {
        throw new Error('abort');
      },
    } as unknown as ProcessLLMRequestArgs;

    await expect(adapters.input[0]!.processLLMRequest!(requestArgs)).resolves.toEqual({
      prompt: [requestArgs.prompt[0], { role: 'system', content: [{ type: 'text', text: 'replacement' }] }],
    });
    const hostRequest = { secret: 'request-host-object' };
    const hostResponse = {
      status: 201,
      headers: new Headers([['x-safe', 'yes']]),
      secret: 'response-host-object',
    };
    await adapters.output[0]!.processLLMResponse!({
      ...requestArgs,
      chunks: [{ type: 'text-delta', payload: { text: 'ok' } }],
      warnings: [],
      fromCache: false,
      request: hostRequest,
      rawResponse: hostResponse,
    });
    expect(response).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'after_provider_response',
        status: 201,
        headers: { 'x-safe': 'yes' },
        fromCache: false,
      }),
      expect.objectContaining({ cwd: '/workspace', mode: 'tui', hasUI: false, ui: expect.any(Object) }),
    );
    expect(response.mock.calls[0]?.[0]).not.toHaveProperty('request');
    expect(response.mock.calls[0]?.[0]).not.toHaveProperty('response');
  });
});
