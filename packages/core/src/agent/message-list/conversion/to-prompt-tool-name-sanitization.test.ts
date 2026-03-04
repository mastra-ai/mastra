import { describe, expect, it } from 'vitest';

import { aiV5ModelMessageToV2PromptMessage } from './to-prompt';

describe('aiV5ModelMessageToV2PromptMessage tool-name sanitization', () => {
  it('sanitizes invalid tool names in tool-call parts', () => {
    const result = aiV5ModelMessageToV2PromptMessage({
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

    expect(result.role).toBe('assistant');
    expect(result.content[0]).toMatchObject({
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'unknown_tool',
    });
  });

  it('sanitizes invalid tool names in tool-result parts', () => {
    const result = aiV5ModelMessageToV2PromptMessage({
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

    expect(result.role).toBe('tool');
    expect(result.content[0]).toMatchObject({
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'unknown_tool',
    });
  });
});
