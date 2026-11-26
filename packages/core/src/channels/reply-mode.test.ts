import { describe, expect, it } from 'vitest';

import { MessageList } from '../agent/message-list';
import type { ProcessInputStepArgs } from '../processors';
import { RequestContext } from '../request-context';
import type { ChunkType } from '../stream';
import { ChannelReplyModeProcessor, channelReplyTypingStatus } from './reply-mode';
import type { ChannelReplyModeAdapter } from './reply-mode';
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

  it('falls back to a generic status when a tool call carries no usable description', () => {
    const describe = (args: unknown) => status(chunk('tool-call', { toolName: 'shell', args }), ctx);
    expect(describe({ description: '\n  Fix the   flaky\tlogin test\n\nIt fails' })).toBe(
      'is fix the flaky login test',
    );
    expect(describe({ description: '   \n ' })).toBe('is working...');
    expect(describe({ description: 42 })).toBe('is working...');
    expect(describe('{"description":"raw string"}')).toBe('is working...');
    expect(status(chunk('tool-call-input-streaming-start', { toolName: 'search' }), ctx)).toBeUndefined();
  });
});

describe('ChannelReplyModeProcessor', () => {
  const render = { platform: 'slack', textDisplay: 'hidden', chatThread: {} } as never;

  async function step(adapter: ChannelReplyModeAdapter | undefined, found: unknown = render, activeTools?: string[]) {
    const messageList = new MessageList({});
    const requestContext = new RequestContext();
    requestContext.set('channel', { platform: 'slack', isDM: false });
    const processor = new ChannelReplyModeProcessor({
      resolveRender: async () => found as never,
      adapter: () => adapter,
    });
    const result = await processor.processInputStep({
      messageList,
      requestContext,
      tools: { other: {} },
      activeTools,
      state: {},
    } as unknown as ProcessInputStepArgs);
    return { result, guidance: messageList.getSystemMessages('channel-reply-guidance') };
  }

  it("adds reply_in_thread and the reply guidance on a run whose thread's adapter is in reply mode", async () => {
    const { result, guidance } = await step({ replyMode: { instructions: ['Link the PR.'] } });
    expect(Object.keys(result!.tools!)).toEqual(['other', REPLY_TOOL_NAME]);
    expect(guidance).toHaveLength(1);
    expect(String(guidance[0]!.content)).toContain('Link the PR.');
  });

  it('leaves runs alone when the adapter is not in reply mode or the run has no chat thread', async () => {
    expect((await step({})).result).toBeUndefined();
    expect((await step({ replyMode: 'tool' }, null)).result).toBeUndefined();
  });

  it('keeps the guidance but adds no reply tool when reply text is shown', async () => {
    const shown = { platform: 'slack', textDisplay: 'show', chatThread: {} };
    const { result, guidance } = await step({ replyMode: { instructions: ['Link the PR.'] } }, shown);
    expect(result).not.toHaveProperty('tools');
    expect(String(guidance[0]!.content)).toContain('Link the PR.');
  });

  it('adds reply_in_thread to a run that narrows its active tools', async () => {
    const { result } = await step({ replyMode: 'tool' }, render, ['other']);
    expect(result!.activeTools).toEqual(['other', REPLY_TOOL_NAME]);
    expect((await step({ replyMode: 'tool' })).result).not.toHaveProperty('activeTools');
  });
});
