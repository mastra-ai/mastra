import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { describe, it, expect } from 'vitest';

import {
  createHumanFormatState,
  formatHuman,
  formatJsonl,
  renderJsonResult,
  renderTextResult,
  truncate,
} from './format.js';
import type { RunMCResult } from './types.js';

function textMessage(text: string, id = 'assistant-1') {
  return { id, role: 'assistant' as const, content: { format: 2 as const, parts: [{ type: 'text' as const, text }] } };
}

describe('truncate', () => {
  it('returns the string unchanged when under the limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('appends "..." when over the limit', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
  });
});

describe('formatHuman', () => {
  it('streams compact assistant text deltas', () => {
    const state = createHumanFormatState();
    formatHuman({ type: 'message_start', message: textMessage('', 'assistant-1') } as AgentControllerEvent, state);
    expect(
      formatHuman({ type: 'message_update', id: 'assistant-1', event: { type: 'text-delta', delta: 'Hello' } }, state),
    ).toEqual({ stdout: 'Hello' });
    expect(
      formatHuman({ type: 'message_update', id: 'assistant-1', event: { type: 'text-delta', delta: ' world' } }, state),
    ).toEqual({ stdout: ' world' });
  });

  it('ignores compact reasoning and part updates in human text output', () => {
    const state = createHumanFormatState();
    formatHuman({ type: 'message_start', message: textMessage('', 'assistant-1') } as AgentControllerEvent, state);

    expect(
      formatHuman(
        { type: 'message_update', id: 'assistant-1', event: { type: 'reasoning-delta', index: 0, delta: 'Thinking' } },
        state,
      ),
    ).toEqual({});
    expect(
      formatHuman(
        {
          type: 'message_update',
          id: 'assistant-1',
          event: { type: 'part', index: 0, part: { type: 'reasoning', reasoning: 'Thinking', details: [] } },
        },
        state,
      ),
    ).toEqual({});
  });

  it('ignores deltas for another message', () => {
    const state = createHumanFormatState();
    formatHuman({ type: 'message_start', message: textMessage('', 'assistant-1') } as AgentControllerEvent, state);
    expect(
      formatHuman({ type: 'message_update', id: 'assistant-2', event: { type: 'text-delta', delta: 'Hi' } }, state),
    ).toEqual({});
  });

  it('resets the cursor and emits a trailing newline on matching message_end', () => {
    const state = createHumanFormatState();
    formatHuman({ type: 'message_start', message: textMessage('', 'assistant-1') } as AgentControllerEvent, state);
    formatHuman({ type: 'message_update', id: 'assistant-1', event: { type: 'text-delta', delta: 'Hi' } }, state);
    expect(formatHuman({ type: 'message_end', id: 'assistant-1' }, state)).toEqual({ stdout: '\n' });
    expect(state.lastTextLength).toBe(0);
  });

  it('ignores message_end events for a different message', () => {
    const state = createHumanFormatState();
    formatHuman({ type: 'message_start', message: textMessage('', 'assistant-1') } as AgentControllerEvent, state);
    expect(formatHuman({ type: 'message_end', id: 'user-1' }, state)).toEqual({});
    expect(state.lastTextLength).toBe(0);
  });

  it('routes tool start activity to stderr', () => {
    const state = createHumanFormatState();
    const out = formatHuman({ type: 'tool_start', toolName: 'shell', toolCallId: 'c1' } as AgentControllerEvent, state);
    expect(out).toEqual({ stderr: '[tool] shell\n' });
  });

  it('routes errors to stderr', () => {
    const state = createHumanFormatState();
    const out = formatHuman(
      { type: 'error', error: { name: 'Error', message: 'boom' } } as AgentControllerEvent,
      state,
    );
    expect(out).toEqual({ stderr: '[error] boom\n' });
  });
});

describe('formatJsonl', () => {
  it('returns a plain object copy of the event', () => {
    const event = { type: 'tool_start', toolName: 'shell', toolCallId: 'c1' } as AgentControllerEvent;
    expect(formatJsonl(event)).toEqual({ type: 'tool_start', toolName: 'shell', toolCallId: 'c1' });
  });
});

describe('result renderers', () => {
  const result: RunMCResult = {
    status: 'completed',
    text: 'The answer is 4.',
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    toolCalls: [],
    toolResults: [],
    threadId: 'thread-1',
    exitCode: 0,
  };

  it('renderTextResult terminates with a single newline', () => {
    expect(renderTextResult(result)).toBe('The answer is 4.\n');
    expect(renderTextResult({ ...result, text: 'x\n' })).toBe('x\n');
  });

  it('renderJsonResult emits a JSON object with the expected fields', () => {
    const parsed = JSON.parse(renderJsonResult(result));
    expect(parsed).toMatchObject({
      text: 'The answer is 4.',
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      threadId: 'thread-1',
    });
    expect(renderJsonResult(result).endsWith('\n')).toBe(true);
  });
});
