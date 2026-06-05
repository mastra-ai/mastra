import { describe, expect, it } from 'vitest';

import { AIV5Adapter } from './AIV5Adapter';

describe('AIV5Adapter.fromModelMessage — tool result input preservation', () => {
  it('uses carried tool-result input when reconstructing a result without a preceding tool-call', () => {
    const dbMsg = AIV5Adapter.fromModelMessage({
      role: 'assistant',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'set-agent-name',
          input: { name: 'Support Email Triager' },
          output: { type: 'json', value: { success: true } },
        } as any,
      ],
    });

    expect(dbMsg.content.toolInvocations).toEqual([
      {
        state: 'result',
        toolCallId: 'call-1',
        toolName: 'set-agent-name',
        args: { name: 'Support Email Triager' },
        result: { success: true },
      },
    ]);
    expect(dbMsg.content.parts).toEqual([
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'call-1',
          toolName: 'set-agent-name',
          args: { name: 'Support Email Triager' },
          result: { success: true },
        },
      },
    ]);
  });
});
