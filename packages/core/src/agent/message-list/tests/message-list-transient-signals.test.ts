import { describe, expect, it } from 'vitest';
import { createSignal, isTransientSignalMessage } from '../../signals';
import { MessageList } from '../index';

// Repro for https://github.com/mastra-ai/mastra/issues/22060: the documented steering-reminder
// pattern (`transient: true` sent from processInputStep with no `id`) must keep a single fresh
// copy in context per model call instead of accumulating one copy per step of a tool loop.

function transientReminder(contents = 'Stay on the current task.') {
  // No `id`, exactly like the docs example — each createSignal call mints a fresh UUID.
  return createSignal({ type: 'reactive', contents, transient: true });
}

function signalMessages(list: MessageList) {
  return list.get.all.db().filter(m => m.role === 'signal');
}

describe('transient signal dedupe within a turn', () => {
  it('re-sending the same no-id transient signal keeps a single copy', () => {
    const list = new MessageList();
    list.add('hello', 'input');

    list.addSignal(transientReminder());
    list.addSignal(transientReminder());
    list.addSignal(transientReminder());

    const signals = signalMessages(list);
    expect(signals).toHaveLength(1);
    expect(isTransientSignalMessage(signals[0]!)).toBe(true);
  });

  it('re-anchors the fresh copy at the tail after interleaved messages', () => {
    const list = new MessageList();
    list.add('hello', 'input');
    list.addSignal(transientReminder());

    list.add(
      {
        id: 'assistant-1',
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'step one response' }] },
        createdAt: new Date(),
      },
      'response',
    );

    list.addSignal(transientReminder());

    const all = list.get.all.db();
    const signals = all.filter(m => m.role === 'signal');
    expect(signals).toHaveLength(1);
    expect(all.at(-1)!.role).toBe('signal');
  });

  it('keeps transient signals with different contents or tagName', () => {
    const list = new MessageList();
    list.addSignal(transientReminder('reminder A'));
    list.addSignal(transientReminder('reminder B'));
    list.addSignal(createSignal({ type: 'reactive', tagName: 'budget', contents: 'reminder A', transient: true }));

    expect(signalMessages(list)).toHaveLength(3);
  });

  it('replaces a stable-id transient signal even when contents changed, moving it to the tail', () => {
    const list = new MessageList();
    list.addSignal(createSignal({ id: 'steer-1', type: 'reactive', contents: 'v1', transient: true }));

    list.add(
      {
        id: 'assistant-1',
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'response' }] },
        createdAt: new Date(),
      },
      'response',
    );

    list.addSignal(createSignal({ id: 'steer-1', type: 'reactive', contents: 'v2', transient: true }));

    const all = list.get.all.db();
    const signals = all.filter(m => m.role === 'signal');
    expect(signals).toHaveLength(1);
    expect(JSON.stringify(signals[0]!.content.parts)).toContain('v2');
    expect(all.at(-1)!.role).toBe('signal');
  });

  it('does not dedupe non-transient signals', () => {
    const list = new MessageList();
    list.addSignal(createSignal({ type: 'reactive', contents: 'persisted reminder' }));
    list.addSignal(createSignal({ type: 'reactive', contents: 'persisted reminder' }));

    expect(signalMessages(list)).toHaveLength(2);
  });

  it('does not remove a persisted (non-transient) copy with matching contents', () => {
    const list = new MessageList();
    list.addSignal(createSignal({ type: 'reactive', contents: 'same words' }));
    list.addSignal(transientReminder('same words'));

    const signals = signalMessages(list);
    expect(signals).toHaveLength(2);
    expect(signals.filter(isTransientSignalMessage)).toHaveLength(1);
  });

  it('removed copies do not reappear in drainUnsavedMessages', () => {
    const list = new MessageList();
    list.addSignal(transientReminder());
    list.addSignal(transientReminder());

    const unsaved = list.drainUnsavedMessages();
    expect(unsaved.filter(m => m.role === 'signal')).toHaveLength(1);
  });
});
