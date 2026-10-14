import { describe, expect, it, vi } from 'vitest';
import { MessageList } from '../message-list';
import type { MastraDBMessage } from '../state/types';

function message(id: string, role: 'user' | 'assistant', text: string, at: number): MastraDBMessage {
  return {
    id,
    role,
    createdAt: new Date(at),
    threadId: 't',
    resourceId: 'r',
    content: { format: 2, parts: [{ type: 'text', text }] },
  };
}

function ids(messages: MastraDBMessage[]) {
  return messages.map(m => m.id);
}

describe('MessageList.getRunResponseMessages', () => {
  it('keeps response messages pruned from the live context', async () => {
    const list = new MessageList({ threadId: 't', resourceId: 'r' });
    list.add(message('u1', 'user', 'hi', 1000), 'input');
    list.add(message('a1', 'assistant', 'first', 2000), 'response');
    list.add(message('u2', 'user', 'continue', 2500), 'input');
    list.add(message('a2', 'assistant', 'second', 3000), 'response');

    list.removeByIds(['u1', 'a1'], { pruned: true });

    expect(ids(list.get.all.db())).toEqual(['u2', 'a2']);
    expect(ids(list.getPersisted.response.db())).toEqual(['a2']);
    expect(ids(await list.getRunResponseMessages())).toEqual(['a1', 'a2']);
  });

  it('drops messages removed without the pruned option', async () => {
    const list = new MessageList({ threadId: 't', resourceId: 'r' });
    list.add(message('a1', 'assistant', 'rejected', 2000), 'response');

    list.removeByIds(['a1']);

    expect(await list.getRunResponseMessages()).toEqual([]);
  });

  it('does not report pruned input or memory messages as response', async () => {
    const list = new MessageList({ threadId: 't', resourceId: 'r' });
    list.add(message('m1', 'assistant', 'recalled', 500), 'memory');
    list.add(message('u1', 'user', 'hi', 1000), 'input');

    list.removeByIds(['m1', 'u1'], { pruned: true });

    expect(await list.getRunResponseMessages()).toEqual([]);
  });

  it('does not duplicate a pruned message that is added back to the list', async () => {
    const list = new MessageList({ threadId: 't', resourceId: 'r' });
    const a1 = message('a1', 'assistant', 'first', 2000);
    list.add(a1, 'response');

    const [removed] = list.removeByIds(['a1'], { pruned: true });
    list.add(removed!, 'response');

    expect(ids(await list.getRunResponseMessages())).toEqual(['a1']);
  });

  it('forgets a pruned message once its re-added copy is removed normally', async () => {
    const list = new MessageList({ threadId: 't', resourceId: 'r' });
    list.add(message('a1', 'assistant', 'first', 2000), 'response');

    const [removed] = list.removeByIds(['a1'], { pruned: true });
    list.add(removed!, 'response');
    list.removeByIds(['a1']);

    expect(await list.getRunResponseMessages()).toEqual([]);
    expect(list.serialize().prunedResponseMessageIds).toBeUndefined();
  });

  it('keeps only the ids of pruned response messages in serialized state', async () => {
    const list = new MessageList({ threadId: 't', resourceId: 'r' });
    list.add(message('a1', 'assistant', 'before suspend', 2000), 'response');
    list.removeByIds(['a1'], { pruned: true });

    const state = list.serialize();

    expect(state.prunedResponseMessageIds).toEqual(['a1']);
    expect(JSON.stringify(state)).not.toContain('before suspend');
  });

  it('loads pruned response messages of a restored list by id', async () => {
    const list = new MessageList({ threadId: 't', resourceId: 'r' });
    const a1 = message('a1', 'assistant', 'before suspend', 2000);
    list.add(a1, 'response');
    list.removeByIds(['a1'], { pruned: true });
    list.add(message('u2', 'user', 'resume', 2500), 'input');
    list.add(message('a2', 'assistant', 'still live', 3000), 'response');

    const state = JSON.parse(JSON.stringify(list.serialize()));
    const restored = new MessageList({ threadId: 't', resourceId: 'r' }).deserialize(state);
    const load = vi.fn(async (messageIds: string[]) => [a1].filter(m => messageIds.includes(m.id)));

    expect(ids(restored.get.all.db())).toEqual(['u2', 'a2']);
    expect(ids(await restored.getRunResponseMessages(load))).toEqual(['a1', 'a2']);
    expect(load).toHaveBeenCalledWith(['a1']);
    // Without a loader, pruned messages a restored list cannot load are left out.
    expect(ids(await restored.getRunResponseMessages())).toEqual(['a2']);
  });

  it('does not load pruned messages this list still holds', async () => {
    const list = new MessageList({ threadId: 't', resourceId: 'r' });
    list.add(message('a1', 'assistant', 'first', 2000), 'response');
    list.removeByIds(['a1'], { pruned: true });
    const load = vi.fn(async () => []);

    expect(ids(await list.getRunResponseMessages(load))).toEqual(['a1']);
    expect(load).not.toHaveBeenCalled();
  });

  it('does not grow serialized state with the size of pruned messages', async () => {
    const serializedSize = (prunedCount: number) => {
      const list = new MessageList({ threadId: 't', resourceId: 'r' });
      const pruned: string[] = [];
      for (let i = 0; i < prunedCount; i++) {
        list.add(message(`u${i}`, 'user', 'go on', i * 10), 'input');
        list.add(message(`a${i}`, 'assistant', 'x'.repeat(5000), i * 10 + 5), 'response');
        pruned.push(`u${i}`, `a${i}`);
      }
      list.removeByIds(pruned, { pruned: true });
      list.add(message('live', 'assistant', 'done', 1_000_000), 'response');
      return JSON.stringify(list.serialize()).length;
    };

    const base = serializedSize(0);
    // Each pruned 5KB message costs only its id in the serialized state.
    expect(serializedSize(1) - base).toBeLessThan(100);
    expect(serializedSize(50) - base).toBeLessThan(50 * 100);
  });

  it('omits prunedResponseMessageIds from serialized state when nothing was pruned', async () => {
    const list = new MessageList({ threadId: 't', resourceId: 'r' });
    list.add(message('a1', 'assistant', 'hi', 2000), 'response');

    expect(list.serialize()).not.toHaveProperty('prunedResponseMessageIds');
  });
});
