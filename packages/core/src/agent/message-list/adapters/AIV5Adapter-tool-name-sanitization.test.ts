import { describe, expect, it } from 'vitest';

import { getLegacyToolInvocations } from '../utils/legacy-fields';
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

  it('updates matching model tool-call parts without mutating shared invocations', () => {
    const dbMessage = AIV5Adapter.fromModelMessage({
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'weather',
          input: { city: 'SF' },
        },
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'weather',
          output: { temp: 65 },
        },
      ],
    });

    const toolParts = dbMessage.content.parts?.filter(
      (part): part is Extract<(typeof dbMessage.content.parts)[number], { type: 'tool-invocation' }> =>
        part.type === 'tool-invocation',
    );

    expect(toolParts).toHaveLength(1);
    expect(toolParts[0].toolInvocation).toEqual({
      state: 'result',
      toolCallId: 'call-1',
      toolName: 'weather',
      args: { city: 'SF' },
      result: { temp: 65 },
    });
    const descriptor = Object.getOwnPropertyDescriptor(dbMessage.content, 'toolInvocations');
    expect(descriptor).toBeDefined();
    expect(descriptor?.enumerable).toBe(false);
    expect(getLegacyToolInvocations(dbMessage.content)?.[0]).toEqual(toolParts[0].toolInvocation);
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
