import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../../types';
import { MessageList } from '../index';

describe('MessageList AI SDK v5 URL handling', () => {
  describe('V2 to AIV5 UI conversion for AI SDK v5', () => {
    it('should preserve remote URLs when converting messages for AI SDK v5', () => {
      const messageList = new MessageList();

      // This is the exact message format from the bug report
      const userMessage: MastraDBMessage = {
        id: 'msg-1',
        role: 'user',
        createdAt: new Date(),
        content: {
          format: 2 as const,
          parts: [
            {
              type: 'file',
              mimeType: 'image/png',
              data: 'https://storage.easyquiz.cc/ai-chat/20250905cdacd4dff092.png',
            },
            {
              type: 'text',
              text: 'Describe it',
            },
          ],
        },
      };

      messageList.add([userMessage], 'input');

      // Get AIV5 UI messages - this is what happens internally when format: 'aisdk' is used
      const v5Messages = messageList.get.all.aiV5.ui();

      // The AIV5 UI message should have the URL properly preserved
      expect(v5Messages).toHaveLength(1);
      expect(v5Messages[0].role).toBe('user');
      expect(v5Messages[0].parts).toHaveLength(2);

      const filePart = v5Messages[0].parts[0];
      expect(filePart.type).toBe('file');
      if (filePart.type === 'file') {
        // The URL should be preserved as-is, not wrapped as a data URI
        expect(filePart.url).toBe('https://storage.easyquiz.cc/ai-chat/20250905cdacd4dff092.png');
        // Make sure it's NOT wrapped as a malformed data URI
        expect(filePart.url).not.toContain('data:image/png;base64,https://');
        expect(filePart.url).not.toMatch(/^data:.*base64,https?:\/\//);
      }
    });

    it('should handle multiple image URLs in the same message', () => {
      const messageList = new MessageList();

      const userMessage: MastraDBMessage = {
        id: 'msg-2',
        role: 'user',
        createdAt: new Date(),
        content: {
          format: 2 as const,
          parts: [
            {
              type: 'file',
              mimeType: 'image/jpeg',
              data: 'https://example.com/image1.jpg',
            },
            {
              type: 'text',
              text: 'Compare these images',
            },
            {
              type: 'file',
              mimeType: 'image/png',
              data: 'https://example.com/image2.png',
            },
          ],
        },
      };

      messageList.add([userMessage], 'input');

      const v5Messages = messageList.get.all.aiV5.ui();

      expect(v5Messages).toHaveLength(1);
      expect(v5Messages[0].parts).toHaveLength(3);

      // Check first image
      const firstFile = v5Messages[0].parts[0];
      if (firstFile.type === 'file') {
        expect(firstFile.url).toBe('https://example.com/image1.jpg');
        expect(firstFile.mediaType).toBe('image/jpeg');
      }

      // Check second image
      const secondFile = v5Messages[0].parts[2];
      if (secondFile.type === 'file') {
        expect(secondFile.url).toBe('https://example.com/image2.png');
        expect(secondFile.mediaType).toBe('image/png');
      }
    });

    it('should handle base64 data URIs correctly', () => {
      const messageList = new MessageList();

      const base64Data =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      const dataUri = `data:image/png;base64,${base64Data}`;

      const userMessage: MastraDBMessage = {
        id: 'msg-3',
        role: 'user',
        createdAt: new Date(),
        content: {
          format: 2 as const,
          parts: [
            {
              type: 'file',
              mimeType: 'image/png',
              data: dataUri,
            },
            {
              type: 'text',
              text: 'What is this?',
            },
          ],
        },
      };

      messageList.add([userMessage], 'input');

      const v5Messages = messageList.get.all.aiV5.ui();

      expect(v5Messages).toHaveLength(1);
      expect(v5Messages[0].parts).toHaveLength(2);

      const filePart = v5Messages[0].parts[0];

      if (filePart.type === 'file') {
        // For data URIs, it should be preserved correctly
        expect(filePart.url).toBe(dataUri);
        expect(filePart.mediaType).toBe('image/png');
      }
    });

    it('should handle plain base64 strings (no data URI prefix)', () => {
      const messageList = new MessageList();

      const base64Data =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

      const userMessage: MastraDBMessage = {
        id: 'msg-4',
        role: 'user',
        createdAt: new Date(),
        content: {
          format: 2 as const,
          parts: [
            {
              type: 'file',
              mimeType: 'image/png',
              data: base64Data,
            },
            {
              type: 'text',
              text: 'What is this?',
            },
          ],
        },
      };

      messageList.add([userMessage], 'input');

      const v5Messages = messageList.get.all.aiV5.ui();

      expect(v5Messages).toHaveLength(1);
      expect(v5Messages[0].parts).toHaveLength(2);

      const filePart = v5Messages[0].parts[0];

      if (filePart.type === 'file') {
        // Plain base64 should be converted to a data URI
        expect(filePart.url).toBe(`data:image/png;base64,${base64Data}`);
        expect(filePart.mediaType).toBe('image/png');
      }
    });
  });

  describe('Edge cases that trigger the bug', () => {
    it('should NOT wrap non-http URLs as data URIs when they are actual URLs', () => {
      const messageList = new MessageList();

      // Some systems might use protocol-relative URLs or other URL schemes
      const userMessage: MastraDBMessage = {
        id: 'msg-edge-1',
        role: 'user',
        createdAt: new Date(),
        content: {
          format: 2 as const,
          parts: [
            {
              type: 'file',
              mimeType: 'image/png',
              // Protocol-relative URL (doesn't start with http:// or https://)
              data: '//storage.example.com/image.png',
            },
            {
              type: 'text',
              text: 'What is this?',
            },
          ],
        },
      };

      messageList.add([userMessage], 'input');

      const v5Messages = messageList.get.all.aiV5.ui();

      expect(v5Messages).toHaveLength(1);
      const filePart = v5Messages[0].parts[0];

      if (filePart.type === 'file') {
        // With the buggy code, this would become 'data:image/png;base64,//storage.example.com/image.png'
        // With the fix, it should handle it correctly
        expect(filePart.url).not.toMatch(/^data:.*base64,\/\//);
      }
    });

    it('should NOT double-wrap URLs that look like they might be base64', () => {
      const messageList = new MessageList();

      // A URL that might confuse the parser
      const userMessage: MastraDBMessage = {
        id: 'msg-edge-2',
        role: 'user',
        createdAt: new Date(),
        content: {
          format: 2 as const,
          parts: [
            {
              type: 'file',
              mimeType: 'image/png',
              // A URL path that contains base64-like characters
              data: 'ftp://server.com/aGVsbG8gd29ybGQ=.png',
            },
            {
              type: 'text',
              text: 'What is this?',
            },
          ],
        },
      };

      messageList.add([userMessage], 'input');

      const v5Messages = messageList.get.all.aiV5.ui();

      expect(v5Messages).toHaveLength(1);
      const filePart = v5Messages[0].parts[0];

      if (filePart.type === 'file') {
        // Should not wrap FTP URLs as data URIs
        expect(filePart.url).not.toMatch(/^data:.*base64,ftp:/);
      }
    });
  });

  describe('Issue #7498 - User reported scenarios', () => {
    it('should handle remote URL in file part when using AI SDK v5 format', () => {
      // This is the EXACT message format from the user's bug report
      const modelMessages = [
        {
          role: 'user' as const,
          content: [
            {
              type: 'file' as const,
              mediaType: 'image/png',
              data: 'https://storage.easyquiz.cc/ai-chat/20250905cdacd4dff092.png', // remote URL
            },
            { type: 'text' as const, text: 'Describe it' },
          ],
        },
      ];

      // User is passing these messages to stream with format: 'aisdk'
      const messageList = new MessageList();
      messageList.add(modelMessages, 'input');

      // Get V2 messages (what gets stored internally)
      const v2Messages = messageList.get.all.db();

      // Verify the V2 message structure
      expect(v2Messages).toHaveLength(1);
      expect(v2Messages[0].role).toBe('user');

      // Find the file part (it might not be the first part)
      const filePart = v2Messages[0].content.parts?.find((p: any) => p.type === 'file');

      expect(filePart).toBeDefined();
      expect(filePart?.type).toBe('file');
      if (filePart?.type === 'file') {
        // The data should be the URL, NOT wrapped as a data URI
        expect(filePart.data).toBe('https://storage.easyquiz.cc/ai-chat/20250905cdacd4dff092.png');
        expect(filePart.mimeType).toBe('image/png');
      }

      // Now convert to V3 (what happens internally when format: 'aisdk' is used)
      const v5Messages = messageList.get.all.aiV5.ui();

      expect(v5Messages).toHaveLength(1);
      expect(v5Messages[0].parts).toHaveLength(2);

      const v3FilePart = v5Messages[0].parts[0];
      expect(v3FilePart.type).toBe('file');

      if (v3FilePart.type === 'file') {
        // The URL should be preserved correctly, NOT wrapped as a malformed data URI
        expect(v3FilePart.url).toBe('https://storage.easyquiz.cc/ai-chat/20250905cdacd4dff092.png');

        // This is the critical assertion - the URL should NOT be wrapped as a data URI
        expect(v3FilePart.url).not.toContain('data:image/png;base64,https://');
        expect(v3FilePart.url).not.toMatch(/^data:.*base64,https?:\/\//);
      }
    });

    it('should handle base64 data correctly (working case from user report)', () => {
      // This is the working case from the user's report
      const base64Data =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

      const modelMessages = [
        {
          role: 'user' as const,
          content: [
            {
              type: 'file' as const,
              mediaType: 'image/png',
              data: base64Data, // Plain base64 string (no data URI prefix)
            },
            { type: 'text' as const, text: 'Describe it' },
          ],
        },
      ];

      const messageList = new MessageList();
      messageList.add(modelMessages, 'input');

      const v5Messages = messageList.get.all.aiV5.ui();

      expect(v5Messages).toHaveLength(1);
      const v3FilePart = v5Messages[0].parts[0];

      if (v3FilePart.type === 'file') {
        // Plain base64 should be converted to a proper data URI
        expect(v3FilePart.url).toBe(`data:image/png;base64,${base64Data}`);
        expect(v3FilePart.mediaType).toBe('image/png');
      }
    });
  });
});
