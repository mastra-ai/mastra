import { describe, expect, it } from 'vitest';
import { fetchJson } from '../utils.js';

describe('stored workspaces — list', () => {
  it('lists stored workspaces with pagination envelope', async () => {
    const { status, data } = await fetchJson<any>('/api/stored/workspaces');
    expect(status).toBe(200);
    expect(Array.isArray(data.workspaces)).toBe(true);
    expect(typeof data.total).toBe('number');
    expect(typeof data.page).toBe('number');
    expect(typeof data.perPage).toBe('number');
    expect(typeof data.hasMore).toBe('boolean');
  });
});
