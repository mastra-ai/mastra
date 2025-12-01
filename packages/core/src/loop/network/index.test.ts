import { it, describe, expect } from 'vitest';
import type { MessageListInput } from '../../agent/message-list';
import { getLastMessage } from './index';

describe('getLastMessage', () => {
  it('returns string directly', () => {
    expect(getLastMessage('hello')).toBe('hello');
  });

  it('returns empty string for empty input', () => {
    expect(getLastMessage('')).toBe('');
    expect(getLastMessage([] as unknown as MessageListInput)).toBe('');
  });

  it('extracts from array of strings', () => {
    expect(getLastMessage(['first', 'second', 'last'])).toBe('last');
  });

  it('extracts from message with string content', () => {
    expect(getLastMessage([{ role: 'user', content: 'hello' }] as MessageListInput)).toBe('hello');
  });

  it('extracts from message with content array', () => {
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'first part' },
          { type: 'text', text: 'last part' },
        ],
      },
    ] as MessageListInput;
    expect(getLastMessage(messages)).toBe('last part');
  });

  it('extracts from message with parts array', () => {
    const messages = [
      {
        id: 'test-id',
        role: 'user',
        parts: [{ type: 'text', text: 'Tell me about Spirited Away' }],
      },
    ] as MessageListInput;
    expect(getLastMessage(messages)).toBe('Tell me about Spirited Away');
  });

  it('extracts last part from multiple parts', () => {
    const messages = [
      {
        role: 'user',
        parts: [
          { type: 'text', text: 'first' },
          { type: 'text', text: 'second' },
        ],
      },
    ] as MessageListInput;
    expect(getLastMessage(messages)).toBe('second');
  });

  it('returns last message from multiple messages', () => {
    const messages = [
      { role: 'user', content: 'first message' },
      { role: 'assistant', content: 'response' },
      { role: 'user', content: 'last message' },
    ] as MessageListInput;
    expect(getLastMessage(messages)).toBe('last message');
  });

  it('handles single message object (not array)', () => {
    expect(getLastMessage({ role: 'user', content: 'single' } as MessageListInput)).toBe('single');
  });

  it('returns empty string for non-text parts', () => {
    const messages = [
      { role: 'user', parts: [{ type: 'image', url: 'http://example.com' }] },
    ] as unknown as MessageListInput;
    expect(getLastMessage(messages)).toBe('');
  });
});
