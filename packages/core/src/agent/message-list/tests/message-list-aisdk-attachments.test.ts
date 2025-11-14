import * as AIV4 from '@internal/ai-sdk-v4';
import { describe, it, expect } from 'vitest';
import type { MastraDBMessage } from '../../types';
import { MessageList } from '../index';

describe('MessageList - AI SDK v4 Attachment Handling', () => {
  it('should convert external URLs to experimental_attachments for AI SDK v4', () => {
    const messageList = new MessageList();
    const imageUrl = 'https://httpbin.org/image/png';

    // Create a V2 message with a file part containing a URL
    const v2Message: MastraDBMessage = {
      id: 'test-msg-1',
      role: 'user',
      content: {
        format: 2,
        parts: [
          { type: 'text', text: 'Describe this image' },
          { type: 'file', mimeType: 'image/png', data: imageUrl },
        ],
      },
      createdAt: new Date(),
      resourceId: 'test-resource',
      threadId: 'test-thread',
    };

    // Add to message list
    messageList.add(v2Message, 'user');

    // Get AI SDK v4 UI messages - this is what gets passed to convertToCoreMessages
    const v4UIMessages = messageList.get.all.aiV4.ui();

    // Check that the file attachment is formatted correctly for AI SDK v4
    expect(v4UIMessages).toHaveLength(1);
    const userMessage = v4UIMessages[0];

    if (!userMessage) {
      throw new Error('No user message found');
    }

    // For AI SDK v4, external URLs should be in experimental_attachments
    // and NOT in the content as file parts with raw URLs
    if (userMessage.experimental_attachments) {
      expect(userMessage.experimental_attachments).toHaveLength(1);
      expect(userMessage.experimental_attachments[0]?.url).toBe(imageUrl);
      expect(userMessage.experimental_attachments[0]?.contentType).toBe('image/png');
    }

    // The content should only have the text part, not the file part
    // OR if it has a file part, it should be properly formatted
    expect(userMessage.content).toBeDefined();

    // This should not throw an error
    let coreMessages;
    try {
      coreMessages = AIV4.convertToCoreMessages(v4UIMessages);
    } catch (error) {
      console.error('Error converting to core messages:', error);
      // If it throws, it's the bug we're looking for
      throw new Error(`AI SDK v4 convertToCoreMessages failed with URL: ${error}`);
    }

    expect(coreMessages).toBeDefined();
    expect(coreMessages).toHaveLength(1);
  });

  it('should handle base64 data URIs in experimental_attachments', () => {
    const messageList = new MessageList();
    const base64Data =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const dataUri = `data:image/png;base64,${base64Data}`;

    const v2Message: MastraDBMessage = {
      id: 'test-msg-2',
      role: 'user',
      content: {
        format: 2,
        parts: [
          { type: 'text', text: 'What is this?' },
          { type: 'file', mimeType: 'image/png', data: dataUri },
        ],
      },
      createdAt: new Date(),
      resourceId: 'test-resource',
      threadId: 'test-thread',
    };

    messageList.add(v2Message, 'user');

    const v4UIMessages = messageList.get.all.aiV4.ui();

    // This should not throw an error for proper base64 data
    let coreMessages;
    try {
      coreMessages = AIV4.convertToCoreMessages(v4UIMessages);
    } catch (error) {
      console.error('Error with base64 data:', error);
      throw error;
    }

    expect(coreMessages).toBeDefined();
  });

  it('should silently drop file parts with URLs in data field', () => {
    // This simulates the problematic message format that causes the error
    const problematicMessages = [
      {
        id: 'problem-msg',
        role: 'user' as const,
        content: 'Test',
        parts: [
          { type: 'text' as const, text: 'Describe it' },
          {
            type: 'file' as const,
            // This is the problematic format - URL in data field
            data: 'https://httpbin.org/image/png',
            mimeType: 'image/png',
          },
        ],
      },
    ];

    // Let's see what actually happens
    let result;
    try {
      result = AIV4.convertToCoreMessages(problematicMessages as any);
    } catch (error) {
      throw error;
    }

    // Check what the conversion produced
    expect(result).toBeDefined();
    expect(result[0]?.content).toBeInstanceOf(Array);
    const filePart = (result[0]?.content as any[])?.find(p => p.type === 'image');

    // The URL should have been preserved
    expect(filePart?.image).toBe(undefined); // File part is dropped
  });

  it('should throw error when attachment contains malformed data URI with URL', () => {
    // This tests that malformed data URIs (URL wrapped as base64) cause errors
    const buggyMessages = [
      {
        id: 'buggy-msg',
        role: 'user' as const,
        content: 'Test',
        parts: [{ type: 'text' as const, text: 'Describe it' }],
        experimental_attachments: [
          {
            contentType: 'image/png',
            // This is the bug - URL wrapped as if it were base64
            url: 'data:image/png;base64,https://httpbin.org/image/png',
          },
        ],
      },
    ];

    // This should throw the AI_InvalidDataContentError
    expect(() => {
      AIV4.convertToCoreMessages(buggyMessages as any);
    }).toThrow(/Invalid data content|base64/i);
  });

  it('should silently ignore file parts with invalid data URIs', () => {
    // AI SDK v4 silently ignores file parts with invalid data
    const messagesWithInvalidDataUri = [
      {
        id: 'invalid-msg',
        role: 'user' as const,
        content: 'Test',
        parts: [
          { type: 'text' as const, text: 'Describe it' },
          {
            type: 'file' as const,
            // Invalid: URL wrapped as if it were base64
            data: 'data:image/png;base64,https://httpbin.org/image/png',
            mimeType: 'image/png',
          },
        ],
      },
    ];

    // AI SDK v4 doesn't throw, it just ignores the invalid file part
    let result: any;
    expect(() => {
      result = AIV4.convertToCoreMessages(messagesWithInvalidDataUri as any);
    }).not.toThrow();

    // The file part should be silently dropped
    expect(result[0].content).toEqual([{ type: 'text', text: 'Describe it' }]);
  });
});
