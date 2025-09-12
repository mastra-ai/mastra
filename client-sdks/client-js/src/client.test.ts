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
});
