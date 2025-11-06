import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fromCoreUserMessageToUIMessage } from './fromCoreUserMessageToUIMessage';
import type { MastraUIMessage } from '../types';
import { CoreUserMessage } from '@mastra/core/llm';

describe('fromCoreUserMessageToUIMessage', () => {
  describe('ID generation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should generate unique IDs with timestamp and random component', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const message: CoreUserMessage = {
        role: 'user',
        content: 'test message',
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.id).toMatch(/^user-\d+-[a-z0-9]{7}$/);
      expect(result.id).toContain(`user-${now}-`);
    });

    it('should generate different IDs for consecutive calls', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: 'test',
      };

      const result1 = fromCoreUserMessageToUIMessage(message);
      const result2 = fromCoreUserMessageToUIMessage(message);

      expect(result1.id).not.toBe(result2.id);
    });
  });

  describe('Role assignment', () => {
    it('should always set role to user', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: 'test message',
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.role).toBe('user');
    });
  });

  describe('String content conversion', () => {
    it('should convert simple string content to single text part', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: 'Hello, world!',
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts).toHaveLength(1);
      expect(result.parts[0]).toEqual({
        type: 'text',
        text: 'Hello, world!',
      });
    });

    it('should handle empty string content', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: '',
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts).toHaveLength(1);
      expect(result.parts[0]).toEqual({
        type: 'text',
        text: '',
      });
    });

    it('should handle string content with special characters', () => {
      const specialText = 'Line 1\nLine 2\tTabbed\r\n"quotes" and \'single\' 😀🎉';

      const message: CoreUserMessage = {
        role: 'user',
        content: specialText,
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts[0]).toEqual({
        type: 'text',
        text: specialText,
      });
    });

    it('should handle very long string content', () => {
      const longString = 'a'.repeat(100000);

      const message: CoreUserMessage = {
        role: 'user',
        content: longString,
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts[0]).toEqual({
        type: 'text',
        text: longString,
      });
      expect((result.parts[0] as { text: string }).text).toHaveLength(100000);
    });
  });

  describe('Array content with text parts', () => {
    it('should convert single text part', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Single text part',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts).toHaveLength(1);
      expect(result.parts[0]).toEqual({
        type: 'text',
        text: 'Single text part',
      });
    });

    it('should convert multiple text parts', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'First part',
          },
          {
            type: 'text',
            text: 'Second part',
          },
          {
            type: 'text',
            text: 'Third part',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts).toHaveLength(3);
      expect(result.parts[0]).toEqual({ type: 'text', text: 'First part' });
      expect(result.parts[1]).toEqual({ type: 'text', text: 'Second part' });
      expect(result.parts[2]).toEqual({ type: 'text', text: 'Third part' });
    });

    it('should handle text parts with empty strings', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: '',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts).toHaveLength(1);
      expect(result.parts[0]).toEqual({
        type: 'text',
        text: '',
      });
    });

    it('should preserve part order', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          { type: 'text', text: '1' },
          { type: 'text', text: '2' },
          { type: 'text', text: '3' },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts[0]).toEqual({ type: 'text', text: '1' });
      expect(result.parts[1]).toEqual({ type: 'text', text: '2' });
      expect(result.parts[2]).toEqual({ type: 'text', text: '3' });
    });
  });

  describe('Array content with image parts', () => {
    it('should convert image part with string URL', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'image',
            image: 'https://example.com/image.jpg',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts).toHaveLength(1);
      expect(result.parts[0]).toEqual({
        type: 'file',
        mediaType: 'image/*',
        url: 'https://example.com/image.jpg',
      });
    });

    it('should convert image part with data URL', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';

      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'image',
            image: dataUrl,
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts[0]).toEqual({
        type: 'file',
        mediaType: 'image/*',
        url: dataUrl,
      });
    });

    it('should convert image part with URL object', () => {
      const urlObject = new URL('https://example.com/photo.png');

      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'image',
            image: urlObject,
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts[0]).toEqual({
        type: 'file',
        mediaType: 'image/*',
        url: 'https://example.com/photo.png',
      });
    });

    it('should convert image part with Uint8Array to empty string', () => {
      const uint8Array = new Uint8Array([137, 80, 78, 71]);

      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'image',
            image: uint8Array,
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts[0]).toEqual({
        type: 'file',
        mediaType: 'image/*',
        url: '',
      });
    });

    it('should convert image part with ArrayBuffer to empty string', () => {
      const buffer = new ArrayBuffer(8);

      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'image',
            image: buffer,
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts[0]).toEqual({
        type: 'file',
        mediaType: 'image/*',
        url: '',
      });
    });

    it('should use provided mimeType when available', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'image',
            image: 'https://example.com/photo.jpg',
            mimeType: 'image/jpeg',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts[0]).toEqual({
        type: 'file',
        mediaType: 'image/jpeg',
        url: 'https://example.com/photo.jpg',
      });
    });

    it('should default to image/* when mimeType is not provided', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'image',
            image: 'https://example.com/image.gif',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts[0]).toEqual({
        type: 'file',
        mediaType: 'image/*',
        url: 'https://example.com/image.gif',
      });
    });

    it('should handle multiple image parts', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'image',
            image: 'https://example.com/image1.jpg',
            mimeType: 'image/jpeg',
          },
          {
            type: 'image',
            image: 'https://example.com/image2.png',
            mimeType: 'image/png',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts).toHaveLength(2);
      expect(result.parts[0]).toEqual({
        type: 'file',
        mediaType: 'image/jpeg',
        url: 'https://example.com/image1.jpg',
      });
      expect(result.parts[1]).toEqual({
        type: 'file',
        mediaType: 'image/png',
        url: 'https://example.com/image2.png',
      });
    });
  });

  describe('Array content with file parts', () => {
    it('should convert file part with string URL', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'file',
            data: 'https://example.com/document.pdf',
            mimeType: 'application/pdf',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts).toHaveLength(1);
      expect(result.parts[0]).toEqual({
        type: 'file',
        mediaType: 'application/pdf',
        url: 'https://example.com/document.pdf',
      });
    });

    it('should convert file part with data URL', () => {
      const dataUrl = 'data:text/plain;base64,SGVsbG8gV29ybGQ=';

      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'file',
            data: dataUrl,
            mimeType: 'text/plain',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts[0]).toEqual({
        type: 'file',
        mediaType: 'text/plain',
        url: dataUrl,
      });
    });

    it('should convert file part with URL object', () => {
      const urlObject = new URL('https://example.com/file.txt');

      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'file',
            data: urlObject,
            mimeType: 'text/plain',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts[0]).toEqual({
        type: 'file',
        mediaType: 'text/plain',
        url: 'https://example.com/file.txt',
      });
    });

    it('should convert file part with Uint8Array to empty string', () => {
      const uint8Array = new Uint8Array([72, 101, 108, 108, 111]);

      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'file',
            data: uint8Array,
            mimeType: 'application/octet-stream',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts[0]).toEqual({
        type: 'file',
        mediaType: 'application/octet-stream',
        url: '',
      });
    });

    it('should convert file part with ArrayBuffer to empty string', () => {
      const buffer = new ArrayBuffer(16);

      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'file',
            data: buffer,
            mimeType: 'application/octet-stream',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts[0]).toEqual({
        type: 'file',
        mediaType: 'application/octet-stream',
        url: '',
      });
    });

    it('should include filename when provided', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'file',
            data: 'https://example.com/report.pdf',
            mimeType: 'application/pdf',
            filename: 'annual-report.pdf',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts[0]).toEqual({
        type: 'file',
        mediaType: 'application/pdf',
        url: 'https://example.com/report.pdf',
        filename: 'annual-report.pdf',
      });
    });

    it('should omit filename when undefined', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'file',
            data: 'https://example.com/file.txt',
            mimeType: 'text/plain',
            filename: undefined,
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts[0]).toEqual({
        type: 'file',
        mediaType: 'text/plain',
        url: 'https://example.com/file.txt',
      });
      expect(result.parts[0]).not.toHaveProperty('filename');
    });

    it('should handle file parts with various mimeTypes', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'file',
            data: 'https://example.com/file1.pdf',
            mimeType: 'application/pdf',
          },
          {
            type: 'file',
            data: 'https://example.com/file2.docx',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
          {
            type: 'file',
            data: 'https://example.com/file3.csv',
            mimeType: 'text/csv',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts).toHaveLength(3);
      expect(result.parts[0]).toMatchObject({ mediaType: 'application/pdf' });
      expect(result.parts[1]).toMatchObject({
        mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      expect(result.parts[2]).toMatchObject({ mediaType: 'text/csv' });
    });

    it('should handle file with empty filename string', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'file',
            data: 'https://example.com/file.txt',
            mimeType: 'text/plain',
            filename: '',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts[0]).toEqual({
        type: 'file',
        mediaType: 'text/plain',
        url: 'https://example.com/file.txt',
        filename: '',
      });
    });
  });

  describe('Mixed content types', () => {
    it('should handle message with text and image parts', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Check out this image:',
          },
          {
            type: 'image',
            image: 'https://example.com/photo.jpg',
            mimeType: 'image/jpeg',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts).toHaveLength(2);
      expect(result.parts[0]).toEqual({
        type: 'text',
        text: 'Check out this image:',
      });
      expect(result.parts[1]).toEqual({
        type: 'file',
        mediaType: 'image/jpeg',
        url: 'https://example.com/photo.jpg',
      });
    });

    it('should handle message with text and file parts', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Here is the document:',
          },
          {
            type: 'file',
            data: 'https://example.com/doc.pdf',
            mimeType: 'application/pdf',
            filename: 'document.pdf',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts).toHaveLength(2);
      expect(result.parts[0]).toEqual({
        type: 'text',
        text: 'Here is the document:',
      });
      expect(result.parts[1]).toEqual({
        type: 'file',
        mediaType: 'application/pdf',
        url: 'https://example.com/doc.pdf',
        filename: 'document.pdf',
      });
    });

    it('should handle message with text, image, and file parts', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Review these files:',
          },
          {
            type: 'image',
            image: 'https://example.com/screenshot.png',
            mimeType: 'image/png',
          },
          {
            type: 'text',
            text: 'And the report:',
          },
          {
            type: 'file',
            data: 'https://example.com/report.pdf',
            mimeType: 'application/pdf',
            filename: 'report.pdf',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts).toHaveLength(4);
      expect(result.parts[0]).toEqual({
        type: 'text',
        text: 'Review these files:',
      });
      expect(result.parts[1]).toEqual({
        type: 'file',
        mediaType: 'image/png',
        url: 'https://example.com/screenshot.png',
      });
      expect(result.parts[2]).toEqual({
        type: 'text',
        text: 'And the report:',
      });
      expect(result.parts[3]).toEqual({
        type: 'file',
        mediaType: 'application/pdf',
        url: 'https://example.com/report.pdf',
        filename: 'report.pdf',
      });
    });

    it('should handle message with multiple files and images', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'image',
            image: 'https://example.com/image1.jpg',
            mimeType: 'image/jpeg',
          },
          {
            type: 'image',
            image: 'https://example.com/image2.png',
            mimeType: 'image/png',
          },
          {
            type: 'file',
            data: 'https://example.com/doc1.pdf',
            mimeType: 'application/pdf',
          },
          {
            type: 'file',
            data: 'https://example.com/doc2.txt',
            mimeType: 'text/plain',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts).toHaveLength(4);
      expect(result.parts.every(part => part.type === 'file')).toBe(true);
    });

    it('should preserve exact order of mixed parts', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          { type: 'text', text: '1' },
          { type: 'image', image: 'https://example.com/2.jpg' },
          { type: 'text', text: '3' },
          { type: 'file', data: 'https://example.com/4.pdf', mimeType: 'application/pdf' },
          { type: 'text', text: '5' },
          { type: 'image', image: 'https://example.com/6.png', mimeType: 'image/png' },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts).toHaveLength(6);
      expect((result.parts[0] as { text: string }).text).toBe('1');
      expect((result.parts[1] as { url: string }).url).toBe('https://example.com/2.jpg');
      expect((result.parts[2] as { text: string }).text).toBe('3');
      expect((result.parts[3] as { url: string }).url).toBe('https://example.com/4.pdf');
      expect((result.parts[4] as { text: string }).text).toBe('5');
      expect((result.parts[5] as { url: string }).url).toBe('https://example.com/6.png');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty array content', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts).toHaveLength(0);
    });

    it('should handle message with only whitespace', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: '   \n\t  ',
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts[0]).toEqual({
        type: 'text',
        text: '   \n\t  ',
      });
    });

    it('should handle unicode characters in text', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: '你好世界 🌍 مرحبا العالم',
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts[0]).toEqual({
        type: 'text',
        text: '你好世界 🌍 مرحبا العالم',
      });
    });

    it('should handle image with empty string URL', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'image',
            image: '',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts[0]).toEqual({
        type: 'file',
        mediaType: 'image/*',
        url: '',
      });
    });

    it('should handle file with empty string data', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'file',
            data: '',
            mimeType: 'text/plain',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts[0]).toEqual({
        type: 'file',
        mediaType: 'text/plain',
        url: '',
      });
    });
  });

  describe('Complete message structure', () => {
    it('should return complete MastraUIMessage structure', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: 'Test message',
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('role', 'user');
      expect(result).toHaveProperty('parts');
      expect(Array.isArray(result.parts)).toBe(true);
    });

    it('should return valid MastraUIMessage type', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'image', image: 'https://example.com/img.jpg', mimeType: 'image/jpeg' },
          { type: 'file', data: 'https://example.com/doc.pdf', mimeType: 'application/pdf', filename: 'doc.pdf' },
        ],
      };

      const result: MastraUIMessage = fromCoreUserMessageToUIMessage(message);

      expect(result.role).toBe('user');
      expect(result.parts).toHaveLength(3);
    });
  });

  describe('Complex real-world scenarios', () => {
    it('should handle multimodal prompt with description and multiple images', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Compare these architectural designs and provide feedback:',
          },
          {
            type: 'image',
            image: 'https://example.com/design1.jpg',
            mimeType: 'image/jpeg',
          },
          {
            type: 'image',
            image: 'https://example.com/design2.jpg',
            mimeType: 'image/jpeg',
          },
          {
            type: 'text',
            text: 'Also review the specifications in this document:',
          },
          {
            type: 'file',
            data: 'https://example.com/specs.pdf',
            mimeType: 'application/pdf',
            filename: 'specifications.pdf',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts).toHaveLength(5);
      expect(result.parts[0]).toMatchObject({ type: 'text' });
      expect(result.parts[1]).toMatchObject({ type: 'file', mediaType: 'image/jpeg' });
      expect(result.parts[2]).toMatchObject({ type: 'file', mediaType: 'image/jpeg' });
      expect(result.parts[3]).toMatchObject({ type: 'text' });
      expect(result.parts[4]).toMatchObject({ type: 'file', mediaType: 'application/pdf' });
    });

    it('should handle data analysis scenario with multiple file types', () => {
      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze the following datasets:',
          },
          {
            type: 'file',
            data: 'https://example.com/data.csv',
            mimeType: 'text/csv',
            filename: 'sales-data.csv',
          },
          {
            type: 'file',
            data: 'https://example.com/report.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename: 'quarterly-report.xlsx',
          },
          {
            type: 'image',
            image: 'https://example.com/chart.png',
            mimeType: 'image/png',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts).toHaveLength(4);
      expect((result.parts[1] as { filename?: string }).filename).toBe('sales-data.csv');
      expect((result.parts[2] as { filename?: string }).filename).toBe('quarterly-report.xlsx');
      expect((result.parts[3] as { mediaType: string }).mediaType).toBe('image/png');
    });

    it('should handle binary data with URL fallback', () => {
      const binaryData = new Uint8Array([255, 216, 255, 224]); // JPEG header

      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Process this image:',
          },
          {
            type: 'image',
            image: binaryData,
            mimeType: 'image/jpeg',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts).toHaveLength(2);
      expect(result.parts[1]).toEqual({
        type: 'file',
        mediaType: 'image/jpeg',
        url: '', // Binary data converted to empty string as documented
      });
    });

    it('should handle message with URL objects instead of strings', () => {
      const imageUrl = new URL('https://cdn.example.com/images/photo.jpg?size=large');
      const fileUrl = new URL('https://storage.example.com/documents/file.pdf#page=1');

      const message: CoreUserMessage = {
        role: 'user',
        content: [
          {
            type: 'image',
            image: imageUrl,
            mimeType: 'image/jpeg',
          },
          {
            type: 'file',
            data: fileUrl,
            mimeType: 'application/pdf',
            filename: 'document.pdf',
          },
        ],
      };

      const result = fromCoreUserMessageToUIMessage(message);

      expect(result.parts[0]).toEqual({
        type: 'file',
        mediaType: 'image/jpeg',
        url: 'https://cdn.example.com/images/photo.jpg?size=large',
      });
      expect(result.parts[1]).toEqual({
        type: 'file',
        mediaType: 'application/pdf',
        url: 'https://storage.example.com/documents/file.pdf#page=1',
        filename: 'document.pdf',
      });
    });
  });
});
