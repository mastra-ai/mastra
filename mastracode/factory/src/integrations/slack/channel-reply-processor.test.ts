import { MessageList } from '@mastra/core/agent';
import type { ProcessInputStepArgs } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FactoryChannelReplyProcessor, sessionLink } from './channel-reply-processor.js';

function args(
  requestContext: RequestContext,
  messageList = new MessageList({}),
  tools: Record<string, unknown> = {},
): ProcessInputStepArgs {
  return { messageList, requestContext, tools } as unknown as ProcessInputStepArgs;
}

function channelContext() {
  const requestContext = new RequestContext();
  requestContext.set('channel', { platform: 'slack', isDM: true });
  return requestContext;
}

function instruction(requestContext: RequestContext, tools: Record<string, unknown> = {}): string {
  const messageList = new MessageList({});
  new FactoryChannelReplyProcessor().processInputStep(args(requestContext, messageList, tools));
  const added = messageList.getSystemMessages('factory-channel-reply');
  expect(added).toHaveLength(1);
  return String(added[0]!.content);
}

describe('FactoryChannelReplyProcessor', () => {
  it('stays out of runs that did not come in over a channel', () => {
    const result = new FactoryChannelReplyProcessor().processInputStep(args(new RequestContext()));
    expect(result).toBeUndefined();
  });

  it('tells a channel run to open with a line naming the task, and leaves the session link to the link processor', () => {
    const text = instruction(channelContext());
    expect(text).toMatch(/reply first with one short line that says what you are about to do/);
    expect(text).not.toContain('↗');
    expect(text).not.toMatch(/link/i);
  });

  it('points a run with the reply tool at the tool, and says staying quiet means not calling it', () => {
    const text = instruction(channelContext(), { reply_in_thread: {} });
    expect(text).toContain('Only messages you send with `reply_in_thread` reach this thread');
    expect(text).toContain("When a message needs nothing from you, don't call it.");
    expect(text).not.toMatch(/reply first with one short line/);
  });

  it('tells a Slack-linked run that did not start from Slack to post only the outcome there', () => {
    // A web prompt or woken run: no `channel`, but the session's thread mounted the reply tool.
    const text = instruction(new RequestContext(), { reply_in_thread: {} });
    expect(text).toContain('Post to that thread with `reply_in_thread`.');
    expect(text).toContain("don't post an opener or progress there");
    expect(text).not.toContain('Only messages you send with');
  });

  it('tells every run with the reply tool that pull request links are posted for it', () => {
    // A merge wakes the session without `channel`, so the woken run needs this too.
    for (const requestContext of [new RequestContext(), channelContext()]) {
      expect(instruction(requestContext, { reply_in_thread: {} })).toContain("so don't post the link yourself");
    }
  });

  it('adds the instruction once across steps', () => {
    const requestContext = channelContext();
    const messageList = new MessageList({});
    const processor = new FactoryChannelReplyProcessor();

    processor.processInputStep(args(requestContext, messageList));
    processor.processInputStep(args(requestContext, messageList));

    expect(messageList.getSystemMessages('factory-channel-reply')).toHaveLength(1);
  });
});

describe('sessionLink', () => {
  const originalPublicUrl = process.env.MASTRACODE_PUBLIC_URL;
  beforeEach(() => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
  });
  afterEach(() => {
    if (originalPublicUrl === undefined) delete process.env.MASTRACODE_PUBLIC_URL;
    else process.env.MASTRACODE_PUBLIC_URL = originalPublicUrl;
  });

  const target = { threadId: 'uuid-thread-1', sessionId: 'us-42', resourceId: 'fp-1', factoryProjectId: 'fp-1' };

  it('a repo-backed thread deep-links to the user-session workspace route with no query param', () => {
    expect(sessionLink(target)).toBe('https://mc.example.com/factories/fp-1/workspaces/us-42/threads/uuid-thread-1');
  });

  it('a chat-only thread keeps the channel workspace segment and names its resource in the query', () => {
    expect(
      sessionLink({ ...target, sessionId: 'channel:slack:C-1:1700.42', resourceId: 'channel:slack:C-1:1700.42' }),
    ).toBe(
      'https://mc.example.com/factories/fp-1/workspaces/channel/threads/uuid-thread-1' +
        `?sessionId=${encodeURIComponent('channel:slack:C-1:1700.42')}`,
    );
  });

  it('a session with no factory falls back to the factory-agnostic redirect', () => {
    expect(sessionLink({ ...target, factoryProjectId: undefined })).toBe(
      'https://mc.example.com/threads/uuid-thread-1?sessionId=us-42',
    );
  });

  it('is undefined without a public origin', () => {
    delete process.env.MASTRACODE_PUBLIC_URL;
    expect(sessionLink(target)).toBeUndefined();
  });
});
