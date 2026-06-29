import type { AgentControllerEvent, AgentControllerMessage } from '@mastra/client-js';
import type { MastraDBMessage } from '@mastra/core/agent';
import { describe, expect, it } from 'vitest';

import { accumulateMessages, toMastraDBMessage } from './agent-controller-message-accumulator';

describe('agent controller message accumulator', () => {
  it('converts visible controller content into ordered Mastra message parts', () => {
    const message: AgentControllerMessage = {
      id: 'message-1',
      role: 'assistant',
      content: [
        { type: 'text', text: 'I will inspect the file.' },
        { type: 'thinking', thinking: 'Need to check the current implementation.' },
        { type: 'tool_call', id: 'tool-1', name: 'read_file', args: { path: 'src/index.ts' } },
        { type: 'tool_result', id: 'tool-1', name: 'read_file', result: 'export const value = 1;' },
      ],
    };

    const converted = toMastraDBMessage(message);

    expect(converted).toMatchObject({
      id: 'message-1',
      role: 'assistant',
      content: { format: 2 },
    });
    expect(converted.createdAt).toBeInstanceOf(Date);
    expect(converted.content.parts).toEqual([
      { type: 'text', text: 'I will inspect the file.' },
      {
        type: 'reasoning',
        reasoning: 'Need to check the current implementation.',
        details: [{ type: 'text', text: 'Need to check the current implementation.' }],
      },
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'tool-1',
          toolName: 'read_file',
          args: { path: 'src/index.ts' },
          result: 'export const value = 1;',
        },
      },
    ]);
  });

  it('stores structured status content as harness metadata with readable fallback text', () => {
    const message: AgentControllerMessage = {
      id: 'status-1',
      role: 'system',
      content: [
        { type: 'notification_summary', text: 'Review pending notifications' },
        { type: 'om_thread_title_updated', text: 'Refactor transcript renderer' },
      ],
    };

    const converted = toMastraDBMessage(message);

    expect(converted.content.metadata?.harnessContent).toEqual(message.content);
    expect(converted.content.parts).toEqual([
      { type: 'text', text: 'Review pending notifications' },
      { type: 'text', text: 'Thread title updated: Refactor transcript renderer' },
    ]);
  });

  it('upserts repeated message events by message id', () => {
    const existingMessage = toMastraDBMessage({
      id: 'message-1',
      role: 'assistant',
      content: [{ type: 'text', text: 'Initial text' }],
    });
    const event: AgentControllerEvent = {
      type: 'message_update',
      message: {
        id: 'message-1',
        role: 'assistant',
        content: [{ type: 'text', text: 'Updated text' }],
      },
    };

    const accumulated = accumulateMessages([existingMessage], event);

    expect(accumulated).toHaveLength(1);
    expect(accumulated[0]?.content.parts).toEqual([{ type: 'text', text: 'Updated text' }]);
    expect(accumulated[0]?.createdAt).toBe(existingMessage.createdAt);
  });

  it('appends controller errors as synthetic system messages', () => {
    const existingMessages: MastraDBMessage[] = [];
    const event: AgentControllerEvent = {
      type: 'error',
      error: { message: 'The controller failed' },
      errorType: 'controller',
    };

    const accumulated = accumulateMessages(existingMessages, event);

    expect(accumulated).toHaveLength(1);
    expect(accumulated[0]).toMatchObject({ role: 'system' });
    expect(accumulated[0]?.id).toMatch(/^error-/);
    expect(accumulated[0]?.content.parts).toEqual([{ type: 'text', text: 'The controller failed' }]);
    expect(accumulated[0]?.content.metadata?.harnessContent).toEqual([
      { type: 'harness-error', text: 'The controller failed', errorType: 'controller' },
    ]);
  });

  it('returns existing messages unchanged for unrelated events', () => {
    const existingMessages: MastraDBMessage[] = [
      toMastraDBMessage({ id: 'message-1', role: 'assistant', content: [{ type: 'text', text: 'Keep me' }] }),
    ];
    const event: AgentControllerEvent = { type: 'agent_start' };

    const accumulated = accumulateMessages(existingMessages, event);

    expect(accumulated).toBe(existingMessages);
  });
});
