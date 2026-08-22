import { describe, expect, it } from 'vitest';
import { createSignal } from '../../signals';
import { MessageList } from '../index';

/**
 * State signals are out of scope here: `createSignal` rejects `transient` on them, which is why
 * `addSignal` needs no `type` gate (see agent/signals.test.ts for that invariant).
 *
 * A transient signal is delivery-only: it is re-injected on every step and never persisted.
 * `addSignal` therefore drops the previous row before appending the new one, so the transcript
 * holds a single copy and that copy is the last thing the model reads.
 *
 * The outbound projection also marks the row with `providerOptions.mastra.transient`, which is how
 * a consumer that places prompt-cache breakpoints can keep them behind the reminder — a transient
 * row is absent from the next turn's reloaded history, so a cached span containing it is
 * invalidated at the turn boundary.
 */
describe('transient signals in MessageList', () => {
  const MARKER = 'stay on the current task';

  function newList() {
    const list = new MessageList({ threadId: 'transient-thread' });
    list.add([{ role: 'user', content: 'hello' }], 'input');
    return list;
  }

  function promptTexts(list: MessageList): string[] {
    return list.get.all.aiV5.prompt().map(message => {
      if (typeof message.content === 'string') return message.content;
      if (!Array.isArray(message.content)) return '';
      return message.content
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('\n');
    });
  }

  function sendTransient(list: MessageList, id = 'reminder-1') {
    list.addSignal(createSignal({ id, type: 'reactive', contents: MARKER, transient: true }));
  }

  it('keeps a single copy when the same transient signal is re-sent', () => {
    const list = newList();

    sendTransient(list);
    sendTransient(list);
    sendTransient(list);

    expect(list.get.all.db().filter(message => message.role === 'signal')).toHaveLength(1);
    expect(promptTexts(list).filter(text => text.includes(MARKER))).toHaveLength(1);
  });

  it('moves the surviving copy to the end as the transcript grows', () => {
    const list = newList();

    sendTransient(list);
    list.add([{ role: 'assistant', content: 'first answer' }], 'response');
    sendTransient(list);
    list.add([{ role: 'assistant', content: 'second answer' }], 'response');
    sendTransient(list);

    const texts = promptTexts(list);
    expect(texts.filter(text => text.includes(MARKER))).toHaveLength(1);
    // Re-sending appends a fresh row, so the reminder is always the final prompt entry.
    expect(texts[texts.length - 1]).toContain(MARKER);
  });

  it('exposes the transient flag on the outbound projection', () => {
    const list = newList();
    sendTransient(list);

    const reminder = list.get.all.aiV5.prompt().find(message => {
      const content = message.content;
      return Array.isArray(content) && content.some((part: any) => part.type === 'text' && part.text.includes(MARKER));
    });

    expect(reminder).toBeDefined();
    const textPart = (reminder!.content as any[]).find(part => part.type === 'text');
    expect(textPart.providerOptions?.mastra?.transient).toBe(true);
  });

  it('does not mark a non-transient signal as transient in the projection', () => {
    const list = newList();
    list.addSignal(createSignal({ id: 'kept-1', type: 'reactive', contents: MARKER }));

    const reminder = list.get.all.aiV5.prompt().find(message => {
      const content = message.content;
      return Array.isArray(content) && content.some((part: any) => part.type === 'text' && part.text.includes(MARKER));
    });

    expect(reminder).toBeDefined();
    const textPart = (reminder!.content as any[]).find(part => part.type === 'text');
    expect(textPart.providerOptions?.mastra?.transient).toBeUndefined();
  });

  it('leaves a non-transient signal in place when it is re-sent', () => {
    const list = newList();

    list.addSignal(createSignal({ id: 'kept-1', type: 'reactive', contents: MARKER }));
    list.add([{ role: 'assistant', content: 'answer' }], 'response');
    list.addSignal(createSignal({ id: 'kept-1', type: 'reactive', contents: MARKER }));

    const texts = promptTexts(list);
    // One row, because the id matches — but it is not repositioned, so it is not last.
    expect(texts.filter(text => text.includes(MARKER))).toHaveLength(1);
    expect(texts[texts.length - 1]).not.toContain(MARKER);
  });
});
