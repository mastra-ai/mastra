import { MessageList } from '@mastra/core/agent';
import type { ProcessInputStepArgs } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FactoryChannelReplyProcessor, sessionLink } from './channel-reply-processor.js';

function args(requestContext: RequestContext, messageList = new MessageList({})): ProcessInputStepArgs {
  return { messageList, requestContext } as unknown as ProcessInputStepArgs;
}

function channelContext({
  threadId = 'uuid-thread-1',
  resourceId = 'us-42',
  factoryProjectId = 'fp-1',
}: { threadId?: string | null; resourceId?: string; factoryProjectId?: string } = {}) {
  const requestContext = new RequestContext();
  requestContext.set('channel', { platform: 'slack', isDM: true });
  requestContext.set('controller', { threadId, resourceId, getState: () => ({ factoryProjectId }) });
  return requestContext;
}

function instruction(requestContext: RequestContext): string {
  const messageList = new MessageList({});
  new FactoryChannelReplyProcessor().processInputStep(args(requestContext, messageList));
  const added = messageList.getSystemMessages('factory-channel-reply');
  expect(added).toHaveLength(1);
  return String(added[0]!.content);
}

describe('FactoryChannelReplyProcessor', () => {
  const originalPublicUrl = process.env.MASTRACODE_PUBLIC_URL;
  beforeEach(() => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
  });
  afterEach(() => {
    if (originalPublicUrl === undefined) delete process.env.MASTRACODE_PUBLIC_URL;
    else process.env.MASTRACODE_PUBLIC_URL = originalPublicUrl;
  });

  it('stays out of runs that did not come in over a channel', () => {
    const result = new FactoryChannelReplyProcessor().processInputStep(args(new RequestContext()));
    expect(result).toBeUndefined();
  });

  it('tells a channel run to open with a line naming the task, signed with the session link', () => {
    const text = instruction(channelContext());
    expect(text).toMatch(/reply first with one short line that says what you are about to do/);
    expect(text).toContain('[↗](https://mc.example.com/factories/fp-1/workspaces/us-42/threads/uuid-thread-1)');
  });

  it('leaves the link out when there is no public origin', () => {
    delete process.env.MASTRACODE_PUBLIC_URL;
    const text = instruction(channelContext());
    expect(text).toMatch(/reply first with one short line/);
    expect(text).not.toContain('[↗]');
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

  it('a repo-backed thread deep-links to the user-session workspace route with no resourceId param', () => {
    expect(sessionLink(channelContext())).toBe(
      'https://mc.example.com/factories/fp-1/workspaces/us-42/threads/uuid-thread-1',
    );
  });

  it('a chat-only thread keeps the channel workspace segment and names its resource in the query', () => {
    expect(sessionLink(channelContext({ resourceId: 'channel:slack:C-1:1700.42' }))).toBe(
      'https://mc.example.com/factories/fp-1/workspaces/channel/threads/uuid-thread-1' +
        `?resourceId=${encodeURIComponent('channel:slack:C-1:1700.42')}`,
    );
  });

  it('a session with no factory falls back to the factory-agnostic redirect', () => {
    expect(sessionLink(channelContext({ factoryProjectId: '' }))).toBe(
      'https://mc.example.com/threads/uuid-thread-1?resourceId=us-42',
    );
  });

  it('is undefined without a public origin or a thread', () => {
    expect(sessionLink(channelContext({ threadId: null }))).toBeUndefined();
    delete process.env.MASTRACODE_PUBLIC_URL;
    expect(sessionLink(channelContext())).toBeUndefined();
  });
});
