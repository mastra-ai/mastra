import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../state/types';

import { AIV5Adapter } from './AIV5Adapter';

/**
 * Tests for file part data handling in AIV5Adapter.toUIMessage.
 *
 * part.data is typed as string but may be Uint8Array, ArrayBuffer, or URL
 * at runtime (e.g. from channel attachment fetches). The adapter must handle
 * all of these without crashing.
 */
describe('AIV5Adapter.toUIMessage — file part data handling', () => {
  const makeDbMessage = (parts: MastraDBMessage['content']['parts']): MastraDBMessage => ({
    id: 'msg-1',
    role: 'user',
    createdAt: new Date(),
    content: {
      format: 2,
      parts,
    },
  });

  it('should handle string file data (base64)', () => {
    const dbMsg = makeDbMessage([
      {
        type: 'file',
        data: 'aGVsbG8=',
        mimeType: 'application/octet-stream',
      } as any,
    ]);

    const uiMsg = AIV5Adapter.toUIMessage(dbMsg);

    const filePart = uiMsg.parts.find(p => p.type === 'file') as any;
    expect(filePart).toBeDefined();
    expect(filePart.url).toContain('data:application/octet-stream;base64,');
  });

  it('should handle string file data (data URI)', () => {
    const dbMsg = makeDbMessage([
      {
        type: 'file',
        data: 'data:video/mp4;base64,AAAA',
        mimeType: 'video/mp4',
      } as any,
    ]);

    const uiMsg = AIV5Adapter.toUIMessage(dbMsg);

    const filePart = uiMsg.parts.find(p => p.type === 'file') as any;
    expect(filePart).toBeDefined();
    expect(filePart.url).toContain('data:');
    expect(filePart.mediaType).toBe('video/mp4');
  });

  it('should handle string file data (URL string)', () => {
    const dbMsg = makeDbMessage([
      {
        type: 'file',
        data: 'https://cdn.discord.com/attachments/123/456/video.mp4',
        mimeType: 'video/mp4',
      } as any,
    ]);

    const uiMsg = AIV5Adapter.toUIMessage(dbMsg);

    const filePart = uiMsg.parts.find(p => p.type === 'file') as any;
    expect(filePart).toBeDefined();
    expect(filePart.url).toBe('https://cdn.discord.com/attachments/123/456/video.mp4');
    expect(filePart.mediaType).toBe('video/mp4');
  });

  it('should handle Uint8Array file data without crashing', () => {
    const binary = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const dbMsg = makeDbMessage([
      {
        type: 'file',
        data: binary,
        mimeType: 'video/mp4',
      } as any,
    ]);

    const uiMsg = AIV5Adapter.toUIMessage(dbMsg);

    const filePart = uiMsg.parts.find(p => p.type === 'file') as any;
    expect(filePart).toBeDefined();
    expect(filePart.url).toContain('data:video/mp4;base64,');
    expect(filePart.mediaType).toBe('video/mp4');
  });

  it('should handle ArrayBuffer file data without crashing', () => {
    const buffer = new ArrayBuffer(4);
    new Uint8Array(buffer).set([0x00, 0x01, 0x02, 0x03]);
    const dbMsg = makeDbMessage([
      {
        type: 'file',
        data: buffer,
        mimeType: 'audio/mpeg',
      } as any,
    ]);

    const uiMsg = AIV5Adapter.toUIMessage(dbMsg);

    const filePart = uiMsg.parts.find(p => p.type === 'file') as any;
    expect(filePart).toBeDefined();
    expect(filePart.url).toContain('data:audio/mpeg;base64,');
    expect(filePart.mediaType).toBe('audio/mpeg');
  });

  it('should handle URL object file data', () => {
    const url = new URL('https://cdn.discord.com/attachments/123/456/video.mp4');
    const dbMsg = makeDbMessage([
      {
        type: 'file',
        data: url,
        mimeType: 'video/mp4',
      } as any,
    ]);

    const uiMsg = AIV5Adapter.toUIMessage(dbMsg);

    const filePart = uiMsg.parts.find(p => p.type === 'file') as any;
    expect(filePart).toBeDefined();
    expect(filePart.url).toBe('https://cdn.discord.com/attachments/123/456/video.mp4');
    expect(filePart.mediaType).toBe('video/mp4');
  });

  it('should skip unknown data types gracefully', () => {
    const dbMsg = makeDbMessage([
      {
        type: 'file',
        data: 12345,
        mimeType: 'video/mp4',
      } as any,
    ]);

    const uiMsg = AIV5Adapter.toUIMessage(dbMsg);

    const filePart = uiMsg.parts.find(p => p.type === 'file');
    expect(filePart).toBeUndefined();
  });
});
