import { describe, it, expect } from 'vitest';
import { convertDataContentToBase64String } from './prompt/data-content';
import { MessageList } from '.';

type CoreMessage = {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: ContentPart[];
};

type ContentPart = {
  type: 'text' | 'file' | 'tool-call' | 'tool-result' | 'reasoning' | 'redacted-reasoning' | 'image';
  text?: string;
  data?: string | URL | Uint8Array;
};

describe('MessageList.aiV4CoreMessageToV1PromptMessage', () => {
  // Setup common test data
  const sampleUrl = new URL('https://example.com/file.txt');
  const sampleString = 'Hello World';
  const sampleBinaryData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello" in ASCII

  it('should throw error when tool role message contains file content', () => {
    // Arrange: Create a tool role message with file content
    const toolMessage: CoreMessage = {
      role: 'tool',
      content: [{ type: 'file', data: sampleString }],
    };

    // Act & Assert: Verify error is thrown with appropriate message
    expect(() => {
      MessageList.aiV4CoreMessageToV1PromptMessage(toolMessage);
    }).toThrow('Saw incompatible message content part type file for message role tool');
  });

  it('should preserve URL data in file content for user role', () => {
    // Arrange: Create a user message with URL file content
    const userMessage: CoreMessage = {
      role: 'user',
      content: [{ type: 'file', data: sampleUrl }],
    };

    // Act: Convert the message
    const result = MessageList.aiV4CoreMessageToV1PromptMessage(userMessage);

    // Assert: Verify URL is preserved
    expect(result.content[0].type).toBe('file');
    expect((result.content[0] as any).data).toBe(sampleUrl);
  });

  it('should preserve string data in file content for user role', () => {
    // Arrange: Create a user message with string file content
    const userMessage: CoreMessage = {
      role: 'user',
      content: [{ type: 'file', data: sampleString }],
    };

    // Act: Convert the message
    const result = MessageList.aiV4CoreMessageToV1PromptMessage(userMessage);

    // Assert: Verify string content is preserved
    expect(result.content[0].type).toBe('file');
    expect((result.content[0] as any).data).toBe(sampleString);
  });

  it('should convert binary data in file content for user role', () => {
    // Arrange: Create a user message with binary file content
    const userMessage: CoreMessage = {
      role: 'user',
      content: [{ type: 'file', data: sampleBinaryData }],
    };

    // Act: Convert the message
    const result = MessageList.aiV4CoreMessageToV1PromptMessage(userMessage);

    // Assert: Verify binary content is converted properly
    expect(result.content[0].type).toBe('file');
    expect((result.content[0] as any).data).toBe(convertDataContentToBase64String(sampleBinaryData));
  });

  it('should preserve URL data in file content for assistant role', () => {
    // Arrange: Create an assistant message with URL file content
    const assistantMessage: CoreMessage = {
      role: 'assistant',
      content: [{ type: 'file', data: sampleUrl }],
    };

    // Act: Convert the message
    const result = MessageList.aiV4CoreMessageToV1PromptMessage(assistantMessage);

    // Assert: Verify URL is preserved
    expect(result.role).toBe('assistant');
    expect(result.content[0].type).toBe('file');
    expect((result.content[0] as any).data).toBe(sampleUrl);
  });

  it('should preserve string data in file content for assistant role', () => {
    // Arrange: Create an assistant message with string file content
    const assistantMessage: CoreMessage = {
      role: 'assistant',
      content: [{ type: 'file', data: sampleString }],
    };

    // Act: Convert the message
    const result = MessageList.aiV4CoreMessageToV1PromptMessage(assistantMessage);

    // Assert: Verify string content is preserved
    expect(result.role).toBe('assistant');
    expect(result.content[0].type).toBe('file');
    expect((result.content[0] as any).data).toBe(sampleString);
  });

  it('should convert binary data in file content for assistant role', () => {
    // Arrange: Create an assistant message with binary file content
    const assistantMessage: CoreMessage = {
      role: 'assistant',
      content: [{ type: 'file', data: sampleBinaryData }],
    };

    // Act: Convert the message
    const result = MessageList.aiV4CoreMessageToV1PromptMessage(assistantMessage);

    // Assert: Verify binary content is converted properly
    expect(result.role).toBe('assistant');
    expect(result.content[0].type).toBe('file');
    expect((result.content[0] as any).data).toBe(convertDataContentToBase64String(sampleBinaryData));
  });
});
