import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../';
import { getToolResultInvocationState } from '../../../loop/workflows/agentic-execution/provider-tool-result-state';
import { MessageList } from '../index';

// Shape emitted by @ai-sdk/anthropic for a failed native tool search (issue #26526).
const toolSearchError = { type: 'tool_search_tool_result_error', errorCode: 'invalid_tool_input' };

function userMessage(): MastraDBMessage {
  return {
    id: 'user-1',
    role: 'user',
    content: { format: 2, parts: [{ type: 'text', text: 'find a tool' }] },
    createdAt: new Date(1),
  };
}

function providerToolCallMessage(): MastraDBMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'call',
            toolCallId: 'srvtoolu_1',
            toolName: 'tool_search_tool_regex',
            args: { pattern: '(' },
          },
          providerExecuted: true,
        },
      ],
    },
    createdAt: new Date(2),
  };
}

function findProviderToolResult(prompt: any[]) {
  for (const message of prompt) {
    if (!Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (part.type === 'tool-result' && part.toolCallId === 'srvtoolu_1') return { role: message.role, part };
    }
  }
  return undefined;
}

describe('provider-executed tool results flagged isError (#26526)', () => {
  it('maps isError results to output-error and keeps the structured error', () => {
    expect(getToolResultInvocationState({ result: toolSearchError, isError: true })).toEqual({
      state: 'output-error',
      result: toolSearchError,
      errorText: JSON.stringify(toolSearchError),
    });
    expect(getToolResultInvocationState({ result: 'boom', isError: true })).toEqual({
      state: 'output-error',
      result: 'boom',
      errorText: 'boom',
    });
    expect(getToolResultInvocationState({ result: toolSearchError })).toEqual({
      state: 'result',
      result: toolSearchError,
    });
  });

  it('later-step result: stores output-error and sends the original error object as error-json', async () => {
    const messageList = new MessageList();
    messageList.add(userMessage(), 'input');
    messageList.add(providerToolCallMessage(), 'response');

    const updated = messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: {
        toolCallId: 'srvtoolu_1',
        toolName: 'tool_search_tool_regex',
        args: { pattern: '(' },
        ...getToolResultInvocationState({ result: toolSearchError, isError: true }),
      },
      providerExecuted: true,
    });
    expect(updated).toBe(true);

    const part = messageList.get.all.db()[1]?.content.parts[0] as any;
    expect(part.toolInvocation.state).toBe('output-error');
    expect(part.toolInvocation.result).toEqual(toolSearchError);
    expect(part.providerExecuted).toBe(true);

    const found = findProviderToolResult(await messageList.get.all.aiV5.llmPrompt());
    expect(found?.role).toBe('assistant');
    expect(found?.part.output).toEqual({ type: 'error-json', value: toolSearchError });

    const v6 = findProviderToolResult(await messageList.get.all.aiV6.llmPrompt());
    expect(v6?.part.output).toEqual({ type: 'error-json', value: toolSearchError });
  });

  it('keeps the error after a memory round-trip of the stored messages', async () => {
    const original = new MessageList();
    original.add(userMessage(), 'input');
    original.add(providerToolCallMessage(), 'response');
    original.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: {
        toolCallId: 'srvtoolu_1',
        toolName: 'tool_search_tool_regex',
        args: { pattern: '(' },
        ...getToolResultInvocationState({ result: toolSearchError, isError: true }),
      },
      providerExecuted: true,
    });

    const persisted = JSON.parse(JSON.stringify(original.get.all.db())) as MastraDBMessage[];
    const recalled = new MessageList();
    recalled.add(persisted, 'memory');
    recalled.add({ ...userMessage(), id: 'user-2', createdAt: new Date(3) }, 'input');

    const found = findProviderToolResult(await recalled.get.all.aiV5.llmPrompt());
    expect(found?.part.output).toEqual({ type: 'error-json', value: toolSearchError });
  });

  it('leaves successful provider tool results as json', async () => {
    const messageList = new MessageList();
    messageList.add(userMessage(), 'input');
    messageList.add(providerToolCallMessage(), 'response');
    const success = [{ type: 'tool_reference', toolName: 'weather' }];
    messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: {
        toolCallId: 'srvtoolu_1',
        toolName: 'tool_search_tool_regex',
        args: { pattern: 'weather' },
        ...getToolResultInvocationState({ result: success }),
      },
      providerExecuted: true,
    });

    const found = findProviderToolResult(await messageList.get.all.aiV5.llmPrompt());
    expect(found?.part.output).toEqual({ type: 'json', value: success });
  });

  it("keeps each turn's own error when a toolCallId is reused across turns", async () => {
    const otherError = { type: 'tool_search_tool_result_error', errorCode: 'too_many_requests' };
    const errorTurn = (id: string, createdAt: number, result: unknown): MastraDBMessage => ({
      id,
      role: 'assistant',
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'srvtoolu_1',
              toolName: 'tool_search_tool_regex',
              args: { pattern: '(' },
              ...getToolResultInvocationState({ result, isError: true }),
            },
            providerExecuted: true,
          },
        ],
      },
      createdAt: new Date(createdAt),
    });

    const messageList = new MessageList();
    messageList.add(
      [
        userMessage(),
        errorTurn('assistant-1', 2, toolSearchError),
        { ...userMessage(), id: 'user-2', createdAt: new Date(3) },
        errorTurn('assistant-2', 4, otherError),
        { ...userMessage(), id: 'user-3', createdAt: new Date(5) },
      ],
      'memory',
    );

    const outputs = (await messageList.get.all.aiV5.llmPrompt()).flatMap(message =>
      Array.isArray(message.content)
        ? message.content.filter((part: any) => part.type === 'tool-result').map((part: any) => part.output)
        : [],
    );
    expect(outputs).toEqual([
      { type: 'error-json', value: toolSearchError },
      { type: 'error-json', value: otherError },
    ]);
  });

  it.each(['output-available', 'error'] as const)(
    'applies the %s transcript redaction to the stored error object before it is saved or replayed',
    async phase => {
      const messageList = new MessageList();
      messageList.add(userMessage(), 'input');
      messageList.add(providerToolCallMessage(), 'response');
      messageList.updateToolInvocation({
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId: 'srvtoolu_1',
          toolName: 'tool_search_tool_regex',
          args: { pattern: '(' },
          ...getToolResultInvocationState({ result: { ...toolSearchError, detail: 'SECRET' }, isError: true }),
        },
        providerMetadata: {
          mastra: { toolPayloadTransform: { transcript: { [phase]: { transformed: toolSearchError } } } },
        },
        providerExecuted: true,
      });

      const drained = messageList.drainUnsavedMessages();
      expect(JSON.stringify(drained)).not.toContain('SECRET');
      const part = drained.find(message => message.id === 'assistant-1')?.content.parts?.[0] as any;
      expect(part.toolInvocation.state).toBe('output-error');
      expect(part.toolInvocation.result).toEqual(toolSearchError);
      expect(part.toolInvocation.errorText).toBe(JSON.stringify(toolSearchError));

      const recalled = new MessageList();
      recalled.add(JSON.parse(JSON.stringify(drained)), 'memory');
      recalled.add({ ...userMessage(), id: 'user-2', createdAt: new Date(3) }, 'input');
      const found = findProviderToolResult(await recalled.get.all.aiV5.llmPrompt());
      expect(found?.part.output).toEqual({ type: 'error-json', value: toolSearchError });
    },
  );

  it('keeps the structured error when an output-error part is merged into its tool call', async () => {
    const messageList = new MessageList();
    messageList.add([userMessage(), providerToolCallMessage()], 'memory');
    messageList.add(
      {
        id: 'assistant-1-result',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'srvtoolu_1',
                toolName: 'tool_search_tool_regex',
                args: { pattern: '(' },
                ...getToolResultInvocationState({ result: toolSearchError, isError: true }),
              },
              providerExecuted: true,
            },
          ],
        },
        createdAt: new Date(3),
      },
      'response',
    );

    const parts = messageList.get.all.db().flatMap(message => message.content.parts ?? []);
    const invocations = parts.filter((part: any) => part.toolInvocation?.toolCallId === 'srvtoolu_1') as any[];
    expect(invocations).toHaveLength(1);
    expect(invocations[0].toolInvocation.state).toBe('output-error');
    expect(invocations[0].toolInvocation.result).toEqual(toolSearchError);
  });

  it('drops the stored error object when the transcript transform redacts it to undefined', async () => {
    const callMessage = providerToolCallMessage();
    callMessage.content.toolInvocations = [
      { state: 'call', toolCallId: 'srvtoolu_1', toolName: 'tool_search_tool_regex', args: { pattern: '(' } },
    ];
    const messageList = new MessageList();
    messageList.add(userMessage(), 'input');
    messageList.add(callMessage, 'response');
    messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: {
        toolCallId: 'srvtoolu_1',
        toolName: 'tool_search_tool_regex',
        args: { pattern: '(' },
        ...getToolResultInvocationState({ result: { ...toolSearchError, detail: 'SECRET' }, isError: true }),
      },
      providerMetadata: {
        mastra: { toolPayloadTransform: { transcript: { 'output-available': { transformed: undefined } } } },
      },
      providerExecuted: true,
    });

    const drained = messageList.drainUnsavedMessages();
    expect(JSON.stringify(drained)).not.toContain('SECRET');
    const assistant = drained.find(message => message.id === 'assistant-1')!;
    expect((assistant.content.parts?.[0] as any).toolInvocation.result).toBeUndefined();
    expect((assistant.content.toolInvocations?.[0] as any).result).toBeUndefined();
  });

  it('does not mirror a client-tool error into the legacy toolInvocations as a result', () => {
    const messageList = new MessageList();
    messageList.add(userMessage(), 'input');
    messageList.add(
      {
        id: 'assistant-client',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'call', toolCallId: 'call_client', toolName: 'getWeather', args: { city: 'x' } },
            },
          ],
          toolInvocations: [{ state: 'call', toolCallId: 'call_client', toolName: 'getWeather', args: { city: 'x' } }],
        },
        createdAt: new Date(2),
      },
      'response',
    );
    messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'output-error',
        toolCallId: 'call_client',
        toolName: 'getWeather',
        args: { city: 'x' },
        errorText: 'boom',
      },
    });

    const message = messageList.get.all.db().find(m => m.id === 'assistant-client')!;
    expect((message.content.parts?.[0] as any).toolInvocation.state).toBe('output-error');
    expect(message.content.toolInvocations?.[0]?.state).toBe('call');
  });

  it('keeps client-tool errors on the error transcript transform', () => {
    const messageList = new MessageList();
    messageList.add(userMessage(), 'input');
    messageList.add(
      {
        id: 'assistant-client-error',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'output-error',
                toolCallId: 'call_client',
                toolName: 'getWeather',
                args: { city: 'x' },
                result: { secret: 'SECRET' },
                errorText: 'SECRET stack',
              } as any,
              providerMetadata: {
                mastra: {
                  toolPayloadTransform: {
                    transcript: {
                      'output-available': { transformed: { secret: 'SECRET' } },
                      error: { transformed: 'Tool failed' },
                    },
                  },
                },
              },
            },
          ],
        },
        createdAt: new Date(2),
      },
      'response',
    );

    const drained = messageList.drainUnsavedMessages();
    const part = drained.find(m => m.id === 'assistant-client-error')?.content.parts?.[0] as any;
    expect(part.toolInvocation.errorText).toBe('Tool failed');
  });

  it('clears a legacy output-error result when the transcript transform redacts it to undefined', () => {
    const messageList = new MessageList();
    messageList.add(userMessage(), 'input');
    messageList.add(
      {
        id: 'assistant-legacy-error',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'srvtoolu_1',
                toolName: 'tool_search_tool_regex',
                args: { pattern: '(' },
                ...getToolResultInvocationState({ result: { detail: 'SECRET' }, isError: true }),
              },
              providerExecuted: true,
              providerMetadata: {
                mastra: { toolPayloadTransform: { transcript: { 'output-available': { transformed: undefined } } } },
              },
            },
          ],
          toolInvocations: [
            {
              state: 'output-error',
              toolCallId: 'srvtoolu_1',
              toolName: 'tool_search_tool_regex',
              args: { pattern: '(' },
              result: { detail: 'SECRET' },
            } as any,
          ],
        },
        createdAt: new Date(2),
      },
      'response',
    );

    const drained = messageList.drainUnsavedMessages();
    expect(JSON.stringify(drained)).not.toContain('SECRET');
  });
});
