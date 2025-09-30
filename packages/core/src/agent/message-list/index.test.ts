import { describe, it, beforeEach, expect } from 'vitest';
import { MessageList } from '.';

// Define minimum required types based on usage in the function
interface ContentPart {
  type: string;
  [key: string]: any;
}

interface ModelMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string | ContentPart[];
  providerOptions?: any;
}

describe('MessageList.aiV5ModelMessageToV2PromptMessage', () => {
  // Sample image data for testing
  let sampleImageData: Uint8Array;
  let sampleImageArrayBuffer: ArrayBuffer;

  beforeEach(() => {
    sampleImageData = new Uint8Array([1, 2, 3, 4]);
    sampleImageArrayBuffer = sampleImageData.buffer;
  });

  it('should throw error when processing image content for tool role', () => {
    // Arrange: Create model message with tool role and image content
    const modelMessage: ModelMessage = {
      role: 'tool',
      content: [
        {
          type: 'image',
          image: sampleImageArrayBuffer,
        },
      ],
    };

    // Act & Assert: Verify error is thrown
    expect(() => {
      MessageList.aiV5ModelMessageToV2PromptMessage(modelMessage);
    }).toThrow();
  });

  it('should transform image content to file content with proper defaults', () => {
    // Arrange: Create model message with user role and image content
    const modelMessage: ModelMessage = {
      role: 'user',
      content: [
        {
          type: 'image',
          image: sampleImageArrayBuffer,
        },
      ],
    };

    // Act: Transform the message
    const result = MessageList.aiV5ModelMessageToV2PromptMessage(modelMessage);

    // Assert: Verify content transformation
    expect(result.role).toBe('user');
    expect(result.content).toHaveLength(1);

    const transformedContent = result.content[0];
    expect(transformedContent.type).toBe('file');
    expect(transformedContent.mediaType).toBe('image/unknown');
    expect(transformedContent.data).toBeInstanceOf(Uint8Array);
    expect(transformedContent.data).toEqual(sampleImageData);
  });

  it('should transform image content to file content for assistant role', () => {
    // Arrange: Create model message with assistant role and image content
    const modelMessage: ModelMessage = {
      role: 'assistant',
      content: [
        {
          type: 'image',
          image: sampleImageArrayBuffer,
        },
      ],
      providerOptions: {
        temperature: 0.7,
        maxTokens: 100,
      },
    };

    // Act: Transform the message
    const result = MessageList.aiV5ModelMessageToV2PromptMessage(modelMessage);

    // Assert: Verify content transformation and property preservation
    expect(result.role).toBe('assistant');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('file');
    expect(result.content[0].data).toBeInstanceOf(Uint8Array);
    expect(result.content[0].data).toEqual(sampleImageData);
    expect(result.content[0].mediaType).toBe('image/unknown');
    expect(result.providerOptions).toEqual({
      temperature: 0.7,
      maxTokens: 100,
    });
  });

  it('should preserve specified mediaType when transforming image to file content for assistant role', () => {
    // Arrange: Create model message with assistant role and image content with custom mediaType
    const modelMessage: ModelMessage = {
      role: 'assistant',
      content: [
        {
          type: 'image',
          image: sampleImageArrayBuffer,
          mediaType: 'image/jpeg',
        },
      ],
      providerOptions: {
        temperature: 0.7,
        maxTokens: 100,
      },
    };

    // Act: Transform the message
    const result = MessageList.aiV5ModelMessageToV2PromptMessage(modelMessage);

    // Assert: Verify content transformation and mediaType preservation
    expect(result.role).toBe('assistant');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('file');
    expect(result.content[0].data).toBeInstanceOf(Uint8Array);
    expect(result.content[0].data).toEqual(sampleImageData);
    expect(result.content[0].mediaType).toBe('image/jpeg');
    expect(result.providerOptions).toEqual({
      temperature: 0.7,
      maxTokens: 100,
    });
  });

  it('should handle Uint8Array image content with explicit mediaType for user role', () => {
    // Arrange: Create a user message with image content using Uint8Array directly
    const modelMessage: ModelMessage = {
      role: 'user',
      content: [
        {
          type: 'image',
          image: sampleImageData,
          mediaType: 'image/png',
        },
      ],
    };

    // Act: Transform the message
    const result = MessageList.aiV5ModelMessageToV2PromptMessage(modelMessage);

    // Assert: Verify content transformation and mediaType preservation
    expect(result.role).toBe('user');
    expect(result.content).toHaveLength(1);

    const transformedContent = result.content[0];
    expect(transformedContent.type).toBe('file');
    expect(transformedContent.mediaType).toBe('image/png');
    expect(transformedContent.data).toBeInstanceOf(Uint8Array);
    expect(transformedContent.data).toEqual(sampleImageData);
  });
});
