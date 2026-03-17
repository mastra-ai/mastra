import { describe, expect, it, vi } from 'vitest';
import type { MastraDBMessage } from '../';
import { MessageList } from '../index';

function makeAssistantMessage(parts: MastraDBMessage['content']['parts'], id?: string): MastraDBMessage {
  return {
    id: id ?? `msg-${Math.random().toString(36).slice(2)}`,
    role: 'assistant',
    content: { format: 2, parts },
    createdAt: new Date(),
  };
}

describe('MessageList.updateToolInvocation', () => {
  it('should update a state:call tool invocation to state:result', () => {
    const messageList = new MessageList();

    const msg = makeAssistantMessage([
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'call',
          toolCallId: 'tc-1',
          toolName: 'web_search',
          args: { query: 'hello' },
        },
      },
    ]);
    messageList.add(msg, 'response');

    const updated = messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'result',
        toolCallId: 'tc-1',
        toolName: 'web_search',
        args: {},
        result: { content: [{ type: 'text', text: 'search result' }] },
      },
    });

    expect(updated).toBe(true);

    const parts = messageList.get.all.db()[0]?.content?.parts ?? [];
    const part = parts[0] as any;
    expect(part.toolInvocation.state).toBe('result');
    expect(part.toolInvocation.result).toEqual({ content: [{ type: 'text', text: 'search result' }] });
  });

  it('should preserve original args from the call part', () => {
    const messageList = new MessageList();

    const msg = makeAssistantMessage([
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'call',
          toolCallId: 'tc-1',
          toolName: 'lookup',
          args: { topic: 'TypeScript history', detail: true },
        },
      },
    ]);
    messageList.add(msg, 'response');

    const updated = messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'result',
        toolCallId: 'tc-1',
        toolName: 'lookup',
        args: {}, // result part may have empty or different args
        result: { details: 'some info' },
      },
    });

    expect(updated).toBe(true);

    const part = messageList.get.all.db()[0]?.content?.parts?.[0] as any;
    expect(part.toolInvocation.args).toEqual({ topic: 'TypeScript history', detail: true });
  });

  it('should move a memory message to response source for re-saving', () => {
    const messageList = new MessageList();

    const msg = makeAssistantMessage([
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'call',
          toolCallId: 'tc-1',
          toolName: 'web_search',
          args: { query: 'hello' },
        },
      },
    ]);

    // Simulate a message loaded from DB (memory source)
    messageList.add(msg, 'memory');

    // Drain to clear the unsaved set (simulates initial load)
    messageList.drainUnsavedMessages();

    // Now the message should NOT be in the unsaved set
    expect(messageList.drainUnsavedMessages()).toHaveLength(0);

    // Update the tool invocation — this should move it to response source
    const updated = messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'result',
        toolCallId: 'tc-1',
        toolName: 'web_search',
        args: {},
        result: { content: 'search results' },
      },
    });

    expect(updated).toBe(true);

    // The message should now be drainable for re-saving
    const unsaved = messageList.drainUnsavedMessages();
    expect(unsaved).toHaveLength(1);
    expect(unsaved[0]?.id).toBe(msg.id);
  });

  it('should not move a response message (already in response source)', () => {
    const messageList = new MessageList();

    const msg = makeAssistantMessage([
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'call',
          toolCallId: 'tc-1',
          toolName: 'web_search',
          args: { query: 'test' },
        },
      },
    ]);

    messageList.add(msg, 'response');

    const updated = messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'result',
        toolCallId: 'tc-1',
        toolName: 'web_search',
        args: {},
        result: 'done',
      },
    });

    expect(updated).toBe(true);

    // Should still be drainable exactly once
    const unsaved = messageList.drainUnsavedMessages();
    expect(unsaved).toHaveLength(1);
  });

  it('should return false and warn when no matching toolCallId exists', () => {
    const warnFn = vi.fn();
    const messageList = new MessageList({ logger: { warn: warnFn } as any });

    const msg = makeAssistantMessage([
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'call',
          toolCallId: 'tc-1',
          toolName: 'web_search',
          args: {},
        },
      },
    ]);
    messageList.add(msg, 'response');

    const result = messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'result',
        toolCallId: 'tc-nonexistent',
        toolName: 'web_search',
        args: {},
        result: 'data',
      },
    });

    expect(result).toBe(false);
    expect(warnFn).toHaveBeenCalledWith(expect.stringContaining('tc-nonexistent'));
  });

  it('should find tool invocation in an earlier message when multiple messages exist', () => {
    const messageList = new MessageList();

    // First assistant message with a tool call
    const msg1 = makeAssistantMessage([
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'call',
          toolCallId: 'tc-old',
          toolName: 'web_search',
          args: { query: 'old query' },
        },
      },
    ]);
    messageList.add(msg1, 'memory');

    // Second assistant message (current turn)
    const msg2 = makeAssistantMessage([
      {
        type: 'text',
        text: 'Here are the results:',
      },
    ]);
    messageList.add(msg2, 'response');

    // Drain and verify initial state
    messageList.drainUnsavedMessages();

    // Update the old tool call
    const updated = messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'result',
        toolCallId: 'tc-old',
        toolName: 'web_search',
        args: {},
        result: { content: 'deferred result' },
      },
    });

    expect(updated).toBe(true);

    // msg1 should now be in the unsaved set
    const unsaved = messageList.drainUnsavedMessages();
    expect(unsaved).toHaveLength(1);
    expect(unsaved[0]?.id).toBe(msg1.id);

    // Verify the part was updated
    const part = msg1.content.parts[0] as any;
    expect(part.toolInvocation.state).toBe('result');
    expect(part.toolInvocation.args).toEqual({ query: 'old query' });
    expect(part.toolInvocation.result).toEqual({ content: 'deferred result' });
  });

  it('should update the correct tool invocation when message has multiple parts', () => {
    const messageList = new MessageList();

    const msg = makeAssistantMessage([
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'tc-done',
          toolName: 'execute_command',
          args: { command: 'pwd' },
          result: '/home/user',
        },
      },
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'call',
          toolCallId: 'tc-pending',
          toolName: 'web_search',
          args: { query: 'mastra' },
        },
      },
      {
        type: 'text',
        text: 'Running both tools...',
      },
    ]);
    messageList.add(msg, 'response');

    const updated = messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'result',
        toolCallId: 'tc-pending',
        toolName: 'web_search',
        args: {},
        result: { searchResults: ['result1'] },
      },
    });

    expect(updated).toBe(true);

    const parts = msg.content.parts;
    // First part should be unchanged
    expect((parts[0] as any).toolInvocation.toolCallId).toBe('tc-done');
    expect((parts[0] as any).toolInvocation.state).toBe('result');
    // Second part should be updated
    expect((parts[1] as any).toolInvocation.toolCallId).toBe('tc-pending');
    expect((parts[1] as any).toolInvocation.state).toBe('result');
    expect((parts[1] as any).toolInvocation.args).toEqual({ query: 'mastra' });
    expect((parts[1] as any).toolInvocation.result).toEqual({ searchResults: ['result1'] });
    // Third part should be unchanged
    expect((parts[2] as any).type).toBe('text');
  });

  it('should skip user-role messages when searching', () => {
    const messageList = new MessageList();

    // Add a user message that happens to have tool-invocation-like content
    messageList.add(
      {
        id: 'user-msg',
        role: 'user',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'call',
                toolCallId: 'tc-1',
                toolName: 'some_tool',
                args: {},
              },
            },
          ],
        },
        createdAt: new Date(),
      },
      'input',
    );

    const result = messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'result',
        toolCallId: 'tc-1',
        toolName: 'some_tool',
        args: {},
        result: 'data',
      },
    });

    expect(result).toBe(false);
  });

  it('should preserve providerMetadata from the input part', () => {
    const messageList = new MessageList();

    const msg = makeAssistantMessage([
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'call',
          toolCallId: 'tc-1',
          toolName: 'web_search',
          args: { query: 'test' },
        },
        providerExecuted: true,
      } as any,
    ]);
    messageList.add(msg, 'response');

    messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'result',
        toolCallId: 'tc-1',
        toolName: 'web_search',
        args: {},
        result: { data: 'search' },
      },
      providerMetadata: { mastra: { modelOutput: true } },
    } as any);

    const part = msg.content.parts[0] as any;
    expect(part.providerMetadata).toEqual({ mastra: { modelOutput: true } });
  });
});
