import { describe, expect, it } from 'vitest';

import { MessageList } from '../message-list';
import type { MastraDBMessage } from '../state/types';

/**
 * Stored history loads underneath whatever the current run already holds.
 *
 * History loaders add persisted rows with source `memory`. When one of those rows shares an
 * id with a message the run already has (client input, or a response part such as a tool
 * result), the stored copy must not replace the live one wholesale: the live copy is the
 * base layer and the stored copy is folded into it.
 *
 * Regression: an assistant turn ends holding a pending client tool call. The next request
 * re-sends that message with the tool result filled in, and the run adds it as a response
 * message. Loading the stored `call`-state row then replaced the live `result` copy, so the
 * client tool result never reached the prompt. That blocked tool-suspension resumption and
 * observational-memory buffering in the real TUI.
 */

function toolMessage(id: string, state: 'call' | 'result'): MastraDBMessage {
  return {
    id,
    role: 'assistant',
    createdAt: new Date(state === 'call' ? 1 : 2),
    threadId: 'thread',
    resourceId: 'resource',
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation:
            state === 'call'
              ? { state: 'call', toolCallId: 'color', toolName: 'changeColor', args: { color: 'green' } }
              : {
                  state: 'result',
                  toolCallId: 'color',
                  toolName: 'changeColor',
                  args: { color: 'green' },
                  result: { applied: true },
                },
        },
      ],
    },
  };
}

function liveMessages(list: MessageList, source: 'input' | 'response') {
  return (source === 'response' ? list.get.response.db() : list.get.input.db()).map(message => message.id);
}

describe.each(['input', 'response'] as const)('stored history layering over a live %s message', source => {
  it('keeps the live tool result instead of replacing it with the stored call', () => {
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    list.add(toolMessage('assistant', 'result'), source);

    list.add(toolMessage('assistant', 'call'), 'memory');

    expect(list.get.all.db()).toHaveLength(1);
    const [part] = list.get.all.db()[0]!.content.parts;
    expect(part?.type === 'tool-invocation' && part.toolInvocation.state).toBe('result');
    expect(part?.type === 'tool-invocation' && part.toolInvocation.result).toEqual({ applied: true });
  });

  it('keeps the merged message visible to the source the live copy arrived from', () => {
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    list.add(toolMessage('assistant', 'result'), source);

    list.add(toolMessage('assistant', 'call'), 'memory');

    expect(liveMessages(list, source)).toEqual(['assistant']);
  });
});

type ToolInvocation = Extract<
  MastraDBMessage['content']['parts'][number],
  { type: 'tool-invocation' }
>['toolInvocation'];

function withToolState(id: string, createdAt: number, toolInvocation: Partial<ToolInvocation>): MastraDBMessage {
  return {
    id,
    role: 'assistant',
    createdAt: new Date(createdAt),
    threadId: 'thread',
    resourceId: 'resource',
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            toolCallId: 'color',
            toolName: 'changeColor',
            args: { color: 'green' },
            ...toolInvocation,
          } as ToolInvocation,
        },
      ],
    },
  };
}

function layeredToolState(stored: Partial<ToolInvocation>, live: Partial<ToolInvocation>) {
  const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
  list.add(withToolState('assistant', 2, live), 'input');
  list.add(withToolState('assistant', 1, stored), 'memory');
  const [part] = list.get.all.db()[0]!.content.parts;
  return part?.type === 'tool-invocation' ? part.toolInvocation : undefined;
}

