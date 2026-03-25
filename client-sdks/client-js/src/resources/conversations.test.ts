import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraClient } from '../client';

global.fetch = vi.fn();

const clientOptions = {
  baseUrl: 'http://localhost:4111',
  headers: {
    Authorization: 'Bearer test-key',
  },
};

function mockJsonResponse(data: unknown) {
  const response = new Response(undefined, {
    status: 200,
    statusText: 'OK',
    headers: new Headers({
      'Content-Type': 'application/json',
    }),
  });

  response.json = () => Promise.resolve(data);
  (global.fetch as any).mockResolvedValueOnce(response);
}

describe('Conversations Resource', () => {
  let client: MastraClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
  });

  it('creates a conversation', async () => {
    mockJsonResponse({
      id: 'conv_123',
      object: 'conversation',
      thread: {
        id: 'conv_123',
        resourceId: 'conv_123',
      },
      messages: [],
    });

    const conversation = await client.conversations.create({
      agent_id: 'support-agent',
      conversation_id: 'conv_123',
    });

    expect(conversation).toMatchObject({
      id: 'conv_123',
      object: 'conversation',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/v1/conversations',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          agent_id: 'support-agent',
          conversation_id: 'conv_123',
        }),
      }),
    );
  });

  it('retrieves a conversation', async () => {
    mockJsonResponse({
      id: 'conv_123',
      object: 'conversation',
      thread: {
        id: 'conv_123',
        resourceId: 'conv_123',
      },
      messages: [
        {
          id: 'msg_1',
          threadId: 'conv_123',
          resourceId: 'conv_123',
          role: 'user',
          type: 'text',
          content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
        },
      ],
    });

    const conversation = await client.conversations.retrieve('conv_123');
    expect(conversation.thread.id).toBe('conv_123');
    expect(conversation.messages).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/v1/conversations/conv_123',
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });
});
