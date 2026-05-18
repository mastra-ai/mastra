import { describe, expect, it } from 'vitest';
import { fetchApi, fetchJson } from '../utils.js';

describe('channels — list', () => {
  it('GET /channels/platforms returns an array (empty in smoke fixture)', async () => {
    const { status, data } = await fetchJson<any>('/api/channels/platforms');
    expect(status).toBe(200);
    const platforms: any[] = Array.isArray(data) ? data : data.platforms;
    expect(Array.isArray(platforms)).toBe(true);
    // No channel platforms registered in the smoke fixture.
    expect(platforms).toHaveLength(0);
  });

  it('GET /channels/:platform/installations errors when the platform is unregistered', async () => {
    const res = await fetchApi('/api/channels/slack/installations');
    expect([400, 404, 500]).toContain(res.status);
    const data: any = await res.json().catch(() => ({}));
    expect(typeof data.error).toBe('string');
    expect(data.error).toMatch(/channel|not registered|not configured/i);
  });
});
