import { Buffer } from 'buffer';
import { describe, it, expect } from 'vitest';
import { MessageList } from '.';

interface CoreMessage {
  role: 'user' | 'assistant' | 'tool';
  content: ContentPart[];
  metadata?: Record<string, unknown>;
}

interface ContentPart {
  type: string;
  data: URL | string | Uint8Array;
  filename?: string;
  contentType?: string;
}

describe('MessageList.aiV4CoreMessageToV1PromptMessage', () => {
  it('should throw error when tool role message contains file content', () => {
    // Arrange: Create a CoreMessage with tool role and file content
    const toolMessage = {
      role: 'tool',
      content: [
        {
          type: 'file',
          data: 'test-file-data',
        },
      ],
    };

    // Act & Assert: Verify error is thrown
    expect(() => MessageList.aiV4CoreMessageToV1PromptMessage(toolMessage)).toThrow();
  });

  it('should preserve URL file data in user message', () => {
    // Arrange: Create CoreMessage with URL file content
    const fileUrl = new URL('file:///test.txt');
    const userMessage: CoreMessage = {
      role: 'user',
      content: [
        {
          type: 'file',
          data: fileUrl,
        },
      ],
    };

    // Act: Convert the message
    const result = MessageList.aiV4CoreMessageToV1PromptMessage(userMessage);

    // Assert: Verify URL is preserved
    expect(result.content[0]).toEqual({
      type: 'file',
      data: fileUrl,
    });
  });

  it('should convert binary file data to base64 in user message', () => {
    // Arrange: Create CoreMessage with binary file content
    const binaryData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello" in ASCII
    const expectedBase64 = Buffer.from(binaryData).toString('base64');
    const userMessage: CoreMessage = {
      role: 'user',
      content: [
        {
          type: 'file',
          data: binaryData,
        },
      ],
    };

    // Act: Convert the message
    const result = MessageList.aiV4CoreMessageToV1PromptMessage(userMessage);

    // Assert: Verify binary data is converted to base64
    expect(result.content[0]).toEqual({
      type: 'file',
      data: expectedBase64,
    });
  });

  it('should preserve string file data in user role message', () => {
    // Arrange: Create a CoreMessage with string file content and metadata
    const fileData = 'test file content\nwith multiple lines\nand special chars: 🌟';
    const userMessage: CoreMessage = {
      role: 'user',
      metadata: {
        timestamp: 123456789,
        filename: 'test.txt',
        contentType: 'text/plain',
      },
      content: [
        {
          type: 'file',
          data: fileData,
          filename: 'test.txt',
          contentType: 'text/plain',
        },
      ],
    };

    // Act: Convert the message
    const result = MessageList.aiV4CoreMessageToV1PromptMessage(userMessage);

    // Assert: Verify string data and message structure are preserved
    expect(result.role).toBe('user');
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({
      type: 'file',
      data: fileData,
      filename: 'test.txt',
      contentType: 'text/plain',
    });
    expect(result.metadata).toEqual(userMessage.metadata);
  });

  it('should preserve string file data in assistant message', () => {
    // Arrange: Create CoreMessage with string file content
    const fileData = 'test file content';
    const assistantMessage = {
      role: 'assistant',
      metadata: {
        timestamp: 123456789,
      },
      content: [
        {
          type: 'file',
          data: fileData,
        },
      ],
    };

    // Act: Convert the message
    const result = MessageList.aiV4CoreMessageToV1PromptMessage(assistantMessage);

    // Assert: Verify string data and metadata are preserved
    expect(result.role).toBe('assistant');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('file');
    expect(result.content[0].data).toBe(fileData);
    expect(result.metadata).toEqual(assistantMessage.metadata);
  });

  it('should preserve URL file data when converting assistant role message', () => {
    // Arrange: Create CoreMessage with URL file content
    const fileUrl = new URL('file:///test.txt');
    const assistantMessage = {
      role: 'assistant',
      metadata: {
        timestamp: 123456789,
      },
      content: [
        {
          type: 'file',
          data: fileUrl,
        },
      ],
    };

    // Act: Convert the message
    const result = MessageList.aiV4CoreMessageToV1PromptMessage(assistantMessage);

    // Assert: Verify URL is preserved along with metadata
    expect(result.role).toBe('assistant');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('file');
    expect(result.content[0].data).toBe(fileUrl);
    expect(result.content[0].data.href).toBe(fileUrl.href);
    expect(result.metadata).toEqual(assistantMessage.metadata);
  });

  it('should convert binary file data to base64 in assistant role message', () => {
    // Arrange: Create CoreMessage with binary file content
    const binaryData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello" in ASCII
    const expectedBase64 = Buffer.from(binaryData).toString('base64');
    const assistantMessage = {
      role: 'assistant',
      metadata: {
        timestamp: 123456789,
      },
      content: [
        {
          type: 'file',
          data: binaryData,
        },
      ],
    };

    // Act: Convert the message
    const result = MessageList.aiV4CoreMessageToV1PromptMessage(assistantMessage);

    // Assert: Verify binary data is converted to base64
    expect(result.role).toBe('assistant');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('file');
    expect(result.content[0].data).toBe(expectedBase64);
    expect(Buffer.from(result.content[0].data, 'base64')).toEqual(Buffer.from(binaryData));
    expect(result.metadata).toEqual(assistantMessage.metadata);
  });
});
