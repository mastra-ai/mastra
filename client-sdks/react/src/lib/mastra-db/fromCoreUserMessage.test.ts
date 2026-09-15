import type { CoreUserMessage } from '@mastra/core/llm';
import { describe, expect, it } from 'vitest';
import { fromCoreUserMessageToMastraDBMessage, fromCoreUserMessagesToMastraDBMessage } from './fromCoreUserMessage';

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

    expect(out.content.parts).toEqual([{ type: 'file', mimeType: 'image/png', data: 'https://example.com/cat.png' }]);
  });

  it('defaults image mimeType to image/* when mimeType is missing', () => {
    const input: CoreUserMessage = {
      role: 'user',
      content: [{ type: 'image', image: 'https://example.com/x' }],
    };
    const out = fromCoreUserMessageToMastraDBMessage(input);

    expect(out.content.parts).toEqual([{ type: 'file', mimeType: 'image/*', data: 'https://example.com/x' }]);
  });

  it('converts data-URL image payloads to canonical file parts', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    const input: CoreUserMessage = {
      role: 'user',
      content: [{ type: 'image', image: dataUrl, mimeType: 'image/png' }],
    };
    const out = fromCoreUserMessageToMastraDBMessage(input);

    expect(out.content.parts).toEqual([{ type: 'file', mimeType: 'image/png', data: dataUrl }]);
  });

  it('serializes URL image payloads to strings', () => {
    const input: CoreUserMessage = {
      role: 'user',
      content: [{ type: 'image', image: new URL('https://example.com/cat.png'), mimeType: 'image/png' }],
    };
    const out = fromCoreUserMessageToMastraDBMessage(input);

    expect(out.content.parts[0]).toMatchObject({
      type: 'file',
      mimeType: 'image/png',
      data: 'https://example.com/cat.png',
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
        mimeType: 'application/pdf',
        data: 'https://example.com/doc.pdf',
        filename: 'doc.pdf',
      },
    ]);
  });

  it('encodes Uint8Array file payloads for optimistic render', () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]);
    const input: CoreUserMessage = {
      role: 'user',
      content: [{ type: 'file', data: bytes, mimeType: 'text/plain', filename: 'hello.txt' }],
    };
    const out = fromCoreUserMessageToMastraDBMessage(input);

    expect(out.content.parts[0]).toMatchObject({
      type: 'file',
      mimeType: 'text/plain',
      data: 'data:text/plain;base64,SGVsbG8=',
      filename: 'hello.txt',
    });
  });

  it('encodes Uint8Array image payloads for optimistic render', () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const input: CoreUserMessage = {
      role: 'user',
      content: [{ type: 'image', image: bytes, mimeType: 'image/png' }],
    };
    const out = fromCoreUserMessageToMastraDBMessage(input);

    expect(out.content.parts[0]).toMatchObject({
      type: 'file',
      mimeType: 'image/png',
      data: 'data:image/png;base64,iVBORw==',
    });
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
      mimeType: 'application/pdf',
      data: 'https://example.com/doc.pdf',
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

describe('fromCoreUserMessagesToMastraDBMessage', () => {
  it('merges a text message and an image message into a single multi-part message', () => {
    const messages: CoreUserMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'look at this' }] },
      { role: 'user', content: [{ type: 'image', image: 'https://example.com/cat.png', mimeType: 'image/png' }] },
    ];
    const out = fromCoreUserMessagesToMastraDBMessage(messages);

    expect(out.role).toBe('user');
    expect(out.content.format).toBe(2);
    expect(out.content.parts).toEqual([
      { type: 'text', text: 'look at this' },
      { type: 'file', mimeType: 'image/png', data: 'https://example.com/cat.png' },
    ]);
  });

  it('merges a text message and a PDF file message, preserving the filename', () => {
    const messages: CoreUserMessage[] = [
      { role: 'user', content: 'see attached' },
      {
        role: 'user',
        content: [
          { type: 'file', data: 'data:application/pdf;base64,AAAA', mimeType: 'application/pdf', filename: 'doc.pdf' },
        ],
      },
    ];
    const out = fromCoreUserMessagesToMastraDBMessage(messages);

    expect(out.content.parts).toEqual([
      { type: 'text', text: 'see attached' },
      { type: 'file', mimeType: 'application/pdf', data: 'data:application/pdf;base64,AAAA', filename: 'doc.pdf' },
    ]);
  });

  it('matches the single-message function for a single input', () => {
    const message: CoreUserMessage = {
      role: 'user',
      content: [
        { type: 'text', text: 'hello' },
        { type: 'image', image: 'https://example.com/x.png', mimeType: 'image/png' },
      ],
    };

    expect(fromCoreUserMessagesToMastraDBMessage([message]).content.parts).toEqual(
      fromCoreUserMessageToMastraDBMessage(message).content.parts,
    );
  });
});
