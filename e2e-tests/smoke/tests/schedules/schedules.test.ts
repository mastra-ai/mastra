import { describe, expect, it } from 'vitest';
import { fetchApi, fetchJson } from '../utils.js';

describe('schedules — list', () => {
  it('GET /schedules returns the schedules envelope (empty in smoke fixture)', async () => {
    const { status, data } = await fetchJson<any>('/api/schedules');
    expect(status).toBe(200);
    expect(Array.isArray(data.schedules)).toBe(true);
    // The smoke fixture does not declare any scheduled workflows.
    expect(data.schedules).toHaveLength(0);
  });

  it('GET /schedules/:scheduleId returns a structured 404 for an unknown id', async () => {
    const res = await fetchApi('/api/schedules/does-not-exist-smoke');
    expect(res.status).toBe(404);
    const data: any = await res.json();
    expect(data.error).toMatch(/schedule not found/i);
  });
});
