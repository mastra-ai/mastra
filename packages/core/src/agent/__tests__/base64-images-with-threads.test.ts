import type { CoreMessage } from '@internal/ai-sdk-v4';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';

describe('Base64 Images with Threads - Issue #10480', () => {
  let mockModel: MockLanguageModelV2;
  let mockMemory: MockMemory;

  beforeEach(() => {
    mockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        content: [{ type: 'text', text: 'I can see the image' }],
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });

    mockMemory = new MockMemory({
      storage: new InMemoryStore(),
    });
  });

  it('should handle raw base64 image strings (without data: prefix) with thread and resource', async () => {
    // This is the exact scenario from issue #10480
    // Raw base64 string without the "data:image/png;base64," prefix
    const base64Image =
      'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII';

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are a helpful assistant that can see images',
      model: mockModel,
      memory: mockMemory,
    });

    // Before the fix, this would throw: "Error executing step prepare-memory-step: Error: Invalid URL: iVBORw0KG..."
    // After the fix, it should work correctly
    const result = await agent.generate(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What do you see in this image?' },
            {
              type: 'image',
              image: base64Image,
              mimeType: 'image/png',
            },
          ],
        },
      ],
      {
        memory: {
          thread: {
            id: 'test-thread-1',
          },
          resource: 'test-user-1',
        },
      },
    );

    expect(result.text).toBe('I can see the image');

    // Verify thread was created
    const thread = await mockMemory.getThreadById({ threadId: 'test-thread-1' });
    expect(thread).toBeDefined();
    expect(thread?.resourceId).toBe('test-user-1');
  });

  it('should handle data URI format images with thread and resource', async () => {
    const base64Image =
      'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII';
    const dataUri = `data:image/png;base64,${base64Image}`;

    const agent = new Agent({
      id: 'test-agent-2',
      name: 'Test Agent 2',
      instructions: 'You are a helpful assistant',
      model: mockModel,
      memory: mockMemory,
    });

    const result = await agent.generate(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this image' },
            {
              type: 'image',
              image: dataUri,
              mimeType: 'image/png',
            },
          ],
        },
      ],
      {
        memory: {
          thread: {
            id: 'test-thread-2',
          },
          resource: 'test-user-2',
        },
      },
    );

    expect(result.text).toBe('I can see the image');
  });

  it('should handle raw base64 images in stream mode with thread and resource', async () => {
    const base64Image =
      'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII';

    const streamModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-delta', id: 'text-1', delta: 'I see ' },
          { type: 'text-delta', id: 'text-2', delta: 'the image' },
          {
            type: 'finish',
            id: '3',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });

    const agent = new Agent({
      id: 'stream-agent',
      name: 'Stream Agent',
      instructions: 'You are a helpful assistant',
      model: streamModel,
      memory: mockMemory,
    });

    const stream = await agent.stream(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' },
            {
              type: 'image',
              image: base64Image,
              mimeType: 'image/png',
            },
          ],
        },
      ],
      {
        memory: {
          thread: {
            id: 'test-thread-stream',
          },
          resource: 'test-user-stream',
        },
      },
    );

    let fullText = '';
    for await (const textPart of stream.textStream) {
      fullText += textPart;
    }

    expect(fullText).toBe('I see the image');

    // Verify thread was created
    const thread = await mockMemory.getThreadById({ threadId: 'test-thread-stream' });
    expect(thread).toBeDefined();
    expect(thread?.resourceId).toBe('test-user-stream');
  });

  it('should handle multiple images with mixed formats (raw base64 and data URIs)', async () => {
    const rawBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const dataUri = `data:image/jpeg;base64,${rawBase64}`;

    const agent = new Agent({
      id: 'multi-image-agent',
      name: 'Multi Image Agent',
      instructions: 'You are a helpful assistant',
      model: mockModel,
      memory: mockMemory,
    });

    const result = await agent.generate(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Compare these two images' },
            {
              type: 'image',
              image: rawBase64, // Raw base64
              mimeType: 'image/png',
            },
            {
              type: 'image',
              image: dataUri, // Data URI
              mimeType: 'image/jpeg',
            },
          ],
        },
      ],
      {
        memory: {
          thread: {
            id: 'multi-image-thread',
          },
          resource: 'multi-image-user',
        },
      },
    );

    expect(result.text).toBe('I can see the image');
  });

  it('should handle experimental_attachments with raw base64', async () => {
    const rawBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII';

    const agent = new Agent({
      id: 'attachment-agent',
      name: 'Attachment Agent',
      instructions: 'You are a helpful assistant',
      model: mockModel,
      memory: mockMemory,
    });

    // Test with experimental_attachments format
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: 'Describe the attachment',
        experimental_attachments: [
          {
            url: rawBase64, // Raw base64 without data: prefix
            contentType: 'image/png',
            name: 'test-image.png',
          },
        ],
      } as CoreMessage,
    ];

    // This should not throw "Invalid URL" error
    const result = await agent.generate(messages, {
      memory: {
        thread: {
          id: 'attachment-thread',
        },
        resource: 'attachment-user',
      },
    });

    expect(result.text).toBe('I can see the image');
  });

  it('should handle HTTP image URLs with thread and resource', async () => {
    // Use a real placeholder image service that actually works
    const imageUrl = 'https://placehold.co/600x400/png';

    const urlModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        content: [{ type: 'text', text: 'I can see the image' }],
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });

    const agent = new Agent({
      id: 'url-agent',
      name: 'URL Agent',
      instructions: 'You are a helpful assistant',
      model: urlModel,
      memory: mockMemory,
    });

    const result = await agent.generate(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image from the URL?' },
            {
              type: 'image',
              image: imageUrl,
              mimeType: 'image/png',
            },
          ],
        },
      ],
      {
        memory: {
          thread: {
            id: 'url-thread',
          },
          resource: 'url-user',
        },
      },
    );

    expect(result.text).toBe('I can see the image');

    // Verify thread was created
    const thread = await mockMemory.getThreadById({ threadId: 'url-thread' });
    expect(thread).toBeDefined();
    expect(thread?.resourceId).toBe('url-user');
  }, 10000);

  it('should handle mixed URL and base64 images with thread and resource', async () => {
    const placeholderUrl = 'https://placehold.co/400x300/png';
    const rawBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    const mixedModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        content: [{ type: 'text', text: 'I can see the image' }],
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });

    const agent = new Agent({
      id: 'mixed-agent',
      name: 'Mixed Agent',
      instructions: 'You are a helpful assistant',
      model: mixedModel,
      memory: mockMemory,
    });

    const result = await agent.generate(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Compare these images' },
            {
              type: 'image',
              image: placeholderUrl,
              mimeType: 'image/png',
            },
            {
              type: 'image',
              image: rawBase64,
              mimeType: 'image/png',
            },
          ],
        },
      ],
      {
        memory: {
          thread: {
            id: 'mixed-thread',
          },
          resource: 'mixed-user',
        },
      },
    );

    expect(result.text).toBe('I can see the image');
  }, 10000);

  it('should handle experimental_attachments with HTTP URLs', async () => {
    const imageUrl = 'https://placehold.co/800x600/png';

    const agent = new Agent({
      id: 'url-attachment-agent',
      name: 'URL Attachment Agent',
      instructions: 'You are a helpful assistant',
      model: mockModel,
      memory: mockMemory,
    });

    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: 'Describe this product image',
        experimental_attachments: [
          {
            url: imageUrl,
            contentType: 'image/png',
            name: 'product.png',
          },
        ],
      } as CoreMessage,
    ];

    const result = await agent.generate(messages, {
      memory: {
        thread: {
          id: 'url-attachment-thread',
        },
        resource: 'url-attachment-user',
      },
    });

    expect(result.text).toBe('I can see the image');
  });
});
