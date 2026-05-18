import { describe, expect, it } from 'vitest';
import { fetchJson } from '../utils.js';

const RESOURCE = `smoke-om-${Date.now()}`;

describe('observational memory — observational-agent', () => {
  it('GET /memory/config reports observationalMemory.enabled = true', async () => {
    const { status, data } = await fetchJson<any>(
      '/api/memory/config?agentId=observational-agent',
    );
    expect(status).toBe(200);
    expect(data.config.observationalMemory.enabled).toBe(true);
  });

  it('GET /memory/observational-memory returns a record envelope (null record when no observations)', async () => {
    const { status, data } = await fetchJson<any>(
      `/api/memory/observational-memory?agentId=observational-agent&resourceId=${RESOURCE}`,
    );
    expect(status).toBe(200);
    expect(data).toHaveProperty('record');
    // No observations recorded yet — record should be null.
    expect(data.record).toBeNull();
  });
});
