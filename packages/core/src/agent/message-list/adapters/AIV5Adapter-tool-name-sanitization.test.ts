import { describe, expect, it } from 'vitest';

import { AIV5Adapter } from './AIV5Adapter';

describe('AIV5Adapter tool-name sanitization', () => {
  it('sanitizes invalid tool names from model tool-call parts', () => {
    const dbMessage = AIV5Adapter.fromModelMessage({
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: '$FUNCTION_NAME',
          input: { query: 'test' },
        },
      ],
    });

    const toolPart = dbMessage.content.parts?.find(
      part => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === 'call-1',
    );

    expect(toolPart?.type).toBe('tool-invocation');
    if (toolPart?.type === 'tool-invocation') {
      expect(toolPart.toolInvocation.toolName).toBe('unknown_tool');
    }

    expect(dbMessage.content.toolInvocations?.[0]?.toolName).toBe('unknown_tool');
  });

  it('sanitizes invalid tool names from model tool-result parts without matching calls', () => {
    const dbMessage = AIV5Adapter.fromModelMessage({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: '$FUNCTION_NAME',
          output: { ok: true },
        },
      ],
    });

    expect(dbMessage.content.toolInvocations?.[0]?.toolName).toBe('unknown_tool');

    const toolPart = dbMessage.content.parts?.find(
      part => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === 'call-1',
    );

    expect(toolPart?.type).toBe('tool-invocation');
    if (toolPart?.type === 'tool-invocation') {
      expect(toolPart.toolInvocation.toolName).toBe('unknown_tool');
    }
  });

  it('sanitizes invalid tool names from UI tool parts', () => {
    const dbMessage = AIV5Adapter.fromUIMessage({
      id: 'msg-1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-$FUNCTION_NAME',
          state: 'input-available',
          toolCallId: 'call-1',
          input: { query: 'test' },
        },
      ],
    });

    expect(dbMessage.content.toolInvocations?.[0]?.toolName).toBe('unknown_tool');

    const toolPart = dbMessage.content.parts?.find(
      part => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === 'call-1',
    );

    expect(toolPart?.type).toBe('tool-invocation');
    if (toolPart?.type === 'tool-invocation') {
      expect(toolPart.toolInvocation.toolName).toBe('unknown_tool');
    }
  });
});
