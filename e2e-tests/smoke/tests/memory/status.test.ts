import { describe, it, expect } from 'vitest';
import { fetchJson } from '../utils.js';

describe('memory — status and config', () => {
  it('should return memory status', async () => {
    const { status, data } = await fetchJson<any>('/api/memory/status?agentId=test-agent');

    expect(status).toBe(200);
    expect(data.result).toBe(true);
  });

  it('should return memory config with exact shape', async () => {
    const { status, data } = await fetchJson<any>('/api/memory/config?agentId=test-agent');

    expect(status).toBe(200);
    expect(data.config).toEqual({
      lastMessages: 20,
      semanticRecall: false,
      generateTitle: false,
      workingMemory: {
        enabled: true,
        template: expect.stringContaining('# User Information'),
      },
      observationalMemory: { enabled: false },
    });
  });

  it('should return null working memory for a fresh thread', async () => {
    const threadId = crypto.randomUUID();
    const resourceId = 'wm-test-user';

    await fetchJson('/api/memory/threads?agentId=test-agent', {
      method: 'POST',
      body: JSON.stringify({ threadId, resourceId, title: 'WM Test' }),
    });

    const { status, data } = await fetchJson<any>(
      `/api/memory/threads/${threadId}/working-memory?agentId=test-agent&resourceId=${resourceId}`,
    );

    expect(status).toBe(200);
    expect(data.workingMemory).toBeNull();
    expect(data.source).toBe('resource');
    expect(data.threadExists).toBe(true);
    expect(data.workingMemoryTemplate).toEqual({
      format: 'markdown',
      content: expect.stringContaining('# User Information'),
    });
  });

  it('should update and retrieve working memory', async () => {
    const threadId = crypto.randomUUID();
    const resourceId = 'wm-update-user';

    await fetchJson('/api/memory/threads?agentId=test-agent', {
      method: 'POST',
      body: JSON.stringify({ threadId, resourceId, title: 'WM Update Test' }),
    });

    const updateRes = await fetchJson<any>(
      `/api/memory/threads/${threadId}/working-memory?agentId=test-agent`,
      {
        method: 'POST',
        body: JSON.stringify({
          workingMemory: 'User prefers concise answers.',
          resourceId,
        }),
      },
    );

    expect(updateRes.status).toBe(200);
    expect(updateRes.data).toEqual({ success: true });

    const { status, data } = await fetchJson<any>(
      `/api/memory/threads/${threadId}/working-memory?agentId=test-agent&resourceId=${resourceId}`,
    );

    expect(status).toBe(200);
    expect(data.workingMemory).toBe('User prefers concise answers.');
    expect(data.source).toBe('resource');
    expect(data.threadExists).toBe(true);
  });
});
