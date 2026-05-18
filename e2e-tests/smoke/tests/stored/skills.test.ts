import { afterAll, describe, expect, it } from 'vitest';
import { fetchApi, fetchJson } from '../utils.js';

const TEST_ID = `smoke-stored-skill-${Date.now()}`;

describe('stored skills — CRUD', () => {
  afterAll(async () => {
    await fetchApi(`/api/stored/skills/${TEST_ID}`, { method: 'DELETE' }).catch(() => {});
  });

  it('lists stored skills', async () => {
    const { status, data } = await fetchJson<any>('/api/stored/skills');
    expect(status).toBe(200);
    expect(Array.isArray(data.skills)).toBe(true);
    expect(typeof data.total).toBe('number');
  });

  it('creates a stored skill', async () => {
    const { status, data } = await fetchJson<any>('/api/stored/skills', {
      method: 'POST',
      body: JSON.stringify({
        id: TEST_ID,
        name: 'smoke-skill',
        description: 'A smoke-test skill',
        instructions: '# Smoke\nDo smoke things.',
      }),
    });
    expect(status).toBe(200);
    expect(data.id).toBe(TEST_ID);
    expect(data.name).toBe('smoke-skill');
    expect(data.status).toBe('draft');
  });

  it('gets the stored skill', async () => {
    const { status, data } = await fetchJson<any>(`/api/stored/skills/${TEST_ID}`);
    expect(status).toBe(200);
    expect(data.id).toBe(TEST_ID);
    expect(data.description).toBe('A smoke-test skill');
  });

  it('updates the stored skill', async () => {
    const { status, data } = await fetchJson<any>(`/api/stored/skills/${TEST_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'smoke-skill',
        description: 'updated by smoke',
        instructions: '# Smoke\nDo smoke things.',
      }),
    });
    expect(status).toBe(200);
    expect(data.description).toBe('updated by smoke');
  });

  it('deletes the stored skill', async () => {
    const { status, data } = await fetchJson<any>(`/api/stored/skills/${TEST_ID}`, {
      method: 'DELETE',
    });
    expect(status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('returns 404 for deleted stored skill', async () => {
    const res = await fetchApi(`/api/stored/skills/${TEST_ID}`);
    expect(res.status).toBe(404);
  });
});
