import { MessageList } from '@mastra/core/agent';
import { ChannelReplyGuidanceProcessor } from '@mastra/core/channels';
import type { ProcessInputStepArgs } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { factoryReplyInstructions, sessionLink } from './channel-reply-processor.js';

function instruction(requestContext: RequestContext, tools: Record<string, unknown> = {}): string {
  const messageList = new MessageList({});
  new ChannelReplyGuidanceProcessor({ instructions: factoryReplyInstructions }).processInputStep({
    messageList,
    requestContext,
    tools,
  } as unknown as ProcessInputStepArgs);
  return String(messageList.getSystemMessages('channel-reply-guidance')[0]!.content);
}

function channelContext() {
  const requestContext = new RequestContext();
  requestContext.set('channel', { platform: 'slack', isDM: true });
  return requestContext;
}

describe('factoryReplyInstructions', () => {
  it('tells every run with the reply tool that pull request links are posted for it', () => {
    // A merge wakes the session without `channel`, so the woken run needs this too.
    for (const requestContext of [new RequestContext(), channelContext()]) {
      expect(instruction(requestContext, { reply_in_thread: {} })).toContain("so don't post the link yourself");
    }
    expect(instruction(channelContext())).not.toContain("so don't post the link yourself");
  });

  it('tells every channel run how to link GitHub, Linear and Factory references', () => {
    for (const text of [instruction(channelContext()), instruction(new RequestContext(), { reply_in_thread: {} })]) {
      expect(text).toContain('the repositories listed in your environment');
      expect(text).toContain('workspace URL pattern in the `linear_get_issue` tool description');
      expect(text).toContain('the `url` the Factory tools return');
    }
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
