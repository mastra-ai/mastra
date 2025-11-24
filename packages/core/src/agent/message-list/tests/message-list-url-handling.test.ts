import { describe, it, expect } from 'vitest';
import type { MastraMessageV2 } from '../../types';
import { MessageList } from '../index';

describe('MessageList - File URL Handling', () => {
  it('should preserve external URLs through V2->V3->V2 message conversion', () => {
    const messageList = new MessageList();
    const imageUrl = 'https://httpbin.org/image/png';

    // Create a V2 message with a file part containing a URL
    const v2Message: MastraMessageV2 = {
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

    // Add to message list (this will convert to V3 internally)
    messageList.add(v2Message, 'user');

    // Get V3 messages to see internal representation
    const v3Messages = messageList.get.all.v3();
    const v3FilePart = v3Messages[0].content.parts.find((p: any) => p.type === 'file');

    // V3 should have URL in the url field
    expect(v3FilePart).toBeDefined();
    expect(v3FilePart?.type).toBe('file');
    expect((v3FilePart as any)?.url).toBe(imageUrl);
    // Should NOT have malformed data URI
    expect((v3FilePart as any)?.url).not.toContain('data:image/png;base64,https://');

    // Get V2 messages back (used by InputProcessors)
    const v2MessagesBack = messageList.get.all.v2();
    const v2FilePartBack = v2MessagesBack[0].content.parts?.find((p: any) => p.type === 'file');

    // V2 should maintain the original URL
    expect(v2FilePartBack).toBeDefined();
    expect(v2FilePartBack?.type).toBe('file');
    expect((v2FilePartBack as any)?.data).toBe(imageUrl);
    // Should NOT have malformed data URI
    expect((v2FilePartBack as any)?.data).not.toContain('data:image/png;base64,https://');
  });

  it('should provide clean URLs to InputProcessors without data URI corruption', () => {
    const messageList = new MessageList();
    const imageUrl = 'https://httpbin.org/image/png';

    // Simulate what happens when stream receives messages with file parts
    const inputMessage: MastraMessageV2 = {
      id: 'input-msg',
      role: 'user',
      content: {
        format: 2,
        parts: [
          { type: 'file', mimeType: 'image/png', data: imageUrl },
          { type: 'text', text: 'What is this?' },
        ],
      },
      createdAt: new Date(),
      resourceId: 'resource-1',
      threadId: 'thread-1',
    };

    // Add message and convert through the pipeline
    messageList.add(inputMessage, 'user');

    // This is what InputProcessors would receive
    const v2Messages = messageList.get.all.v2();
    const filePart = v2Messages[0].content.parts?.find(p => p.type === 'file');

    // The file part's data should be the original URL, not corrupted
    expect(filePart).toBeDefined();
    if (filePart?.type === 'file') {
      // This is the critical assertion - InputProcessors should receive the clean URL
      expect(filePart.data).toBe(imageUrl);
      expect(filePart.data).not.toContain('data:image/png;base64,');

      // Verify it's not being double-encoded
      const dataUriPattern = /^data:.*?;base64,/;
      expect(filePart.data).not.toMatch(dataUriPattern);
    }
  });

  it('should correctly differentiate between URLs and base64 data', () => {
    const imageUrl = 'https://httpbin.org/image/png';
    const base64Data =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const dataUri = `data:image/png;base64,${base64Data}`;

    // Test with different data formats
    const messages: MastraMessageV2[] = [
      {
        id: 'url-msg',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'file', mimeType: 'image/png', data: imageUrl }],
        },
        createdAt: new Date(),
        resourceId: 'r1',
        threadId: 't1',
      },
      {
        id: 'base64-msg',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'file', mimeType: 'image/png', data: base64Data }],
        },
        createdAt: new Date(),
        resourceId: 'r1',
        threadId: 't1',
      },
      {
        id: 'datauri-msg',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'file', mimeType: 'image/png', data: dataUri }],
        },
        createdAt: new Date(),
        resourceId: 'r1',
        threadId: 't1',
      },
    ];

    messages.forEach(msg => {
      const list = new MessageList();
      list.add(msg, 'user');

      const v3Messages = list.get.all.v3();
      const v3FilePart = v3Messages[0].content.parts.find((p: any) => p.type === 'file');

      const v2Messages = list.get.all.v2();
      const v2FilePart = v2Messages[0].content.parts?.find((p: any) => p.type === 'file');

      if (msg.id === 'url-msg') {
        // URL should be preserved as-is
        expect((v3FilePart as any)?.url).toBe(imageUrl);
        expect((v2FilePart as any)?.data).toBe(imageUrl);
      } else if (msg.id === 'base64-msg') {
        // Base64 gets wrapped in data URI for V3, but comes back as base64 in V2
        expect((v3FilePart as any)?.url).toContain('data:image/png;base64,');
        // V2 gets back the base64 without data URI wrapper
        expect((v2FilePart as any)?.data).toBe(base64Data);
      } else if (msg.id === 'datauri-msg') {
        // Data URI should be preserved throughout
        expect((v3FilePart as any)?.url).toBe(dataUri);
        expect((v2FilePart as any)?.data).toBe(dataUri);
      }
    });
  });

  it('should preserve URLs for providers that support them natively', async () => {
    const messageList = new MessageList();
    const imageUrl = 'https://httpbin.org/image/png';

    // Add message with URL
    const v2Message: MastraMessageV2 = {
      id: 'test-msg-1',
      role: 'user',
      content: {
        format: 2,
        parts: [
          { type: 'text', text: 'Analyze this image' },
          { type: 'file', mimeType: 'image/png', data: imageUrl },
        ],
      },
      createdAt: new Date(),
      resourceId: 'test-resource',
      threadId: 'test-thread',
    };

    messageList.add(v2Message, 'user');

    // Test with provider that supports URLs (like OpenAI)
    const supportedUrls = {
      'image/png': [/^https:\/\/httpbin\.org\//],
    };

    const llmPrompt = await messageList.get.all.aiV5.llmPrompt({
      downloadConcurrency: 1,
      downloadRetries: 1,
      supportedUrls,
    });

    const userMessage = llmPrompt.find((msg: any) => msg.role === 'user');
    expect(userMessage).toBeDefined();

    if (userMessage && Array.isArray(userMessage.content)) {
      const filePart = userMessage.content.find((part: any) => part.type === 'file');
      expect(filePart).toBeDefined();
      expect(filePart?.type).toBe('file');
      // URL should be preserved, not converted to base64
      expect((filePart as any)?.data.toString()).toBe(imageUrl);
      expect((filePart as any)?.data).not.toContain('data:image/png;base64,');
    }
  });

  it('should download URLs for providers that do not support them', { timeout: 100000, retry: 3 }, async () => {
    const messageList = new MessageList();
    const imageUrl = 'https://httpbin.org/image/png';

    // Add message with URL
    const v2Message: MastraMessageV2 = {
      id: 'test-msg-2',
      role: 'user',
      content: {
        format: 2,
        parts: [
          { type: 'text', text: 'Analyze this image' },
          { type: 'file', mimeType: 'image/png', data: imageUrl },
        ],
      },
      createdAt: new Date(),
      resourceId: 'test-resource',
      threadId: 'test-thread',
    };

    messageList.add(v2Message, 'user');

    // Test with provider that does NOT support URLs (empty supportedUrls)
    const llmPrompt = await messageList.get.all.aiV5.llmPrompt({
      downloadConcurrency: 1,
      downloadRetries: 1,
      supportedUrls: {}, // No URL support
    });

    const userMessage = llmPrompt.find((msg: any) => msg.role === 'user');
    expect(userMessage).toBeDefined();

    if (userMessage && Array.isArray(userMessage.content)) {
      const filePart = userMessage.content.find((part: any) => part.type === 'file');
      expect(filePart).toBeDefined();
      expect(filePart?.type).toBe('file');
      // URL should be downloaded and converted to binary data
      expect((filePart as any)?.data).toBeInstanceOf(Uint8Array);
      expect((filePart as any)?.data).not.toBe(imageUrl);
    }
  });
});
