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
// history: the server sends it, then only the parts newer than it. What the page streamed meanwhile is stale.
describe('catching a conversation up with the stored history', () => {
  it('shows the stored copy of a reply the page saw only half of', () => {
    const conversation = [message('u1', 'user', 'Tell me more'), message('a1', 'assistant', 'Half')];
    const history = [message('u1', 'user', 'Tell me more'), message('a1', 'assistant', 'Half, then whole.')];

    expect(texts(catchUpWithHistory({ conversation, history }))).toEqual(['u1:Tell me more', 'a1:Half, then whole.']);
  });

  it('drops what the page streamed of a reply the server has not stored yet: the server sends it again', () => {
    const conversation = [message('u1', 'user', 'Tell me more'), message('a1', 'assistant', 'Half')];
    const history = [message('u1', 'user', 'Tell me more')];

    expect(texts(catchUpWithHistory({ conversation, history }))).toEqual(['u1:Tell me more']);
  });

  it('keeps the messages older than the history page', () => {
    const conversation = [
      message('u0', 'user', 'Hello'),
      message('a0', 'assistant', 'Hi'),
      message('u1', 'user', 'Tell me more'),
      message('a1', 'assistant', 'Half'),
    ];
    const history = [message('u1', 'user', 'Tell me more'), message('a1', 'assistant', 'Half, then whole.')];

    expect(texts(catchUpWithHistory({ conversation, history }))).toEqual([
      'u0:Hello',
      'a0:Hi',
      'u1:Tell me more',
      'a1:Half, then whole.',
    ]);
  });

  it('keeps a message still on its way to the server, and swaps one the server stored for its stored copy', () => {
    const conversation = [
      message('u1', 'user', 'Tell me more'),
      message('client-set-1', 'user', 'Stored', { [CLIENT_MESSAGE_ID_KEY]: 'client-set-1', status: 'pending' }),
      message('client-set-2', 'user', 'On its way', { [CLIENT_MESSAGE_ID_KEY]: 'client-set-2', status: 'pending' }),
    ];
    const stored = message('s1', 'user', 'Stored', {
      signal: { metadata: { [CLIENT_MESSAGE_ID_KEY]: 'client-set-1' } },
    });
    const history = [message('u1', 'user', 'Tell me more'), stored];

    const caughtUp = catchUpWithHistory({ conversation, history });

    expect(texts(caughtUp)).toEqual(['u1:Tell me more', 's1:Stored', 'client-set-2:On its way']);
    // Rows key on the client id: the stored copy keeps it, so the row does not remount.
    expect(caughtUp[1]?.content.metadata?.[CLIENT_MESSAGE_ID_KEY]).toBe('client-set-1');
  });

  it('keeps a message still on its way after the history, when the page had none of the history', () => {
    const conversation = [
      message('a0', 'assistant', 'Earlier'),
      message('client-set-1', 'user', 'On its way', { [CLIENT_MESSAGE_ID_KEY]: 'client-set-1', status: 'pending' }),
    ];
    const history = [message('u2', 'user', 'Later'), message('a2', 'assistant', 'Much later')];

    expect(texts(catchUpWithHistory({ conversation, history }))).toEqual([
      'a0:Earlier',
      'u2:Later',
      'a2:Much later',
      'client-set-1:On its way',
    ]);
  });

  it('shows the stored history whole when the page had none of it', () => {
    const conversation = [message('a1', 'assistant', 'Half')];
    const history = [message('u2', 'user', 'Later'), message('a2', 'assistant', 'Much later')];

    expect(texts(catchUpWithHistory({ conversation, history }))).toEqual(['a1:Half', 'u2:Later', 'a2:Much later']);
  });

  it('leaves the conversation as it is when the server stores no history', () => {
    const conversation = [message('u1', 'user', 'Tell me more'), message('a1', 'assistant', 'Half')];

    expect(catchUpWithHistory({ conversation, history: [] })).toBe(conversation);
  });
});
