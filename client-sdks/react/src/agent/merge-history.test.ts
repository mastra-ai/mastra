import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { describe, expect, it } from 'vitest';
import { CLIENT_MESSAGE_ID_KEY } from '../lib/mastra-db';
import { catchUpWithHistory } from './merge-history';

const message = (id: string, role: 'user' | 'assistant', text: string, metadata?: Record<string, unknown>) =>
  ({
    id,
    role,
    createdAt: new Date(0),
    content: { format: 2, parts: [{ type: 'text', text }], ...(metadata ? { metadata } : {}) },
  }) as MastraDBMessage;
const texts = (messages: MastraDBMessage[]) =>
  messages.map(m => `${m.id}:${m.content.parts.map(p => (p.type === 'text' ? p.text : '')).join('')}`);

// A page that lost its thread stream (a phone locked, the network gone) follows the thread again with the stored
// history: the server sends it first, then only the parts newer than it, the active run's included.
describe('catching a conversation up with the stored history', () => {
  it('shows the stored copy of a reply the page saw only half of', () => {
    const conversation = [message('u1', 'user', 'Tell me more'), message('a1', 'assistant', 'Half')];
    const history = [message('u1', 'user', 'Tell me more'), message('a1', 'assistant', 'Half, then whole.')];

    expect(texts(catchUpWithHistory({ conversation, history }))).toEqual(['u1:Tell me more', 'a1:Half, then whole.']);
  });

  it('keeps in place the messages older than the history page, a sent message the server confirmed included', () => {
    const conversation = [
      // Confirmed: its echo cleared the pending status, and the row keeps its client id.
      message('s0', 'user', 'Hello', { [CLIENT_MESSAGE_ID_KEY]: 'client-set-0' }),
      message('a0', 'assistant', 'Hi'),
      message('u1', 'user', 'Tell me more'),
      message('a1', 'assistant', 'Half'),
    ];
    const history = [message('u1', 'user', 'Tell me more'), message('a1', 'assistant', 'Half, then whole.')];

    expect(texts(catchUpWithHistory({ conversation, history }))).toEqual([
      's0:Hello',
      'a0:Hi',
      'u1:Tell me more',
      'a1:Half, then whole.',
    ]);
  });

  const onItsWay = (id: string, text: string) =>
    message(id, 'user', text, { [CLIENT_MESSAGE_ID_KEY]: id, status: 'pending' });

  it('keeps a message still on its way after the history', () => {
    const conversation = [message('u1', 'user', 'Tell me more'), onItsWay('client-set-1', 'And then?')];
    const history = [message('u1', 'user', 'Tell me more'), message('a1', 'assistant', 'Whole.')];

    expect(texts(catchUpWithHistory({ conversation, history }))).toEqual([
      'u1:Tell me more',
      'a1:Whole.',
      'client-set-1:And then?',
    ]);
  });

  it('keeps a message still on its way after the history, when the page held none of the history', () => {
    const conversation = [message('a0', 'assistant', 'Earlier'), onItsWay('client-set-1', 'And then?')];
    const history = [message('u2', 'user', 'Later'), message('a2', 'assistant', 'Much later')];

    expect(texts(catchUpWithHistory({ conversation, history }))).toEqual([
      'a0:Earlier',
      'u2:Later',
      'a2:Much later',
      'client-set-1:And then?',
    ]);
  });

  // A stored user signal keeps the sender's metadata, its client id included, under `metadata.signal.metadata`.
  const storedSignal = (id: string, text: string, clientMessageId: string) =>
    message(id, 'user', text, { signal: { metadata: { [CLIENT_MESSAGE_ID_KEY]: clientMessageId } } });
  const clientIdOf = (messages: MastraDBMessage[], id: string) =>
    messages.find(m => m.id === id)?.content.metadata?.[CLIENT_MESSAGE_ID_KEY];

  it('swaps a message the server stored meanwhile for its stored copy, which keeps the row’s client id', () => {
    const conversation = [message('u1', 'user', 'Tell me more'), onItsWay('client-set-1', 'And then?')];
    const history = [message('u1', 'user', 'Tell me more'), storedSignal('s1', 'And then?', 'client-set-1')];

    const caughtUp = catchUpWithHistory({ conversation, history });

    expect(texts(caughtUp)).toEqual(['u1:Tell me more', 's1:And then?']);
    expect(clientIdOf(caughtUp, 's1')).toBe('client-set-1');
  });

  it('keeps the row’s client id on the stored copy of a sent message the server confirmed', () => {
    const conversation = [message('s1', 'user', 'And then?', { [CLIENT_MESSAGE_ID_KEY]: 'client-set-1' })];
    // Read back from storage without it: the page strips it from stored messages.
    const history = [message('s1', 'user', 'And then?'), message('a1', 'assistant', 'Then.')];

    const caughtUp = catchUpWithHistory({ conversation, history });

    expect(texts(caughtUp)).toEqual(['s1:And then?', 'a1:Then.']);
    expect(clientIdOf(caughtUp, 's1')).toBe('client-set-1');
  });

  // What the page streamed of a run carries that run's id.
  const streamed = (id: string, text: string, runId: string) =>
    message(id, 'assistant', text, { mode: 'stream', runId });

  it('drops what the page streamed of the running reply the server has not stored: it sends that run again', () => {
    const conversation = [message('u1', 'user', 'Tell me more'), streamed('a1', 'Half', 'run-1')];
    const history = [message('u1', 'user', 'Tell me more')];

    expect(texts(catchUpWithHistory({ conversation, history, activeRunId: 'run-1' }))).toEqual(['u1:Tell me more']);
  });

  it('shows what a reload would of the range the history covers: what the server did not store goes', () => {
    const conversation = [
      message('u1', 'user', 'Tell me more'),
      streamed('a1', 'Half', 'run-1'),
      message('tripwire-run-1', 'assistant', 'Blocked', { status: 'tripwire' }),
    ];
    const history = [message('u1', 'user', 'Tell me more'), message('a1', 'assistant', 'Whole.')];

    expect(texts(catchUpWithHistory({ conversation, history, activeRunId: null }))).toEqual([
      'u1:Tell me more',
      'a1:Whole.',
    ]);
  });

  it('drops it too when the server stores no history, as an agent without memory', () => {
    const conversation = [
      message('u0', 'user', 'Hello'),
      streamed('a0', 'Hi', 'run-0'),
      message('u1', 'user', 'Tell me more'),
      streamed('a1', 'Half', 'run-1'),
    ];

    expect(texts(catchUpWithHistory({ conversation, history: [], activeRunId: 'run-1' }))).toEqual([
      'u0:Hello',
      'a0:Hi',
      'u1:Tell me more',
    ]);
  });
});
