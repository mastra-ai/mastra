import type { MastraDBMessage } from '@mastra/core/agent';
import { describe, expect, it } from 'vitest';

import { TokenCounter } from '../token-counter';
import { DEFAULT_OBSERVER_TOOL_RESULT_MAX_TOKENS } from '../tool-result-helpers';

function messageWithToolResult(result: unknown): MastraDBMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    createdAt: new Date(),
    threadId: 'thread-1',
    resourceId: 'resource-1',
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'tool-1',
            toolName: 'read_file',
            args: {},
            result,
          },
        },
      ],
    },
  } as unknown as MastraDBMessage;
}

describe('TokenCounter with oversized tool results', () => {
  it('counts the full tool result, not the representation truncated for the Observer', () => {
    const counter = new TokenCounter();
    // Comfortably past the Observer's per-tool-result truncation budget.
    const hugeResult = { contents: 'lorem ipsum dolor sit amet '.repeat(40_000) };

    const tokens = counter.countMessage(messageWithToolResult(hugeResult));

    expect(tokens).toBeGreaterThan(DEFAULT_OBSERVER_TOOL_RESULT_MAX_TOKENS * 5);
  });

  it('scales with tool result size past the Observer truncation budget', () => {
    const counter = new TokenCounter();
    const build = (repeats: number) =>
      messageWithToolResult({ contents: 'lorem ipsum dolor sit amet '.repeat(repeats) });

    const smaller = counter.countMessage(build(40_000));
    const larger = counter.countMessage(build(80_000));

    expect(larger).toBeGreaterThan(smaller * 1.8);
  });

  it('counts oversized entries inside multimodal tool result content', () => {
    const counter = new TokenCounter();
    const build = (repeats: number) =>
      messageWithToolResult({
        content: [{ type: 'json', value: { contents: 'lorem ipsum dolor sit amet '.repeat(repeats) } }],
      });

    const smaller = counter.countMessage(build(40_000));
    const larger = counter.countMessage(build(80_000));

    expect(smaller).toBeGreaterThan(DEFAULT_OBSERVER_TOOL_RESULT_MAX_TOKENS * 5);
    expect(larger).toBeGreaterThan(smaller * 1.8);
  });
});
