import { describe, it, expect } from 'vitest';

import { MessageList } from '../message-list';
import type { MastraDBMessage } from '../state/types';

const message = (i: number, text = `message ${i}`, id = `m-${i}`): MastraDBMessage => ({
  id,
  role: i % 2 ? 'assistant' : 'user',
  threadId: 'thread-1',
  resourceId: 'resource-1',
  type: 'text',
  createdAt: new Date(1_700_000_000_000 + i * 1000),
  content: { format: 2, parts: [{ type: 'text', text }] },
});

const ids = (list: MessageList) => list.get.all.db().map(m => m.id);

describe('MessageList memory adds use an id index', () => {
  it('ignores a memory message it already holds and replaces one whose content changed', () => {
    const list = new MessageList();
    list.add(message(1), 'memory');
    list.add(message(1), 'memory');
    expect(ids(list)).toEqual(['m-1']);

    list.add(message(1, 'edited'), 'memory');
    expect(ids(list)).toEqual(['m-1']);
    expect(list.get.all.db()[0]!.content.parts).toEqual([{ type: 'text', text: 'edited' }]);

    // the index points at the replacement, so the same edit dedups again
    list.add(message(1, 'edited'), 'memory');
    expect(ids(list)).toEqual(['m-1']);
  });

  it('keeps createdAt order for out-of-order adds and appends input after memory', () => {
    const list = new MessageList();
    list.add([message(3), message(1), message(2)], 'memory');
    list.add({ role: 'user', content: 'hello' }, 'input');
    const all = list.get.all.db();
    expect(all.slice(0, 3).map(m => m.id)).toEqual(['m-1', 'm-2', 'm-3']);
    expect(all[3]!.role).toBe('user');
  });

  it('rebuilds the index after clear, removeByIds and deserialize', () => {
    const list = new MessageList();
    list.add([message(1), message(2)], 'memory');
    list.removeByIds(['m-1']);
    list.add(message(1), 'memory');
    expect(ids(list)).toEqual(['m-1', 'm-2']);

    list.clear.all.db();
    list.add([message(5), message(5)], 'memory');
    expect(ids(list)).toEqual(['m-5']);

    const copy = new MessageList().deserialize(list.serialize());
    copy.add(message(5), 'memory');
    expect(ids(copy)).toEqual(['m-5']);
  });

  it('still routes a grown sealed message into a new message after it', () => {
    const sealed: MastraDBMessage = {
      ...message(1, 'sealed part'),
      content: {
        format: 2,
        metadata: { mastra: { sealed: true } },
        parts: [{ type: 'text', text: 'sealed part', metadata: { mastra: { sealedAt: 1 } } }],
      },
    };
    const list = new MessageList();
    list.add(sealed, 'memory');
    list.add(sealed, 'memory');
    expect(ids(list)).toEqual(['m-1']);

    const grown: MastraDBMessage = {
      ...sealed,
      content: { ...sealed.content, parts: [...sealed.content.parts, { type: 'text', text: 'appended part' }] },
    };
    list.add(grown, 'memory');
    const all = list.get.all.db();
    expect(all).toHaveLength(2);
    expect(all[0]!.id).toBe('m-1');
    expect(all[0]!.content.parts).toHaveLength(1);
    expect(all[1]!.id).not.toBe('m-1');
    expect(all[1]!.content.parts).toEqual([{ type: 'text', text: 'appended part' }]);

    list.add(message(2), 'memory');
    expect(ids(list)).toHaveLength(3);
  });

  it('loads a long history in linear time', () => {
    const history = Array.from({ length: 20_000 }, (_, i) => message(i));
    const started = performance.now();
    const list = new MessageList().add(history, 'memory');
    const elapsed = performance.now() - started;
    expect(list.get.all.db()).toHaveLength(20_000);
    // Before the index this took several seconds (quadratic); the bound only
    // has to catch a return to that, not measure the machine.
    expect(elapsed).toBeLessThan(2_000);
  });
});
