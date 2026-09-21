import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../../../agent/message-list';
import { MessageList } from '../../../agent/message-list';
import { commitToolResult } from './tool-result-commit-core';

function makeMessageList() {
  const messageList = new MessageList();
  const message: MastraDBMessage = {
    id: 'message-1',
    role: 'assistant',
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'call',
            toolCallId: 'call-1',
            toolName: 'test-tool',
            args: {},
          },
        },
      ],
    },
    createdAt: new Date(),
  };
  messageList.add(message, 'response');
  return messageList;
}

describe('commitToolResult', () => {
  it.each([0, '', false])('preserves a falsy structured result on an error outcome: %j', result => {
    const messageList = makeMessageList();

    expect(
      commitToolResult({
        messageList,
        outcome: { kind: 'error', errorText: 'failed', result },
        toolCallId: 'call-1',
        toolName: 'test-tool',
        toolArgs: {},
      }),
    ).toBe(true);

    const invocation = messageList.get.all.db()[0]?.content.parts?.[0];
    expect(invocation).toMatchObject({
      type: 'tool-invocation',
      toolInvocation: { state: 'output-error', errorText: 'failed', result },
    });
  });
});
