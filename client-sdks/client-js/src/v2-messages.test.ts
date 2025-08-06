import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MastraMessageV1, MastraMessageV2 } from '@mastra/core';
import { MastraClient } from './client';

describe('V2 Message Format Support', () => {
  let client: MastraClient;
  const agentId = 'test-agent';

  beforeEach(() => {
    global.fetch = vi.fn();
    client = new MastraClient({
      baseUrl: 'http://localhost:3000',
    });
  });

  it('should send v1 messages successfully', async () => {
    const v1Messages: MastraMessageV1[] = [
      {
        id: 'msg-v1-1',
        role: 'user',
        content: 'Hello from v1!',
        type: 'text',
        createdAt: new Date(),
        threadId: 'thread-123',
        resourceId: 'resource-123',
      },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => v1Messages,
    });

    const result = await client.saveMessageToMemory({
      agentId,
      messages: v1Messages,
    });

    expect(result).toEqual(v1Messages);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/memory/save-messages'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ agentId, messages: v1Messages }),
      }),
    );
  });

  it('should send v2 messages successfully', async () => {
    const v2Messages: MastraMessageV2[] = [
      {
        id: 'msg-v2-1',
        role: 'assistant',
        createdAt: new Date(),
        threadId: 'thread-123',
        resourceId: 'resource-123',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Hello from v2!' }],
          content: 'Hello from v2!',
        },
      },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => v2Messages,
    });

    const result = await client.saveMessageToMemory({
      agentId,
      messages: v2Messages,
    });

    expect(result).toEqual(v2Messages);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/memory/save-messages'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ agentId, messages: v2Messages }),
      }),
    );
  });

  it('should send mixed v1 and v2 messages successfully', async () => {
    const mixedMessages: (MastraMessageV1 | MastraMessageV2)[] = [
      {
        id: 'msg-v1-1',
        role: 'user',
        content: 'Question in v1 format',
        type: 'text',
        createdAt: new Date(),
        threadId: 'thread-123',
        resourceId: 'resource-123',
      },
      {
        id: 'msg-v2-1',
        role: 'assistant',
        createdAt: new Date(),
        threadId: 'thread-123',
        resourceId: 'resource-123',
        content: {
          format: 2,
          parts: [
            { type: 'text', text: 'Answer in v2 format' },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result' as const,
                toolCallId: 'call-123',
                toolName: 'calculator',
                args: { a: 1, b: 2 },
                result: '3',
              },
            },
          ],
          toolInvocations: [
            {
              state: 'result' as const,
              toolCallId: 'call-123',
              toolName: 'calculator',
              args: { a: 1, b: 2 },
              result: '3',
            },
          ],
        },
      },
    ];

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mixedMessages,
    });

    const result = await client.saveMessageToMemory({
      agentId,
      messages: mixedMessages,
    });

    expect(result).toEqual(mixedMessages);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/memory/save-messages'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ agentId, messages: mixedMessages }),
      }),
    );
  });

  it('should handle v2 messages with attachments', async () => {
    const v2MessageWithAttachments: MastraMessageV2 = {
      id: 'msg-v2-att',
      role: 'user',
      createdAt: new Date(),
      threadId: 'thread-123',
      resourceId: 'resource-123',
      content: {
        format: 2,
        parts: [
          { type: 'text', text: 'Check out this image:' },
          { type: 'file', data: 'data:image/png;base64,iVBORw0...', mimeType: 'image/png' },
        ],
        experimental_attachments: [{ url: 'data:image/png;base64,iVBORw0...', contentType: 'image/png' }],
      },
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [v2MessageWithAttachments],
    });

    const result = await client.saveMessageToMemory({
      agentId,
      messages: [v2MessageWithAttachments],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(v2MessageWithAttachments);
  });
});
