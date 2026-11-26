import { describe, expect, it } from 'vitest';

import { MessageList } from '../agent/message-list';
import type { ProcessInputStepArgs } from '../processors';
import { RequestContext } from '../request-context';
import { ChannelReplyGuidanceProcessor } from './reply-guidance-processor';
import type { ChannelReplyGuidanceOptions } from './reply-guidance-processor';

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

function instruction(
  requestContext: RequestContext,
  tools: Record<string, unknown> = {},
  options?: ChannelReplyGuidanceOptions,
): string {
  const messageList = new MessageList({});
  new ChannelReplyGuidanceProcessor(options).processInputStep(args(requestContext, messageList, tools));
  const added = messageList.getSystemMessages('channel-reply-guidance');
  expect(added).toHaveLength(1);
  return String(added[0]!.content);
}

describe('ChannelReplyGuidanceProcessor', () => {
  it('stays out of runs that did not come in over a channel', () => {
    const result = new ChannelReplyGuidanceProcessor().processInputStep(args(new RequestContext()));
    expect(result).toBeUndefined();
  });

  it('tells a channel run to open with a line naming the task, and leaves the session link to the link processor', () => {
    const text = instruction(channelContext());
    expect(text).toMatch(/reply first with one short line that says what you are about to do/);
    expect(text).not.toContain('↗');
    expect(text).not.toMatch(/session link|Open session/i);
  });

  it('points a run with the reply tool at the tool, and says staying quiet means not calling it', () => {
    const text = instruction(channelContext(), { reply_in_thread: {} });
    expect(text).toContain('Only messages you send with `reply_in_thread` reach this thread');
    expect(text).toContain("When a message that doesn't mention you needs nothing from you, don't call it.");
    expect(text).not.toMatch(/reply first with one short line/);
  });

  it('tells a Slack-linked run that did not start from Slack to post only the outcome there', () => {
    // A web prompt or woken run: no `channel`, but the session's thread mounted the reply tool.
    const text = instruction(new RequestContext(), { reply_in_thread: {} });
    expect(text).toContain('Post to that thread with `reply_in_thread`.');
    expect(text).toContain("don't post an opener or progress there");
    expect(text).not.toContain('Only messages you send with');
  });

  it("appends the host's instructions, told whether the run can reply", () => {
    const options = { instructions: ({ canReply }: { canReply: boolean }) => [canReply ? 'HOST REPLY' : 'HOST TEXT'] };
    expect(instruction(channelContext(), { reply_in_thread: {} }, options)).toContain('HOST REPLY');
    expect(instruction(new RequestContext(), { reply_in_thread: {} }, options)).toContain('HOST REPLY');
    expect(instruction(channelContext(), {}, options)).toContain('HOST TEXT');
    expect(instruction(channelContext(), {}, { instructions: ['STATIC'] })).toContain('STATIC');
  });

  it('tells every channel run to link the references it mentions', () => {
    const runs = [
      instruction(channelContext()),
      instruction(channelContext(), { reply_in_thread: {} }),
      instruction(new RequestContext(), { reply_in_thread: {} }),
    ];
    for (const text of runs) {
      expect(text).toContain('as a markdown link to its page');
      expect(text).toContain('[#28467](https://github.com/<owner>/<repo>/pull/28467)');
      expect(text).toContain("don't guess a URL");
    }
  });

  it('tells every channel run to write for the people in the thread, not another agent', () => {
    const runs = [
      instruction(channelContext()),
      instruction(channelContext(), { reply_in_thread: {} }),
      instruction(new RequestContext(), { reply_in_thread: {} }),
    ];
    for (const text of runs) {
      expect(text).toContain('Write for the people in the thread, not for another agent.');
      expect(text).toContain('Leave out tool names and run ids unless someone asks for them');
      expect(text).toContain('always leave out agent shorthand');
      expect(text).toContain('never paste its report');
    }
  });

  it('adds the instruction once across steps', () => {
    const requestContext = channelContext();
    const messageList = new MessageList({});
    const processor = new ChannelReplyGuidanceProcessor();

    processor.processInputStep(args(requestContext, messageList));
    processor.processInputStep(args(requestContext, messageList));

    expect(messageList.getSystemMessages('channel-reply-guidance')).toHaveLength(1);
  });
});
