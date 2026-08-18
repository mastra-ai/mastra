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

function textMessage(text: string) {
  return { role: 'assistant' as const, content: { format: 2 as const, parts: [{ type: 'text' as const, text }] } };
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
  it('streams only newly-appended assistant text via the state cursor', () => {
    const state = createHumanFormatState();
    const first = formatHuman({ type: 'message_update', message: textMessage('Hello') } as AgentControllerEvent, state);
    expect(first).toEqual({ stdout: 'Hello' });

    const second = formatHuman(
      { type: 'message_update', message: textMessage('Hello world') } as AgentControllerEvent,
      state,
    );
    expect(second).toEqual({ stdout: ' world' });
  });

  it('emits nothing when the text has not grown', () => {
    const state = createHumanFormatState();
    formatHuman({ type: 'message_update', message: textMessage('Hi') } as AgentControllerEvent, state);
    const repeat = formatHuman({ type: 'message_update', message: textMessage('Hi') } as AgentControllerEvent, state);
    expect(repeat).toEqual({});
  });

  it('resets the cursor and emits a trailing newline on message_end', () => {
    const state = createHumanFormatState();
    formatHuman({ type: 'message_update', message: textMessage('Hi') } as AgentControllerEvent, state);
    expect(formatHuman({ type: 'message_end', message: textMessage('Hi') } as AgentControllerEvent, state)).toEqual({
      stdout: '\n',
    });
    expect(state.lastTextLength).toBe(0);
  });

  it('ignores non-assistant message_end (e.g. echoed user prompt) so it never reaches stdout', () => {
    const state = createHumanFormatState();
    const userEcho = {
      type: 'message_end' as const,
      message: {
        role: 'user' as const,
        content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'Do the thing.' }] },
      },
    };
    expect(formatHuman(userEcho as AgentControllerEvent, state)).toEqual({});
    // The cursor must remain untouched so a subsequent assistant turn streams correctly.
    expect(state.lastTextLength).toBe(0);
  });

  it('flushes trailing assistant text on message_end when message_update never streamed it', () => {
    const state = createHumanFormatState();
    const out = formatHuman(
      { type: 'message_end', message: textMessage('Final answer') } as AgentControllerEvent,
      state,
    );
    expect(out).toEqual({ stdout: 'Final answer\n' });
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
