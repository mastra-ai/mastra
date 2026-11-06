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

function setup(storedMessages: MastraDBMessage[], retainFullInput = false) {
  const listMessages = vi.fn(
    async ({
      orderBy,
      filter,
    }: {
      orderBy?: { direction?: 'ASC' | 'DESC' };
      filter?: { dateRange?: { start?: Date } };
    }) => {
      const start = filter?.dateRange?.start?.getTime() ?? -Infinity;
      const inRange = storedMessages.filter(message => message.createdAt.getTime() >= start);
      return { messages: orderBy?.direction === 'DESC' ? inRange.toReversed() : inRange };
    },
  );
  const listMessagesById = vi.fn(async ({ messageIds }: { messageIds: string[] }) => ({
    messages: storedMessages.filter(message => messageIds.includes(message.id)),
  }));
  const processor = new MemoryInputFilter({
    storage: { listMessages, listMessagesById } as unknown as MemoryStorage,
    retainFullInput,
  });
  const messageList = new MessageList({ threadId: 'thread', resourceId: 'resource' });
  return { listMessages, listMessagesById, messageList, processor };
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
    const { messageList, processor } = setup([
      message('stored', 'assistant', [{ type: 'text', text: 'stored' }]),
      message('a1', 'assistant', [{ type: 'text', text: 'echo' }]),
    ]);
    messageList.add(message('a1', 'assistant', [{ type: 'text', text: 'echo' }]), 'input');

    await process(processor, messageList);

    expect(messageList.get.input.db()).toEqual([]);
  });

  it('preserves a result-less assistant message that is not in storage', async () => {
    const { messageList, processor } = setup([message('stored', 'assistant', [{ type: 'text', text: 'stored' }])]);
    messageList.add(
      message('routing', 'assistant', [{ type: 'text', text: 'You will be calling just *one* primitive at a time' }]),
      'input',
    );

    await process(processor, messageList);

    expect(messageList.get.input.db().map(item => item.id)).toEqual(['routing']);
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

  it('keeps the whole input when retainFullInput is set, even with stored history', async () => {
    const { listMessages, listMessagesById, messageList, processor } = setup(
      [message('stored', 'assistant', [{ type: 'text', text: 'stored' }])],
      true,
    );
    // The replay shape a caller assembles itself: stored conversation plus the live turn.
    // Without the flag this trims back to ['u2'].
    messageList.add(
      [
        message('u1', 'user', [{ type: 'text', text: 'old' }]),
        message('a1', 'assistant', [{ type: 'text', text: 'answer' }]),
        message('u2', 'user', [{ type: 'text', text: 'new' }]),
      ],
      'input',
    );

    await process(processor, messageList);

    expect(messageList.get.input.db().map(item => item.id)).toEqual(['u1', 'a1', 'u2']);
    expect(listMessages).not.toHaveBeenCalled();
    expect(listMessagesById).not.toHaveBeenCalled();
  });

  it('keeps the whole input when retainFullInput is set, without stripping provider metadata', async () => {
    const { messageList, processor } = setup([], true);
    messageList.add(
      [
        message('u1', 'user', [{ type: 'text', text: 'question' }]),
        message('a1', 'assistant', [
          { type: 'reasoning', text: 'thought', providerMetadata: { openai: { itemId: 'rs_1' } } },
          { type: 'text', text: 'answer', providerMetadata: { openai: { itemId: 'msg_1' } } },
        ]),
      ],
      'input',
    );

    await process(processor, messageList);

    const parts = messageList.get.input.db()[1]?.content.parts ?? [];
    expect(parts[0]).toHaveProperty('providerMetadata', { openai: { itemId: 'rs_1' } });
    expect(parts[1]).toHaveProperty('providerMetadata', { openai: { itemId: 'msg_1' } });
  });

  describe.each([
    ['result', { state: 'result', result: 'done' }],
    ['output-error', { state: 'output-error', errorText: 'failed' }],
    ['output-denied', { state: 'output-denied' }],
    ['approval-responded', { state: 'approval-responded', approval: { id: 'approval', approved: true } }],
  ] as const)('client %s update', (_, update) => {
    const toolPart = (toolInvocation: Record<string, unknown>) =>
      ({
        type: 'tool-invocation',
        toolInvocation: { toolCallId: 'call', toolName: 'tool', args: {}, ...toolInvocation },
      }) as MastraDBMessage['content']['parts'][number];
    const storedPending = message('a1', 'assistant', [{ type: 'text', text: 'calling' }, toolPart({ state: 'call' })]);

    it('is kept from a trailing assistant message', async () => {
      const { messageList, processor } = setup([storedPending]);
      messageList.add(message('a1', 'assistant', [{ type: 'text', text: 'calling' }, toolPart(update)]), 'input');

      await process(processor, messageList);

      expect(messageList.get.input.db()[0]?.content.parts).toMatchObject([{ toolInvocation: update }]);
    });

    it('is kept from the assistant message before a new user message when the stored call is pending', async () => {
      const { messageList, processor } = setup([storedPending]);
      messageList.add(
        [
          message('a1', 'assistant', [{ type: 'text', text: 'calling' }, toolPart(update)]),
          message('u2', 'user', [{ type: 'text', text: 'next' }]),
        ],
        'input',
      );

      await process(processor, messageList);

      const retained = messageList.get.input.db();
      expect(retained.map(item => item.id)).toEqual(['a1', 'u2']);
      expect(retained[0]?.content.parts).toMatchObject([{ toolInvocation: update }]);
    });

    it('is dropped before a new user message when the stored call already finished', async () => {
      const { messageList, processor } = setup([
        message('a1', 'assistant', [toolPart({ state: 'result', result: 'server' })]),
      ]);
      messageList.add(
        [message('a1', 'assistant', [toolPart(update)]), message('u2', 'user', [{ type: 'text', text: 'next' }])],
        'input',
      );

      await process(processor, messageList);

      expect(messageList.get.input.db().map(item => item.id)).toEqual(['u2']);
    });

    it('is dropped before a new user message when the assistant id is not stored', async () => {
      const { listMessagesById, messageList, processor } = setup([storedPending]);
      messageList.add(
        [message('f1', 'assistant', [toolPart(update)]), message('u2', 'user', [{ type: 'text', text: 'next' }])],
        'input',
      );

      await process(processor, messageList);

      expect(listMessagesById).toHaveBeenCalledWith({ messageIds: ['f1'] });
      expect(messageList.get.input.db().map(item => item.id)).toEqual(['u2']);
    });

    describe('when a state signal stored the rest of the response in a later row', () => {
      const at = (row: MastraDBMessage, second: number): MastraDBMessage => ({
        ...row,
        createdAt: new Date(`2026-01-01T00:00:${String(second).padStart(2, '0')}Z`),
      });
      const firstRow = at(message('a1', 'assistant', [{ type: 'text', text: 'checking' }]), 1);
      const signalRow = at(message('s1', 'signal', [{ type: 'text', text: 'state' }]), 2);
      const laterRow = (call: Record<string, unknown>) =>
        at(message('a2', 'assistant', [{ type: 'text', text: 'calling' }, toolPart(call)]), 3);
      // The AI SDK client folds both rows into one UI message under the first row's id.
      const echoed = () =>
        message('a1', 'assistant', [
          { type: 'text', text: 'checking' },
          { type: 'text', text: 'calling' },
          toolPart(update),
        ]);

      it('moves an update sent with the next user message to the row that holds the call', async () => {
        const { messageList, processor } = setup([firstRow, signalRow, laterRow({ state: 'call' })]);
        messageList.add([echoed(), message('u2', 'user', [{ type: 'text', text: 'next' }])], 'input');

        await process(processor, messageList);

        const retained = messageList.get.input.db();
        expect(retained.map(item => item.id)).toEqual(['a2', 'u2']);
        expect(retained[0]?.content.parts).toMatchObject([{ toolInvocation: update }]);
      });

      it('moves an update sent on its own to the row that holds the call', async () => {
        const { messageList, processor } = setup([firstRow, signalRow, laterRow({ state: 'call' })]);
        messageList.add(echoed(), 'input');

        await process(processor, messageList);

        const retained = messageList.get.input.db();
        expect(retained.map(item => item.id)).toEqual(['a2']);
        expect(retained[0]?.content.parts).toMatchObject([{ toolInvocation: update }]);
      });

      it('drops the update when the later row already finished the call', async () => {
        const { messageList, processor } = setup([
          firstRow,
          signalRow,
          laterRow({ state: 'result', result: 'server' }),
        ]);
        messageList.add([echoed(), message('u2', 'user', [{ type: 'text', text: 'next' }])], 'input');

        await process(processor, messageList);

        expect(messageList.get.input.db().map(item => item.id)).toEqual(['u2']);
      });

      it('drops the update when a later user message comes before the row that holds the call', async () => {
        const { messageList, processor } = setup([
          firstRow,
          at(message('u1', 'user', [{ type: 'text', text: 'meanwhile' }]), 2),
          laterRow({ state: 'call' }),
        ]);
        messageList.add([echoed(), message('u2', 'user', [{ type: 'text', text: 'next' }])], 'input');

        await process(processor, messageList);

        expect(messageList.get.input.db().map(item => item.id)).toEqual(['u2']);
      });
    });

    it('does not read later rows when the first row holds the call', async () => {
      const { listMessages, messageList, processor } = setup([storedPending]);
      messageList.add(
        [message('a1', 'assistant', [toolPart(update)]), message('u2', 'user', [{ type: 'text', text: 'next' }])],
        'input',
      );

      await process(processor, messageList);

      expect(listMessages).toHaveBeenCalledTimes(1);
      expect(listMessages).toHaveBeenCalledWith(expect.objectContaining({ perPage: 1 }));
    });
  });

  it('does not look up the assistant before a new user message when it carries no tool updates', async () => {
    const { listMessagesById, messageList, processor } = setup([
      message('stored', 'assistant', [{ type: 'text', text: 'stored' }]),
    ]);
    messageList.add(
      [
        message('a1', 'assistant', [{ type: 'text', text: 'answer' }]),
        message('u2', 'user', [{ type: 'text', text: 'new' }]),
      ],
      'input',
    );

    await process(processor, messageList);

    expect(listMessagesById).not.toHaveBeenCalled();
  });
});
