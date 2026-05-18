import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fetchApi, fetchJson } from '../utils.js';

const RESOURCE = `smoke-mem-extras-${Date.now()}`;
let threadId: string;
let clonedThreadId: string | undefined;

describe('memory extras', () => {
  beforeAll(async () => {
    const { status, data } = await fetchJson<any>(`/api/memory/threads?agentId=test-agent`, {
      method: 'POST',
      body: JSON.stringify({ resourceId: RESOURCE, title: 'Smoke memory extras' }),
    });
    expect(status).toBe(200);
    threadId = data.id;
  });

  afterAll(async () => {
    if (threadId) {
      await fetchApi(`/api/memory/threads/${threadId}?agentId=test-agent`, { method: 'DELETE' }).catch(() => {});
    }
    if (clonedThreadId) {
      await fetchApi(`/api/memory/threads/${clonedThreadId}?agentId=test-agent`, { method: 'DELETE' }).catch(() => {});
    }
  });

  it('POST /memory/threads/:id/clone returns the cloned thread + message map', async () => {
    const { status, data } = await fetchJson<any>(
      `/api/memory/threads/${threadId}/clone?agentId=test-agent`,
      {
        method: 'POST',
        body: JSON.stringify({ resourceId: RESOURCE, title: 'Cloned smoke thread' }),
      },
    );
    expect(status).toBe(200);
    expect(data.thread).toBeDefined();
    expect(typeof data.thread.id).toBe('string');
    expect(data.thread.id).not.toBe(threadId);
    expect(data.thread.resourceId).toBe(RESOURCE);
    expect(Array.isArray(data.clonedMessages)).toBe(true);
    expect(typeof data.messageIdMap).toBe('object');
    expect(data.messageIdMap).not.toBeNull();
    // Source thread has no messages — clone is empty.
    expect(data.clonedMessages).toHaveLength(0);
    clonedThreadId = data.thread.id;
  });

  it('GET /memory/search returns a typed results envelope', async () => {
    const { status, data } = await fetchJson<any>(
      `/api/memory/search?agentId=test-agent&searchQuery=hello&resourceId=${RESOURCE}&limit=5`,
    );
    expect(status).toBe(200);
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.count).toBe(0);
    expect(data.query).toBe('hello');
    expect(['resource', 'thread']).toContain(data.searchScope);
    expect(typeof data.searchType).toBe('string');
  });

  it('GET /memory/observational-memory returns a structured "not enabled" error', async () => {
    const res = await fetchApi(`/api/memory/observational-memory?agentId=test-agent`);
    expect(res.status).toBe(400);
    const data: any = await res.json();
    expect(data.error).toMatch(/observational memory is not enabled/i);
  });

  it('GET /memory/observational-memory/buffer-status returns 404 when not enabled', async () => {
    const res = await fetchApi(`/api/memory/observational-memory/buffer-status?agentId=test-agent`);
    expect(res.status).toBe(404);
  });
});
