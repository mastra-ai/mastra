import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../';
import { MessageList } from '../index';
import type { AIV5Type } from '../types';

describe('aiV5UIMessagesToAIV5ModelMessages — message-level providerOptions', () => {
  it('preserves providerOptions on the final user message after a tool-call assistant turn', async () => {
    const messageList = new MessageList();

    messageList.add({ role: 'user', content: 'turn 1' } satisfies AIV5Type.ModelMessage, 'memory');

    const assistantWithTool: MastraDBMessage = {
      id: 'asst-tool-1',
      role: 'assistant',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'call-1',
              toolName: 'getWeather',
              args: { city: 'NYC' },
              result: 'sunny',
            },
          },
        ],
      },
    };
    messageList.add(assistantWithTool, 'memory');

    const cachedUserMessage: AIV5Type.ModelMessage = {
      role: 'user',
      content: 'turn 2',
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' as const } },
      },
    };
    messageList.add(cachedUserMessage, 'input');

    const llmPrompt = await messageList.get.all.aiV5.llmPrompt();

    const lastUser = [...llmPrompt].reverse().find((m: any) => m.role === 'user');
    expect(lastUser?.providerOptions).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } },
    });

    const toolMsg = llmPrompt.find((m: any) => m.role === 'tool');
    expect(toolMsg?.providerOptions).toBeUndefined();
  });

  it('preserves providerOptions on assistant tool-call turns without attaching them to tool results', async () => {
    const messageList = new MessageList();

    const assistantWithTool: MastraDBMessage = {
      id: 'asst-tool-provider-options',
      role: 'assistant',
      createdAt: new Date(),
      content: {
        format: 2,
        providerMetadata: {
          anthropic: { cacheControl: { type: 'ephemeral' as const } },
        },
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'call-provider-options',
              toolName: 'getWeather',
              args: { city: 'NYC' },
              result: 'sunny',
            },
          },
        ],
      },
    };
    messageList.add(assistantWithTool, 'memory');

    const llmPrompt = await messageList.get.all.aiV5.llmPrompt();

    const assistantMsg = llmPrompt.find((m: any) => m.role === 'assistant');
    expect(assistantMsg?.providerOptions).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } },
    });

    const toolMsg = llmPrompt.find((m: any) => m.role === 'tool');
    expect(toolMsg?.providerOptions).toBeUndefined();
  });

  it('preserves provider-executed tool metadata from DB history in llmPrompt', async () => {
    const messageList = new MessageList();
    const providerMetadata = {
      anthropic: { itemId: 'srvtoolu_01MkPKoctHhE9KDNjDvEHnSD' },
    };

    messageList.add({ role: 'user', content: 'Search the latest USD/CNY exchange rate' }, 'memory');

    const assistantWithProviderTool: MastraDBMessage = {
      id: 'asst-provider-tool-history',
      role: 'assistant',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'srvtoolu_01MkPKoctHhE9KDNjDvEHnSD',
              toolName: 'webSearch_20250305',
              args: { query: 'latest USD/CNY rate' },
              result: { results: ['7.12'] },
            },
            providerExecuted: true,
            providerMetadata,
          },
        ],
      },
    };
    messageList.add(assistantWithProviderTool, 'memory');
    messageList.add({ role: 'user', content: 'Continue the conversation' }, 'input');

    const llmPrompt = await messageList.get.all.aiV5.llmPrompt();
    const assistantMsg = llmPrompt.find((m: any) => m.role === 'assistant');
    const toolMsg = llmPrompt.find((m: any) => m.role === 'tool');
    const toolCall = (assistantMsg?.content as any[] | undefined)?.find(part => part.type === 'tool-call');
    const inlineToolResult = (assistantMsg?.content as any[] | undefined)?.find(part => part.type === 'tool-result');
    const toolMessageResult = (toolMsg?.content as any[] | undefined)?.find(part => part.type === 'tool-result');
    const toolResult = inlineToolResult ?? toolMessageResult;

    expect(toolCall?.providerExecuted).toBe(true);
    expect(toolCall?.providerOptions).toEqual(expect.objectContaining(providerMetadata));
    expect(toolResult?.providerOptions).toEqual(expect.objectContaining(providerMetadata));
  });
});
