import type { FilePart, ImagePart } from '@ai-sdk/provider-utils-v5';
import { describe, it, expect } from 'vitest';
import { convertImageFilePart } from './convert-file';

describe('convertImageFilePart', () => {
  describe('image parts', () => {
    it('auto-detects PNG from binary data', () => {
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const part: ImagePart = { type: 'image', image: png };
      const result = convertImageFilePart(part);
      expect(result).toMatchObject({ type: 'file', mediaType: 'image/png' });
    });

    it('falls back to image/* when detection fails', () => {
      const unknown = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const part: ImagePart = { type: 'image', image: unknown };
      const result = convertImageFilePart(part);
      expect(result).toMatchObject({ type: 'file', mediaType: 'image/*' });
    });

    it('uses provided mediaType when detection fails', () => {
      const unknown = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const part: ImagePart = { type: 'image', image: unknown, mediaType: 'image/svg+xml' };
      const result = convertImageFilePart(part);
      expect(result).toMatchObject({ type: 'file', mediaType: 'image/svg+xml' });
    });
  });

  describe('file parts with explicit mimeType', () => {
    it('passes through video/mp4 mimeType', () => {
      const data = new Uint8Array([0x00, 0x00, 0x00, 0x20]);
      const part: FilePart = { type: 'file', data, mediaType: 'video/mp4' };
      const result = convertImageFilePart(part);
      expect(result).toMatchObject({ type: 'file', mediaType: 'video/mp4' });
    });

    it('passes through application/pdf mimeType', () => {
      const data = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      const part: FilePart = { type: 'file', data, mediaType: 'application/pdf' };
      const result = convertImageFilePart(part);
      expect(result).toMatchObject({ type: 'file', mediaType: 'application/pdf' });
    });
  });

  describe('file parts with video auto-detection', () => {
    it('auto-detects video/webm from binary data', () => {
      const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00]);
      const part: FilePart = { type: 'file', data: webm, mediaType: undefined as unknown as string };
      const result = convertImageFilePart(part);
      expect(result).toMatchObject({ type: 'file', mediaType: 'video/webm' });
    });

    it('auto-detects video/mp4 with isom brand from binary data', () => {
      const mp4 = new Uint8Array([
        0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x00, 0x00,
      ]);
      const part: FilePart = { type: 'file', data: mp4, mediaType: undefined as unknown as string };
      const result = convertImageFilePart(part);
      expect(result).toMatchObject({ type: 'file', mediaType: 'video/mp4' });
    });

    it('auto-detects video/x-flv from binary data', () => {
      const flv = new Uint8Array([0x46, 0x4c, 0x56, 0x01, 0x05, 0x00, 0x00, 0x00, 0x09]);
      const part: FilePart = { type: 'file', data: flv, mediaType: undefined as unknown as string };
      const result = convertImageFilePart(part);
      expect(result).toMatchObject({ type: 'file', mediaType: 'video/x-flv' });
    });

    it('auto-detects video/webm from base64 string', () => {
      const part: FilePart = {
        type: 'file',
        data: 'GkXfowEAAAA',
        mediaType: undefined as unknown as string,
      };
      const result = convertImageFilePart(part);
      expect(result).toMatchObject({ type: 'file', mediaType: 'video/webm' });
    });

    it('auto-detects image/png from binary data in file part (fallback chain)', () => {
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const part: FilePart = { type: 'file', data: png, mediaType: undefined as unknown as string };
      const result = convertImageFilePart(part);
      expect(result).toMatchObject({ type: 'file', mediaType: 'image/png' });
    });

    it('throws when file part has no mimeType and detection fails', () => {
      const unknown = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c]);
      const part: FilePart = { type: 'file', data: unknown, mediaType: undefined as unknown as string };
      expect(() => convertImageFilePart(part)).toThrow('Media type is missing for file part');
    });
  });

  describe('URL-based parts', () => {
    it('passes URL data through for image parts', () => {
      const part: ImagePart = { type: 'image', image: new URL('https://example.com/image.png') };
      const result = convertImageFilePart(part);
      expect(result.type).toBe('file');
      expect((result as any).data).toBeInstanceOf(URL);
    });

    it('uses downloaded asset for URL-based image', () => {
      const url = new URL('https://example.com/photo.jpg');
      const part: ImagePart = { type: 'image', image: url };
      const downloaded = {
        [url.toString()]: {
          data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
          mediaType: 'image/jpeg' as string | undefined,
        },
      };
      const result = convertImageFilePart(part, downloaded);
      expect(result).toMatchObject({ type: 'file', mediaType: 'image/jpeg' });
    });
  });
});
