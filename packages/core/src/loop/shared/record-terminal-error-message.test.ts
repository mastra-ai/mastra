import { describe, expect, it } from 'vitest';

import type { MastraDBMessage, MastraErrorPart } from '../../agent/message-list';
import { MessageList } from '../../agent/message-list';
import { recordTerminalErrorMessage, toPersistedErrorIdentity } from './record-terminal-error-message';

function errorPartsOf(message: MastraDBMessage | undefined): MastraErrorPart[] {
  return ((message?.content?.parts ?? []) as MastraErrorPart[]).filter(part => part?.type === 'error');
}

function makeList(): MessageList {
  return new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
}

/** A list holding a user turn plus the partial assistant output of one attempt. */
function makeListWithPartialAttempt(attemptId: string, parts: MastraDBMessage['content']['parts']) {
  const messageList = makeList();
  messageList.add('what is the weather?', 'input');
  messageList.add(
    {
      id: attemptId,
      role: 'assistant',
      createdAt: new Date(),
      content: { format: 2, parts },
    },
    'response',
  );
  return messageList;
}

describe('toPersistedErrorIdentity', () => {
  it('keeps only name and message', () => {
    const error = Object.assign(new TypeError('boom'), {
      statusCode: 429,
      cause: new Error('inner'),
    });

    expect(toPersistedErrorIdentity(error)).toEqual({ name: 'TypeError', message: 'boom' });
    expect(Object.keys(toPersistedErrorIdentity(error))).toEqual(['name', 'message']);
  });

  it('does not mutate the supplied error or invoke toJSON', () => {
    let toJSONCalls = 0;
    const error = new Error('boom');
    Object.defineProperty(error, 'toJSON', {
      value: () => {
        toJSONCalls += 1;
        return { name: 'LIED', message: 'LIED' };
      },
      enumerable: true,
    });
    const before = { name: error.name, message: error.message, stack: error.stack };

    expect(toPersistedErrorIdentity(error)).toEqual({ name: 'Error', message: 'boom' });
    expect(toJSONCalls).toBe(0);
    expect({ name: error.name, message: error.message, stack: error.stack }).toEqual(before);
  });

  it('falls back deterministically for blank, whitespace-only and non-Error inputs', () => {
    const fallback = { name: 'Error', message: 'Unknown error' };

    expect(toPersistedErrorIdentity(new Error(''))).toEqual({ name: 'Error', message: 'Unknown error' });
    expect(toPersistedErrorIdentity(new Error('   \n\t '))).toEqual(fallback);
    expect(toPersistedErrorIdentity('a thrown string')).toEqual(fallback);
    expect(toPersistedErrorIdentity(42)).toEqual(fallback);
    expect(toPersistedErrorIdentity(undefined)).toEqual(fallback);
    expect(toPersistedErrorIdentity(null)).toEqual(fallback);
    expect(toPersistedErrorIdentity({})).toEqual(fallback);
  });

  it('keeps a usable name when only message is blank and vice versa', () => {
    expect(toPersistedErrorIdentity(Object.assign(new Error(''), { name: 'APICallError' }))).toEqual({
      name: 'APICallError',
      message: 'Unknown error',
    });
  });

  it('preserves surrounding text and does not trim stored values', () => {
    expect(toPersistedErrorIdentity(new Error('  padded  '))).toEqual({ name: 'Error', message: '  padded  ' });
  });

  it('survives circular custom fields and causes', () => {
    const error = new Error('boom') as Error & { self?: unknown; nested?: unknown };
    error.self = error;
    error.nested = { back: error, deep: { deeper: error } };
    error.cause = error;

    expect(toPersistedErrorIdentity(error)).toEqual({ name: 'Error', message: 'boom' });
  });

  it('falls back when name or message getters throw', () => {
    const throwingName = new Error('boom');
    Object.defineProperty(throwingName, 'name', {
      get() {
        throw new Error('getter exploded');
      },
      enumerable: true,
    });
    expect(toPersistedErrorIdentity(throwingName)).toEqual({ name: 'Error', message: 'boom' });

    const throwingMessage = Object.assign(new Error('boom'), {});
    Object.defineProperty(throwingMessage, 'message', {
      get() {
        throw new Error('getter exploded');
      },
      enumerable: true,
    });
    expect(toPersistedErrorIdentity(throwingMessage)).toEqual({ name: 'Error', message: 'Unknown error' });

    const throwingBoth = new Proxy(
      {},
      {
        get() {
          throw new Error('proxy exploded');
        },
      },
    );
    expect(toPersistedErrorIdentity(throwingBoth)).toEqual({ name: 'Error', message: 'Unknown error' });
  });

  it('leaves the original runtime error untouched so stream/onError identity is unaffected', () => {
    const original = new Error('boom');
    const hostile = new Proxy(original, {
      get(target, property) {
        if (property === 'message') throw new Error('proxy exploded');
        return Reflect.get(target, property);
      },
    });

    expect(toPersistedErrorIdentity(hostile)).toEqual({ name: 'Error', message: 'Unknown error' });
    expect(original.message).toBe('boom');
    expect(original.name).toBe('Error');
  });
});

