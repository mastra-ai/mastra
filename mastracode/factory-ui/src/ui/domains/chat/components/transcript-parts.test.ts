import type { ToolInvocationPart } from '@mastra/react/ui';
import { describe, expect, it } from 'vitest';

import type { ToolCall } from '../services/transcript';
import { messageText, toolFromInvocationPart } from './transcript-parts';
import type { MessagePart } from './transcript-parts';

describe('messageText', () => {
  it('keeps the copyable prose free of thinking and tool rows', () => {
    const parts: MessagePart[] = [
      { type: 'reasoning', reasoning: 'Need the core package first', details: [] },
      { type: 'text', text: 'Reading the file' },
      {
        type: 'tool-invocation',
        toolInvocation: { state: 'call', toolCallId: 'call-1', toolName: 'read_file', args: {} },
      },
      { type: 'text', text: 'Done' },
    ];

    expect(messageText(parts)).toBe('Reading the file\n\nDone');
  });
});

describe('toolFromInvocationPart', () => {
  const PART_AT = Date.parse('2026-09-05T15:42:05.000Z');
  const START_AT = Date.parse('2026-09-05T15:42:06.000Z');
  const MESSAGE_AT = new Date('2026-09-05T15:42:00.000Z');

  const part = (createdAt?: number): ToolInvocationPart => ({
    type: 'tool-invocation',
    toolInvocation: { state: 'call', toolCallId: 'call-1', toolName: 'read_file', args: {} },
    ...(createdAt === undefined ? {} : { createdAt }),
  });
  const runtime = (createdAt?: number): ToolCall => ({
    toolCallId: 'call-1',
    toolName: 'read_file',
    argsText: '',
    status: 'running',
    output: '',
    createdAt,
  });

  it('prefers the stamp core persisted on the part', () => {
    expect(toolFromInvocationPart(part(PART_AT), runtime(START_AT), MESSAGE_AT).createdAt).toBe(PART_AT);
  });

  it('falls back to when the live call started', () => {
    expect(toolFromInvocationPart(part(), runtime(START_AT), MESSAGE_AT).createdAt).toBe(START_AT);
  });

  it('falls back to the containing message, even when history arrived as an ISO string', () => {
    expect(toolFromInvocationPart(part(), runtime(), MESSAGE_AT).createdAt).toBe(MESSAGE_AT.getTime());
    expect(toolFromInvocationPart(part(), undefined, MESSAGE_AT.toISOString()).createdAt).toBe(MESSAGE_AT.getTime());
  });

  it('leaves the row unstamped when nothing carries a time', () => {
    expect(toolFromInvocationPart(part(), runtime()).createdAt).toBeUndefined();
  });

  it('leaves the row unstamped rather than carrying NaN from an unparseable message date', () => {
    expect(toolFromInvocationPart(part(), runtime(), 'not a date').createdAt).toBeUndefined();
  });
});
