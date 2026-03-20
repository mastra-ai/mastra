import { describe, it, expect } from 'vitest';
import { fetchApi, fetchJson } from '../utils.js';

describe('memory — threads', () => {
  describe('CRUD', () => {
    it('should create a thread', async () => {
      const threadId = crypto.randomUUID();
      const { status, data } = await fetchJson<any>('/api/memory/threads?agentId=test-agent', {
        method: 'POST',
        body: JSON.stringify({
          threadId,
          resourceId: 'test-user',
          title: 'Test Thread',
          metadata: { purpose: 'smoke-test' },
        }),
      });

      expect(status).toBe(200);
      expect(data.id).toBe(threadId);
      expect(data.title).toBe('Test Thread');
      expect(data.resourceId).toBe('test-user');
      expect(data.metadata).toEqual({ purpose: 'smoke-test' });
      expect(data.createdAt).toBeTypeOf('string');
      expect(data.updatedAt).toBeTypeOf('string');
    });

    it('should get thread by ID', async () => {
      const threadId = crypto.randomUUID();
      await fetchJson('/api/memory/threads?agentId=test-agent', {
        method: 'POST',
        body: JSON.stringify({ threadId, resourceId: 'test-user', title: 'Get Test' }),
      });

      const { status, data } = await fetchJson<any>(
        `/api/memory/threads/${threadId}?agentId=test-agent`,
      );

      expect(status).toBe(200);
      expect(data.id).toBe(threadId);
      expect(data.title).toBe('Get Test');
      expect(data.resourceId).toBe('test-user');
    });

    it('should list threads with pagination metadata', async () => {
      const resourceId = `list-test-${crypto.randomUUID()}`;
      const threadId = crypto.randomUUID();
      await fetchJson('/api/memory/threads?agentId=test-agent', {
        method: 'POST',
        body: JSON.stringify({ threadId, resourceId, title: 'List Test' }),
      });

      const { status, data } = await fetchJson<any>(
        `/api/memory/threads?agentId=test-agent&resourceId=${resourceId}`,
      );

      expect(status).toBe(200);
      expect(data.threads).toHaveLength(1);
      expect(data.threads[0].id).toBe(threadId);
      expect(data.threads[0].resourceId).toBe(resourceId);
      expect(data.threads[0].title).toBe('List Test');
      expect(data.total).toBe(1);
      expect(data.page).toBe(0);
      expect(data.perPage).toBe(100);
      expect(data.hasMore).toBe(false);
    });

    it('should update thread metadata', async () => {
      const threadId = crypto.randomUUID();
      await fetchJson('/api/memory/threads?agentId=test-agent', {
        method: 'POST',
        body: JSON.stringify({ threadId, resourceId: 'test-user', title: 'Before Update' }),
      });

      const { status, data } = await fetchJson<any>(
        `/api/memory/threads/${threadId}?agentId=test-agent`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            title: 'After Update',
            metadata: { updated: true },
          }),
        },
      );

      expect(status).toBe(200);
      expect(data.id).toBe(threadId);
      expect(data.title).toBe('After Update');
      expect(data.metadata).toEqual({ updated: true });
    });

    it('should delete a thread', async () => {
      const threadId = crypto.randomUUID();
      await fetchJson('/api/memory/threads?agentId=test-agent', {
        method: 'POST',
        body: JSON.stringify({ threadId, resourceId: 'test-user', title: 'Delete Me' }),
      });

      const deleteRes = await fetchApi(
        `/api/memory/threads/${threadId}?agentId=test-agent`,
        { method: 'DELETE' },
      );
      expect(deleteRes.status).toBe(200);

      // Verify it's gone
      const getRes = await fetchApi(
        `/api/memory/threads/${threadId}?agentId=test-agent`,
      );
      expect(getRes.status).toBe(404);
    });

    it('should return 404 for non-existent thread', async () => {
      const res = await fetchApi(
        `/api/memory/threads/${crypto.randomUUID()}?agentId=test-agent`,
      );
      expect(res.status).toBe(404);
    });
  });
});
