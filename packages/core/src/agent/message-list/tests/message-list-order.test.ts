import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MastraDBMessage } from '../';
import { MessageList } from '../index';
import { getMessageOrder, getPartOrder, newestOrderIn, partOrder } from '../order';

const threadId = 'thread';
const resourceId = 'resource';

function message(
  id: string,
  createdAt: number,
  parts: MastraDBMessage['content']['parts'],
  role: 'user' | 'assistant' = 'user',
): MastraDBMessage {
  return { id, role, createdAt: new Date(createdAt), threadId, resourceId, content: { format: 2, parts } };
}

const text = (t: string) => ({ type: 'text' as const, text: t });

describe('MessageList order', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
  });
  afterEach(() => vi.useRealTimers());

  it('writes nothing when (createdAt, 0) already orders the message', () => {
    const list = new MessageList({ threadId, resourceId }).add(message('a', 1_000, [text('a')]), 'input');
    expect(list.get.all.db()[0]!.content.metadata).toBeUndefined();
  });

  it('gives same-millisecond messages strictly increasing orders', () => {
    const list = new MessageList({ threadId, resourceId });
    list.add(message('a', 1_000, [text('a')]), 'input');
    list.add(message('b', 1_000, [text('b')], 'assistant'), 'response');
    const [a, b] = list.get.all.db();
    expect(newestOrderIn(b!) > newestOrderIn(a!)).toBe(true);
    expect(getMessageOrder(b!)).toBeDefined();
  });

  it('orders a part appended to an existing message after the message', () => {
    const list = new MessageList({ threadId, resourceId });
    list.add(message('a', 1_000, [text('first')], 'assistant'), 'response');
    vi.setSystemTime(1_005);
    list.add(message('a', 1_000, [text('first'), text('second')], 'assistant'), 'response');
    const stored = list.get.all.db()[0]!;
    const [first, second] = stored.content.parts;
    expect(getPartOrder(first!)).toBeUndefined();
    expect(partOrder(stored, second!) > partOrder(stored, first!)).toBe(true);
  });

  it('reorders a part changed in place so the new content is newer', () => {
    const list = new MessageList({ threadId, resourceId });
    const call = {
      type: 'tool-invocation' as const,
      toolInvocation: { state: 'call' as const, toolCallId: 't', toolName: 'x', args: {} },
    };
    list.add(message('a', 1_000, [call], 'assistant'), 'response');
    const before = newestOrderIn(list.get.all.db()[0]!);
    vi.setSystemTime(1_005);
    list.add(
      message(
        'a',
        1_000,
        [{ ...call, toolInvocation: { ...call.toolInvocation, state: 'result' as const, result: 1 } }],
        'assistant',
      ),
      'response',
    );
    expect(newestOrderIn(list.get.all.db()[0]!) > before).toBe(true);
  });

  it('leaves the stored copy untouched when the client resends a message', () => {
    const list = new MessageList({ threadId, resourceId });
    list.add(message('a', 1_000, [text('client')]), 'input');
    list.add(
      {
        ...message('a', 1_000, [text('stored')]),
        content: { format: 2, parts: [text('stored')], metadata: { stored: true } },
      },
      'memory',
    );
    expect(list.get.all.db()[0]!.content.metadata).toEqual({ stored: true });
  });

  it('keeps increasing after serialize/deserialize and clock rollback', () => {
    const list = new MessageList({ threadId, resourceId });
    list.add(message('a', 1_000, [text('a')]), 'input');
    list.add(message('b', 1_000, [text('b')], 'assistant'), 'response');
    const restored = new MessageList({ threadId, resourceId }).deserialize(list.serialize());
    vi.setSystemTime(500);
    restored.add(message('c', 1_000, [text('c')]), 'input');
    const [, b, c] = restored.get.all.db();
    expect(newestOrderIn(c!) > newestOrderIn(b!)).toBe(true);
  });

  it('handles circular tool payloads', () => {
    const raw: Record<string, unknown> = { type: 'resource' };
    raw.self = raw;
    const call = {
      type: 'tool-invocation' as const,
      toolInvocation: { state: 'result' as const, toolCallId: 't', toolName: 'x', args: {}, result: raw },
    };
    const list = new MessageList({ threadId, resourceId });
    list.add(message('a', 1_000, [call], 'assistant'), 'response');
    expect(() => list.add(message('a', 1_000, [call, text('more')], 'assistant'), 'response')).not.toThrow();
  });
});
