import { describe, expect, beforeEach, it, vi } from 'vitest';
import { MemoryThread } from './memory-thread';
import type { ClientOptions } from '../types';

// Mock fetch globally
global.fetch = vi.fn();

describe('MemoryThread', () => {
  let thread: MemoryThread;
  const clientOptions: ClientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
    },
  };
  const threadId = 'test-thread-id';
  const agentId = 'test-agent-id';

  beforeEach(() => {
    vi.clearAllMocks();
    thread = new MemoryThread(clientOptions, threadId, agentId);
  });

  const mockFetchResponse = (data: any) => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => data,
      headers: new Headers({
        'content-type': 'application/json',
      }),
    });
  };

  describe('get', () => {
    it('should retrieve thread details', async () => {
      const mockThread = {
        id: threadId,
        title: 'Test Thread',
        metadata: { test: true },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockFetchResponse(mockThread);

      const result = await thread.get();

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/memory/threads/${threadId}?agentId=${agentId}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        })
      );
      expect(result).toEqual(mockThread);
    });
  });

  describe('update', () => {
    it('should update thread properties', async () => {
      const updateParams = {
        title: 'Updated Title',
        metadata: { updated: true },
        resourceid: 'resource-1',
      };

      const mockUpdatedThread = {
        id: threadId,
        ...updateParams,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockFetchResponse(mockUpdatedThread);

      const result = await thread.update(updateParams);

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/memory/threads/${threadId}?agentId=${agentId}`,
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
          body: JSON.stringify(updateParams),
        })
      );
      expect(result).toEqual(mockUpdatedThread);
    });
  });

  describe('delete', () => {
    it('should delete the thread', async () => {
      const mockResponse = { result: 'Thread deleted' };
      mockFetchResponse(mockResponse);

      const result = await thread.delete();

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/memory/threads/${threadId}?agentId=${agentId}`,
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getMessages', () => {
    it('should retrieve thread messages', async () => {
      const mockMessages = {
        messages: [
          { id: 'msg-1', content: 'Hello', role: 'user' },
          { id: 'msg-2', content: 'Hi there', role: 'assistant' },
        ],
        uiMessages: [
          { id: 'msg-1', content: 'Hello', role: 'user' },
          { id: 'msg-2', content: 'Hi there', role: 'assistant' },
        ],
      };

      mockFetchResponse(mockMessages);

      const result = await thread.getMessages();

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/memory/threads/${threadId}/messages?agentId=${agentId}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        })
      );
      expect(result).toEqual(mockMessages);
    });

    it('should retrieve thread messages with limit', async () => {
      const mockMessages = {
        messages: [{ id: 'msg-1', content: 'Hello', role: 'user' }],
        uiMessages: [{ id: 'msg-1', content: 'Hello', role: 'user' }],
      };

      mockFetchResponse(mockMessages);

      const result = await thread.getMessages({ limit: 5 });

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/memory/threads/${threadId}/messages?agentId=${agentId}&limit=5`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        })
      );
      expect(result).toEqual(mockMessages);
    });
  });

  describe('deleteMessage', () => {
    it('should delete a specific message', async () => {
      const messageId = 'test-message-id';
      const mockResponse = { success: true, message: 'Message deleted successfully' };
      
      mockFetchResponse(mockResponse);

      const result = await thread.deleteMessage(messageId);

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/memory/messages/${messageId}?agentId=${agentId}`,
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle delete message errors', async () => {
      const messageId = 'non-existent-id';
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Message not found' }),
        headers: new Headers({
          'content-type': 'application/json',
        }),
      });

      await expect(thread.deleteMessage(messageId)).rejects.toThrow();
    });
  });
});