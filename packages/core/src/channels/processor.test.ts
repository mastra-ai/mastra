import type { CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';
import { describe, it, expect } from 'vitest';

import { MessageList } from '../agent/message-list';
import type { ProcessInputStepArgs } from '../processors/index';
import { RequestContext } from '../request-context';
import { ChatChannelProcessor } from './processor';
import type { ChannelContext } from './types';

function createArgs(opts: {
  channel?: ChannelContext;
  messageList?: MessageList;
  systemMessages?: CoreMessageV4[];
}): ProcessInputStepArgs {
  const requestContext = new RequestContext();
  if (opts.channel) {
    requestContext.set('channel', opts.channel);
  }

  const messageList = opts.messageList ?? new MessageList({});

  return {
    messageList,
    messages: [],
    requestContext,
    stepNumber: 0,
    steps: [],
    systemMessages: opts.systemMessages ?? [],
    state: {},
    retryCount: 0,
    model: {} as any,
    abort: (() => {
      throw new Error('abort');
    }) as any,
  } as unknown as ProcessInputStepArgs;
}

describe('ChatChannelProcessor', () => {
  it('returns undefined when no channel context is set', () => {
    const processor = new ChatChannelProcessor();
    const result = processor.processInputStep(createArgs({}));
    expect(result).toBeUndefined();
  });

  it('preserves tagged system messages added by other processors', () => {
    // Simulate ObservationalMemory (or any other processor) having added a
    // tagged system message to the messageList before ChatChannelProcessor runs.
    const messageList = new MessageList({});
    messageList.addSystem({ role: 'system', content: 'observational memory: user prefers dark mode' }, 'om');
    messageList.addSystem({ role: 'system', content: 'agent base instructions' }, 'instructions');

    const processor = new ChatChannelProcessor();
    const args = createArgs({
      channel: { platform: 'slack', isDM: true, userName: 'caleb' } as ChannelContext,
      messageList,
      // The runner builds args.systemMessages from getAllSystemMessages(), which
      // flattens tagged messages into a single untagged array.
      systemMessages: messageList.getAllSystemMessages(),
    });

    const result = processor.processInputStep(args);

    // Apply the result the same way ProcessorRunner does for ProcessInputStepResult:
    // if `systemMessages` is returned, it calls replaceAllSystemMessages.
    if (result && 'systemMessages' in result && result.systemMessages) {
      args.messageList.replaceAllSystemMessages(result.systemMessages);
    }

    // The tagged messages must still be retrievable by tag after processing.
    const omAfter = args.messageList.getSystemMessages('om');
    expect(omAfter).toHaveLength(1);
    expect(omAfter[0]!.content).toBe('observational memory: user prefers dark mode');

    const instructionsAfter = args.messageList.getSystemMessages('instructions');
    expect(instructionsAfter).toHaveLength(1);
    expect(instructionsAfter[0]!.content).toBe('agent base instructions');

    // And the channel system message should be present somewhere in the full set.
    const all = args.messageList.getAllSystemMessages();
    const hasChannel = all.some(m => typeof m.content === 'string' && m.content.includes('communicating via slack'));
    expect(hasChannel).toBe(true);
  });

  it('does not re-add a duplicate channel system message across steps', () => {
    const messageList = new MessageList({});
    const processor = new ChatChannelProcessor();
    const channel: ChannelContext = { platform: 'slack', isDM: true, userName: 'caleb' } as ChannelContext;

    // Step 1
    const args1 = createArgs({ channel, messageList, systemMessages: messageList.getAllSystemMessages() });
    const result1 = processor.processInputStep(args1);
    if (result1 && 'systemMessages' in result1 && result1.systemMessages) {
      args1.messageList.replaceAllSystemMessages(result1.systemMessages);
    }

    // Step 2 — same channel context, system messages list is re-derived
    const args2 = createArgs({ channel, messageList, systemMessages: messageList.getAllSystemMessages() });
    const result2 = processor.processInputStep(args2);
    if (result2 && 'systemMessages' in result2 && result2.systemMessages) {
      args2.messageList.replaceAllSystemMessages(result2.systemMessages);
    }

    const channelMessages = messageList
      .getAllSystemMessages()
      .filter(m => typeof m.content === 'string' && m.content.includes('communicating via slack'));
    expect(channelMessages).toHaveLength(1);
  });
});
