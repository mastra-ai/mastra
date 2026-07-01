/**
 * Tests for packages/core/src/channels/stream-helpers.ts
 *
 * `extractErrorMessage`, `chunkToFallbackMessage`, and `renderBuiltInToolEvent`
 * are pure functions. `renderBuiltInToolEvent` delegates to the already-tested
 * `formatTool*` helpers in `./formatting`, so these tests verify correct routing
 * rather than re-testing the formatting output itself.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('./chat-lazy', () => ({
  chatModule: () => ({
    Actions: (props: unknown) => ({ type: 'Actions', props }),
    Button: (props: unknown) => ({ type: 'Button', props }),
    Card: (props: unknown) => ({ type: 'Card', props }),
    CardText: (text: string, options?: unknown) => ({ type: 'CardText', text, options }),
  }),
}));

import { formatToolApproval, formatToolResult, formatToolRunning } from './formatting';
import { chunkToFallbackMessage, extractErrorMessage, renderBuiltInToolEvent } from './stream-helpers';
import type { ToolDisplayEvent } from './types';

// ---------------------------------------------------------------------------
// extractErrorMessage
// ---------------------------------------------------------------------------

describe('extractErrorMessage', () => {
  it('returns null unchanged', () => {
    expect(extractErrorMessage(null)).toBeNull();
  });

  it('returns undefined unchanged', () => {
    expect(extractErrorMessage(undefined)).toBeUndefined();
  });

  it('returns a string unchanged', () => {
    expect(extractErrorMessage('plain error string')).toBe('plain error string');
  });

  it('extracts message from an Error instance', () => {
    expect(extractErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('extracts message from a plain object with a message field', () => {
    expect(extractErrorMessage({ message: 'something failed' })).toBe('something failed');
  });

  it('ignores an empty message field and falls through', () => {
    const result = extractErrorMessage({ message: '' });
    expect(result).toEqual({ message: '' });
  });

  it('extracts details.errorMessage when message is absent', () => {
    const result = extractErrorMessage({ details: { errorMessage: 'nested error' } });
    expect(result).toBe('nested error');
  });

  it('prefers top-level message over details.errorMessage', () => {
    const result = extractErrorMessage({
      message: 'top-level',
      details: { errorMessage: 'nested' },
    });
    expect(result).toBe('top-level');
  });

  it('returns the raw object when neither message nor details.errorMessage exist', () => {
    const obj = { code: 500, foo: 'bar' };
    expect(extractErrorMessage(obj)).toBe(obj);
  });

  it('returns a number unchanged', () => {
    expect(extractErrorMessage(42)).toBe(42);
  });

  it('returns a non-string message field unchanged at top level', () => {
    const obj = { message: 42 };
    expect(extractErrorMessage(obj)).toBe(obj);
  });
});

// ---------------------------------------------------------------------------
// chunkToFallbackMessage
// ---------------------------------------------------------------------------

describe('chunkToFallbackMessage', () => {
  it('returns text for a markdown_text chunk with content', () => {
    const chunk = { type: 'markdown_text', text: 'Hello world' } as any;
    expect(chunkToFallbackMessage(chunk)).toBe('Hello world');
  });

  it('returns null for a markdown_text chunk with empty text', () => {
    const chunk = { type: 'markdown_text', text: '' } as any;
    expect(chunkToFallbackMessage(chunk)).toBeNull();
  });

  it('returns null for a markdown_text chunk with non-string text', () => {
    const chunk = { type: 'markdown_text', text: undefined } as any;
    expect(chunkToFallbackMessage(chunk)).toBeNull();
  });

  it('formats a task_update with title and status', () => {
    const chunk = { type: 'task_update', title: 'Searching', status: 'running' } as any;
    expect(chunkToFallbackMessage(chunk)).toBe('Searching · running');
  });

  it('formats a task_update with title, status, and details', () => {
    const chunk = {
      type: 'task_update',
      title: 'Searching',
      status: 'done',
      details: 'Found 5 results',
    } as any;
    expect(chunkToFallbackMessage(chunk)).toBe('Searching · done\nFound 5 results');
  });

  it('falls back to output when details is absent', () => {
    const chunk = { type: 'task_update', title: 'Task', output: 'output text' } as any;
    expect(chunkToFallbackMessage(chunk)).toBe('Task\noutput text');
  });

  it('returns null for a task_update with no title, status, details, or output', () => {
    const chunk = { type: 'task_update' } as any;
    expect(chunkToFallbackMessage(chunk)).toBeNull();
  });

  it('formats a task_update with only status (no title)', () => {
    const chunk = { type: 'task_update', status: 'pending' } as any;
    expect(chunkToFallbackMessage(chunk)).toBe('· pending');
  });

  it('returns title for a plan_update chunk', () => {
    const chunk = { type: 'plan_update', title: 'My Plan' } as any;
    expect(chunkToFallbackMessage(chunk)).toBe('My Plan');
  });

  it('returns null for a plan_update chunk with empty title', () => {
    const chunk = { type: 'plan_update', title: '' } as any;
    expect(chunkToFallbackMessage(chunk)).toBeNull();
  });

  it('returns null for an unrecognised chunk type', () => {
    const chunk = { type: 'text-delta', textDelta: 'hi' } as any;
    expect(chunkToFallbackMessage(chunk)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// renderBuiltInToolEvent
// ---------------------------------------------------------------------------

describe('renderBuiltInToolEvent', () => {
  const runningEvent: ToolDisplayEvent = {
    kind: 'running',
    toolCallId: 'call-1',
    toolName: 'search',
    displayName: 'search',
    argsSummary: 'cats',
    args: { query: 'cats' },
  };

  const resultEvent: ToolDisplayEvent = {
    kind: 'result',
    toolCallId: 'call-1',
    toolName: 'search',
    displayName: 'search',
    argsSummary: 'cats',
    args: { query: 'cats' },
    result: { count: 5 },
    resultText: '5 results',
    durationMs: 120,
    isError: false,
  };

  const errorEvent: ToolDisplayEvent = {
    kind: 'error',
    toolCallId: 'call-1',
    toolName: 'search',
    displayName: 'search',
    argsSummary: 'cats',
    args: { query: 'cats' },
    error: new Error('timeout'),
    errorText: 'timeout',
    durationMs: 50,
  };

  const approvalEvent: ToolDisplayEvent = {
    kind: 'approval',
    toolCallId: 'call-1',
    toolName: 'run_code',
    displayName: 'run_code',
    argsSummary: 'print()',
    args: { code: 'print()' },
  };

  it('routes a "running" event to the text formatter in text mode', () => {
    const result = renderBuiltInToolEvent(runningEvent, 'text');
    expect(result).toBe(formatToolRunning('search', 'cats', false));
  });

  it('routes a "result" event to the text formatter', () => {
    const result = renderBuiltInToolEvent(resultEvent, 'text');
    expect(result).toBe(formatToolResult('search', 'cats', '5 results', false, 120, false));
  });

  it('routes an "error" event using errorText and isError=true', () => {
    const result = renderBuiltInToolEvent(errorEvent, 'text');
    expect(result).toBe(formatToolResult('search', 'cats', 'timeout', true, 50, false));
  });

  it('routes approval events to the card formatter even in text mode', () => {
    const result = renderBuiltInToolEvent(approvalEvent, 'text');
    expect(result).toEqual(formatToolApproval('run_code', 'print()', 'call-1', true));
  });

  it('routes a "running" event to mode-specific formatters', () => {
    expect(renderBuiltInToolEvent(runningEvent, 'text')).toBe(formatToolRunning('search', 'cats', false));
    expect(renderBuiltInToolEvent(runningEvent, 'cards')).toEqual(formatToolRunning('search', 'cats', true));
  });
});
