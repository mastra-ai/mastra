import type { CoreUserMessage } from '@mastra/core/llm';
import { describe, expect, it } from 'vitest';
import { fromCoreUserMessageToMastraDBMessage } from './fromCoreUserMessage';

describe('fromCoreUserMessageToMastraDBMessage', () => {
  it('produces a single text part for string content', () => {
    const input: CoreUserMessage = { role: 'user', content: 'hello world' };
    const out = fromCoreUserMessageToMastraDBMessage(input);

    expect(out.role).toBe('user');
    expect(out.content.format).toBe(2);
    expect(out.content.parts).toEqual([{ type: 'text', text: 'hello world' }]);
    expect(out.id).toMatch(/^user-/);
    expect(out.createdAt).toBeInstanceOf(Date);
  });

  it('preserves text parts from array content', () => {
    const input: CoreUserMessage = {
      role: 'user',
      content: [
        { type: 'text', text: 'first' },
        { type: 'text', text: 'second' },
      ],
    };
    const out = fromCoreUserMessageToMastraDBMessage(input);

    expect(out.content.parts).toEqual([
      { type: 'text', text: 'first' },
      { type: 'text', text: 'second' },
    ]);
  });

  it('converts image parts with explicit mimeType', () => {
    const input: CoreUserMessage = {
      role: 'user',
      content: [{ type: 'image', image: 'https://example.com/cat.png', mimeType: 'image/png' }],
    };
    const out = fromCoreUserMessageToMastraDBMessage(input);

    expect(out.content.parts).toEqual([{ type: 'file', mediaType: 'image/png', url: 'https://example.com/cat.png' }]);
  });

  it('defaults image mediaType to image/* when mimeType is missing', () => {
    const input: CoreUserMessage = {
      role: 'user',
      content: [{ type: 'image', image: 'https://example.com/x' }],
    };
    const out = fromCoreUserMessageToMastraDBMessage(input);

    expect(out.content.parts).toEqual([{ type: 'file', mediaType: 'image/*', url: 'https://example.com/x' }]);
  });

  it('serializes URL image payloads to strings', () => {
    const input: CoreUserMessage = {
      role: 'user',
      content: [{ type: 'image', image: new URL('https://example.com/cat.png'), mimeType: 'image/png' }],
    };
    const out = fromCoreUserMessageToMastraDBMessage(input);

    expect(out.content.parts[0]).toMatchObject({
      type: 'file',
      mediaType: 'image/png',
      url: 'https://example.com/cat.png',
    });
  });

  it('converts file parts with filename preserved', () => {
    const input: CoreUserMessage = {
      role: 'user',
      content: [
        {
          type: 'file',
          data: 'https://example.com/doc.pdf',
          mimeType: 'application/pdf',
          filename: 'doc.pdf',
        },
      ],
    };
    const out = fromCoreUserMessageToMastraDBMessage(input);

    expect(out.content.parts).toEqual([
      {
        type: 'file',
        mediaType: 'application/pdf',
        url: 'https://example.com/doc.pdf',
        filename: 'doc.pdf',
      },
    ]);
  });

  it('serializes URL file payloads to strings', () => {
    const input: CoreUserMessage = {
      role: 'user',
      content: [
        {
          type: 'file',
          data: new URL('https://example.com/doc.pdf'),
          mimeType: 'application/pdf',
        },
      ],
    };
    const out = fromCoreUserMessageToMastraDBMessage(input);

    expect(out.content.parts[0]).toMatchObject({
      type: 'file',
      mediaType: 'application/pdf',
      url: 'https://example.com/doc.pdf',
    });
  });

  it('preserves multiple parts in order', () => {
    const input: CoreUserMessage = {
      role: 'user',
      content: [
        { type: 'text', text: 'here is an image' },
        { type: 'image', image: 'https://example.com/x.png', mimeType: 'image/png' },
        { type: 'file', data: 'https://example.com/doc.pdf', mimeType: 'application/pdf' },
      ],
    };
    const out = fromCoreUserMessageToMastraDBMessage(input);

    expect(out.content.parts.map(p => p.type)).toEqual(['text', 'file', 'file']);
  });
});
