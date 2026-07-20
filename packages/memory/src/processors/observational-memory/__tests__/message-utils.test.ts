import type { MastraDBMessage } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import { describe, it, expect } from 'vitest';
import { getObservableMessages, stripThreadTags } from '../message-utils';

const THREAD_ID = 'thread-1';
const RESOURCE_ID = 'resource-1';

function createMessage(id: string, text: string, role: 'user' | 'assistant' = 'user'): MastraDBMessage {
  return {
    id,
    role,
    content: { format: 2, parts: [{ type: 'text', text }] },
    type: 'text',
    createdAt: new Date('2026-07-20T00:00:00.000Z'),
    threadId: THREAD_ID,
    resourceId: RESOURCE_ID,
  } as MastraDBMessage;
}

describe('getObservableMessages', () => {
  it('excludes context-sourced messages from the OM window', () => {
    const messageList = new MessageList({ threadId: THREAD_ID, resourceId: RESOURCE_ID });
    messageList.add(createMessage('input-1', 'Suggest a collar'), 'input');
    messageList.add(createMessage('context-1', '<client-context>{"page":"/products"}</client-context>'), 'context');
    messageList.add(createMessage('response-1', 'Here are some collars', 'assistant'), 'response');

    // The raw list still contains the context message — the prompt needs it.
    expect(messageList.get.all.db().map(m => m.id)).toContain('context-1');

    expect(getObservableMessages(messageList).map(m => m.id)).toEqual(['input-1', 'response-1']);
  });

  it('returns the full list when there are no context messages', () => {
    const messageList = new MessageList({ threadId: THREAD_ID, resourceId: RESOURCE_ID });
    messageList.add(createMessage('input-1', 'hello'), 'input');
    messageList.add(createMessage('response-1', 'hi', 'assistant'), 'response');

    expect(getObservableMessages(messageList).map(m => m.id)).toEqual(messageList.get.all.db().map(m => m.id));
  });
});

describe('stripThreadTags', () => {
  it('removes <thread> open tags with attributes', () => {
    expect(stripThreadTags('<thread id="abc">hello')).toBe('hello');
    expect(stripThreadTags('<thread>hello')).toBe('hello');
  });

  it('removes </thread> close tags', () => {
    expect(stripThreadTags('hello</thread>')).toBe('hello');
  });

  it('removes both open and close tags, trimming whitespace', () => {
    expect(stripThreadTags('  <thread id="1">hello world</thread>  ')).toBe('hello world');
  });

  it('is case-insensitive', () => {
    expect(stripThreadTags('<THREAD>hello</Thread>')).toBe('hello');
  });

  it('leaves unrelated angle-bracket text alone', () => {
    expect(stripThreadTags('<threading> kept')).toBe('<threading> kept');
    expect(stripThreadTags('a < b && c > d')).toBe('a < b && c > d');
  });

  it('runs in linear time on pathological input (no ReDoS)', () => {
    const input = '<thread'.repeat(5_000);
    stripThreadTags('<thread'.repeat(100)); // warm up JIT
    const start = performance.now();
    stripThreadTags(input);
    const elapsed = performance.now() - start;
    // Generous budget — linear implementation finishes in a few ms;
    // a quadratic implementation would take multiple seconds.
    expect(elapsed).toBeLessThan(2000);
  });
});
