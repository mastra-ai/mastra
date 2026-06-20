import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../';
import { MessageList } from '../index';

function makeAssistantMessage(text: string, id: string): MastraDBMessage {
  return {
    id,
    role: 'assistant',
    content: { format: 2, parts: [{ type: 'text', text }] },
    createdAt: new Date(),
  };
}

function allText(message: MastraDBMessage | undefined): string {
  return (message?.content?.parts ?? [])
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('');
}

describe('MessageList.clearUnsavedMessages', () => {
  it('clears messages that are unchanged since they were read', () => {
    const list = new MessageList();
    list.add(makeAssistantMessage('hello', 'msg-1'), 'response');

    const snapshot = list.getUnsavedMessages();
    expect(snapshot).toHaveLength(1);

    list.clearUnsavedMessages(snapshot);

    expect(list.getUnsavedMessages()).toHaveLength(0);
  });

  it('returns an immutable snapshot that later streaming cannot mutate', () => {
    const list = new MessageList();
    list.add(makeAssistantMessage('hello', 'msg-1'), 'response');

    const snapshot = list.getUnsavedMessages();
    // Streaming appends another part to the same message id after the snapshot.
    list.add(makeAssistantMessage(' world', 'msg-1'), 'response');

    // The snapshot handed to the storage write must not have changed.
    expect(allText(snapshot[0])).toBe('hello');
  });

  it('keeps a message tracked when its content changed during the in-flight save', () => {
    const list = new MessageList();
    list.add(makeAssistantMessage('hello', 'msg-1'), 'response');

    // Simulate the SaveQueueManager flow: read the unsaved snapshot, then have
    // streaming append more content to the same message id while the save is
    // in flight (before clearUnsavedMessages runs).
    const snapshot = list.getUnsavedMessages();
    list.add(makeAssistantMessage(' world', 'msg-1'), 'response');

    // Clearing with the stale snapshot must NOT drop the message, because its
    // newer content has not been persisted yet.
    list.clearUnsavedMessages(snapshot);

    const stillUnsaved = list.getUnsavedMessages();
    expect(stillUnsaved).toHaveLength(1);
    expect(allText(stillUnsaved[0])).toContain('world');

    // A subsequent save with the up-to-date snapshot clears it.
    list.clearUnsavedMessages(stillUnsaved);
    expect(list.getUnsavedMessages()).toHaveLength(0);
  });

  it('clears only the persisted snapshot and keeps messages added afterwards', () => {
    const list = new MessageList();
    const userMsg: MastraDBMessage = {
      id: 'user-1',
      role: 'user',
      content: { format: 2, parts: [{ type: 'text', text: 'question' }] },
      createdAt: new Date(),
    };
    list.add(userMsg, 'input');

    const snapshot = list.getUnsavedMessages();
    expect(snapshot.map(m => m.id)).toEqual(['user-1']);

    // A new assistant response arrives after the snapshot was taken.
    list.add(makeAssistantMessage('answer', 'asst-1'), 'response');

    list.clearUnsavedMessages(snapshot);

    const remaining = list.getUnsavedMessages();
    expect(remaining.map(m => m.id)).toEqual(['asst-1']);
  });
});
