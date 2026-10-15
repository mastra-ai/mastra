import { describe, it, expect } from 'vitest';
import { textDBMessageFixture, textStreamFixture } from './fixtures';

describe('new-message-format', () => {
  it('text fixture deltas join into the full text', () => {
    const text = textStreamFixture
      .filter(part => part.type === 'text-delta')
      .map(part => part.delta)
      .join('');

    expect(text).toBe('Hello, world!');
  });

  it('db message fixture holds the same text', () => {
    expect(textDBMessageFixture.content.parts).toEqual([{ type: 'text', text: 'Hello, world!' }]);
  });
});