describe('recordTerminalErrorMessage', () => {
  it('creates an error-only assistant message when the attempt produced no output', () => {
    const messageList = makeList();
    messageList.add('what is the weather?', 'input');

    const recorded = recordTerminalErrorMessage({
      messageList,
      attemptId: 'attempt-1',
      activeId: 'attempt-1',
      error: new Error('model exploded'),
    });

    const all = messageList.get.all.db();
    expect(all.map(message => message.role)).toEqual(['user', 'assistant']);
    expect(all[1]?.id).toBe('attempt-1');
    expect(all[1]?.content?.parts).toEqual([
      { type: 'error', error: { name: 'Error', message: 'model exploded' }, createdAt: expect.any(Number) },
    ]);
    expect(recorded).toBe(all[1]);
  });

  it('appends the error part after existing partial parts on the same record', () => {
    const messageList = makeListWithPartialAttempt('attempt-1', [
      { type: 'text', text: 'partial answer' },
      { type: 'reasoning', text: 'partial reasoning' },
    ] as MastraDBMessage['content']['parts']);

    recordTerminalErrorMessage({
      messageList,
      attemptId: 'attempt-1',
      activeId: 'attempt-1',
      error: new Error('model exploded'),
    });

    const assistants = messageList.get.all.db().filter(message => message.role === 'assistant');
    expect(assistants).toHaveLength(1);
    expect(assistants[0]?.content?.parts.map(part => part.type)).toEqual(['text', 'reasoning', 'error']);
    expect(errorPartsOf(assistants[0])).toMatchObject([
      { type: 'error', error: { name: 'Error', message: 'model exploded' } },
    ]);
  });

  it('attaches to the attempt record after the response id was rotated, without splitting it', () => {
    const messageList = makeListWithPartialAttempt('attempt-1', [
      { type: 'text', text: 'partial answer' },
    ] as MastraDBMessage['content']['parts']);

    recordTerminalErrorMessage({
      messageList,
      attemptId: 'attempt-1',
      activeId: 'rotated-2',
      error: new Error('model exploded'),
    });

    const assistants = messageList.get.all.db().filter(message => message.role === 'assistant');
    expect(assistants).toHaveLength(1);
    expect(assistants[0]?.id).toBe('attempt-1');
    expect(assistants[0]?.content?.parts.map(part => part.type)).toEqual(['text', 'error']);
  });

  it('never falls back to an unrelated last assistant message', () => {
    const messageList = makeList();
    messageList.add('earlier question', 'input');
    messageList.add(
      {
        id: 'older-assistant',
        role: 'assistant',
        createdAt: new Date(Date.now() - 1000),
        content: { format: 2, parts: [{ type: 'text', text: 'earlier answer' }] },
      },
      'response',
    );
    messageList.add('what is the weather?', 'input');

    recordTerminalErrorMessage({
      messageList,
      attemptId: 'attempt-1',
      activeId: 'attempt-1',
      error: new Error('model exploded'),
    });

    const all = messageList.get.all.db();
    const older = all.find(message => message.id === 'older-assistant');
    expect(errorPartsOf(older)).toEqual([]);

    const created = all.find(message => message.id === 'attempt-1');
    expect(created?.role).toBe('assistant');
    expect(errorPartsOf(created)).toHaveLength(1);
  });

  it('records once when called repeatedly for the same attempt', () => {
    const messageList = makeListWithPartialAttempt('attempt-1', [
      { type: 'text', text: 'partial answer' },
    ] as MastraDBMessage['content']['parts']);

    const first = recordTerminalErrorMessage({
      messageList,
      attemptId: 'attempt-1',
      activeId: 'attempt-1',
      error: new Error('model exploded'),
    });
    const second = recordTerminalErrorMessage({
      messageList,
      attemptId: 'attempt-1',
      activeId: 'attempt-1',
      error: new Error('model exploded'),
    });

    const assistants = messageList.get.all.db().filter(message => message.role === 'assistant');
    expect(assistants).toHaveLength(1);
    expect(errorPartsOf(assistants[0])).toHaveLength(1);
    expect(second).toBe(first);
  });

  it('does not duplicate the record in the list or in unsaved messages', () => {
    const messageList = makeListWithPartialAttempt('attempt-1', [
      { type: 'text', text: 'partial answer' },
    ] as MastraDBMessage['content']['parts']);

    recordTerminalErrorMessage({
      messageList,
      attemptId: 'attempt-1',
      activeId: 'attempt-1',
      error: new Error('model exploded'),
    });

    const drained = messageList.drainUnsavedMessages();
    const drainedIds = drained.map(message => message.id);
    expect(drainedIds.filter(id => id === 'attempt-1')).toHaveLength(1);
    expect(drained.find(message => message.id === 'attempt-1')?.content?.parts.map(part => part.type)).toEqual([
      'text',
      'error',
    ]);
  });

  it('re-registers an already flushed attempt so the error part still persists', () => {
    const messageList = makeListWithPartialAttempt('attempt-1', [
      { type: 'text', text: 'partial answer' },
    ] as MastraDBMessage['content']['parts']);

    // Simulate a debounced mid-run flush draining the partial output first.
    expect(messageList.drainUnsavedMessages().map(message => message.id)).toContain('attempt-1');

    recordTerminalErrorMessage({
      messageList,
      attemptId: 'attempt-1',
      activeId: 'attempt-1',
      error: new Error('model exploded'),
    });

    const drainedAgain = messageList.drainUnsavedMessages();
    expect(drainedAgain.map(message => message.id)).toEqual(['attempt-1']);
    expect(drainedAgain[0]?.content?.parts.map(part => part.type)).toEqual(['text', 'error']);
  });

  it('stays safe when both ids are missing', () => {
    const messageList = makeList();
    messageList.add('what is the weather?', 'input');

    const recorded = recordTerminalErrorMessage({ messageList, error: new Error('model exploded') });

    const assistants = messageList.get.all.db().filter(message => message.role === 'assistant');
    expect(assistants).toHaveLength(1);
    expect(assistants[0]?.id).toBeTruthy();
    expect(errorPartsOf(assistants[0])).toMatchObject([
      { type: 'error', error: { name: 'Error', message: 'model exploded' } },
    ]);
    expect(recorded).toBe(assistants[0]);
  });

  it('does not replace an existing non-assistant record that owns the id', () => {
    const messageList = makeList();
    messageList.add(
      {
        id: 'attempt-1',
        role: 'user',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text: 'a user turn' }] },
      },
      'input',
    );

    recordTerminalErrorMessage({
      messageList,
      attemptId: 'attempt-1',
      activeId: 'attempt-1',
      error: new Error('model exploded'),
    });

    const all = messageList.get.all.db();
    expect(all).toHaveLength(2);
    expect(all[0]?.role).toBe('user');
    expect(all[0]?.content?.parts).toEqual([{ type: 'text', text: 'a user turn', createdAt: expect.any(Number) }]);
    expect(all[1]?.role).toBe('assistant');
    expect(errorPartsOf(all[1])).toHaveLength(1);
  });

  it('stores only a JSON-safe name/message payload', () => {
    const messageList = makeListWithPartialAttempt('attempt-1', []);
    const error = Object.assign(new Error('boom'), {
      statusCode: 500,
      cause: new Error('inner'),
      toJSON: () => ({ name: 'LIED', message: 'LIED' }),
    });
    (error as Error & { self?: unknown }).self = error;

    recordTerminalErrorMessage({ messageList, attemptId: 'attempt-1', activeId: 'attempt-1', error });

    const serialized = JSON.stringify(messageList.serialize());
    expect(() => JSON.parse(serialized)).not.toThrow();

    const parsed = JSON.parse(serialized) as { messages?: MastraDBMessage[] };
    const storedParts = (parsed.messages ?? [])
      .flatMap(message => message.content?.parts ?? [])
      .filter(part => part?.type === 'error') as MastraErrorPart[];

    expect(storedParts).toHaveLength(1);
    expect(storedParts[0]?.error).toEqual({ name: 'Error', message: 'boom' });
    expect(Object.keys(storedParts[0]?.error ?? {})).toEqual(['name', 'message']);
    expect(serialized).not.toContain('LIED');
    expect(serialized).not.toContain('statusCode');
  });
});
