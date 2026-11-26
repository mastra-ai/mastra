import { describe, expect, it } from 'vitest';

import { MessageList } from '../../agent/message-list';
import { REPROCESS_PART_KEY } from '../../processors/stream-reprocess';
import { RequestContext } from '../../request-context';
import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from '../output-processor';
import { ChannelThreadLinkProcessor, markNewChannelThread } from '../thread-link-processor';

const SUFFIX = '\n\n[Open thread ↗](https://app.test/threads/t1)';

function run({
  isNew = true,
  hidden = false,
  link = (threadId?: string) => `https://app.test/threads/${threadId}`,
} = {}) {
  const requestContext = new RequestContext();
  requestContext.set('MastraMemory', { thread: { id: 't1' }, resourceId: 'slack:U1' });
  if (isNew) markNewChannelThread(requestContext);
  if (hidden) requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, { textDisplay: 'hidden' });
  const processor = new ChannelThreadLinkProcessor({ link: ({ threadId }) => link(threadId) });
  const state: Record<string, unknown> = {};
  const feed = (part: any) => processor.processOutputStream({ part, state, requestContext } as any);
  return { processor, state, feed, requestContext };
}

const text = { type: 'text-delta', runId: 'r', from: 'AGENT', payload: { id: 'b1', text: 'Hi' } };
const toolCall = { type: 'tool-call', runId: 'r', from: 'AGENT', payload: { toolCallId: 'c', toolName: 'x' } };
const stepFinish = { type: 'step-finish', runId: 'r', from: 'AGENT', payload: {} };

describe('ChannelThreadLinkProcessor', () => {
  it('posts the link once, after the first reply ends at a tool call', async () => {
    const { feed, state } = run();
    expect(await feed(text)).toBe(text);
    const link = await feed(toolCall);
    expect(link).toMatchObject({ type: 'text-delta', payload: { text: SUFFIX } });
    expect(state[REPROCESS_PART_KEY]).toBe(toolCall);
    delete state[REPROCESS_PART_KEY];
    expect(await feed(text)).toBe(text);
    expect(await feed(stepFinish)).toBe(stepFinish);
  });

  it('posts the link at step-finish when the reply uses no tools', async () => {
    const { feed } = run();
    await feed(text);
    expect(await feed(stepFinish)).toMatchObject({ payload: { text: SUFFIX } });
  });

  it('waits for reply text before linking', async () => {
    const { feed } = run();
    expect(await feed(toolCall)).toBe(toolCall);
  });

  it('does not count blank text as a reply', async () => {
    const { feed } = run();
    await feed({ ...text, payload: { id: 'b1', text: ' \n' } });
    expect(await feed(stepFinish)).toBe(stepFinish);
  });

  it('posts nothing on a reused thread, with hidden text, or without a URL', async () => {
    for (const options of [{ isNew: false }, { hidden: true }]) {
      const { feed } = run(options);
      await feed(text);
      expect(await feed(stepFinish)).toBe(stepFinish);
    }
    const requestContext = new RequestContext();
    markNewChannelThread(requestContext);
    const processor = new ChannelThreadLinkProcessor({ link: () => undefined });
    const state = {};
    await processor.processOutputStream({ part: text, state, requestContext } as any);
    expect(await processor.processOutputStream({ part: stepFinish, state, requestContext } as any)).toBe(stepFinish);
  });

  function saved(suffix: string) {
    const messageList = new MessageList({ threadId: 't1', resourceId: 'slack:U1' });
    messageList.add(
      {
        id: 'm1',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            { type: 'text', text: 'Hi' },
            { type: 'text', text: suffix },
          ],
        },
      } as any,
      'response',
    );
    return messageList;
  }

  it('keeps the link it posted out of the saved message', async () => {
    const { processor, feed, requestContext } = run();
    await feed(text);
    await feed(stepFinish);
    const messageList = saved(SUFFIX);
    processor.processOutputStep({ messageList, requestContext } as any);
    expect(messageList.get.response.db()[0]!.content.parts).toEqual([
      expect.objectContaining({ type: 'text', text: 'Hi' }),
    ]);
  });

  it('strips the link it posted even when the link changes on every call', async () => {
    let n = 0;
    const { processor, feed, requestContext } = run({ link: () => `https://app.test/signed?n=${++n}` });
    await feed(text);
    const posted = ((await feed(stepFinish)) as any).payload.text as string;
    const messageList = saved(posted);
    processor.processOutputStep({ messageList, requestContext } as any);
    expect(messageList.get.response.db()[0]!.content.parts).toEqual([
      expect.objectContaining({ type: 'text', text: 'Hi' }),
    ]);
  });

  it('leaves the saved message alone when it posted no link', () => {
    const { processor, requestContext } = run();
    const messageList = saved(SUFFIX);
    processor.processOutputStep({ messageList, requestContext } as any);
    expect(messageList.get.response.db()[0]!.content.parts).toHaveLength(2);
  });
});
