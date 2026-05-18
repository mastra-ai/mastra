import { afterAll, describe, expect, it } from 'vitest';
import { fetchApi, fetchJson } from '../utils.js';

const TEST_ID = `smoke-stored-pb-${Date.now()}`;

describe('stored prompt blocks — CRUD', () => {
  afterAll(async () => {
    await fetchApi(`/api/stored/prompt-blocks/${TEST_ID}`, { method: 'DELETE' }).catch(() => {});
  });

  it('lists stored prompt blocks', async () => {
    const { status, data } = await fetchJson<any>('/api/stored/prompt-blocks');
    expect(status).toBe(200);
    expect(Array.isArray(data.promptBlocks)).toBe(true);
    expect(typeof data.total).toBe('number');
  });

  it('creates a stored prompt block', async () => {
    const { status, data } = await fetchJson<any>('/api/stored/prompt-blocks', {
      method: 'POST',
      body: JSON.stringify({
        id: TEST_ID,
        name: 'smoke-prompt',
        content: 'You are a smoke prompt.',
      }),
    });
    expect(status).toBe(200);
    expect(data.id).toBe(TEST_ID);
    expect(data.name).toBe('smoke-prompt');
  });

  it('gets the stored prompt block', async () => {
    const { status, data } = await fetchJson<any>(`/api/stored/prompt-blocks/${TEST_ID}`);
    expect(status).toBe(200);
    expect(data.id).toBe(TEST_ID);
    expect(data.content).toBe('You are a smoke prompt.');
  });

  it('updates the stored prompt block', async () => {
    const { status, data } = await fetchJson<any>(`/api/stored/prompt-blocks/${TEST_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ description: 'updated by smoke' }),
    });
    expect(status).toBe(200);
    expect(data.description).toBe('updated by smoke');
  });

  it('deletes the stored prompt block', async () => {
    const { status, data } = await fetchJson<any>(`/api/stored/prompt-blocks/${TEST_ID}`, {
      method: 'DELETE',
    });
    expect(status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('returns 404 for deleted stored prompt block', async () => {
    const res = await fetchApi(`/api/stored/prompt-blocks/${TEST_ID}`);
    expect(res.status).toBe(404);
  });
});
