import { describe, expect, beforeEach, it, vi } from 'vitest';
import type { ClientOptions } from '../types';
import { NetworkMemoryThread } from './network-memory-thread';

// Mock fetch globally
global.fetch = vi.fn();

describe('NetworkMemoryThread', () => {
  let thread: NetworkMemoryThread;
  const clientOptions: ClientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
    },
  };
  const threadId = 'test-thread-id';
  const networkId = 'test-network-id';

  beforeEach(() => {
    vi.clearAllMocks();
    thread = new NetworkMemoryThread(clientOptions, threadId, networkId);
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
        `http://localhost:4111/api/memory/network/threads/${threadId}?networkId=${networkId}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
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
        `http://localhost:4111/api/memory/network/threads/${threadId}?networkId=${networkId}`,
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
          body: JSON.stringify(updateParams),
        }),
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
        `http://localhost:4111/api/memory/network/threads/${threadId}?networkId=${networkId}`,
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
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
        `http://localhost:4111/api/memory/network/threads/${threadId}/messages?networkId=${networkId}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
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
        `http://localhost:4111/api/memory/network/threads/${threadId}/messages?networkId=${networkId}&limit=5`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
      );
      expect(result).toEqual(mockMessages);
    });
  });

  describe('deleteMessages', () => {
    it('should delete a single message by string ID', async () => {
      const messageId = 'test-message-id';
      const mockResponse = { success: true, message: '1 message deleted successfully' };

      mockFetchResponse(mockResponse);

      const result = await thread.deleteMessages(messageId);

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/memory/network/messages/delete?networkId=${networkId}`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'content-type': 'application/json',
            Authorization: 'Bearer test-key',
          }),
          body: JSON.stringify({ messageIds: messageId }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should delete multiple messages by array of string IDs', async () => {
      const messageIds = ['msg-1', 'msg-2', 'msg-3'];
      const mockResponse = { success: true, message: '3 messages deleted successfully' };

      mockFetchResponse(mockResponse);

      const result = await thread.deleteMessages(messageIds);

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/memory/network/messages/delete?networkId=${networkId}`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'content-type': 'application/json',
            Authorization: 'Bearer test-key',
          }),
          body: JSON.stringify({ messageIds }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should delete a message by object with id property', async () => {
      const messageObj = { id: 'test-message-id' };
      const mockResponse = { success: true, message: '1 message deleted successfully' };

      mockFetchResponse(mockResponse);

      const result = await thread.deleteMessages(messageObj);

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/memory/network/messages/delete?networkId=${networkId}`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'content-type': 'application/json',
            Authorization: 'Bearer test-key',
          }),
          body: JSON.stringify({ messageIds: messageObj }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should delete messages by array of objects', async () => {
      const messageObjs = [{ id: 'msg-1' }, { id: 'msg-2' }];
      const mockResponse = { success: true, message: '2 messages deleted successfully' };

      mockFetchResponse(mockResponse);

      const result = await thread.deleteMessages(messageObjs);

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:4111/api/memory/network/messages/delete?networkId=${networkId}`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'content-type': 'application/json',
            Authorization: 'Bearer test-key',
          }),
          body: JSON.stringify({ messageIds: messageObjs }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle delete messages errors', async () => {
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

      await expect(thread.deleteMessages(messageId)).rejects.toThrow();
    });
  });
});
