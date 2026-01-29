import { describe, it, expect } from 'vitest';
import { findToolCallArgs } from '../utils/provider-compat';

// Original test case
describe('findToolCallArgs', () => {
  it('should find args from the second message when first has empty args', () => {
    const messages: any[] = [
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_1', // ✅ FIXED: Changed from 'id' to 'toolCallId'
                args: {},
              },
            },
          ],
        },
      },
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_1', // ✅ FIXED: Changed from 'id' to 'toolCallId'
                args: { foo: 'bar' },
              },
            },
          ],
        },
      },
    ];

    const result = findToolCallArgs(messages, 'call_1'); // ✅ FIXED: Swapped parameter order
    expect(result).toEqual({ foo: 'bar' });
  });
});

// ============================================================================
// REGRESSION TEST ADDITIONS FOR PR #12416
// Issue: https://github.com/mastra-ai/mastra/issues/12405
// ============================================================================

describe('findToolCallArgs - regression test for split tool call args (PR #12416)', () => {
  it('should return valid args when first message has args and second has empty args', () => {
    const messages: any[] = [
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_1',
                args: { foo: 'bar', baz: 123 }, // Valid args
              },
            },
          ],
        },
      },
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_1',
                args: {}, // Empty args - this was overwriting valid args before the fix
              },
            },
          ],
        },
      },
    ];

    const result = findToolCallArgs(messages, 'call_1');

    // Should return the valid args from the first message, not the empty args
    expect(result).toEqual({ foo: 'bar', baz: 123 });
  });

  it('should return valid args when first message has empty args and second has valid args', () => {
    const messages: any[] = [
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_1',
                args: {}, // Empty args first
              },
            },
          ],
        },
      },
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_1',
                args: { foo: 'bar' }, // Valid args later
              },
            },
          ],
        },
      },
    ];

    const result = findToolCallArgs(messages, 'call_1');

    expect(result).toEqual({ foo: 'bar' });
  });

  it('should skip undefined args and continue searching', () => {
    const messages: any[] = [
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_1',
                args: { valid: 'data', count: 42 },
              },
            },
          ],
        },
      },
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_1',
                args: undefined, // Undefined args
              },
            },
          ],
        },
      },
    ];

    const result = findToolCallArgs(messages, 'call_1');

    expect(result).toEqual({ valid: 'data', count: 42 });
  });

  it('should skip null args and continue searching', () => {
    const messages: any[] = [
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_1',
                args: null, // Null args
              },
            },
          ],
        },
      },
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_1',
                args: { result: 'success' },
              },
            },
          ],
        },
      },
    ];

    const result = findToolCallArgs(messages, 'call_1');

    expect(result).toEqual({ result: 'success' });
  });

  it('should handle multiple tool calls with different arg patterns', () => {
    const messages: any[] = [
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_1',
                args: { query: 'search term' },
              },
            },
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_2',
                args: {}, // Empty for call_2
              },
            },
          ],
        },
      },
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_1',
                args: {}, // Empty for call_1
              },
            },
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_2',
                args: { userId: '123' }, // Valid for call_2
              },
            },
          ],
        },
      },
    ];

    const result1 = findToolCallArgs(messages, 'call_1');
    const result2 = findToolCallArgs(messages, 'call_2');

    expect(result1).toEqual({ query: 'search term' });
    expect(result2).toEqual({ userId: '123' });
  });

  it('should return empty object when all messages have empty args', () => {
    const messages: any[] = [
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_1',
                args: {},
              },
            },
          ],
        },
      },
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_1',
                args: {},
              },
            },
          ],
        },
      },
    ];

    const result = findToolCallArgs(messages, 'call_1');

    expect(result).toEqual({});
  });

  it('should handle the real-world client tool scenario from issue #12405', () => {
    // This simulates the actual bug where client-side tools
    // had their args split across messages
    const messages: any[] = [
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'client_tool_call',
                args: {
                  sessionId: 'abc-123',
                  action: 'update',
                  data: {
                    field1: 'value1',
                    field2: 'value2',
                  },
                },
              },
            },
          ],
        },
      },
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'client_tool_call',
                args: {}, // Empty args in later message
              },
            },
          ],
        },
      },
    ];

    const result = findToolCallArgs(messages, 'client_tool_call');

    // Should return the valid args, not empty
    expect(result).toEqual({
      sessionId: 'abc-123',
      action: 'update',
      data: {
        field1: 'value1',
        field2: 'value2',
      },
    });
    expect(Object.keys(result).length).toBeGreaterThan(0);
  });

  it('should handle args split across 3+ messages', () => {
    const messages: any[] = [
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_1',
                args: {},
              },
            },
          ],
        },
      },
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_1',
                args: { param: 'value' }, // Valid args in middle
              },
            },
          ],
        },
      },
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_1',
                args: {}, // Empty again
              },
            },
          ],
        },
      },
    ];

    const result = findToolCallArgs(messages, 'call_1');

    expect(result).toEqual({ param: 'value' });
  });

  it('should skip non-object args (primitive values)', () => {
    const messages: any[] = [
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_1',
                args: 'invalid string', // Non-object
              },
            },
          ],
        },
      },
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_1',
                args: { valid: 'object' },
              },
            },
          ],
        },
      },
    ];

    const result = findToolCallArgs(messages, 'call_1');

    expect(result).toEqual({ valid: 'object' });
  });
});
