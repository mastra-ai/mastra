import { describe, expect, it } from 'vitest';

import { MessageList } from '../../agent/message-list';
import { REPROCESS_PART_KEY } from '../../processors/stream-reprocess';
import { RequestContext } from '../../request-context';
import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from '../output-processor';
import { ChannelThreadLinkProcessor, markNewChannelThread } from '../thread-link-processor';

const SUFFIX = '\n\n[Open thread ↗](https://app.test/threads/t1)';

function run({ isNew = true, hidden = false } = {}) {
  const requestContext = new RequestContext();
  requestContext.set('MastraMemory', { thread: { id: 't1' }, resourceId: 'slack:U1' });
  if (isNew) markNewChannelThread(requestContext);
  if (hidden) requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, { textDisplay: 'hidden' });
  const processor = new ChannelThreadLinkProcessor({ link: ({ threadId }) => `https://app.test/threads/${threadId}` });
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

  it('keeps the link out of the saved message', () => {
    const { processor, requestContext } = run();
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
            { type: 'text', text: SUFFIX },
          ],
        },
      } as any,
      'response',
    );
    processor.processOutputStep({ messageList, requestContext } as any);
    const parts = messageList.get.response.db()[0]!.content.parts;
    expect(parts).toEqual([expect.objectContaining({ type: 'text', text: 'Hi' })]);
  });
});
