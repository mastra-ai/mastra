import { describe, expect, it } from 'vitest';
import { MessageList } from '../message-list';

// The embedded-messages record lets the semantic recall writers skip messages this run already
// embedded. Durable runs move it between steps and workers through serialized snapshots.
describe('MessageList embedded-messages record', () => {
  it('survives a snapshot round trip, so a durable step on another worker still skips embedded messages', () => {
    const list = new MessageList();
    list.getEmbeddedMessages().set('msg-1', 'hash-1');

    const restored = new MessageList().deserialize(JSON.parse(JSON.stringify(list.serialize())));
    expect([...restored.getEmbeddedMessages()]).toEqual([['msg-1', 'hash-1']]);
    expect([...list.clone().getEmbeddedMessages()]).toEqual([['msg-1', 'hash-1']]);
  });

  it('loads snapshots written before the record existed', () => {
    const state = new MessageList().serialize();
    expect(state.embeddedMessages).toBeUndefined();
    expect(new MessageList().deserialize(state).getEmbeddedMessages().size).toBe(0);
  });

  it('keeps entries on the live list when an older snapshot is restored onto it at durable finalize', () => {
    const olderSnapshot = new MessageList().serialize();
    const live = new MessageList();
    live.getEmbeddedMessages().set('user-msg', 'hash-input');

    live.deserialize(olderSnapshot);
    expect(live.getEmbeddedMessages().get('user-msg')).toBe('hash-input');
  });
});
