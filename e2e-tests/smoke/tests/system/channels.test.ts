import { describe, expect, it } from 'vitest';
import { fetchApi, fetchJson } from '../utils.js';

describe('channels — list', () => {
  it('GET /channels/platforms returns the registered smoke-stub platform', async () => {
    const { status, data } = await fetchJson<any>('/api/channels/platforms');
    expect(status).toBe(200);
    const platforms: any[] = Array.isArray(data) ? data : data.platforms;
    expect(Array.isArray(platforms)).toBe(true);

    const stub = platforms.find((p: any) => p.id === 'smoke-stub');
    expect(stub).toBeDefined();
    expect(stub.name).toBe('Smoke Stub');
    expect(stub.isConfigured).toBe(true);
  });

  it('GET /channels/:platform/installations returns the seeded installation for smoke-stub', async () => {
    const { status, data } = await fetchJson<any>('/api/channels/smoke-stub/installations');
    expect(status).toBe(200);
    const installs: any[] = Array.isArray(data) ? data : data.installations;
    expect(Array.isArray(installs)).toBe(true);
    expect(installs.length).toBe(1);
    expect(installs[0].id).toBe('smoke-stub-install-1');
    expect(installs[0].platform).toBe('smoke-stub');
    expect(installs[0].agentId).toBe('test-agent');
    expect(installs[0].status).toBe('active');
  });

  it('GET /channels/:platform/installations errors when the platform is unregistered', async () => {
    const res = await fetchApi('/api/channels/slack/installations');
    expect([400, 404, 500]).toContain(res.status);
    const data: any = await res.json().catch(() => ({}));
    expect(typeof data.error).toBe('string');
    expect(data.error).toMatch(/channel|not registered|not configured/i);
  });
});
