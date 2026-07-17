import { describe, expect, it } from 'vitest';

import { AIV5Adapter } from './AIV5Adapter';

describe('AIV5Adapter — FileUIPart (url-based) through fromModelMessage', () => {
  it('handles a file part with url (https) instead of data', () => {
    const dbMessage = AIV5Adapter.fromModelMessage({
      role: 'user',
      content: [
        {
          type: 'file',
          url: 'https://example.com/image.png',
          mediaType: 'image/png',
        } as any,
      ],
    });

    const filePart = dbMessage.content.parts?.find(p => p.type === 'file');
    expect(filePart).toBeDefined();
    expect(filePart?.type).toBe('file');
    if (filePart?.type === 'file') {
      expect(filePart.data).toBe('https://example.com/image.png');
      expect(filePart.mimeType).toBe('image/png');
    }

    expect(dbMessage.content.experimental_attachments).toEqual([
      { url: 'https://example.com/image.png', contentType: 'image/png' },
    ]);
  });

  it('handles a file part with a data: URI in url', () => {
    const dataUri = 'data:application/pdf;base64,JVBERi0xLjQ=';
    const dbMessage = AIV5Adapter.fromModelMessage({
      role: 'user',
      content: [
        {
          type: 'file',
          url: dataUri,
          mediaType: 'application/pdf',
        } as any,
      ],
    });

    const filePart = dbMessage.content.parts?.find(p => p.type === 'file');
    expect(filePart).toBeDefined();
    if (filePart?.type === 'file') {
      expect(filePart.data).toBe(dataUri);
      expect(filePart.mimeType).toBe('application/pdf');
    }
  });

  it('handles an image part with url instead of image', () => {
    const dbMessage = AIV5Adapter.fromModelMessage({
      role: 'user',
      content: [
        {
          type: 'image',
          url: 'https://example.com/photo.jpg',
          mediaType: 'image/jpeg',
        } as any,
      ],
    });

    const filePart = dbMessage.content.parts?.find(p => p.type === 'file');
    expect(filePart).toBeDefined();
    if (filePart?.type === 'file') {
      expect(filePart.data).toBe('https://example.com/photo.jpg');
      expect(filePart.mimeType).toBe('image/jpeg');
    }
  });

  it('uses default mimeType when mediaType is missing on a url file part', () => {
    const dbMessage = AIV5Adapter.fromModelMessage({
      role: 'user',
      content: [
        {
          type: 'file',
          url: 'https://example.com/doc.bin',
        } as any,
      ],
    });

    const filePart = dbMessage.content.parts?.find(p => p.type === 'file');
    expect(filePart).toBeDefined();
    if (filePart?.type === 'file') {
      expect(filePart.data).toBe('https://example.com/doc.bin');
      expect(filePart.mimeType).toBe('application/octet-stream');
    }
  });

  it('coexists with text parts in the same message', () => {
    const dbMessage = AIV5Adapter.fromModelMessage({
      role: 'user',
      content: [
        { type: 'text', text: 'Check this file' },
        {
          type: 'file',
          url: 'https://example.com/report.pdf',
          mediaType: 'application/pdf',
        } as any,
      ],
    });

    const parts = dbMessage.content.parts ?? [];
    expect(parts).toHaveLength(2);
    expect(parts[0]?.type).toBe('text');
    expect(parts[1]?.type).toBe('file');
    if (parts[1]?.type === 'file') {
      expect(parts[1].data).toBe('https://example.com/report.pdf');
    }
  });

  it('passes through an OpenAI Files API file ID without base64-encoding it', () => {
    const fileId = 'file-XkZk6RV6jeACpVewBphWEX';
    const dbMessage = {
      id: 'msg-1',
      role: 'user' as const,
      content: {
        format: 2 as const,
        parts: [
          {
            type: 'file' as const,
            data: fileId,
            mimeType: 'application/pdf',
          },
        ],
      },
    };

    const uiMsg = AIV5Adapter.toUIMessage(dbMessage as any);
    const filePart = uiMsg.parts.find((p: { type: string }) => p.type === 'file');

    expect(filePart).toBeDefined();
    if (filePart && filePart.type === 'file') {
      expect((filePart as any).url).toBe(fileId);
      expect((filePart as any).url).not.toMatch(/^data:/);
      expect((filePart as any).mediaType).toBe('application/pdf');
    }
  });

  it('preserves an OpenAI Files API file ID through the full ingestion round trip', () => {
    const fileId = 'file-XkZk6RV6jeACpVewBphWEX';

    // Ingestion: incoming model message with a file ID as data (the #16408 scenario)
    const dbMessage = AIV5Adapter.fromModelMessage({
      role: 'user',
      content: [
        {
          type: 'file',
          data: fileId,
          mediaType: 'application/pdf',
        },
      ],
    });

    const dbFilePart = dbMessage.content.parts?.find(p => p.type === 'file');
    expect(dbFilePart).toBeDefined();
    if (dbFilePart?.type === 'file') {
      expect(dbFilePart.data).toBe(fileId);
      expect(dbFilePart.data).not.toMatch(/^data:/);
    }

    // Readback: DB message converted back to a UI message keeps the ID intact
    const uiMsg = AIV5Adapter.toUIMessage(dbMessage);
    const uiFilePart = uiMsg.parts.find((p: { type: string }) => p.type === 'file');

    expect(uiFilePart).toBeDefined();
    if (uiFilePart && uiFilePart.type === 'file') {
      expect((uiFilePart as any).url).toBe(fileId);
      expect((uiFilePart as any).url).not.toMatch(/^data:/);
      expect((uiFilePart as any).mediaType).toBe('application/pdf');
    }
  });
});
