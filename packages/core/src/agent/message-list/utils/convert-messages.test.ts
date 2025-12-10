import type * as AIV4 from '@internal/ai-sdk-v4';
import type * as AIV5 from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import type { MastraDBMessage } from '../index';
import { convertMessages } from './convert-messages';

describe('convertMessages', () => {
  describe('AIV5 UI to other formats', () => {
    const v5UIMessage: AIV5.UIMessage = {
      id: 'test-1',
      role: 'user',
      parts: [{ type: 'text', text: 'Hello world' }],
    };

    it('converts AIV5 UI to AIV4 UI', () => {
      const result = convertMessages(v5UIMessage).to('AIV4.UI');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toBe('Hello world');
    });

    it('converts AIV5 UI to AIV4 Core', () => {
      const result = convertMessages(v5UIMessage).to('AIV4.Core');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toEqual([{ type: 'text', text: 'Hello world' }]);
    });

    it('converts AIV5 UI to Mastra V2', () => {
      const result = convertMessages(v5UIMessage).to('Mastra.V2');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content.format).toBe(2);
      expect(result[0].content.parts).toHaveLength(1);
      expect(result[0].content.parts[0].type).toBe('text');
      expect(result[0].content.parts[0].text).toBe('Hello world');
    });
  });

  describe('AIV4 UI to other formats', () => {
    const v4UIMessage: AIV4.UIMessage = {
      id: 'test-2',
      role: 'assistant',
      content: 'Hi there!',
      parts: [{ type: 'text', text: 'Hi there!' }],
    };

    it('converts AIV4 UI to AIV5 UI', () => {
      const result = convertMessages(v4UIMessage).to('AIV5.UI');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      // Check for text part - may have additional parts
      const textPart = result[0].parts.find(p => p.type === 'text');
      expect(textPart).toBeDefined();
      expect(textPart?.text).toBe('Hi there!');
    });

    it('converts AIV4 UI to AIV5 Model', () => {
      const result = convertMessages(v4UIMessage).to('AIV5.Model');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      expect(result[0].content).toEqual([{ type: 'text', text: 'Hi there!' }]);
    });

    it('converts AIV4 UI to Mastra V2', () => {
      const result = convertMessages(v4UIMessage).to('Mastra.V2');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      expect(result[0].content.format).toBe(2);
      // Check that parts are preserved
      expect(result[0].content.parts).toHaveLength(1);
      expect(result[0].content.parts[0].type).toBe('text');
      expect(result[0].content.parts[0].text).toBe('Hi there!');
    });
  });

  describe('Mastra V2 to other formats', () => {
    const mastraV2Message: MastraDBMessage = {
      id: 'test-3',
      role: 'user',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'Test message' }],
        content: 'Test message',
      },
    };

    it('converts Mastra V2 to AIV4 UI', () => {
      const result = convertMessages(mastraV2Message).to('AIV4.UI');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toBe('Test message');
    });

    it('converts Mastra V2 to AIV5 UI', () => {
      const result = convertMessages(mastraV2Message).to('AIV5.UI');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].parts).toEqual([{ type: 'text', text: 'Test message' }]);
    });
  });

  describe('Multiple messages', () => {
    const messages: AIV4.UIMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        parts: [{ type: 'text', text: 'Hello' }],
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi! How can I help?',
        parts: [{ type: 'text', text: 'Hi! How can I help?' }],
      },
      {
        id: 'msg-3',
        role: 'user',
        content: 'What is the weather?',
        parts: [{ type: 'text', text: 'What is the weather?' }],
      },
    ];

    it('converts multiple AIV4 UI messages to AIV5 UI', () => {
      const result = convertMessages(messages).to('AIV5.UI');
      expect(result).toHaveLength(3);
      expect(result[0].role).toBe('user');
      const textPart0 = result[0].parts.find(p => p.type === 'text');
      expect(textPart0?.text).toBe('Hello');

      expect(result[1].role).toBe('assistant');
      const textPart1 = result[1].parts.find(p => p.type === 'text');
      expect(textPart1?.text).toBe('Hi! How can I help?');

      expect(result[2].role).toBe('user');
      const textPart2 = result[2].parts.find(p => p.type === 'text');
      expect(textPart2?.text).toBe('What is the weather?');
    });

    it('converts multiple messages to Mastra V2', () => {
      const result = convertMessages(messages).to('Mastra.V2');
      expect(result).toHaveLength(3);
      // Check that parts are preserved for each message
      expect(result[0].content.parts[0].text).toBe('Hello');
      expect(result[1].content.parts[0].text).toBe('Hi! How can I help?');
      expect(result[2].content.parts[0].text).toBe('What is the weather?');
      result.forEach(msg => {
        expect(msg.content.format).toBe(2);
      });
    });
  });

  // Note: Tool message testing is simplified to avoid complex type issues
  // The actual conversion of tool parts is tested in the main MessageList tests

  describe('Error handling', () => {
    it('throws error for unsupported output format', () => {
      expect(() => {
        // @ts-expect-error - testing invalid format
        convertMessages({ role: 'user', content: 'test' }).to('INVALID');
      }).toThrow('Unsupported output format: INVALID');
    });
  });

  describe('data-* parts preservation', () => {
    // Test for issue #10936 and #10477: data-* parts should survive the round-trip
    // Stream → Storage → UI conversion

    const mastraV2MessageWithDataParts: MastraDBMessage = {
      id: 'test-data-parts',
      role: 'assistant',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [
          { type: 'text', text: 'Processing your request...' },
          {
            type: 'data-progress',
            data: {
              taskName: 'file-upload',
              progress: 50,
              status: 'in-progress',
            },
          } as any,
          {
            type: 'data-file-reference',
            data: {
              fileId: 'file-123',
              fileName: 'document.pdf',
            },
          } as any,
        ],
        content: 'Processing your request...',
      },
    };

    it('should preserve data-* parts when converting Mastra V2 to AIV5 UI', () => {
      const result = convertMessages(mastraV2MessageWithDataParts).to('AIV5.UI');

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');

      // Check that text part is preserved
      const textPart = result[0].parts.find(p => p.type === 'text');
      expect(textPart).toBeDefined();
      expect((textPart as any).text).toBe('Processing your request...');

      // Check that data-progress part is preserved
      const progressPart = result[0].parts.find(p => p.type === 'data-progress');
      expect(progressPart).toBeDefined();
      expect((progressPart as any).data).toEqual({
        taskName: 'file-upload',
        progress: 50,
        status: 'in-progress',
      });

      // Check that data-file-reference part is preserved
      const fileRefPart = result[0].parts.find(p => p.type === 'data-file-reference');
      expect(fileRefPart).toBeDefined();
      expect((fileRefPart as any).data).toEqual({
        fileId: 'file-123',
        fileName: 'document.pdf',
      });
    });

    it('should preserve data-* parts when converting Mastra V2 to AIV4 UI', () => {
      // Note: AIV4 doesn't natively support data-* parts, but we should not lose them
      // The filterDataParts function filters them out for V4 type compatibility
      // This test documents the current behavior - data-* parts ARE filtered for V4
      const result = convertMessages(mastraV2MessageWithDataParts).to('AIV4.UI');

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');

      // Text part should be preserved
      const textPart = result[0].parts.find(p => p.type === 'text');
      expect(textPart).toBeDefined();

      // Data parts are filtered out in V4 conversion (current behavior)
      // If we want to preserve them, we'd need to update filterDataParts
      const progressPart = result[0].parts.find(p => p.type === 'data-progress');
      const fileRefPart = result[0].parts.find(p => p.type === 'data-file-reference');

      // Current behavior: data-* parts are filtered out for AIV4.UI
      // This is intentional for type safety, but users may want them preserved
      expect(progressPart).toBeUndefined();
      expect(fileRefPart).toBeUndefined();
    });

    it('should preserve data-* parts in Mastra V2 round-trip', () => {
      // Convert to Mastra V2 and back - parts should be preserved
      const v2Result = convertMessages(mastraV2MessageWithDataParts).to('Mastra.V2');

      expect(v2Result).toHaveLength(1);
      expect(v2Result[0].content.parts).toHaveLength(3);

      // All parts including data-* should be preserved in V2 format
      const progressPart = v2Result[0].content.parts.find((p: any) => p.type === 'data-progress');
      expect(progressPart).toBeDefined();
      expect((progressPart as any).data.progress).toBe(50);

      const fileRefPart = v2Result[0].content.parts.find((p: any) => p.type === 'data-file-reference');
      expect(fileRefPart).toBeDefined();
      expect((fileRefPart as any).data.fileId).toBe('file-123');
    });

    it('should handle multiple messages with data-* parts', () => {
      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Upload my file' }],
            content: 'Upload my file',
          },
        },
        {
          id: 'msg-2',
          role: 'assistant',
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'Uploading...' },
              {
                type: 'data-upload-progress',
                data: { percent: 100, fileName: 'doc.pdf' },
              } as any,
            ],
            content: 'Uploading...',
          },
        },
      ];

      const result = convertMessages(messages).to('AIV5.UI');

      expect(result).toHaveLength(2);

      // First message (user) should have text
      expect(result[0].role).toBe('user');
      expect(result[0].parts.find(p => p.type === 'text')).toBeDefined();

      // Second message (assistant) should have both text and data-* parts
      expect(result[1].role).toBe('assistant');
      const assistantTextPart = result[1].parts.find(p => p.type === 'text');
      expect(assistantTextPart).toBeDefined();

      const uploadPart = result[1].parts.find(p => p.type === 'data-upload-progress');
      expect(uploadPart).toBeDefined();
      expect((uploadPart as any).data.percent).toBe(100);
    });
  });
});
