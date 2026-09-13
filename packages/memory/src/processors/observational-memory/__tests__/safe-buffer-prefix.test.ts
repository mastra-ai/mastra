import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { describe, expect, it } from 'vitest';

import { selectSafeBufferPrefix } from '../observation-turn/safe-buffer-prefix';

function message(id: string, createdAt: number, toolCalls: Array<{ id: string; state: 'call' | 'result' }> = []) {
  return {
    id,
    role: 'assistant',
    type: 'text',
    createdAt: new Date(createdAt),
    content: {
      format: 2,
      parts: [
        { type: 'text', text: id },
        ...toolCalls.map(call => ({
          type: 'tool-invocation' as const,
          toolInvocation: { state: call.state, toolCallId: call.id, toolName: 'tool', args: {}, result: undefined },
        })),
      ],
    } as MastraMessageContentV2,
  } as MastraDBMessage;
}

const ids = (messages: MastraDBMessage[]) => messages.map(m => m.id);

describe('selectSafeBufferPrefix', () => {
  it('returns every message chronologically when nothing is pending', () => {
    const result = selectSafeBufferPrefix([message('b', 200), message('a', 100), message('c', 300)]);
    expect(ids(result)).toEqual(['a', 'b', 'c']);
  });

  it('returns every message when the newest tool call is already resolved', () => {
    const result = selectSafeBufferPrefix([message('a', 100), message('b', 200, [{ id: 't', state: 'result' }])]);
    expect(ids(result)).toEqual(['a', 'b']);
  });

  it('returns the prefix before a call pending on the newest message', () => {
    const result = selectSafeBufferPrefix([
      message('a', 100),
      message('b', 200),
      message('c', 300, [{ id: 't', state: 'call' }]),
    ]);
    expect(ids(result)).toEqual(['a', 'b']);
  });

  it('treats an older pending call as abandoned once the conversation continues', () => {
    const result = selectSafeBufferPrefix([
      message('a', 100, [{ id: 'old', state: 'call' }]),
      message('b', 200),
      message('c', 300),
    ]);
    expect(ids(result)).toEqual(['a', 'b', 'c']);
  });

  it('returns nothing when the newest message is the only candidate and is pending', () => {
    expect(selectSafeBufferPrefix([message('a', 100, [{ id: 't', state: 'call' }])])).toEqual([]);
  });

  it.each([{ gap: 0 }, { gap: 1 }])('defers when the retained message is only $gap ms newer', ({ gap }) => {
    const result = selectSafeBufferPrefix([
      message('a', 100),
      message('b', 200),
      message('c', 200 + gap, [{ id: 't', state: 'call' }]),
    ]);
    expect(result).toEqual([]);
  });

  it('buffers the prefix when the retained message is 2 ms newer', () => {
    const result = selectSafeBufferPrefix([message('a', 100), message('b', 200, [{ id: 't', state: 'call' }])]);
    expect(ids(result)).toEqual(['a']);
    const adjacent = selectSafeBufferPrefix([message('a', 198), message('b', 200, [{ id: 't', state: 'call' }])]);
    expect(ids(adjacent)).toEqual(['a']);
  });

  it('defers when a tool call id spans the cut', () => {
    const result = selectSafeBufferPrefix([
      message('a', 100, [{ id: 'shared', state: 'result' }]),
      message('b', 300, [
        { id: 'shared', state: 'result' },
        { id: 't', state: 'call' },
      ]),
    ]);
    expect(result).toEqual([]);
  });

  it('returns an empty array for no input', () => {
    expect(selectSafeBufferPrefix([])).toEqual([]);
  });
});
