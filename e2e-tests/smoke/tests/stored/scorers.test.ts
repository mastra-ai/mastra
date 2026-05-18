import { afterAll, describe, expect, it } from 'vitest';
import { fetchApi, fetchJson } from '../utils.js';

const TEST_ID = `smoke-stored-scorer-${Date.now()}`;

describe('stored scorers — CRUD', () => {
  afterAll(async () => {
    await fetchApi(`/api/stored/scorers/${TEST_ID}`, { method: 'DELETE' }).catch(() => {});
  });

  it('lists stored scorer definitions', async () => {
    const { status, data } = await fetchJson<any>('/api/stored/scorers');
    expect(status).toBe(200);
    expect(Array.isArray(data.scorerDefinitions)).toBe(true);
    expect(typeof data.total).toBe('number');
  });

  it('creates a stored scorer (llm-judge)', async () => {
    const { status, data } = await fetchJson<any>('/api/stored/scorers', {
      method: 'POST',
      body: JSON.stringify({
        id: TEST_ID,
        name: 'smoke-scorer',
        type: 'llm-judge',
        model: { provider: 'openai', name: 'gpt-4o-mini' },
        instructions: 'Score the output.',
      }),
    });
    expect(status).toBe(200);
    expect(data.id).toBe(TEST_ID);
    expect(data.type).toBe('llm-judge');
  });

  it('gets the stored scorer', async () => {
    const { status, data } = await fetchJson<any>(`/api/stored/scorers/${TEST_ID}`);
    expect(status).toBe(200);
    expect(data.id).toBe(TEST_ID);
  });

  it('updates the stored scorer', async () => {
    const { status, data } = await fetchJson<any>(`/api/stored/scorers/${TEST_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ description: 'updated by smoke' }),
    });
    expect(status).toBe(200);
    expect(data.description).toBe('updated by smoke');
  });

  it('deletes the stored scorer', async () => {
    const { status, data } = await fetchJson<any>(`/api/stored/scorers/${TEST_ID}`, {
      method: 'DELETE',
    });
    expect(status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('returns 404 for deleted stored scorer', async () => {
    const res = await fetchApi(`/api/stored/scorers/${TEST_ID}`);
    expect(res.status).toBe(404);
  });
});
