import { describe, it, expect } from 'vitest';
import type { MastraMessageV2 } from '../../message-list';
import { convertToV1Messages } from './convert-to-mastra-v1';

describe('convertToV1Messages - reasoning and file support', () => {
  it('should handle file parts in messages', () => {
    const messages: MastraMessageV2[] = [
      {
        id: 'msg-with-file',
        role: 'assistant',
        createdAt: new Date(),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          parts: [
            {
              type: 'text',
              text: 'Here is the image you requested:',
            },
            {
              type: 'file',
              data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
              mimeType: 'image/png',
            },
            {
              type: 'text',
              text: 'This is a 1x1 pixel image.',
            },
          ],
        },
      },
    ];

    const result = convertToV1Messages(messages);

    // Should combine all parts into a single message since no tool invocations
    expect(result.length).toBe(1);
    expect(result[0].role).toBe('assistant');
    expect(result[0].type).toBe('text');

    // Content should be an array with all parts
    expect(Array.isArray(result[0].content)).toBe(true);
    if (Array.isArray(result[0].content)) {
      expect(result[0].content.length).toBe(3);
      expect(result[0].content[0].type).toBe('text');
      expect(result[0].content[1].type).toBe('file');
      expect(result[0].content[2].type).toBe('text');

      const filePart = result[0].content[1];
      if (filePart.type === 'file') {
        expect(filePart.data).toContain('data:image/png');
        expect(filePart.mimeType).toBe('image/png');
      }
    }
  });

  it('should handle reasoning parts in messages', () => {
    const messages: MastraMessageV2[] = [
      {
        id: 'msg-with-reasoning',
        role: 'assistant',
        createdAt: new Date(),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          parts: [
            {
              type: 'text',
              text: 'Let me think about this problem:',
            },
            {
              type: 'reasoning',
              details: [
                {
                  type: 'text',
                  text: 'First, I need to analyze the requirements',
                  signature: 'sig-123',
                },
                {
                  type: 'text',
                  text: 'Then, I will consider possible solutions',
                  signature: 'sig-456',
                },
              ],
            },
            {
              type: 'text',
              text: 'Based on my analysis, here is the solution:',
            },
          ],
        },
      },
    ];

    const result = convertToV1Messages(messages);

    // Should combine all parts into a single message
    expect(result.length).toBe(1);
    expect(result[0].role).toBe('assistant');
    expect(result[0].type).toBe('text');

    // Content should contain reasoning parts
    expect(Array.isArray(result[0].content)).toBe(true);
    if (Array.isArray(result[0].content)) {
      // Text + 2 reasoning parts + text = 4 parts
      expect(result[0].content.length).toBe(4);

      expect(result[0].content[0].type).toBe('text');
      expect(result[0].content[1].type).toBe('reasoning');
      expect(result[0].content[2].type).toBe('reasoning');
      expect(result[0].content[3].type).toBe('text');

      const reasoning1 = result[0].content[1];
      if (reasoning1.type === 'reasoning') {
        expect(reasoning1.text).toBe('First, I need to analyze the requirements');
        expect(reasoning1.signature).toBe('sig-123');
      }

      const reasoning2 = result[0].content[2];
      if (reasoning2.type === 'reasoning') {
        expect(reasoning2.text).toBe('Then, I will consider possible solutions');
        expect(reasoning2.signature).toBe('sig-456');
      }
    }
  });

  it('should handle redacted reasoning parts', () => {
    const messages: MastraMessageV2[] = [
      {
        id: 'msg-with-redacted',
        role: 'assistant',
        createdAt: new Date(),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          parts: [
            {
              type: 'reasoning',
              details: [
                {
                  type: 'text',
                  text: 'Analyzing sensitive data',
                  signature: 'sig-789',
                },
                {
                  type: 'redacted',
                  data: 'REDACTED_CONTENT_ID_123',
                },
              ],
            },
            {
              type: 'text',
              text: 'The analysis is complete.',
            },
          ],
        },
      },
    ];

    const result = convertToV1Messages(messages);

    expect(result.length).toBe(1);
    expect(Array.isArray(result[0].content)).toBe(true);
    if (Array.isArray(result[0].content)) {
      expect(result[0].content.length).toBe(3);

      expect(result[0].content[0].type).toBe('reasoning');
      expect(result[0].content[1].type).toBe('redacted-reasoning');
      expect(result[0].content[2].type).toBe('text');

      const redactedPart = result[0].content[1];
      if (redactedPart.type === 'redacted-reasoning') {
        expect(redactedPart.data).toBe('REDACTED_CONTENT_ID_123');
      }
    }
  });

  it('should handle mixed content with files, reasoning, and tool invocations', () => {
    const messages: MastraMessageV2[] = [
      {
        id: 'msg-mixed',
        role: 'assistant',
        createdAt: new Date(),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          parts: [
            {
              type: 'text',
              text: 'Let me analyze this image:',
            },
            {
              type: 'file',
              data: 'data:image/png;base64,abc123',
              mimeType: 'image/png',
            },
            {
              type: 'reasoning',
              details: [
                {
                  type: 'text',
                  text: 'I can see this is a chart showing data trends',
                  signature: 'sig-abc',
                },
              ],
            },
            {
              type: 'text',
              text: 'Now let me fetch the latest data:',
            },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call-789',
                toolName: 'dataFetcher',
                args: { query: 'latest_trends' },
                result: { data: [1, 2, 3] },
              },
            },
            {
              type: 'text',
              text: 'The data has been updated.',
            },
          ],
        },
      },
    ];

    const result = convertToV1Messages(messages);

    // Should split at tool invocation
    // 1. Text + file + reasoning + text
    // 2. Tool call
    // 3. Tool result
    // 4. Final text
    expect(result.length).toBe(4);

    // First message: combined content before tool
    expect(result[0].role).toBe('assistant');
    expect(result[0].type).toBe('text');
    if (Array.isArray(result[0].content)) {
      expect(result[0].content.length).toBe(4);
      expect(result[0].content[0].type).toBe('text');
      expect(result[0].content[1].type).toBe('file');
      expect(result[0].content[2].type).toBe('reasoning');
      expect(result[0].content[3].type).toBe('text');
    }

    // Second message: tool call
    expect(result[1].role).toBe('assistant');
    expect(result[1].type).toBe('tool-call');

    // Third message: tool result
    expect(result[2].role).toBe('tool');
    expect(result[2].type).toBe('tool-result');

    // Fourth message: text after tool
    expect(result[3].role).toBe('assistant');
    expect(result[3].type).toBe('text');
  });

  it('should handle file attachments in experimental_attachments', () => {
    const messages: MastraMessageV2[] = [
      {
        id: 'msg-attachments',
        role: 'user',
        createdAt: new Date(),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          content: 'Please analyze this image',
          parts: [
            {
              type: 'text',
              text: 'Please analyze this image',
            },
          ],
          experimental_attachments: [
            {
              url: 'https://example.com/image.png',
              contentType: 'image/png',
            },
            {
              url: 'data:image/jpeg;base64,/9j/4AAQ...',
              contentType: 'image/jpeg',
            },
          ],
        },
      },
    ];

    const result = convertToV1Messages(messages);

    expect(result.length).toBe(1);
    expect(result[0].role).toBe('user');
    expect(Array.isArray(result[0].content)).toBe(true);
    if (Array.isArray(result[0].content)) {
      // Text + 2 image parts
      expect(result[0].content.length).toBe(3);
      expect(result[0].content[0].type).toBe('text');
      expect(result[0].content[1].type).toBe('image');
      expect(result[0].content[2].type).toBe('image');

      const image1 = result[0].content[1];
      if (image1.type === 'image') {
        expect(image1.image).toBe('https://example.com/image.png');
      }

      const image2 = result[0].content[2];
      if (image2.type === 'image') {
        expect(image2.image).toBe('data:image/jpeg;base64,/9j/4AAQ...');
      }
    }
  });
});
