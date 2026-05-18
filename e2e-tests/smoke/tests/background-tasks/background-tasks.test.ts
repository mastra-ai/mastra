import { describe, expect, it } from 'vitest';
import { fetchApi, fetchJson } from '../utils.js';

describe('background tasks — list', () => {
  it('GET /background-tasks returns the paginated tasks envelope', async () => {
    const { status, data } = await fetchJson<any>('/api/background-tasks');
    expect(status).toBe(200);
    expect(Array.isArray(data.tasks)).toBe(true);
    expect(typeof data.total).toBe('number');
    expect(data.total).toBe(data.tasks.length);
  });

  it('GET /background-tasks/:id returns a structured 404 for an unknown id', async () => {
    const res = await fetchApi('/api/background-tasks/does-not-exist-smoke');
    expect(res.status).toBe(404);
    const data: any = await res.json();
    expect(data.error).toMatch(/background task not found/i);
  });
});
