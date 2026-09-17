import { describe, expect, it, vi } from 'vitest';
import type { MastraDBMessage } from '../../agent';
import { MessageList } from '../../agent';
import type { MemoryStorage } from '../../storage';
import { MemoryInputFilter } from './memory-input-filter';

function message(
  id: string,
  role: MastraDBMessage['role'],
  parts: MastraDBMessage['content']['parts'],
): MastraDBMessage {
  return {
    id,
    role,
    createdAt: new Date(`2026-01-01T00:00:0${id.length}Z`),
    threadId: 'thread',
    resourceId: 'resource',
    content: { format: 2, parts },
  };
}

function setup(storedMessages: MastraDBMessage[]) {
  const listMessages = vi.fn(async () => ({ messages: storedMessages }));
  const processor = new MemoryInputFilter({ storage: { listMessages } as unknown as MemoryStorage });
  const messageList = new MessageList({ threadId: 'thread', resourceId: 'resource' });
  return { listMessages, messageList, processor };
}

async function process(processor: MemoryInputFilter, messageList: MessageList) {
  return processor.processInput({
    messages: messageList.get.input.db(),
    messageList,
    abort: reason => {
      throw new Error(reason);
    },
  });
}

describe('MemoryInputFilter', () => {
  it('keeps only user messages after the last assistant for an existing thread', async () => {
    const { messageList, processor } = setup([message('stored', 'assistant', [{ type: 'text', text: 'stored' }])]);
    messageList.add(
      [
        message('u1', 'user', [{ type: 'text', text: 'old' }]),
        message('a1', 'assistant', [{ type: 'text', text: 'answer' }]),
        message('u2', 'user', [{ type: 'text', text: 'new' }]),
      ],
      'input',
    );

    await process(processor, messageList);

    expect(messageList.get.input.db().map(item => item.id)).toEqual(['u2']);
  });

  it('keeps only trailing tool results for an assistant continuation', async () => {
    const { messageList, processor } = setup([message('stored', 'assistant', [{ type: 'text', text: 'stored' }])]);
    messageList.add(
      message('assistant', 'assistant', [
        { type: 'text', text: 'calling' },
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId: 'call', toolName: 'tool', args: {}, result: 'done' },
        },
      ]),
      'input',
    );

    await process(processor, messageList);

    expect(messageList.get.input.db()[0]?.content.parts).toMatchObject([
      {
        type: 'tool-invocation',
        toolInvocation: { state: 'result', toolCallId: 'call', toolName: 'tool', args: {}, result: 'done' },
      },
    ]);
  });

  it('clears assistant echoes without new tool results for an existing thread', async () => {
    const { messageList, processor } = setup([message('stored', 'assistant', [{ type: 'text', text: 'stored' }])]);
    messageList.add(message('assistant', 'assistant', [{ type: 'text', text: 'echo' }]), 'input');

    await process(processor, messageList);

    expect(messageList.get.input.db()).toEqual([]);
  });

  it('preserves full input for an empty thread while stripping assistant provider metadata', async () => {
    const { messageList, processor } = setup([]);
    messageList.add(
      [
        message('u1', 'user', [{ type: 'text', text: 'question' }]),
        message('a1', 'assistant', [
          { type: 'reasoning', text: 'thought', providerMetadata: { openai: { itemId: 'rs_1' } } },
          { type: 'text', text: 'answer', providerMetadata: { openai: { itemId: 'msg_1' } } },
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId: 'call', toolName: 'tool', args: {}, result: 'done' },
            providerMetadata: { openai: { itemId: 'tool_1' } },
          },
        ]),
      ],
      'input',
    );

    await process(processor, messageList);

    const parts = messageList.get.input.db()[1]?.content.parts ?? [];
    expect(parts[0]).not.toHaveProperty('providerMetadata');
    expect(parts[1]).not.toHaveProperty('providerMetadata');
    expect(parts[2]).toHaveProperty('providerMetadata');
  });

  it('avoids storage lookup when the input is already an all-new user tail', async () => {
    const { listMessages, messageList, processor } = setup([]);
    messageList.add(message('u1', 'user', [{ type: 'text', text: 'new' }]), 'input');

    await process(processor, messageList);

    expect(listMessages).not.toHaveBeenCalled();
  });

  it('preserves non-conversation input such as signals', async () => {
    const { listMessages, messageList, processor } = setup([
      message('stored', 'assistant', [{ type: 'text', text: 'stored' }]),
    ]);
    messageList.add(message('signal', 'signal', [{ type: 'text', text: 'event' }]), 'input');

    await process(processor, messageList);

    expect(messageList.get.input.db().map(item => item.id)).toEqual(['signal']);
    expect(listMessages).not.toHaveBeenCalled();
  });
});