describe('live tool state only moves a stored call forward', () => {
  const storedResult = { state: 'result', result: { applied: true } } as const;

  it.each([
    ['result', { state: 'result', result: { applied: false } }],
    ['output-error', { state: 'output-error', errorText: 'stale error' }],
    ['output-denied', { state: 'output-denied' }],
    ['approval-requested', { state: 'approval-requested' }],
  ] as const)('keeps a stored result over a live %s echo', (_, live) => {
    expect(layeredToolState(storedResult, live)).toMatchObject(storedResult);
  });

  it.each([
    ['result', { state: 'result', result: { applied: true } }],
    ['output-error', { state: 'output-error', errorText: 'user closed the picker' }],
    ['output-denied', { state: 'output-denied' }],
    ['approval-responded', { state: 'approval-responded', approval: { id: 'a', approved: true } }],
  ] as const)('fills a stored pending call with a live %s', (_, live) => {
    expect(layeredToolState({ state: 'call' }, live)).toMatchObject({ state: live.state });
  });

  it('fills a stored answered approval with the live outcome of the same run', () => {
    expect(
      layeredToolState(
        { state: 'approval-responded', approval: { id: 'a', approved: true } },
        { state: 'result', result: { applied: true } },
      ),
    ).toMatchObject({ state: 'result', result: { applied: true } });
  });

  it('does not move a stored answered approval back to a live approval request', () => {
    expect(
      layeredToolState(
        { state: 'approval-responded', approval: { id: 'a', approved: true } },
        { state: 'approval-requested', approval: { id: 'a' } },
      ),
    ).toMatchObject({ state: 'approval-responded', approval: { approved: true } });
  });
});

function withText(message: MastraDBMessage, text: string, extra: Partial<MastraDBMessage['content']> = {}) {
  return {
    ...message,
    content: { ...message.content, ...extra, parts: [{ type: 'text' as const, text }, ...message.content.parts] },
  };
}

function texts(list: MessageList) {
  return list.get.all
    .db()[0]!
    .content.parts.filter(part => part.type === 'text')
    .map(part => (part.type === 'text' ? part.text : ''));
}

describe('a client-sent assistant message only contributes tool outcomes', () => {
  it('keeps the stored text when the client copy has different text', () => {
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    list.add(withText(toolMessage('assistant', 'result'), 'Your card ending 4242 is on file.'), 'input');
    list.add(withText(toolMessage('assistant', 'call'), 'Your card ending [REDACTED] is on file.'), 'memory');

    expect(texts(list)).toEqual(['Your card ending [REDACTED] is on file.']);
    const tool = list.get.all.db()[0]!.content.parts.find(part => part.type === 'tool-invocation');
    expect(tool?.type === 'tool-invocation' && tool.toolInvocation.state).toBe('result');
    expect(list.get.input.db().map(message => message.id)).toEqual(['assistant']);
  });

  it('does not add client reasoning or metadata to the stored copy', () => {
    const live = withText(toolMessage('assistant', 'result'), 'Stored text.', { metadata: { fromClient: true } });
    live.content.parts.unshift({ type: 'reasoning', reasoning: 'client reasoning', details: [] });
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    list.add(live, 'input');
    list.add(withText(toolMessage('assistant', 'call'), 'Stored text.', { metadata: { stored: true } }), 'memory');

    const merged = list.get.all.db()[0]!;
    expect(merged.content.parts.some(part => part.type === 'reasoning')).toBe(false);
    expect(merged.content.metadata).toEqual({ stored: true });
  });

  it('does not apply a tool state a client never sends', () => {
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    list.add(withToolState('assistant', 2, { state: 'approval-requested' }), 'input');
    list.add(withToolState('assistant', 1, { state: 'call' }), 'memory');

    const [part] = list.get.all.db()[0]!.content.parts;
    expect(part?.type === 'tool-invocation' && part.toolInvocation.state).toBe('call');
  });

  it('still layers new text from a response message in the current run', () => {
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    list.add(withText(toolMessage('assistant', 'result'), 'Live text.'), 'response');
    list.add(withText(toolMessage('assistant', 'call'), 'Stored text.'), 'memory');

    expect(texts(list)).toEqual(expect.arrayContaining(['Live text.', 'Stored text.']));
  });
});

describe('stored history is not layered onto stored history', () => {
  it('still replaces one stored duplicate with another', () => {
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    list.add(toolMessage('assistant', 'call'), 'memory');
    list.add(toolMessage('assistant', 'result'), 'memory');

    expect(list.get.all.db()).toHaveLength(1);
    const [part] = list.get.all.db()[0]!.content.parts;
    expect(part?.type === 'tool-invocation' && part.toolInvocation.state).toBe('result');
  });
});
