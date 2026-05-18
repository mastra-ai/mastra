import { describe, expect, it } from 'vitest';
import { fetchJson } from '../utils.js';

describe('Logs API — fixture exposes a memory transport with real entries', () => {
  it('GET /logs/transports lists the smoke memory transport', async () => {
    const { status, data } = await fetchJson<{ transports: string[] }>('/api/logs/transports');
    expect(status).toBe(200);
    expect(Array.isArray(data.transports)).toBe(true);
    expect(data.transports).toContain('memory');
  });

  it('GET /logs?transportId=memory returns paginated log records', async () => {
    const { status, data } = await fetchJson<{
      logs: Array<{ msg: string; level: number | string; name?: string; time?: string | Date }>;
      total: number;
      page: number;
      perPage: number;
      hasMore: boolean;
    }>('/api/logs?transportId=memory&page=1&perPage=10');
    expect(status).toBe(200);
    expect(Array.isArray(data.logs)).toBe(true);
    expect(data.total).toBeGreaterThan(0);
    expect(data.page).toBe(1);
    expect(data.perPage).toBe(10);

    // The fixture emits a startup log; assert at least one record carries a msg.
    const startup = data.logs.find(l => typeof l.msg === 'string' && l.msg.includes('smoke fixture logger initialized'));
    expect(startup).toBeDefined();
  });

  it('GET /logs without transportId returns 4xx (transportId is required)', async () => {
    const res = await fetchJson<any>('/api/logs');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
