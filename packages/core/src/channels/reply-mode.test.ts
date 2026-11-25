import { describe, expect, it } from 'vitest';

import { RequestContext } from '../request-context';
import type { ChunkType } from '../stream';
import { channelReplyMode, channelReplyTypingStatus } from './reply-mode';
import { REPLY_TOOL_NAME } from './reply-tool';
import type { TypingStatusContext } from './typing-status';

const ctx = {} as TypingStatusContext;
const chunk = (type: string, payload: Record<string, unknown> = {}) => ({ type, payload }) as unknown as ChunkType;

describe('channelReplyTypingStatus', () => {
  const status = channelReplyTypingStatus();

  it('names the step the agent is on', () => {
    expect(status(chunk('reasoning-delta'), ctx)).toBe('is thinking...');
    expect(
      status(chunk('tool-call', { toolName: 'shell', args: { description: 'Running the tests\nmore' } }), ctx),
    ).toBe('is running the tests');
    expect(status(chunk('tool-call', { toolName: 'gh', args: { description: 'PR lookup' } }), ctx)).toBe(
      'is PR lookup',
    );
    expect(status(chunk('tool-call', { toolName: 'shell', args: {} }), ctx)).toBe('is working...');
    expect(status(chunk('tool-call-input-streaming-start', { toolName: REPLY_TOOL_NAME }), ctx)).toBe('is typing...');
  });

  it("stays under Slack's 50-character status limit", () => {
    const long = status(chunk('tool-call', { toolName: 'shell', args: { description: 'x'.repeat(80) } }), ctx);
    expect(long).toHaveLength(50);
    expect(long).toMatch(/…$/);
  });

  it('shows typing for reply text only when that text reaches the thread', () => {
    expect(status(chunk('text-delta'), ctx)).toBeUndefined();
    expect(channelReplyTypingStatus('show')(chunk('text-delta'), ctx)).toBe('is typing...');
  });
});

describe('channelReplyMode', () => {
  it('hides reply text and tool calls, and has the agent speak through reply_in_thread', () => {
    const mode = channelReplyMode({ link: { link: () => 'https://app.example.com/t/1' } });

    expect(mode.adapterOptions).toMatchObject({ textDisplay: 'hidden', toolDisplay: 'hidden' });
    expect(mode.processors.input.map(p => p.id)).toEqual(['channel-reply-reminder']);
    expect(mode.processors.output.map(p => p.id)).toEqual(['channel-thread-link', 'channel-reply-stream']);
    expect(Object.keys(mode.tools(new RequestContext()))).toEqual([REPLY_TOOL_NAME]);
  });

  it('with reply text shown, posts that text and offers no reply tool', () => {
    const mode = channelReplyMode({ textDisplay: 'show' });

    expect(mode.adapterOptions).toMatchObject({ textDisplay: 'show', toolDisplay: 'hidden' });
    expect(mode.processors.input).toEqual([]);
    expect(mode.processors.output).toEqual([]);
    expect(mode.tools(new RequestContext())).toEqual({});
  });
});
