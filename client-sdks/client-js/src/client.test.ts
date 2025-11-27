import { describe, expect, beforeEach, it, vi } from 'vitest';
import { MastraClient } from './client';

// Mock fetch globally
global.fetch = vi.fn();

describe('MastraClient', () => {
  let client: MastraClient;
  const clientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
  });

  describe('Client Error Handling', () => {
    it('should retry failed requests', async () => {
      // Mock first two calls to fail, third to succeed
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: () => 'application/json',
          },
          json: async () => ({ success: true }),
        });

      const result = await client.request('/test-endpoint');
      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(client.request('/test-endpoint')).rejects.toThrow('Network error');

      expect(global.fetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('Client Configuration', () => {
    it('should handle custom retry configuration', async () => {
      const customClient = new MastraClient({
        baseUrl: 'http://localhost:4111',
        retries: 2,
        backoffMs: 100,
        maxBackoffMs: 1000,
        headers: { 'Custom-Header': 'value' },
        credentials: 'same-origin',
      });

      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: () => 'application/json',
          },
          json: async () => ({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: () => 'application/json',
          },
          json: async () => ({ success: true }),
        });

      const result = await customClient.request('/test');
      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4111/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Custom-Header': 'value',
          }),
          credentials: 'same-origin',
        }),
      );

      // ensure custom headers and credentials are overridable per request
      const result2 = await customClient.request('/test', {
        headers: { 'Custom-Header': 'new-value' },
        credentials: 'include',
      });
      expect(result2).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledTimes(4);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4111/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Custom-Header': 'new-value',
          }),
          credentials: 'include',
        }),
      );
    });
  });

  describe('Integration Tests', () => {
    it('should be imported from client module', async () => {
      const { MastraClient } = await import('./client');
      const client = new MastraClient({
        baseUrl: 'http://localhost:4111',
        headers: {
          Authorization: 'Bearer test-key',
          'x-mastra-client-type': 'js',
        },
      });

      // Basic smoke test to ensure client initializes correctly
      expect(client).toBeDefined();
      expect(client.getAgent).toBeDefined();
      expect(client.getTool).toBeDefined();
      expect(client.getVector).toBeDefined();
      expect(client.getWorkflow).toBeDefined();
    });
  });

  describe('Working Memory', () => {
    const mockFetchResponse = (data: any) => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => data,
      });
    };

    describe('getWorkingMemory', () => {
      it('should retrieve working memory for a thread', async () => {
        const mockResponse = {
          workingMemory: '# User Profile\n- Name: John',
          source: 'thread',
          workingMemoryTemplate: null,
          threadExists: true,
        };

        mockFetchResponse(mockResponse);

        const result = await client.getWorkingMemory({
          agentId: 'agent-1',
          threadId: 'thread-1',
        });

        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:4111/api/memory/threads/thread-1/working-memory?agentId=agent-1&resourceId=undefined',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-key',
            }),
          }),
        );
        expect(result).toEqual(mockResponse);
      });

      it('should retrieve working memory with resourceId for resource-scoped memory', async () => {
        const mockResponse = {
          workingMemory: '# User Profile\n- Name: Jane',
          source: 'resource',
          workingMemoryTemplate: { format: 'markdown', content: '# User Profile' },
          threadExists: true,
        };

        mockFetchResponse(mockResponse);

        const result = await client.getWorkingMemory({
          agentId: 'agent-1',
          threadId: 'thread-1',
          resourceId: 'user-123',
        });

        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:4111/api/memory/threads/thread-1/working-memory?agentId=agent-1&resourceId=user-123',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-key',
            }),
          }),
        );
        expect(result).toEqual(mockResponse);
      });

      it('should return null working memory when thread has no memory', async () => {
        const mockResponse = {
          workingMemory: null,
          source: 'thread',
          workingMemoryTemplate: null,
          threadExists: true,
        };

        mockFetchResponse(mockResponse);

        const result = await client.getWorkingMemory({
          agentId: 'agent-1',
          threadId: 'thread-1',
        });

        expect(result.workingMemory).toBeNull();
      });
    });

    describe('updateWorkingMemory', () => {
      it('should update working memory for a thread', async () => {
        const mockResponse = { success: true };

        mockFetchResponse(mockResponse);

        const result = await client.updateWorkingMemory({
          agentId: 'agent-1',
          threadId: 'thread-1',
          workingMemory: '# User Profile\n- Name: John\n- Location: NYC',
        });

        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:4111/api/memory/threads/thread-1/working-memory?agentId=agent-1',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: 'Bearer test-key',
              'content-type': 'application/json',
            }),
            body: JSON.stringify({
              workingMemory: '# User Profile\n- Name: John\n- Location: NYC',
              resourceId: undefined,
            }),
          }),
        );
        expect(result).toEqual(mockResponse);
      });

      it('should update working memory with resourceId for resource-scoped memory', async () => {
        const mockResponse = { success: true };

        mockFetchResponse(mockResponse);

        const result = await client.updateWorkingMemory({
          agentId: 'agent-1',
          threadId: 'thread-1',
          workingMemory: '# User Profile\n- Name: Jane',
          resourceId: 'user-456',
        });

        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:4111/api/memory/threads/thread-1/working-memory?agentId=agent-1',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: 'Bearer test-key',
              'content-type': 'application/json',
            }),
            body: JSON.stringify({
              workingMemory: '# User Profile\n- Name: Jane',
              resourceId: 'user-456',
            }),
          }),
        );
        expect(result).toEqual(mockResponse);
      });

      it('should handle update errors', async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          headers: {
            get: () => 'application/json',
          },
          json: async () => ({ message: 'Thread not found' }),
        });

        await expect(
          client.updateWorkingMemory({
            agentId: 'agent-1',
            threadId: 'nonexistent-thread',
            workingMemory: 'test',
          }),
        ).rejects.toThrow();
      });
    });
  });
});
